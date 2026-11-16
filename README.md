# best-game-01-lumenfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Dandelion-sys/best-game-01-lumenfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Dandelion-sys/best-game-01-lumenfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Lumenfall — a lone lantern-keeper defends the last light against waves of hungry shadows.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
npx serve out/game
```

Then open `http://localhost:3000/index.html` in desktop Chrome (any static
file server works — the game is plain files under `game/` and needs no
network and no build step).

## How to play

You are the keeper of the last lantern in a dark arena. Shadows crawl in
from the edges, and every one of them wants the light. Hold the lantern:
if it falls, the night wins. If you fall, it falls with you.

**Goal.** Survive wave after wave, banish as many shadows as you can, and
chase the best score. Each cleared wave pays a bonus and mends the lantern
a little; each new wave brings more shadows than the last.

**Controls.** WASD or arrow keys to move, mouse to aim, hold click (or
Space) to fire bolts of light. P pauses, M mutes, Enter starts and restarts.

**Enemies.** Drifters wander slowly toward the lantern. Darters hang back,
then dash in a blur. Brutes are slow, tough, and hit the lantern hard.
Shadows that press inside the lantern's ring of light burn — so the light
itself is part of your defence.

**Pickups.** Fallen shadows sometimes drop a gift: a green cross that
mends you and the lantern, a gold star for twelve seconds of three-way
spread shot, or a blue ring that shields the lantern for ten seconds.

## Files

- `game/index.html` — the page and canvas
- `game/style.css` — the page chrome around the canvas
- `game/src/main.js` — boot, game loop, menus, screenshot scenes
- `game/src/game-state.js` — waves, enemies, bolts, pickups, scoring
- `game/src/render.js` — all canvas art, HUD and screens
- `game/src/sound.js` — WebAudio oscillator sounds, no sound files
- `game/src/input.js` — keyboard and mouse state
- `main.ts` — copies `game/` and `screenshots/` to the output directory
  and writes `dossier.json` with the kit's `buildDossier`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
