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

const mountWarning = () =>
  mount(IdleLogoutWarning, {
    props: { timeoutMinutes: 2 },
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
