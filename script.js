const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const soundBtn = document.getElementById('sound-btn');

let W, H, GROUND_Y;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  GROUND_Y = H - 100;
}
resize();
window.addEventListener('resize', resize);

const PLAYER_SIZE = 26;
const PLAYER_X = 140;
const GRAVITY = 0.55;
const JUMP_FORCE = -11.8;
const BASE_SPEED = 5;
const MAX_SPEED = 16;
const SPEED_INCR = 0.0015;
const OBSTACLE_W = 28;

let state = 'menu';
let score = 0;
let best = +(localStorage.getItem('nd_best') || 0);
let speed = BASE_SPEED;
let player = { y: 0, vy: 0 };
let obstacles = [];
let particles = [];
let shake = { x: 0, y: 0, i: 0 };
let muted = false;
let frame = 0;
let stars = [];
let canJump = true;
let playerSquash = 1;
let scorePop = 0;
let deathFlash = 0;
let floatingTexts = [];
let goFlash = 0;

for (let i = 0; i < 60; i++) {
  stars.push({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.5, b: 0.3 + Math.random() * 0.7 });
}

function getGroundY() { return GROUND_Y; }

function resetPlayer() {
  player.y = getGroundY() - PLAYER_SIZE / 2;
  player.vy = 0;
  playerSquash = 1;
  canJump = true;
}

// ─── Audio ───────────────────────────────────────────
let actx = null;

function getAudio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}

