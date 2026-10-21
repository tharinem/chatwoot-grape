// Logout automatico por inatividade (Grape).
//
// A ultima atividade do usuario fica salva no localStorage, entao todas as
// abas abertas do painel compartilham o mesmo relogio: mexer em qualquer aba
// mantem todas conectadas. A checagem roda num intervalo curto comparando
// timestamps (em vez de um unico setTimeout longo), o que continua correto
// mesmo quando o navegador congela abas em segundo plano ou o computador
// entra em suspensao.

export const IDLE_LAST_ACTIVITY_KEY = 'cw_idle_last_activity';
export const DEFAULT_WARNING_MS = 60 * 1000;
export const DEFAULT_TICK_MS = 1000;
// Evita gravar no localStorage a cada pixel de mousemove.
export const DEFAULT_WRITE_THROTTLE_MS = 5 * 1000;

export const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'scroll',
  'focus',
  'visibilitychange',
];

export const parseIdleMinutes = value => {
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
};

const safeStorage = storage => ({
  read(key) {
    try {
      const raw = storage?.getItem(key);
      const value = Number(raw);
      return raw && Number.isFinite(value) ? value : 0;
    } catch (error) {
      return 0;
    }
  },
  write(key, value) {
    try {
      storage?.setItem(key, String(value));
    } catch (error) {
      // Modo privado / storage bloqueado: segue so com o relogio local.
    }
  },
});

export default class IdleLogoutTimer {
  constructor({
    timeoutMs,
    warningMs = DEFAULT_WARNING_MS,
    tickMs = DEFAULT_TICK_MS,
    writeThrottleMs = DEFAULT_WRITE_THROTTLE_MS,
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    target = typeof window !== 'undefined' ? window : null,
    now = () => Date.now(),
    onWarn = () => {},
    onActive = () => {},
    onTimeout = () => {},
  }) {
    this.timeoutMs = timeoutMs;
    // Aviso nunca maior que o proprio tempo limite.
    this.warningMs = Math.min(warningMs, timeoutMs);
    this.tickMs = tickMs;
    this.writeThrottleMs = writeThrottleMs;
    this.storage = safeStorage(storage);
    this.target = target;
    this.now = now;
    this.onWarn = onWarn;
    this.onActive = onActive;
    this.onTimeout = onTimeout;

    this.localLastActivity = 0;
    this.lastWrite = 0;
    this.intervalId = null;
    this.isWarning = false;
    this.hasTimedOut = false;
    this.handleActivity = this.handleActivity.bind(this);
    this.tick = this.tick.bind(this);
  }

  get isRunning() {
    return this.intervalId !== null;
  }

  start() {
    if (this.isRunning || !(this.timeoutMs > 0)) return;
    this.hasTimedOut = false;
    this.isWarning = false;
    this.markActivity({ force: true });
    ACTIVITY_EVENTS.forEach(eventName =>
      this.target?.addEventListener(eventName, this.handleActivity, {
        passive: true,
        capture: true,
      })
    );
    this.intervalId = setInterval(this.tick, this.tickMs);
  }

  stop() {
    if (this.intervalId !== null) clearInterval(this.intervalId);
    this.intervalId = null;
    ACTIVITY_EVENTS.forEach(eventName =>
      this.target?.removeEventListener(eventName, this.handleActivity, {
        capture: true,
      })
    );
  }

  handleActivity(event) {
    // visibilitychange so conta quando a aba volta a ficar visivel.
    if (
      event?.type === 'visibilitychange' &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return;
    }
    this.markActivity();
  }

  markActivity({ force = false } = {}) {
    if (this.hasTimedOut) return;
    const current = this.now();
    this.localLastActivity = current;
    // Saindo do aviso, grava na hora para as outras abas esconderem o aviso.
    if (
      force ||
      this.isWarning ||
      current - this.lastWrite >= this.writeThrottleMs
    ) {
      this.lastWrite = current;
      this.storage.write(IDLE_LAST_ACTIVITY_KEY, current);
    }
    if (this.isWarning) {
      this.isWarning = false;
      this.onActive();
    }
  }

  getLastActivity() {
    return Math.max(
      this.localLastActivity,
      this.storage.read(IDLE_LAST_ACTIVITY_KEY)
    );
  }

  getRemainingMs() {
    return this.timeoutMs - (this.now() - this.getLastActivity());
  }

  tick() {
    if (this.hasTimedOut) return;
    const remainingMs = this.getRemainingMs();

    if (remainingMs <= 0) {
      this.hasTimedOut = true;
      this.isWarning = false;
      this.stop();
      this.onTimeout();
      return;
    }

    if (remainingMs <= this.warningMs) {
      this.isWarning = true;
      this.onWarn(remainingMs);
      return;
    }

    if (this.isWarning) {
      // Outra aba registrou atividade.
      this.isWarning = false;
      this.onActive();
    }
  }
}
