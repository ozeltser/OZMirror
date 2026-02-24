/**
 * GestureHandler — global touch gesture recognition for kiosk mode.
 *
 * Gestures detected:
 *  - Long press (500ms, single finger): enter edit mode
 *  - Two-finger swipe down (≥60px): open SettingsPanel
 *
 * This class works with raw DOM touch events so it can be initialised
 * once at the App level without coupling to specific React components.
 */

type GestureCallback = () => void;

const LONG_PRESS_DELAY = 500;   // ms before long-press fires
const SWIPE_MIN_DISTANCE = 60;  // px downward movement required for two-finger swipe

export class GestureHandler {
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private touchStart: { x: number; y: number; count: number } | null = null;

  constructor(
    private readonly onLongPress: GestureCallback,
    private readonly onTwoFingerSwipeDown: GestureCallback,
  ) {}

  init(): void {
    document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: true });
  }

  destroy(): void {
    document.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
  }

  private handleTouchStart = (e: TouchEvent) => {
    const count = e.touches.length;

    if (count === 1) {
      this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, count: 1 };
      this.longPressTimer = setTimeout(() => {
        this.longPressTimer = null;
        this.onLongPress();
      }, LONG_PRESS_DELAY);
    } else if (count === 2) {
      // Two-finger gesture: cancel single-finger long press and track start position
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      const avgY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.touchStart = { x: 0, y: avgY, count: 2 };
    }
  };

  private handleTouchMove = () => {
    // Any movement cancels the long-press (user is dragging/scrolling)
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (!this.touchStart || this.touchStart.count !== 2) {
      this.touchStart = null;
      return;
    }

    // Check if the two-finger lift was a downward swipe
    if (e.changedTouches.length >= 2) {
      const avgY = (e.changedTouches[0].clientY + e.changedTouches[1].clientY) / 2;
      const deltaY = avgY - this.touchStart.y;
      if (deltaY > SWIPE_MIN_DISTANCE) {
        this.onTwoFingerSwipeDown();
      }
    }

    this.touchStart = null;
  };
}