function tone(freq, dur, type, vol) {
  if (muted) return;
  try {
    const c = getAudio();
    if (c.state === 'suspended') c.resume();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'square';
    if (typeof freq === 'object') {
      o.frequency.setValueAtTime(freq[0], c.currentTime);
      o.frequency.linearRampToValueAtTime(freq[1], c.currentTime + dur);
    } else {
      o.frequency.setValueAtTime(freq, c.currentTime);
    }
    g.gain.setValueAtTime(vol || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch (_) {}
}

function sfxJump() {
  tone([350, 700], 0.12, 'square', 0.07);
}

function sfxScore() {
  tone(880, 0.06, 'square', 0.06);
  setTimeout(() => tone(1100, 0.08, 'square', 0.05), 60);
}

function sfxDeath() {
  tone(300, 0.15, 'sawtooth', 0.1);
  setTimeout(() => tone(150, 0.25, 'sawtooth', 0.08), 100);
  setTimeout(() => tone(80, 0.4, 'sawtooth', 0.06), 250);
}

function sfxCombo() {
  tone(660, 0.05, 'square', 0.05);
  setTimeout(() => tone(880, 0.05, 'square', 0.05), 40);
  setTimeout(() => tone(1100, 0.07, 'square', 0.04), 80);
}

// ─── Particles ───────────────────────────────────────
function burst(x, y, count, color, spd) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * spd + 0.5;
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 1.5,
      life: 1,
      decay: 0.015 + Math.random() * 0.025,
      size: 2 + Math.random() * 4,
      color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life * 0.9;
    ctx.shadowBlur = 12;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// ─── Obstacles ───────────────────────────────────────
let spawnTimer = 0;

function spawnObstacle() {
  const maxH = Math.min(135, 55 + score * 1.6);
  const minH = Math.min(55, 25 + score * 1.1);
  const h = minH + Math.random() * (maxH - minH);
  const w = Math.min(44, OBSTACLE_W + score * 0.25);
  obstacles.push({ x: W, w, h, scored: false });
}

function updateObstacles() {
  spawnTimer--;
  if (spawnTimer <= 0) {
    spawnObstacle();
    const diffMult = 1 + score * 0.02;
    const minGap = Math.max(65, 220 - speed * 12 - score * 2);
    const maxGap = Math.max(100, 320 - speed * 12 - score * 2);
    spawnTimer = Math.floor((minGap + Math.random() * (maxGap - minGap)) / diffMult);
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= speed;
    if (o.x + o.w < -20) { obstacles.splice(i, 1); continue; }
    if (!o.scored && o.x + o.w < PLAYER_X) {
      o.scored = true;
      score++;
      scorePop = 1;
      floatingTexts.push({ x: W / 2 + (Math.random() - 0.5) * 60, y: 52, text: '+1', life: 1, vy: -0.8 });
      const isCombo = score % 5 === 0;
      if (isCombo) { sfxCombo(); burst(W / 2, 50, 18, '#ffff00', 7); }
      else { sfxScore(); burst(W / 2, 50, 8, '#ff00ff', 5); }
    }
  }
}

function drawObstacles() {
  for (const o of obstacles) {
    const y = getGroundY() - o.h;
    const pulse = 1 + Math.sin(frame * 0.06 + o.x * 0.01) * 0.06;

    // Outer glow
    ctx.shadowBlur = 25 * pulse;
    ctx.shadowColor = '#ff00ff';

    // Main body
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(o.x, y, o.w, o.h);

    // Inner fill
    ctx.shadowBlur = 0;
    const g = ctx.createLinearGradient(o.x, y, o.x, getGroundY());
    g.addColorStop(0, 'rgba(255, 0, 255, 0.4)');
    g.addColorStop(1, 'rgba(255, 0, 255, 0.05)');
    ctx.fillStyle = g;
    ctx.fillRect(o.x + 2, y + 2, o.w - 4, o.h - 4);

    // Top bright line
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff88ff';
    ctx.fillStyle = '#ff88ff';
    ctx.fillRect(o.x - 2, y - 2, o.w + 4, 3);

    // Speed lines on sides
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 0, 255, 0.15)';
    for (let s = 0; s < 3; s++) {
      const lx = o.x + o.w + 4 + s * 6;
      ctx.fillRect(lx, y + 5, 2, o.h - 10);
    }
  }
  ctx.shadowBlur = 0;
}

// ─── Player ──────────────────────────────────────────
function updatePlayer() {
  const gy = getGroundY() - PLAYER_SIZE / 2;

  player.vy += GRAVITY;
  player.y += player.vy;

  if (player.y >= gy) {
    if (player.vy > 4) {
      playerSquash = 0.7;
    }
    player.y = gy;
    player.vy = 0;
    canJump = true;
  }

  playerSquash += (1 - playerSquash) * 0.15;
}

function jump() {
  if (!canJump || state !== 'playing') return;
  const gy = getGroundY() - PLAYER_SIZE / 2;
  if (player.y + 2 < gy) return;
  player.vy = JUMP_FORCE;
  canJump = false;
  playerSquash = 1.3;
  sfxJump();
  burst(PLAYER_X, player.y + PLAYER_SIZE / 2, 10, '#00f0ff', 4);
}

function drawPlayer() {
  const gy = getGroundY() - PLAYER_SIZE / 2;
  const size = PLAYER_SIZE / 2;
  const sq = playerSquash;
  const drawW = size / sq;
  const drawH = size * sq;
  const pulse = 1 + Math.sin(frame * 0.08) * 0.06;

  ctx.save();
  ctx.translate(PLAYER_X, player.y);

  // Motion trail
  if (player.vy < 0) {
    ctx.globalAlpha = 0.1;
    for (let t = 1; t <= 5; t++) {
      const ty = player.vy * t * 1.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.ellipse(0, ty, drawW * (1 - t * 0.12), drawH * (1 - t * 0.12), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Outer glow (pulsing)
  ctx.shadowBlur = 35 * pulse;
  ctx.shadowColor = '#00f0ff';

  // Body
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, drawW, drawH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight
  ctx.shadowBlur = 0;
  const grad = ctx.createRadialGradient(-drawW * 0.3, -drawH * 0.3, 0, 0, 0, drawW);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.2, '#88ffff');
  grad.addColorStop(0.55, '#00f0ff');
  grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, drawW, drawH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.shadowBlur = 0;
}

// ─── Background / Environment ────────────────────────
function drawBackground() {
  const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, '#0a0a1e');
  grad.addColorStop(0.5, '#070714');
  grad.addColorStop(1, '#030308');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of stars) {
    const sx = (s.x + frame * s.b * 0.1) % W;
    const sy = (s.y + frame * s.b * 0.05) % H;
    const bright = 0.3 + Math.sin(frame * 0.02 + s.x) * 0.2;
    ctx.fillStyle = `rgba(255, 255, 255, ${s.b * bright * 0.5})`;
    ctx.fillRect(sx, sy, s.s, s.s);
  }
}

function drawGround() {
  const gy = getGroundY();

  // Ground fill
  ctx.fillStyle = 'rgba(0, 240, 255, 0.03)';
  ctx.fillRect(0, gy, W, H - gy);

  // Main glow line
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#00f0ff';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(W, gy);
  ctx.stroke();

  // Scanning grid lines
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1;
  const offset = (frame * speed * 0.4) % 60;
  for (let x = -offset; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Small accent dots along ground
  ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
  for (let x = 0; x < W; x += 25) {
    const dx = (x + frame * speed * 0.3) % (W + 25);
    ctx.fillRect(dx, gy + 6, 3, 3);
  }

  ctx.shadowBlur = 0;
}

// ─── HUD ─────────────────────────────────────────────
function drawHUD() {
  // Score with pop animation
  const popScale = 1 + scorePop * 0.25;
  const scoreColor = scorePop > 0.3 ? '#ffffff' : '#00f0ff';
  ctx.save();
  ctx.translate(W / 2, 50);
  ctx.scale(popScale, popScale);
  ctx.shadowBlur = 20;
  ctx.shadowColor = scoreColor;
  ctx.fillStyle = scoreColor;
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  const scoreStr = String(score).padStart(4, '0');
  ctx.fillText(scoreStr, 0, 0);
  ctx.restore();

  // Speed indicator with difficulty info
  ctx.shadowBlur = 8;
  const danger = speed / MAX_SPEED;
  ctx.shadowColor = `rgba(255, ${Math.floor(255 * (1 - danger))}, 0, 0.6)`;
  ctx.fillStyle = `rgba(255, ${Math.floor(255 * (1 - danger))}, 0, 0.6)`;
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`LV ${Math.floor(speed / BASE_SPEED)}`, W - 16, 28);

  ctx.shadowBlur = 0;
}

function drawFloatingTexts() {
  for (const t of floatingTexts) {
    ctx.globalAlpha = t.life;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffff88';
    ctx.fillStyle = '#ffff88';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawDeathFlash() {
  if (deathFlash > 0.01) {
    ctx.fillStyle = `rgba(255, 0, 60, ${deathFlash * 0.25})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255, 200, 0, ${deathFlash * 0.1})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGoFlash() {
  if (goFlash > 0.05) {
    const s = 1 + (1 - goFlash) * 0.5;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.globalAlpha = goFlash * 0.7;
    ctx.shadowBlur = 40;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GO!', 0, 10);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

// ─── Screens ─────────────────────────────────────────
function drawMenu() {
  drawBackground();
  drawGround();

  // Floating particles for ambiance
  if (frame % 3 === 0) {
    burst(Math.random() * W, Math.random() * H * 0.7, 1, Math.random() > 0.5 ? '#00f0ff' : '#ff00ff', 1);
  }
  updateParticles();
  drawParticles();

  // Title
  const titlePulse = 1 + Math.sin(frame * 0.04) * 0.05;
  ctx.save();
  ctx.translate(W / 2, H * 0.3);
  ctx.scale(titlePulse, titlePulse);

  ctx.shadowBlur = 40;
  ctx.shadowColor = '#00f0ff';
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NEON DASH', 0, 0);

  ctx.shadowBlur = 15;
  ctx.shadowColor = '#ff00ff';
  ctx.fillStyle = '#ff00ff';
  ctx.font = '14px monospace';
  ctx.fillText('█ PRESS SPACE TO START █', 0, 55);

  ctx.restore();

  // Instructions
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';

  const instructions = [
    'SPACE / CLICK / TAP to jump',
    'Dodge the neon obstacles',
    'Survive as long as you can'
  ];

  let iy = H * 0.5;
  for (const line of instructions) {
    ctx.fillText(line, W / 2, iy);
    iy += 28;
  }

  // Best score
  if (best > 0) {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`BEST: ${best}`, W / 2, iy + 20);
  }

  ctx.shadowBlur = 0;

  // Decorative player
  const py = H * 0.72 + Math.sin(frame * 0.04) * 8;
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#00f0ff';
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(W / 2, py, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  const ig = ctx.createRadialGradient(W / 2 - 4, py - 4, 0, W / 2, py, 18);
  ig.addColorStop(0, '#ffffff');
  ig.addColorStop(0.3, '#00f0ff');
  ig.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(W / 2, py, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawGameOver() {
  // Dim overlay
  ctx.fillStyle = 'rgba(3, 3, 8, 0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Game over title
  ctx.shadowBlur = 35;
  ctx.shadowColor = '#ff00ff';
  ctx.fillStyle = '#ff00ff';
  ctx.font = 'bold 56px monospace';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 90);

  // Score
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#00f0ff';
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 32px monospace';
  ctx.fillText(`SCORE: ${score}`, W / 2, H / 2 - 15);

  // Best or New Best
  if (score > 0 && score >= best) {
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ffff00';
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('★ NEW BEST! ★', W / 2, H / 2 + 35);
  } else {
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.font = '18px monospace';
    ctx.fillText(`Best: ${best}`, W / 2, H / 2 + 35);
  }

  // Restart hint (pulsing)
  const blink = 0.5 + Math.sin(frame * 0.08) * 0.5;
  ctx.globalAlpha = 0.4 + blink * 0.6;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#00f0ff';
  ctx.fillStyle = '#00f0ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('▶ PRESS SPACE TO RETRY ◀', W / 2, H / 2 + 100);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawSoundIndicator() {
  ctx.fillStyle = muted ? 'rgba(255,0,255,0.25)' : 'rgba(0,240,255,0.25)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(muted ? 'SFX OFF [M]' : 'SFX ON [M]', 12, H - 12);
}

// ─── Collision ───────────────────────────────────────
function checkCollision() {
  const px = PLAYER_X - PLAYER_SIZE / 2 + 4;
  const py = player.y - PLAYER_SIZE / 2 + 4;
  const ps = PLAYER_SIZE - 8;

  for (const o of obstacles) {
    const oy = getGroundY() - o.h;
    if (px < o.x + o.w && px + ps > o.x && py < oy + o.h && py + ps > oy) {
      return true;
    }
  }
  return false;
}

// ─── Game State ──────────────────────────────────────
function startGame() {
  state = 'playing';
  score = 0;
  speed = BASE_SPEED;
  obstacles = [];
  particles = [];
  floatingTexts = [];
  scorePop = 0;
  deathFlash = 0;
  goFlash = 1;
  spawnTimer = 60;
  resetPlayer();
}

function die() {
  state = 'gameover';
  sfxDeath();
  burst(PLAYER_X, player.y, 40, '#ff00ff', 11);
  burst(PLAYER_X, player.y, 30, '#ff4444', 8);
  burst(PLAYER_X, player.y, 20, '#ffff00', 6);
  shake.i = 28;
  deathFlash = 1;
  if (score > best) {
    best = score;
    localStorage.setItem('nd_best', best);
  }
}

// ─── Main Loop ───────────────────────────────────────
function update() {
  frame++;

  if (state === 'playing') {
    updatePlayer();
    updateObstacles();
    updateParticles();

    const speedRate = Math.min(0.008, SPEED_INCR * (1 + score * 0.035));
    if (speed < MAX_SPEED) speed += speedRate;

    if (checkCollision()) die();
  }

  // Always update stars
  stars.forEach(s => {
    s.x += s.b * 0.05;
    if (s.x > W) s.x = 0;
  });

  // Score pop decay
  if (scorePop > 0) scorePop *= 0.88;

  // Floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const t = floatingTexts[i];
    t.y += t.vy;
    t.life -= 0.02;
    if (t.life <= 0) floatingTexts.splice(i, 1);
  }

  // Death flash decay
  if (deathFlash > 0) deathFlash *= 0.92;

  // GO flash decay
  if (goFlash > 0) goFlash *= 0.94;

  // Screen shake
  if (shake.i > 0) {
    shake.x = (Math.random() - 0.5) * shake.i;
    shake.y = (Math.random() - 0.5) * shake.i;
    shake.i *= 0.9;
    if (shake.i < 0.5) { shake.i = 0; shake.x = 0; shake.y = 0; }
  } else {
    shake.x = 0;
    shake.y = 0;
  }
}

function draw() {
  ctx.save();
  ctx.translate(shake.x, shake.y);

  if (state === 'menu') {
    drawMenu();
  } else {
    drawBackground();
    drawGround();
    drawObstacles();
    drawPlayer();
    drawParticles();
    drawFloatingTexts();
    drawHUD();
    drawGoFlash();
    if (state === 'gameover') {
      drawGameOver();
    }
  }

  ctx.restore();
  drawDeathFlash();
  drawSoundIndicator();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ─── Input ───────────────────────────────────────────
function handleJump() {
  if (state === 'menu') { startGame(); return; }
  if (state === 'playing') { jump(); return; }
  if (state === 'gameover') { startGame(); return; }
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    handleJump();
  }
  if (e.key === 'm' || e.key === 'M') {
    muted = !muted;
    soundBtn.textContent = muted ? 'MUTE' : 'SFX';
    soundBtn.classList.toggle('muted', muted);
  }
});

canvas.addEventListener('click', handleJump);
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  handleJump();
});

soundBtn.addEventListener('click', () => {
  muted = !muted;
  soundBtn.textContent = muted ? 'MUTE' : 'SFX';
  soundBtn.classList.toggle('muted', muted);
});

// ─── Init ────────────────────────────────────────────
resetPlayer();
loop();
