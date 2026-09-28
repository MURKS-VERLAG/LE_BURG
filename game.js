'use strict';

const game = document.getElementById('game');
const world = document.getElementById('world');
const map = document.getElementById('map');
const bgMusic = document.getElementById('bgMusic');
const player = document.getElementById('player');
const irisTransition = document.getElementById('irisTransition');

/* Türsound – einmal pro tatsächlichem Durchgang. */
const doorPassSound=new Audio('assets/audio/Door Open Sound.mp3');
doorPassSound.preload='auto';
doorPassSound.volume=1;
function playDoorPassSound(){
  doorPassSound.pause();
  doorPassSound.currentTime=0;
  doorPassSound.play().catch(()=>{});
}

/* MAP 1 – panisch davonrennende Magd (Taste 1). */
let map1Runner=null;
let map1RunnerActive=false;
let map1RunnerStart=0;
const MAP1_RUNNER_DURATION=7031; // Frau 20 % langsamer
const MAP1_RUNNER_FRAME_MS=115;
const MAP1_BEAR_DELAY=1500;
const MAP1_BEAR_DURATION=7969; // Bär 15 % schneller als bisher
const MAP1_BEAR_FRAME_MS=170;
let map1Bear=null;
let map1BearActive=false;
let map1BearStart=0;
const MAP1_RUNNER_PATH=[
  // Spawn nach rechts auf den Fußweg versetzt; danach weich in die bisherige Ideallinie.
  [1365,18],[1358,72],[1305,166],[1200,255],[1082,333],[1018,382],
  [932,486],[912,585],[925,650],[973,711],[1078,782],[1205,849],
  [1345,930],[1460,995],[1575,1065]
];
const map1RunnerSound=new Audio('assets/audio/girlyscream_01.mp3');
const map1BearSound1=new Audio('assets/audio/bearattack_1.mp3');
const map1BearSound2=new Audio('assets/audio/bearattack_2.mp3');
const map1BearSound3=new Audio('assets/audio/bearattack_3.mp3');
const map1BearSong=new Audio('assets/audio/The Hold Steady - The Bear and the Maiden Fair.mp3');
[map1BearSound1,map1BearSound2,map1BearSound3].forEach(a=>{a.preload='auto';a.volume=1;});
map1BearSong.preload='auto';
map1BearSong.volume=.52;
let map1BearAudioStarted=false;
let map1BearLoopTimer=null;
let map1RunnerTimer=null;
let map1BearSongStartTimer=null;
let map1BearSongFadeRAF=0;
let map1BearSongWatchRAF=0;
const MAP1_BEAR_SONG_END=46;
const MAP1_BEAR_SONG_FADE_START=43.5;
const MAP1_BEAR_SONG_VOLUME=.52;
const MAP1_BG_VOLUME=.40;
map1RunnerSound.preload='auto';
map1RunnerSound.volume=1;

/* MAP 1 – EVENT 2: DER BOCK GEHT UM (Taste 2). */
const map1BockSong=new Audio('assets/audio/Der Bock geht um.mp3');
map1BockSong.preload='auto';
map1BockSong.volume=.72;

let map1BockActive=false;
let map1BockStart=0;
let map1BockArrivalTimer=0;
let map1BockSpawnTimer=0;
let map1BockRider=null;
let map1BockDark=null;
let map1BockFog=null;
let map1BockPuff=null;
let map1BockStage='idle';
const MAP1_BOCK_FRAME_MS=175;
const MAP1_BOCK_RIDE_DURATION=9000; // deutlich langsamer
const MAP1_BOCK_PATH_START=[1365,18];
const MAP1_BOCK_PATH_END=[768,525];
const MAP1_BOCK_PATH=[
  /* Weg der Lady; ab Pflaster eine gerade, knickfreie Endanfahrt.
     Haltepunkt bleibt EXAKT [768,560]. */
  [1365,18],[1358,72],[1305,166],[1200,255],[1082,333],[1018,382],
  [932,486],[890,505],[848,518],[806,524],[768,525]
];

function ensureMap1BockFX(){
  if(!map1BockDark){
    map1BockDark=document.createElement('div');
    map1BockDark.id='map1BockDark';
    Object.assign(map1BockDark.style,{
      position:'fixed',inset:'0',pointerEvents:'none',zIndex:'10900',
      background:'rgba(3,5,8,.58)',opacity:'0',transition:'opacity 900ms ease'
    });
    game.appendChild(map1BockDark);
  }
  if(!map1BockFog){
    map1BockFog=document.createElement('div');
    map1BockFog.id='map1BockFog';
    Object.assign(map1BockFog.style,{
      position:'fixed',inset:'0',overflow:'hidden',pointerEvents:'none',
      zIndex:'11000',opacity:'0',transition:'none'
    });
    for(let i=0;i<7;i++){
      const f=document.createElement('div');
      Object.assign(f.style,{
        position:'absolute',
        left:`${-18-i*8}%`,
        top:`${8+i*12}%`,
        width:`${70+i*5}%`,
        height:`${20+(i%3)*8}%`,
        borderRadius:'50%',
        background:'radial-gradient(ellipse at center, rgba(245,248,250,.58) 0%, rgba(220,228,232,.35) 36%, rgba(190,200,205,.10) 68%, rgba(255,255,255,0) 78%)',
        filter:`blur(${18+i*4}px)`,
        opacity:String(.52+(i%2)*.12),
        animation:`bockFogDrift ${12.5+i*.45}s ease-in-out 0s 1 forwards`
      });
      map1BockFog.appendChild(f);
    }
    game.appendChild(map1BockFog);
    if(!document.getElementById('bockFogStyle')){
      const st=document.createElement('style');
      st.id='bockFogStyle';
      st.textContent=`
        @keyframes bockFogDrift{
          0%{transform:translate3d(-12%,0,0) scale(1.12);opacity:.9}
          10%{opacity:.9}
          72%{opacity:.76}
          100%{transform:translate3d(245%,0,0) scale(1.24);opacity:0}
        }
        @keyframes bockPuff{
          0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}
          24%{opacity:1;transform:translate(-50%,-50%) scale(.72)}
          70%{opacity:.88;transform:translate(-50%,-50%) scale(1.35)}
          100%{opacity:0;transform:translate(-50%,-50%) scale(1.9)}
        }`;
      document.head.appendChild(st);
    }
  }
  return {dark:map1BockDark,fog:map1BockFog};
}

function ensureMap1BockRider(){
  if(map1BockRider)return map1BockRider;
  map1BockRider=document.createElement('img');
  map1BockRider.id='map1BockRider';
  map1BockRider.src='assets/npc/bock-reiter-1.png?v=27';
  map1BockRider.alt='';
  map1BockRider.draggable=false;
  Object.assign(map1BockRider.style,{
    position:'absolute',left:'0',top:'0',width:'103.075px',height:'auto',
    transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',
    display:'none',opacity:'1',zIndex:'19000',
    willChange:'left,top,transform,opacity,filter'
  });
  world.appendChild(map1BockRider);
  return map1BockRider;
}

function bockPointAt(t){
  const pts=MAP1_BOCK_PATH,lens=[];let total=0;
  for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);lens.push(l);total+=l;}
  let d=Math.max(0,Math.min(1,t))*total;
  for(let i=0;i<lens.length;i++){
    if(d<=lens[i]||i===lens.length-1){const q=lens[i]?d/lens[i]:0;return [pts[i][0]+(pts[i+1][0]-pts[i][0])*q,pts[i][1]+(pts[i+1][1]-pts[i][1])*q];}
    d-=lens[i];
  }
  return MAP1_BOCK_PATH_END;
}

