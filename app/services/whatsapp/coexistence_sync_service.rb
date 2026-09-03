# Coexistência (WhatsApp Business App + Cloud API no mesmo número): depois do
# Embedded Signup a Meta manda a AGENDA do app (`smb_app_state_sync`) e, se o
# negócio autorizar no celular, o HISTÓRICO de até 180 dias (`history`).
#
# Este serviço NÃO importa mensagens (etapa 2, se um dia fizer sentido). Ele só
# garante que cada contato que já falava com o negócio ANTES da conexão exista
# no Chatwoot marcado como `cliente_antigo`, pra IA da Grape não atender quem
# já era da atendente humana (decisão do cliente Quintal, 03/09/2026).
#
# Docs: developers.facebook.com/documentation/business-messaging/whatsapp/
#       embedded-signup/onboarding-business-app-users/
class Whatsapp::CoexistenceSyncService
  pattr_initialize [:inbox!, :params!]

  ATTR_CLIENTE_ANTIGO = 'cliente_antigo'.freeze
  ATTR_ORIGEM = 'origem_sync'.freeze

  def perform
    contatos = case field
               when 'smb_app_state_sync' then contatos_da_agenda
               when 'history' then contatos_do_historico
               else []
               end
    marcados = contatos.uniq { |c| c[:phone] }.count { |c| marcar_contato(c) }
    Rails.logger.info("[CoexistenceSync] inbox=#{inbox.id} field=#{field} contatos=#{contatos.size} marcados=#{marcados}")
    marcados
  end

  private

  def field
    params.dig(:entry, 0, :changes, 0, :field).to_s
  end

  def value
    params.dig(:entry, 0, :changes, 0, :value) || {}
  end

  # smb_app_state_sync: [{type: 'contact', contact: {full_name, first_name, phone_number}, action: 'add'|'update'|'remove'}]
  def contatos_da_agenda
    Array(value[:state_sync]).filter_map do |item|
      next unless item[:type].to_s == 'contact'
      next if item[:action].to_s == 'remove'

      contato = item[:contact] || {}
      phone = digits(contato[:phone_number])
      next if phone.blank?

      { phone: phone, name: contato[:full_name].presence || contato[:first_name].presence }
    end
  end

  # history: [{metadata: {phase, chunk_order, progress}, threads: [{id: '<wa_id do contato>', messages: [...]}]}]
  def contatos_do_historico
    Array(value[:history]).flat_map do |chunk|
      Array(chunk[:threads]).filter_map do |thread|
        phone = digits(thread[:id])
        phone.presence && { phone: phone, name: nil }
      end
    end
  end

  def marcar_contato(contato)
    phone = contato[:phone]
    contact_inbox = ::ContactInboxWithContactBuilder.new(
      source_id: phone,
      inbox: inbox,
      contact_attributes: { name: contato[:name].presence || "+#{phone}", phone_number: "+#{phone}" }
    ).perform
    contact = contact_inbox.contact
    attrs = (contact.custom_attributes || {}).dup
    return false if attrs[ATTR_CLIENTE_ANTIGO] == true

    attrs[ATTR_CLIENTE_ANTIGO] = true
    attrs[ATTR_ORIGEM] = field
    contact.update!(custom_attributes: attrs)
    true
  rescue StandardError => e
    Rails.logger.error("[CoexistenceSync] falha ao marcar #{phone}: #{e.class} #{e.message}")
    false
  end

  def digits(valor)
    valor.to_s.gsub(/\D/, '')
  end
end
