// Game logic for THE VELVET VAULT 2.5D. Top-down mechanics, isometric rendering.
// Written from scratch. Update order: move -> watchers -> sense+alarm -> agents -> pickup -> crack -> exit.

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

// Segment (x1,y1)-(x2,y2) vs rect. True if the segment touches the rect.
function segHitsRect(x1, y1, x2, y2, r) {
  if (x1 >= r.x && x1 <= r.x + r.w && y1 >= r.y && y1 <= r.y + r.h) return true;
  if (x2 >= r.x && x2 <= r.x + r.w && y2 >= r.y && y2 <= r.y + r.h) return true;
  const edges = [
    [r.x, r.y, r.x + r.w, r.y], [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h], [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const e of edges) {
    if (segsCross(x1, y1, x2, y2, e[0], e[1], e[2], e[3])) return true;
  }
  return false;
}
function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
// Distance from point (px,py) to segment (x1,y1)-(x2,y2).
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}

// Gallery art check (room 0 only): after the Sunset Portrait is stolen,
// the blue guard switches to this east-wall route and patrols it. The line
// runs on open floor — it crosses no wall and no laser.
const ART_CHECK_WP = [[1000, 160], [1130, 140], [1160, 245], [1120, 345], [1000, 320]];

class Game {
  constructor() {
    this.state = 'title'; // title | playing | levelclear | caught | victory | paused
    this.prevState = 'playing';
    this.levelIndex = 0;
    this.score = 0;
    this.totalTime = 0;
    this.totalLoot = 0;
    this.maxAlarm = 0;
    this.levelStartScore = 0;
    this.muted = false;
    this.loadLevel(0);
  }

  levelDef() { return LEVELS[this.levelIndex]; }

  loadLevel(i) {
    this.levelIndex = i;
    const L = LEVELS[i];
    this.levelTime = 0;
    this.alarm = 0;
    this.levelStartScore = this.score;
    this.player = { x: L.playerStart.x, y: L.playerStart.y, r: TUNE.playerRadius, facing: -Math.PI / 2, sneak: false, moving: false };
    this.targetTaken = false;
    this.crack = 0;
    this.termProgress = 0;
    this.hasKeycard = false;
    this.coins = TUNE.coins;
    this.smokes = TUNE.smokes;
    this.camerasOff = 0;
    this.hidden = false;
    this.door = { open: 0, target: 0, busy: false, phase: null }; // wardrobe door: 0 shut .. 1 open
    this.loot = L.loot.map((l) => ({ ...l, taken: false }));
    this.lootValue = 0;
    this.keycardTaken = !L.keycard;
    this.thrownCoins = [];
    this.smokeClouds = [];
    this.guards = L.guards.map((g, i) => ({
      wp: g.wp, wpi: 0, x: g.wp[0][0], y: g.wp[0][1],
      angle: 0, state: 'patrol', target: null, scanT: 0, lookT: 0, seen: false, hearCd: 0,
      speed: g.speed || 1, fov: g.fov || TUNE.guardFov,
      uniform: i === 0 ? '#2c4a7a' : '#2a5a4a',
      stuckT: 0, stuckX: g.wp[0][0], stuckY: g.wp[0][1], detour: null,
    }));
    this.dogs = L.dogs.map((d) => ({
      x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, name: d.name,
      x: d.x1, y: d.y1, dir: 1, angle: 0, state: 'patrol',
      target: null, scanT: 0, lostT: 0, pounceCd: 0, seen: false,
      stuckT: 0, stuckX: d.x1, stuckY: d.y1, detour: null,
    }));
    this.sentries = L.sentries.map((s) => ({ ...s, angle: s.base, seen: false }));
    this.cameras = L.cameras.map((c) => ({ ...c, angle: Math.PI / 2, seen: false }));
    this.deniedCd = 0;
    this.tickCd = 0;
    this.lastBonus = 0;
    this.fx = []; // transient visual effects only (footstep puffs, pickup sparkles)
    this.stepT = 0;
    // Gallery art check (room 0 only): 0 = not started, >0 = seconds left
    // on the countdown, active = the blue guard has switched routes.
    this.artCheckT = 0;
    this.artCheckActive = false;
    // Who spotted the player last: { kind, name? }. Set whenever a source
    // raises the alarm; the caught screen names it. frameTop* track the
    // biggest single raise in the current frame.
    this.lastSpotter = null;
    this.frameTop = null;
    this.frameTopAmt = 0;
  }

  // Rects that block movement and sight: interior walls + solid props.
  blockers() {
    const L = this.levelDef();
    const out = [];
    for (const w of L.walls) out.push({ x: w.x, y: w.y, w: w.w, h: w.h });
    for (const p of L.props) if (p.solid) out.push({ x: p.x, y: p.y, w: p.w, h: p.d });
    return out;
  }

