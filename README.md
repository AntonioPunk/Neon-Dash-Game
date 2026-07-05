# Neon Dash

A one-button arcade browser game built with vanilla HTML, CSS, and JavaScript (Canvas 2D). Control a glowing orb that jumps to avoid incoming neon obstacles. Easy to learn, hard to master.

**[Play it live](https://antonio-pozo.github.io/NeonDash_Game/)**

## How to Run

```bash
python3 -m http.server 3000
# or
npx http-server . -p 3000 -c-1
```

Open `http://localhost:3000`. No build step, no dependencies.

## Controls

| Input             | Action                        |
|-------------------|-------------------------------|
| `Space`           | Jump / Start / Restart        |
| Click (mouse)     | Same as Space                 |
| Tap (touch)       | Same as Space                 |
| `M` key           | Toggle sound on/off           |
| SFX button        | Toggle sound on/off           |

## Gameplay

- **Score** increases by 1 for each obstacle you pass. Every 5th point triggers a combo bonus.
- **Difficulty** scales continuously in 4 axes: speed, obstacle gap, spawn frequency, and obstacle size — all driven by your score.
- **Collision** uses a forgiving hitbox (18×18 px vs 26×26 px visual) to keep the game fair.
- **Death** triggers screen shake, flash overlays, and a triple-color particle burst.

## Visual Style

- Dark neon aesthetic with deep navy backgrounds and twinkling stars
- Cyan player, ground, and HUD elements
- Magenta obstacles with pulsing glow and scanning grid lines
- All glow effects achieved via Canvas `shadowBlur` and `shadowColor`

## Audio

- Entirely synthesized via Web Audio API (`OscillatorNode` + `GainNode`)
- Procedural sound effects for jump, score, combo, and death
- No audio files required

## Architecture

- **Single file** (`script.js`, ~730 lines) — sections: Audio, Particles, Obstacles, Player, Background, HUD, Screens, Collision, Game State, Main Loop, Input
- **Three states**: `menu` → `playing` → `gameover`, transitioned by space/click/tap
- **Pure functions** with module-level mutable state — no classes
- **Canvas 2D** rendering via `requestAnimationFrame`

## Technical Details

- Player physics: gravity 0.55 px/frame², jump force −11.8 px/frame (~127 px max height)
- Obstacles scroll from right edge at speed 5–16 px/frame
- Best score persisted in `localStorage` under key `nd_best`
- Responsive canvas — resizes to `window.innerWidth` × `window.innerHeight`
- Touch input includes `preventDefault()` to prevent page scroll on mobile

## Project Structure

```
neon-dash/
├── index.html       # Minimal HTML shell
├── style.css        # Full-page dark styling, canvas sizing, sound toggle button
├── script.js        # All game logic, rendering, audio, input
├── SPEC.md          # Detailed specification
└── package.json     # Dev script for http-server
```
