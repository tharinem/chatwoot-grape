import { computed } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';
import { resolveIdleLogoutMinutes } from 'dashboard/helper/IdleLogoutTimer';

/**
 * Grape: minutos de inatividade ate o logout para a conta atual.
 * `account.settings.idle_logout_minutes` vence quando e positivo; senao vale
 * `IDLE_LOGOUT_MINUTES` da instalacao (0 = desligado). Reativo: trocar de
 * conta recalcula o valor.
 * @returns {import('vue').ComputedRef<number>}
 */
export function useIdleLogoutMinutes() {
  const currentAccountId = useMapGetter('getCurrentAccountId');
  const getAccount = useMapGetter('accounts/getAccount');
  const globalConfig = useMapGetter('globalConfig/get');

  return computed(() => {
    const account = getAccount.value?.(currentAccountId.value) || {};
    return resolveIdleLogoutMinutes(
      account.settings,
      globalConfig.value?.idleLogoutMinutes
    );
  });
}