  losBlocked(x1, y1, x2, y2) {
    for (const r of this.blockers()) if (segHitsRect(x1, y1, x2, y2, r)) return true;
    return false;
  }

  inShadow(x, y) {
    for (const s of this.levelDef().shadows) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
    return false;
  }

  inSmoke(x, y) {
    for (const c of this.smokeClouds) if (dist(x, y, c.x, c.y) < 150) return true;
    return false;
  }

  // The wardrobe for the current level: its prop (the drawn box), its hide
  // def, and the door on the room-facing (south) side. One per level.
  // inX/inY is where the player stands while hidden; outX/outY is the step-out
  // spot just outside the door (clear of the solid box).
  wardrobe() {
    const L = this.levelDef();
    const pr = L.props.find((p) => p.kind === 'wardrobe');
    const h = (L.hides || [])[0];
    if (!pr || !h) return null;
    const doorX = pr.x + pr.w / 2, doorY = pr.y + pr.d;
    return {
      pr, h, doorX, doorY,
      inX: doorX, inY: pr.y + pr.d / 2,
      outX: doorX, outY: doorY + TUNE.playerRadius + 6,
    };
  }

  // The wardrobe hide spot, but only from the door side: stand just outside
  // the door on the room-facing (south) face and press E. The other three
  // sides are solid wood — no entry from there. While hidden, the player is
  // inside, so the same spot still counts (for the HIDDEN tag).
  nearHide() {
    const w = this.wardrobe();
    if (!w) return null;
    if (this.hidden) return w.h;
    const p = this.player;
    if (Math.abs(p.x - w.doorX) <= 48 && p.y > w.doorY - 2 && p.y < w.doorY + 60) return w.h;
    return null;
  }

  laserOn(l) { return (this.levelTime % l.period) < l.on; }

  // Raise the alarm and remember which source raised it the most this
  // frame, so the caught screen can name who spotted the player. `source`
  // is { kind: 'guard'|'dog'|'sentry'|'camera'|'laser'|'pounce', name? }.
  raiseAlarm(amount, source) {
    this.alarm = clamp(this.alarm + amount, 0, 100);
    if (amount > this.frameTopAmt) {
      this.frameTopAmt = amount;
      this.frameTop = source;
      this.lastSpotter = source;
    }
  }

  moveCircle(ent, dx, dy, r) {
    const blocks = this.blockers();
    const hit = (x, y) => {
      if (x < BOUNDS.x0 + r || x > BOUNDS.x1 - r || y < BOUNDS.y0 + r || y > BOUNDS.y1 - r) return true;
      for (const b of blocks) {
        const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
        if (dist(x, y, cx, cy) < r) return true;
      }
      return false;
    };
    const ox = ent.x, oy = ent.y;
    if (!hit(ent.x + dx, ent.y)) ent.x += dx;
    if (!hit(ent.x, ent.y + dy)) ent.y += dy;
    if (ent.x !== ox || ent.y !== oy) return; // moved: done.
    if (dx === 0 && dy === 0) return;
    // Wedged: neither axis moved. Try the diagonal step first — it threads
    // around a convex corner where both axis steps are still inside the
    // corner's radius — then the two diagonals next to the wanted direction.
    const step = Math.hypot(dx, dy);
    const ux = dx / step, uy = dy / step;
    const diagDirs = [[ux, uy], [ux * 0.7071 - uy * 0.7071, ux * 0.7071 + uy * 0.7071], [ux * 0.7071 + uy * 0.7071, -ux * 0.7071 + uy * 0.7071]];
    for (const [gx, gy] of diagDirs) {
      if (!hit(ox + gx * step, oy + gy * step)) { ent.x = ox + gx * step; ent.y = oy + gy * step; return; }
    }
    // Still wedged and overlapping a blocker (an illegal spot, e.g. after a
    // teleport): push out along the smallest penetration so the entity can
    // never be pinned inside a corner pocket. Only the smallest push is
    // tried, and only if the landing spot is legal.
    let best = null;
    for (const b of blocks) {
      const cx = clamp(ox, b.x, b.x + b.w), cy = clamp(oy, b.y, b.y + b.h);
      const ddx = ox - cx, ddy = oy - cy;
      const d = Math.hypot(ddx, ddy);
      if (d >= r) continue; // not overlapping this one.
      let px, py, pen;
      if (d > 0.001) {
        pen = r - d + 0.5;
        px = ox + (ddx / d) * pen; py = oy + (ddy / d) * pen;
      } else {
        // Centre inside the rect: leave through the nearest face.
        const l = ox - b.x, rr = b.x + b.w - ox, t = oy - b.y, bo = b.y + b.h - oy;
        const m = Math.min(l, rr, t, bo);
        pen = m + r + 0.5;
        if (m === l) { px = ox - pen; py = oy; }
        else if (m === rr) { px = ox + pen; py = oy; }
        else if (m === t) { px = ox; py = oy - pen; }
        else { px = ox; py = oy + pen; }
      }
      if (!best || pen < best.pen) best = { px, py, pen };
    }
    if (best && !hit(best.px, best.py)) { ent.x = best.px; ent.y = best.py; }
  }

