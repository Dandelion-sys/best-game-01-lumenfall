// Game state — the rules of Lumenfall: waves, enemies, bolts, pickups,
// scoring and the win/lose conditions. It holds no drawing and no sound
// of its own; it takes the input and an optional sound bank and advances
// the world one fixed step at a time.

import { ARENA_HEIGHT, ARENA_WIDTH } from './input.js';

export const LANTERN_X = ARENA_WIDTH / 2;
export const LANTERN_Y = ARENA_HEIGHT / 2;
export const LANTERN_AURA_RADIUS = 115;
export const PLAYER_SPEED = 275;
export const BOLT_SPEED = 580;
export const FIRE_INTERVAL = 0.14;
export const BREATHER_SECONDS = 4;

/** The three shadow kinds: how tough, how fast, what they are worth. */
export const ENEMY_TYPES = {
  drifter: { hp: 2, speed: 44, radius: 18, score: 100, touchDamage: 10, lanternDamage: 8, color: '#7b5cff' },
  darter: { hp: 1, speed: 62, radius: 13, score: 150, touchDamage: 8, lanternDamage: 6, color: '#ff5c8a' },
  brute: { hp: 9, speed: 25, radius: 30, score: 300, touchDamage: 16, lanternDamage: 20, color: '#b14bff' },
};

/** A small seeded random generator, so screenshot scenes are identical every run. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadBest() {
  try {
    return Number(localStorage.getItem('lumenfall-best') ?? 0) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem('lumenfall-best', String(score));
  } catch {
    // Best score is a nicety; a browser that refuses storage still plays.
  }
}

/** A fresh game in its title phase, before any run has started. */
export function createGame() {
  return {
    phase: 'title', // title | playing | paused | over
    time: 0,
    score: 0,
    best: loadBest(),
    newBest: false,
    wave: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    player: {
      x: LANTERN_X,
      y: LANTERN_Y + 170,
      hp: 100,
      maxHp: 100,
      angle: -Math.PI / 2,
      radius: 14,
      spreadUntil: 0,
      invUntil: 0,
      fireTimer: 0,
    },
    lantern: { hp: 100, maxHp: 100, shieldUntil: 0, flicker: 0 },
    enemies: [],
    bolts: [],
    particles: [],
    popups: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    breatherTimer: 0,
    banner: null,
    bannerTimer: 0,
    shake: 0,
    overCause: null,
    rng: makeRng((Date.now() % 2147483647) + 1),
    ui: { startButton: null, restartButton: null, pauseButton: null, muteButton: null },
  };
}

/** Begin a new run: full health, wave one, score zero. */
export function startRun(state, sound) {
  const fresh = createGame();
  fresh.best = state.best;
  fresh.phase = 'playing';
  fresh.rng = state.rng;
  Object.assign(state, fresh);
  startWave(state, 1, sound);
  if (sound) sound.startDrone();
}

/** Set up wave n: queue its enemies and show the banner. */
export function startWave(state, n, sound) {
  state.wave = n;
  state.spawnQueue = buildWaveRoster(state, n);
  state.spawnTimer = 0.4;
  state.banner = `WAVE ${n}`;
  state.bannerTimer = 2.2;
  if (sound) sound.waveStart();
}

/** The roster for a wave: more shadows each round, darters from wave 2, brutes from wave 3. */
export function buildWaveRoster(state, n) {
  const roster = [];
  const total = 5 + n * 3;
  const darters = n >= 2 ? Math.min(n, 8) : 0;
  const brutes = n >= 3 ? Math.floor(n / 2) : 0;
  const drifters = Math.max(1, total - darters - brutes);
  for (let i = 0; i < drifters; i++) roster.push('drifter');
  for (let i = 0; i < darters; i++) roster.push('darter');
  for (let i = 0; i < brutes; i++) roster.push('brute');
  // Shuffle with the state's seeded generator.
  for (let i = roster.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    [roster[i], roster[j]] = [roster[j], roster[i]];
  }
  return roster;
}

