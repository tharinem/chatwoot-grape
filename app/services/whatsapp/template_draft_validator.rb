class Whatsapp::TemplateDraftValidator
  ALLOWED_CATEGORIES = %w[MARKETING UTILITY].freeze
  ALLOWED_BUTTON_TYPES = %w[QUICK_REPLY URL].freeze
  NAME_FORMAT = /\A[a-z0-9_]{1,512}\z/
  LANGUAGE_FORMAT = /\A[a-z]{2}(_[A-Z]{2})?\z/
  VARIABLE_PATTERN = /\{\{(\d+)\}\}/
  URL_TRAILING_VARIABLE = '{{1}}'.freeze
  BODY_MAX_LENGTH = 1024
  HEADER_MAX_LENGTH = 60
  FOOTER_MAX_LENGTH = 60
  BUTTON_TEXT_MAX_LENGTH = 25
  MAX_QUICK_REPLIES = 3

  def initialize(params)
    @params = params.to_h.with_indifferent_access
    @errors = []
  end

  def errors
    validate
    @errors
  end

  private

  def name = @params[:name].to_s
  def category = @params[:category].to_s
  def language = @params[:language].to_s
  def body = @params[:body].to_s
  def body_examples = Array(@params[:body_examples]).map(&:to_s)
  def header_text = @params[:header_text].to_s
  def header_example = @params[:header_example].to_s
  def footer = @params[:footer].to_s
  def buttons = Array(@params[:buttons]).map { |button| button.to_h.with_indifferent_access }

  def add_error(field, code)
    @errors << { field: field, code: code }
  end

  def variables_in(text)
    text.scan(VARIABLE_PATTERN).flatten.map(&:to_i)
  end

  def validate
    validate_name
    validate_category
    validate_language
    validate_body
    validate_header
    validate_footer
    validate_buttons
  end

  def validate_name
    add_error('name', 'invalid_format') unless NAME_FORMAT.match?(name)
  end

  def validate_category
    add_error('category', 'invalid_value') unless ALLOWED_CATEGORIES.include?(category)
  end

  def validate_language
    add_error('language', 'invalid_format') unless LANGUAGE_FORMAT.match?(language)
  end

  def validate_body
    return add_error('body', 'required') if body.strip.blank?
    return add_error('body', 'too_long') if body.length > BODY_MAX_LENGTH

    variables = variables_in(body).uniq
    return if variables.empty?

    add_error('body', 'non_sequential_variables') unless variables.sort == (1..variables.size).to_a
    add_error('body', 'variable_at_edge') if variable_at_edge?(body)
    validate_body_examples(variables.size)
  end

  def variable_at_edge?(text)
    stripped = text.strip
    stripped.match?(/\A\{\{\d+\}\}/) || stripped.match?(/\{\{\d+\}\}\z/)
  end

  def validate_body_examples(variable_count)
    examples = body_examples
    return if examples.size == variable_count && examples.all?(&:present?)

    add_error('body_examples', 'missing_examples')
  end

  def validate_header
    return if header_text.blank?
    return add_error('header_text', 'too_long') if header_text.length > HEADER_MAX_LENGTH

    variables = variables_in(header_text)
    return if variables.empty?
    return add_error('header_text', 'too_many_variables') if variables.size > 1 || variables.first != 1

    add_error('header_example', 'required') if header_example.blank?
  end

  def validate_footer
    return if footer.blank?

    add_error('footer', 'too_long') if footer.length > FOOTER_MAX_LENGTH
    add_error('footer', 'variables_not_allowed') if footer.include?('{{')
  end

  def validate_buttons
    list = buttons
    return if list.empty?

    types = list.pluck(:type).uniq
    return add_error('buttons', 'mixed_types') if types.size > 1
    return add_error('buttons', 'invalid_type') unless ALLOWED_BUTTON_TYPES.include?(types.first)

    validate_button_count(types.first, list.size)
    list.each_with_index { |button, index| validate_button(button, index) }
  end

  def validate_button_count(type, count)
    add_error('buttons', 'too_many') if (type == 'QUICK_REPLY' && count > MAX_QUICK_REPLIES) || (type == 'URL' && count > 1)
  end

  def validate_button(button, index)
    text = button[:text].to_s
    add_error("buttons.#{index}.text", 'required') if text.strip.blank?
    add_error("buttons.#{index}.text", 'too_long') if text.length > BUTTON_TEXT_MAX_LENGTH
    validate_button_url(button, index) if button[:type] == 'URL'
  end

  def validate_button_url(button, index)
    url = button[:url].to_s
    base_url = url.delete_suffix(URL_TRAILING_VARIABLE)
    return add_error("buttons.#{index}.url", 'invalid_url') unless https_url?(base_url) && base_url.exclude?('{{')

    add_error("buttons.#{index}.example", 'required') if url.end_with?(URL_TRAILING_VARIABLE) && button[:example].to_s.strip.blank?
  end

  def https_url?(url)
    uri = URI.parse(url)
    uri.is_a?(URI::HTTPS) && uri.host.present?
  rescue URI::InvalidURIError
    false
  end
end
