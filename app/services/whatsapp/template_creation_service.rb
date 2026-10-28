class Whatsapp::TemplateCreationService
  WHATSAPP_API_VERSION = 'v14.0'.freeze
  DEFAULT_LANGUAGE = 'pt_BR'.freeze
  VARIABLE_PATTERN = Whatsapp::TemplateDraftValidator::VARIABLE_PATTERN
  URL_TRAILING_VARIABLE = Whatsapp::TemplateDraftValidator::URL_TRAILING_VARIABLE
  REQUEST_TIMEOUT = 15
  REQUEST_ERRORS = [HTTParty::Error, Net::OpenTimeout, Net::ReadTimeout, SocketError, JSON::ParserError].freeze

  def initialize(channel:, params:)
    @channel = channel
    @params = (params.respond_to?(:to_unsafe_h) ? params.to_unsafe_h : params.to_h).with_indifferent_access
  end

  def perform
    errors = Whatsapp::TemplateDraftValidator.new(@params.merge(language: language)).errors
    return { success: false, error_type: :validation, errors: errors } if errors.any?

    response = HTTParty.post(templates_url, headers: @channel.api_headers, body: build_payload.to_json, timeout: REQUEST_TIMEOUT)
    process_response(response)
  rescue *REQUEST_ERRORS => e
    Rails.logger.warn "[WHATSAPP TEMPLATE] Template creation request failed: #{e.class.name}"
    { success: false, error_type: :meta, message: 'request_failed' }
  end

  private

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
    Array(@params[:buttons]).map { |button| button.to_h.with_indifferent_access }
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

  def templates_url
    base = ENV.fetch('WHATSAPP_CLOUD_BASE_URL', 'https://graph.facebook.com')
    "#{base}/#{WHATSAPP_API_VERSION}/#{@channel.provider_config['business_account_id']}/message_templates"
  end

  def process_response(response)
    data = response.body.present? ? JSON.parse(response.body) : {}
    return success_result(data) if response.success?

    meta_error_result(data)
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
    error = data.is_a?(Hash) ? (data['error'] || {}) : {}
    Rails.logger.warn "[WHATSAPP TEMPLATE] Template creation rejected: code=#{error['code']} subcode=#{error['error_subcode']}"
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