function spawnEdgePoint(state) {
  const side = Math.floor(state.rng() * 4);
  const margin = 30;
  if (side === 0) return { x: margin + state.rng() * (ARENA_WIDTH - margin * 2), y: margin };
  if (side === 1) return { x: margin + state.rng() * (ARENA_WIDTH - margin * 2), y: ARENA_HEIGHT - margin };
  if (side === 2) return { x: margin, y: margin + state.rng() * (ARENA_HEIGHT - margin * 2) };
  return { x: ARENA_WIDTH - margin, y: margin + state.rng() * (ARENA_HEIGHT - margin * 2) };
}

/** Add one shadow of the given kind at the arena edge (or at x, y when given). */
export function spawnEnemy(state, kind, x = null, y = null) {
  const def = ENEMY_TYPES[kind];
  const at = x === null ? spawnEdgePoint(state) : { x, y };
  state.enemies.push({
    kind,
    x: at.x,
    y: at.y,
    hp: def.hp,
    maxHp: def.hp,
    radius: def.radius,
    speed: def.speed,
    angle: 0,
    wobble: state.rng() * Math.PI * 2,
    wobbleSpeed: 1.5 + state.rng() * 2,
    state: 'approach',
    stateTimer: 0.6 + state.rng() * 0.8,
    dashX: 0,
    dashY: 0,
    flash: 0,
    targetPlayer: kind === 'darter' && state.rng() < 0.5,
  });
}

/** How far a bolt's angle bends toward the nearest shadow near the aim line. */
function aimAssist(state, angle) {
  const p = state.player;
  let best = null;
  let bestScore = Infinity;
  for (const e of state.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 460) continue;
    let diff = Math.atan2(dy, dx) - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 0.28) continue;
    const score = dist + Math.abs(diff) * 600;
    if (score < bestScore) {
      bestScore = score;
      best = diff;
    }
  }
  if (best === null) return 0;
  return best * 0.55;
}

function fireBolts(state, sound) {
  const p = state.player;
  const spread = state.time < p.spreadUntil;
  const angles = spread ? [-0.22, 0, 0.22] : [0];
  for (const offset of angles) {
    // A gentle aim assist: a bolt veers toward the nearest shadow that
    // sits close to the aim line, so firing feels generous, not fussy.
    const a = p.angle + offset + aimAssist(state, p.angle + offset);
    state.bolts.push({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * BOLT_SPEED,
      vy: Math.sin(a) * BOLT_SPEED,
      radius: 5,
      damage: 1,
      life: 1.1,
    });
  }
  state.shotsFired += angles.length;
  state.particles.push({
    x: p.x + Math.cos(p.angle) * 26,
    y: p.y + Math.sin(p.angle) * 26,
    vx: Math.cos(p.angle) * 60,
    vy: Math.sin(p.angle) * 60,
    life: 0.14,
    maxLife: 0.14,
    size: 9,
    color: '#ffd97a',
  });
  if (sound) sound.shoot();
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + state.rng() * 0.4,
      maxLife: 0.75,
      size: 2 + state.rng() * 4,
      color,
    });
  }
}

function addPopup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, life: 1.0, maxLife: 1.0 });
}

function dropPickup(state, x, y) {
  if (state.rng() > 0.15) return;
  const roll = state.rng();
  const kind = roll < 0.4 ? 'health' : roll < 0.75 ? 'spread' : 'shield';
  state.pickups.push({ x, y, kind, life: 9, bob: state.rng() * Math.PI * 2 });
}

function killEnemy(state, enemy, sound) {
  const def = ENEMY_TYPES[enemy.kind];
  state.score += def.score;
  state.kills += 1;
  addPopup(state, enemy.x, enemy.y - 10, `+${def.score}`, '#ffe9a8');
  burst(state, enemy.x, enemy.y, def.color, enemy.kind === 'brute' ? 26 : 14, 200);
  burst(state, enemy.x, enemy.y, '#ffffff', 6, 120);
  dropPickup(state, enemy.x, enemy.y);
  state.shake = Math.max(state.shake, enemy.kind === 'brute' ? 7 : 3);
  if (sound) sound.enemyDie();
}

