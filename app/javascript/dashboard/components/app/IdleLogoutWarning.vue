<script setup>
// Grape: logout automatico por inatividade (IDLE_LOGOUT_MINUTES no Super Admin).
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Auth from 'dashboard/api/auth';
import { clearCookiesOnLogout } from 'dashboard/store/utils/api';
import IdleLogoutTimer from 'dashboard/helper/IdleLogoutTimer';
import Button from 'dashboard/components-next/button/Button.vue';

const props = defineProps({
  timeoutMinutes: { type: Number, required: true },
});

const showWarning = ref(false);
const secondsLeft = ref(0);
let timer = null;

// Usa o fluxo de logout existente (DELETE na sessao + limpeza + redirect).
// Se outra aba ja deslogou, o cookie sumiu: so limpa e redireciona.
const logout = () => {
  if (!Auth.hasAuthCookie()) {
    clearCookiesOnLogout();
    return;
  }
  Auth.logout().catch(() => clearCookiesOnLogout());
};

const stayConnected = () => timer?.markActivity({ force: true });

onMounted(() => {
  timer = new IdleLogoutTimer({
    timeoutMs: props.timeoutMinutes * 60 * 1000,
    onWarn: remainingMs => {
      secondsLeft.value = Math.max(1, Math.ceil(remainingMs / 1000));
      showWarning.value = true;
    },
    onActive: () => {
      showWarning.value = false;
    },
    onTimeout: () => {
      showWarning.value = false;
      logout();
    },
  });
  timer.start();
});

onBeforeUnmount(() => {
  timer?.stop();
  timer = null;
});
</script>

<template>
  <div>
    <div
      v-if="showWarning"
      role="alert"
      aria-live="assertive"
      class="fixed z-50 top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3 py-2 bg-n-amber-4 dark:bg-n-amber-8 rounded-lg shadow-lg"
    >
      <span class="text-sm font-medium text-n-amber-12">
        {{ $t('IDLE_LOGOUT.WARNING', { seconds: secondsLeft }) }}
      </span>
      <Button
        sm
        amber
        :label="$t('IDLE_LOGOUT.STAY_SIGNED_IN')"
        @click="stayConnected"
      />
    </div>
  </div>
</template>
