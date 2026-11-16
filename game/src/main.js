// Main — boots Lumenfall: the canvas, the loop, the menus' clicks and
// keys, and the deterministic screenshot scenes (?shot=title|play|over).
// The game logic lives in game-state.js, the drawing in render.js, the
// sounds in sound.js and the keys and mouse in input.js; this file only
// wires them together and steps the world forward.

import { ARENA_HEIGHT, ARENA_WIDTH, Input } from './input.js';
import { createGame, setupShotScene, startRun, update } from './game-state.js';
import { drawGame, inside } from './render.js';
import { SoundBank } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new SoundBank();
const state = createGame();

// A handle for scripted play-tests (and for curious players in devtools).
window.__lumenfall = state;

const params = new URLSearchParams(window.location.search);
const shotScene = params.get('shot');
const shotMode = shotScene === 'title' || shotScene === 'play' || shotScene === 'over';

/** A still input for the screenshot scenes: no movement, no firing. */
const stillInput = {
  moveVector: () => ({ x: 0, y: 0 }),
  firing: () => false,
  mouseX: ARENA_WIDTH / 2,
  mouseY: ARENA_HEIGHT / 2 - 160,
};

function beginRun() {
  sound.ensure();
  sound.click();
  startRun(state, sound);
}

function togglePause() {
  if (state.phase === 'playing') {
    state.phase = 'paused';
    sound.click();
  } else if (state.phase === 'paused') {
    state.phase = 'playing';
    sound.click();
  }
}

function toggleMute() {
  sound.ensure();
  sound.setMuted(!sound.muted);
}

/** One frame of menu keys and clicks; returns nothing. */
function handleMenus() {
  if (input.wasPressed('KeyM')) toggleMute();

  if (state.phase === 'title' && (input.wasPressed('Enter') || input.wasPressed('Space'))) {
    beginRun();
    return;
  }
  if (state.phase === 'over' && input.wasPressed('Enter')) {
    beginRun();
    return;
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (state.phase === 'playing' || state.phase === 'paused') togglePause();
  }

  let click;
  while ((click = input.takeClick()) !== null) {
    sound.ensure();
    if (state.phase === 'title') {
      if (inside(state.ui.startButton, click.x, click.y)) beginRun();
    } else if (state.phase === 'over') {
      if (inside(state.ui.restartButton, click.x, click.y)) beginRun();
    } else if (state.phase === 'paused') {
      if (inside(state.ui.restartButton, click.x, click.y)) beginRun();
      else togglePause();
    } else if (state.phase === 'playing') {
      if (inside(state.ui.pauseButton, click.x, click.y)) togglePause();
      else if (inside(state.ui.muteButton, click.x, click.y)) toggleMute();
    }
  }
}

if (shotMode) {
  // A screenshot scene: build the fixed scene, settle it a few steps so
  // the action reads as mid-flight, draw it once, and raise the flag the
  // screenshot script waits for. The frame then stays frozen.
  setupShotScene(state, shotScene);
  for (let i = 0; i < 12; i++) update(state, 1 / 60, stillInput, null);
  drawGame(ctx, state, stillInput, false);
  window.__shotReady = true;
  const keepFrame = () => {
    drawGame(ctx, state, stillInput, false);
    requestAnimationFrame(keepFrame);
  };
  requestAnimationFrame(keepFrame);
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    handleMenus();
    if (state.phase === 'playing' || state.phase === 'title') {
      update(state, dt, input, sound);
    }
    drawGame(ctx, state, input, sound.muted);
    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
