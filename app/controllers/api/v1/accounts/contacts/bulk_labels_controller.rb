# POST /api/v1/accounts/:account_id/contacts/bulk_label_by_codes
# Body: { label: 'lista-da-semana', rows: [{ code: '1234', phones: ['5511999990000'] }] }
# (or plain `codes: []` / `phones: []`, each entry treated as one row)
class Api::V1::Accounts::Contacts::BulkLabelsController < Api::V1::Accounts::BaseController
  before_action -> { authorize(Contact, :bulk_label_by_codes?) }

  def create
    return render_could_not_create_error(I18n.t('errors.contacts.bulk_label.blank_label')) if params[:label].to_s.parameterize.blank?

    result = Contacts::BulkLabelByCodesService.new(
      account: Current.account,
      user: Current.user,
      label: params[:label],
      rows: rows_param
    ).perform
    render json: result
  end

  private

  def rows_param
    rows = params.permit(rows: [:code, { phones: [] }])[:rows].to_a.map(&:to_h)
    rows += Array(params[:codes]).map { |code| { code: code } }
    rows + Array(params[:phones]).map { |phone| { phones: [phone] } }
  end
end
