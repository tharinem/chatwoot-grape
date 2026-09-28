namespace :grape do
  desc 'Apply Grape Ai branding to InstallationConfig'
  task branding: :environment do
    return unless ActiveRecord::Base.connection.table_exists?('installation_configs')

    puts 'Applying Grape Ai branding...'

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
      next unless config

      config.update!(serialized_value: { 'value' => value }.with_indifferent_access)
    end

    GlobalConfig.clear_cache
    puts 'Grape Ai branding applied successfully.'
  end
end
