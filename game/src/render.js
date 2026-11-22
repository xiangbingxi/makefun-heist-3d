// Isometric 2.5D rendering for THE VELVET VAULT. Canvas 2D only, no WebGL.
// Mechanics stay top-down in world coordinates; this file only projects them.

// Project a world point to screen space.
function isoProject(x, y) {
  return { x: ISO.ox + (x - y) * ISO.s, y: ISO.oy + (x + y) * ISO.sy };
}
// Project a world direction vector to a screen delta.
function isoDir(ax, ay) {
  return { x: (ax - ay) * ISO.s, y: (ax + ay) * ISO.sy };
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Rounded-rect path (avoids ctx.roundRect, which older Chromium lacks).
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Wall-mounted security camera (iteration 15): a bracket on the north
// wall with a lens barrel that swings with the vision cone, and a status
// LED that reads at a glance — green = powered and watching, red = it has
// spotted you, dark = blacked out by the terminal (3s). The barrel points
// along the cone's screen direction, so the lens and the cone always agree.
function drawCamera(ctx, game, cam) {
  const p = isoProject(cam.x, cam.y);
  const off = game.camerasOff > 0;
  const led = off ? 'off' : cam.seen ? 'red' : 'green';
  // Screen direction of the cone: the barrel points the same way.
  const d = isoDir(Math.cos(cam.angle), Math.sin(cam.angle));
  const dl = Math.hypot(d.x, d.y) || 1;
  const ux = d.x / dl, uy = d.y / dl;
  const cx = p.x, cy = p.y - 30; // housing centre, up on the wall face
  const body = off ? '#3a3f47' : '#23272e';
  const rim = off ? '#54595f' : '#6a7078';
  // Wall bracket: short stem from the wall face up to the housing.
  ctx.strokeStyle = off ? '#4a4f55' : '#5a6068';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 6);
  ctx.lineTo(cx, cy + 6);
  ctx.stroke();
  // Housing: capsule along the cone direction, lens at the front end.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(uy, ux));
  ctx.fillStyle = body;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.5;
  rr(ctx, -11, -5, 22, 10, 5);
  ctx.fill();
  ctx.stroke();
  // Lens glass at the front (+x) end.
  ctx.fillStyle = off ? '#20242a' : '#101418';
  ctx.beginPath(); ctx.arc(9, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = off ? '#2c3138' : '#3fa9ff';
  ctx.beginPath(); ctx.arc(9, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Status LED on top of the housing.
  const ledColor = led === 'green' ? '#50ff8c' : led === 'red' ? '#ff2e2e' : '#3a3f45';
  ctx.fillStyle = ledColor;
  ctx.beginPath(); ctx.arc(cx, cy - 9, 3, 0, Math.PI * 2); ctx.fill();
  if (led === 'red') {
    // Hot ring so "spotted" is unmistakable even at a glance.
    ctx.strokeStyle = 'rgba(255,46,46,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy - 9, 5.5, 0, Math.PI * 2); ctx.stroke();
  }
}

// Deterministic 0..1 pseudo-random from an integer seed (stable across runs).
function pseudoRand(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Soft warm light pool on the floor, drawn as a squashed radial gradient
// in screen space (matches the isometric floor squash). alpha is the peak.
function drawLightPool(ctx, sx, sy, rx, alpha) {
  const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, rx);
  g.addColorStop(0, 'rgba(255,208,110,' + alpha + ')');
  g.addColorStop(0.55, 'rgba(255,190,90,' + (alpha * 0.45) + ')');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, 0.5);
  ctx.translate(-sx, -sy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Thin gold trim line along a wall box's top front edge (screen-space line
// between two projected points, lifted to the wall height).
function drawWallTrim(ctx, x1, y1, x2, y2, h, color) {
  const a = isoProject(x1, y1), b = isoProject(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y - h); ctx.lineTo(b.x, b.y - h);
  ctx.stroke();
}

// A picture hung on a wall, drawn as a vertical parallelogram on the wall
// plane. plane 'N': the picture stands on the floor line y=fixed, spanning
// x u1..u2 (the north wall, facing into the room). plane 'E': it stands on
// the floor line x=fixed, spanning y u1..u2 (the east wall). The frame is a
// gold border; scene(ctx) paints the inner canvas. Local space: u 0..1 runs
// along the wall, v 0..1 runs up from the floor line. Only fills inside the
// transform (a stroke would inherit the isometric shear).
function drawWallPicture(ctx, plane, fixed, u1, u2, h, frame, scene) {
  const base = plane === 'N' ? isoProject(u1, fixed) : isoProject(fixed, u1);
  const du = u2 - u1;
  const a = plane === 'N' ? du * ISO.s : -du * ISO.s;
  const b = du * ISO.sy;
  ctx.save();
  ctx.transform(a, b, 0, -h, base.x, base.y);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, 1, 1);
  if (scene) scene(ctx);
  ctx.restore();
}

// Inner scenes for the wall pictures, in the same flat style as the rest of
// the game. Each paints inside the frame inset (x 0.06..0.94, v 0.06..0.94).
function paintSunset(c) {
  c.fillStyle = '#e8722e'; c.fillRect(0.06, 0.55, 0.88, 0.39);
  c.fillStyle = '#f2a541'; c.fillRect(0.06, 0.30, 0.88, 0.25);
  c.fillStyle = '#7a2f56'; c.fillRect(0.06, 0.06, 0.88, 0.24);
  c.fillStyle = '#ffd24a';
  c.beginPath(); c.arc(0.5, 0.66, 0.11, 0, Math.PI * 2); c.fill();
}
function paintDunes(c) {
  c.fillStyle = '#c98f2e'; c.fillRect(0.06, 0.50, 0.88, 0.44);
  c.fillStyle = '#ffe9a8';
  c.beginPath(); c.arc(0.68, 0.70, 0.10, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#8a6d2f';
  c.beginPath();
  c.moveTo(0.06, 0.06); c.lineTo(0.06, 0.30); c.lineTo(0.45, 0.50); c.lineTo(0.94, 0.22); c.lineTo(0.94, 0.06);
  c.closePath(); c.fill();
  c.fillStyle = '#a8823a';
  c.beginPath();
  c.moveTo(0.06, 0.06); c.lineTo(0.06, 0.20); c.lineTo(0.55, 0.38); c.lineTo(0.94, 0.14); c.lineTo(0.94, 0.06);
  c.closePath(); c.fill();
}
function paintSea(c) {
  c.fillStyle = '#bfe3e8'; c.fillRect(0.06, 0.60, 0.88, 0.34);
  c.fillStyle = '#2e7f8f'; c.fillRect(0.06, 0.06, 0.88, 0.54);
  c.fillStyle = '#e8f4f6';
  c.beginPath(); c.arc(0.30, 0.76, 0.09, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fillRect(0.10, 0.40, 0.5, 0.03);
  c.fillRect(0.40, 0.26, 0.44, 0.03);
  c.fillRect(0.14, 0.14, 0.38, 0.03);
}
function paintDusk(c) {
  c.fillStyle = '#d98a7a'; c.fillRect(0.06, 0.45, 0.88, 0.49);
  c.fillStyle = '#ffd24a';
  c.beginPath(); c.arc(0.5, 0.52, 0.10, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#5e2f2a';
  c.beginPath();
  c.moveTo(0.06, 0.06); c.lineTo(0.06, 0.30); c.lineTo(0.38, 0.45); c.lineTo(0.70, 0.28); c.lineTo(0.94, 0.40); c.lineTo(0.94, 0.06);
  c.closePath(); c.fill();
}
const PAINT_SCENES = { sunset: paintSunset, dunes: paintDunes, sea: paintSea, dusk: paintDusk };

function drawIsoBox(ctx, x, y, w, d, h, top, left, right) {
  const A = isoProject(x, y), B = isoProject(x + w, y);
  const C = isoProject(x + w, y + d), D = isoProject(x, y + d);
  // South face (D-C edge, faces the viewer).
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(D.x, D.y); ctx.lineTo(C.x, C.y);
  ctx.lineTo(C.x, C.y - h); ctx.lineTo(D.x, D.y - h);
  ctx.closePath(); ctx.fill();
  // East face (B-C edge).
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
  ctx.lineTo(C.x, C.y - h); ctx.lineTo(B.x, B.y - h);
  ctx.closePath(); ctx.fill();
  // Top face.
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y - h); ctx.lineTo(B.x, B.y - h);
  ctx.lineTo(C.x, C.y - h); ctx.lineTo(D.x, D.y - h);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A floating iso box: the same three faces as drawIsoBox, but the slab
// spans heights h0..h1 instead of the floor..h. Used for furniture built
// up in layers (plinth + glass, mattress + blanket, counter + top).
function drawIsoSlab(ctx, x, y, w, d, h0, h1, top, left, right) {
  const A = isoProject(x, y), B = isoProject(x + w, y);
  const C = isoProject(x + w, y + d), D = isoProject(x, y + d);
  // South face (D-C).
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(D.x, D.y - h0); ctx.lineTo(C.x, C.y - h0);
  ctx.lineTo(C.x, C.y - h1); ctx.lineTo(D.x, D.y - h1);
  ctx.closePath(); ctx.fill();
  // East face (B-C).
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(B.x, B.y - h0); ctx.lineTo(C.x, C.y - h0);
  ctx.lineTo(C.x, C.y - h1); ctx.lineTo(B.x, B.y - h1);
  ctx.closePath(); ctx.fill();
  // Top face at h1.
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y - h1); ctx.lineTo(B.x, B.y - h1);
  ctx.lineTo(C.x, C.y - h1); ctx.lineTo(D.x, D.y - h1);
  ctx.closePath(); ctx.fill();
}

// Draw on one face of a box prop in unit space (fills only — a stroke
// would inherit the isometric shear). South face: u 0..1 runs west to
// east along the front, v 0..1 runs up from the floor. East face: u runs
// north to south along the side. Top face: u west to east, v north to south.
function faceSouth(ctx, pr, draw) {
  const D = isoProject(pr.x, pr.y + pr.d), C = isoProject(pr.x + pr.w, pr.y + pr.d);
  ctx.save();
  ctx.transform(C.x - D.x, C.y - D.y, 0, -pr.h, D.x, D.y);
  draw(ctx);
  ctx.restore();
}
function faceEast(ctx, pr, draw) {
  const B = isoProject(pr.x + pr.w, pr.y), C = isoProject(pr.x + pr.w, pr.y + pr.d);
  ctx.save();
  ctx.transform(C.x - B.x, C.y - B.y, 0, -pr.h, B.x, B.y);
  draw(ctx);
  ctx.restore();
}
function faceTop(ctx, pr, draw) {
  const A = isoProject(pr.x, pr.y), B = isoProject(pr.x + pr.w, pr.y), D = isoProject(pr.x, pr.y + pr.d);
  ctx.save();
  ctx.transform(B.x - A.x, B.y - A.y, D.x - A.x, D.y - A.y, A.x, A.y - pr.h);
  draw(ctx);
  ctx.restore();
}

function drawShadow(ctx, x, y, rx) {
  const p = isoProject(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, rx, rx * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

// One cone look per watcher type, so the player can tell at a glance whose
// sightline they are standing in: guard amber, camera crimson (dashed edge),
// dog orange-brown (dotted edge), sentry violet. The alerted state keeps
// the bright far-edge arc, in each type's own brighter colour, so the type
// stays readable even when it has spotted the player.
const CONE_STYLES = {
  guard: { fill: 'rgba(255,214,90,0.13)', edge: 'rgba(255,214,90,0.30)', fillAlert: 'rgba(255,190,40,0.26)', edgeAlert: 'rgba(255,200,60,0.65)', arcAlert: 'rgba(255,210,80,0.90)', dash: [] },
  camera: { fill: 'rgba(255,45,85,0.14)', edge: 'rgba(255,45,85,0.35)', fillAlert: 'rgba(255,30,70,0.28)', edgeAlert: 'rgba(255,60,90,0.70)', arcAlert: 'rgba(255,80,110,0.95)', dash: [7, 5] },
  dog: { fill: 'rgba(230,126,34,0.15)', edge: 'rgba(230,126,34,0.38)', fillAlert: 'rgba(240,120,30,0.28)', edgeAlert: 'rgba(245,140,50,0.70)', arcAlert: 'rgba(255,160,70,0.95)', dash: [2, 4] },
  sentry: { fill: 'rgba(165,110,255,0.14)', edge: 'rgba(165,110,255,0.38)', fillAlert: 'rgba(150,90,255,0.28)', edgeAlert: 'rgba(170,120,255,0.70)', arcAlert: 'rgba(190,140,255,0.95)', dash: [] },
};

function drawCone(ctx, wx, wy, facing, range, fov, alerted, style) {
  const steps = 14;
  const s = style || CONE_STYLES.guard;
  const p0 = isoProject(wx, wy);
  // Calm cones are easy to read at a glance; an alerted cone goes brighter
  // in its own colour with a hard edge, so the player always knows exactly
  // what spotted them — and whose cone it is.
  ctx.fillStyle = alerted ? s.fillAlert : s.fill;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = 0; i <= steps; i++) {
    const a = facing - fov / 2 + (fov * i) / steps;
    const pt = isoProject(wx + Math.cos(a) * range, wy + Math.sin(a) * range);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alerted ? s.edgeAlert : s.edge;
  ctx.lineWidth = 1;
  ctx.setLineDash(s.dash);
  ctx.stroke();
  ctx.setLineDash([]);
  if (alerted) {
    // Bright far-edge arc: the danger line is unmistakable.
    ctx.strokeStyle = s.arcAlert;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = facing - fov / 2 + (fov * i) / steps;
      const pt = isoProject(wx + Math.cos(a) * range, wy + Math.sin(a) * range);
      if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }
}

function drawFigure(ctx, x, y, opt) {
  const p = isoProject(x, y);
  drawShadow(ctx, x, y, opt.shadowR || 12);
  const h = opt.height || 26;
  const w = opt.width || 14;
  // Body: vertical capsule rising from the floor point.
  ctx.fillStyle = opt.body;
  ctx.beginPath();
  const bx = p.x - w / 2, by = p.y - h, bw = w, bh = h;
  const r = Math.min(5, w / 2);
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.closePath(); ctx.fill();
  if (opt.shirt) {
    ctx.fillStyle = opt.shirt;
    ctx.fillRect(p.x - 2, p.y - h + 4, 4, h - 10);
  }
  // Head.
  ctx.fillStyle = opt.skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(p.x, p.y - h - 5, 6, 0, Math.PI * 2);
  ctx.fill();
  if (opt.cap) {
    ctx.fillStyle = opt.cap;
    ctx.beginPath();
    ctx.arc(p.x, p.y - h - 7, 6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(p.x - 6, p.y - h - 8, 12, 3);
  }
  if (opt.helmet) {
    ctx.fillStyle = opt.helmet;
    ctx.beginPath();
    ctx.arc(p.x, p.y - h - 6, 6.5, Math.PI, 0);
    ctx.fill();
  }
  // Facing tick.
  const d = isoDir(Math.cos(opt.facing || 0), Math.sin(opt.facing || 0));
  const dl = Math.hypot(d.x, d.y) || 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - h - 5);
  ctx.lineTo(p.x + (d.x / dl) * 10, p.y - h - 5 + (d.y / dl) * 10);
  ctx.stroke();
  // Alert / curious mark.
  if (opt.mark) {
    ctx.fillStyle = opt.mark === '!' ? '#ff4444' : '#ffd24a';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opt.mark, p.x, p.y - h - 16);
  }
  return p;
}

function renderGame(ctx, game) {
  const L = game.levelDef();
  const W = 1280, H = 720;
  // Backdrop.
  ctx.fillStyle = '#07080d';
  ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(640, 380, 100, 640, 380, 700);
  bg.addColorStop(0, '#10121c');
  bg.addColorStop(1, '#07080d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Drop-shadow rim under the floor diamond (grounds the room).
  const r1 = isoProject(BOUNDS.x0 - 26, BOUNDS.y0 - 26), r2 = isoProject(BOUNDS.x1 + 26, BOUNDS.y0 - 26);
  const r3 = isoProject(BOUNDS.x1 + 26, BOUNDS.y1 + 26), r4 = isoProject(BOUNDS.x0 - 26, BOUNDS.y1 + 26);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(r3.x, r3.y); ctx.lineTo(r4.x, r4.y);
  ctx.closePath(); ctx.fill();

  // Floor diamond.
  const c1 = isoProject(BOUNDS.x0, BOUNDS.y0), c2 = isoProject(BOUNDS.x1, BOUNDS.y0);
  const c3 = isoProject(BOUNDS.x1, BOUNDS.y1), c4 = isoProject(BOUNDS.x0, BOUNDS.y1);
  ctx.fillStyle = L.floor;
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
  ctx.closePath(); ctx.fill();
  // Iso tile checker.
  for (let gx = BOUNDS.x0; gx < BOUNDS.x1; gx += 80) {
    for (let gy = BOUNDS.y0; gy < BOUNDS.y1; gy += 80) {
      const a = isoProject(gx, gy), b = isoProject(gx + 80, gy);
      const c = isoProject(gx + 80, gy + 80), d = isoProject(gx, gy + 80);
      ctx.fillStyle = ((gx / 80 + gy / 80) % 2 === 0) ? L.floorA : L.floorB;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
  ctx.closePath(); ctx.stroke();
  // Inset accent border trim (two nested diamond strokes).
  for (const [inset, alpha] of [[16, 0.30], [30, 0.13]]) {
    const t1 = isoProject(BOUNDS.x0 + inset, BOUNDS.y0 + inset), t2 = isoProject(BOUNDS.x1 - inset, BOUNDS.y0 + inset);
    const t3 = isoProject(BOUNDS.x1 - inset, BOUNDS.y1 - inset), t4 = isoProject(BOUNDS.x0 + inset, BOUNDS.y1 - inset);
    ctx.strokeStyle = L.accent;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
    ctx.closePath(); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Warm light pools under the chandeliers, with a slow flicker.
  const now = performance.now();
  for (const pr of L.props) {
    if (pr.kind !== 'chandelier') continue;
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d / 2);
    const flick = 0.13 + 0.025 * Math.sin(now / 260 + pr.x);
    drawLightPool(ctx, p.x, p.y, 150, flick);
  }
  // Dust motes drifting in the chandelier light.
  for (const pr of L.props) {
    if (pr.kind !== 'chandelier') continue;
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d / 2);
    for (let i = 0; i < 12; i++) {
      const rx = (pseudoRand(i * 3 + 1) - 0.5) * 220;
      const ry = (pseudoRand(i * 3 + 2) - 0.5) * 80;
      const mx = p.x + rx + Math.sin(now / 900 + i * 1.7) * 7;
      const my = p.y - 20 + ry + Math.cos(now / 1200 + i * 2.3) * 5;
      ctx.fillStyle = 'rgba(255,230,170,' + (0.10 + 0.10 * pseudoRand(i * 3 + 3)) + ')';
      ctx.beginPath();
      ctx.arc(mx, my, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Shadow zones (dark floor patches).
  for (const s of L.shadows) {
    const a = isoProject(s.x, s.y), b = isoProject(s.x + s.w, s.y);
    const c = isoProject(s.x + s.w, s.y + s.h), d = isoProject(s.x, s.y + s.h);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
  }

  // Exit architecture is drawn as a depth-sorted item (drawExit), not a
  // floor sign: doors set into the walls, a skylight in the north wall.
  // The only floor-level exit mark left is the soft light spilling from
  // the skylight onto the floor spot beneath it (the exit trigger).
  if (L.exit.kind === 'skylight') {
    const sc = isoProject(L.exit.x + L.exit.w / 2, L.exit.y + L.exit.h / 2);
    drawLightPool(ctx, sc.x, sc.y, 120, 0.10);
  }

  // Lasers. A beam that is about to switch on blinks amber first, so
  // walking into a live beam is always the player's own mistake.
  for (const l of L.lasers) {
    const on = game.laserOn(l);
    const phase = game.levelTime % l.period;
    const arming = !on && (l.period - phase) <= 0.45;
    const p1 = l.axis === 'h' ? isoProject(l.from, l.at) : isoProject(l.at, l.from);
    const p2 = l.axis === 'h' ? isoProject(l.to, l.at) : isoProject(l.at, l.to);
    ctx.save();
    if (on) {
      ctx.strokeStyle = '#ff2e2e';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ff2e2e';
      ctx.shadowBlur = 12;
    } else if (arming) {
      // Blink rate follows the frame clock; the beam is still harmless.
      const blink = 0.45 + 0.35 * Math.sin(performance.now() / 60);
      ctx.strokeStyle = 'rgba(255,176,46,' + blink.toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 4]);
    } else {
      ctx.strokeStyle = 'rgba(180,180,180,0.55)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
    }
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y - 8); ctx.lineTo(p2.x, p2.y - 8);
    ctx.stroke();
    ctx.restore();
    // Label at the beam's far end, offset clear of the room's props.
  // Labels are play-time UI only: they used to show through the end screens.
  if (game.state === 'playing' || game.state === 'paused') {
    const lab = l.axis === 'h'
      ? { x: isoProject(l.to, l.at).x + 30, y: isoProject(l.to, l.at).y - 22 }
      : { x: isoProject(l.at, l.to).x - 64, y: isoProject(l.at, l.to).y - 10 };
    const ltxt = on ? 'LASER' : arming ? 'LASER ARMING' : 'laser off';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(ltxt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(lab.x - tw / 2 - 5, lab.y - 11, tw + 10, 15);
    ctx.fillStyle = on ? '#ff6b6b' : arming ? '#ffb02e' : 'rgba(200,200,200,0.7)';
    ctx.fillText(ltxt, lab.x, lab.y);
  }
  }

  // Vision cones (floor level, before characters). Each watcher type has
  // its own cone colour and edge, so the player can tell at a glance whose
  // sightline they are standing in.
  for (const g of game.guards) drawCone(ctx, g.x, g.y, g.angle, TUNE.guardVision, TUNE.guardFov, g.seen, CONE_STYLES.guard);
  for (const d of game.dogs) drawCone(ctx, d.x, d.y, d.angle, TUNE.dogVision, TUNE.dogFov, d.seen, CONE_STYLES.dog);
  for (const s of game.sentries) drawCone(ctx, s.x, s.y, s.angle, TUNE.sentryVision, TUNE.sentryFov, s.seen, CONE_STYLES.sentry);
  if (game.camerasOff <= 0) {
    for (const cam of game.cameras) drawCone(ctx, cam.x, cam.y, cam.angle, TUNE.cameraVision, TUNE.cameraFov, cam.seen, CONE_STYLES.camera);
  }

  // North + west border walls (tall, at the back).
  drawIsoBox(ctx, BOUNDS.x0, BOUNDS.y0 - 20, BOUNDS.x1 - BOUNDS.x0, 20, ISO.wallH, L.wallTop, shade(L.wallTop, 0.7), shade(L.wallTop, 0.55));
  drawIsoBox(ctx, BOUNDS.x0 - 20, BOUNDS.y0, 20, BOUNDS.y1 - BOUNDS.y0, ISO.wallH, L.wallTop, shade(L.wallTop, 0.7), shade(L.wallTop, 0.55));
  // Gold trim along the top front edge of the back walls.
  drawWallTrim(ctx, BOUNDS.x0, BOUNDS.y0, BOUNDS.x1, BOUNDS.y0, ISO.wallH, 'rgba(216,169,78,0.45)');
  drawWallTrim(ctx, BOUNDS.x0, BOUNDS.y0, BOUNDS.x0, BOUNDS.y1, ISO.wallH, 'rgba(216,169,78,0.35)');

  // Depth-sorted drawables.
  const items = [];
  for (const w of L.walls) items.push({ depth: w.x + w.w / 2 + w.y + w.h / 2, draw: () => drawIsoBox(ctx, w.x, w.y, w.w, w.h, 40, L.wallTop, shade(L.wallTop, 0.7), shade(L.wallTop, 0.55)) });
  for (const pr of L.props) {
    items.push({ depth: pr.x + pr.w / 2 + pr.y + pr.d / 2, draw: () => drawProp(ctx, pr, game) });
  }
  for (const l of game.loot) {
    if (l.taken) continue;
    items.push({ depth: l.x + l.y, draw: () => drawLoot(ctx, l) });
  }
  if (L.keycard && !game.keycardTaken) {
    items.push({ depth: L.keycard.x + L.keycard.y, draw: () => drawKeycard(ctx, L.keycard) });
  }
  items.push({ depth: L.target.x + L.target.y, draw: () => drawTarget(ctx, game) });
  items.push({ depth: L.terminal.x + L.terminal.y, draw: () => drawTerminal(ctx, game) });
  // Cameras (iteration 15): wall-mounted bodies on the north wall, drawn
  // as depth items like the terminal panel, so a guard walking past
  // covers them correctly. Depth is the wall point under the camera.
  for (const cam of game.cameras) {
    items.push({ depth: cam.x + cam.y, draw: () => drawCamera(ctx, game, cam) });
  }
  // Exit architecture (iteration 11): a door in the wall or the skylight
  // in the north wall. Depth is the wall point under the exit, same
  // convention as the terminal panel, so it paints on the wall face.
  items.push({ depth: (L.exit.u1 + L.exit.u2) / 2 + L.exit.fixed, draw: () => drawExit(ctx, game) });
  for (const c of game.thrownCoins) items.push({ depth: c.x + c.y, draw: () => drawThrownCoin(ctx, c) });
  for (const c of game.smokeClouds) items.push({ depth: c.x + c.y, draw: () => drawSmoke(ctx, c) });
  for (const g of game.guards) {
    items.push({ depth: g.x + g.y, draw: () => drawFigure(ctx, g.x, g.y, {
      body: g.uniform || '#2c4a7a', cap: '#16233d', facing: g.angle,
      mark: g.seen ? '!' : (g.state === 'investigate' || g.state === 'search' ? '?' : null),
    }) });
  }
  for (const d of game.dogs) {
    items.push({ depth: d.x + d.y, draw: () => drawDog(ctx, d) });
  }
  for (const s of game.sentries) {
    items.push({ depth: s.x + s.y, draw: () => drawFigure(ctx, s.x, s.y, {
      body: '#3d3d46', helmet: '#23232b', facing: s.angle, height: 28,
      mark: s.seen ? '!' : null,
    }) });
  }
  // Hidden players are inside the wardrobe: no figure on the floor.
  if (!game.hidden) {
    items.push({ depth: game.player.x + game.player.y, draw: () => drawFigure(ctx, game.player.x, game.player.y, {
      body: '#15151d', shirt: '#f2f2f2', facing: game.player.facing, height: 27,
      mark: null,
    }) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
  // Mouse-aim landing marker (iteration 15): where the next coin will
  // land — 130px from the player, toward the cursor. Gold ring + centre
  // dot on the floor, with a faint dashed guide line from the player, so
  // the landing spot reads at a glance. Only while playing with coins left.
  if (game.state === 'playing' && game.aim && game.coins > 0) {
    const ap = isoProject(game.aim.x, game.aim.y);
    const pp = isoProject(game.player.x, game.player.y);
    ctx.strokeStyle = 'rgba(255,210,74,0.45)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pp.x, pp.y - 4);
    ctx.lineTo(ap.x, ap.y - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(ap.x, ap.y - 4, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(ap.x, ap.y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // HIDDEN tag above the wardrobe while tucked inside.
  if (game.hidden) {
    const h = game.nearHide();
    if (h) {
      const p = isoProject(h.x + h.w / 2, h.y + h.h / 2);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN — move or press E to slip out', p.x, p.y - 84);
    }
  }
  // Transient effects (footstep puffs, pickup sparkles).
  for (const f of game.fx) drawFx(ctx, f);
  // Red vignette while the alarm is in the HUNTED tier.
  if (game.alarm > 70) {
    const vig = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
    vig.addColorStop(0, 'rgba(255,40,40,0)');
    vig.addColorStop(1, 'rgba(255,40,40,' + (0.10 + 0.15 * (game.alarm - 70) / 30) + ')');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  // South + east curbs (low, at the front).
  drawIsoBox(ctx, BOUNDS.x0, BOUNDS.y1, BOUNDS.x1 - BOUNDS.x0, 12, 8, L.wallFront, shade(L.wallFront, 0.8), shade(L.wallFront, 0.65));
  drawIsoBox(ctx, BOUNDS.x1, BOUNDS.y0, 12, BOUNDS.y1 - BOUNDS.y0, 8, L.wallFront, shade(L.wallFront, 0.8), shade(L.wallFront, 0.65));
  // Baseboard trim on the front curbs.
  drawWallTrim(ctx, BOUNDS.x0, BOUNDS.y1 + 12, BOUNDS.x1, BOUNDS.y1 + 12, 8, 'rgba(216,169,78,0.28)');
  drawWallTrim(ctx, BOUNDS.x1 + 12, BOUNDS.y0, BOUNDS.x1 + 12, BOUNDS.y1, 8, 'rgba(216,169,78,0.22)');

  // Crack progress ring above the target (kept clear of the target label).
  if (!game.targetTaken && game.crack > 0) {
    const tp = isoProject(L.target.x, L.target.y);
    const cx = tp.x, cy = tp.y - 96;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + game.crack * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING ' + Math.round(game.crack * 100) + '%', cx, cy - 28);
  }
  // The lock state lives in the HUD hint pill (see hintFor), not in the
  // world: the old in-world 'LOCKED — FIND KEYCARD' sat 2px above the
  // VELVET DIAMOND label and the two rendered on top of each other.
  renderHud(ctx, game);
  renderScreens(ctx, game);
}

function drawProp(ctx, pr, game) {
  const top = pr.color, left = shade(pr.color, 0.7), right = shade(pr.color, 0.5);
  if (pr.kind === 'rug') {
    const a = isoProject(pr.x, pr.y), b = isoProject(pr.x + pr.w, pr.y);
    const c = isoProject(pr.x + pr.w, pr.y + pr.d), d = isoProject(pr.x, pr.y + pr.d);
    ctx.fillStyle = pr.color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Inset border pattern.
    const ia = isoProject(pr.x + 14, pr.y + 10), ib = isoProject(pr.x + pr.w - 14, pr.y + 10);
    const ic = isoProject(pr.x + pr.w - 14, pr.y + pr.d - 10), id = isoProject(pr.x + 14, pr.y + pr.d - 10);
    ctx.strokeStyle = 'rgba(255,220,150,0.30)';
    ctx.beginPath();
    ctx.moveTo(ia.x, ia.y); ctx.lineTo(ib.x, ib.y); ctx.lineTo(ic.x, ic.y); ctx.lineTo(id.x, id.y);
    ctx.closePath(); ctx.stroke();
    return;
  }
  if (pr.kind === 'painting') {
    // Hung on the north wall face (y = pr.y, just inside the wall): a gold
    // frame with a small painted scene, flush against the wall, not a box
    // standing on the floor. Height 40 fits the 46px wall with room to spare.
    drawWallPicture(ctx, 'N', pr.y, pr.x, pr.x + pr.w, pr.h, '#e8c268', PAINT_SCENES[pr.scene] || null);
    return;
  }
  if (pr.kind === 'chandelier') {
    const p = isoProject(pr.x, pr.y);
    ctx.strokeStyle = 'rgba(255,220,140,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 60); ctx.lineTo(p.x, p.y - 24); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 22, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(p.x, p.y - 24, 4, 0, Math.PI * 2); ctx.fill();
    // Warm halo around the bulb + a bright pool right beneath it.
    const flick = 0.20 + 0.05 * Math.sin(performance.now() / 260 + pr.x);
    const hg = ctx.createRadialGradient(p.x, p.y - 24, 2, p.x, p.y - 24, 34);
    hg.addColorStop(0, 'rgba(255,220,130,' + flick + ')');
    hg.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(p.x, p.y - 24, 34, 0, Math.PI * 2); ctx.fill();
    drawLightPool(ctx, p.x, p.y, 70, 0.10);
    return;
  }
  if (pr.kind === 'lamp') {
    // Floor lamp: thin pole, glowing shade, warm pool at its base.
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d / 2);
    drawLightPool(ctx, p.x, p.y, 64, 0.12);
    ctx.strokeStyle = '#3a2f22';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 34); ctx.stroke();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(p.x - 10, p.y - 34); ctx.lineTo(p.x + 10, p.y - 34);
    ctx.lineTo(p.x + 7, p.y - 48); ctx.lineTo(p.x - 7, p.y - 48);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(p.x, p.y - 41, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2f22';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (pr.kind === 'plant') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, 12);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 12, '#8a4a2f', shade('#8a4a2f', 0.75), shade('#8a4a2f', 0.6));
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d / 2);
    ctx.fillStyle = pr.color;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(a) * 8, p.y - 22 + Math.sin(a) * 4, 5, 12, a * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (pr.kind === 'goldbars') {
    // A stack of individual ingots, not one slab: three on the bottom row,
    // two on top straddling the joints, each with a lighter top face.
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    const bw = pr.w / 3, bd = pr.d;
    for (let i = 0; i < 3; i++) {
      drawIsoBox(ctx, pr.x + i * bw + 1, pr.y, bw - 2, bd, 8, '#e8c53a', shade('#e8c53a', 0.7), shade('#e8c53a', 0.5));
    }
    for (let i = 0; i < 2; i++) {
      drawIsoSlab(ctx, pr.x + bw / 2 + i * bw + 1, pr.y, bw - 2, bd, 8, 16, '#f2d24a', shade('#f2d24a', 0.7), shade('#f2d24a', 0.5));
    }
    return;
  }
  if (pr.kind === 'wardrobe') {
    // Tall dark-wood wardrobe with a sliding door: the hiding spot.
    // The door is the left leaf of the south face; game.door.open (0 shut ..
    // 1 open) slides it along the face, revealing the dark interior behind.
    // Closed it reads exactly like the old two-door front: centre seam, two
    // gold handles. The fixed right leaf's handle sits behind the sliding
    // leaf, so it disappears under it as the door opens.
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, top, left, right);
    // Cornice: a thin slab overhanging the top, so the wardrobe reads as
    // furniture with a crown, not a plain tall box. It sits above the door
    // (h..h+5), so the sliding leaf and its handles are untouched.
    drawIsoSlab(ctx, pr.x - 3, pr.y - 3, pr.w + 6, pr.d + 6, pr.h, pr.h + 5, shade(pr.color, 1.15), shade(pr.color, 0.8), shade(pr.color, 0.6));
    const D = isoProject(pr.x, pr.y + pr.d);
    const C = isoProject(pr.x + pr.w, pr.y + pr.d);
    const h = pr.h;
    const mx = (D.x + C.x) / 2, my = (D.y + C.y) / 2;
    const faceW = Math.hypot(C.x - D.x, C.y - D.y);
    const ux = (C.x - D.x) / faceW, uy = (C.y - D.y) / faceW;
    const open = game && game.door ? game.door.open : 0;
    const sx = ux * open * faceW / 2, sy = uy * open * faceW / 2;
    // Dark interior behind the sliding leaf (left half of the south face).
    ctx.fillStyle = '#0b0705';
    ctx.beginPath();
    ctx.moveTo(D.x, D.y); ctx.lineTo(mx, my); ctx.lineTo(mx, my - h); ctx.lineTo(D.x, D.y - h);
    ctx.closePath(); ctx.fill();
    // Fixed right leaf's gold handle (drawn first: the sliding leaf covers
    // it once it slides over the right half).
    ctx.fillStyle = '#d8a94e';
    ctx.beginPath(); ctx.arc(mx + 7, my - h * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    // The sliding leaf, shifted along the face by the door animation.
    ctx.fillStyle = shade(pr.color, 0.9);
    ctx.beginPath();
    ctx.moveTo(D.x + sx, D.y + sy); ctx.lineTo(mx + sx, my + sy);
    ctx.lineTo(mx + sx, my + sy - h); ctx.lineTo(D.x + sx, D.y + sy - h);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Seam rides the sliding leaf's right edge; its gold handle rides with it.
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx + sx, my + sy - 6); ctx.lineTo(mx + sx, my + sy - h + 8);
    ctx.stroke();
    ctx.fillStyle = '#d8a94e';
    ctx.beginPath(); ctx.arc(mx + sx - 7, my + sy - h * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // Display case (gallery): dark plinth, a gold trophy standing inside,
  // and a glass box over it — the trophy shows through the glass.
  if (pr.kind === 'case') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 15, shade(pr.color, 0.55), shade(pr.color, 0.4), shade(pr.color, 0.3));
    // Trophy on the glass box's own south face plane (inset 3px), so it
    // sits inside the glass, not on the plinth front.
    const gp = { x: pr.x + 3, y: pr.y + 3, w: pr.w - 6, d: pr.d - 6, h: pr.h };
    faceSouth(ctx, gp, (c) => {
      c.fillStyle = '#c9962e';
      c.fillRect(0.44, 0.47, 0.12, 0.04); // foot
      c.fillRect(0.485, 0.51, 0.03, 0.14); // stem
      c.fillStyle = '#ffd24a'; // bowl: wide at the top, narrow at the stem
      c.beginPath();
      c.moveTo(0.36, 0.92); c.lineTo(0.64, 0.92); c.lineTo(0.58, 0.65); c.lineTo(0.42, 0.65);
      c.closePath(); c.fill();
      c.fillStyle = '#c9962e'; // handles
      c.fillRect(0.32, 0.74, 0.04, 0.10);
      c.fillRect(0.64, 0.74, 0.04, 0.10);
    });
    // Glass box over the trophy (translucent; the trophy shows through).
    drawIsoSlab(ctx, pr.x + 3, pr.y + 3, pr.w - 6, pr.d - 6, 15, pr.h,
      'rgba(190,225,255,0.20)', 'rgba(150,190,230,0.13)', 'rgba(120,160,210,0.10)');
    // Glint: a diagonal bright strip on the glass front.
    faceSouth(ctx, gp, (c) => {
      c.save();
      c.translate(0.30, 0.72); c.rotate(-0.45);
      c.fillStyle = 'rgba(255,255,255,0.30)';
      c.fillRect(-0.02, -0.16, 0.045, 0.32);
      c.restore();
    });
    return;
  }
  // Safe (vault): steel body, a door panel on the front face, a round
  // combination dial with tick marks, a brass handle lever, and hinges.
  if (pr.kind === 'safe') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, top, left, right);
    faceSouth(ctx, pr, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0.08, 0.08, 0.84, 0.84);
      c.fillStyle = shade(pr.color, 1.15);
      c.fillRect(0.10, 0.10, 0.80, 0.80);
    });
    // Combination dial + handle + hinges in screen space (a true circle).
    const D = isoProject(pr.x, pr.y + pr.d), C = isoProject(pr.x + pr.w, pr.y + pr.d);
    const cx = (D.x + C.x) / 2, cy = (D.y + C.y) / 2 - pr.h * 0.52;
    ctx.fillStyle = '#22262a';
    ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#565b61';
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c8ccd2';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      ctx.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
      ctx.stroke();
    }
    ctx.fillStyle = '#1a1d20';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
    // Brass handle lever under the dial.
    ctx.fillStyle = '#c9962e';
    ctx.fillRect(cx - 9, cy + 15, 18, 4);
    ctx.beginPath(); ctx.arc(cx - 9, cy + 17, 3, 0, Math.PI * 2); ctx.fill();
    // Hinges on the door's left edge.
    ctx.fillStyle = '#22262a';
    ctx.fillRect(D.x - 2, D.y - pr.h * 0.28 - 2, 5, 4);
    ctx.fillRect(D.x - 2, D.y - pr.h * 0.72 - 2, 5, 4);
    return;
  }
  // Vault door: body, a door seam on the front face, and a spoked wheel
  // dial — the round handle you spin to open a vault.
  if (pr.kind === 'vaultdoor') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, top, left, right);
    faceSouth(ctx, pr, (c) => {
      // Door seam: inset frame.
      c.fillStyle = 'rgba(0,0,0,0.40)';
      c.fillRect(0.07, 0.07, 0.86, 0.03);
      c.fillRect(0.07, 0.90, 0.86, 0.03);
      c.fillRect(0.07, 0.07, 0.03, 0.86);
      c.fillRect(0.90, 0.07, 0.03, 0.86);
      // Two hinge blocks on the left edge.
      c.fillStyle = '#22262a';
      c.fillRect(0.05, 0.22, 0.06, 0.10);
      c.fillRect(0.05, 0.68, 0.06, 0.10);
    });
    const D = isoProject(pr.x, pr.y + pr.d), C = isoProject(pr.x + pr.w, pr.y + pr.d);
    const cx = (D.x + C.x) / 2, cy = (D.y + C.y) / 2 - pr.h * 0.5;
    ctx.strokeStyle = '#22262a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2c2f33';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
    return;
  }
  // Bed (penthouse): low frame, tall headboard on the north edge, cream
  // mattress, rose blanket over the foot two-thirds, two pillows at the head.
  if (pr.kind === 'bed') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, 10, 46, shade(pr.color, 0.7), shade(pr.color, 0.5), shade(pr.color, 0.4));
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 12, shade(pr.color, 0.6), shade(pr.color, 0.45), shade(pr.color, 0.35));
    drawIsoSlab(ctx, pr.x + 4, pr.y + 10, pr.w - 8, pr.d - 14, 12, 20, '#e8dcc8', shade('#e8dcc8', 0.75), shade('#e8dcc8', 0.6));
    drawIsoSlab(ctx, pr.x + 4, pr.y + 10 + (pr.d - 14) * 0.35, pr.w - 8, (pr.d - 14) * 0.65, 20, 23, pr.color, shade(pr.color, 0.7), shade(pr.color, 0.5));
    const pw = (pr.w - 8 - 12) / 2;
    drawIsoSlab(ctx, pr.x + 6, pr.y + 12, pw, 16, 20, 25, '#f2ead8', shade('#f2ead8', 0.8), shade('#f2ead8', 0.65));
    drawIsoSlab(ctx, pr.x + 6 + pw + 4, pr.y + 12, pw, 16, 20, 25, '#f2ead8', shade('#f2ead8', 0.8), shade('#f2ead8', 0.65));
    return;
  }
  // Sofa (penthouse): low base, tall backrest on the north edge, armrests
  // at both ends, two seat cushions between them.
  if (pr.kind === 'sofa') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, 12, 26, shade(pr.color, 0.9), shade(pr.color, 0.65), shade(pr.color, 0.5));
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 14, top, left, right);
    drawIsoBox(ctx, pr.x, pr.y, 14, pr.d, 22, shade(pr.color, 0.9), shade(pr.color, 0.65), shade(pr.color, 0.5));
    drawIsoBox(ctx, pr.x + pr.w - 14, pr.y, 14, pr.d, 22, shade(pr.color, 0.9), shade(pr.color, 0.65), shade(pr.color, 0.5));
    const cw = (pr.w - 28 - 4) / 2;
    drawIsoSlab(ctx, pr.x + 14, pr.y + 12, cw, pr.d - 12, 14, 19, shade(pr.color, 1.25), shade(pr.color, 0.9), shade(pr.color, 0.7));
    drawIsoSlab(ctx, pr.x + 14 + cw + 4, pr.y + 12, cw, pr.d - 12, 14, 19, shade(pr.color, 1.25), shade(pr.color, 0.9), shade(pr.color, 0.7));
    return;
  }
  // Bar (penthouse): wood counter, lighter countertop slab, bottles with
  // necks along the back edge, two glasses on the front.
  if (pr.kind === 'bar') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 30, top, left, right);
    drawIsoSlab(ctx, pr.x - 3, pr.y - 3, pr.w + 6, pr.d + 6, 30, 33, '#8a6d3a', shade('#8a6d3a', 0.7), shade('#8a6d3a', 0.5));
    const bottles = [
      { dx: 12, c: '#2f6b3a' },
      { dx: 36, c: '#b4762a' },
      { dx: 60, c: '#7a9ab0' },
    ];
    for (const b of bottles) {
      drawIsoSlab(ctx, pr.x + b.dx, pr.y + 4, 8, 8, 33, 42, shade(b.c, 1.2), shade(b.c, 0.85), shade(b.c, 0.65));
      drawIsoSlab(ctx, pr.x + b.dx + 2.5, pr.y + 4 + 2.5, 3, 3, 42, 47, shade(b.c, 1.3), shade(b.c, 0.9), shade(b.c, 0.7));
    }
    drawIsoSlab(ctx, pr.x + 22, pr.y + pr.d - 12, 7, 7, 33, 39, 'rgba(200,225,255,0.55)', 'rgba(160,190,230,0.4)', 'rgba(140,170,210,0.35)');
    drawIsoSlab(ctx, pr.x + 55, pr.y + pr.d - 12, 7, 7, 33, 39, 'rgba(200,225,255,0.55)', 'rgba(160,190,230,0.4)', 'rgba(140,170,210,0.35)');
    return;
  }
  // Wall-mounted flat TV (penthouse): dark glass with a faint cool glow
  // and a thin frame, flush on the north wall. No footprint, no collision.
  if (pr.kind === 'tv') {
    drawWallPicture(ctx, 'N', pr.y, pr.x, pr.x + pr.w, pr.h, '#1a1f2a', (c) => {
      c.fillStyle = '#0d1420'; c.fillRect(0.06, 0.06, 0.88, 0.88);
      c.fillStyle = 'rgba(120,180,255,0.18)'; c.fillRect(0.06, 0.06, 0.88, 0.88);
      c.fillStyle = 'rgba(200,225,255,0.10)';
      c.beginPath();
      c.moveTo(0.10, 0.94); c.lineTo(0.45, 0.06); c.lineTo(0.60, 0.06); c.lineTo(0.25, 0.94);
      c.closePath(); c.fill();
      c.fillStyle = '#ff5a4a'; c.fillRect(0.86, 0.86, 0.03, 0.03);
    });
    return;
  }
  // Writing desk (penthouse): wood body, lighter top slab, two drawer
  // fronts with brass knobs on the front face, papers on top.
  if (pr.kind === 'desk') {
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, 26, shade(pr.color, 0.9), shade(pr.color, 0.65), shade(pr.color, 0.5));
    drawIsoSlab(ctx, pr.x - 2, pr.y - 2, pr.w + 4, pr.d + 4, 26, 30, '#8a6d3a', shade('#8a6d3a', 0.7), shade('#8a6d3a', 0.5));
    faceSouth(ctx, pr, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0.10, 0.15, 0.80, 0.30);
      c.fillRect(0.10, 0.55, 0.80, 0.30);
      c.fillStyle = '#c9962e';
      c.fillRect(0.46, 0.26, 0.08, 0.06);
      c.fillRect(0.46, 0.66, 0.08, 0.06);
    });
    faceTop(ctx, { x: pr.x, y: pr.y, w: pr.w, d: pr.d, h: 30 }, (c) => {
      c.fillStyle = '#f2ead8';
      c.fillRect(0.25, 0.30, 0.30, 0.25);
      c.fillRect(0.55, 0.55, 0.28, 0.22);
    });
    return;
  }
  // Contact shadow grounds every box prop.
  drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
  drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, top, left, right);
}

