# Grape Ai Branding Initializer
# Applies Grape Ai branding after Rails boots, ensuring it persists across restarts.
# Runs on every boot in production to override any Chatwoot defaults set by ConfigLoader.

Rails.application.config.after_initialize do
  next unless Rails.env.production?
  next unless ActiveRecord::Base.connection.table_exists?('installation_configs')

  branding = {
    'INSTALLATION_NAME' => 'Grape Ai',
    'BRAND_NAME' => 'Grape Ai',
    'LOGO' => '/brand-assets/grape-logo-light.png',
    'LOGO_DARK' => '/brand-assets/grape-logo-dark.png',
    'LOGO_THUMBNAIL' => '/brand-assets/grape-thumbnail.png',
    'BRAND_URL' => 'https://www.grapeai.com.br/',
    'WIDGET_BRAND_URL' => 'https://www.grapeai.com.br/'
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
