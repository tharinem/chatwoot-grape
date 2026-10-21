import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import IdleLogoutTimer, {
  IDLE_LAST_ACTIVITY_KEY,
  parseIdleMinutes,
} from '../IdleLogoutTimer';

const MINUTE = 60 * 1000;

const createStorage = () => {
  const data = {};
  return {
    data,
    getItem: key => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
};

const createTarget = () => {
  const target = new EventTarget();
  return target;
};

describe('parseIdleMinutes', () => {
  it('returns 0 (disabled) for empty, invalid or non positive values', () => {
    [undefined, null, '', 'abc', 0, '0', -5, '-1'].forEach(value => {
      expect(parseIdleMinutes(value)).toBe(0);
    });
  });

  it('parses positive numbers and numeric strings', () => {
    expect(parseIdleMinutes(30)).toBe(30);
    expect(parseIdleMinutes('15')).toBe(15);
  });
});

describe('IdleLogoutTimer', () => {
  let storage;
  let target;
  let onWarn;
  let onActive;
  let onTimeout;

  const build = (options = {}) =>
    new IdleLogoutTimer({
      timeoutMs: 5 * MINUTE,
      storage,
      target,
      onWarn,
      onActive,
      onTimeout,
      ...options,
    });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
    storage = createStorage();
    target = createTarget();
    onWarn = vi.fn();
    onActive = vi.fn();
    onTimeout = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when timeout is 0 (feature disabled)', () => {
    const timer = build({ timeoutMs: 0 });
    timer.start();
    expect(timer.isRunning).toBe(false);
    vi.advanceTimersByTime(60 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('records activity on start', () => {
    const timer = build();
    timer.start();
    expect(Number(storage.data[IDLE_LAST_ACTIVITY_KEY])).toBe(Date.now());
    timer.stop();
  });

  it('warns 1 minute before and logs out after the timeout', () => {
    const timer = build();
    timer.start();

    vi.advanceTimersByTime(4 * MINUTE - 1000);
    expect(onWarn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(onWarn).toHaveBeenCalled();
    expect(onWarn.mock.calls[0][0]).toBeLessThanOrEqual(MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(timer.isRunning).toBe(false);

    vi.advanceTimersByTime(10 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('resets the countdown on user activity', () => {
    const timer = build();
    timer.start();

    vi.advanceTimersByTime(3 * MINUTE);
    target.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(4 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('activity during the warning hides it and keeps the session', () => {
    const timer = build();
    timer.start();

    vi.advanceTimersByTime(4 * MINUTE + 10 * 1000);
    expect(onWarn).toHaveBeenCalled();

    target.dispatchEvent(new Event('mousemove'));
    expect(onActive).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
    timer.stop();
  });

  it('throttles writes to storage', () => {
    const setItem = vi.spyOn(storage, 'setItem');
    const timer = build({ writeThrottleMs: 5000 });
    timer.start();
    expect(setItem).toHaveBeenCalledTimes(1);

    target.dispatchEvent(new Event('mousemove'));
    target.dispatchEvent(new Event('mousemove'));
    expect(setItem).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5000);
    target.dispatchEvent(new Event('mousemove'));
    expect(setItem).toHaveBeenCalledTimes(2);
    timer.stop();
  });

  it('shares activity between tabs through storage', () => {
    const tabA = build();
    const tabB = build({ target: createTarget() });
    tabA.start();
    tabB.start();

    vi.advanceTimersByTime(4 * MINUTE + 30 * 1000);
    expect(onWarn).toHaveBeenCalled();

    // Usuario mexe em outra aba (simulado gravando direto no storage).
    storage.setItem(IDLE_LAST_ACTIVITY_KEY, Date.now());
    vi.advanceTimersByTime(1000);
    expect(onActive).toHaveBeenCalled();

    vi.advanceTimersByTime(3 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(2);
  });

  it('handles a long sleep (timers frozen) by logging out on the next tick', () => {
    const timer = build();
    timer.start();
    vi.setSystemTime(Date.now() + 2 * 60 * MINUTE);
    vi.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('caps the warning window at the timeout itself', () => {
    const timer = build({ timeoutMs: 30 * 1000 });
    timer.start();
    vi.advanceTimersByTime(1000);
    expect(onWarn).toHaveBeenCalled();
    vi.advanceTimersByTime(30 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('keeps working when storage throws', () => {
    const brokenStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const timer = build({ storage: brokenStorage });
    timer.start();
    vi.advanceTimersByTime(5 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('removes listeners on stop', () => {
    const timer = build();
    timer.start();
    timer.stop();
    const before = timer.localLastActivity;
    vi.advanceTimersByTime(1000);
    target.dispatchEvent(new Event('keydown'));
    expect(timer.localLastActivity).toBe(before);
  });
});
