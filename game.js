'use strict';

const game = document.getElementById('game');
const world = document.getElementById('world');
const map = document.getElementById('map');

const WORLD_W = 1536;
const WORLD_H = 1024;

// Drei feste Zoomstufen. Stufe 0 zeigt die gesamte Karte.
const ZOOM_LEVELS = [1, 1.45, 2.05];
let zoomIndex = 0;
let baseScale = 1;
let pointerX = 0.5;
let pointerY = 0.5;
let currentX = 0;
let currentY = 0;
let targetX = 0;
let targetY = 0;
let rafId = 0;

function viewport() {
  return { w: game.clientWidth, h: game.clientHeight };
}

function calculateBaseScale() {
  const { w, h } = viewport();
  baseScale = Math.min(w / WORLD_W, h / WORLD_H);
}

function renderedSize() {
  const z = ZOOM_LEVELS[zoomIndex];
  return { w: WORLD_W * baseScale * z, h: WORLD_H * baseScale * z };
}

function updateTargetFromPointer() {
  if (zoomIndex === 0) {
    targetX = 0;
    targetY = 0;
    return;
  }

  const { w: vw, h: vh } = viewport();
  const { w, h } = renderedSize();
  const overflowX = Math.max(0, w - vw);
  const overflowY = Math.max(0, h - vh);

  targetX = -(pointerX - 0.5) * overflowX;
  targetY = -(pointerY - 0.5) * overflowY;
}

function clampPosition() {
  if (zoomIndex === 0) {
    targetX = targetY = 0;
    return;
  }
  const { w: vw, h: vh } = viewport();
  const { w, h } = renderedSize();
  const maxX = Math.max(0, (w - vw) / 2);
  const maxY = Math.max(0, (h - vh) / 2);
  targetX = Math.max(-maxX, Math.min(maxX, targetX));
  targetY = Math.max(-maxY, Math.min(maxY, targetY));
}

function draw() {
  const z = ZOOM_LEVELS[zoomIndex];
  currentX += (targetX - currentX) * 0.055;
  currentY += (targetY - currentY) * 0.055;

  if (zoomIndex === 0) {
    currentX *= 0.82;
    currentY *= 0.82;
  }

  world.style.transform =
    `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) scale(${baseScale * z})`;

  rafId = requestAnimationFrame(draw);
}

function setZoom(nextIndex) {
  zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, nextIndex));
  updateTargetFromPointer();
  clampPosition();
}

game.addEventListener('mousemove', (event) => {
  const rect = game.getBoundingClientRect();
  pointerX = (event.clientX - rect.left) / rect.width;
  pointerY = (event.clientY - rect.top) / rect.height;
  updateTargetFromPointer();
  clampPosition();
});

game.addEventListener('wheel', (event) => {
  event.preventDefault();
  if (event.deltaY < 0) setZoom(zoomIndex + 1);
  else if (event.deltaY > 0) setZoom(zoomIndex - 1);
}, { passive: false });

window.addEventListener('resize', () => {
  calculateBaseScale();
  updateTargetFromPointer();
  clampPosition();
});

/* ============================================================
   ALPHA-GENAUE HARTE KOLLISION
   ------------------------------------------------------------
   Keine Rechteck-Kollision:
   Für jedes kollidierbare transparente PNG wird dessen Alpha-
   Kanal ausgelesen. Nur tatsächlich sichtbare Pixel blockieren.
   Der Baum trägt absichtlich KEINE Kollision.

   Später kann die Spielfigur direkt benutzen:
       BurgCollision.pointBlocked(worldX, worldY)
   oder für einen Radius:
       BurgCollision.circleBlocked(worldX, worldY, radius)
   ============================================================ */

const collisionSprites = [];

function cssNumber(el, prop) {
  return parseFloat(getComputedStyle(el)[prop]) || 0;
}

async function buildAlphaCollision(el) {
  await el.decode().catch(() => {});
  const w = Math.max(1, Math.round(el.naturalWidth));
  const h = Math.max(1, Math.round(el.naturalHeight));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(el, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h).data;

  // Kompakte 1-Byte-Alpha-Maske.
  const alpha = new Uint8Array(w * h);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) alpha[i] = rgba[p];

  collisionSprites.push({
    id: el.id,
    el,
    alpha,
    sourceW: w,
    sourceH: h
  });
}

function pointHitsSprite(sprite, worldX, worldY) {
  const el = sprite.el;
  const left = cssNumber(el, 'left');
  const top = cssNumber(el, 'top');
  const displayW = el.getBoundingClientRect().width /
    (baseScale * ZOOM_LEVELS[zoomIndex]);
  const displayH = el.getBoundingClientRect().height /
    (baseScale * ZOOM_LEVELS[zoomIndex]);

  if (worldX < left || worldY < top ||
      worldX >= left + displayW || worldY >= top + displayH) return false;

  const sx = Math.min(sprite.sourceW - 1,
    Math.max(0, Math.floor((worldX - left) / displayW * sprite.sourceW)));
  const sy = Math.min(sprite.sourceH - 1,
    Math.max(0, Math.floor((worldY - top) / displayH * sprite.sourceH)));

  // Harte Kante entlang des tatsächlichen ausgeschnittenen PNG-Rands.
  return sprite.alpha[sy * sprite.sourceW + sx] >= 24;
}

function pointBlocked(worldX, worldY) {
  for (const sprite of collisionSprites) {
    if (pointHitsSprite(sprite, worldX, worldY)) return true;
  }
  return false;
}

function circleBlocked(worldX, worldY, radius = 8) {
  if (pointBlocked(worldX, worldY)) return true;
  const samples = 16;
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    if (pointBlocked(
      worldX + Math.cos(a) * radius,
      worldY + Math.sin(a) * radius
    )) return true;
  }
  return false;
}

window.BurgCollision = {
  pointBlocked,
  circleBlocked,
  sprites: collisionSprites
};

async function prepareCollisions() {
  const els = [...document.querySelectorAll('.collidable[data-collision="alpha"]')];
  await Promise.all(els.map(buildAlphaCollision));
}

async function start() {
  calculateBaseScale();
  currentX = currentY = targetX = targetY = 0;

  await prepareCollisions();

  document.body.classList.add('game-ready');
  cancelAnimationFrame(rafId);
  draw();
}

if (map.complete && map.naturalWidth > 0) start();
else {
  map.addEventListener('load', start, { once: true });
  map.addEventListener('error', () => {
    document.getElementById('loading').textContent = 'KARTE KONNTE NICHT GELADEN WERDEN';
  }, { once: true });
}
