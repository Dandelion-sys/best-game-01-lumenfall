// Input — keyboard and mouse state for Lumenfall.
//
// One object owns every key and pointer fact the game needs: which
// movement keys are held, where the mouse is in canvas pixels, whether
// the fire button is held, and a small queue of clicks the menus can
// consume one at a time. It knows nothing about the game itself.

export const ARENA_WIDTH = 1280;
export const ARENA_HEIGHT = 720;

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = ARENA_WIDTH / 2;
    this.mouseY = ARENA_HEIGHT / 2 - 160;
    this.mouseDown = false;
    this.clickQueue = [];
    this.pressed = new Set();

    window.addEventListener('keydown', (event) => {
      if (MOVE_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      const rect = canvas.getBoundingClientRect();
      this.clickQueue.push({
        x: ((event.clientX - rect.left) / rect.width) * ARENA_WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * ARENA_HEIGHT,
      });
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** True while any of the given codes is held down. */
  anyDown(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  /** -1, 0 or 1 on each axis from the movement keys. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.anyDown('KeyA', 'ArrowLeft')) x -= 1;
    if (this.anyDown('KeyD', 'ArrowRight')) x += 1;
    if (this.anyDown('KeyW', 'ArrowUp')) y -= 1;
    if (this.anyDown('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /** True while the player is asking to fire: mouse held or Space held. */
  firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  /** True only on the frame the key went down (call once per frame). */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Take the oldest unconsumed click, or null when there is none. */
  takeClick() {
    return this.clickQueue.shift() ?? null;
  }

  /** Clear the per-frame key-press set. Call at the end of each frame. */
  endFrame() {
    this.pressed.clear();
  }
}
