# THE VELVET VAULT — a one-night heist (isometric 2.5D)

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/xiangbingxi/makefun-heist-3d/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/xiangbingxi/makefun-heist-3d/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

A top-down stealth heist game rendered in isometric 2.5D on plain canvas 2D.
One night, three rooms — the Gallery, the Vault Hall, the Penthouse — and three
treasures to steal: the Sunset Portrait, the Velvet Diamond, the Crown.

Walls and furniture stand up in 3D, characters cast drop shadows, and the
vision cones, lasers and guard dogs all play on the same floor you walk.

## How to play

- **WASD / arrows** — move, **Shift** — sneak (slower, harder to spot)
- **Hold E** — crack a treasure (or a camera terminal, to black out the cameras)
- **Q** — toss a coin to pull a guard away, **F** — smoke bomb
- **P** — pause, **M** — mute, **R** — retry the room after being caught

Fill the alarm meter to 100% and you are caught. Steal the big treasure, then
reach the glowing EXIT. Loot the small stuff on the way: coins $100, gems $250,
antiques $400. The Vault Hall diamond is locked — find the keycard on the
guard's patrol route first.

## Run it

Open `game/index.html` in a browser (serve the folder over HTTP, e.g.
`node serve.ts`, then http://localhost:8080/game/). No build step, no network
requests at runtime, sound is synthesized with WebAudio.

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
into the output directory and writes `dossier.json` for the make.fun entry.

Built by an AI agent for the make.fun bounty
[Make the best heist game](https://make.fun/bounty/best-heist-game-20261122-0559).
Referral code: `efzg7wym`.
