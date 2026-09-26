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
const MAP2_SPAWN={x:768,y:640};
const MAP2_EXIT_TRIGGER={x1:700,x2:836,y1:705,y2:770};

/* MAP 2 – finale Innenkarte, direkt auf die 1536×1024-Welt skaliert.
   Entscheidend: Kollisionskante = sichtbare UNTERKANTE der jeweiligen Wand.
   Die Wandtiefe selbst darf betreten werden; durch die Unterkante geht es NUR an Türen. */
let map2Room='guestroom';

/* Aus 2048×1365 Referenz auf 1536×1024: Faktor 0.75.
   Mittelwand: Oberkante ~239, Unterkante ~360.
   Frontwand: Oberkante ~690, Unterkante ~866. */
const MAP2_MIDDLE_WALL={top:239,bottom:360,left:72,right:1465};
// Visuelle Freigabe endet etwas VOR der geometrischen Oberkante: Figur erscheint beim Verlassen früher.
const MAP2_MIDDLE_REVEAL_TOP=252;
const MAP2_FRONT_WALL={top:690,bottom:866,left:25,right:1510};

/* Reale Türöffnungen an den jeweiligen Unterkanten. */
const MAP2_KITCHEN_DOOR={x1:382,x2:489,y1:239,y2:366};
const MAP2_FRONT_DOOR={x1:681,x2:839,y1:690,y2:874};

/* Normale Bodenflächen. Die perspektivischen Seitenkanten bleiben erhalten. */
const MAP2_GUEST_POLY=[[72,360],[1465,360],[1510,866],[25,866]];
const MAP2_KITCHEN_POLY=[[92,0],[1444,0],[1444,239],[92,239]];

/* Sobald die Mittelwand über die Tür betreten wurde, befindet sich der Spieler
   IN/HINTER der Wand. Dann darf er innerhalb der gesamten Wandtiefe links/rechts
   laufen und bleibt verdeckt. Das verhindert gleichzeitig, dass man die Wand
   von der Gaststube aus irgendwo anders betreten kann. */
let map2InMiddleWall=false;

function pointInPoly(x,y,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];
    const hit=((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}
function inRect(x,y,r){return x>=r.x1&&x<=r.x2&&y>=r.y1&&y<=r.y2;}

function inMiddleWallBand(x,y){
  return x>=MAP2_MIDDLE_WALL.left && x<=MAP2_MIDDLE_WALL.right &&
         y>=MAP2_MIDDLE_WALL.top && y<=MAP2_MIDDLE_WALL.bottom;
}

/* Seitenwände: Kollision an der sichtbaren UNTERKANTE (innere Bodenkante), perspektivisch linear. */
function map2LeftInnerEdge(y){
  if(y<=239)return 92;
  if(y<=360)return 92+(72-92)*((y-239)/(360-239));
  return 72+(25-72)*((y-360)/(866-360));
}
function map2RightInnerEdge(y){
  if(y<=239)return 1444;
  if(y<=360)return 1444+(1465-1444)*((y-239)/(360-239));
  return 1465+(1510-1465)*((y-360)/(866-360));
}
function insideMap2SideEdges(x,y){
  return x>=map2LeftInnerEdge(y) && x<=map2RightInnerEdge(y);
}

function map2CanStand(x,y){
  // Seitenwände gelten in ALLEN Bereichen ausschließlich an ihrer sichtbaren unteren Innenkante.
  if(!insideMap2SideEdges(x,y))return false;

  if(map2Room==='kitchen'){
    /* KEINE Hitbox an der Oberkante der Mittelwand/Küche. Oben begrenzen nur die
       echten Rück-/Seitenwände der Karte; der Übergang zurück erfolgt an der Mittelwand
       ausschließlich durch die Tür. */
    if(y<MAP2_MIDDLE_WALL.top)return true;
    if(inRect(x,y,MAP2_KITCHEN_DOOR))return true;
    return false;
  }

  if(map2InMiddleWall){
    /* Hinter der Mittelwand: über die GANZE Breite A/D möglich. Die Wandoberkante
       ist KEINE Kollisionskante. W führt direkt in die Küche; S zurück in Gaststube. */
    if(y<=MAP2_MIDDLE_WALL.bottom && y>=MAP2_MIDDLE_WALL.top)return true;
    if(y<MAP2_MIDDLE_WALL.top)return true;
    if(y>MAP2_MIDDLE_WALL.bottom)return true;
  }

  /* Gaststube: Mittelwand darf von unten nur durch die echte Tür betreten werden.
     Frontwand-Tiefe ist begehbar; deren UNTERKANTE stoppt den Spieler außer am Ausgang. */
  if(map2Room==='guestroom'){
    if(y>=MAP2_MIDDLE_WALL.bottom && y<=MAP2_FRONT_WALL.bottom)return true;
    if(inRect(x,y,MAP2_KITCHEN_DOOR))return true;
    if(inRect(x,y,MAP2_FRONT_DOOR))return true;
    return false;
  }
  return false;
}

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
  if(currentMap===2)return map2CanStand(x,y);
  return !window.BurgCollision?.circleBlocked(x,y,PLAYER.radius);
}
function movePlayerAxis(dx,dy){
  const nx=PLAYER.x+dx,ny=PLAYER.y+dy;
  if(dx&&playerCanStand(nx,PLAYER.y))PLAYER.x=nx;
  if(dy&&playerCanStand(PLAYER.x,ny))PLAYER.y=ny;
}

