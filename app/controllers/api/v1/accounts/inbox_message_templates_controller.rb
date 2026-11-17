class Api::V1::Accounts::InboxMessageTemplatesController < Api::V1::Accounts::BaseController
  before_action :fetch_inbox
  before_action :check_admin_authorization?
  before_action :validate_whatsapp_cloud_channel

  def create
    result = Whatsapp::TemplateCreationService.new(channel: @inbox.channel, params: template_params).perform

    if result[:success]
      store_created_header_image
      Channels::Whatsapp::TemplatesSyncJob.perform_later(@inbox.channel)
      render json: { template: result.except(:success) }, status: :created
    elsif result[:error_type] == :validation
      render json: { errors: result[:errors] }, status: :unprocessable_entity
    else
      render json: { error: result[:message], error_type: result[:error_type], details: result[:details] || {} },
             status: :unprocessable_entity
    end
  rescue ActionController::ParameterMissing
    render json: { error: 'Template parameters are required' }, status: :unprocessable_entity
  end

  # Sets the default header image campaigns use for an existing template:
  # either an uploaded blob (header_image) or a copy of the example image Meta
  # keeps for the template (from_template: true).
  def header_image
    store = header_image_store
    name = params.require(:name).to_s
    language = params.require(:language).to_s
    entry = if ActiveModel::Type::Boolean.new.cast(params[:from_template])
              store.import_from_meta(name: name, language: language)
            else
              store.save_signed_blob(name: name, language: language, signed_blob_id: params[:header_image])
            end

    render json: { key: Whatsapp::TemplateHeaderImageStore.key(name, language), image: entry,
                   template_header_images: @inbox.channel.template_header_images }
  rescue Whatsapp::TemplateHeaderImageStore::Error => e
    render json: { error: e.code }, status: :unprocessable_entity
  rescue ActionController::ParameterMissing
    render json: { error: 'invalid_value' }, status: :unprocessable_entity
  end

  private

  def header_image_store
    Whatsapp::TemplateHeaderImageStore.new(channel: @inbox.channel, host: ENV.fetch('FRONTEND_URL', request.base_url))
  end

  # The image was already validated and sent to Meta; keeping a public copy is
  # best effort and never fails the template creation.
  def store_created_header_image
    return unless template_params[:header_format].to_s == 'IMAGE'

    header_image_store.save_signed_blob(
      name: template_params[:name].to_s,
      language: template_params[:language].presence || Whatsapp::TemplateCreationService::DEFAULT_LANGUAGE,
      signed_blob_id: template_params[:header_image]
    )
  rescue StandardError => e
    Rails.logger.warn "[WHATSAPP TEMPLATE] Could not keep the header image: #{e.class.name}"
  end

  def fetch_inbox
    @inbox = Current.account.inboxes.find(params[:inbox_id])
    authorize @inbox, :show?
  end

  def validate_whatsapp_cloud_channel
    return if @inbox.channel.is_a?(Channel::Whatsapp) && @inbox.channel.provider == 'whatsapp_cloud'

    render json: { error: 'Message templates can only be created for WhatsApp Cloud API channels' }, status: :bad_request
  end

  def template_params
    template = params.require(:template)
    raise ActionController::ParameterMissing, :template unless template.is_a?(ActionController::Parameters)

    template.permit(
      :name, :category, :language, :body, :header_format, :header_text, :header_example, :header_image, :footer,
      body_examples: [], buttons: [:type, :text, :url, :example]
    )
  end
end
