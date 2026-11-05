# Adds a label to the contacts listed in a customer spreadsheet (e.g. the weekly
# ERP export). Each row is matched by the customer code stored in the contact
# custom attribute CODE_ATTRIBUTE_KEY and, when the code does not match, by phone
# (last 8 digits, so it tolerates a missing country code and the Brazilian extra 9).
#
# Only codes and phones reach the server: names/documents stay in the browser.
# Existing labels are kept (Contacts::BulkAssignLabelsService -> Labelable#add_labels).
class Contacts::BulkLabelByCodesService
  CODE_ATTRIBUTE_KEY = ENV.fetch('CONTACT_CUSTOMER_CODE_ATTRIBUTE', 'codigo_cliente')
  PHONE_MATCH_DIGITS = 8
  ASYNC_THRESHOLD = 500
  MAX_ROWS = 20_000

  attr_reader :label

  def initialize(account:, user:, label:, rows: [])
    @account = account
    @user = user
    @label = label.to_s.parameterize
    @rows = normalize_rows(rows).first(MAX_ROWS)
  end

  def perform
    ensure_label!
    matched_ids, not_found_rows = match_rows
    contact_ids = matched_ids.uniq
    already_labeled_ids = already_labeled(contact_ids)
    to_label_ids = contact_ids - already_labeled_ids
    queued = apply_label(to_label_ids)

    {
      label: @label,
      received: @rows.size,
      matched: @rows.size - not_found_rows.size,
      contacts: contact_ids.size,
      labeled: queued ? 0 : to_label_ids.size,
      already_labeled: already_labeled_ids.size,
      queued: queued ? to_label_ids.size : 0,
      not_found: not_found_rows.size,
      not_found_codes: not_found_rows.map { |row| row[:code].presence || row[:phones].first }
    }
  end

  def self.normalize_code(value)
    code = value.to_s.strip.sub(/\.0+\z/, '')
    code.match?(/\A\d+\z/) ? code.sub(/\A0+(?=\d)/, '') : code
  end

  def self.phone_key(value)
    digits = value.to_s.gsub(/\D/, '')
    digits.length >= PHONE_MATCH_DIGITS ? digits.last(PHONE_MATCH_DIGITS) : nil
  end

  private

  def ensure_label!
    raise ArgumentError, 'label is blank' if @label.blank?

    @account.labels.find_or_create_by!(title: @label)
  end

  def normalize_rows(rows)
    Array(rows).filter_map do |row|
      row = row.to_h.with_indifferent_access
      code = self.class.normalize_code(row[:code])
      phones = Array(row[:phones]).map { |phone| phone.to_s.gsub(/\D/, '') }.select { |phone| self.class.phone_key(phone) }.uniq
      { code: code, phones: phones } if code.present? || phones.any?
    end
  end

  def match_rows
    ids_by_code = contacts_by_code
    ids_by_phone = contacts_by_phone
    matched = []
    not_found = []

    @rows.each do |row|
      ids = ids_by_code[row[:code]].presence || phone_candidates(row[:phones], ids_by_phone)
      ids.present? ? matched.concat(ids) : not_found << row
    end
    [matched, not_found]
  end

  def contacts_by_code
    codes = @rows.pluck(:code).compact_blank.uniq
    return {} if codes.empty?

    normalized_sql = "REGEXP_REPLACE(REGEXP_REPLACE(BTRIM(contacts.custom_attributes->>:key), '\\.0+$', ''), '^0+(?=[0-9])', '')"
    @account.contacts
            .where("#{normalized_sql} IN (:codes)", key: CODE_ATTRIBUTE_KEY, codes: codes)
            .pluck(:id, Arel.sql(ActiveRecord::Base.sanitize_sql([normalized_sql, { key: CODE_ATTRIBUTE_KEY }])))
            .each_with_object(Hash.new { |h, k| h[k] = [] }) { |(id, code), memo| memo[code] << id }
  end

  def contacts_by_phone
    keys = @rows.flat_map { |row| row[:phones] }.map { |phone| self.class.phone_key(phone) }.uniq
    return {} if keys.empty?

    @account.contacts
            .where("RIGHT(REGEXP_REPLACE(contacts.phone_number, '[^0-9]', '', 'g'), #{PHONE_MATCH_DIGITS}) IN (?)", keys)
            .pluck(:id, :phone_number)
            .group_by { |(_id, phone)| self.class.phone_key(phone) }
  end

  # When several contacts share the last 8 digits, keep the ones whose area code
  # (DDD) matches the spreadsheet phone, so a homonym number in another city is not labeled.
  def phone_candidates(phones, ids_by_phone)
    phones.each do |phone|
      candidates = ids_by_phone[self.class.phone_key(phone)]
      next if candidates.blank?

      candidates = filter_by_area_code(phone, candidates) if candidates.size > 1
      return candidates.map(&:first) if candidates.any?
    end
    []
  end

  def filter_by_area_code(phone, candidates)
    area = area_code(phone)
    return candidates if area.nil?

    candidates.select { |(_id, contact_phone)| [nil, area].include?(area_code(contact_phone)) }
  end

  def area_code(phone)
    digits = phone.to_s.gsub(/\D/, '')
    digits = digits.delete_prefix('55') if digits.length >= 12
    digits.length.between?(10, 11) ? digits.first(2) : nil
  end

  def already_labeled(contact_ids)
    return [] if contact_ids.empty?

    @account.contacts.where(id: contact_ids).tagged_with(@label).pluck(:id)
  end

  def apply_label(contact_ids)
    return false if contact_ids.empty?

    if contact_ids.size > ASYNC_THRESHOLD
      Contacts::BulkActionJob.perform_later(@account.id, @user.id, { ids: contact_ids, labels: { add: [@label] } })
      return true
    end

    Contacts::BulkAssignLabelsService.new(account: @account, contact_ids: contact_ids, labels: [@label]).perform
    false
  end
end