function drawLoot(ctx, l) {
  const p = isoProject(l.x, l.y);
  drawShadow(ctx, l.x, l.y, 8);
  if (l.kind === 'coin') {
    ctx.fillStyle = '#c9962e';
    ctx.fillRect(p.x - 7, p.y - 4, 14, 4);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 4, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c9962e';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x, p.y - 1);
  } else if (l.kind === 'gem') {
    ctx.fillStyle = '#37c8e8';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x + 8, p.y - 5); ctx.lineTo(p.x, p.y + 2); ctx.lineTo(p.x - 8, p.y - 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x + 4, p.y - 5); ctx.lineTo(p.x, p.y - 5); ctx.lineTo(p.x - 2, p.y - 10);
    ctx.closePath(); ctx.fill();
  } else if (l.kind === 'watch') {
    // Gold pocket watch: round face + crown + hands.
    ctx.fillStyle = '#c9962e';
    ctx.beginPath(); ctx.arc(p.x, p.y - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(p.x, p.y - 8, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6d2f';
    ctx.fillRect(p.x - 2, p.y - 18, 4, 3);
    ctx.strokeStyle = '#8a6d2f';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x + 4, p.y - 6); ctx.stroke();
  } else if (l.kind === 'ring') {
    // Small gold ring with a stone.
    ctx.strokeStyle = '#ffd24a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y - 6, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#37c8e8';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 16); ctx.lineTo(p.x + 4, p.y - 10); ctx.lineTo(p.x, p.y - 7); ctx.lineTo(p.x - 4, p.y - 10);
    ctx.closePath(); ctx.fill();
  } else {
    // Antique vase.
    ctx.fillStyle = '#9a6fd0';
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y - 12); ctx.lineTo(p.x + 7, p.y - 12);
    ctx.lineTo(p.x + 5, p.y - 2); ctx.lineTo(p.x - 5, p.y - 2);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(p.x - 2, p.y - 18, 4, 7);
    ctx.fillStyle = '#c9a8ec';
    ctx.fillRect(p.x - 7, p.y - 12, 14, 2);
  }
}