/* IRIS – vollständig JS-gesteuert, unabhängig von altem CSS.
   150 = komplett offen, 0 = komplett schwarz.
   Beim Kartenwechsel bleibt der Screen bei Radius 0 geschlossen,
   die Map wird darunter getauscht, danach öffnet dieselbe Iris 0 -> 150. */
function setIrisRadius(percent){
  if(!irisTransition)return;
  const p=Math.max(0,Math.min(150,percent));

  Object.assign(irisTransition.style,{
    display:'block',
    position:'fixed',
    inset:'0',
    width:'100vw',
    height:'100vh',
    zIndex:'999999',
    pointerEvents:'none',
    visibility:'visible',
    opacity:'1',
    background:'#000',
    transition:'none'
  });

  // Ein echtes Loch in der schwarzen Ebene statt eines CSS-Hintergrund-Tricks.
  // Dadurch funktioniert insbesondere die zweite Hälfte 0 -> 150 zuverlässig.
  const mask=`radial-gradient(circle at 50% 50%, transparent 0%, transparent ${p}%, #000 ${Math.min(150,p+0.7)}%, #000 100%)`;
  irisTransition.style.webkitMaskImage=mask;
  irisTransition.style.maskImage=mask;
  irisTransition.style.webkitMaskRepeat='no-repeat';
  irisTransition.style.maskRepeat='no-repeat';
}

