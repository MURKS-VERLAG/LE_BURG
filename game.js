'use strict';

const game = document.getElementById('game');
const world = document.getElementById('world');
const map = document.getElementById('map');
const bgMusic = document.getElementById('bgMusic');
const player = document.getElementById('player');
const irisTransition = document.getElementById('irisTransition');

const WORLD_W = 1536;
const WORLD_H = 1024;
const ZOOM_LEVELS = [1, 1.55];

let zoomIndex = 0;
let baseScale = 1;
let pointerX = 0.5, pointerY = 0.5;
let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
let rafId = 0;
let currentMap = 1;
let mapTransitioning = false;

/* MAP 1: exakt nur der bisher markierte Eingang ist in der Wirtschafts-Hitbox offen. */
const WIRTSCHAFT_DOOR_PASSAGE={x1:748,x2:808,y1:318,y2:392};
const WIRTSCHAFT_DOOR_TRIGGER={x1:754,x2:802,y:334};

/* MAP 2 – neue Innenkarte. Alte Map-2-Hitboxen/Occluder vollständig entfernt. */
const MAP2_SPAWN={x:768,y:735};

function viewport(){ return {w:game.clientWidth,h:game.clientHeight}; }
function calculateBaseScale(){
  const {w,h}=viewport();
  baseScale=Math.min(w/WORLD_W,h/WORLD_H);
}
function renderedSize(){
  const z=ZOOM_LEVELS[zoomIndex];
  return {w:WORLD_W*baseScale*z,h:WORLD_H*baseScale*z};
}
function updateTargetFromPointer(){
  if(zoomIndex===0){targetX=0;targetY=0;return;}
  const {w:vw,h:vh}=viewport();
  const {w,h}=renderedSize();
  targetX=-(pointerX-.5)*Math.max(0,w-vw);
  targetY=-(pointerY-.5)*Math.max(0,h-vh);
}
function clampPosition(){
  if(zoomIndex===0){targetX=targetY=0;return;}
  const {w:vw,h:vh}=viewport(), {w,h}=renderedSize();
  const maxX=Math.max(0,(w-vw)/2), maxY=Math.max(0,(h-vh)/2);
  targetX=Math.max(-maxX,Math.min(maxX,targetX));
  targetY=Math.max(-maxY,Math.min(maxY,targetY));
}
function draw(now){
  const z=ZOOM_LEVELS[zoomIndex];
  currentX+=(targetX-currentX)*.055;
  currentY+=(targetY-currentY)*.055;
  if(zoomIndex===0){ currentX*=.82; currentY*=.82; }

  const edgeFixY=zoomIndex===0 ? 1 : 0;
  world.style.transform=
    `translate(-50%, -50%) translate(${currentX}px,${currentY+edgeFixY}px) scale(${baseScale*z})`;

  updatePlayer(now);
  rafId=requestAnimationFrame(draw);
}
function setZoom(i){
  zoomIndex=Math.max(0,Math.min(ZOOM_LEVELS.length-1,i));
  updateTargetFromPointer();
  clampPosition();
}

game.addEventListener('mousemove',e=>{
  const r=game.getBoundingClientRect();
  pointerX=(e.clientX-r.left)/r.width;
  pointerY=(e.clientY-r.top)/r.height;
  updateTargetFromPointer();
  clampPosition();
});
game.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.deltaY<0)setZoom(zoomIndex+1);
  else if(e.deltaY>0)setZoom(zoomIndex-1);
},{passive:false});
window.addEventListener('resize',()=>{
  calculateBaseScale();
  updateTargetFromPointer();
  clampPosition();
});

if(bgMusic){
  bgMusic.volume=.48;
  const playMusic=()=>{
    bgMusic.play().then(()=>{
      window.removeEventListener('pointerdown',playMusic);
      window.removeEventListener('keydown',playMusic);
      window.removeEventListener('wheel',playMusic);
    }).catch(()=>{});
  };
  playMusic();
  window.addEventListener('pointerdown',playMusic,{passive:true});
  window.addEventListener('keydown',playMusic);
  window.addEventListener('wheel',playMusic,{passive:true});
}

/* SPIELBARER GASTWIRT */
const PLAYER={
  x:768,y:735,
  speed:105,
  radius:13,
  frameMs:145,
  direction:'front',
  frame:1,
  sequenceIndex:0,
  frameClock:0,
  moving:false
};

const PLAYER_SEQUENCES={
  front:[1,2,3,2,4],
  back:[1,2,3,4],
  right:[1,2,3,4],
  left:[1,2,3,4]
};

const keys=new Set();
let playerLastTime=performance.now();

function playerSpritePath(direction,frame){
  const source=(direction==='left'||direction==='right') ? 'side' : direction;
  const version=source==='back' ? '' : '?v=12';
  return `assets/player/${source}-${frame}.png${version}`;
}

function playerVisualScale(){
  let s=1;
  if(PLAYER.direction==='back')s*=.85;
  if(currentMap===2)s*=1.15; // NUR Map 2: alle Frames exakt 15 % größer.
  return s;
}