function drawKeycard(ctx, k) {
  const p = isoProject(k.x, k.y);
  ctx.save();
  ctx.translate(p.x, p.y - 6);
  ctx.rotate(-0.3);
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(-9, -5, 18, 10);
  ctx.fillStyle = '#2b6fd6';
  ctx.fillRect(-9, -5, 18, 3);
  ctx.fillStyle = '#333';
  ctx.fillRect(-6, 1, 8, 2);
  ctx.restore();
  ctx.fillStyle = '#9ad1ff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KEYCARD', p.x, p.y - 16);
}

function drawTarget(ctx, game) {
  const L = game.levelDef();
  const t = L.target;
  if (game.targetTaken) return;
  const p = isoProject(t.x, t.y);
  drawShadow(ctx, t.x, t.y, 22);
  if (t.kind === 'portrait') {
    // Hung on the east wall: a dark wall panel behind it (the east side has
    // no tall wall of its own, only the low curb), then the gold-framed
    // picture flush on that panel. The gameplay point moved with the picture
    // to (1216,300), so the crack ring and label still sit right on it.
    drawWallPicture(ctx, 'E', 1218, 255, 345, 46, L.wallSide, null);
    drawWallPicture(ctx, 'E', 1216, 262, 338, 40, '#e8c268', paintSunset);
    const q = isoProject(t.x, t.y);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUNSET PORTRAIT', q.x, q.y - 64);
  } else if (t.kind === 'diamond') {
    drawIsoBox(ctx, t.x - 34, t.y - 22, 68, 44, 26, '#5a6b7a', shade('#5a6b7a', 0.7), shade('#5a6b7a', 0.5));
    ctx.fillStyle = '#37c8e8';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 52); ctx.lineTo(p.x + 15, p.y - 32); ctx.lineTo(p.x, p.y - 18); ctx.lineTo(p.x - 15, p.y - 32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 52); ctx.lineTo(p.x + 7, p.y - 34); ctx.lineTo(p.x, p.y - 32); ctx.lineTo(p.x - 3, p.y - 44);
    ctx.closePath(); ctx.fill();
    // Glass case over the pedestal: the diamond sits inside it, visible
    // through the translucent panes (front top edge glints).
    drawIsoSlab(ctx, t.x - 30, t.y - 18, 60, 36, 26, 56,
      'rgba(190,225,255,0.18)', 'rgba(150,190,230,0.12)', 'rgba(120,160,210,0.10)');
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - 26.4, p.y - 59.3);
    ctx.lineTo(p.x + 6.6, p.y - 42.8);
    ctx.stroke();
    ctx.fillStyle = '#bfefff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VELVET DIAMOND', p.x, p.y - 62);
  } else {
    drawIsoBox(ctx, t.x - 34, t.y - 22, 68, 44, 26, '#6b4a2f', shade('#6b4a2f', 0.7), shade('#6b4a2f', 0.5));
    // Velvet cushion on the pedestal top; the crown sits on it.
    drawIsoSlab(ctx, t.x - 30, t.y - 18, 60, 36, 26, 31, '#7a1f2b', shade('#7a1f2b', 0.7), shade('#7a1f2b', 0.5));
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.moveTo(p.x - 16, p.y - 30); ctx.lineTo(p.x - 16, p.y - 48);
    ctx.lineTo(p.x - 8, p.y - 38); ctx.lineTo(p.x, p.y - 52);
    ctx.lineTo(p.x + 8, p.y - 38); ctx.lineTo(p.x + 16, p.y - 48);
    ctx.lineTo(p.x + 16, p.y - 30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9962e';
    ctx.fillRect(p.x - 16, p.y - 32, 32, 4);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE CROWN', p.x, p.y - 62);
  }
}

