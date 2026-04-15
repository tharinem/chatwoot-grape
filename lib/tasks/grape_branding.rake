namespace :grape do
  desc 'Apply Grape Ai branding to InstallationConfig'
  task branding: :environment do
    return unless ActiveRecord::Base.connection.table_exists?('installation_configs')

    puts 'Applying Grape Ai branding...'

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
      next unless config

      config.update!(serialized_value: { 'value' => value }.with_indifferent_access)
    end

    GlobalConfig.clear_cache
    puts 'Grape Ai branding applied successfully.'
  end
end