function damageLantern(state, amount, sound) {
  if (state.time < state.lantern.shieldUntil) {
    addPopup(state, LANTERN_X, LANTERN_Y - 70, 'SHIELD', '#7fd4ff');
    return;
  }
  state.lantern.hp = Math.max(0, state.lantern.hp - amount);
  state.shake = Math.max(state.shake, 8);
  burst(state, LANTERN_X, LANTERN_Y, '#ffb347', 10, 160);
  if (sound) sound.lanternHurt();
  if (state.lantern.hp <= 0) endRun(state, 'lantern', sound);
}

function damagePlayer(state, amount, sound) {
  const p = state.player;
  if (state.time < p.invUntil) return;
  p.hp = Math.max(0, p.hp - amount);
  p.invUntil = state.time + 0.9;
  state.shake = Math.max(state.shake, 6);
  burst(state, p.x, p.y, '#ff6b6b', 12, 180);
  if (sound) sound.playerHurt();
  if (p.hp <= 0) endRun(state, 'keeper', sound);
}

function endRun(state, cause, sound) {
  state.phase = 'over';
  state.overCause = cause;
  state.newBest = state.score > state.best;
  if (state.newBest) {
    state.best = state.score;
    saveBest(state.score);
  }
  burst(state, LANTERN_X, LANTERN_Y, '#ffd97a', 60, 320);
  burst(state, LANTERN_X, LANTERN_Y, '#ff9d5c', 40, 220);
  state.shake = 14;
  if (sound) {
    sound.stopDrone();
    sound.gameOver();
  }
}

function applyPickup(state, pickup, sound) {
  const p = state.player;
  if (pickup.kind === 'health') {
    p.hp = Math.min(p.maxHp, p.hp + 25);
    state.lantern.hp = Math.min(state.lantern.maxHp, state.lantern.hp + 15);
    addPopup(state, p.x, p.y - 26, '+25 HEALTH', '#7dff9b');
  } else if (pickup.kind === 'spread') {
    p.spreadUntil = state.time + 12;
    addPopup(state, p.x, p.y - 26, 'SPREAD SHOT!', '#ffd94d');
  } else {
    state.lantern.shieldUntil = state.time + 10;
    addPopup(state, p.x, p.y - 26, 'LANTERN SHIELD!', '#7fd4ff');
  }
  burst(state, pickup.x, pickup.y, '#ffffff', 10, 140);
  if (sound) sound.pickup();
}

