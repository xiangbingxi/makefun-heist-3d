// Boot for THE VELVET VAULT 2.5D.
(function () {
  Keys.init();
  const canvas = document.getElementById('game');
  Mouse.init(canvas);
  const ctx = canvas.getContext('2d');
  const game = new Game();

  // Screenshot mode: ?shot=cover|shadow|vault|win sets a fixed state.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    try { applyShot(game, shot); } catch (e) { console.error('shot failed', e); }
    // Freeze the frame for a clean capture: keep rendering, skip updates.
    game._frozen = true;
  }

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (!game._frozen) game.update(dt);
    renderGame(ctx, game);
    Keys.endFrame();
    Mouse.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Test hooks (used by the playtest driver only).
  window.VV = {
    game,
    getState: () => game.getState(),
    debug: {
      teleport: (x, y) => { game.player.x = x; game.player.y = y; },
      setAlarm: (v) => { game.alarm = v; },
      giveKeycard: () => { game.hasKeycard = true; game.keycardTaken = true; },
      setLevelTime: (t) => { game.levelTime = t; },
      setState: (s) => { game.state = s; },
      start: () => { game.score = 0; game.totalTime = 0; game.loadLevel(0); game.state = 'playing'; },
      loadLevel: (i) => { game.loadLevel(i); game.state = 'playing'; },
    },
  };
})();
