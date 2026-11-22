// Mouse aim (iteration 15): track the cursor over the canvas in canvas
// pixels, and edge-triggered left clicks. The listener lives on the
// canvas itself, so clicks on the dev preview panel (DOM above the
// canvas) never reach it. endFrame() clears the click edge each frame.
const Mouse = {
  x: -1, y: -1, // canvas-space position, -1 until the mouse has been over it
  over: false,
  clicked: false,

  init(canvas) {
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (canvas.width / r.width),
        y: (e.clientY - r.top) * (canvas.height / r.height),
      };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toCanvas(e);
      this.x = p.x; this.y = p.y; this.over = true;
    });
    canvas.addEventListener('mouseleave', () => { this.over = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = toCanvas(e);
      this.x = p.x; this.y = p.y; this.over = true;
      this.clicked = true;
    });
  },

  endFrame() { this.clicked = false; },
};

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
