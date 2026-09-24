'use strict';

const game = document.getElementById('game');
const world = document.getElementById('world');
const map = document.getElementById('map');
const bgMusic = document.getElementById('bgMusic');
const player = document.getElementById('player');

const WORLD_W = 1536;
const WORLD_H = 1024;

/* FIX: nur noch zwei Zoomstufen. */
const ZOOM_LEVELS = [1, 1.55];

let zoomIndex = 0;
let baseScale = 1;
let pointerX = 0.5, pointerY = 0.5;
let currentX = 0, currentY = 0, targetX = 0, targetY = 0;
let rafId = 0;

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
function draw(){
  const z=ZOOM_LEVELS[zoomIndex];
  currentX+=(targetX-currentX)*.055;
  currentY+=(targetY-currentY)*.055;

  if(zoomIndex===0){
    currentX*=.82;
    currentY*=.82;
  }

  /*
    FIX für die hauchdünne Unterkante:
    Welt auf der vollständig herausgezoomten Stufe um exakt 1 CSS-Pixel nach unten.
    Das Motiv schließt damit unten sauber; der gewollte Seitenrand bleibt erhalten.
  */
  const edgeFixY = zoomIndex===0 ? 1 : 0;

  world.style.transform =
    `translate(-50%, -50%) translate(${currentX}px,${currentY + edgeFixY}px) scale(${baseScale*z})`;

  updatePlayer(performance.now());
  rafId=requestAnimationFrame(draw);
}
function setZoom(i){
  zoomIndex=Math.max(0,Math.min(ZOOM_LEVELS.length-1,i));
  updateTargetFromPointer();clampPosition();
}

game.addEventListener('mousemove',e=>{
  const r=game.getBoundingClientRect();
  pointerX=(e.clientX-r.left)/r.width;
  pointerY=(e.clientY-r.top)/r.height;
  updateTargetFromPointer();clampPosition();
});
game.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.deltaY<0)setZoom(zoomIndex+1);
  else if(e.deltaY>0)setZoom(zoomIndex-1);
},{passive:false});
window.addEventListener('resize',()=>{
  calculateBaseScale();updateTargetFromPointer();clampPosition();
});

/* Musik: Browser blockieren Autoplay mit Ton häufig.
   Wir versuchen sofort zu starten und entsperren sie sonst beim ersten Klick,
   Mausrad oder Tastendruck automatisch. */
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

