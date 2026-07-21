<!--
  NOTE: Ported (Phase 19, recorte) from fazer-ai/chatwoot@main
  (app/javascript/dashboard/routes/dashboard/settings/inbox/channels/BaileysWhatsapp.vue).

  Cut vs. upstream: convert-mode (`mode="convert"` / inbox-conversion flow) removed —
  this fork has no InboxConvert.vue / `inboxes/convertProvider` action, so the branch
  was unreachable dead code here. Everything else (create form + advanced options) is
  ported close to verbatim.

  Added vs. upstream: the QR/connection-status step is inlined here (fazer-ai's 4.15
  ships it as a separate FinishSetup.vue + WhatsappLinkDeviceModal.vue pairing flow,
  which this recorte does not port — out of scope). After a successful create, this
  component switches to a "linking" step that calls setup_channel_provider and reads
  the inbox's `provider_connection` (kept live by the INBOX_PROVIDER_CONNECTION_UPDATED
  websocket listener grafted into helper/actionCable.js) to render the QR/connection
  state, matching this plan's "tela de config do canal: exibe QR" artifact.
-->
<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { useVuelidate } from '@vuelidate/core';
import { useAlert } from 'dashboard/composables';
import { required, requiredIf } from '@vuelidate/validators';
import { isPhoneE164OrEmpty } from 'shared/helpers/Validators';
import { isValidURL } from 'dashboard/helper/URLHelper';

import NextButton from 'dashboard/components-next/button/Button.vue';
import Switch from 'dashboard/components-next/switch/Switch.vue';
import Spinner from 'shared/components/Spinner.vue';

const router = useRouter();
const store = useStore();
const { t } = useI18n();

// 'form' -> collect inbox name/phone/credentials. 'linking' -> QR pairing screen
// for the just-created inbox.
const step = ref('form');
const createdInboxId = ref(null);

const inboxName = ref('');
const phoneNumber = ref('');
const apiKey = ref('');
const providerUrl = ref('');
const showAdvancedOptions = ref(false);
const markAsRead = ref(true);
const presenceSubscribe = ref(false);

const uiFlags = computed(() => store.getters['inboxes/getUIFlags']);

const rules = computed(() => ({
  inboxName: { required },
  phoneNumber: { required, isPhoneE164OrEmpty },
  providerUrl: {
    isValidURL: value => !value || isValidURL(value),
    requiredIf: requiredIf(apiKey),
  },
  apiKey: { requiredIf: requiredIf(providerUrl) },
}));

const v$ = useVuelidate(rules, {
  inboxName,
  phoneNumber,
  providerUrl,
  apiKey,
});

const buildProviderConfig = () => {
  const providerConfig = {
    mark_as_read: markAsRead.value,
    presence_subscribe: presenceSubscribe.value,
  };

  if (apiKey.value || providerUrl.value) {
    providerConfig.api_key = apiKey.value;
    providerConfig.provider_url = providerUrl.value;
  }

  return providerConfig;
};

const createChannel = async () => {
  v$.value.$touch();
  if (v$.value.$invalid) {
    return;
  }

  try {
    const whatsappChannel = await store.dispatch('inboxes/createChannel', {
      name: inboxName.value,
      channel: {
        type: 'whatsapp',
        phone_number: phoneNumber.value,
        provider: 'baileys',
        provider_config: buildProviderConfig(),
      },
    });

    createdInboxId.value = whatsappChannel.id;
    step.value = 'linking';
  } catch (error) {
    useAlert(error.message || t('INBOX_MGMT.ADD.WHATSAPP.API.ERROR_MESSAGE'));
  }
};

const setShowAdvancedOptions = () => {
  showAdvancedOptions.value = true;
};

// --- Linking step (QR pairing) ---

const createdInbox = computed(() =>
  createdInboxId.value
    ? store.getters['inboxes/getInbox'](createdInboxId.value)
    : null
);
const providerConnection = computed(
  () => createdInbox.value?.provider_connection
);
const connection = computed(() => providerConnection.value?.connection);
const qrDataUrl = computed(() => providerConnection.value?.qr_data_url);
const connectionError = computed(() => providerConnection.value?.error);

const linkingLoading = ref(false);

const handleLinkingError = error => {
  useAlert(error.message);
  linkingLoading.value = false;
};

const setupProvider = () => {
  linkingLoading.value = true;
  store
    .dispatch('inboxes/setupChannelProvider', createdInboxId.value)
    .catch(handleLinkingError);
};

const goToAddAgents = () => {
  router.replace({
    name: 'settings_inboxes_add_agents',
    params: { page: 'new', inbox_id: createdInboxId.value },
  });
};
</script>

