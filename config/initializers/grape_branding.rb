# Grape Ai Branding Initializer
# Applies Grape Ai branding after Rails boots, ensuring it persists across restarts.
# Runs on every boot in production to override any Chatwoot defaults set by ConfigLoader.

Rails.application.config.after_initialize do
  next unless Rails.env.production?
  next unless ActiveRecord::Base.connection.table_exists?('installation_configs')

  branding = {
    'INSTALLATION_NAME' => 'Grape Ai',
    'BRAND_NAME' => 'Grape Ai',
    'LOGO' => 'https://i.ibb.co/hFLSfwg6/Group-1.png',
    'LOGO_DARK' => 'https://i.ibb.co/Nn3Z5mMw/Group-3.png',
    'LOGO_THUMBNAIL' => 'https://i.ibb.co/tMLg0FFJ/Group-2.png',
    'BRAND_URL' => 'https://www.reengenhariadigital.com.br',
    'WIDGET_BRAND_URL' => 'https://www.reengenhariadigital.com.br'
  }

  branding.each do |name, value|
    config = InstallationConfig.find_by(name: name)
    config&.update!(serialized_value: { 'value' => value }.with_indifferent_access)
  end

  GlobalConfig.clear_cache
  Rails.logger.info '[GrapeAi] Branding applied successfully.'
rescue StandardError => e
  Rails.logger.warn "[GrapeAi] Could not apply branding: #{e.message}"
end
