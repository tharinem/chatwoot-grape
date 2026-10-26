import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import IdleLogoutWarning from '../IdleLogoutWarning.vue';
import Auth from 'dashboard/api/auth';
import { clearCookiesOnLogout } from 'dashboard/store/utils/api';

vi.mock('dashboard/api/auth', () => ({
  default: { logout: vi.fn(), hasAuthCookie: vi.fn() },
}));
vi.mock('dashboard/store/utils/api', () => ({
  clearCookiesOnLogout: vi.fn(),
}));

const MINUTE = 60 * 1000;

const mountWarning = (timeoutMinutes = 2) =>
  mount(IdleLogoutWarning, {
    props: { timeoutMinutes },
    global: {
      mocks: { $t: (key, params) => `${key}:${params?.seconds ?? ''}` },
      stubs: {
        Button: {
          props: ['label'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')">{{ label }}</button>',
        },
      },
    },
  });

describe('IdleLogoutWarning', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    Auth.logout.mockReset().mockResolvedValue({});
    Auth.hasAuthCookie.mockReset().mockReturnValue(true);
    clearCookiesOnLogout.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the warning 1 minute before and logs out with the existing flow', async () => {
    const wrapper = mountWarning();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);

    vi.advanceTimersByTime(MINUTE);
    await nextTick();
    expect(wrapper.find('[role="alert"]').text()).toContain(
      'IDLE_LOGOUT.WARNING:60'
    );

    vi.advanceTimersByTime(MINUTE);
    await nextTick();
    expect(Auth.logout).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('"stay signed in" hides the warning and restarts the countdown', async () => {
    const wrapper = mountWarning();
    vi.advanceTimersByTime(MINUTE + 5000);
    await nextTick();
    await wrapper.find('button').trigger('click');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);

    vi.advanceTimersByTime(MINUTE + 30 * 1000);
    expect(Auth.logout).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('only clears and redirects when another tab already logged out', () => {
    Auth.hasAuthCookie.mockReturnValue(false);
    const wrapper = mountWarning();
    vi.advanceTimersByTime(2 * MINUTE);
    expect(Auth.logout).not.toHaveBeenCalled();
    expect(clearCookiesOnLogout).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('does not start a timer nor show a warning when minutes is 0', async () => {
    const wrapper = mountWarning(0);
    vi.advanceTimersByTime(120 * MINUTE);
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(Auth.logout).not.toHaveBeenCalled();
    expect(clearCookiesOnLogout).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('restarts with the new value when the account (minutes) changes', async () => {
    const wrapper = mountWarning(2);
    vi.advanceTimersByTime(MINUTE + 5000);
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);

    // Troca para uma conta com 10 min: aviso some e o relogio recomeca.
    await wrapper.setProps({ timeoutMinutes: 10 });
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    vi.advanceTimersByTime(8 * MINUTE);
    await nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    vi.advanceTimersByTime(2 * MINUTE);
    expect(Auth.logout).toHaveBeenCalledTimes(1);

    // Troca para uma conta sem logout: nada mais dispara.
    Auth.logout.mockClear();
    await wrapper.setProps({ timeoutMinutes: 0 });
    vi.advanceTimersByTime(60 * MINUTE);
    expect(Auth.logout).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('falls back to clearing the session when the logout request fails', async () => {
    Auth.logout.mockRejectedValue(new Error('401'));
    const wrapper = mountWarning();
    vi.advanceTimersByTime(2 * MINUTE);
    await Promise.resolve();
    await Promise.resolve();
    expect(clearCookiesOnLogout).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