/** Advance the world one step. `sound` may be null (silent, used by screenshot scenes). */
export function update(state, dt, input, sound) {
  state.time += dt;
  state.shake = Math.max(0, state.shake - dt * 22);
  state.lantern.flicker = Math.sin(state.time * 7.3) * 0.5 + Math.sin(state.time * 13.1) * 0.5;

  if (state.bannerTimer > 0) state.bannerTimer -= dt;

  // Particles and popups always age, even on the title screen.
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.2 * dt;
    pt.vy *= 1 - 2.2 * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const pop of state.popups) {
    pop.y -= 34 * dt;
    pop.life -= dt;
  }
  state.popups = state.popups.filter((pop) => pop.life > 0);

  if (state.phase === 'title') {
    // A quiet backdrop: a few shadows drift around the lit lantern.
    for (const e of state.enemies) {
      e.wobble += dt * e.wobbleSpeed;
      e.x += Math.cos(e.wobble) * 14 * dt;
      e.y += Math.sin(e.wobble * 0.7) * 14 * dt;
    }
    return;
  }
  if (state.phase !== 'playing') return;

  const p = state.player;

  // --- movement and aim ---
  const move = input.moveVector();
  p.x = Math.max(24, Math.min(ARENA_WIDTH - 24, p.x + move.x * PLAYER_SPEED * dt));
  p.y = Math.max(24, Math.min(ARENA_HEIGHT - 24, p.y + move.y * PLAYER_SPEED * dt));
  p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);

  // --- firing ---
  p.fireTimer -= dt;
  if (input.firing() && p.fireTimer <= 0) {
    fireBolts(state, sound);
    p.fireTimer = FIRE_INTERVAL;
  }

  // --- spawning ---
  if (state.spawnQueue.length > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy(state, state.spawnQueue.shift());
      state.spawnTimer = 0.55;
    }
  }

  // --- the lantern's aura burns shadows that press too close ---
  for (const e of state.enemies) {
    const d = Math.hypot(e.x - LANTERN_X, e.y - LANTERN_Y);
    if (d < LANTERN_AURA_RADIUS) {
      e.hp -= 2 * dt;
      if (state.rng() < dt * 6) {
        state.particles.push({
          x: e.x + (state.rng() - 0.5) * 20,
          y: e.y + (state.rng() - 0.5) * 20,
          vx: 0,
          vy: -40,
          life: 0.4,
          maxLife: 0.4,
          size: 3,
          color: '#ffd97a',
        });
      }
    }
  }

  // --- enemies ---
  for (const e of state.enemies) {
    e.flash = Math.max(0, e.flash - dt * 6);
    e.wobble += dt * e.wobbleSpeed;
    const targetX = e.targetPlayer ? p.x : LANTERN_X;
    const targetY = e.targetPlayer ? p.y : LANTERN_Y;
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (e.kind === 'darter') {
      e.stateTimer -= dt;
      if (e.state === 'approach') {
        e.x += nx * e.speed * dt + Math.cos(e.wobble) * 22 * dt;
        e.y += ny * e.speed * dt + Math.sin(e.wobble) * 22 * dt;
        if (e.stateTimer <= 0 && dist < 320) {
          e.state = 'dash';
          e.stateTimer = 0.32;
          e.dashX = nx;
          e.dashY = ny;
        } else if (e.stateTimer <= 0) {
          e.stateTimer = 0.5;
        }
      } else {
        e.x += e.dashX * 300 * dt;
        e.y += e.dashY * 300 * dt;
        if (e.stateTimer <= 0) {
          e.state = 'approach';
          e.stateTimer = 0.7 + state.rng() * 0.7;
        }
      }
    } else {
      // Drifters wobble toward the lantern; brutes march straight at it.
      const sway = e.kind === 'drifter' ? 26 : 0;
      e.x += (nx * e.speed + Math.cos(e.wobble) * sway) * dt;
      e.y += (ny * e.speed + Math.sin(e.wobble) * sway) * dt;
    }
    e.angle = Math.atan2(ny, nx);

    // Reaching the lantern: the shadow bites it and dissolves.
    if (dist < e.radius + 34) {
      damageLantern(state, ENEMY_TYPES[e.kind].lanternDamage, sound);
      burst(state, e.x, e.y, ENEMY_TYPES[e.kind].color, 10, 150);
      e.hp = 0;
    }

    // Touching the keeper hurts the keeper.
    const pd = Math.hypot(e.x - p.x, e.y - p.y);
    if (pd < e.radius + p.radius) {
      damagePlayer(state, ENEMY_TYPES[e.kind].touchDamage, sound);
      e.x += nx * -30;
      e.y += ny * -30;
    }
  }

  // --- bolts ---
  for (const b of state.bolts) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        e.hp -= b.damage;
        e.flash = 1;
        state.shotsHit += 1;
        b.life = 0;
        burst(state, b.x, b.y, '#ffe9a8', 4, 90);
        if (sound) sound.enemyHit();
        break;
      }
    }
  }
  state.bolts = state.bolts.filter((b) => b.life > 0 && b.x > -20 && b.x < ARENA_WIDTH + 20 && b.y > -20 && b.y < ARENA_HEIGHT + 20);

  // The dead fall: score them, then clear them.
  for (const e of state.enemies) {
    if (e.hp <= 0) killEnemy(state, e, sound);
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // --- pickups ---
  for (const pk of state.pickups) {
    pk.life -= dt;
    pk.bob += dt * 3;
    const d = Math.hypot(pk.x - p.x, pk.y - p.y);
    if (d < 110) {
      pk.x += ((p.x - pk.x) / d) * 160 * dt;
      pk.y += ((p.y - pk.y) / d) * 160 * dt;
    }
    if (d < 28) {
      applyPickup(state, pk, sound);
      pk.life = 0;
    }
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);

  // --- wave cleared? ---
  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    state.breatherTimer += dt;
    if (state.breatherTimer === dt) {
      const bonus = 50 * state.wave;
      state.score += bonus;
      addPopup(state, LANTERN_X, LANTERN_Y - 90, `WAVE CLEAR +${bonus}`, '#7dff9b');
      state.lantern.hp = Math.min(state.lantern.maxHp, state.lantern.hp + 10);
      state.banner = `WAVE ${state.wave} CLEAR`;
      state.bannerTimer = 2.0;
      if (sound) sound.waveClear();
    }
    if (state.breatherTimer >= BREATHER_SECONDS) {
      state.breatherTimer = 0;
      startWave(state, state.wave + 1, sound);
    }
  }
}