function showPlayerFrame(force=false){
  if(!player)return;
  const next=playerSpritePath(PLAYER.direction,PLAYER.frame);
  const current=player.getAttribute('src')||'';
  if(force || current!==next) player.setAttribute('src',next);

  const s=playerVisualScale();
  if(PLAYER.direction==='right'){
    player.style.transform=`translate(-50%,-100%) scale(${-s},${s})`;
  }else{
    player.style.transform=`translate(-50%,-100%) scale(${s})`;
  }
  updateMap2Occlusion();
}

function setPlayerDirection(direction){
  if(direction===PLAYER.direction)return;
  PLAYER.direction=direction;
  PLAYER.sequenceIndex=0;
  PLAYER.frameClock=0;
  PLAYER.frame=PLAYER_SEQUENCES[direction][0];
  showPlayerFrame(true);
}


function playerCanStand(x,y){
  const margin=10;
  if(x<margin||y<margin||x>WORLD_W-margin||y>WORLD_H-margin)return false;
  if(currentMap===2)return true; // neue Map 2: keine Hitboxen
  return !window.BurgCollision?.circleBlocked(x,y,PLAYER.radius);
}
function movePlayerAxis(dx,dy){
  const nx=PLAYER.x+dx,ny=PLAYER.y+dy;
  if(dx&&playerCanStand(nx,PLAYER.y))PLAYER.x=nx;
  if(dy&&playerCanStand(PLAYER.x,ny))PLAYER.y=ny;
}

/* IRIS: Overlay bleibt während BEIDER Hälften aktiv. */
function setIrisRadius(percent){
  if(!irisTransition)return;
  irisTransition.style.display='block';
  irisTransition.style.visibility='visible';
  irisTransition.style.opacity='1';
  irisTransition.style.pointerEvents='none';
  irisTransition.style.zIndex='999999';
  const p=Math.max(0,Math.min(150,percent));
  const edge=Math.min(150,p+.45);
  irisTransition.style.background=`radial-gradient(circle at 50% 50%, transparent 0%, transparent ${p}%, #000 ${edge}%, #000 100%)`;
}
function animateIris(from,to,duration){
  return new Promise(resolve=>{
    const start=performance.now();
    const step=now=>{
      const t=Math.min(1,(now-start)/duration);
      const eased=t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
      setIrisRadius(from+(to-from)*eased);
      if(t<1)requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}
function finishIrisOpen(){
  setIrisRadius(150);
  if(irisTransition){
    irisTransition.style.background='transparent';
    irisTransition.style.opacity='0';
    irisTransition.style.visibility='hidden';
  }
}

function updateMap2Occlusion(){
  if(!player)return;
  player.style.clipPath='none';
  player.style.webkitClipPath='none';
}

async function swapMap(src){
  map.src=src;
  await map.decode().catch(()=>{});
}

async function enterWirtschaft(){
  if(mapTransitioning||currentMap!==1)return;
  mapTransitioning=true;
  keys.clear();
  PLAYER.moving=false;
  PLAYER.frameClock=0;

  if(player)player.classList.add('map-fading');
  await new Promise(r=>setTimeout(r,260));

  await animateIris(150,0,650);

  currentMap=2;
  document.body.classList.add('map2');
  await swapMap('assets/maps/wirtschaft-innen.jpg');

  PLAYER.x=MAP2_SPAWN.x;
  PLAYER.y=MAP2_SPAWN.y;
  PLAYER.direction='back';
  PLAYER.sequenceIndex=0;
  PLAYER.frameClock=0;
  PLAYER.frame=PLAYER_SEQUENCES.back[0];
  player.style.left=`${PLAYER.x}px`;
  player.style.top=`${PLAYER.y}px`;
  showPlayerFrame(true);

  if(player)player.classList.remove('map-fading');
  await animateIris(0,150,700); // Map 2 jetzt sichtbar VON INNEN NACH AUSSEN.
  finishIrisOpen();

  mapTransitioning=false;
  playerLastTime=performance.now();
}

function checkMapTransition(){
  if(mapTransitioning||currentMap!==1)return;
  const t=WIRTSCHAFT_DOOR_TRIGGER;
  if(PLAYER.x>=t.x1&&PLAYER.x<=t.x2&&PLAYER.y<=t.y+PLAYER.radius&&PLAYER.y>=t.y-18){
    PLAYER.y=t.y+PLAYER.radius;
    enterWirtschaft();
  }
}

function updatePlayer(now){
  if(!player)return;
  if(mapTransitioning){ playerLastTime=now; return; }

  const dt=Math.min(.04,(now-playerLastTime)/1000);
  playerLastTime=now;

  let dx=0,dy=0;
  if(keys.has('a'))dx-=1;
  if(keys.has('d'))dx+=1;
  if(keys.has('w'))dy-=1;
  if(keys.has('s'))dy+=1;

  PLAYER.moving=dx!==0||dy!==0;
  if(PLAYER.moving){
    const len=Math.hypot(dx,dy);
    dx/=len; dy/=len;

    if(dy<0)setPlayerDirection('back');
    else if(dy>0)setPlayerDirection('front');
    else if(dx>0)setPlayerDirection('right');
    else if(dx<0)setPlayerDirection('left');

    movePlayerAxis(dx*PLAYER.speed*dt,dy*PLAYER.speed*dt);
    checkMapTransition();

    PLAYER.frameClock+=dt*1000;
    while(PLAYER.frameClock>=PLAYER.frameMs){
      PLAYER.frameClock-=PLAYER.frameMs;
      const seq=PLAYER_SEQUENCES[PLAYER.direction];
      PLAYER.sequenceIndex=(PLAYER.sequenceIndex+1)%seq.length;
      PLAYER.frame=seq[PLAYER.sequenceIndex];
      showPlayerFrame();
    }
  }else{
    PLAYER.frameClock=0;
  }

  player.style.left=`${PLAYER.x}px`;
  player.style.top=`${PLAYER.y}px`;
  player.style.zIndex=String(100+Math.round(PLAYER.y));
  updateMap2Occlusion();
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}
});
window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d'].includes(k)){keys.delete(k);e.preventDefault();}
});
window.addEventListener('blur',()=>keys.clear());