function showBockPuff(x,y){
  if(map1BockPuff)map1BockPuff.remove();
  map1BockPuff=document.createElement('div');
  Object.assign(map1BockPuff.style,{
    position:'absolute',left:`${x}px`,top:`${y-80}px`,
    width:'190px',height:'150px',pointerEvents:'none',zIndex:'19500',
    borderRadius:'50%',
    background:'radial-gradient(circle, rgba(255,255,255,.98) 0%, rgba(255,255,255,.78) 28%, rgba(235,240,245,.40) 53%, rgba(255,255,255,0) 76%)',
    filter:'blur(7px)',animation:'bockPuff 720ms ease-out forwards'
  });
  world.appendChild(map1BockPuff);
  setTimeout(()=>{map1BockPuff?.remove();map1BockPuff=null;},760);
}

function startMap1BockEvent(){
  if(currentMap!==1 || mapTransitioning || map1BockActive)return;
  map1BockActive=true;
  map1BockStage='waiting';
  const {dark,fog}=ensureMap1BockFX();
  const rider=ensureMap1BockRider();

  // Event 1 sauber stoppen, falls es noch läuft.
  stopMap1BearAudioLoop();
  cancelMap1BearSongAutomation(true);
  map1BearActive=false;
  if(map1Bear)map1Bear.style.display='none';

  clearTimeout(map1RunnerTimer);
  clearTimeout(map1BockSpawnTimer);
  clearTimeout(map1BockArrivalTimer);
  clearTimeout(map1BockFinalTimer);
  map1RunnerSound.onended=null;
  map1RunnerSound.pause();
  map1RunnerSound.currentTime=0;
  map1BockSong.pause();
  map1BockSong.currentTime=0;
  if(bgMusic)bgMusic.pause();

  // Schrei UND "Der Bock geht um" starten exakt gleichzeitig.
  map1RunnerSound.play().catch(()=>{});
  map1BockSong.currentTime=0;
  map1BockSong.volume=.72;
  map1BockSong.play().catch(()=>{});
  map1RunnerTimer=setTimeout(()=>{
    if(!map1BockActive||currentMap!==1)return;
    const woman=ensureMap1Runner();
    map1RunnerActive=true;
    map1RunnerStart=performance.now();
    woman.style.display='block';
    woman.style.opacity='1';
  },500);

  // Bildschirm sofort atmosphärisch abdunkeln + dichte Nebelschleier von links nach rechts.
  dark.style.display='block'; fog.style.display='block';
  fog.style.opacity='1'; // Taste 2: Nebel im selben Tick sichtbar, keine Anlaufverzögerung.
  requestAnimationFrame(()=>{dark.style.opacity='1';});

  // Exakt 3 Sekunden nach Tastendruck: Reiter kommt auf derselben Grundlinie ins Bild.
  map1BockSpawnTimer=setTimeout(()=>{
    if(!map1BockActive||currentMap!==1)return;
    map1BockStage='riding';
    map1BockStart=performance.now();
    rider.style.display='block';
    rider.style.opacity='1';
    rider.style.filter='none';
  },3000);

}


let map1BockFinal=null;
let map1BockFinalTimer=0;

