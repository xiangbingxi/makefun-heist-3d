// Keyboard input. Tracks held keys and edge-triggered presses.
const Keys = {
  held: {},
  pressed: {},

  init() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed[e.code] = true;
      this.held[e.code] = true;
    });
    window.addEventListener('keyup', (e) => { this.held[e.code] = false; });
    window.addEventListener('blur', () => { this.held = {}; });
  },

  // Call once per frame after the game reads input.
  endFrame() { this.pressed = {}; },

  down(code) { return !!this.held[code]; },
  hit(code) { return !!this.pressed[code]; },

  // Movement axis from WASD / arrows. Returns {x, y} normalized.
  axis() {
    let x = 0, y = 0;
    if (this.held['KeyA'] || this.held['ArrowLeft']) x -= 1;
    if (this.held['KeyD'] || this.held['ArrowRight']) x += 1;
    if (this.held['KeyW'] || this.held['ArrowUp']) y -= 1;
    if (this.held['KeyS'] || this.held['ArrowDown']) y += 1;
    if (x !== 0 && y !== 0) { const inv = 1 / Math.SQRT2; x *= inv; y *= inv; }
    return { x, y };
  },

  sneak() { return !!(this.held['ShiftLeft'] || this.held['ShiftRight']); },
};