// Terminal screen scene, painted inside the wall panel's inset (0.06..0.94).
// Standby: cyan text lines and a short status bar; cameras off: the status
// bar goes green and full width. Static (no blink) so screenshots are stable.
function paintTerminalScreen(c, game) {
  c.fillStyle = '#0a1a2e'; c.fillRect(0.06, 0.06, 0.88, 0.88);
  const on = game.camerasOff > 0;
  c.fillStyle = on ? '#50ff8c' : '#7fd4ff';
  c.fillRect(0.14, 0.16, 0.55, 0.07);
  c.fillRect(0.14, 0.30, 0.72, 0.07);
  c.fillRect(0.14, 0.44, 0.40, 0.07);
  c.fillRect(0.14, 0.64, on ? 0.72 : 0.30, 0.14);
}

function drawTerminal(ctx, game) {
  const L = game.levelDef();
  const p = isoProject(L.terminal.x, L.terminal.y);
  // Wall-mounted panel on the north wall face (y = terminal.y, just inside
  // the wall), same approach as the wall pictures: a metal frame with a
  // screen, flush against the wall, not a box standing on the floor.
  drawWallPicture(ctx, 'N', L.terminal.y, L.terminal.x - 50, L.terminal.x + 50, 40, '#3a5a7a', (c) => paintTerminalScreen(c, game));
  // Label is play-time UI only (it used to show through the end screens).
  // It sits just above the panel top, clear of the gold wall trim, and
  // doubles as the hold-E progress readout while disabling.
  if (game.state === 'playing' || game.state === 'paused') {
    let label, color;
    if (game.termProgress > 0) {
      label = 'DISABLING ' + Math.round(game.termProgress * 100) + '%';
      color = '#9ad1ff';
    } else if (game.camerasOff > 0) {
      label = 'CAMERAS OFF ' + Math.ceil(game.camerasOff) + 's';
      color = '#50ff8c';
    } else {
      label = 'TERMINAL — hold E';
      color = '#9ad1ff';
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, p.x, p.y - 52);
  }
}

