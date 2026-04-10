<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

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
      errorMessage.value = 'Account ID deve ser um numero positivo';
      return;
    }

    await authStore.login(chatwootToken.value, acctId);
    router.push('/');
  } catch {
    errorMessage.value = 'Falha na autenticacao. Verifique suas credenciais.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-n-background">
    <form
      class="w-full max-w-sm rounded-lg border border-n-weak bg-n-slate-2 p-6"
      @submit.prevent="handleLogin"
    >
      <h1 class="mb-6 text-xl font-semibold text-n-slate-12">
        Login
      </h1>

      <div v-if="errorMessage" class="mb-4 rounded bg-n-ruby-3 p-3 text-sm text-n-ruby-11">
        {{ errorMessage }}
      </div>

      <label class="mb-1 block text-sm text-n-slate-11">Chatwoot Token</label>
      <input
        v-model="chatwootToken"
        type="text"
        required
        class="mb-4 w-full rounded border border-n-weak bg-n-background px-3 py-2 text-sm text-n-slate-12 outline-none focus:border-n-strong"
      />

      <label class="mb-1 block text-sm text-n-slate-11">Account ID</label>
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
        {{ isLoading ? 'Autenticando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