  update(dt) {
    if (Keys.hit('KeyM')) { this.muted = AudioSys.toggleMute(); }
    if (this.state === 'title') {
      if (Keys.hit('Enter')) { AudioSys.ensure(); this.score = 0; this.totalTime = 0; this.totalLoot = 0; this.maxAlarm = 0; this.loadLevel(0); this.state = 'playing'; }
      return;
    }
    if (this.state === 'levelclear') {
      if (Keys.hit('Enter')) {
        if (this.levelIndex + 1 >= LEVELS.length) { this.state = 'victory'; }
        else { this.loadLevel(this.levelIndex + 1); this.state = 'playing'; }
      }
      return;
    }
    if (this.state === 'caught') {
      if (Keys.hit('KeyR')) { this.score = this.levelStartScore; this.loadLevel(this.levelIndex); this.state = 'playing'; }
      return;
    }
    if (this.state === 'victory') {
      if (Keys.hit('Enter')) { this.score = 0; this.totalTime = 0; this.totalLoot = 0; this.maxAlarm = 0; this.loadLevel(0); this.state = 'playing'; }
      return;
    }
    if (this.state === 'paused') {
      if (Keys.hit('KeyP') || Keys.hit('Escape')) this.state = 'playing';
      return;
    }
    // playing
    if (Keys.hit('KeyP') || Keys.hit('Escape')) { this.state = 'paused'; return; }
    this.updatePlaying(dt);
  }

  updatePlaying(dt) {
    const L = this.levelDef();
    this.levelTime += dt;
    this.totalTime += dt;
    if (this.deniedCd > 0) this.deniedCd -= dt;
    if (this.tickCd > 0) this.tickCd -= dt;
    if (this.camerasOff > 0) this.camerasOff -= dt;
    for (const c of this.smokeClouds) c.t -= dt;
    this.smokeClouds = this.smokeClouds.filter((c) => c.t > 0);

    // --- 0. gallery art check (room 0 only) ---
    // Stealing the portrait starts a 3-second countdown. When it runs out,
    // the blue guard (guards[0]) switches to the east-wall route and patrols
    // it like any other route — whichever state it is in now, the new route
    // applies as soon as it patrols or returns.
    if (this.artCheckT > 0) {
      this.artCheckT -= dt;
      if (this.artCheckT <= 0) {
        this.artCheckT = 0;
        this.artCheckActive = true;
        const g = this.guards[0];
        if (g) {
          g.wp = ART_CHECK_WP;
          let best = 0, bestD = 1e9;
          for (let i = 0; i < g.wp.length; i++) {
            const dd = dist(g.x, g.y, g.wp[i][0], g.wp[i][1]);
            if (dd < bestD) { bestD = dd; best = i; }
          }
          g.wpi = best;
        }
      }
    }

    // --- 1. player movement ---
    let ax = Keys.axis();
    let sneak = Keys.sneak();
    // Wardrobe door: it swings toward its target; an entry/exit finishes when
    // it is fully open (the player steps through), then it swings shut behind.
    // While the door is moving the player stands still. Only the door on the
    // room-facing side lets you in or out — the wardrobe itself is solid.
    const w = this.wardrobe();
    if (w && this.door.busy) {
      if (this.door.open !== this.door.target) {
        this.door.open = clamp(this.door.open + (this.door.target === 1 ? dt / 0.35 : -dt / 0.35), 0, 1);
      }
      if (this.door.phase === 'enter' && this.door.open >= 1) {
        this.player.x = w.inX; this.player.y = w.inY;
        this.hidden = true;
        AudioSys.smoke();
        this.door.phase = 'closing'; this.door.target = 0;
      } else if (this.door.phase === 'exit' && this.door.open >= 1) {
        this.player.x = w.outX; this.player.y = w.outY;
        this.hidden = false;
        this.door.phase = 'closing'; this.door.target = 0;
      } else if (this.door.phase === 'closing' && this.door.open <= 0) {
        this.door.phase = null; this.door.busy = false;
      }
      ax = { x: 0, y: 0 }; sneak = false;
    } else if (this.hidden) {
      if (Keys.hit('KeyE') || ax.x !== 0 || ax.y !== 0) {
        this.door.busy = true; this.door.phase = 'exit'; this.door.target = 1;
        ax = { x: 0, y: 0 }; sneak = false;
      } else { ax = { x: 0, y: 0 }; sneak = false; }
    } else if (Keys.hit('KeyE') && this.nearHide()) {
      this.door.busy = true; this.door.phase = 'enter'; this.door.target = 1;
      ax = { x: 0, y: 0 }; sneak = false;
    }
    const speed = sneak ? TUNE.playerSneak : TUNE.playerWalk;
    this.player.sneak = sneak;
    this.player.moving = (ax.x !== 0 || ax.y !== 0);
    if (this.player.moving) this.player.facing = Math.atan2(ax.y, ax.x);
    this.moveCircle(this.player, ax.x * speed * dt, ax.y * speed * dt, this.player.r);
    // Footstep puffs (visual only) + effect decay.
    if (this.player.moving) {
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.14;
        this.fx.push({ kind: 'puff', x: this.player.x, y: this.player.y, t: 0, ttl: 0.5 });
      }
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < f.ttl);