function ensureMap1BockFinal(){
  if(map1BockFinal)return map1BockFinal;
  map1BockFinal=document.createElement('img');
  map1BockFinal.id='map1BockFinal';
  map1BockFinal.src='assets/npc/bock-final.png?v=30';
  map1BockFinal.alt=''; map1BockFinal.draggable=false;
  Object.assign(map1BockFinal.style,{position:'absolute',left:'0',top:'0',height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',opacity:'1',zIndex:'19600'});
  world.appendChild(map1BockFinal);
  const sync=()=>{const w=player?.offsetWidth||parseFloat(getComputedStyle(player).width)||96;map1BockFinal.style.width=`${w}px`;};
  sync();requestAnimationFrame(sync);return map1BockFinal;
}
function bockFadeAudio(audio,target,duration,done){
  const from=audio.volume,start=performance.now();
  const step=now=>{const t=Math.min(1,(now-start)/duration);audio.volume=from+(target-from)*t;if(t<1)requestAnimationFrame(step);else done?.();};
  requestAnimationFrame(step);
}
function finishMap1BockEvent(){
  if(!map1BockActive)return;
  const final=ensureMap1BockFinal();
  final.style.transition='opacity 1100ms ease';final.style.opacity='0';
  bockFadeAudio(map1BockSong,0,1800,()=>{map1BockSong.pause();map1BockSong.currentTime=0;map1BockSong.volume=.72;});
  const {dark,fog}=ensureMap1BockFX();
  dark.style.transition='opacity 1800ms ease';dark.style.opacity='0';
  fog.style.transition='opacity 1600ms ease';fog.style.opacity='0';
  setTimeout(()=>{
    final.style.display='none';fog.style.display='none';dark.style.display='none';
    map1BockActive=false;map1BockStage='idle';
    if(bgMusic){bgMusic.volume=0;bgMusic.play().catch(()=>{});bockFadeAudio(bgMusic,MAP1_BG_VOLUME,2200);}
  },1900);
}

function updateMap1Bock(now){
  if(!map1BockActive)return;
  const rider=ensureMap1BockRider();
  if(currentMap!==1||mapTransitioning){
    map1BockActive=false;
    rider.style.display='none';
    map1BockSong.pause();
    ensureMap1BockFX().dark.style.opacity='0';
    ensureMap1BockFX().fog.style.opacity='0';
    return;
  }
  if(map1BockStage!=='riding')return;

  const t=Math.min(1,(now-map1BockStart)/MAP1_BOCK_RIDE_DURATION);
  const [x,y]=bockPointAt(t);
  const seq=[1,2,3,2];
  const frame=seq[Math.floor((now-map1BockStart)/MAP1_BOCK_FRAME_MS)%seq.length];
  const wanted=`assets/npc/bock-reiter-${frame}.png?v=27`;
  if((rider.getAttribute('src')||'')!==wanted)rider.src=wanted;

  // Reiter hat bereits beim Spawn exakt die Endgröße der Lauf-/Reitbewegung. Kein Mini->Normal-Wachstum.
  const perspective=1.026; // nur Reit-/Laufbilder: 10 % kleiner als 1.14
  rider.style.left=`${x}px`;
  rider.style.top=`${y}px`;
  rider.style.transform=`translate(-50%,-100%) scale(${perspective})`;
  rider.style.zIndex=String(19000+Math.round(y));

  if(t>=1){
    map1BockStage='arrived';

    // ANKUNFT: Anhang 1 LINKS = Stehenbleiben, exakt 1,5 s.
    rider.src='assets/npc/bock-stop.png?v=30';
    rider.style.transform='translate(-50%,-100%) scale(1.14)'; /* exakt Lauf-/Reitsprite-Größe am Endpunkt */
    rider.style.opacity='1';rider.style.filter='none';

    map1BockArrivalTimer=setTimeout(()=>{
      if(!map1BockActive)return;

      // Danach Anhang 1 MITTE = Absteigen, exakt 0,5 s. Rechtes Bild wird NICHT benutzt.
      rider.src='assets/npc/bock-dismount.png?v=30';
      rider.style.transform='translate(-50%,-100%) scale(1.14)'; /* exakt Lauf-/Reitsprite-Größe */

      map1BockArrivalTimer=setTimeout(()=>{
        if(!map1BockActive)return;
        showBockPuff(MAP1_BOCK_PATH_END[0],MAP1_BOCK_PATH_END[1]);
        rider.style.transition='opacity 520ms ease,filter 520ms ease,transform 520ms ease';
        rider.style.opacity='0';rider.style.filter='blur(8px) brightness(2.1)';
        rider.style.transform='translate(-50%,-100%) scale(1.14)';
        map1BockStage='puff';

        setTimeout(()=>{
          rider.style.display='none';
          const final=ensureMap1BockFinal();
          final.style.left=`${MAP1_BOCK_PATH_END[0]}px`;
          final.style.top=`${MAP1_BOCK_PATH_END[1]}px`;
          final.style.transform='translate(-50%,-100%)';
          final.style.transition='opacity 380ms ease';
          final.style.opacity='0';final.style.display='block';
          requestAnimationFrame(()=>{final.style.opacity='1';});
          map1BockStage='final';

          // 5 Sekunden stehen, dann Song/Nebel/Dunkelheit weich raus + normale Musik weich rein.
          map1BockFinalTimer=setTimeout(finishMap1BockEvent,5000);
        },540);
      },500);
    },1500);
  }
}


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
const MAP2_SPAWN={x:768,y:666}; // nochmals ca. 0,5 cm / 8 Weltpixel tiefer
const MAP2_EXIT_TRIGGER={x1:700,x2:836,y1:705,y2:770};

/* MAP 2 – THEKE.
   Position/Größe aus der beigefügten Map-2-Referenz auf 1536×1024 übertragen.
   Die Theke selbst ist von links/rechts/oben betretbar. Ausschließlich ihre sichtbare
   UNTERKANTE ist eine Hitbox. Befinden sich die Füße oberhalb dieser Kante innerhalb
   der Thekenbreite, wird der Spieler hinter der Theke gezeichnet. */
const MAP2_BAR={
  left:662,
  top:413,
  width:212,
  height:120,
  bottom:533
};
let map2Bar=null;
let map2BarAction=null;
let map2BarProgress=null;
let map2BarServing=false;
let map2BarServeTimer=0;

const MAP2_BAR_INTERACT={
  // Spieler muss direkt hinter und annähernd mittig an der Theke stehen.
  xTolerance:52,
  yMin:MAP2_BAR.top+48,
  yMax:MAP2_BAR.bottom-0.1,
  duration:3000
};

function ensureMap2Bar(){
  if(map2Bar)return map2Bar;
  map2Bar=document.getElementById('map2Bar');
  if(!map2Bar){
    map2Bar=document.createElement('img');
    map2Bar.id='map2Bar';
    map2Bar.src='assets/props/theke.png?v=03';
    map2Bar.alt='';
    map2Bar.draggable=false;
    Object.assign(map2Bar.style,{
      position:'absolute',
      left:`${MAP2_BAR.left}px`,
      top:`${MAP2_BAR.top}px`,
      width:`${MAP2_BAR.width}px`,
      height:`${MAP2_BAR.height}px`,
      objectFit:'fill',
      pointerEvents:'none',
      userSelect:'none',
      display:'none',
      zIndex:'600'
    });
    world.appendChild(map2Bar);
  }
  return map2Bar;
}

function ensureMap2BarAction(){
  const bar=ensureMap2Bar();
  if(!map2BarAction){
    map2BarAction=document.createElement('img');
    map2BarAction.id='map2BarAction';
    map2BarAction.src='assets/props/theke-ausschank.png?v=01';
    map2BarAction.alt='';
    map2BarAction.draggable=false;
    Object.assign(map2BarAction.style,{
      position:'absolute',
      // Ausschank-Asset ist intern kleiner als theke.png. Diese Werte gleichen die
      // sichtbaren Thekenkanten pixelgenau an das normale Thekenmotiv an.
      left:`${MAP2_BAR.left-13}px`,top:`${MAP2_BAR.top-47}px`,
      width:`${MAP2_BAR.width*1.123}px`,height:`${MAP2_BAR.height*1.379}px`,objectFit:'fill',
      pointerEvents:'none',userSelect:'none',display:'none',opacity:'0',zIndex:'10002',
      transition:'opacity 220ms ease'
    });
    world.appendChild(map2BarAction);
  }
  if(!map2BarProgress){
    map2BarProgress=document.createElement('div');
    map2BarProgress.id='map2BarProgress';
    Object.assign(map2BarProgress.style,{
      position:'absolute',left:`${MAP2_BAR.left+MAP2_BAR.width/2-18}px`,
      top:`${MAP2_BAR.top+MAP2_BAR.height/2-18}px`,width:'36px',height:'36px',
      borderRadius:'50%',pointerEvents:'none',display:'none',zIndex:'10003',
      background:'conic-gradient(#ffd42a 0deg, rgba(255,212,42,.18) 0deg)',
      boxShadow:'0 0 9px rgba(255,210,35,.8)',
      WebkitMask:'radial-gradient(circle, transparent 54%, #000 57%)',
      mask:'radial-gradient(circle, transparent 54%, #000 57%)'
    });
    world.appendChild(map2BarProgress);
  }
  return {bar,action:map2BarAction,progress:map2BarProgress};
}

function map2BarCanInteract(){
  if(currentMap!==2 || mapTransitioning || map2BarServing)return false;
  const cx=MAP2_BAR.left+MAP2_BAR.width/2;
  return PLAYER.direction==='front' &&
    Math.abs(PLAYER.x-cx)<=MAP2_BAR_INTERACT.xTolerance &&
    PLAYER.y>=MAP2_BAR_INTERACT.yMin && PLAYER.y<=MAP2_BAR_INTERACT.yMax;
}

function updateMap2BarInteractionCue(){
  const {bar}=ensureMap2BarAction();
  if(currentMap!==2 || map2BarServing){
    bar.style.filter='none';
    return;
  }
  if(map2BarCanInteract()){
    bar.style.filter='brightness(1.22) drop-shadow(0 0 5px rgba(255,225,110,.95))';
  }else{
    bar.style.filter='none';
  }
}

function startMap2BarServe(){
  if(!map2BarCanInteract())return;
  const {bar,action,progress}=ensureMap2BarAction();
  map2BarServing=true;
  keys.clear(); PLAYER.moving=false; PLAYER.frameClock=0;
  bar.style.filter='none';
  // Exakter Motivtausch im selben Paint-Zyklus: niemals alte + neue Theke gleichzeitig.
  // visibility statt display erhält Position/Depth der normalen Theke vollständig.
  action.style.transition='none';
  action.style.display='block';
  action.style.opacity='1';
  bar.style.visibility='hidden';
  progress.style.display='block';
  player.style.transition='opacity 220ms ease';
  player.style.opacity='0';
  const start=performance.now();
  const tick=now=>{
    if(!map2BarServing)return;
    const t=Math.min(1,(now-start)/MAP2_BAR_INTERACT.duration);
    progress.style.background=`conic-gradient(#ffd42a ${t*360}deg, rgba(255,212,42,.18) ${t*360}deg)`;
    if(t<1){ map2BarServeTimer=requestAnimationFrame(tick); return; }
    // Exakt gleichzeitig zurücktauschen: Ausschankbild weg, normale Theke wieder da.
    action.style.opacity='0';
    action.style.display='none';
    bar.style.visibility='visible';
    player.style.opacity='1';
    progress.style.display='none';
    player.style.transition='';
    map2BarServing=false;
    updateMap2BarInteractionCue();
  };
  map2BarServeTimer=requestAnimationFrame(tick);
}

function updateMap2BarVisibility(){
  const bar=ensureMap2Bar();
  bar.style.display=currentMap===2 ? 'block' : 'none';
  ensureMap2BarAction();
  if(currentMap!==2){
    map2BarAction.style.display='none';
    map2BarProgress.style.display='none';
    bar.style.visibility='visible';
    map2BarServing=false;
    player.style.opacity='1';
  }
}

/* Nur die Unterkante kollidiert. Da movePlayerAxis achsenweise prüft, wird die Kante
   ausschließlich bei einer Y-Bewegung von oben nach unten bzw. unten nach oben getestet.
   Links/rechts sowie das Betreten des gesamten Bereichs von oben bleiben frei. */
function map2BarBlocksMove(fromX,fromY,toX,toY){
  if(currentMap!==2)return false;
  const pad=PLAYER.radius;
  const withinX=toX>=MAP2_BAR.left-pad && toX<=MAP2_BAR.left+MAP2_BAR.width+pad;
  if(!withinX)return false;

  // Die Fußposition darf die sichtbare Unterkante nicht kreuzen.
  if(fromY < MAP2_BAR.bottom && toY >= MAP2_BAR.bottom)return true;
  if(fromY > MAP2_BAR.bottom && toY <= MAP2_BAR.bottom)return true;
  return false;
}

function updateMap2BarDepth(){
  const bar=ensureMap2Bar();
  if(currentMap!==2){
    bar.style.display='none';
    return;
  }
  bar.style.display='block';

  const insideBarWidth=
    PLAYER.x>=MAP2_BAR.left &&
    PLAYER.x<=MAP2_BAR.left+MAP2_BAR.width;

  // EXAKTE REGEL:
  // Fußpunkt OBERHALB der bereits vorhandenen Theken-Unterkante -> Figur hinter der Theke.
  // Fußpunkt UNTERHALB/auf der Kante -> Figur vor der Theke.
  const playerBehindBar=insideBarWidth && PLAYER.y<MAP2_BAR.bottom;
  if(playerBehindBar){
    // Oberhalb der Unterkante: Figur läuft HINTER der Theke.
    bar.style.zIndex='10000';
    player.style.zIndex='9999';
  }else{
    // Auf/unterhalb der Unterkante: Figur steht VOR der Theke und bleibt vollständig sichtbar.
    bar.style.zIndex='600';
    player.style.zIndex='10000';
  }
}


/* MAP 2 – finale Innenkarte, direkt auf die 1536×1024-Welt skaliert.
   Entscheidend: Kollisionskante = sichtbare UNTERKANTE der jeweiligen Wand.
   Die Wandtiefe selbst darf betreten werden; durch die Unterkante geht es NUR an Türen. */
let map2Room='guestroom';

/* Aus 2048×1365 Referenz auf 1536×1024: Faktor 0.75.
   Mittelwand: Oberkante ~239, Unterkante ~360.
   Frontwand: Oberkante ~690, Unterkante ~866. */
const MAP2_REAR_EDGE=137; // Rückwand war bereits korrekt und bleibt unverändert
// ROSA Effektlinien + ROTE Kollisionslinien aus der markierten Referenz.
const MAP2_MIDDLE_WALL={top:248,bottom:365,left:120,right:1420};
const MAP2_FRONT_WALL={top:709,bottom:860,left:57,right:1485};

/* Reale Türöffnungen an den jeweiligen Unterkanten. */
const MAP2_KITCHEN_DOOR={x1:382,x2:489,y1:248,y2:371};
const MAP2_FRONT_DOOR={x1:681,x2:839,y1:709,y2:874};

/* Normale Bodenflächen. Die perspektivischen Seitenkanten bleiben erhalten. */
const MAP2_GUEST_POLY=[[72,360],[1465,360],[1510,866],[25,866]];
const MAP2_KITCHEN_POLY=[[92,0],[1444,0],[1444,239],[92,239]];

/* Sobald die Mittelwand über die Tür betreten wurde, befindet sich der Spieler
   IN/HINTER der Wand. Dann darf er innerhalb der gesamten Wandtiefe links/rechts
   laufen und bleibt verdeckt. Das verhindert gleichzeitig, dass man die Wand
   von der Gaststube aus irgendwo anders betreten kann. */
let map2InMiddleWall=false;
let map2MiddleDoorPassArmed=true;

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

/* Seitenwände: exakt die ROT markierte sichtbare UNTERKANTE.
   Eine durchgehende perspektivische Linie; keine horizontalen Ersatzstücke. */
const MAP2_SIDE_Y1=137;
const MAP2_SIDE_Y2=860;
const MAP2_LEFT_X1=150;
const MAP2_LEFT_X2=57;
const MAP2_RIGHT_X1=1390;
const MAP2_RIGHT_X2=1485;

function map2LeftInnerEdge(y){
  const t=Math.max(0,Math.min(1,(y-MAP2_SIDE_Y1)/(MAP2_SIDE_Y2-MAP2_SIDE_Y1)));
  return MAP2_LEFT_X1+(MAP2_LEFT_X2-MAP2_LEFT_X1)*t;
}
function map2RightInnerEdge(y){
  const t=Math.max(0,Math.min(1,(y-MAP2_SIDE_Y1)/(MAP2_SIDE_Y2-MAP2_SIDE_Y1)));
  return MAP2_RIGHT_X1+(MAP2_RIGHT_X2-MAP2_RIGHT_X1)*t;
}
function insideMap2SideEdges(x,y){
  return x>=map2LeftInnerEdge(y) && x<=map2RightInnerEdge(y);
}

function map2CanStand(x,y){
  // Füße dürfen niemals über die sichtbaren unteren Innenkanten der Seitenwände.
  if(!insideMap2SideEdges(x,y))return false;
  // Rückwand: ausschließlich ihre sichtbare Unterkante begrenzt den Küchenboden.
  if(y<MAP2_REAR_EDGE)return false;

  if(map2Room==='kitchen'){
    // In der Küche existiert KEINE Kollisionskante an der Oberkante der Mittelwand.
    // Die Wandtiefe darf betreten werden; ihre UNTERKANTE bei y=360 ist nur an der Tür passierbar.
    if(y<MAP2_MIDDLE_WALL.bottom)return true;
    return inRect(x,y,MAP2_KITCHEN_DOOR);
  }

  if(map2InMiddleWall){
    // Hinter der Mittelwand ist die komplette Wandtiefe horizontal begehbar.
    // Es gibt hier bewusst KEINE zweite/obere Hitbox.
    if(y<MAP2_MIDDLE_WALL.bottom)return true;
    return inRect(x,y,MAP2_KITCHEN_DOOR);
  }

  if(map2Room==='guestroom'){
    // Gaststube: obere Grenze ist ausschließlich die UNTERKANTE der Mittelwand.
    if(y<MAP2_MIDDLE_WALL.bottom)return inRect(x,y,MAP2_KITCHEN_DOOR);
    // Untere Frontwand: Wandtiefe begehbar; ihre UNTERKANTE stoppt außer im Ausgang.
    if(y<=MAP2_FRONT_WALL.bottom)return true;
    return inRect(x,y,MAP2_FRONT_DOOR);
  }
  return false;
}

function ensureMap1Runner(){
  if(map1Runner)return map1Runner;
  map1Runner=document.createElement('img');
  map1Runner.id='map1Runner';
  map1Runner.src='assets/npc/frau-run-1.png?v=02';
  map1Runner.alt='';
  map1Runner.draggable=false;
  Object.assign(map1Runner.style,{
    position:'absolute',left:'0px',top:'0px',height:'auto',
    transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',
    zIndex:'12000',willChange:'left,top,transform'
  });
  world.appendChild(map1Runner);
  // Frau exakt auf dieselbe Basisgröße wie die Spielfigur setzen.
  const syncRunnerSize=()=>{
    const w=player?.offsetWidth || parseFloat(getComputedStyle(player).width) || 96;
    map1Runner.style.width=`${w}px`;
  };
  syncRunnerSize();
  requestAnimationFrame(syncRunnerSize);
  return map1Runner;
}

function map1RunnerPointAt(progress){
  const pts=MAP1_RUNNER_PATH;
  const lens=[]; let total=0;
  for(let i=1;i<pts.length;i++){
    const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
    lens.push(d); total+=d;
  }
  let target=Math.max(0,Math.min(1,progress))*total;
  for(let i=0;i<lens.length;i++){
    if(target<=lens[i]){
      const q=lens[i] ? target/lens[i] : 0;
      return [pts[i][0]+(pts[i+1][0]-pts[i][0])*q,pts[i][1]+(pts[i+1][1]-pts[i][1])*q];
    }
    target-=lens[i];
  }
  return pts[pts.length-1];
}

function stopMap1BearAudioLoop(){
  clearTimeout(map1BearLoopTimer);
  map1BearLoopTimer=null;
  [map1BearSound1,map1BearSound2,map1BearSound3].forEach(a=>{
    a.onended=null;
    a.pause();
    a.currentTime=0;
  });
  map1BearAudioStarted=false;
}

/* Nur die BÄRENSOUNDS enden mit dem Bären. Der Song läuft unabhängig bis exakt 46 s. */
function stopMap1BearEventAudio(){
  stopMap1BearAudioLoop();
}

function cancelMap1BearSongAutomation(stopSong=false){
  clearTimeout(map1BearSongStartTimer);
  map1BearSongStartTimer=null;
  if(map1BearSongFadeRAF)cancelAnimationFrame(map1BearSongFadeRAF);
  if(map1BearSongWatchRAF)cancelAnimationFrame(map1BearSongWatchRAF);
  map1BearSongFadeRAF=0;
  map1BearSongWatchRAF=0;
  if(stopSong){
    map1BearSong.pause();
    map1BearSong.currentTime=0;
    map1BearSong.volume=MAP1_BEAR_SONG_VOLUME;
  }
}

function finishMap1BearSong(){
  if(map1BearSong.currentTime<MAP1_BEAR_SONG_END){
    try{map1BearSong.currentTime=MAP1_BEAR_SONG_END;}catch(_){}
  }
  map1BearSong.pause();
  map1BearSong.volume=MAP1_BEAR_SONG_VOLUME;
  map1BearSongWatchRAF=0;
  map1BearSongFadeRAF=0;
  if(bgMusic){
    bgMusic.volume=MAP1_BG_VOLUME;
    bgMusic.play().catch(()=>{});
  }
}

/* Song beginnt 0,3 s nach Schrei-Beginn.
   Ab Songsekunde 43,5 startet ein sauberer 2,5-s-Crossfade:
   Bear/Maiden 0.52 -> 0 und Arrival in Ashford 0 -> 0.40.
   Bei exakt Songsekunde 46 ist Bear/Maiden aus und die alte Musik voll da. */
function startMap1BearSong(){
  cancelMap1BearSongAutomation(true);
  if(bgMusic){
    bgMusic.pause();
    bgMusic.volume=MAP1_BG_VOLUME;
  }
  map1BearSong.currentTime=0;
  map1BearSong.volume=MAP1_BEAR_SONG_VOLUME;
  map1BearSong.play().catch(()=>{});

  const watch=()=>{
    if(map1BearSong.paused){
      map1BearSongWatchRAF=0;
      return;
    }

    const t=map1BearSong.currentTime;

    if(t>=MAP1_BEAR_SONG_END){
      finishMap1BearSong();
      return;
    }

    if(t>=MAP1_BEAR_SONG_FADE_START){
      const p=Math.max(0,Math.min(1,
        (t-MAP1_BEAR_SONG_FADE_START)/(MAP1_BEAR_SONG_END-MAP1_BEAR_SONG_FADE_START)
      ));
      map1BearSong.volume=MAP1_BEAR_SONG_VOLUME*(1-p);

      if(bgMusic){
        if(bgMusic.paused)bgMusic.play().catch(()=>{});
        bgMusic.volume=MAP1_BG_VOLUME*p;
      }
    }

    map1BearSongWatchRAF=requestAnimationFrame(watch);
  };

  map1BearSongWatchRAF=requestAnimationFrame(watch);
}

function startMap1BearAudioLoop(){
  stopMap1BearAudioLoop();
  map1BearAudioStarted=true;

  const stillRunning=()=>currentMap===1 && map1BearActive && map1BearAudioStarted;

  const play1=()=>{
    if(!stillRunning())return;
    map1BearSound1.currentTime=0;
    map1BearSound1.play().catch(()=>{});
    map1BearSound1.onended=()=>{
      if(stillRunning())map1BearLoopTimer=setTimeout(play2,500);
    };
  };
  const play2=()=>{
    if(!stillRunning())return;
    map1BearSound2.currentTime=0;
    map1BearSound2.play().catch(()=>{});
    map1BearSound2.onended=()=>{
      if(stillRunning())map1BearLoopTimer=setTimeout(play3,1000);
    };
  };
  const play3=()=>{
    if(!stillRunning())return;
    map1BearSound3.currentTime=0;
    map1BearSound3.play().catch(()=>{});
    map1BearSound3.onended=()=>{
      if(stillRunning())map1BearLoopTimer=setTimeout(play1,500);
    };
  };

  play1();
}

function startMap1Runner(){
  if(currentMap!==1 || mapTransitioning || map1RunnerActive)return;
  const el=ensureMap1Runner();

  // Taste 1: Schrei SOFORT. Er läuft vollständig weiter und wird NICHT vom Song beendet.
  clearTimeout(map1RunnerTimer);
  stopMap1BearAudioLoop();
  cancelMap1BearSongAutomation(true);
  map1RunnerSound.onended=null;
  map1RunnerSound.pause();
  map1RunnerSound.currentTime=0;
  if(bgMusic)bgMusic.pause();
  map1RunnerSound.play().catch(()=>{});

  // Exakt 0,3 s nach Beginn des Schreis startet Bear and the Maiden Fair parallel zum Schrei.
  map1BearSongStartTimer=setTimeout(()=>{
    if(currentMap!==1)return;
    startMap1BearSong();
  },300);

  // Frau rennt weiterhin erst 0,5 s nach Beginn des Schreis los.
  map1RunnerTimer=setTimeout(()=>{
    if(currentMap!==1 || mapTransitioning)return;
    map1RunnerActive=true;
    map1RunnerStart=performance.now();
    el.style.display='block';
    el.style.opacity='1';
  },500);

  // Bär + Bärensounds weiterhin erst nach komplettem Frauenschrei.
  map1RunnerSound.onended=()=>{
    if(currentMap!==1 || mapTransitioning)return;
    startMap1Bear(performance.now()-MAP1_BEAR_DELAY);
    startMap1BearAudioLoop();
  };
}
function updateMap1Runner(now){
  const el=ensureMap1Runner();
  if(!map1RunnerActive){ el.style.display='none'; return; }
  if(currentMap!==1 || mapTransitioning){
    map1RunnerActive=false; el.style.display='none'; map1RunnerSound.pause(); return;
  }
  const t=Math.min(1,(now-map1RunnerStart)/MAP1_RUNNER_DURATION);
  // Gleichmäßiger Lauf entlang der exakt nachgezeichneten roten Route.
  const [x,y]=map1RunnerPointAt(t);
  const phase=Math.floor((now-map1RunnerStart)/MAP1_RUNNER_FRAME_MS)%4;
  // Gewünschte Folge: Anhang 1 -> gespiegelt -> Anhang 2 -> gespiegelt.
  const useSecond=phase>=2;
  const mirrored=(phase===1||phase===3);
  const wanted=useSecond?'assets/npc/frau-run-2.png?v=02':'assets/npc/frau-run-1.png?v=02';
  if(el.getAttribute('src')!==wanted)el.setAttribute('src',wanted);
  const perspective=.82+t*.34;
  el.style.left=`${x}px`;
  el.style.top=`${y}px`;
  el.style.transform=`translate(-50%,-100%) scale(${mirrored?-perspective:perspective},${perspective})`;
  el.style.zIndex=String(12000+Math.round(y));
  if(t>=1){
    map1RunnerActive=false;
    el.style.display='none';
  }
}

function ensureMap1Bear(){
  if(map1Bear)return map1Bear;

  map1Bear=document.createElement('img');
  map1Bear.id='map1Bear';
  map1Bear.alt='';
  map1Bear.draggable=false;

  Object.assign(map1Bear.style,{
    position:'absolute',
    left:'0px',
    top:'0px',
    width:'192px',
    height:'auto',
    transformOrigin:'50% 100%',
    pointerEvents:'none',
    userSelect:'none',
    display:'none',
    visibility:'visible',
    opacity:'1',
    zIndex:'20000',
    willChange:'left,top,transform'
  });

  world.appendChild(map1Bear);

  const syncBearSize=()=>{
    const w=player?.offsetWidth || parseFloat(getComputedStyle(player).width) || 96;
    map1Bear.style.width=`${w*1.6}px`; // 20 % kleiner als bisher
  };
  syncBearSize();
  requestAnimationFrame(syncBearSize);

  // Sprite sofort laden; bei Fehler zweites Asset probieren.
  map1Bear.src='assets/npc/baer-run-1.png?v=22';
  map1Bear.onerror=()=>{
    console.error('BÄR-ASSET NICHT GEFUNDEN:',map1Bear.src);
  };

  return map1Bear;
}

function startMap1Bear(startTime=performance.now()){
  if(currentMap!==1 || mapTransitioning)return;

  const el=ensureMap1Bear();
  map1BearActive=true;
  map1BearStart=startTime+MAP1_BEAR_DELAY;
  // Bereits am Startpunkt positionieren, aber bis zum Delay unsichtbar.
  const [x,y]=map1RunnerPointAt(0);
  el.style.left=`${x}px`;
  el.style.top=`${y}px`;
  el.style.display='block';
  el.style.visibility='hidden';
  el.style.opacity='1';
  el.style.zIndex=String(20000+Math.round(y));
}

function updateMap1Bear(now){
  if(!map1BearActive)return;

  const el=ensureMap1Bear();

  if(currentMap!==1 || mapTransitioning){
    map1BearActive=false;
    el.style.display='none';
    stopMap1BearEventAudio();
    return;
  }

  if(now<map1BearStart){
    el.style.display='block';
    el.style.visibility='hidden';
    return;
  }

  el.style.display='block';
  el.style.visibility='visible';
  el.style.opacity='1';

  const t=Math.min(1,(now-map1BearStart)/MAP1_BEAR_DURATION);
  const [x,y]=map1RunnerPointAt(t);

  const phase=Math.floor((now-map1BearStart)/MAP1_BEAR_FRAME_MS)%5;
  // Exakte 5er-Folge: 1 -> 2 -> 2 gespiegelt -> 1 gespiegelt -> 3 -> repeat.
  const bearFrames=[
    ['assets/npc/baer-run-1.png?v=22',false],
    ['assets/npc/baer-run-2.png?v=22',false],
    ['assets/npc/baer-run-2.png?v=22',true],
    ['assets/npc/baer-run-1.png?v=22',true],
    ['assets/npc/baer-run-3.png?v=22',false]
  ];
  const [wanted,mirrored]=bearFrames[phase];

  // Robust: nur wechseln, wenn tatsächlich das andere Bären-Frame gebraucht wird.
  const currentBearSrc=(el.getAttribute('src')||'').split('?')[0];
  const wantedBearSrc=wanted.split('?')[0];
  if(currentBearSrc!==wantedBearSrc) el.setAttribute('src',wanted);

  const perspective=.82+t*.34;
  el.style.left=`${x}px`;
  el.style.top=`${y}px`;
  el.style.transform=`translate(-50%,-100%) scale(${mirrored?-perspective:perspective},${perspective})`;
  el.style.zIndex=String(20000+Math.round(y));

  if(t>=1){
    map1BearActive=false;
    el.style.display='none';
    // Bär ist von der Karte: NUR Bärensounds beenden.
    // Bear and the Maiden Fair läuft unabhängig bis exakt Songsekunde 46 weiter.
    stopMap1BearEventAudio();
  }
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
  updateMap1Runner(now);
    updateMap1Bear(now);
  updateMap1Bock(now);
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
  bgMusic.volume=MAP1_BG_VOLUME;
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

/* Richtungswechsel: alle Player-Sprites bleiben als bereits decodierte Image-Objekte im RAM.
   Beim Wechsel wird das neue Richtungsbild im selben Tick gesetzt; zusätzlich sperrt ein
   Richtungs-Token verspätete Decode-/Load-Ergebnisse der alten Richtung aus. */
const PLAYER_IMAGE_CACHE=new Map();
let playerDirectionToken=0;

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
  if(force || current!==next){
    const cached=PLAYER_IMAGE_CACHE.get(next);
    // Der Cache ist vor Spielstart vollständig decodiert. src deshalb ohne Wartebild wechseln.
    player.setAttribute('src',cached?.src||next);
  }

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
  ++playerDirectionToken;
  PLAYER.direction=direction;
  PLAYER.sequenceIndex=0;
  PLAYER.frameClock=0;
  PLAYER.frame=PLAYER_SEQUENCES[direction][0];
  // Wichtig: Richtungsframe SOFORT setzen, bevor im selben Tick Bewegung/Depth berechnet wird.
  showPlayerFrame(true);
}


/* MAP 1 – Tiefen-/Kollisionszonen der Props.
   Maßstab unverändert: 0,5 cm = 8 Weltpixel, 1 cm = 16 Weltpixel.
   WICHTIG: Tiefenregeln verändern AUSSCHLIESSLICH die Charakterebene. Props wechseln
   niemals wegen des Spielers ihre Ebene gegeneinander; Stuhl/Tafel usw. behalten ihre Ordnung.
   Stehtische bleiben unverändert aus v35.
   Tafel: Effekt gegenüber v35 weitere +1 cm (= +16 px) nach unten.
   Stuhl: Effekt gegenüber v35 weitere +2 cm (= +32 px) nach unten.
   Baum: Effekt gegenüber v35 weitere +3 cm (= +48 px) nach unten.
   Wirtschaft bleibt obere 1/2 Effektzone. */
const STANDING_TABLE_IDS=new Set(['stehtischLinks','stehtischMitte','stehtischRechts']);
const TOP_PASSAGE_IDS=new Set(['stuhl','tafel']);
const TABLE_PASSAGE_EXTRA_WORLD=16;
const TAFEL_PASSAGE_EXTRA_WORLD=40; // v35 24 + 16
const CHAIR_PASSAGE_EXTRA_WORLD=56; // v35 24 + 32
const TREE_PASSAGE_EXTRA_WORLD=48;  // +3 cm gegenüber v35

function spriteLocalPoint(s,x,y){
  const el=s.el,left=px(el,'left'),top=px(el,'top'),dw=el.offsetWidth,dh=el.offsetHeight;
  if(!dw||!dh||x<left||x>=left+dw||y<top||y>=top+dh)return null;
  const sx=Math.min(s.sourceW-1,Math.max(0,Math.floor((x-left)/dw*s.sourceW)));
  const sy=Math.min(s.sourceH-1,Math.max(0,Math.floor((y-top)/dh*s.sourceH)));
  return {el,left,top,dw,dh,sx,sy,alpha:s.alpha[sy*s.sourceW+sx]};
}

function furnitureTopPassage(s,x,y){
  if(currentMap!==1)return false;
  const id=s.el.id;
  if(!STANDING_TABLE_IDS.has(id) && !TOP_PASSAGE_IDS.has(id))return false;
  const p=spriteLocalPoint(s,x,y); if(!p)return false;
  const {dh,sx,sy}=p;
  let first=-1;
  for(let yy=0;yy<s.sourceH;yy++){if(s.alpha[yy*s.sourceW+sx]>=24){first=yy;break;}}
  if(first<0)return false;
  let extraWorld=TABLE_PASSAGE_EXTRA_WORLD;
  if(id==='tafel')extraWorld=TAFEL_PASSAGE_EXTRA_WORLD;
  else if(id==='stuhl')extraWorld=CHAIR_PASSAGE_EXTRA_WORLD;
  const extraSource=extraWorld/dh*s.sourceH;
  if(STANDING_TABLE_IDS.has(id)){
    let last=-1;
    const maxPlate=Math.min(s.sourceH-1,Math.floor(s.sourceH*.34));
    for(let yy=first;yy<=maxPlate;yy++){if(s.alpha[yy*s.sourceW+sx]>=24)last=yy;}
    if(last<first)return false;
    const oldPassEnd=first+(last-first)*0.80;
    return sy<=Math.min(s.sourceH-1,oldPassEnd+extraSource);
  }
  return sy<=Math.min(s.sourceH-1,first+extraSource);
}

function propRatioPassage(s,x,y){
  if(currentMap!==1)return false;
  const id=s.el.id;
  if(id!=='wirtschaft' && id!=='baum')return false;
  const p=spriteLocalPoint(s,x,y); if(!p || p.alpha<24)return false;
  if(id==='wirtschaft')return p.sy/Math.max(1,s.sourceH-1)<0.50;
  // Baum: bisher 2/3, jetzt dieselbe Effektgrenze zusätzlich 3 cm nach unten.
  const extraSource=TREE_PASSAGE_EXTRA_WORLD/p.dh*s.sourceH;
  const end=(s.sourceH-1)*(2/3)+extraSource;
  return p.sy<=Math.min(s.sourceH-1,end);
}

function standingTablePlatePassage(s,x,y){
  return furnitureTopPassage(s,x,y) || propRatioPassage(s,x,y);
}

/* Breitere Fußprobe statt nur eines einzigen Pixels. Dadurch bleibt die Figur beim
   Richtungswechsel stabil auf derselben Vorder-/Hinterebene und "clippt" am Baum nicht. */
function playerBehindSprite(sprite){
  const r=Math.max(5,PLAYER.radius*.72);
  const probes=[[0,0],[-r,0],[r,0],[-r*.55,-2],[r*.55,-2]];
  return probes.some(([ox,oy])=>
    furnitureTopPassage(sprite,PLAYER.x+ox,PLAYER.y+oy) ||
    propRatioPassage(sprite,PLAYER.x+ox,PLAYER.y+oy)
  );
}

/* MAP 1: Props behalten IMMER ihre gegenseitige Reihenfolge.
   Für den Tiefeneffekt gibt es nur zwei Charakterebenen: hinter ALLEN Props / vor ALLEN Props.
   Die Props selbst werden dabei niemals umsortiert oder während eines Effekts verändert. */
const MAP1_PROP_DEPTH_Z=500;
const MAP1_PLAYER_BEHIND_Z=499;
const MAP1_PLAYER_FRONT_Z=1000;
let map1PropDepthInitialized=false;
function ensureMap1PropDepthOrder(){
  if(map1PropDepthInitialized)return;
  const ids=[...STANDING_TABLE_IDS,...TOP_PASSAGE_IDS,'wirtschaft','baum'];
  for(const id of ids){
    const el=document.getElementById(id);
    if(el)el.style.zIndex=String(MAP1_PROP_DEPTH_Z);
  }
  map1PropDepthInitialized=true;
}
function updateStandingTableDepth(){
  if(currentMap!==1)return;
  ensureMap1PropDepthOrder();
  const ids=[...STANDING_TABLE_IDS,...TOP_PASSAGE_IDS,'wirtschaft','baum'];
  let behindAny=false;
  for(const id of ids){
    const el=document.getElementById(id); if(!el)continue;
    const sprite=collisionSprites.find(s=>s.el===el);
    if(sprite && playerBehindSprite(sprite)){behindAny=true;break;}
  }
  // Ausschließlich der CHARAKTER wechselt: Effektzone = Hintergrund, sonst Vordergrund.
  player.style.zIndex=behindAny?String(MAP1_PLAYER_BEHIND_Z):String(MAP1_PLAYER_FRONT_Z);
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
  if(dy&&playerCanStand(PLAYER.x,ny) &&
     !map2BarBlocksMove(PLAYER.x,PLAYER.y,PLAYER.x,ny))PLAYER.y=ny;
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
  const f=Math.max(0,Math.min(1,fraction));
  const cutBottom=(1-f)*100;
  player.style.clipPath=`inset(0 0 ${cutBottom}% 0)`;
  player.style.webkitClipPath=`inset(0 0 ${cutBottom}% 0)`;
}

function playerWorldHeight(){
  // clipPath arbeitet auf dem unskalierten Element; für die Weltposition brauchen wir
  // die tatsächlich sichtbare Höhe inklusive Map-2-Skalierung.
  return Math.max(1,player.offsetHeight*playerVisualScale());
}

function visibleAboveWallTop(footY,wallTop){
  // EIN einziges geometrisches Occlusion-Modell:
  // Sichtbar bleibt exakt der Teil des Sprites, der oberhalb der Wand-Oberkante liegt.
  // Dadurch beginnt die Freigabe erst, wenn die Haarspitze die Oberkante berührt,
  // und es gibt keine zweite künstliche Kante mehr.
  const h=playerWorldHeight();
  const spriteTop=footY-h;
  return Math.max(0,Math.min(1,(wallTop-spriteTop)/h));
}

function updateMap2Occlusion(){
  if(!player)return;
  player.style.clipPath='none';
  player.style.webkitClipPath='none';
  if(currentMap!==2)return;

  // MITTELWAND: Effekt nur nachdem die Tür von der Gaststube aus betreten wurde.
  // Danach über die gesamte Wandbreite, bis die Figur oberhalb der Wand wieder frei ist.
  if(map2InMiddleWall){
    setPlayerVisibleFraction(visibleAboveWallTop(PLAYER.y,MAP2_MIDDLE_WALL.top));
    return;
  }

  // FRONTWAND: ebenfalls nur EIN Occluder. Beginn exakt an der sichtbaren Oberkante.
  // Beim Rückweg erscheint zuerst die Haarspitze, exakt wenn sie diese Kante erreicht.
  if(map2Room==='guestroom' &&
     PLAYER.x>=MAP2_FRONT_WALL.left && PLAYER.x<=MAP2_FRONT_WALL.right){
    const h=playerWorldHeight();
    const spriteTop=PLAYER.y-h;
    const overlapsFrontWall=PLAYER.y>=MAP2_FRONT_WALL.top && spriteTop<=MAP2_FRONT_WALL.bottom;
    if(overlapsFrontWall){
      // Untere Wand verdeckt die Figur auch dann zuverlässig, wenn sie bereits HINTER
      // der Wand steht: maßgeblich ist die Sprite-Überlappung, nicht nur der Fußpunkt.
      setPlayerVisibleFraction(visibleAboveWallTop(PLAYER.y,MAP2_FRONT_WALL.top));
    }
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
  playDoorPassSound();
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
  map2MiddleDoorPassArmed=true;
  document.body.classList.add('map2');
  updateMap2BarVisibility();
  await swapMap('assets/maps/wirtschaft-innen.jpg?v=18');

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
  playDoorPassSound();
  mapTransitioning=true;
  keys.clear(); PLAYER.moving=false; PLAYER.frameClock=0;
  if(player)player.classList.add('map-fading');
  await new Promise(r=>setTimeout(r,220));
  await animateIris(150,0,650);
  setIrisRadius(0);
  currentMap=1; map2Room='guestroom'; map2InMiddleWall=false; map2MiddleDoorPassArmed=true;
  document.body.classList.remove('map2');
  updateMap2BarVisibility();
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

  // Gaststube -> Mittelwand: ausschließlich durch die echte Tür an der UNTERKANTE y=360.
  if(map2Room==='guestroom' && !map2InMiddleWall &&
     PLAYER.x>=MAP2_KITCHEN_DOOR.x1 && PLAYER.x<=MAP2_KITCHEN_DOOR.x2 &&
     PLAYER.y<MAP2_MIDDLE_WALL.bottom){
    if(map2MiddleDoorPassArmed){playDoorPassSound();map2MiddleDoorPassArmed=false;}
    map2InMiddleWall=true;
  }

  // Mittelwand -> Küche: KEINE obere Hitbox. Sobald die Füße die visuelle Oberkante
  // überschritten haben, ist die Figur in der Küche und wird wieder normal gezeichnet.
  if(map2InMiddleWall && PLAYER.y<=MAP2_MIDDLE_WALL.top){
    map2InMiddleWall=false;
    map2Room='kitchen';
    map2MiddleDoorPassArmed=true;
  }

  // Küche -> Mittelwand: Oberkante ist KEINE Hitbox.
  // Beim Herunterlaufen muss der Effekt deshalb über die GANZE Wandbreite wieder einsetzen.
  // Erst die rote UNTERKANTE blockiert wieder; dort bleibt ausschließlich die Tür passierbar.
  if(map2Room==='kitchen' &&
     PLAYER.x>=MAP2_MIDDLE_WALL.left && PLAYER.x<=MAP2_MIDDLE_WALL.right &&
     PLAYER.y>MAP2_MIDDLE_WALL.top){
    // Wand-/Tür-Occlusion setzt sofort beim Eintauchen in die Wandtiefe ein.
    // Der Türsound kommt aber nur beim tatsächlichen Passieren der echten Türöffnung.
    map2Room='guestroom';
    map2InMiddleWall=true;
  }

  // Mittelwand -> Gaststube: erst nach vollständigem Überschreiten der unteren Wandkante.
  if(map2InMiddleWall && PLAYER.y>=MAP2_MIDDLE_WALL.bottom){
    if(map2MiddleDoorPassArmed &&
       PLAYER.x>=MAP2_KITCHEN_DOOR.x1 && PLAYER.x<=MAP2_KITCHEN_DOOR.x2){
      playDoorPassSound();
    }
    map2InMiddleWall=false;
    map2Room='guestroom';
    PLAYER.y=MAP2_MIDDLE_WALL.bottom;
    map2MiddleDoorPassArmed=true;
  }

  // Ausgang Map 2 -> Map 1 ausschließlich an der Haupttür der Front-Unterkante.
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
  if(mapTransitioning || map2BarServing){ playerLastTime=now; updateMap2BarInteractionCue(); return; }

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
  updateMap2BarDepth();
  updateMap2BarInteractionCue();
  updateStandingTableDepth();
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}
  if(k==='1' && !e.repeat){e.preventDefault();startMap1Runner();}
  if(k==='2' && !e.repeat){e.preventDefault();startMap1BockEvent();}
});
window.addEventListener('keydown',e=>{
  if(e.code==='Space'){
    e.preventDefault();
    if(!e.repeat)startMap2BarServe();
  }
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
  if(standingTablePlatePassage(s,x,y))return false;
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
async function preloadMap1BearFrames(){
  const paths=[
    'assets/npc/baer-run-1.png?v=22',
    'assets/npc/baer-run-2.png?v=22',
    'assets/npc/baer-run-3.png?v=22',
    'assets/npc/bock-reiter-1.png?v=27',
    'assets/npc/bock-reiter-2.png?v=27',
    'assets/npc/bock-reiter-3.png?v=27',
    'assets/npc/bock-stop.png?v=30',
    'assets/npc/bock-dismount.png?v=29',
    'assets/npc/bock-final.png?v=30'
  ];
  await Promise.all(paths.map(src=>new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>img.decode().catch(()=>{}).finally(resolve);
    img.onerror=()=>{
      console.error('BÄR-PRELOAD FEHLER:',src);
      resolve();
    };
    img.src=src;
  })));
}

async function preloadPlayerFrames(){
  await Promise.all(PLAYER_FRAME_PATHS.map(src=>new Promise(resolve=>{
    const img=new Image();
    PLAYER_IMAGE_CACHE.set(src,img);
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
  await preloadMap1BearFrames();
  ensureMap1Runner();
  ensureMap1Bear();
  ensureMap2Bar();
  ensureMap2BarAction();
  updateMap2BarVisibility();
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
  const baumCollision=document.getElementById('baum');
  if(baumCollision && !collidables.includes(baumCollision))collidables.push(baumCollision);
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