// --- Exit architecture (iteration 11) ---
// The exit is part of the building now, not a floor sign. A door is a wall
// panel plus a leaf with two recessed panels, a brass handle and a kick
// plate, painted with the same drawWallPicture helper as the pictures and
// the terminal. The skylight is a bright opening high in the north wall;
// the floor spot beneath it is the exit. Labels are screen-space text
// (crisp, same as the terminal label): green once the target is stolen
// (the way out is open), dim amber while it is locked.

// Door leaf scene, painted inside the frame inset (u 0.06..0.94,
// v 0.06..0.94, v running up from the floor line).
function paintDoorLeaf(c, leaf, panel, handle, kick) {
  c.fillStyle = leaf; c.fillRect(0.06, 0.06, 0.88, 0.88);
  // Two recessed panels, one above the other, with a light top rim.
  c.fillStyle = panel;
  c.fillRect(0.20, 0.14, 0.60, 0.28);
  c.fillRect(0.20, 0.52, 0.60, 0.28);
  c.fillStyle = 'rgba(255,255,255,0.10)';
  c.fillRect(0.20, 0.14, 0.60, 0.02);
  c.fillRect(0.20, 0.52, 0.60, 0.02);
  // Kick plate along the bottom.
  c.fillStyle = kick; c.fillRect(0.06, 0.82, 0.88, 0.12);
  // Brass handle on the opening side.
  c.fillStyle = handle;
  c.beginPath(); c.arc(0.80, 0.50, 0.045, 0, Math.PI * 2); c.fill();
  c.fillRect(0.74, 0.485, 0.06, 0.03);
}