\n\n/* ============================================================\n   SPIELBARER GASTWIRT – v05\n   W / WA / WD: Ruecken 1-2-3-4\n   S / SA / SD: Front 1-4-2-4-3-4\n   D: rechts 1-2-3-4\n   A: dieselben Rechts-Sprites horizontal gespiegelt\n   Kein Crossfade; feste, identische Frame-Abstaende.\n   ============================================================ */\nconst PLAYER = {\n  x:768, y:735,\n  speed:105,                 // Weltpixel/Sekunde: normale Gangart\n  radius:13,\n  frameMs:145,\n  direction:'front',\n  frame:4,\n  sequenceIndex:0,\n  frameClock:0,\n  moving:false\n};\nconst PLAYER_SEQUENCES = {\n  front:[1,4,2,4,3,4],\n  back:[1,2,3,4],\n  right:[1,2,3,4],\n  left:[1,2,3,4]\n};\nconst keys = new Set();\nlet playerLastTime = performance.now();\n\nfunction playerSpritePath(direction,frame){\n  const source = direction==='left' ? 'right' : direction;\n  return `assets/player/${source}-${frame}.png`;\n}\nfunction showPlayerFrame(force=false){\n  if(!player) return;\n  const next=playerSpritePath(PLAYER.direction,PLAYER.frame);\n  if(force || !player.src.endsWith(next)) player.src=next;\n  player.style.transform = PLAYER.direction==='left'\n    ? 'translate(-50%,-100%) scaleX(-1)'\n    : 'translate(-50%,-100%)';\n}\nfunction setPlayerDirection(direction){\n  if(direction===PLAYER.direction) return;\n  PLAYER.direction=direction;\n  PLAYER.sequenceIndex=0;\n  PLAYER.frameClock=0;\n  PLAYER.frame=PLAYER_SEQUENCES[direction][0];\n  showPlayerFrame(true);\n}\nfunction playerCanStand(x,y){\n  const margin=10;\n  if(x<margin || y<margin || x>WORLD_W-margin || y>WORLD_H-margin) return false;\n  return !window.BurgCollision?.circleBlocked(x,y,PLAYER.radius);\n}\nfunction movePlayerAxis(dx,dy){\n  const nx=PLAYER.x+dx, ny=PLAYER.y+dy;\n  // Achsen getrennt testen: an harten Objektkanten sauber entlanggleiten.\n  if(dx && playerCanStand(nx,PLAYER.y)) PLAYER.x=nx;\n  if(dy && playerCanStand(PLAYER.x,ny)) PLAYER.y=ny;\n}\nfunction updatePlayer(now){\n  if(!player) return;\n  const dt=Math.min(.04,(now-playerLastTime)/1000);\n  playerLastTime=now;\n\n  let dx=0,dy=0;\n  if(keys.has('a')) dx-=1;\n  if(keys.has('d')) dx+=1;\n  if(keys.has('w')) dy-=1;\n  if(keys.has('s')) dy+=1;\n\n  PLAYER.moving=dx!==0 || dy!==0;\n  if(PLAYER.moving){\n    const len=Math.hypot(dx,dy); dx/=len; dy/=len;\n\n    // Gewuenschte Richtungslogik: Vertikale Richtung hat bei Diagonalen Vorrang.\n    if(dy<0) setPlayerDirection('back');\n    else if(dy>0) setPlayerDirection('front');\n    else if(dx>0) setPlayerDirection('right');\n    else if(dx<0) setPlayerDirection('left');\n\n    movePlayerAxis(dx*PLAYER.speed*dt,dy*PLAYER.speed*dt);\n\n    PLAYER.frameClock+=dt*1000;\n    while(PLAYER.frameClock>=PLAYER.frameMs){\n      PLAYER.frameClock-=PLAYER.frameMs;\n      const seq=PLAYER_SEQUENCES[PLAYER.direction];\n      PLAYER.sequenceIndex=(PLAYER.sequenceIndex+1)%seq.length;\n      PLAYER.frame=seq[PLAYER.sequenceIndex];\n      showPlayerFrame();\n    }\n  }else{\n    PLAYER.frameClock=0;\n  }\n\n  player.style.left=`${PLAYER.x}px`;\n  player.style.top=`${PLAYER.y}px`;\n  // Fussposition bestimmt die Tiefe auf der Karte.\n  player.style.zIndex=String(100+Math.round(PLAYER.y));\n}\n\nwindow.addEventListener('keydown',e=>{\n  const k=e.key.toLowerCase();\n  if(['w','a','s','d'].includes(k)){ keys.add(k); e.preventDefault(); }\n});\nwindow.addEventListener('keyup',e=>{\n  const k=e.key.toLowerCase();\n  if(['w','a','s','d'].includes(k)){ keys.delete(k); e.preventDefault(); }\n});\nwindow.addEventListener('blur',()=>keys.clear());\n\n/* Alpha-genaue Kollision: nur sichtbare Pixel blockieren. Baum ausgeschlossen. */
const collisionSprites=[];

async function buildAlphaCollision(el){
  await el.decode().catch(()=>{});
  const w=el.naturalWidth,h=el.naturalHeight;
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
  const el=s.el,left=px(el,'left'),top=px(el,'top');
  const dw=el.offsetWidth,dh=el.offsetHeight;
  if(x<left||y<top||x>=left+dw||y>=top+dh)return false;
  const sx=Math.min(s.sourceW-1,Math.max(0,Math.floor((x-left)/dw*s.sourceW)));
  const sy=Math.min(s.sourceH-1,Math.max(0,Math.floor((y-top)/dh*s.sourceH)));
  return s.alpha[sy*s.sourceW+sx]>=24;
}
function pointBlocked(x,y){
  return collisionSprites.some(s=>pointHitsSprite(s,x,y));
}
function circleBlocked(x,y,r=8){
  if(pointBlocked(x,y))return true;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    if(pointBlocked(x+Math.cos(a)*r,y+Math.sin(a)*r))return true;
  }
  return false;
}
window.BurgCollision={pointBlocked,circleBlocked,sprites:collisionSprites};

async function start(){
  calculateBaseScale();
  currentX=currentY=targetX=targetY=0;

  const props=[...document.querySelectorAll('.prop')];
  await Promise.all(props.map(el=>el.decode().catch(()=>{})));

  showPlayerFrame(true);
  document.body.classList.add('game-ready');
  cancelAnimationFrame(rafId);
  draw();

  const collidables=[...document.querySelectorAll('.collidable[data-collision="alpha"]')];
  Promise.all(collidables.map(buildAlphaCollision)).catch(console.error);
}

if(map.complete&&map.naturalWidth>0)start();
else{
  map.addEventListener('load',start,{once:true});
  map.addEventListener('error',()=>{
    document.getElementById('loading').textContent='KARTE KONNTE NICHT GELADEN WERDEN';
  },{once:true});
}
