# frozen_string_literal: true

FactoryBot.define do
  factory :campaign_delivery do
    campaign
    account { campaign.account }
    sequence(:source_id) { |n| "wamid.campaign_delivery_#{n}" }
    status { :sent }
  end
end