    // --- 2. watcher angles (cameras + sentries sweep) ---
    for (const cam of this.cameras) cam.angle = Math.PI / 2 + Math.sin(this.levelTime * 0.7) * 0.5;
    for (const s of this.sentries) s.angle = s.base + Math.sin(this.levelTime * 0.9) * s.sweep;

    // --- 3. sense + alarm (lasers included) ---
    let anySeen = false;
    const p = this.player;
    this.frameTopAmt = 0; this.frameTop = null; // fresh frame: who raises the alarm most.
    const shadowed = this.inShadow(p.x, p.y);
    const smoked = this.inSmoke(p.x, p.y);
    const senseFactor = (watcher, d, range, isCamera) => {
      let f = 1 + (1 - d / range) * 0.5;
      if (sneak) f *= 0.55;
      if (shadowed) f *= 0.25;
      if (isCamera) f *= 1.25;
      return f;
    };
    const sees = (wx, wy, facing, range, fov) => {
      if (this.hidden) return false;
      if (smoked) return false;
      const d = dist(wx, wy, p.x, p.y);
      if (d > range) return false;
      if (angleDiff(facing, angleTo(wx, wy, p.x, p.y)) > fov / 2) return false;
      if (this.losBlocked(wx, wy, p.x, p.y)) return false;
      return true;
    };

    for (const g of this.guards) {
      const d = dist(g.x, g.y, p.x, p.y);
      g.seen = sees(g.x, g.y, g.angle, TUNE.guardVision, g.fov);
      if (g.seen) {
        anySeen = true;
        this.raiseAlarm(TUNE.alarmRate * senseFactor(g, d, TUNE.guardVision, false) * dt, { kind: 'guard' });
        g.target = { x: p.x, y: p.y };
        if (g.state === 'patrol' || g.state === 'investigate' || g.state === 'return') g.state = 'search';
      }
    }
    for (const d of this.dogs) {
      const dd = dist(d.x, d.y, p.x, p.y);
      d.seen = sees(d.x, d.y, d.angle, TUNE.dogVision, TUNE.dogFov);
      if (d.seen) {
        anySeen = true;
        this.raiseAlarm(TUNE.alarmRate * senseFactor(d, dd, TUNE.dogVision, false) * dt, { kind: 'dog', name: d.name });
        d.target = { x: p.x, y: p.y };
        d.lostT = 0;
        if (d.state === 'patrol' || d.state === 'return') d.state = 'chase';
      }
    }
    for (const s of this.sentries) {
      const d = dist(s.x, s.y, p.x, p.y);
      s.seen = sees(s.x, s.y, s.angle, TUNE.sentryVision, TUNE.sentryFov);
      if (s.seen) {
        anySeen = true;
        this.raiseAlarm(TUNE.alarmRate * senseFactor(s, d, TUNE.sentryVision, false) * dt, { kind: 'sentry' });
        // Call the nearest patrolling guard to search the last-seen spot.
        let best = null, bestD = 1e9;
        for (const g of this.guards) {
          if (g.state !== 'patrol' && g.state !== 'investigate') continue;
          const gd = dist(g.x, g.y, p.x, p.y);
          if (gd < bestD) { bestD = gd; best = g; }
        }
        if (best) { best.state = 'search'; best.target = { x: p.x, y: p.y }; }
      }
    }
    if (this.camerasOff <= 0) {
      for (const cam of this.cameras) {
        const d = dist(cam.x, cam.y, p.x, p.y);
        cam.seen = sees(cam.x, cam.y, cam.angle, TUNE.cameraVision, TUNE.cameraFov);
        if (cam.seen) {
          anySeen = true;
          this.raiseAlarm(TUNE.alarmRate * senseFactor(cam, d, TUNE.cameraVision, true) * dt, { kind: 'camera' });
        }
      }
    } else {
      for (const cam of this.cameras) cam.seen = false;
    }
    // Lasers.
    let laserHit = false;
    for (const l of L.lasers) {
      if (!this.laserOn(l)) continue;
      const dd = l.axis === 'h'
        ? distToSeg(p.x, p.y, l.from, l.at, l.to, l.at)
        : distToSeg(p.x, p.y, l.at, l.from, l.at, l.to);
      if (dd < 10) laserHit = true;
    }
    if (laserHit) { this.raiseAlarm(TUNE.laserRate * dt, { kind: 'laser' }); anySeen = true; }
    if (!anySeen) this.alarm = Math.max(0, this.alarm - TUNE.alarmDecay * (this.hidden ? 2 : 1) * dt);
    this.alarm = clamp(this.alarm, 0, 100);
    this.maxAlarm = Math.max(this.maxAlarm, this.alarm);
    AudioSys.setAlarmLevel(this.alarm / 100);

