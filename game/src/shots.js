// Screenshot setups for ?shot= : fixed states of the real game, for the dossier images.
function applyShot(game, name) {
  if (name === 'cover') {
    // Gallery, laser lit, player near the beam, alarm partway up.
    game.state = 'playing';
    game.player.x = 700; game.player.y = 430;
    game.player.facing = Math.PI / 2;
    game.alarm = 32;
    game.levelTime = 0.5; // laser period 3, on 1.6 -> lit
    game.lootValue = 200;
    game.score = 200;
    game.loot[0].taken = true; game.loot[1].taken = true;
  } else if (name === 'shadow') {
    // Gallery, laser off, player sneaking inside a shadow patch.
    game.state = 'playing';
    game.player.x = 380; game.player.y = 340;
    game.player.sneak = true;
    game.player.facing = 0;
    game.alarm = 8;
    game.levelTime = 2.0; // 2.0 % 3 = 2.0 > 1.6 -> laser off
    game.lootValue = 100;
    game.score = 100;
    game.loot[0].taken = true;
  } else if (name === 'vault') {
    // Vault hall, keycard collected, mid-crack on the diamond.
    game.loadLevel(1);
    game.state = 'playing';
    game.hasKeycard = true;
    game.keycardTaken = true;
    game.player.x = 930; game.player.y = 360;
    game.player.facing = 0;
    game.alarm = 55;
    game.levelTime = 0.5;
    game.crack = 0.55;
    game.lootValue = 800;
    game.score = 800;
    for (let i = 0; i < 4; i++) game.loot[i].taken = true;
  } else if (name === 'win') {
    // Victory screen after a full clear.
    game.loadLevel(2);
    game.score = 6120;
    game.lootValue = 5800;
    game.totalLoot = 5800;
    game.maxAlarm = 64;
    for (const l of game.loot) l.taken = true;
    game.totalTime = 367;
    game.targetTaken = true;
    game.state = 'victory';
  }
}
