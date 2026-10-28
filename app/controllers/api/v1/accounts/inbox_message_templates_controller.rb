class Api::V1::Accounts::InboxMessageTemplatesController < Api::V1::Accounts::BaseController
  before_action :fetch_inbox
  before_action :check_admin_authorization?
  before_action :validate_whatsapp_cloud_channel

  def create
    result = Whatsapp::TemplateCreationService.new(channel: @inbox.channel, params: template_params).perform

    if result[:success]
      Channels::Whatsapp::TemplatesSyncJob.perform_later(@inbox.channel)
      render json: { template: result.except(:success) }, status: :created
    elsif result[:error_type] == :validation
      render json: { errors: result[:errors] }, status: :unprocessable_entity
    else
      render json: { error: result[:message], details: result[:details] || {} }, status: :unprocessable_entity
    end
  rescue ActionController::ParameterMissing
    render json: { error: 'Template parameters are required' }, status: :unprocessable_entity
  end

  private

  def fetch_inbox
    @inbox = Current.account.inboxes.find(params[:inbox_id])
    authorize @inbox, :show?
  end

  def validate_whatsapp_cloud_channel
    return if @inbox.channel.is_a?(Channel::Whatsapp) && @inbox.channel.provider == 'whatsapp_cloud'

    render json: { error: 'Message templates can only be created for WhatsApp Cloud API channels' }, status: :bad_request
  end

  def template_params
    params.require(:template).permit(
      :name, :category, :language, :body, :header_text, :header_example, :footer,
      body_examples: [], buttons: [:type, :text, :url, :example]
    )
  end
end
