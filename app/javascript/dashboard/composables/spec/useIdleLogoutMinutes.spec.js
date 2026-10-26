import { defineComponent, h, nextTick } from 'vue';
import { createStore } from 'vuex';
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { useIdleLogoutMinutes } from '../useIdleLogoutMinutes';

const buildStore = ({ accounts, currentAccountId, installationMinutes }) =>
  createStore({
    state: () => ({
      accounts,
      currentAccountId,
      installationMinutes,
    }),
    mutations: {
      switchAccount(state, id) {
        state.currentAccountId = id;
      },
    },
    getters: {
      getCurrentAccountId: state => state.currentAccountId,
      'accounts/getAccount': state => id =>
        state.accounts.find(account => account.id === id),
      'globalConfig/get': state => ({
        idleLogoutMinutes: state.installationMinutes,
      }),
    },
  });

const mountWith = storeOptions => {
  const store = buildStore(storeOptions);
  let minutes;
  const Component = defineComponent({
    setup() {
      minutes = useIdleLogoutMinutes();
      return () => h('div');
    },
  });
  mount(Component, { global: { plugins: [store] } });
  return { store, minutes: () => minutes.value };
};

describe('useIdleLogoutMinutes', () => {
  it('uses the account setting over the installation value', () => {
    const { minutes } = mountWith({
      accounts: [{ id: 4, settings: { idle_logout_minutes: 30 } }],
      currentAccountId: 4,
      installationMinutes: 10,
    });
    expect(minutes()).toBe(30);
  });

  it('accepts the account setting as a string', () => {
    const { minutes } = mountWith({
      accounts: [{ id: 4, settings: { idle_logout_minutes: '30' } }],
      currentAccountId: 4,
      installationMinutes: 0,
    });
    expect(minutes()).toBe(30);
  });

  it('falls back to the installation value when the account value is 0 or absent', () => {
    expect(
      mountWith({
        accounts: [{ id: 1, settings: { idle_logout_minutes: 0 } }],
        currentAccountId: 1,
        installationMinutes: 15,
      }).minutes()
    ).toBe(15);
    expect(
      mountWith({
        accounts: [{ id: 1, settings: {} }],
        currentAccountId: 1,
        installationMinutes: 15,
      }).minutes()
    ).toBe(15);
  });

  it('is 0 (off) when neither the account nor the installation set it', () => {
    const { minutes } = mountWith({
      accounts: [{ id: 1 }],
      currentAccountId: 1,
      installationMinutes: 0,
    });
    expect(minutes()).toBe(0);
  });

  it('follows the current account when the user switches accounts', async () => {
    const { store, minutes } = mountWith({
      accounts: [
        { id: 1, settings: {} },
        { id: 4, settings: { idle_logout_minutes: 30 } },
      ],
      currentAccountId: 1,
      installationMinutes: 0,
    });
    expect(minutes()).toBe(0);

    store.commit('switchAccount', 4);
    await nextTick();
    expect(minutes()).toBe(30);

    store.commit('switchAccount', 1);
    await nextTick();
    expect(minutes()).toBe(0);
  });
});
