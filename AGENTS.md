# Neon Dash — Agent Guide

## Run

```bash
python3 -m http.server 3000          # no install needed
# or: npx http-server . -p 3000 -c-1
```

No build step, no dependencies. Open `http://localhost:3000`.

No test/lint/typecheck commands exist.

## Architecture

- **Canvas 2D** game loop via `requestAnimationFrame`. All game objects rendered on a single canvas — no DOM elements for gameplay.
- **Three states**: `menu` → `playing` → `gameover`. Transitioned by space/click/tap via `handleJump()`.
- **Single JS file** `script.js` (~730 lines). Sections: Audio, Particles, Obstacles, Player, Background, HUD, Screens, Collision, Game State, Main Loop, Input.
- **Audio**: Web Audio API `OscillatorNode` + `GainNode` — no audio files. `AudioContext` created lazily; must `.resume()` after user gesture.

## Key Conventions

- **Game constants** (physics, sizes, speeds) are uppercase globals at the top of `script.js`. Tuning values there is the primary balance lever.
- **Difficulty** scales across 4 axes in `updateObstacles()` + `update()`: speed increment, obstacle gap, spawn timer divisor, obstacle height/width. All driven by `score`.
- **Particles** are manually managed in an array with backwards `splice` iteration. Add new burst calls in the relevant event function (`jump()`, `updateObstacles()`, `die()`).
- **Canvas shadow** (`shadowBlur` + `shadowColor`) is used for all neon glow effects. Must reset to `0` after each draw call or it leaks to subsequent draws.
- **Resize**: `resize()` recalculates `GROUND_Y = H - 100`. Player physics self-corrects via ground collision each frame. Obstacle Y is recomputed from `getGroundY()` per frame.

## Quirks & Gotchas

- **Touch**: `touchstart` listener **must** call `e.preventDefault()` to prevent page scroll on mobile.
- **Audio blocked**: Chrome blocks `AudioContext` until user gesture. `getAudio()` calls `.resume()` if suspended — but first call must still originate from a user event handler.
- **Sound toggle**: visual state synced between `muted` var, the button text/class, and the `drawSoundIndicator()` canvas text. Keep all three in sync when toggling.
- **localStorage key**: `nd_best`. Only read once at init, written on death.
- **No classes** — pure functions + module-level mutable state. Reset all state arrays in `startGame()`.
- **`canJump` gate**: player can only jump when `canJump === true` (set to `true` on ground contact, set `false` immediately on jump). Prevents double-jump.

## Adding Sound Effects

Create a new `sfxXxx()` function following the existing pattern (use `tone()` with frequency/array, duration, waveform type, volume). Call it at the appropriate event point. No audio files needed.

## Adding Visual Effects

- **Burst particles**: `burst(x, y, count, color, speed)` — call at event point.
- **Screen shake**: set `shake.i = N` (decays 0.9×/frame).
- **Floating text**: push `{ x, y, text, life: 1, vy: -0.8 }` to `floatingTexts[]`.
- **Flash overlays**: set `deathFlash = 1` (decays 0.92×/frame) — drawn in `drawDeathFlash()`.
- **GO! flash**: set `goFlash = 1` → auto-drawn during `playing` state.