/* Alpha-genaue Kollision Map 1 */
const collisionSprites=[];
async function buildAlphaCollision(el){
  await el.decode().catch(()=>{});
  const w=el.naturalWidth,h=el.naturalHeight;
  if(!w||!h)return;
  const c=document.createElement('canvas');
  c.width=w;c.height=h;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(el,0,0);
  const rgba=ctx.getImageData(0,0,w,h).data;
  const alpha=new Uint8Array(w*h);
  for(let i=0,p=3;i<alpha.length;i++,p+=4)alpha[i]=rgba[p];
  collisionSprites.push({el,alpha,sourceW:w,sourceH:h});
}
function px(el,prop){return parseFloat(getComputedStyle(el)[prop])||0;}
function pointHitsSprite(s,x,y){
  if(currentMap===1 && s.el.id==='wirtschaft' &&
     x>=WIRTSCHAFT_DOOR_PASSAGE.x1 && x<=WIRTSCHAFT_DOOR_PASSAGE.x2 &&
     y>=WIRTSCHAFT_DOOR_PASSAGE.y1 && y<=WIRTSCHAFT_DOOR_PASSAGE.y2)return false;

  const el=s.el,left=px(el,'left'),top=px(el,'top');
  const dw=el.offsetWidth,dh=el.offsetHeight;
  if(!dw||!dh)return false;
  if(x<left||y<top||x>=left+dw||y>=top+dh)return false;
  const sx=Math.min(s.sourceW-1,Math.max(0,Math.floor((x-left)/dw*s.sourceW)));
  const sy=Math.min(s.sourceH-1,Math.max(0,Math.floor((y-top)/dh*s.sourceH)));
  return s.alpha[sy*s.sourceW+sx]>=24;
}
function pointBlocked(x,y){ return collisionSprites.some(s=>pointHitsSprite(s,x,y)); }
function circleBlocked(x,y,r=8){
  if(pointBlocked(x,y))return true;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    if(pointBlocked(x+Math.cos(a)*r,y+Math.sin(a)*r))return true;
  }
  return false;
}
window.BurgCollision={pointBlocked,circleBlocked,sprites:collisionSprites};

const PLAYER_FRAME_PATHS = [
  'assets/player/front-1.png?v=12','assets/player/front-2.png?v=12',
  'assets/player/front-3.png?v=12','assets/player/front-4.png?v=12',
  'assets/player/back-1.png','assets/player/back-2.png',
  'assets/player/back-3.png','assets/player/back-4.png',
  'assets/player/side-1.png?v=12','assets/player/side-2.png?v=12',
  'assets/player/side-3.png?v=12','assets/player/side-4.png?v=12'
];
async function preloadPlayerFrames(){
  await Promise.all(PLAYER_FRAME_PATHS.map(src=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>img.decode().catch(()=>{}).finally(resolve);
    img.onerror=resolve;
    img.src=src;
  })));
}

async function start(){
  calculateBaseScale();
  setIrisRadius(150);
  finishIrisOpen();
  currentX=currentY=targetX=targetY=0;

  await preloadPlayerFrames();
  showPlayerFrame(true);
  if(player){
    player.style.left=`${PLAYER.x}px`;
    player.style.top=`${PLAYER.y}px`;
  }

  document.body.classList.add('game-ready');
  cancelAnimationFrame(rafId);
  playerLastTime=performance.now();
  rafId=requestAnimationFrame(draw);

  const collidables=[...document.querySelectorAll('.collidable[data-collision="alpha"]')];
  Promise.all(collidables.map(buildAlphaCollision)).catch(console.error);
}

if(map.complete&&map.naturalWidth>0){
  start();
}else{
  map.addEventListener('load',start,{once:true});
  map.addEventListener('error',()=>{
    document.getElementById('loading').textContent='KARTE KONNTE NICHT GELADEN WERDEN';
  },{once:true});
}