// Skylight scene: the panel blends into the wall below the opening, and
// the opening itself is a bright sky window with a sun glow and white
// mullions, high in the wall. The opening starts at v 0.60: its bottom
// edge sits ~28px above the wall base, with clear wall below it — the
// stairs that used to stand under it are gone (iteration 14), so nothing
// touches the window at all.
function paintSkylight(c, game) {
  const open = game.targetTaken;
  c.fillStyle = open ? '#cfeaff' : '#7a9ab0';
  c.fillRect(0.10, 0.60, 0.80, 0.35);
  c.fillStyle = open ? '#fff3c4' : '#c8d8de';
  c.beginPath(); c.arc(0.28, 0.82, 0.09, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.fillRect(0.47, 0.60, 0.06, 0.35);
  c.fillRect(0.10, 0.74, 0.80, 0.05);
}

function drawExit(ctx, game) {
  const L = game.levelDef();
  const e = L.exit;
  const open = game.targetTaken;
  const labelColor = open ? '#50ff8c' : 'rgba(255,176,46,0.9)';
  if (e.kind === 'skylight') {
    // Bright opening high in the north wall. The frame colour is the wall
    // colour, so the panel is invisible except for the opening itself.
    drawWallPicture(ctx, 'N', e.fixed, e.u1, e.u2, e.hgt, L.wallTop, (c) => paintSkylight(c, game));
    if (game.state === 'playing' || game.state === 'paused') {
      const p = isoProject((e.u1 + e.u2) / 2, e.fixed);
      ctx.fillStyle = labelColor;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.label, p.x, p.y - e.hgt - 6);
    }
    return;
  }
  // Door (rooms 1 and 2): dark wood/steel leaf, brass handle, EXIT label
  // on the upper leaf so it still reads as an exit.
  const frame = game.levelIndex === 0 ? '#6b4a1f' : '#4a3a1a';
  const leaf = game.levelIndex === 0 ? '#1e3a2a' : '#2e3138';
  const panel = game.levelIndex === 0 ? '#16291f' : '#23262c';
  const kick = game.levelIndex === 0 ? '#3a2f1a' : '#3a3a3a';
  if (e.plane === 'E') {
    // No tall wall on the east side, only the low curb: give the door a
    // wall section to sit in, same as the Sunset Portrait.
    drawWallPicture(ctx, 'E', e.fixed + 2, e.u1 - 10, e.u2 + 10, ISO.wallH, L.wallSide, null);
  }
  drawWallPicture(ctx, e.plane, e.fixed, e.u1, e.u2, e.hgt, frame,
    (c) => paintDoorLeaf(c, leaf, panel, L.accent, kick));
  if (game.state === 'playing' || game.state === 'paused') {
    const cx = e.plane === 'N' ? (e.u1 + e.u2) / 2 : e.fixed;
    const cy = e.plane === 'N' ? e.fixed : (e.u1 + e.u2) / 2;
    const p = isoProject(cx, cy);
    ctx.fillStyle = labelColor;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.label, p.x, p.y - 0.88 * e.hgt);
  }
}

