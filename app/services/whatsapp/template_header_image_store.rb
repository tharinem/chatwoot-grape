# Keeps a public copy of the IMAGE header of each WhatsApp template, so
# campaigns can use it by default instead of asking for the image again.
#
# Meta only gives back the header example as an expiring CDN link, so the
# image is stored in ActiveStorage and served through the storage proxy URL
# (the same non-expiring URL the campaign "upload image" button uses).
#
# Stored in channel.template_header_images as
#   { "<name>:<language>" => { "url" => "...", "blob_id" => 1 } }
class Whatsapp::TemplateHeaderImageStore
  ALLOWED_CONTENT_TYPES = Whatsapp::TemplateHeaderImageUploadService::ALLOWED_CONTENT_TYPES
  MAX_SIZE = Whatsapp::TemplateHeaderImageUploadService::MAX_SIZE
  META_CDN_HOSTS = %w[whatsapp.net fbcdn.net].freeze
  DOWNLOAD_TIMEOUT = 15

  class Error < StandardError
    attr_reader :code

    def initialize(code)
      @code = code
      super(code)
    end
  end

  def self.key(name, language)
    "#{name}:#{language}"
  end

  def initialize(channel:, host:)
    @channel = channel
    @host = host
  end

  # Saves an uploaded blob (signed id) as the template default image.
  def save_signed_blob(name:, language:, signed_blob_id:)
    blob = signed_blob_id.present? ? ActiveStorage::Blob.find_signed(signed_blob_id.to_s) : nil
    raise Error, 'invalid_value' if blob.nil?

    validate_blob!(blob)
    save(name, language, blob)
  end

  # Copies the example image Meta keeps for an existing template. The URL is
  # read from the synced templates on the server, never from the client.
  def import_from_meta(name:, language:)
    url = synced_header_url(name, language)
    raise Error, 'no_image_header' if url.blank?

    blob = download(url, name)
    save(name, language, blob)
  end

  private

  def validate_blob!(blob)
    raise Error, 'invalid_file_type' if ALLOWED_CONTENT_TYPES.exclude?(blob.content_type)
    raise Error, 'file_too_large' if blob.byte_size > MAX_SIZE
  end

  def save(name, language, blob)
    entry = { 'url' => public_url(blob), 'blob_id' => blob.id }
    @channel.with_lock do
      images = (@channel.template_header_images || {}).merge(self.class.key(name, language) => entry)
      # A regular save re-validates the Meta credentials over HTTP on every write
      @channel.update_columns(template_header_images: images, updated_at: Time.current) # rubocop:disable Rails/SkipsModelValidations
    end
    entry
  end

  def public_url(blob)
    Rails.application.routes.url_helpers.rails_storage_proxy_url(blob, host: @host)
  end

  def synced_header_url(name, language)
    header = Array(synced_template(name, language)&.dig('components')).find { |component| component['type'] == 'HEADER' }
    return unless header&.dig('format') == 'IMAGE'

    Array(header.dig('example', 'header_handle')).first
  end

  def synced_template(name, language)
    Array(@channel.message_templates).find do |item|
      item.is_a?(Hash) && item['name'] == name && item['language'] == language
    end
  end

  def download(url, name)
    raise Error, 'download_failed' unless meta_cdn_url?(url)

    response = HTTParty.get(url, timeout: DOWNLOAD_TIMEOUT, follow_redirects: false)
    raise Error, 'download_failed' unless response.success?

    content_type = response.headers['content-type'].to_s.split(';').first.to_s.strip
    body = response.body.to_s
    raise Error, 'invalid_file_type' if ALLOWED_CONTENT_TYPES.exclude?(content_type)
    raise Error, 'file_too_large' if body.bytesize > MAX_SIZE

    extension = content_type == 'image/png' ? 'png' : 'jpg'
    ActiveStorage::Blob.create_and_upload!(io: StringIO.new(body), filename: "#{name}.#{extension}", content_type: content_type)
  rescue *Whatsapp::TemplateCreationService::REQUEST_ERRORS
    raise Error, 'download_failed'
  end

  def meta_cdn_url?(url)
    uri = URI.parse(url)
    uri.is_a?(URI::HTTPS) && META_CDN_HOSTS.any? { |host| uri.host == host || uri.host.to_s.end_with?(".#{host}") }
  rescue URI::InvalidURIError
    false
  end
end
