require 'rails_helper'

# Coexistência: agenda + histórico do WhatsApp Business App viram contatos
# marcados `cliente_antigo` (a IA da Grape não atende quem já era da atendente).
RSpec.describe Whatsapp::CoexistenceSyncService do
  let(:account) { create(:account) }
  let(:channel) { create(:channel_whatsapp, account: account, phone_number: '+5541936185329', sync_templates: false, validate_provider_config: false) }
  let(:inbox) { channel.inbox }

  def payload(field, value)
    { object: 'whatsapp_business_account',
      entry: [{ id: '1', changes: [{ field: field, value: { messaging_product: 'whatsapp',
                                                            metadata: { display_phone_number: '5541936185329', phone_number_id: '1' } }.merge(value) }] }] }
  end

  it 'marca os contatos da agenda como cliente_antigo (e ignora remocoes)' do
    p = payload('smb_app_state_sync', state_sync: [
                  { type: 'contact', action: 'add', contact: { full_name: 'Pablo Morales', first_name: 'Pablo', phone_number: '+55 (41) 99108-7328' } },
                  { type: 'contact', action: 'remove', contact: { full_name: 'X', phone_number: '5541000000000' } }
                ])
    expect(described_class.new(inbox: inbox, params: p).perform).to eq(1)
    c = inbox.contact_inboxes.find_by(source_id: '5541991087328').contact
    expect(c.name).to eq('Pablo Morales')
    expect(c.phone_number).to eq('+5541991087328')
    expect(c.custom_attributes['cliente_antigo']).to be(true)
    expect(c.custom_attributes['origem_sync']).to eq('smb_app_state_sync')
    expect(inbox.contact_inboxes.find_by(source_id: '5541000000000')).to be_nil
  end

  it 'marca os contatos das threads do historico e nao duplica quem ja esta marcado' do
    p = payload('history', history: [{ metadata: { phase: 0, chunk_order: 1, progress: 55 },
                                       threads: [{ id: '5541988887777', messages: [] }, { id: '5541988887777', messages: [] }] }])
    expect(described_class.new(inbox: inbox, params: p).perform).to eq(1)
    expect(described_class.new(inbox: inbox, params: p).perform).to eq(0)
    expect(inbox.contact_inboxes.find_by(source_id: '5541988887777').contact.custom_attributes['cliente_antigo']).to be(true)
  end

  it 'campo desconhecido nao faz nada' do
    expect(described_class.new(inbox: inbox, params: payload('messages', messages: [])).perform).to eq(0)
  end
end