function animateIris(from,to,duration){
  return new Promise(resolve=>{
    setIrisRadius(from);
    const start=performance.now();

    const step=now=>{
      const t=Math.min(1,(now-start)/duration);
      const eased=t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
      setIrisRadius(from+(to-from)*eased);

      if(t<1){
        requestAnimationFrame(step);
      }else{
        setIrisRadius(to);
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}

function finishIrisOpen(){
  if(!irisTransition)return;
  irisTransition.style.webkitMaskImage='none';
  irisTransition.style.maskImage='none';
  irisTransition.style.background='transparent';
  irisTransition.style.opacity='0';
  irisTransition.style.visibility='hidden';
  irisTransition.style.display='none';
}

function setPlayerVisibleFraction(fraction){
  /* fraction 0 = komplett hinter Wand; 1 = komplett sichtbar.
     Freigabe immer von KOPF nach unten. */
  const f=Math.max(0,Math.min(1,fraction));
  const cutBottom=(1-f)*100;
  player.style.clipPath=`inset(0 0 ${cutBottom}% 0)`;
  player.style.webkitClipPath=`inset(0 0 ${cutBottom}% 0)`;
}

function wallVisibilityBottomToTop(y,top,bottom){
  /* Beim HINEINLAUFEN von oben nach unten: erst Füße/Unterkörper verdeckt,
     dann immer mehr bis zum Kopf. Beim HERAUSLAUFEN exakt reversibel. */
  const t=Math.max(0,Math.min(1,(y-top)/Math.max(1,bottom-top)));
  return 1-t;
}

function updateMap2Occlusion(){
  if(!player)return;
  player.style.clipPath='none';
  player.style.webkitClipPath='none';
  if(currentMap!==2)return;

  /* MITTELWAND: Nach Eintritt durch die Tür gilt derselbe Occlusion-Effekt über
     die komplette Wandbreite. Keine Kollisions-Hitbox an ihrer Oberkante. */
  if(map2InMiddleWall && PLAYER.y>=MAP2_MIDDLE_REVEAL_TOP && PLAYER.y<=MAP2_MIDDLE_WALL.bottom){
    const visible=(MAP2_MIDDLE_WALL.bottom-PLAYER.y)/
                  (MAP2_MIDDLE_WALL.bottom-MAP2_MIDDLE_REVEAL_TOP);
    setPlayerVisibleFraction(visible);
    return;
  }

  /* FRONTWAND: NICHT abrupt verschwinden. Von der sichtbaren Oberkante bis zur
     Unterkante wird der Sprite kontinuierlich VON UNTEN NACH OBEN verdeckt.
     Der gleiche Ausdruck läuft beim Zurückgehen exakt rückwärts: oben -> unten frei. */
  if(map2Room==='guestroom' && !map2InMiddleWall &&
     PLAYER.x>=MAP2_FRONT_WALL.left && PLAYER.x<=MAP2_FRONT_WALL.right &&
     PLAYER.y>=MAP2_FRONT_WALL.top && PLAYER.y<=MAP2_FRONT_WALL.bottom){
    setPlayerVisibleFraction(wallVisibilityBottomToTop(
      PLAYER.y,MAP2_FRONT_WALL.top,MAP2_FRONT_WALL.bottom));
    return;
  }
}

async function swapMap(src){
  const next=new Image();
  next.src=src;
  await new Promise((resolve,reject)=>{
    next.onload=resolve;
    next.onerror=reject;
  }).catch(()=>{});
  await next.decode().catch(()=>{});
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
  setIrisRadius(0); // während des Map-Tauschs garantiert geschlossen

  currentMap=2;
  map2Room='guestroom';
  map2InMiddleWall=false;
  document.body.classList.add('map2');
  await swapMap('assets/maps/wirtschaft-innen.jpg?v=16');

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

  // Einen echten Paint der neuen Karte unter der geschlossenen Iris erzwingen.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await animateIris(0,150,700);
  finishIrisOpen();

  mapTransitioning=false;
  playerLastTime=performance.now();
}

async function leaveWirtschaft(){
  if(mapTransitioning||currentMap!==2)return;
  mapTransitioning=true;
  keys.clear(); PLAYER.moving=false; PLAYER.frameClock=0;
  if(player)player.classList.add('map-fading');
  await new Promise(r=>setTimeout(r,220));
  await animateIris(150,0,650);
  setIrisRadius(0);
  currentMap=1; map2Room='guestroom'; map2InMiddleWall=false;
  document.body.classList.remove('map2');
  await swapMap('assets/maps/terrasse.jpg');
  PLAYER.x=778; PLAYER.y=356; PLAYER.direction='front';
  PLAYER.sequenceIndex=0; PLAYER.frameClock=0; PLAYER.frame=PLAYER_SEQUENCES.front[0];
  player.style.left=`${PLAYER.x}px`; player.style.top=`${PLAYER.y}px`;
  showPlayerFrame(true);
  if(player)player.classList.remove('map-fading');
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await animateIris(0,150,700); finishIrisOpen();
  mapTransitioning=false; playerLastTime=performance.now();
}

function updateMap2RoomAndTransitions(){
  if(currentMap!==2||mapTransitioning)return;

  /* Eintritt in die Mittelwand NUR durch die sichtbare Küchentür an y=360. */
  if(map2Room==='guestroom' && !map2InMiddleWall &&
     PLAYER.x>=MAP2_KITCHEN_DOOR.x1 && PLAYER.x<=MAP2_KITCHEN_DOOR.x2 &&
     PLAYER.y<MAP2_MIDDLE_WALL.bottom){
    map2InMiddleWall=true;
  }

  /* In der Wand darf nun A/D über die ganze Breite benutzt werden.
     Erst nach vollständigem Überschreiten der Oberkante sind wir in der Küche. */
  if(map2InMiddleWall && PLAYER.y<=MAP2_MIDDLE_REVEAL_TOP){
    map2InMiddleWall=false;
    map2Room='kitchen';
  }

  /* Rückweg Küche -> Wand wiederum ausschließlich durch dieselbe Tür. */
  if(map2Room==='kitchen' &&
     PLAYER.x>=MAP2_KITCHEN_DOOR.x1 && PLAYER.x<=MAP2_KITCHEN_DOOR.x2 &&
     PLAYER.y>MAP2_MIDDLE_REVEAL_TOP){
    map2Room='guestroom';
    map2InMiddleWall=true;
  }

  /* Wenn man aus der Wand wieder nach unten in die Gaststube kommt. */
  if(map2InMiddleWall && PLAYER.y>=MAP2_MIDDLE_WALL.bottom){
    map2InMiddleWall=false;
    map2Room='guestroom';
    PLAYER.y=MAP2_MIDDLE_WALL.bottom+1;
  }

  /* Frontwand: Außenkante wirklich UNTEN bei y=866.
     Mapwechsel ausschließlich durch die mittige Haupttür. */
  if(map2Room==='guestroom' && !map2InMiddleWall &&
     PLAYER.x>=MAP2_FRONT_DOOR.x1 && PLAYER.x<=MAP2_FRONT_DOOR.x2 &&
     PLAYER.y>=MAP2_FRONT_WALL.bottom){
    leaveWirtschaft();
  }
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
    if(currentMap===1)checkMapTransition();
    else updateMap2RoomAndTransitions();

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