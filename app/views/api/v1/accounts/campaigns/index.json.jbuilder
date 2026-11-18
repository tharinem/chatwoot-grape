json.array! @campaigns do |campaign|
  json.partial! 'api/v1/models/campaign', formats: [:json], resource: campaign, delivery_stats: @delivery_stats
end
