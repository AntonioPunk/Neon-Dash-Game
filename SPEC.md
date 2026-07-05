# Neon Dash — Specification

## Overview

Neon Dash is a one-button arcade browser game built with vanilla HTML, CSS, and JavaScript (Canvas 2D). The player controls a glowing orb that jumps to avoid incoming neon obstacles. The game follows a "easy to learn, hard to master" philosophy with increasing difficulty, visual feedback, and a dark neon aesthetic.

---

## File Structure

```
neon-dash/
├── index.html       # Entry point — minimal HTML shell
├── style.css        # Full-page dark styling, canvas sizing, sound toggle button
├── script.js        # All game logic, rendering, audio, input
├── package.json     # Dev script using http-server
├── LICENSE          # MIT License
└── SPEC.md          # This document
```

No external runtime dependencies. The only dev dependency is `http-server` (fetched on-demand via `npx`).

---

## Controls

| Input | Action |
|-------|--------|
| `Space` | Jump / Start game / Restart after death |
| `Click` (mouse) | Same as Space |
| `Tap` (touch) | Same as Space |
| `M` key | Toggle sound on/off |
| SFX button (bottom-right) | Toggle sound on/off |

---

## Game States

Three states managed by the `state` variable:

### 1. `menu`
- Rendered on page load
- Displays: title "NEON DASH" (pulsing), instructions, best score (if any), decorative floating player orb
- Ambient particles drift across the screen
- Pressing Space/Click/Tap transitions to `playing`

### 2. `playing`
- Active gameplay loop
- Player physics (gravity, jump), obstacle spawning and movement, collision detection
- HUD shows: score (center, 4-digit padded, with pop animation on increment), level indicator (top-right, color shifts green→yellow→red as speed increases)
- "GO!" flash animation appears at round start
- Pressing Space/Click/Tap triggers `jump()`

### 3. `gameover`
- Triggers on collision
- Death effects: triple-color particle burst (magenta + red + yellow), screen shake, red/yellow flash overlay
- Overlay with "GAME OVER", final score, best score (or "★ NEW BEST! ★" in gold), pulsing restart prompt
- Pressing Space/Click/Tap immediately transitions back to `playing` (full state reset)

---

## Game Mechanics

### Player
- **Position**: Fixed X = 140px from left. Moves only on Y axis.
- **Size**: 26px diameter circle (collision box is 18px, shrunk by 4px per side for lenient hit detection).
- **Physics**: Gravity = 0.55 px/frame², Jump force = -11.8 px/frame (produces ~127px max jump height).
- **Squash & Stretch**: On jump, vertical scale stretches to 1.3x then lerps back. On landing from height, squashes to 0.7x then lerps back.
- **Motion trail**: 5 ghost ellipses trail behind the player when ascending.
- **Pulse glow**: Outer glow radius oscillates via `sin(frame * 0.08)`.

### Obstacles
- **Spawn**: From the right edge (`x = W`), scroll left at `speed`.
- **Dimensions**:
  - Width: `min(44, 28 + score * 0.25)` — grows with score.
  - Height: `minH = min(55, 25 + score * 1.1)`, `maxH = min(135, 55 + score * 1.6)` — sampled uniformly.
- **Scoring**: When `obstacle.x + width < PLAYER_X`, score increments by 1, triggers pop animation and floating `+1` text.
- **Combo**: Every 5th point triggers a combo sound (3 ascending tones) and a larger yellow particle burst.
- **Visual**: Magenta body with pulsing glow, linear gradient inner fill, bright top edge line, side speed lines.

### Difficulty Progression
Difficulty scales continuously across 4 axes:

| Factor | Formula | Effect |
|--------|---------|--------|
| **Speed** | `BASE_SPEED = 5` → `MAX_SPEED = 16` | Rate of increase: `0.0015 × (1 + score × 0.035)`, capped at `0.008/frame` |
| **Obstacle gap** | `minGap = max(65, 220 − speed×12 − score×2)` | Shrinks with both speed and score |
| **Obstacle frequency** | `spawnTimer /= (1 + score × 0.02)` | Timer divisor increases with score |
| **Obstacle size** | Height and width grow with score (see Obstacles above) | Taller + wider = smaller safe window |

At score 0: comfortable 2-3s gaps. At score 50: gaps under 1s with tall, fast obstacles.

### Collision
- AABB (axis-aligned bounding box) between player and each obstacle.
- Player hitbox: centered at `(PLAYER_X, player.y)`, size 18×18 (8px smaller than visual for forgiveness).
- Obstacle hitbox: `(o.x, getGroundY() − o.h, o.w, o.h)`.

---

## Audio System

Web Audio API with `OscillatorNode` + `GainNode`. No audio files.

### Sound Effects

| Effect | Implementation |
|--------|---------------|
| **Jump** | Frequency sweep 350→700 Hz over 120ms |
| **Score** | Two quick tones: 880 Hz (60ms) then 1100 Hz (80ms) |
| **Combo** | Three ascending tones: 660→880→1100 Hz, each 40-70ms |
| **Death** | Descending sawtooth: 300 Hz → 150 Hz → 80 Hz over 400ms |