function drawThrownCoin(ctx, c) {
  const p = isoProject(c.x, c.y);
  ctx.fillStyle = '#ffd24a';
  ctx.beginPath(); ctx.arc(p.x, p.y - 4, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c9962e';
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', p.x, p.y - 1);
}

function drawSmoke(ctx, c) {
  const p = isoProject(c.x, c.y);
  ctx.fillStyle = 'rgba(200,200,210,0.30)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 6, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(220,220,230,0.22)';
  ctx.beginPath(); ctx.ellipse(p.x - 12, p.y - 12, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(p.x + 14, p.y - 10, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
}

function drawDog(ctx, d) {
  const p = isoProject(d.x, d.y);
  drawShadow(ctx, d.x, d.y, 12);
  // Low wide body (quadruped) + head at the facing end.
  const dir = isoDir(Math.cos(d.angle), Math.sin(d.angle));
  const dl = Math.hypot(dir.x, dir.y) || 1;
  const hx = p.x + (dir.x / dl) * 10, hy = p.y - 10 + (dir.y / dl) * 10;
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 8, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a6238';
  ctx.beginPath();
  ctx.arc(hx, hy - 2, 6, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.fillStyle = '#5e3d20';
  ctx.beginPath();
  ctx.moveTo(hx - 5, hy - 6); ctx.lineTo(hx - 3, hy - 11); ctx.lineTo(hx - 1, hy - 6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 1, hy - 6); ctx.lineTo(hx + 3, hy - 11); ctx.lineTo(hx + 5, hy - 6);
  ctx.closePath(); ctx.fill();
  if (d.seen) {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', p.x, p.y - 26);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.name, p.x, p.y + 14);
}

function drawFx(ctx, f) {
  const a = 1 - f.t / f.ttl;
  const p = isoProject(f.x, f.y);
  if (f.kind === 'puff') {
    ctx.fillStyle = 'rgba(210,210,220,' + (0.20 * a) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 1, 7 + f.t * 14, 3 + f.t * 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (f.kind === 'spark') {
    ctx.fillStyle = 'rgba(255,210,74,' + a + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 10 - f.t * 26, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,233,168,' + (0.8 * a) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - 5, p.y - 10 - f.t * 26); ctx.lineTo(p.x + 5, p.y - 10 - f.t * 26);
    ctx.moveTo(p.x, p.y - 15 - f.t * 26); ctx.lineTo(p.x, p.y - 5 - f.t * 26);
    ctx.stroke();
  }
}

function alarmTier(alarm) {
  return alarm > 70 ? 'HUNTED' : alarm > 35 ? 'WARY' : 'CALM';
}

function drawMinimap(ctx, game) {
  const L = game.levelDef();
  const mx = 1100, my = 556, mw = 164, mh = 84;
  const sx = mw / (BOUNDS.x1 - BOUNDS.x0), sy = mh / (BOUNDS.y1 - BOUNDS.y0);
  const px = (x) => mx + (x - BOUNDS.x0) * sx;
  const py = (y) => my + (y - BOUNDS.y0) * sy;
  ctx.fillStyle = 'rgba(5,6,10,0.72)';
  ctx.fillRect(mx - 6, my - 18, mw + 12, mh + 24);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 6, my - 18, mw + 12, mh + 24);
  ctx.fillStyle = '#9aa0b5';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAP — ' + L.name, mx - 6, my - 6);
  ctx.fillStyle = L.floor;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const w of L.walls) ctx.fillRect(px(w.x), py(w.y), Math.max(2, w.w * sx), Math.max(2, w.h * sy));
  ctx.fillStyle = '#8a6d4a';
  for (const h of (L.hides || [])) ctx.fillRect(px(h.x), py(h.y), Math.max(3, h.w * sx), Math.max(3, h.h * sy));
  ctx.fillStyle = '#50ff8c';
  ctx.fillRect(px(L.exit.x), py(L.exit.y), Math.max(3, L.exit.w * sx), Math.max(3, L.exit.h * sy));
  for (const l of game.loot) {
    if (l.taken) continue;
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(px(l.x) - 1, py(l.y) - 1, 2, 2);
  }
  if (!game.targetTaken) {
    ctx.fillStyle = '#ffd24a';
    const tx = px(L.target.x), ty = py(L.target.y);
    ctx.beginPath();
    ctx.moveTo(tx, ty - 4); ctx.lineTo(tx + 4, ty); ctx.lineTo(tx, ty + 4); ctx.lineTo(tx - 4, ty);
    ctx.closePath(); ctx.fill();
  }
  for (const g of game.guards) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.arc(px(g.x), py(g.y), 2.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const d of game.dogs) {
    ctx.fillStyle = '#ff9a2e';
    ctx.beginPath(); ctx.arc(px(d.x), py(d.y), 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(px(game.player.x), py(game.player.y), 3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function renderHud(ctx, game) {
  const L = game.levelDef();
  ctx.fillStyle = 'rgba(5,6,10,0.72)';
  ctx.fillRect(0, 0, 1280, 52);
  // Gold divider under the top bar.
  ctx.fillStyle = 'rgba(216,169,78,0.45)';
  ctx.fillRect(0, 52, 1280, 2);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(L.name, 16, 22);
  ctx.fillStyle = '#9aa0b5';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(L.sub + '  ·  ISOMETRIC 2.5D', 16, 40);
  // Alarm bar.
  const bx = 470, bw = 340, by = 16, bh = 20;
  ctx.fillStyle = '#1c1e28';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = game.alarm > 70 ? '#ff2e2e' : game.alarm > 35 ? '#ff9a2e' : '#ffd24a';
  ctx.fillRect(bx, by, bw * (game.alarm / 100), bh);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM ' + Math.round(game.alarm) + '% · ' + alarmTier(game.alarm), bx + 8, by + 14);
  // SPOTTED banner: once the alarm is in the HUNTED tier the player gets
  // one loud, flashing warning (and the red vignette) before a catch.
  // It slides down a row while the art-check countdown banner is up.
  if (game.state === 'playing' && game.alarm > 70) {
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    const btxt = '⚠ SPOTTED — BREAK LINE OF SIGHT TO DROP THE ALARM';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const bw2 = ctx.measureText(btxt).width + 32;
    const bx2 = 640 - bw2 / 2, by2 = (game.artCheckT > 0 && !game.artCheckActive) ? 92 : 60, bh2 = 26;
    ctx.fillStyle = flash ? 'rgba(180,20,20,0.92)' : 'rgba(120,10,10,0.85)';
    ctx.beginPath();
    ctx.moveTo(bx2 + 8, by2);
    ctx.arcTo(bx2 + bw2, by2, bx2 + bw2, by2 + bh2, 8);
    ctx.arcTo(bx2 + bw2, by2 + bh2, bx2, by2 + bh2, 8);
    ctx.arcTo(bx2, by2 + bh2, bx2, by2, 8);
    ctx.arcTo(bx2, by2, bx2 + bw2, by2, 8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,120,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(btxt, 640, by2 + 18);
    ctx.textAlign = 'left';
  }
  // ART CHECK banner: after the portrait is stolen, a 3-second countdown
  // warns the player that the blue guard is about to switch to the east wall.
  if (game.state === 'playing' && game.artCheckT > 0 && !game.artCheckActive) {
    const n = Math.ceil(game.artCheckT);
    const atxt = 'ART CHECK IN ' + n + 's · Reach the exit before the guard changes route';
    ctx.font = 'bold 14px system-ui, sans-serif';
    const bw3 = ctx.measureText(atxt).width + 32;
    const bx3 = 640 - bw3 / 2, by3 = 60, bh3 = 26;
    ctx.fillStyle = 'rgba(20,30,70,0.92)';
    ctx.beginPath();
    ctx.moveTo(bx3 + 8, by3);
    ctx.arcTo(bx3 + bw3, by3, bx3 + bw3, by3 + bh3, 8);
    ctx.arcTo(bx3 + bw3, by3 + bh3, bx3, by3 + bh3, 8);
    ctx.arcTo(bx3, by3 + bh3, bx3, by3, 8);
    ctx.arcTo(bx3, by3, bx3 + bw3, by3, 8);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,255,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(atxt, 640, by3 + 18);
    ctx.textAlign = 'left';
  }
  // Right side: score / loot / time.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('SCORE ' + game.score, 1264, 22);
  ctx.fillStyle = '#c8ccd8';
  ctx.font = '13px system-ui, sans-serif';
  const lootGot = game.loot.filter((l) => l.taken).length;
  ctx.fillText('LOOT $' + game.lootValue + ' (' + lootGot + '/' + game.loot.length + ')   ·   TIME ' + fmtTime(game.totalTime), 1264, 41);
  // Minimap (bottom-right, above the status line).
  drawMinimap(ctx, game);
  // Bottom-left hints.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move · Shift sneak · E crack / terminal / hide · Q coin · click: aim + toss · F smoke · P pause · M mute', 16, 700);
  // Bottom-right status.
  ctx.textAlign = 'right';
  let status = 'COINS ' + game.coins + ' · SMOKE ' + game.smokes;
  if (game.hasKeycard) status += ' · KEYCARD ✓';
  if (game.player.sneak) status += ' · SNEAK';
  if (game.hidden) status += ' · HIDDEN';
  if (game.inShadow(game.player.x, game.player.y)) status += ' · SHADOW';
  if (game.camerasOff > 0) status += ' · CAMS OFF';
  ctx.fillStyle = '#c8ccd8';
  ctx.fillText(status, 1264, 700);
  // Target reminder.
  ctx.textAlign = 'left';
  ctx.fillStyle = game.targetTaken ? '#50ff8c' : '#ffd24a';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(game.targetTaken ? '✓ ' + L.target.label + ' — reach the ' + L.exit.label : '◈ Steal: ' + L.target.label, 16, 76);
  // Contextual tutorial hint pill (bottom center, clear of the floor).
  const hint = hintFor(game);
  if (hint) {
    ctx.font = '13px system-ui, sans-serif';
    const hw = ctx.measureText(hint).width + 28;
    const hx = 640 - hw / 2, hy = 636, hh = 26, hr = 13;
    ctx.fillStyle = 'rgba(5,6,10,0.75)';
    ctx.beginPath();
    ctx.moveTo(hx + hr, hy);
    ctx.arcTo(hx + hw, hy, hx + hw, hy + hh, hr);
    ctx.arcTo(hx + hw, hy + hh, hx, hy + hh, hr);
    ctx.arcTo(hx, hy + hh, hx, hy, hr);
    ctx.arcTo(hx, hy, hx + hw, hy, hr);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(216,169,78,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(hint, 640, hy + 18);
  }
}

// The one hint that matters right now, or null.
function hintFor(game) {
  if (game.state !== 'playing') return null;
  const L = game.levelDef();
  const p = game.player;
  if (game.hidden) return 'Hidden — guards can\'t see you · move or press E to slip out';
  const td = Math.hypot(p.x - L.target.x, p.y - L.target.y);
  if (!game.targetTaken && L.target.locked && !game.hasKeycard && td < 130) return 'Locked — find the KEYCARD first';
  if (!game.targetTaken && td < 130) return 'Hold E to crack the ' + L.target.label;
  const termD = Math.hypot(p.x - L.terminal.x, p.y - L.terminal.y);
  if (game.camerasOff <= 0 && termD < 100) return 'Hold E at the terminal to black out the cameras';
  if (game.nearHide && game.nearHide()) return 'Press E to hide in the wardrobe';
  // Gallery art check: once the blue guard has switched to the east wall,
  // that is the thing that matters most.
  if (game.artCheckActive) return 'ART CHECK ACTIVE · The blue guard now patrols the east wall';
  if (game.levelIndex === 0 && game.levelTime < 6) return 'WASD to move · hold Shift to sneak';
  if (game.levelIndex === 0 && game.levelTime < 20) return 'North: camera and terminal · South: Rex and the laser · Steal the portrait on the east wall';
  if (game.levelIndex === 0 && game.levelTime < 34) return 'Cones: yellow guard · red camera · orange dog · violet sentry — amber blink means the laser is about to fire';
  return null;
}

// The caught screen names who spotted the player: the source that raised
// the alarm the most in the frame it hit 100.
function caughtReasonLine(game) {
  const s = game.lastSpotter;
  if (!s) return 'The alarm hit 100%. The guards have you.';
  if (s.kind === 'guard') return 'A roaming guard spotted you.';
  if (s.kind === 'dog') return (s.name || 'A dog') + ' spotted you.';
  if (s.kind === 'sentry') return 'A sentry spotted you.';
  if (s.kind === 'camera') return 'A security camera caught you in its sweep.';
  if (s.kind === 'laser') return 'You crossed an active laser.';
  if (s.kind === 'pounce') return (s.name || 'A dog') + ' caught up to you and lunged.';
  return 'The alarm hit 100%. The guards have you.';
}

function overlay(ctx, rgba, title, lines, accent) {
  ctx.fillStyle = rgba;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd24a';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText(title, 640, 250);
  ctx.fillStyle = '#e8eaf2';
  ctx.font = '17px system-ui, sans-serif';
  let y = 300;
  for (const ln of lines) { ctx.fillText(ln, 640, y); y += 30; }
}

function renderScreens(ctx, game) {
  if (game.state === 'title') {
    ctx.fillStyle = 'rgba(5,6,12,0.62)';
    ctx.fillRect(0, 0, 1280, 720);
    // Vault-door motif behind the title.
    ctx.save();
    ctx.strokeStyle = 'rgba(216,169,78,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(640, 255, 118, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(640 + Math.cos(a) * 34, 255 + Math.sin(a) * 34);
      ctx.lineTo(640 + Math.cos(a) * 118, 255 + Math.sin(a) * 118);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(640, 255, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24a';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('THE VELVET VAULT', 640, 250);
    ctx.fillStyle = 'rgba(216,169,78,0.7)';
    ctx.fillRect(490, 268, 300, 2);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '17px system-ui, sans-serif';
    const titleLines = [
      'a one-night heist — now in isometric 2.5D',
      '',
      'Three rooms. Three treasures. One way out.',
      'Gallery  →  Vault Hall  →  Penthouse',
      '',
      'WASD move · Shift sneak · hold E to crack · Q coin · F smoke',
      'Dodge the cones, the lasers and the dogs. Fill the alarm and you are caught.',
    ];
    let y = 310;
    for (const ln of titleLines) { ctx.fillText(ln, 640, y); y += 30; }
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#ffd24a';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText('Press ENTER to begin', 640, y + 14);
    }
  } else if (game.state === 'levelclear') {
    const L = game.levelDef();
    const next = LEVELS[game.levelIndex + 1];
    overlay(ctx, 'rgba(5,10,8,0.72)', 'ROOM CLEAR', [
      L.name + ' — ' + L.target.label + ' is yours.',
      'Loot this room: $' + game.lootValue + '   ·   Time bonus: +' + game.lastBonus,
      'Score: ' + game.score,
      '',
      next ? 'Next: ' + next.name + ' — ' + next.sub : 'That was the last room.',
      'Press ENTER for the next room',
    ], '#50ff8c');
  } else if (game.state === 'caught') {
    ctx.fillStyle = 'rgba(20,4,4,0.78)';
    ctx.fillRect(0, 0, 1280, 720);
    // Expanding alarm rings.
    const now = performance.now() / 1000;
    for (let i = 0; i < 3; i++) {
      const ph = (now * 0.6 + i / 3) % 1;
      ctx.strokeStyle = 'rgba(255,70,70,' + (0.45 * (1 - ph)) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(640, 360, 60 + ph * 260, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('CAUGHT!', 640, 250);
    ctx.fillStyle = '#e8eaf2';
    ctx.font = '17px system-ui, sans-serif';
    const caughtLines = [
      caughtReasonLine(game),
      'Score returns to ' + game.levelStartScore + ' for this room.',
      '',
      'Tip: smoke (F) blinds every watcher — crack the target inside it.',
      '',
      'Press R to retry this room',
    ];
    let y = 300;
    for (const ln of caughtLines) { ctx.fillText(ln, 640, y); y += 30; }
  } else if (game.state === 'victory') {
    const rating = game.maxAlarm < 30 ? 'GHOST — never seen'
      : game.maxAlarm < 70 ? 'CLEAN — spotted, never cornered'
      : 'LOUD — the whole house woke up';
    const totalLoot = game.totalLoot || game.lootValue;
    overlay(ctx, 'rgba(8,8,4,0.80)', 'THE VAULT IS YOURS', [
      '✓ Sunset Portrait  ·  ✓ Velvet Diamond  ·  ✓ The Crown',
      'Total score: ' + game.score + '   ·   Loot: $' + totalLoot + '   ·   Time: ' + fmtTime(game.totalTime),
      'Heist rating: ' + rating + '  (peak alarm ' + Math.round(game.maxAlarm) + '%)',
      '',
      'Press ENTER to play again',
    ]);
  } else if (game.state === 'paused') {
    overlay(ctx, 'rgba(5,6,12,0.6)', 'PAUSED', ['Press P to resume'], '#e8eaf2');
  }
}
