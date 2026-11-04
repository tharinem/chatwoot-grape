require 'rails_helper'

RSpec.describe Whatsapp::TemplateCreationService do
  let(:account) { create(:account) }
  let(:whatsapp_channel) do
    create(:channel_whatsapp, account: account, provider: 'whatsapp_cloud', sync_templates: false, validate_provider_config: false)
  end
  let(:templates_url) { 'https://graph.facebook.com/v14.0/123456789/message_templates' }
  let(:base_params) do
    {
      name: 'boas_vindas',
      category: 'MARKETING',
      language: 'pt_BR',
      body: 'Oi! Temos novidades para você esta semana.'
    }
  end
  let(:success_body) { { id: '987654321', status: 'PENDING', category: 'MARKETING' }.to_json }

  def perform(params)
    described_class.new(channel: whatsapp_channel, params: params).perform
  end

  def stub_success
    stub_request(:post, templates_url).to_return(status: 200, body: success_body, headers: { 'Content-Type' => 'application/json' })
  end

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('WHATSAPP_CLOUD_BASE_URL', anything).and_return('https://graph.facebook.com')
  end

  describe '#perform' do
    context 'when the template is valid' do
      it 'sends the body-only payload with the bearer token header' do
        stub_success

        result = perform(base_params)

        expect(result).to eq(success: true, id: '987654321', status: 'PENDING', category: 'MARKETING', name: 'boas_vindas', language: 'pt_BR')
        expect(
          a_request(:post, templates_url).with(
            headers: { 'Authorization' => 'Bearer test_key', 'Content-Type' => 'application/json' },
            body: {
              name: 'boas_vindas', language: 'pt_BR', category: 'MARKETING',
              components: [{ type: 'BODY', text: 'Oi! Temos novidades para você esta semana.' }]
            }.to_json
          )
        ).to have_been_made.once
      end

      it 'defaults the language to pt_BR' do
        stub_success

        result = perform(base_params.except(:language))

        expect(result[:language]).to eq('pt_BR')
        expect(a_request(:post, templates_url).with { |req| JSON.parse(req.body)['language'] == 'pt_BR' }).to have_been_made
      end

      it 'sends header, body, footer and quick reply buttons with examples only where variables exist' do
        stub_success
        params = base_params.merge(
          body: 'Oi {{1}}, seu pedido {{2}} saiu para entrega.',
          body_examples: %w[Maria 1234],
          header_text: 'Pedido de {{1}}',
          header_example: 'Maria',
          footer: 'Feito com carinho',
          buttons: [{ type: 'QUICK_REPLY', text: 'Obrigado' }, { type: 'QUICK_REPLY', text: 'Falar com alguém' }]
        )

        perform(params)

        expected_components = [
          { type: 'HEADER', format: 'TEXT', text: 'Pedido de {{1}}', example: { header_text: ['Maria'] } },
          { type: 'BODY', text: 'Oi {{1}}, seu pedido {{2}} saiu para entrega.', example: { body_text: [%w[Maria 1234]] } },
          { type: 'FOOTER', text: 'Feito com carinho' },
          { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Obrigado' }, { type: 'QUICK_REPLY', text: 'Falar com alguém' }] }
        ]
        expect(
          a_request(:post, templates_url).with { |req| JSON.parse(req.body)['components'] == expected_components.as_json }
        ).to have_been_made.once
      end

      it 'sends a header without example when it has no variable' do
        stub_success

        perform(base_params.merge(header_text: 'Novidades'))

        expect(
          a_request(:post, templates_url).with do |req|
            JSON.parse(req.body)['components'].first == { 'type' => 'HEADER', 'format' => 'TEXT', 'text' => 'Novidades' }
          end
        ).to have_been_made.once
      end

      it 'sends a URL button with example when the url ends with a variable' do
        stub_success
        params = base_params.merge(
          buttons: [{ type: 'URL', text: 'Ver pedido', url: 'https://loja.com/pedido/{{1}}', example: 'https://loja.com/pedido/42' }]
        )

        perform(params)

        expected_buttons = {
          'type' => 'BUTTONS',
          'buttons' => [{ 'type' => 'URL', 'text' => 'Ver pedido', 'url' => 'https://loja.com/pedido/{{1}}',
                          'example' => ['https://loja.com/pedido/42'] }]
        }
        expect(a_request(:post, templates_url).with { |req| JSON.parse(req.body)['components'].last == expected_buttons })
          .to have_been_made.once
      end

      it 'sends a static URL button without example' do
        stub_success

        perform(base_params.merge(buttons: [{ type: 'URL', text: 'Site', url: 'https://loja.com' }]))

        expect(
          a_request(:post, templates_url).with do |req|
            JSON.parse(req.body)['components'].last['buttons'] == [{ 'type' => 'URL', 'text' => 'Site', 'url' => 'https://loja.com' }]
          end
        ).to have_been_made.once
      end

      it 'accepts ActionController::Parameters' do
        stub_success
        params = ActionController::Parameters.new(base_params).permit(:name, :category, :language, :body)

        expect(perform(params)[:success]).to be true
      end
    end

    context 'when validation fails' do
      def expect_validation_error(params, field, code)
        result = perform(params)

        expect(result[:success]).to be false
        expect(result[:error_type]).to eq(:validation)
        expect(result[:errors]).to include(field: field, code: code)
        expect(a_request(:post, //)).not_to have_been_made
      end

      it('rejects invalid names') { expect_validation_error(base_params.merge(name: 'Boas Vindas'), 'name', 'invalid_format') }
      it('rejects blank names') { expect_validation_error(base_params.merge(name: ''), 'name', 'invalid_format') }
      it('rejects authentication category') { expect_validation_error(base_params.merge(category: 'AUTHENTICATION'), 'category', 'invalid_value') }
      it('rejects invalid language') { expect_validation_error(base_params.merge(language: 'portuguese'), 'language', 'invalid_format') }
      it('rejects blank body') { expect_validation_error(base_params.merge(body: '   '), 'body', 'required') }
      it('rejects long body') { expect_validation_error(base_params.merge(body: 'a' * 1025), 'body', 'too_long') }

      it 'rejects variables that skip numbers' do
        expect_validation_error(base_params.merge(body: 'Oi {{1}}, pedido {{3}} pronto.', body_examples: %w[a b]), 'body', 'non_sequential_variables')
      end

      it 'rejects variables not starting at 1' do
        expect_validation_error(base_params.merge(body: 'Oi {{2}}, tudo bem?', body_examples: %w[a]), 'body', 'non_sequential_variables')
      end

      it 'rejects body starting with a variable' do
        expect_validation_error(base_params.merge(body: '{{1}}, seu pedido saiu.', body_examples: %w[Maria]), 'body', 'variable_at_edge')
      end

      it 'rejects body ending with a variable' do
        expect_validation_error(base_params.merge(body: 'Seu pedido saiu, {{1}}', body_examples: %w[Maria]), 'body', 'variable_at_edge')
      end

      it 'rejects missing body examples' do
        expect_validation_error(base_params.merge(body: 'Oi {{1}}, tudo bem?'), 'body_examples', 'missing_examples')
      end

      it 'rejects blank body examples' do
        expect_validation_error(base_params.merge(body: 'Oi {{1}}, tudo bem?', body_examples: ['']), 'body_examples', 'missing_examples')
      end

      it('rejects long header') { expect_validation_error(base_params.merge(header_text: 'a' * 61), 'header_text', 'too_long') }

      it 'rejects header with more than one variable' do
        expect_validation_error(base_params.merge(header_text: '{{1}} e {{2}}', header_example: 'x'), 'header_text', 'too_many_variables')
      end

      it 'rejects header variable without example' do
        expect_validation_error(base_params.merge(header_text: 'Pedido de {{1}}'), 'header_example', 'required')
      end

      it('rejects long footer') { expect_validation_error(base_params.merge(footer: 'a' * 61), 'footer', 'too_long') }
      it('rejects footer variables') { expect_validation_error(base_params.merge(footer: 'Até {{1}}'), 'footer', 'variables_not_allowed') }

      it 'rejects more than three quick replies' do
        buttons = Array.new(4) { |i| { type: 'QUICK_REPLY', text: "Opção #{i}" } }
        expect_validation_error(base_params.merge(buttons: buttons), 'buttons', 'too_many')
      end

      it 'rejects more than one URL button' do
        buttons = Array.new(2) { { type: 'URL', text: 'Site', url: 'https://loja.com' } }
        expect_validation_error(base_params.merge(buttons: buttons), 'buttons', 'too_many')
      end

      it 'rejects mixed button types' do
        buttons = [{ type: 'QUICK_REPLY', text: 'Sim' }, { type: 'URL', text: 'Site', url: 'https://loja.com' }]
        expect_validation_error(base_params.merge(buttons: buttons), 'buttons', 'mixed_types')
      end

      it 'rejects unsupported button types' do
        expect_validation_error(base_params.merge(buttons: [{ type: 'PHONE_NUMBER', text: 'Ligar' }]), 'buttons', 'invalid_type')
      end

      it 'rejects long button text' do
        expect_validation_error(base_params.merge(buttons: [{ type: 'QUICK_REPLY', text: 'a' * 26 }]), 'buttons.0.text', 'too_long')
      end

      it 'rejects blank button text' do
        expect_validation_error(base_params.merge(buttons: [{ type: 'QUICK_REPLY', text: '' }]), 'buttons.0.text', 'required')
      end

      it 'rejects non https urls' do
        expect_validation_error(base_params.merge(buttons: [{ type: 'URL', text: 'Site', url: 'http://loja.com' }]), 'buttons.0.url', 'invalid_url')
      end

      it 'rejects url variables outside the end' do
        buttons = [{ type: 'URL', text: 'Site', url: 'https://loja.com/{{1}}/x', example: 'a' }]
        expect_validation_error(base_params.merge(buttons: buttons), 'buttons.0.url', 'invalid_url')
      end

      it 'rejects url variable without example' do
        buttons = [{ type: 'URL', text: 'Site', url: 'https://loja.com/{{1}}' }]
        expect_validation_error(base_params.merge(buttons: buttons), 'buttons.0.example', 'required')
      end
    end

    context 'when Meta rejects the template' do
      it 'returns the Meta user message and details' do
        error_body = {
          error: {
            message: 'Invalid parameter', type: 'OAuthException', code: 100, error_subcode: 2_388_023,
            error_user_title: 'Nome duplicado', error_user_msg: 'Já existe um modelo com esse nome.'
          }
        }.to_json
        stub_request(:post, templates_url).to_return(status: 400, body: error_body, headers: { 'Content-Type' => 'application/json' })

        result = perform(base_params)

        expect(result).to eq(
          success: false, error_type: :meta, message: 'Já existe um modelo com esse nome.',
          details: { code: 100, error_subcode: 2_388_023, type: 'OAuthException', error_user_title: 'Nome duplicado' }
        )
      end

      it 'falls back to the Meta message when there is no user message' do
        stub_request(:post, templates_url).to_return(status: 400, body: { error: { message: 'Invalid parameter', code: 100 } }.to_json)

        expect(perform(base_params)[:message]).to eq('Invalid parameter')
      end
    end

    context 'when the header is an image' do
      let(:upload_session_url) { 'https://graph.facebook.com/v14.0/555000111/uploads' }
      let(:upload_url) { 'https://graph.facebook.com/v14.0/upload:MTphdHRhY2htZW50' }
      let(:image_path) { Rails.root.join('spec/assets/avatar.png') }
      let(:blob) do
        ActiveStorage::Blob.create_and_upload!(io: File.open(image_path), filename: 'promo.png', content_type: 'image/png')
      end
      let(:image_params) { base_params.merge(header_format: 'IMAGE', header_image: blob.signed_id, header_text: 'ignorado') }
      let(:app_id) { '555000111' }

      def stub_upload_session(status: 200, body: { id: 'upload:MTphdHRhY2htZW50?sig=ARZ' }.to_json)
        stub_request(:post, upload_session_url).with(query: hash_including({})).to_return(status: status, body: body)
      end

      def stub_file_upload(status: 200, body: { h: '4::aW1hZ2UtaGFuZGxl' }.to_json)
        stub_request(:post, upload_url).with(query: { sig: 'ARZ' }).to_return(status: status, body: body)
      end

      before do
        allow(GlobalConfigService).to receive(:load).and_call_original
        allow(GlobalConfigService).to receive(:load).with('WHATSAPP_APP_ID', '').and_return(app_id)
      end

      it 'uploads the image with the resumable upload api and sends the handle as the header example' do
        stub_upload_session
        stub_file_upload
        stub_success

        result = perform(image_params)

        expect(result[:success]).to be(true)
        expect(
          a_request(:post, upload_session_url).with(
            query: { file_name: 'promo.png', file_length: File.size(image_path).to_s, file_type: 'image/png' },
            headers: { 'Authorization' => 'Bearer test_key' }
          )
        ).to have_been_made.once
        expect(
          a_request(:post, upload_url).with(
            query: { sig: 'ARZ' }, headers: { 'Authorization' => 'OAuth test_key', 'file_offset' => '0' }, body: File.binread(image_path)
          )
        ).to have_been_made.once
        expect(
          a_request(:post, templates_url).with do |req|
            JSON.parse(req.body)['components'].first ==
              { 'type' => 'HEADER', 'format' => 'IMAGE', 'example' => { 'header_handle' => ['4::aW1hZ2UtaGFuZGxl'] } }
          end
        ).to have_been_made.once
      end

      it 'requires the image' do
        result = perform(image_params.except(:header_image))

        expect(result).to include(success: false, error_type: :validation)
        expect(result[:errors]).to include(field: 'header_image', code: 'required')
        expect(a_request(:post, //)).not_to have_been_made
      end

      it 'rejects an unknown header format' do
        expect(perform(base_params.merge(header_format: 'VIDEO'))[:errors]).to include(field: 'header_format', code: 'invalid_value')
      end

      it 'rejects an image id that does not resolve to a blob' do
        expect(perform(image_params.merge(header_image: 'forged'))[:errors]).to include(field: 'header_image', code: 'invalid_value')
        expect(a_request(:post, //)).not_to have_been_made
      end

      it 'rejects files that are not jpg or png' do
        pdf = ActiveStorage::Blob.create_and_upload!(io: File.open(Rails.root.join('spec/assets/sample.pdf')), filename: 'a.pdf')

        expect(perform(image_params.merge(header_image: pdf.signed_id))[:errors]).to include(field: 'header_image', code: 'invalid_file_type')
      end

      it 'rejects images larger than 5 MB' do
        large = ActiveStorage::Blob.create_and_upload!(
          io: StringIO.new('a' * (5.megabytes + 1)), filename: 'big.png', content_type: 'image/png', identify: false
        )

        expect(perform(image_params.merge(header_image: large.signed_id))[:errors]).to include(field: 'header_image', code: 'file_too_large')
        expect(a_request(:post, //)).not_to have_been_made
      end

      context 'when WHATSAPP_APP_ID is not configured' do
        let(:app_id) { nil }

        it 'returns a validation error without calling Meta' do
          expect(perform(image_params)[:errors]).to include(field: 'header_image', code: 'app_id_missing')
          expect(a_request(:post, //)).not_to have_been_made
        end
      end

      it 'returns the Meta error when the upload session is refused' do
        stub_upload_session(status: 400, body: { error: { message: 'Invalid OAuth access token', code: 190 } }.to_json)

        result = perform(image_params)

        expect(result).to include(success: false, error_type: :meta, message: 'Invalid OAuth access token')
        expect(a_request(:post, templates_url)).not_to have_been_made
      end

      it 'returns request_failed when the upload answers without a handle' do
        stub_upload_session
        stub_file_upload(body: '{}')

        expect(perform(image_params)).to include(success: false, error_type: :request_failed)
        expect(a_request(:post, templates_url)).not_to have_been_made
      end

      it 'returns request_failed when the upload times out' do
        stub_upload_session
        stub_request(:post, upload_url).with(query: { sig: 'ARZ' }).to_timeout

        expect(perform(image_params)).to include(success: false, error_type: :request_failed)
      end
    end

    context 'when the request fails' do
      let(:request_failed) { { success: false, error_type: :request_failed, message: 'request_failed' } }

      it 'returns a readable error on timeout' do
        stub_request(:post, templates_url).to_timeout

        expect(perform(base_params)).to eq(request_failed)
      end

      it 'returns a readable error on invalid json' do
        stub_request(:post, templates_url).to_return(status: 500, body: '<html>oops</html>')

        expect(perform(base_params)).to eq(request_failed)
      end

      [Errno::ECONNREFUSED, Errno::ECONNRESET, Net::WriteTimeout, OpenSSL::SSL::SSLError, EOFError].each do |error_class|
        it "returns a readable error on #{error_class}" do
          stub_request(:post, templates_url).to_raise(error_class)

          expect(perform(base_params)).to eq(request_failed)
        end
      end
    end

    context 'when Meta answers 2xx with an unexpected body' do
      it 'treats a non-json body as success' do
        stub_request(:post, templates_url).to_return(status: 200, body: 'ok')

        result = perform(base_params)

        expect(result[:success]).to be(true)
        expect(result[:name]).to eq('boas_vindas')
      end

      it 'treats a json array body as success' do
        stub_request(:post, templates_url).to_return(status: 200, body: '[]')

        expect(perform(base_params)[:success]).to be(true)
      end
    end

    context 'when buttons come in an unexpected shape' do
      it 'accepts the indexed hash form' do
        stub_success
        buttons = { '0' => { type: 'QUICK_REPLY', text: 'Quero' } }

        expect(perform(base_params.merge(buttons: buttons))[:success]).to be(true)
        expect(
          a_request(:post, templates_url).with do |req|
            JSON.parse(req.body)['components'].last == { 'type' => 'BUTTONS', 'buttons' => [{ 'type' => 'QUICK_REPLY', 'text' => 'Quero' }] }
          end
        ).to have_been_made
      end

      it 'returns a validation error for non-hash entries instead of raising' do
        result = perform(base_params.merge(buttons: ['x']))

        expect(result[:error_type]).to eq(:validation)
        expect(result[:errors]).to include({ field: 'buttons', code: 'invalid_type' })
      end
    end

    context 'when logging' do
      it 'never logs the api key' do
        stub_request(:post, templates_url).to_return(status: 400, body: { error: { message: 'Invalid', code: 100 } }.to_json)
        logged = []
        allow(Rails.logger).to receive(:warn) { |message| logged << message }

        perform(base_params)

        expect(logged).not_to be_empty
        expect(logged.join).not_to include('test_key')
      end

      it 'never logs the api key on timeout' do
        stub_request(:post, templates_url).to_timeout
        logged = []
        allow(Rails.logger).to receive(:warn) { |message| logged << message }

        perform(base_params)

        expect(logged.join).not_to include('test_key')
      end
    end
  end
end