### Mute
- Toggled via `M` key or SFX button
- State persisted in `muted` variable (not localStorage)
- AudioContext created lazily on first interaction, resumes if suspended

---

## Particle System

Generic particle pool with position, velocity, life, size, and color.

### Particle Events

| Event | Count | Colors | Speed |
|-------|-------|--------|-------|
| Jump | 10 | Cyan | 4 |
| Score | 8 | Magenta | 5 |
| Combo (score % 5) | 18 | Yellow | 7 |
| Death | 90 total (40+30+20) | Magenta + Red + Yellow | 6-11 |
| Menu ambiance | 1 every 3 frames | Random Cyan/Magenta | 1 |

### Behavior
- Gravity applied: `vy += 0.08` per frame
- Life decays by `0.015–0.04` per frame
- Size scales with remaining life
- Rendered with `globalAlpha` and `shadowBlur` for glow

---

## Rendering Pipeline (per frame)

1. `ctx.save()` + shake offset translation
2. `drawBackground()` — radial gradient + 60 twinkling stars
3. `drawGround()` — glow line, scanning grid (speed-dependent scroll), accent dots
4. `drawObstacles()` — neon magenta blocks with glow
5. `drawPlayer()` — cyan orb with pulse, trail, inner highlight
6. `drawParticles()` — all active particles with glow
7. `drawFloatingTexts()` — "+1" score popups
8. `drawHUD()` — score (with pop scale/color), level indicator
9. `drawGoFlash()` — "GO!" on game start (zoom-out fade)
10. `drawGameOver()` — if state is `gameover` (dim overlay + text)
11. `ctx.restore()`
12. `drawDeathFlash()` — full-screen red/yellow overlay (outside shake)
13. `drawSoundIndicator()` — SFX ON/OFF label

---

## Visual Style

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Background (center) | Deep navy | `#0a0a1e` |
| Background (edges) | Near-black | `#030308` |
| Player / Ground / Score | Cyan | `#00f0ff` |
| Obstacles | Magenta | `#ff00ff` |
| Obstacle top edge | Light magenta | `#ff88ff` |
| Particles (score) | Magenta | `#ff00ff` |
| Particles (combo) | Yellow | `#ffff00` |
| Particles (death) | Magenta + Red + Yellow | `#ff00ff` / `#ff4444` / `#ffff00` |
| New best text | Gold | `#ffff00` |
| Floating +1 text | Light yellow | `#ffff88` |
| Dim overlay | Near-black | `rgba(3, 3, 8, 0.7)` |

### Effects
- **Glow**: Achieved via Canvas `shadowBlur` + `shadowColor` on all game elements
- **Screen shake**: Random offset `(±shake.i/2, ±shake.i/2)` decaying by 0.9×/frame, initial `i=28` on death
- **Death flash**: Red (`rgba(255,0,60,0.25)`) + yellow (`rgba(255,200,0,0.1)`) overlay, decays by 0.92×/frame
- **Score pop**: Scale 1→1.25→1, color cyan→white→cyan, over ~10 frames
- **GO! flash**: 80px text zooming out and fading over ~50 frames

---

## Screens

### Menu Screen
- Pulsing title "NEON DASH" in cyan with magenta subtitle
- 3 instruction lines in dim white
- Best score display (if exists) in magenta
- Decorative player orb bobbing up/down

### Game Over Screen
- Dark overlay (dimmed game still visible behind)
- "GAME OVER" in magenta
- Score in cyan
- "★ NEW BEST! ★" in gold if applicable, else "Best: N" in magenta
- Pulsing restart prompt: `▶ PRESS SPACE TO RETRY ◀`

---

## localStorage

- **Key**: `nd_best`
- **Value**: Highest score achieved (integer)
- **Read**: On page load (`script.js:26`)
- **Write**: On death if current score exceeds stored best (`script.js:612`)
- **Scope**: Single key, no expiry

---

## Responsive Behavior

- Canvas resizes to `window.innerWidth` × `window.innerHeight` on load and on `resize` event
- `GROUND_Y` recalcs as `H − 100` on resize
- Player physics corrects itself via ground collision each frame
- Obstacle positions recalculated relative to `GROUND_Y` each frame
- Touch input handled with `preventDefault()` to prevent scrolling

---

## Performance

- Game loop via `requestAnimationFrame` (pauses when tab hidden)
- Particle pool manually managed with backwards `splice` iteration
- Obstacle pool similarly managed
- Star positions use modulo arithmetic (no per-frame reallocation)
- Audio context created lazily
- No image assets, no font loading, no layout thrashing

---

## Development

To run locally:

```bash
# With Python (no install needed)
python3 -m http.server 3000

# With pnpm (requires Node.js)
pnpm dev
# → runs: npx http-server . -p 3000 -c-1 -o
```

No build step. Open `http://localhost:3000` in any modern browser.

---

## License

MIT © [Antonio Arias Ureta](https://github.com/AntonioPunk)

See [LICENSE](LICENSE).
