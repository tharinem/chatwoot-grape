# Sends a template header image to Meta with the Resumable Upload API and
# returns the handle Meta expects as the IMAGE header example.
#   1. POST /{app_id}/uploads?file_name&file_length&file_type -> { id: upload session }
#   2. POST /{session_id} with the raw bytes                    -> { h: handle }
class Whatsapp::TemplateHeaderImageUploadService
  ALLOWED_CONTENT_TYPES = %w[image/jpeg image/png].freeze
  MAX_SIZE = 5.megabytes
  FIELD = 'header_image'.freeze

  def initialize(channel:, signed_blob_id:, base_url:, api_version:, timeout:)
    @channel = channel
    @signed_blob_id = signed_blob_id.to_s
    @base_url = base_url
    @api_version = api_version
    @timeout = timeout
  end

  # Local checks done before calling Meta, in the validator error format.
  def errors
    code = if blob.nil? then 'invalid_value'
           elsif ALLOWED_CONTENT_TYPES.exclude?(blob.content_type) then 'invalid_file_type'
           elsif blob.byte_size > MAX_SIZE then 'file_too_large'
           elsif app_id.blank? then 'app_id_missing'
           end
    code ? [{ field: FIELD, code: code }] : []
  end

  # => { success: true, handle: '4::aW...' } or { success: false, data: parsed Meta body }
  def upload
    session = post(session_url, query: session_query, headers: { 'Authorization' => "Bearer #{access_token}" })
    session_id = session[:data]['id']
    return { success: false, data: session[:data] } unless session[:ok] && session_id.present?

    result = blob.open do |file|
      post("#{@base_url}/#{@api_version}/#{session_id}",
           headers: { 'Authorization' => "OAuth #{access_token}", 'file_offset' => '0' }, body: file.read)
    end
    handle = result[:data]['h']
    return { success: false, data: result[:data] } unless result[:ok] && handle.present?

    { success: true, handle: handle }
  end

  private

  def blob
    return @blob if defined?(@blob)

    @blob = @signed_blob_id.present? ? ActiveStorage::Blob.find_signed(@signed_blob_id) : nil
  end

  # GlobalConfigService reads the installation config (used by embedded
  # signup) and falls back to ENV['WHATSAPP_APP_ID'].
  def app_id
    @app_id ||= GlobalConfigService.load('WHATSAPP_APP_ID', '').to_s.strip
  end

  def access_token
    @channel.provider_config['api_key']
  end

  def session_url
    "#{@base_url}/#{@api_version}/#{app_id}/uploads"
  end

  def session_query
    { file_name: blob.filename.to_s, file_length: blob.byte_size, file_type: blob.content_type }
  end

  def post(url, **)
    response = HTTParty.post(url, timeout: @timeout, **)
    { ok: response.success?, data: parse_body(response.body) }
  end

  def parse_body(raw)
    parsed = raw.present? ? JSON.parse(raw) : {}
    parsed.is_a?(Hash) ? parsed : {}
  rescue JSON::ParserError
    {}
  end
end
