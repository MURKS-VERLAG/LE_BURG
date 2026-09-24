'use strict';

const game = document.getElementById('game');
const map = document.getElementById('map');

// Drei feste Zoomstufen. Stufe 0 ist immer die vollständig sichtbare,
// randlose Ausgangskarte. Die beiden anderen Stufen vergrößern die Map.
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
  // contain: Auf der äußersten Stufe ist garantiert das GESAMTE Motiv sichtbar.
  // Die Body-Hintergrundfarbe entspricht dem dunklen Kartenrand; bei 3:2-Displays
  // füllt das 3:2-Bild exakt. Andere Seitenverhältnisse werden ohne Cropping behandelt.
  baseScale = Math.min(w / map.naturalWidth, h / map.naturalHeight);
}

function renderedSize() {
  const z = ZOOM_LEVELS[zoomIndex];
  return {
    w: map.naturalWidth * baseScale * z,
    h: map.naturalHeight * baseScale * z
  };
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

  // Maus rechts -> Karte sanft nach links; Maus unten -> Karte nach oben.
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
  // Langsames Hover-Panning statt direktem Mitspringen.
  currentX += (targetX - currentX) * 0.055;
  currentY += (targetY - currentY) * 0.055;

  if (zoomIndex === 0) {
    currentX *= 0.82;
    currentY *= 0.82;
  }

  map.style.transform = `translate(-50%, -50%) translate(${currentX}px, ${currentY}px) scale(${baseScale * z})`;
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

function start() {
  calculateBaseScale();
  currentX = currentY = targetX = targetY = 0;
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