<template>
  <form
    v-if="step === 'form'"
    class="flex flex-wrap mx-0"
    @submit.prevent="createChannel()"
  >
    <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
      <label :class="{ error: v$.inboxName.$error }">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.LABEL') }}
        <input
          v-model="inboxName"
          type="text"
          :placeholder="$t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.PLACEHOLDER')"
          @blur="v$.inboxName.$touch"
        />
        <span v-if="v$.inboxName.$error" class="message">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.INBOX_NAME.ERROR') }}
        </span>
      </label>
    </div>

    <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
      <label :class="{ error: v$.phoneNumber.$error }">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.LABEL') }}
        <input
          v-model="phoneNumber"
          type="text"
          :placeholder="$t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.PLACEHOLDER')"
          @blur="v$.phoneNumber.$touch"
        />
        <span v-if="v$.phoneNumber.$error" class="message">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.PHONE_NUMBER.ERROR') }}
        </span>
      </label>
    </div>

    <div
      v-if="!showAdvancedOptions"
      class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%] mb-4"
    >
      <NextButton icon="i-lucide-plus" sm link @click="setShowAdvancedOptions">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.ADVANCED_OPTIONS') }}
      </NextButton>
    </div>
    <template v-else>
      <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
        <span class="text-sm text-gray-600">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.ADVANCED_OPTIONS') }}
        </span>
        <label :class="{ error: v$.providerUrl.$error }">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.PROVIDER_URL.LABEL') }}
          <input
            v-model="providerUrl"
            type="text"
            :placeholder="
              $t('INBOX_MGMT.ADD.WHATSAPP.PROVIDER_URL.PLACEHOLDER')
            "
          />
          <span v-if="v$.providerUrl.$error" class="message">
            {{ $t('INBOX_MGMT.ADD.WHATSAPP.PROVIDER_URL.ERROR') }}
          </span>
        </label>
      </div>

      <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
        <label :class="{ error: v$.apiKey.$error }">
          {{ $t('INBOX_MGMT.ADD.WHATSAPP.API_KEY.LABEL') }}
          <input
            v-model="apiKey"
            type="text"
            :placeholder="$t('INBOX_MGMT.ADD.WHATSAPP.API_KEY.PLACEHOLDER')"
          />
          <span v-if="v$.apiKey.$error" class="message">
            {{ $t('INBOX_MGMT.ADD.WHATSAPP.API_KEY.ERROR') }}
          </span>
        </label>
      </div>

      <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
        <label>
          <div class="flex mb-2 items-center">
            <span class="mr-2 text-sm">
              {{ $t('INBOX_MGMT.ADD.WHATSAPP.MARK_AS_READ.LABEL') }}
            </span>
            <Switch id="markAsRead" v-model="markAsRead" />
          </div>
        </label>
      </div>

      <div class="w-[65%] flex-shrink-0 flex-grow-0 max-w-[65%]">
        <label>
          <div class="flex mb-2 items-center">
            <span class="mr-2 text-sm">
              {{ $t('INBOX_MGMT.ADD.WHATSAPP.PRESENCE_SUBSCRIBE.LABEL') }}
            </span>
            <Switch id="presenceSubscribe" v-model="presenceSubscribe" />
          </div>
        </label>
      </div>
    </template>

    <div class="w-full">
      <NextButton
        :is-loading="uiFlags.isCreating"
        type="submit"
        solid
        blue
        :label="$t('INBOX_MGMT.ADD.WHATSAPP.SUBMIT_BUTTON')"
      />
    </div>
  </form>

  <div v-else class="flex flex-col gap-4 items-center w-[65%] py-4">
    <template v-if="!connection || connection === 'close' || connectionError">
      <p v-if="connectionError" class="text-red-500 text-center">
        {{ connectionError }}
      </p>
      <NextButton :is-loading="linkingLoading" @click="setupProvider">
        {{ $t('INBOX_MGMT.ADD.WHATSAPP.SUBMIT_BUTTON') }}
      </NextButton>
    </template>

    <template v-else-if="connection === 'connecting'">
      <div v-if="!qrDataUrl" class="flex flex-col gap-4 items-center">
        <Spinner />
      </div>
      <img
        v-else
        :src="qrDataUrl"
        alt="QR Code"
        class="w-[276px] h-[276px]"
      />
    </template>

    <template v-else-if="connection === 'open'">
      <p class="text-center">
        {{ $t('INBOX_MGMT.FINISH.BUTTON_TEXT') }}
      </p>
      <NextButton solid blue @click="goToAddAgents">
        {{ $t('INBOX_MGMT.FINISH.BUTTON_TEXT') }}
      </NextButton>
    </template>
  </div>
</template>
