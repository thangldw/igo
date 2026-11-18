// Informal clock for the player's own thinking time; it never ends the game.

/** @param {number} seconds */
export function clockLabel(seconds) {
  return `Đồng hồ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * @param {{ element: HTMLElement, getLimit: () => number, isRunning: () => boolean,
 *   isVisible?: () => boolean, onExpire: () => void }} options
 *   `getLimit` returns the configured seconds (0 = clock off); `isRunning` is true while the
 *   player is thinking (game active, bot not on move).
 */
export function createGameClock({
  element,
  getLimit,
  isRunning,
  isVisible = () => document.visibilityState === 'visible',
  onExpire,
}) {
  let left = 0,
    warned = false;
  return {
    /** Restarts the countdown from the configured limit (new game, or limit changed). */
    reset() {
      left = getLimit() || 0;
      warned = false;
    },
    /**
     * Called once a second. `active` is false outside play mode, which hides the clock.
     * @param {boolean} active @param {boolean} gameOver
     */
    tick(active, gameOver) {
      if (!active || !getLimit()) {
        element.hidden = true;
        return;
      }
      element.hidden = false;
      if (!gameOver && isRunning() && isVisible() && left > 0) left--;
      element.textContent = left > 0 ? clockLabel(left) : 'Hết giờ (tự đặt)';
      element.classList.toggle('clock-low', left <= 30);
      if (left === 0 && !warned && !gameOver) {
        warned = true;
        onExpire();
      }
    },
    get left() {
      return left;
    },
  };
}
