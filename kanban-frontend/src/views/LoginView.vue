<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const chatwootToken = ref('');
const accountIdInput = ref('');
const errorMessage = ref('');
const isLoading = ref(false);

async function handleLogin() {
  errorMessage.value = '';
  isLoading.value = true;

  try {
    const acctId = Number(accountIdInput.value);
    if (!acctId || acctId <= 0) {
      errorMessage.value = t('login.invalidAccountId');
      return;
    }

    await authStore.login(chatwootToken.value, acctId);
    router.push('/');
  } catch {
    errorMessage.value = t('login.authFailed');
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  const token = route.query.token as string | undefined;
  const accountId = route.query.account_id as string | undefined;

  if (token && accountId) {
    chatwootToken.value = token;
    accountIdInput.value = accountId;
    await handleLogin();
  }
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-n-background">
    <form
      class="w-full max-w-sm rounded-lg border border-n-weak bg-n-slate-2 p-6"
      @submit.prevent="handleLogin"
    >
      <h1 class="mb-6 text-xl font-semibold text-n-slate-12">
        {{ t('login.title') }}
      </h1>

      <div v-if="errorMessage" class="mb-4 rounded bg-n-ruby-3 p-3 text-sm text-n-ruby-11">
        {{ errorMessage }}
      </div>

      <label class="mb-1 block text-sm text-n-slate-11">{{ t('login.chatwootToken') }}</label>
      <input
        v-model="chatwootToken"
        type="text"
        required
        class="mb-4 w-full rounded border border-n-weak bg-n-background px-3 py-2 text-sm text-n-slate-12 outline-none focus:border-n-strong"
      />

      <label class="mb-1 block text-sm text-n-slate-11">{{ t('login.accountId') }}</label>
      <input
        v-model="accountIdInput"
        type="number"
        required
        min="1"
        class="mb-6 w-full rounded border border-n-weak bg-n-background px-3 py-2 text-sm text-n-slate-12 outline-none focus:border-n-strong"
      />

      <button
        type="submit"
        :disabled="isLoading || !chatwootToken || !accountIdInput"
        class="w-full rounded bg-n-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {{ isLoading ? t('login.submitting') : t('login.submit') }}
      </button>
    </form>
  </div>
</template>