/** Build a fixed, deterministic scene for a screenshot: title, play or over. */
export function setupShotScene(state, scene) {
  state.rng = makeRng(20261117);
  state.best = 2450;
  state.time = 12.5;

  if (scene === 'title') {
    state.phase = 'title';
    state.score = 0;
    state.wave = 0;
    state.enemies = [];
    const spots = [
      [300, 200, 'drifter'],
      [980, 170, 'darter'],
      [1010, 540, 'drifter'],
      [270, 540, 'brute'],
      [640, 130, 'drifter'],
    ];
    for (const [x, y, kind] of spots) {
      spawnEnemy(state, kind, x, y);
    }
    return;
  }

  if (scene === 'over') {
    state.phase = 'over';
    state.overCause = 'lantern';
    state.score = 2450;
    state.wave = 5;
    state.kills = 47;
    state.shotsFired = 312;
    state.shotsHit = 241;
    state.newBest = true;
    state.player.hp = 34;
    state.lantern.hp = 0;
    state.enemies = [];
    const spots = [
      [420, 240, 'drifter'],
      [880, 260, 'darter'],
      [760, 520, 'drifter'],
    ];
    for (const [x, y, kind] of spots) {
      spawnEnemy(state, kind, x, y);
    }
    burst(state, LANTERN_X, LANTERN_Y, '#ffd97a', 24, 200);
    burst(state, LANTERN_X, LANTERN_Y, '#ff9d5c', 16, 150);
    return;
  }

  // The play scene: mid-action, wave 3, HUD full, all three shadow kinds.
  state.phase = 'playing';
  state.score = 1250;
  state.wave = 3;
  state.kills = 21;
  state.shotsFired = 148;
  state.shotsHit = 112;
  state.player.hp = 82;
  state.player.x = 470;
  state.player.y = 480;
  state.player.angle = -0.6;
  state.player.spreadUntil = state.time + 6;
  state.lantern.hp = 74;
  state.lantern.shieldUntil = 0;
  state.banner = 'WAVE 3';
  state.bannerTimer = 0.6;

  const foes = [
    [820, 220, 'drifter'],
    [900, 420, 'darter'],
    [340, 260, 'brute'],
    [1020, 300, 'drifter'],
    [560, 180, 'darter'],
    [240, 470, 'drifter'],
  ];
  for (const [x, y, kind] of foes) {
    spawnEnemy(state, kind, x, y);
  }
  state.bolts = [
    { x: 560, y: 430, vx: 480, vy: -320, radius: 5, damage: 1, life: 0.9 },
    { x: 620, y: 380, vx: 540, vy: -200, radius: 5, damage: 1, life: 0.9 },
    { x: 500, y: 450, vx: 420, vy: -380, radius: 5, damage: 1, life: 0.9 },
    { x: 760, y: 300, vx: 500, vy: -280, radius: 5, damage: 1, life: 0.9 },
  ];
  state.pickups = [{ x: 700, y: 520, kind: 'spread', life: 7, bob: 1.2 }];
  burst(state, 830, 300, '#7b5cff', 12, 180);
  burst(state, 560, 250, '#ff5c8a', 10, 160);
  addPopup(state, 830, 270, '+150', '#ffe9a8');
  addPopup(state, 560, 220, '+100', '#ffe9a8');
}
