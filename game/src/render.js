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

function drawShadow(ctx, x, y, rx) {
  const p = isoProject(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, rx, rx * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCone(ctx, wx, wy, facing, range, fov, alerted) {
  const steps = 14;
  const p0 = isoProject(wx, wy);
  ctx.fillStyle = alerted ? 'rgba(255,60,60,0.16)' : 'rgba(255,214,90,0.10)';
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = 0; i <= steps; i++) {
    const a = facing - fov / 2 + (fov * i) / steps;
    const pt = isoProject(wx + Math.cos(a) * range, wy + Math.sin(a) * range);
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = alerted ? 'rgba(255,80,80,0.35)' : 'rgba(255,214,90,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
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

  // Exit zone.
  const e = L.exit;
  {
    const a = isoProject(e.x, e.y), b = isoProject(e.x + e.w, e.y);
    const c = isoProject(e.x + e.w, e.y + e.h), d = isoProject(e.x, e.y + e.h);
    ctx.fillStyle = game.targetTaken ? 'rgba(80,255,140,0.30)' : 'rgba(80,255,140,0.10)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = game.targetTaken ? '#50ff8c' : 'rgba(80,255,140,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const mid = isoProject(e.x + e.w / 2, e.y + e.h / 2);
    ctx.fillStyle = '#b8ffcf';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.label, mid.x, mid.y - 6);
  }

  // Lasers.
  for (const l of L.lasers) {
    const on = game.laserOn(l);
    const p1 = l.axis === 'h' ? isoProject(l.from, l.at) : isoProject(l.at, l.from);
    const p2 = l.axis === 'h' ? isoProject(l.to, l.at) : isoProject(l.at, l.to);
    ctx.save();
    if (on) {
      ctx.strokeStyle = '#ff2e2e';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ff2e2e';
      ctx.shadowBlur = 12;
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
    const lab = l.axis === 'h'
      ? { x: isoProject(l.to, l.at).x + 30, y: isoProject(l.to, l.at).y - 22 }
      : { x: isoProject(l.at, l.to).x - 64, y: isoProject(l.at, l.to).y - 10 };
    const ltxt = on ? 'LASER' : 'laser off';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(ltxt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(lab.x - tw / 2 - 5, lab.y - 11, tw + 10, 15);
    ctx.fillStyle = on ? '#ff6b6b' : 'rgba(200,200,200,0.7)';
    ctx.fillText(ltxt, lab.x, lab.y);
  }

  // Vision cones (floor level, before characters).
  for (const g of game.guards) drawCone(ctx, g.x, g.y, g.angle, TUNE.guardVision, TUNE.guardFov, g.seen);
  for (const d of game.dogs) drawCone(ctx, d.x, d.y, d.angle, TUNE.dogVision, TUNE.dogFov, d.seen);
  for (const s of game.sentries) drawCone(ctx, s.x, s.y, s.angle, TUNE.sentryVision, TUNE.sentryFov, s.seen);
  if (game.camerasOff <= 0) {
    for (const cam of game.cameras) drawCone(ctx, cam.x, cam.y, cam.angle, TUNE.cameraVision, TUNE.cameraFov, cam.seen);
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
    items.push({ depth: pr.x + pr.w / 2 + pr.y + pr.d / 2, draw: () => drawProp(ctx, pr) });
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
  items.push({ depth: game.player.x + game.player.y, draw: () => drawFigure(ctx, game.player.x, game.player.y, {
    body: '#15151d', shirt: '#f2f2f2', facing: game.player.facing, height: 27,
    mark: null,
  }) });
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
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
  if (L.target.locked && !game.hasKeycard && !game.targetTaken) {
    const tp = isoProject(L.target.x, L.target.y);
    ctx.fillStyle = '#ff9a9a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED — FIND KEYCARD', tp.x, tp.y - 64);
  }
  if (game.termProgress > 0) {
    const tp = isoProject(L.terminal.x, L.terminal.y);
    ctx.fillStyle = '#9ad1ff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DISABLING ' + Math.round(game.termProgress * 100) + '%', tp.x, tp.y - 40);
  }

  renderHud(ctx, game);
  renderScreens(ctx, game);
}

function drawProp(ctx, pr) {
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
    // Standing frame on the north wall.
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, '#e8c268', shade('#e8c268', 0.7), shade('#e8c268', 0.55));
    const p = isoProject(pr.x + pr.w / 2, pr.y);
    ctx.fillStyle = pr.color;
    ctx.fillRect(p.x - pr.w * 0.28, p.y - pr.h + 8, pr.w * 0.56, pr.h - 16);
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
    drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
    drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, '#e8c53a', shade('#e8c53a', 0.7), shade('#e8c53a', 0.5));
    return;
  }
  // Contact shadow grounds every box prop.
  drawShadow(ctx, pr.x + pr.w / 2, pr.y + pr.d / 2, (pr.w + pr.d) * 0.28);
  drawIsoBox(ctx, pr.x, pr.y, pr.w, pr.d, pr.h, top, left, right);
  // Glass glint on display cases / safes.
  if (pr.kind === 'case' || pr.kind === 'safe') {
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - pr.h / 2, pr.w * 0.2, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pr.kind === 'vaultdoor') {
    const p = isoProject(pr.x + pr.w / 2, pr.y + pr.d);
    ctx.strokeStyle = '#2c2f33';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y - pr.h / 2, 12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#2c2f33';
    ctx.beginPath(); ctx.arc(p.x, p.y - pr.h / 2, 4, 0, Math.PI * 2); ctx.fill();
  }
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
    drawIsoBox(ctx, t.x - 40, t.y - 6, 80, 12, 56, '#e8c268', shade('#e8c268', 0.7), shade('#e8c268', 0.55));
    const q = isoProject(t.x, t.y);
    // Sunset painting inside the frame.
    ctx.fillStyle = '#e8722e';
    ctx.fillRect(q.x - 26, q.y - 52, 52, 40);
    ctx.fillStyle = '#f2a541';
    ctx.fillRect(q.x - 26, q.y - 30, 52, 18);
    ctx.fillStyle = '#7a2f56';
    ctx.fillRect(q.x - 26, q.y - 14, 52, 4);
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(q.x, q.y - 34, 7, 0, Math.PI * 2); ctx.fill();
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
    ctx.fillStyle = '#bfefff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VELVET DIAMOND', p.x, p.y - 62);
  } else {
    drawIsoBox(ctx, t.x - 34, t.y - 22, 68, 44, 26, '#6b4a2f', shade('#6b4a2f', 0.7), shade('#6b4a2f', 0.5));
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

function drawTerminal(ctx, game) {
  const L = game.levelDef();
  const p = isoProject(L.terminal.x, L.terminal.y);
  drawIsoBox(ctx, L.terminal.x - 16, L.terminal.y - 10, 32, 20, 22, '#3a5a7a', shade('#3a5a7a', 0.7), shade('#3a5a7a', 0.5));
  ctx.fillStyle = game.camerasOff > 0 ? '#50ff8c' : '#9ad1ff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(game.camerasOff > 0 ? 'CAMERAS OFF ' + Math.ceil(game.camerasOff) + 's' : 'TERMINAL — hold E', p.x, p.y - 32);
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
  ctx.fillText('WASD move · Shift sneak · E hold: crack / terminal · Q coin · F smoke · P pause · M mute', 16, 700);
  // Bottom-right status.
  ctx.textAlign = 'right';
  let status = 'COINS ' + game.coins + ' · SMOKE ' + game.smokes;
  if (game.hasKeycard) status += ' · KEYCARD ✓';
  if (game.player.sneak) status += ' · SNEAK';
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
  const td = Math.hypot(p.x - L.target.x, p.y - L.target.y);
  if (!game.targetTaken && td < 130) return 'Hold E to crack the ' + L.target.label;
  const termD = Math.hypot(p.x - L.terminal.x, p.y - L.terminal.y);
  if (game.camerasOff <= 0 && termD < 100) return 'Hold E at the terminal to black out the cameras';
  if (game.levelIndex === 0 && game.levelTime < 6) return 'WASD to move · hold Shift to sneak';
  if (game.levelIndex === 0 && game.levelTime < 20) return 'Stay out of the yellow cones — shadows cut the alarm';
  return null;
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
      'The alarm hit 100%. The guards have you.',
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