    if (this.alarm >= 100) {
      AudioSys.stopAlarm();
      AudioSys.caught();
      this.state = 'caught';
      return;
    }

    // --- 4. guards and dogs move ---
    for (const g of this.guards) this.updateGuard(g, dt);
    for (const d of this.dogs) this.updateDog(d, dt);

    // Hearing: running nearby draws guards and dogs.
    if (this.player.moving && !sneak) {
      for (const g of this.guards) {
        if (g.hearCd > 0) { g.hearCd -= dt; continue; }
        if (g.state === 'patrol' && dist(g.x, g.y, p.x, p.y) < TUNE.guardHearing) {
          g.state = 'investigate'; g.target = { x: p.x, y: p.y }; g.hearCd = 3;
        }
      }
      for (const d of this.dogs) {
        if (d.state === 'patrol' && dist(d.x, d.y, p.x, p.y) < TUNE.dogHearing) {
          d.state = 'chase'; d.target = { x: p.x, y: p.y }; d.lostT = 0;
        }
      }
    }

    // --- 5. pickups (loot, keycard) ---
    for (const l of this.loot) {
      if (!l.taken && dist(p.x, p.y, l.x, l.y) < 26) {
        l.taken = true;
        this.score += LOOT_VALUE[l.kind];
        this.lootValue += LOOT_VALUE[l.kind];
        AudioSys.pickup();
        for (let i = 0; i < 4; i++) {
          this.fx.push({ kind: 'spark', x: l.x + (i - 1.5) * 9, y: l.y - 6, t: i * 0.05, ttl: 0.6 });
        }
      }
    }
    if (L.keycard && !this.keycardTaken && dist(p.x, p.y, L.keycard.x, L.keycard.y) < 26) {
      this.keycardTaken = true;
      this.hasKeycard = true;
      AudioSys.keycard();
    }

    // --- 6. crack the big target / camera terminal ---
    const t = L.target;
    const td = dist(p.x, p.y, t.x, t.y);
    if (!this.targetTaken && td <= t.reach) {
      if (t.locked && !this.hasKeycard) {
        if (Keys.down('KeyE') && this.deniedCd <= 0) { AudioSys.denied(); this.deniedCd = 1; }
      } else if (Keys.down('KeyE')) {
        this.crack += dt / t.seconds;
        if (this.tickCd <= 0) { AudioSys.tick(); this.tickCd = 0.2; }
        if (this.crack >= 1) {
          this.targetTaken = true;
          this.score += t.points;
          AudioSys.crackDone();
          // Gallery only: stealing the portrait starts the 3-second art
          // check. When it runs out, the blue guard switches to the
          // east-wall route.
          if (this.levelIndex === 0 && this.artCheckT <= 0 && !this.artCheckActive) {
            this.artCheckT = 3;
          }
        }
      } else {
        this.crack = Math.max(0, this.crack - dt * 0.5);
      }
    } else {
      this.crack = Math.max(0, this.crack - dt * 0.5);
    }
    const termD = dist(p.x, p.y, L.terminal.x, L.terminal.y);
    if (this.camerasOff <= 0 && termD < 55 && Keys.down('KeyE')) {
      this.termProgress += dt / 1.0;
      if (this.termProgress >= 1) {
        this.camerasOff = TUNE.cameraOffTime;
        this.termProgress = 0;
        AudioSys.keycard();
      }
    } else {
      this.termProgress = Math.max(0, this.termProgress - dt * 0.5);
    }

