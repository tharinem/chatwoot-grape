class Whatsapp::TemplateCreationService
  WHATSAPP_API_VERSION = 'v14.0'.freeze
  DEFAULT_LANGUAGE = 'pt_BR'.freeze
  VARIABLE_PATTERN = Whatsapp::TemplateDraftValidator::VARIABLE_PATTERN
  URL_TRAILING_VARIABLE = Whatsapp::TemplateDraftValidator::URL_TRAILING_VARIABLE
  REQUEST_TIMEOUT = 15
  # SystemCallError covers every Errno::* (ECONNREFUSED, ECONNRESET, EHOSTUNREACH...)
  REQUEST_ERRORS = [
    HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout, Net::WriteTimeout, SocketError, EOFError,
    OpenSSL::SSL::SSLError, SystemCallError, JSON::ParserError
  ].freeze

  def initialize(channel:, params:)
    @channel = channel
    @params = (params.respond_to?(:to_unsafe_h) ? params.to_unsafe_h : params.to_h).with_indifferent_access
  end

  def perform
    errors = validation_errors
    return { success: false, error_type: :validation, errors: errors } if errors.any?

    if image_header?
      upload = header_image_uploader.upload
      return meta_error_result(upload[:data]) unless upload[:success]

      @header_handle = upload[:handle]
    end

    response = HTTParty.post(templates_url, headers: @channel.api_headers, body: build_payload.to_json, timeout: REQUEST_TIMEOUT)
    process_response(response)
  rescue *REQUEST_ERRORS => e
    Rails.logger.warn "[WHATSAPP TEMPLATE] Template creation request failed: #{e.class.name}"
    request_failed_result
  end

  private

  def validation_errors
    errors = Whatsapp::TemplateDraftValidator.new(@params.merge(language: language)).errors
    return errors if errors.any? || !image_header?

    header_image_uploader.errors
  end

  def image_header?
    @params[:header_format].to_s == 'IMAGE'
  end

  def header_image_uploader
    @header_image_uploader ||= Whatsapp::TemplateHeaderImageUploadService.new(
      channel: @channel, signed_blob_id: @params[:header_image], base_url: graph_base_url,
      api_version: WHATSAPP_API_VERSION, timeout: REQUEST_TIMEOUT
    )
  end

  def name
    @params[:name].to_s
  end

  def category
    @params[:category].to_s
  end

  def language
    @params[:language].presence || DEFAULT_LANGUAGE
  end

  def body
    @params[:body].to_s
  end

  def body_examples
    Array(@params[:body_examples]).map(&:to_s)
  end

  def header_text
    @params[:header_text].to_s
  end

  def header_example
    @params[:header_example].to_s
  end

  def footer
    @params[:footer].to_s
  end

  def buttons
    Whatsapp::TemplateDraftValidator.normalize_buttons(@params[:buttons])
  end

  def variables_in(text)
    text.scan(VARIABLE_PATTERN).flatten.map(&:to_i)
  end

  # Payload

  def build_payload
    {
      name: name,
      language: language,
      category: category,
      components: [header_component, body_component, footer_component, buttons_component].compact
    }
  end

  def header_component
    return { type: 'HEADER', format: 'IMAGE', example: { header_handle: [@header_handle] } } if image_header?
    return if header_text.blank?

    component = { type: 'HEADER', format: 'TEXT', text: header_text }
    component[:example] = { header_text: [header_example] } if variables_in(header_text).any?
    component
  end

  def body_component
    component = { type: 'BODY', text: body }
    component[:example] = { body_text: [body_examples] } if variables_in(body).any?
    component
  end

  def footer_component
    return if footer.blank?

    { type: 'FOOTER', text: footer }
  end

  def buttons_component
    return if buttons.empty?

    { type: 'BUTTONS', buttons: buttons.map { |button| button_payload(button) } }
  end

  def button_payload(button)
    return { type: 'QUICK_REPLY', text: button[:text] } if button[:type] == 'QUICK_REPLY'

    payload = { type: 'URL', text: button[:text], url: button[:url] }
    payload[:example] = [button[:example]] if button[:url].to_s.end_with?(URL_TRAILING_VARIABLE)
    payload
  end

  # HTTP

  def graph_base_url
    ENV.fetch('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com')
  end

  def templates_url
    "#{graph_base_url}/#{WHATSAPP_API_VERSION}/#{@channel.provider_config['business_account_id']}/message_templates"
  end

  # Success is decided by the HTTP status only: a 2xx means Meta accepted the
  # template, even if the body is not the JSON object we expect.
  def process_response(response)
    data = parse_body(response.body)
    return success_result(data) if response.success?

    meta_error_result(data)
  end

  def parse_body(raw)
    return {} if raw.blank?

    parsed = JSON.parse(raw)
    parsed.is_a?(Hash) ? parsed : {}
  rescue JSON::ParserError
    {}
  end

  def request_failed_result
    { success: false, error_type: :request_failed, message: 'request_failed' }
  end

  def success_result(data)
    {
      success: true,
      id: data['id'],
      status: data['status'],
      category: data['category'] || category,
      name: name,
      language: language
    }
  end

  def meta_error_result(data)
    error = data['error'].is_a?(Hash) ? data['error'] : {}
    Rails.logger.warn "[WHATSAPP TEMPLATE] Meta rejected the request: code=#{error['code']} subcode=#{error['error_subcode']}"
    return request_failed_result if error.empty?

    {
      success: false,
      error_type: :meta,
      message: error['error_user_msg'] || error['message'] || 'request_failed',
      details: {
        code: error['code'],
        error_subcode: error['error_subcode'],
        type: error['type'],
        error_user_title: error['error_user_title']
      }.compact
    }
  end
end
