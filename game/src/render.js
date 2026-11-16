// Render — everything Lumenfall shows is drawn here with canvas shapes
// and gradients: the starfield, the glowing lantern, the shadow kinds,
// the keeper, bolts, particles, the HUD and every menu screen. No image
// files are loaded anywhere; the art is code.

import { ARENA_HEIGHT, ARENA_WIDTH } from './input.js';
import { BOLT_SPEED, ENEMY_TYPES, LANTERN_AURA_RADIUS, LANTERN_X, LANTERN_Y, makeRng } from './game-state.js';

const GOLD = '#ffd97a';
const GOLD_DIM = '#c9a24d';
const INK = '#e8e4d8';
const DIM = '#9aa0bd';

/** The night sky's stars, fixed once so the backdrop never shimmers. */
const STARS = (() => {
  const rng = makeRng(987654321);
  const stars = [];
  for (let i = 0; i < 130; i++) {
    stars.push({
      x: rng() * ARENA_WIDTH,
      y: rng() * ARENA_HEIGHT,
      r: 0.6 + rng() * 1.6,
      twinkle: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 1.5,
    });
  }
  return stars;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 'bold', font = 'Georgia, serif') {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function healthBar(ctx, x, y, w, h, fraction, fill, label) {
  text(ctx, label, x, y - 11, 12, DIM, 'left', 'bold', 'Verdana, sans-serif');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fill;
  if (fraction > 0) {
    roundRect(ctx, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * fraction), h - 3, (h - 3) / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.stroke();
}

/** A menu button: drawn, hover-aware, and its rect returned for clicks. */
function drawButton(ctx, input, cx, y, w, h, label, primary = true) {
  const x = cx - w / 2;
  const hover = input.mouseX >= x && input.mouseX <= x + w && input.mouseY >= y && input.mouseY <= y + h;
  ctx.save();
  if (hover) ctx.shadowColor = GOLD;
  ctx.shadowBlur = hover ? 22 : 10;
  ctx.fillStyle = primary ? '#3a2a10' : '#14162a';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hover ? GOLD : GOLD_DIM;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  text(ctx, label, cx, y + h / 2 + 1, 24, hover ? '#fff3cf' : GOLD);
  ctx.restore();
  return { x, y, w, h };
}

function inside(rect, x, y) {
  return rect !== null && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export { inside };

function drawBackground(ctx, state) {
  const sky = ctx.createLinearGradient(0, 0, 0, ARENA_HEIGHT);
  sky.addColorStop(0, '#0a0c26');
  sky.addColorStop(0.55, '#070818');
  sky.addColorStop(1, '#0b0716');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  for (const s of STARS) {
    const glow = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(state.time * s.speed + s.twinkle));
    ctx.globalAlpha = glow;
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Faint ground mist along the bottom of the arena.
  const mist = ctx.createLinearGradient(0, ARENA_HEIGHT - 130, 0, ARENA_HEIGHT);
  mist.addColorStop(0, 'rgba(90, 70, 160, 0)');
  mist.addColorStop(1, 'rgba(90, 70, 160, 0.16)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, ARENA_HEIGHT - 130, ARENA_WIDTH, 130);
}

function drawLantern(ctx, state) {
  const hpFraction = state.lantern.hp / state.lantern.maxHp;
  const alive = state.lantern.hp > 0;
  const lightRadius = 170 + hpFraction * 190 + state.lantern.flicker * 7;
  const shielded = alive && state.time < state.lantern.shieldUntil;

  // The pool of light the lantern throws across the arena — gone when it falls.
  if (alive) {
    const glow = ctx.createRadialGradient(LANTERN_X, LANTERN_Y, 10, LANTERN_X, LANTERN_Y, lightRadius);
    glow.addColorStop(0, 'rgba(255, 205, 110, 0.34)');
    glow.addColorStop(0.55, 'rgba(255, 180, 80, 0.12)');
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(LANTERN_X, LANTERN_Y, lightRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // The lantern's aura: shadows burn inside this ring.
  ctx.strokeStyle = alive ? 'rgba(255, 217, 122, 0.20)' : 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(LANTERN_X, LANTERN_Y, LANTERN_AURA_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (shielded) {
    ctx.strokeStyle = 'rgba(127, 212, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(LANTERN_X, LANTERN_Y, 62, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Stone plinth.
  ctx.fillStyle = '#232742';
  roundRect(ctx, LANTERN_X - 34, LANTERN_Y + 26, 68, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#2f3455';
  roundRect(ctx, LANTERN_X - 26, LANTERN_Y + 14, 52, 14, 4);
  ctx.fill();

  // Brass frame and glass: dark and cold once the light has fallen.
  ctx.fillStyle = alive ? '#8a6a2f' : '#3c3f52';
  roundRect(ctx, LANTERN_X - 24, LANTERN_Y - 34, 48, 52, 6);
  ctx.fill();
  const glass = ctx.createLinearGradient(LANTERN_X - 18, LANTERN_Y - 28, LANTERN_X + 18, LANTERN_Y + 14);
  if (alive) {
    glass.addColorStop(0, '#ffe9a8');
    glass.addColorStop(1, '#ff9d3c');
  } else {
    glass.addColorStop(0, '#2c2f42');
    glass.addColorStop(1, '#1a1c2c');
  }
  ctx.fillStyle = glass;
  roundRect(ctx, LANTERN_X - 18, LANTERN_Y - 28, 36, 40, 5);
  ctx.fill();

  // The flame, breathing with the flicker — only while the light lives.
  if (alive) {
    const flameH = 20 + state.lantern.flicker * 3;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.ellipse(LANTERN_X, LANTERN_Y - 8, 7, flameH / 2 + 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(LANTERN_X, LANTERN_Y - 4, 4, flameH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cap and handle.
  ctx.fillStyle = alive ? '#8a6a2f' : '#3c3f52';
  roundRect(ctx, LANTERN_X - 26, LANTERN_Y - 40, 52, 8, 4);
  ctx.fill();
  ctx.strokeStyle = alive ? '#8a6a2f' : '#3c3f52';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(LANTERN_X, LANTERN_Y - 40, 12, Math.PI, 0);
  ctx.stroke();

  text(ctx, 'THE LANTERN', LANTERN_X, LANTERN_Y + 58, 11, DIM, 'center', 'bold', 'Verdana, sans-serif');
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (state.time < p.invUntil && Math.floor(state.time * 14) % 2 === 0) return; // hurt blink

  // Soft glow from the keeper's orb.
  const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 52);
  glow.addColorStop(0, 'rgba(255, 217, 122, 0.5)');
  glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 52, 0, Math.PI * 2);
  ctx.fill();

  // Aim line, faint, toward the mouse.
  ctx.strokeStyle = 'rgba(255, 217, 122, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 10]);
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26);
  ctx.lineTo(p.x + Math.cos(p.angle) * 62, p.y + Math.sin(p.angle) * 62);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cloak.
  ctx.fillStyle = '#3d4a7a';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 18);
  ctx.quadraticCurveTo(p.x + 17, p.y - 4, p.x + 13, p.y + 16);
  ctx.quadraticCurveTo(p.x, p.y + 20, p.x - 13, p.y + 16);
  ctx.quadraticCurveTo(p.x - 17, p.y - 4, p.x, p.y - 18);
  ctx.fill();
  ctx.fillStyle = '#2c3760';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 18);
  ctx.quadraticCurveTo(p.x + 17, p.y - 4, p.x + 13, p.y + 16);
  ctx.lineTo(p.x - 13, p.y + 16);
  ctx.quadraticCurveTo(p.x - 17, p.y - 4, p.x, p.y - 18);
  ctx.fill();

  // Hood and face.
  ctx.fillStyle = '#4a5a94';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 8, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.angle) * 3, p.y - 8 + Math.sin(p.angle) * 3, 5.5, 0, Math.PI * 2);
  ctx.fill();

  // The orb of light held out toward the aim.
  const ox = p.x + Math.cos(p.angle) * 24;
  const oy = p.y + Math.sin(p.angle) * 24;
  ctx.fillStyle = '#fff3cf';
  ctx.beginPath();
  ctx.arc(ox, oy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox, oy, 9, 0, Math.PI * 2);
  ctx.stroke();

  if (state.time < p.spreadUntil) {
    text(ctx, 'SPREAD', p.x, p.y - 30, 11, '#ffd94d', 'center', 'bold', 'Verdana, sans-serif');
  }
}

function drawEnemy(ctx, e) {
  const def = ENEMY_TYPES[e.kind];
  const flash = e.flash > 0;

  // Shadow body: a dark blob with a coloured rim.
  const body = ctx.createRadialGradient(e.x - e.radius * 0.3, e.y - e.radius * 0.3, 2, e.x, e.y, e.radius);
  body.addColorStop(0, flash ? '#ffffff' : '#241b3d');
  body.addColorStop(0.75, flash ? '#e8ddff' : '#120d24');
  body.addColorStop(1, def.color);
  ctx.fillStyle = body;
  ctx.beginPath();
  if (e.kind === 'brute') {
    // A brute is a jagged, many-spiked mass.
    const spikes = 9;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? e.radius + 7 : e.radius - 3;
      const px = e.x + Math.cos(a) * r;
      const py = e.y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (e.kind === 'darter') {
    ctx.ellipse(e.x, e.y, e.radius + 6, e.radius - 2, e.angle, 0, Math.PI * 2);
  } else {
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  }
  ctx.fill();

  // Glowing eyes, always watching the lantern or the keeper.
  const eyeY = e.y - e.radius * 0.2;
  const eyeGap = e.radius * 0.38;
  const eyeR = e.kind === 'brute' ? 4.5 : 3.2;
  ctx.fillStyle = def.color;
  ctx.beginPath();
  ctx.arc(e.x - eyeGap, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(e.x + eyeGap, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(e.x - eyeGap, eyeY, eyeR * 0.45, 0, Math.PI * 2);
  ctx.arc(e.x + eyeGap, eyeY, eyeR * 0.45, 0, Math.PI * 2);
  ctx.fill();

  if (e.kind === 'darter' && e.state === 'dash') {
    ctx.strokeStyle = 'rgba(255, 92, 138, 0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x - e.dashX * 34, e.y - e.dashY * 34);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
  }

  // Brutes show how much punishment they have left.
  if (e.kind === 'brute' && e.hp < e.maxHp) {
    const w = 44;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
    ctx.fillStyle = '#b14bff';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
  }
}

function drawPickups(ctx, state) {
  for (const pk of state.pickups) {
    const bobY = Math.sin(pk.bob) * 4;
    const blink = pk.life < 2 ? (Math.floor(state.time * 8) % 2 === 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    const glow = ctx.createRadialGradient(pk.x, pk.y + bobY, 2, pk.x, pk.y + bobY, 30);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bobY, 30, 0, Math.PI * 2);
    ctx.fill();

    if (pk.kind === 'health') {
      ctx.fillStyle = '#2fae5f';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 2.5, pk.y + bobY - 8, 5, 16);
      ctx.fillRect(pk.x - 8, pk.y + bobY - 2.5, 16, 5);
    } else if (pk.kind === 'spread') {
      ctx.fillStyle = '#e8b400';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 14 : 6;
        const px = pk.x + Math.cos(a) * r;
        const py = pk.y + bobY + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = '#7fd4ff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bobY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawBolts(ctx, state) {
  for (const b of state.bolts) {
    const tail = 16;
    const grad = ctx.createLinearGradient(b.x - (b.vx / BOLT_SPEED) * tail, b.y - (b.vy / BOLT_SPEED) * tail, b.x, b.y);
    grad.addColorStop(0, 'rgba(255, 233, 168, 0)');
    grad.addColorStop(1, 'rgba(255, 233, 168, 1)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x - (b.vx / BOLT_SPEED) * tail, b.y - (b.vy / BOLT_SPEED) * tail);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const f = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = f;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * f + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, state) {
  for (const pop of state.popups) {
    ctx.globalAlpha = Math.min(1, pop.life / 0.4);
    text(ctx, pop.text, pop.x, pop.y, 17, pop.color, 'center', 'bold', 'Verdana, sans-serif');
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, state, input, muted) {
  // Top-left: score and best.
  text(ctx, `SCORE  ${state.score}`, 28, 34, 26, INK, 'left');
  text(ctx, `BEST  ${state.best}`, 28, 62, 14, DIM, 'left', 'bold', 'Verdana, sans-serif');

  // Top-centre: wave and shadows left.
  const left = state.enemies.length + state.spawnQueue.length;
  text(ctx, `WAVE ${Math.max(1, state.wave)}`, ARENA_WIDTH / 2, 32, 24, GOLD);
  if (state.phase === 'playing') {
    text(ctx, left > 0 ? `${left} shadow${left === 1 ? '' : 's'} remain` : 'wave clear — breathe…', ARENA_WIDTH / 2, 60, 13, DIM, 'center', 'bold', 'Verdana, sans-serif');
  }

  // Top-right: two health bars and the small buttons.
  const barX = ARENA_WIDTH - 268;
  healthBar(ctx, barX, 30, 170, 12, state.player.hp / state.player.maxHp, '#5ec97e', 'KEEPER');
  healthBar(ctx, barX, 62, 170, 12, state.lantern.hp / state.lantern.maxHp, '#ffb347', 'LANTERN');
  const pauseRect = { x: ARENA_WIDTH - 78, y: 18, w: 30, h: 30 };
  const muteRect = { x: ARENA_WIDTH - 44, y: 18, w: 30, h: 30 };
  for (const [rect, label] of [[pauseRect, 'II'], [muteRect, muted ? '✕' : '♪']]) {
    const hover = input.mouseX >= rect.x && input.mouseX <= rect.x + rect.w && input.mouseY >= rect.y && input.mouseY <= rect.y + rect.h;
    ctx.fillStyle = hover ? '#2a2f4a' : 'rgba(0, 0, 0, 0.5)';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 7);
    ctx.stroke();
    text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1, 13, INK, 'center', 'bold', 'Verdana, sans-serif');
  }
  state.ui.pauseButton = pauseRect;
  state.ui.muteButton = muteRect;

  // Bottom-left: live power-ups.
  let py = ARENA_HEIGHT - 26;
  const p = state.player;
  if (state.time < p.spreadUntil) {
    text(ctx, `SPREAD SHOT  ${Math.ceil(p.spreadUntil - state.time)}s`, 28, py, 14, '#ffd94d', 'left', 'bold', 'Verdana, sans-serif');
    py -= 22;
  }
  if (state.time < state.lantern.shieldUntil) {
    text(ctx, `LANTERN SHIELD  ${Math.ceil(state.lantern.shieldUntil - state.time)}s`, 28, py, 14, '#7fd4ff', 'left', 'bold', 'Verdana, sans-serif');
  }

  // Wave banner, centre screen.
  if (state.banner && state.bannerTimer > 0) {
    const a = Math.min(1, state.bannerTimer / 0.5);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 26;
    text(ctx, state.banner, ARENA_WIDTH / 2, 150, 46, GOLD);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // Breather countdown between waves.
  if (state.phase === 'playing' && state.spawnQueue.length === 0 && state.enemies.length === 0) {
    const nextIn = Math.max(0, 4 - state.breatherTimer);
    text(ctx, `Next wave in ${Math.ceil(nextIn)}…`, ARENA_WIDTH / 2, 196, 18, DIM);
  }
}

function drawTitle(ctx, state, input) {
  ctx.fillStyle = 'rgba(4, 5, 16, 0.62)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  ctx.save();
  ctx.shadowColor = GOLD;
  ctx.shadowBlur = 34;
  text(ctx, 'LUMENFALL', ARENA_WIDTH / 2, 150, 84, GOLD);
  ctx.restore();
  text(ctx, 'Defend the Lantern', ARENA_WIDTH / 2, 212, 26, INK, 'center', 'normal');
  text(ctx, 'Night falls. The shadows hunger for the last light.', ARENA_WIDTH / 2, 252, 17, DIM, 'center', 'normal');
  text(ctx, 'Hold the lantern. Survive the waves. Do not let the dark win.', ARENA_WIDTH / 2, 278, 17, DIM, 'center', 'normal');

  // The three shadow kinds, named.
  const legend = [
    ['#7b5cff', 'DRIFTER — slow, wanders in'],
    ['#ff5c8a', 'DARTER — waits, then dashes'],
    ['#b14bff', 'BRUTE — slow, tough, hits hard'],
  ];
  legend.forEach(([color, label], i) => {
    const y = 330 + i * 30;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ARENA_WIDTH / 2 - 215, y, 8, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, label, ARENA_WIDTH / 2 - 198, y, 16, INK, 'left', 'bold', 'Verdana, sans-serif');
  });

  text(ctx, 'WASD or arrows — move      Mouse — aim      Hold click or Space — fire', ARENA_WIDTH / 2, 452, 16, INK);
  text(ctx, 'P — pause      M — mute      Pick up health, spread shot and shields', ARENA_WIDTH / 2, 480, 15, DIM);

  state.ui.startButton = drawButton(ctx, input, ARENA_WIDTH / 2, 530, 300, 58, 'LIGHT THE LANTERN');
  if (state.best > 0) {
    text(ctx, `Best score: ${state.best}`, ARENA_WIDTH / 2, 622, 16, GOLD_DIM);
  }
}

function drawPaused(ctx, state, input) {
  ctx.fillStyle = 'rgba(4, 5, 16, 0.66)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  text(ctx, 'PAUSED', ARENA_WIDTH / 2, 300, 56, GOLD);
  text(ctx, 'Press P or click anywhere to return to the fight.', ARENA_WIDTH / 2, 360, 18, INK);
  state.ui.restartButton = drawButton(ctx, input, ARENA_WIDTH / 2, 410, 240, 52, 'RESTART RUN', false);
}

function drawGameOver(ctx, state, input) {
  ctx.fillStyle = 'rgba(4, 5, 16, 0.7)';
  ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

  const title = state.overCause === 'lantern' ? 'THE LIGHT HAS FALLEN' : 'THE KEEPER HAS FALLEN';
  ctx.save();
  ctx.shadowColor = '#ff5c5c';
  ctx.shadowBlur = 26;
  text(ctx, title, ARENA_WIDTH / 2, 170, 52, '#ff8a7a');
  ctx.restore();

  if (state.newBest) {
    text(ctx, '★ NEW BEST SCORE ★', ARENA_WIDTH / 2, 226, 22, GOLD);
  }

  text(ctx, `FINAL SCORE  ${state.score}`, ARENA_WIDTH / 2, 300, 40, INK);
  const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
  text(ctx, `Wave reached: ${state.wave}      Shadows banished: ${state.kills}      Bolt accuracy: ${accuracy}%`, ARENA_WIDTH / 2, 352, 18, DIM);
  text(ctx, `Best score: ${state.best}`, ARENA_WIDTH / 2, 386, 16, GOLD_DIM);

  state.ui.restartButton = drawButton(ctx, input, ARENA_WIDTH / 2, 440, 260, 58, 'PLAY AGAIN');
  text(ctx, '…or press Enter', ARENA_WIDTH / 2, 526, 15, DIM);
}

/** Draw one frame of the game in its current phase. */
export function drawGame(ctx, state, input, muted) {
  ctx.save();
  if (state.shake > 0.3) {
    const s = state.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground(ctx, state);
  drawLantern(ctx, state);
  drawPickups(ctx, state);
  for (const e of state.enemies) drawEnemy(ctx, e);
  // The keeper stands only while a run is live; the title and the
  // game-over screens are the lantern's stage, not his.
  if (state.phase === 'playing' || state.phase === 'paused') drawPlayer(ctx, state);
  drawBolts(ctx, state);
  drawParticles(ctx, state);
  drawPopups(ctx, state);

  ctx.restore();

  if (state.phase === 'title') {
    drawTitle(ctx, state, input);
    return;
  }
  drawHud(ctx, state, input, muted);
  if (state.phase === 'paused') drawPaused(ctx, state, input);
  if (state.phase === 'over') drawGameOver(ctx, state, input);
}