    // --- 7. throwables ---
    if (Keys.hit('KeyQ') && this.coins > 0) {
      this.coins--;
      const lx = clamp(p.x + Math.cos(p.facing) * 130, BOUNDS.x0 + 10, BOUNDS.x1 - 10);
      const ly = clamp(p.y + Math.sin(p.facing) * 130, BOUNDS.y0 + 10, BOUNDS.y1 - 10);
      this.thrownCoins.push({ x: lx, y: ly });
      AudioSys.coin();
      for (const g of this.guards) {
        if (g.state === 'patrol' && dist(g.x, g.y, lx, ly) < 300) { g.state = 'investigate'; g.target = { x: lx, y: ly }; }
      }
      for (const d of this.dogs) {
        if (d.state === 'patrol' && dist(d.x, d.y, lx, ly) < 300) { d.state = 'chase'; d.target = { x: lx, y: ly }; d.lostT = 0; }
      }
    }
    if (Keys.hit('KeyF') && this.smokes > 0) {
      this.smokes--;
      this.smokeClouds.push({ x: p.x, y: p.y, t: TUNE.smokeTime });
      AudioSys.smoke();
    }

    // --- 8. exit ---
    const e = L.exit;
    if (this.targetTaken && p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h) {
      this.totalLoot = (this.totalLoot || 0) + this.lootValue;
      this.lastBonus = Math.max(0, 300 - Math.floor(this.levelTime));
      this.score += this.lastBonus;
      AudioSys.stopAlarm();
      if (this.levelIndex + 1 >= LEVELS.length) {
        this.state = 'victory';
        AudioSys.win();
      } else {
        this.state = 'levelclear';
        AudioSys.levelClear();
      }
    }
  }

  moveToward(ent, tx, ty, speed, dt) {
    // A stored detour (around a wall corner) takes priority over the real
    // target until the entity reaches it or the direct way clears.
    // "Arrived" only ever counts against the REAL target, never the detour.
    const realTx = tx, realTy = ty;
    let following = false;
    if (ent.detour) {
      if (dist(ent.x, ent.y, ent.detour.x, ent.detour.y) < 8 || this.directClear(ent, realTx, realTy)) {
        ent.detour = null;
      } else {
        tx = ent.detour.x; ty = ent.detour.y; following = true;
      }
    }
    const d = dist(ent.x, ent.y, tx, ty);
    if (d < 2) return !following;
    const step = speed * dt;
    const base = Math.atan2(ty - ent.y, tx - ent.x);
    const ux = Math.cos(base), uy = Math.sin(base);
    const ox = ent.x, oy = ent.y;
    this.moveCircle(ent, ux * step, uy * step, 12);
    // Progress along the intended direction. If the direct step makes less
    // than half the step's progress toward the target, the entity is
    // effectively blocked: it is only creeping along the wall face on the
    // free axis, which is what made the dog slide up and down a wall edge
    // forever (the creep is just over the old 0.1 threshold, so no steering
    // ever kicked in). Route around the blocking wall's best corner: the
    // detour is a fixed point, so the entity walks steadily to it instead
    // of oscillating as the base angle rotates. Side-steps are only the
    // fallback when no detour can be found.
    const moved = (ent.x - ox) * ux + (ent.y - oy) * uy;
    if (moved < step * 0.5) {
      let justSet = false;
      if (!ent.detour) {
        ent.detour = this.cornerDetour(ent, tx, ty);
        justSet = !!ent.detour;
      }
      if (!justSet) {
        // Either no detour could be found, or we are following one and its
        // way is blocked: slide around with side-steps. Try all four
        // angled directions and keep the one that makes the most headway
        // toward the target — the first direction that merely moves can
        // point the wrong way (at a corner it walks back along the wall
        // and cancels the direct step's slide, so the entity trembles in
        // place). A sidestep that goes backwards, or only a hair's width,
        // is never taken.
        let bestA = null, bestProg = step * 0.1, bestX = ent.x, bestY = ent.y;
        for (const off of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
          const a = base + off;
          const px = ent.x, py = ent.y;
          this.moveCircle(ent, Math.cos(a) * step, Math.sin(a) * step, 12);
          const prog = (ent.x - px) * ux + (ent.y - py) * uy;
          if (prog > bestProg) { bestProg = prog; bestA = a; bestX = ent.x; bestY = ent.y; }
          ent.x = px; ent.y = py; // restore; only the best one is kept.
        }
        if (bestA !== null) { ent.x = bestX; ent.y = bestY; ent.angle = bestA; }
        else if (dist(ent.x, ent.y, ox, oy) < 0.01) ent.angle = base;
      }
    } else {
      ent.angle = base;
    }
    return !following && dist(ent.x, ent.y, realTx, realTy) < 10;
  }

  // Is the straight line from the entity to (tx,ty) free of blockers?
  // Used to drop a detour as soon as the direct way opens up again.
  // The direct way is only clear if the whole circle fits: the centreline
  // is tested against each blocker grown by the entity radius. Without
  // the margin the centreline can graze a wall corner while the circle is
  // still wedged in it, so the detour is dropped a frame too early and
  // the entity walks straight back into the corner it just rounded.
  directClear(ent, tx, ty) {
    const R = 12;
    for (const b of this.blockers()) {
      const grown = { x: b.x - R, y: b.y - R, w: b.w + 2 * R, h: b.h + 2 * R };
      if (segHitsRect(ent.x, ent.y, tx, ty, grown)) return false;
    }
    return true;
  }

  // Pick a way around the wall that blocks the direct step: for every
  // blocker the direct step runs into, look at the point just outside each
  // of its corners and take the one with the shortest
  // entity -> corner -> target path. Returns { x, y } or null.
  cornerDetour(ent, tx, ty) {
    const r = 12;
    const step = 4; // probe a short step toward the target to find the blocker.
    const base = Math.atan2(ty - ent.y, tx - ent.x);
    const px = ent.x + Math.cos(base) * step, py = ent.y + Math.sin(base) * step;
    let best = null;
    for (const b of this.blockers()) {
      const cx = clamp(px, b.x, b.x + b.w), cy = clamp(py, b.y, b.y + b.h);
      if (dist(px, py, cx, cy) >= r) continue; // this one does not block the step.
      const ccx = b.x + b.w / 2, ccy = b.y + b.h / 2;
      for (const [kx, ky] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
        let dx = kx - ccx, dy = ky - ccy;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl; dy /= dl;
        const ox = kx + dx * (r + 6), oy = ky + dy * (r + 6);
        if (ox < BOUNDS.x0 + r || ox > BOUNDS.x1 - r || oy < BOUNDS.y0 + r || oy > BOUNDS.y1 - r) continue;
        let legal = true;
        for (const b2 of this.blockers()) {
          const qx = clamp(ox, b2.x, b2.x + b2.w), qy = clamp(oy, b2.y, b2.y + b2.h);
          if (dist(ox, oy, qx, qy) < r) { legal = false; break; }
        }
        if (!legal) continue;
        // A corner the entity is already standing on is not a way around
        // anything: skipping it stops the entity re-picking the corner it
        // just rounded and ping-ponging between two adjacent corners.
        if (dist(ent.x, ent.y, ox, oy) < 16) continue;
        const score = dist(ent.x, ent.y, ox, oy) + dist(ox, oy, tx, ty);
        if (!best || score < best.score) best = { x: ox, y: oy, score };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  // Like moveToward, but if the entity cannot move at all for ~0.3s (wedged
  // in a pocket no sidestep or detour can leave), report arrived so the
  // caller flips to its next waypoint / next state instead of waiting
  // forever. The timeout is a backstop only — the detour above is what
  // actually gets the entity around a corner.
  moveTowardStuck(ent, tx, ty, speed, dt) {
    const arrived = this.moveToward(ent, tx, ty, speed, dt);
    if (arrived) { ent.stuckT = 0; ent.stuckX = ent.x; ent.stuckY = ent.y; return true; }
    if (dist(ent.x, ent.y, ent.stuckX, ent.stuckY) > 6) {
      ent.stuckT = 0; ent.stuckX = ent.x; ent.stuckY = ent.y;
    } else if ((ent.stuckT += dt) > 0.3) {
      ent.stuckT = 0; ent.stuckX = ent.x; ent.stuckY = ent.y;
      return true;
    }
    return false;
  }

  updateGuard(g, dt) {
    if (g.state === 'patrol') {
      const wp = g.wp[g.wpi];
      if (this.moveTowardStuck(g, wp[0], wp[1], TUNE.guardPatrol * g.speed, dt)) g.wpi = (g.wpi + 1) % g.wp.length;
    } else if (g.state === 'search' || g.state === 'investigate') {
      const tgt = g.target;
      if (!tgt) { g.state = 'return'; return; }
      const arrived = this.moveTowardStuck(g, tgt.x, tgt.y, TUNE.guardSearch * g.speed, dt);
      if (g.state === 'search' && g.seen) g.target = { x: this.player.x, y: this.player.y };
      if (arrived) {
        if (g.state === 'search') { g.state = 'scan'; g.scanT = TUNE.searchDwell; }
        else { g.state = 'scan'; g.scanT = 1.5; }
      }
    } else if (g.state === 'scan') {
      g.scanT -= dt;
      g.angle += dt * 1.8;
      if (g.scanT <= 0) g.state = 'return';
    } else if (g.state === 'return') {
      let best = 0, bestD = 1e9;
      for (let i = 0; i < g.wp.length; i++) {
        const d = dist(g.x, g.y, g.wp[i][0], g.wp[i][1]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (this.moveTowardStuck(g, g.wp[best][0], g.wp[best][1], TUNE.guardPatrol * g.speed, dt)) {
        g.wpi = best;
        g.state = 'patrol';
      }
    }
  }

  updateDog(d, dt) {
    if (d.state === 'patrol') {
      const tx = d.dir > 0 ? d.x2 : d.x1;
      const ty = d.dir > 0 ? d.y2 : d.y1;
      if (this.moveTowardStuck(d, tx, ty, TUNE.dogPatrol, dt)) d.dir *= -1;
    } else if (d.state === 'chase') {
      if (this.hidden) {
        // The player slipped into the wardrobe: the chase is over. Sniff the
        // last-seen spot, then give up — never run at (or pounce) someone
        // hidden. The target stays the last-seen spot; it is never refreshed
        // to the player's live position while hidden.
        d.state = 'search';
        d.lostT = 0;
        if (!d.target) d.state = 'return';
      } else {
        if (!d.seen) {
          d.lostT += dt;
          if (d.lostT > TUNE.chaseMemory) { d.state = 'search'; d.lostT = 0; }
        } else {
          d.lostT = 0;
        }
        const tgt = d.target || { x: this.player.x, y: this.player.y };
        const dd = dist(d.x, d.y, this.player.x, this.player.y);
        if (dd < 26 && d.pounceCd <= 0) {
          this.raiseAlarm(TUNE.dogPounce, { kind: 'pounce', name: d.name });
          d.pounceCd = 1.5;
          d.state = 'search';
          d.target = { x: this.player.x, y: this.player.y };
          AudioSys.denied();
          // A pounce that fills the alarm catches the player right now,
          // instead of waiting for the next frame's alarm check.
          if (this.alarm >= 100) {
            AudioSys.stopAlarm();
            AudioSys.caught();
            this.state = 'caught';
          }
          return;
        }
        // Pressed against a wall with no way around (and too far to pounce):
        // give up the chase and fall back to searching the last-seen spot,
        // which recovers to patrol through scan/return.
        if (this.moveTowardStuck(d, tgt.x, tgt.y, TUNE.dogChase, dt) && dd > 26) {
          d.state = 'search';
          d.lostT = 0;
        }
      }
    } else if (d.state === 'search') {
      const tgt = d.target;
      if (!tgt) { d.state = 'return'; return; }
      if (this.moveTowardStuck(d, tgt.x, tgt.y, TUNE.dogChase * 0.7, dt)) { d.state = 'scan'; d.scanT = TUNE.searchDwell; }
    } else if (d.state === 'scan') {
      d.scanT -= dt;
      d.angle += dt * 2.2;
      if (d.scanT <= 0) d.state = 'return';
    } else if (d.state === 'return') {
      const tx = dist(d.x, d.y, d.x1, d.y1) < dist(d.x, d.y, d.x2, d.y2) ? d.x1 : d.x2;
      const ty = dist(d.x, d.y, d.x1, d.y1) < dist(d.x, d.y, d.x2, d.y2) ? d.y1 : d.y2;
      if (this.moveTowardStuck(d, tx, ty, TUNE.dogPatrol, dt)) {
        d.dir = tx === d.x2 ? 1 : -1;
        d.state = 'patrol';
      }
    }
    if (d.pounceCd > 0) d.pounceCd -= dt;
  }

  // Snapshot for playtests and screenshots.
  getState() {
    const L = this.levelDef();
    return {
      state: this.state, level: this.levelIndex, levelName: L.name,
      score: this.score, lootValue: this.lootValue, alarm: Math.round(this.alarm * 10) / 10,
      time: Math.round(this.totalTime), levelTime: Math.round(this.levelTime * 10) / 10,
      player: { x: Math.round(this.player.x), y: Math.round(this.player.y), sneak: this.player.sneak },
      hasKeycard: this.hasKeycard, targetTaken: this.targetTaken, hidden: this.hidden,
      door: Math.round(this.door.open * 100) / 100, doorBusy: this.door.busy,
      crack: Math.round(this.crack * 100) / 100, coins: this.coins, smokes: this.smokes,
      camerasOff: Math.round(this.camerasOff * 10) / 10,
      lootLeft: this.loot.filter((l) => !l.taken).length,
      guards: this.guards.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), state: g.state })),
      dogs: this.dogs.map((d) => ({ x: Math.round(d.x), y: Math.round(d.y), state: d.state, name: d.name })),
      sentries: this.sentries.map((s) => ({ angle: Math.round(s.angle * 100) / 100, seen: s.seen })),
      cameras: this.cameras.map((c) => ({ angle: Math.round(c.angle * 100) / 100, seen: c.seen })),
      lasers: L.lasers.map((l) => ({ on: this.laserOn(l) })),
      artCheckT: Math.round(this.artCheckT * 10) / 10,
      artCheckActive: this.artCheckActive,
      lastSpotter: this.lastSpotter,
      guard0wp: this.guards[0] ? this.guards[0].wp : null,
      guard0wpi: this.guards[0] ? this.guards[0].wpi : 0,
    };
  }
}
