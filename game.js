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

/* MAP 1 – SCHREIBER / LIVE-STAND v75.
   Fester HUD-Charakter unten links: keine Hitbox, liegt vor der Spielfigur,
   während die bestehende Welt-/Randkollision vollständig unverändert bleibt. */
const MAP1_SCRIBE_IMAGES={
  normal:'assets/npc/schreiber-1.png?v=75',
  bock:'assets/npc/schreiber-2.png?v=75',
  warning:'assets/npc/schreiber-3.png?v=75'
};
let map1Popularity=69;
let map1GuestCount=0;
let map1ScribeWrap=null,map1ScribeImage=null,map1ScribePopularity=null,map1ScribeGuests=null;
let map1ScribeMode='normal';

function ensureMap1Scribe(){
  if(map1ScribeWrap)return map1ScribeWrap;
  map1ScribeWrap=document.createElement('div');
  map1ScribeWrap.id='map1Scribe';
  Object.assign(map1ScribeWrap.style,{
    position:'absolute',left:'0',bottom:'0',width:'clamp(250px, 28.5vw, 430px)',
    aspectRatio:'2 / 3',pointerEvents:'none',userSelect:'none',zIndex:'70000',
    overflow:'visible',opacity:'1',transition:'opacity 220ms ease'
  });
  map1ScribeImage=document.createElement('img');
  map1ScribeImage.alt='';map1ScribeImage.draggable=false;map1ScribeImage.src=MAP1_SCRIBE_IMAGES.normal;
  Object.assign(map1ScribeImage.style,{
    position:'absolute',left:'0',bottom:'0',width:'100%',height:'100%',objectFit:'contain',
    objectPosition:'left bottom',transform:'scaleX(-1)',transformOrigin:'50% 100%',
    pointerEvents:'none',userSelect:'none',transition:'opacity 220ms ease',opacity:'1'
  });
  const numberBase={position:'absolute',bottom:'24.0%',fontFamily:'Georgia,serif',fontWeight:'900',fontSize:'clamp(24px,3.0vw,46px)',lineHeight:'1',textShadow:'0 2px 2px rgba(255,245,220,.95), 0 0 3px rgba(255,245,220,.95)',pointerEvents:'none',zIndex:'2',transform:'rotate(-2deg)'};
  map1ScribePopularity=document.createElement('div');
  Object.assign(map1ScribePopularity.style,numberBase,{left:'32.0%',color:'#2aa83a'});
  map1ScribeGuests=document.createElement('div');
  Object.assign(map1ScribeGuests.style,numberBase,{left:'66.0%',color:'#c71919',transform:'rotate(2deg)'});
  map1ScribeWrap.append(map1ScribeImage,map1ScribePopularity,map1ScribeGuests);
  game.appendChild(map1ScribeWrap);
  renderMap1ScribeNumbers();
  return map1ScribeWrap;
}
function renderMap1ScribeNumbers(){
  if(!map1ScribePopularity||!map1ScribeGuests)return;
  map1ScribePopularity.textContent=String(map1Popularity);
  map1ScribePopularity.style.color=(map1Popularity>=40&&map1Popularity<=49)?'#c71919':'#2aa83a';
  map1ScribeGuests.textContent=String(map1GuestCount);
  map1ScribeGuests.style.color=map1GuestCount===0?'#c71919':'#111111';
}
function wantedMap1ScribeMode(){
  if(map1Popularity>=40&&map1Popularity<=49)return 'warning';
  if(map1BockActive||map1Event3Active)return 'bock';
  return 'normal';
}
function syncMap1Scribe(force=false){
  ensureMap1Scribe();
  const visible=currentMap===1&&!mapTransitioning;
  map1ScribeWrap.style.visibility=visible?'visible':'hidden';
  const mode=wantedMap1ScribeMode();
  if(!force&&mode===map1ScribeMode)return;
  map1ScribeMode=mode;
  const src=MAP1_SCRIBE_IMAGES[mode];
  if((map1ScribeImage.getAttribute('src')||'')===src)return;
  map1ScribeImage.style.opacity='0';
  setTimeout(()=>{
    if(!map1ScribeImage)return;
    map1ScribeImage.src=src;
    const reveal=()=>{if(map1ScribeImage)map1ScribeImage.style.opacity='1';};
    if(map1ScribeImage.complete)requestAnimationFrame(reveal); else map1ScribeImage.onload=reveal;
  },150);
}
function setMap1GuestCount(n){map1GuestCount=Math.max(0,Math.round(n));renderMap1ScribeNumbers();}
function changeMap1Popularity(delta){map1Popularity=Math.max(0,Math.min(99,map1Popularity+delta));renderMap1ScribeNumbers();syncMap1Scribe();}

/* MAP 1 – EVENT 2: DER BOCK GEHT UM (Taste 2). */
const map1BockSong=new Audio('assets/audio/Der Bock geht um.mp3');
map1BockSong.preload='auto';
map1BockSong.volume=.72;
const map1BockDepartureSound=new Audio('assets/audio/bock-departure.mp3');
const map1BockDrinkSound=new Audio('assets/audio/bock-drink.mp3');
const map1BockBurpSound=new Audio('assets/audio/bock-burp.mp3');
[map1BockDepartureSound,map1BockDrinkSound,map1BockBurpSound].forEach(a=>{a.preload='auto';a.volume=1;});

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
        animation:`bockFogDrift ${12.5+i*.45}s linear ${-i*1.35}s infinite`
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
  syncMap1Scribe();

  // Kompletter Wiederholungs-Reset für Taste 2.
  clearTimeout(map1BockServeTimer);
  clearTimeout(map1BockBurpTimer);
  clearTimeout(map1BockExitTimer);
  clearTimeout(map1BockFinalTimer);
  map1BockServing=false;
  map1BockBeerCount=0;
  if(map1BockThought){
    map1BockThought.style.display='none';
    map1BockThought.style.opacity='0';
    map1BockThought.style.transform='scale(.72)';
  }
  for(const mug of map1BockMugs.splice(0)){
    try{mug.getAnimations().forEach(a=>a.cancel());}catch(_){}
    mug.remove();
  }
  if(map1BockFinal){
    map1BockFinal.style.display='none';
    map1BockFinal.style.opacity='1';
    map1BockFinal.style.filter='none';
    map1BockFinal.style.transition='none';
    map1BockFinal.src='assets/npc/bock-final.png?v=30';
  }

  const {dark,fog}=ensureMap1BockFX();
  dark.style.transition='opacity 900ms ease';
  fog.style.transition='none';
  const rider=ensureMap1BockRider();
  try{rider.getAnimations().forEach(a=>a.cancel());}catch(_){}
  rider.style.transition='none';
  rider.style.opacity='1';
  rider.style.filter='none';
  rider.style.transform='translate(-50%,-100%) scale(1.026)';

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
  [map1BockDepartureSound,map1BockDrinkSound,map1BockBurpSound].forEach(a=>{a.pause();a.currentTime=0;});
  if(bgMusic)bgMusic.pause();

  // Schrei UND "Der Bock geht um" starten exakt gleichzeitig.
  map1RunnerSound.play().catch(()=>{});
  map1BockSong.currentTime=0;
  map1BockSong.volume=.72;
  map1BockSong.play().catch(()=>{});
  map1RunnerTimer=setTimeout(()=>{
    if(!map1BockActive)return;
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
    if(!map1BockActive)return;
    map1BockStage='riding';
    map1BockStart=performance.now();
    rider.style.display='block';
    rider.style.opacity='1';
    rider.style.filter='none';
  },3000);

}


let map1BockFinal=null;
let map1BockFinalTimer=0;

/* TASTE 2 – Friedrich Bock bleibt nach dem Auftritt stehen und verlangt 5 Bier. */
let map1BockThought=null;
let map1BockServing=false;
let map1BockBeerCount=0;
let map1BockServeTimer=0;
let map1BockBurpTimer=0;
let map1BockExitTimer=0;
let map1BockExitStart=0;
const map1BockMugs=[];
const MAP1_BOCK_BEERS_REQUIRED=5;
const MAP1_BOCK_INTERACT_DISTANCE=82;
const MAP1_BOCK_FOOT_Y=MAP1_BOCK_PATH_END[1];
const MAP1_BOCK_INTERACT_X=86;
const MAP1_BOCK_INTERACT_Y_MAX=72;


/* TASTE 2 – Nahaufnahme-/Symbol-Reaktionsoverlay vollständig entfernt (v74). */

function ensureMap1BockThought(){
  if(map1BockThought)return map1BockThought;
  map1BockThought=document.createElement('div'); map1BockThought.id='map1BockThought';
  Object.assign(map1BockThought.style,{position:'absolute',left:`${MAP1_BOCK_PATH_END[0]+18}px`,top:`${MAP1_BOCK_PATH_END[1]-204}px`,width:'92.4px',height:'75.6px',pointerEvents:'none',display:'none',opacity:'0',transform:'scale(.72)',transformOrigin:'20% 90%',zIndex:'23000',transition:'opacity 260ms ease, transform 340ms cubic-bezier(.2,.9,.2,1)'});
  const cloud=document.createElement('div'); Object.assign(cloud.style,{position:'absolute',left:'12px',top:'0',width:'80.4px',height:'61.2px',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'52% 48% 46% 54% / 48% 55% 45% 52%',boxShadow:'0 4px 12px rgba(0,0,0,.28)'});
  const beer=document.createElement('img'); beer.src='assets/npc/bock-wunsch.png?v=38'; beer.alt=''; beer.draggable=false; Object.assign(beer.style,{position:'absolute',left:'50%',top:'50%',width:'45.6px',height:'45.6px',objectFit:'contain',transform:'translate(-50%,-50%)'}); cloud.appendChild(beer);
  const c1=document.createElement('div'),c2=document.createElement('div'); [c1,c2].forEach(c=>Object.assign(c.style,{position:'absolute',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'50%',boxSizing:'border-box'})); Object.assign(c1.style,{left:'2px',top:'62px',width:'9px',height:'9px'}); Object.assign(c2.style,{left:'6px',top:'49px',width:'15px',height:'15px'});
  map1BockThought.append(c1,c2,cloud); world.appendChild(map1BockThought); return map1BockThought;
}
function showMap1BockThought(){ if(map1BockBeerCount>=MAP1_BOCK_BEERS_REQUIRED)return; const b=ensureMap1BockThought(); b.style.display='block';b.style.opacity='0';b.style.transform='scale(.72)';requestAnimationFrame(()=>requestAnimationFrame(()=>{b.style.opacity='1';b.style.transform='scale(1)';})); }
function hideMap1BockThought(){if(map1BockThought){map1BockThought.style.opacity='0';map1BockThought.style.transform='scale(.84)';setTimeout(()=>{if(map1BockThought&&map1BockThought.style.opacity==='0')map1BockThought.style.display='none';},280);}}
function map1BockCanInteract(){
  if(currentMap!==1||mapTransitioning||map1BockStage!=='waitingBeer'||map1BockServing||map1BockBeerCount>=MAP1_BOCK_BEERS_REQUIRED)return false;
  const dx=Math.abs(PLAYER.x-MAP1_BOCK_PATH_END[0]);
  const dy=PLAYER.y-MAP1_BOCK_FOOT_Y;
  // Bier nur VOR Friedrich: Fußpunkt niemals oberhalb seiner Fußlinie.
  // Erlaubt: mittig direkt davor sowie leicht links/rechts, jeweils auf/unter der Fußlinie.
  return dx<=MAP1_BOCK_INTERACT_X && dy>=0 && dy<=MAP1_BOCK_INTERACT_Y_MAX;
}
function updateMap1BockInteractionCue(){if(!map1BockFinal)return;map1BockFinal.style.filter=map1BockCanInteract()?'brightness(1.18) drop-shadow(0 0 6px rgba(255,225,110,.98)) drop-shadow(0 0 12px rgba(255,190,55,.75))':'none';}
function dropMap1BockMug(index){
  const mug=document.createElement('img');
  mug.src='assets/npc/bock-krug-leer.png?v=38';mug.alt='';mug.draggable=false;
  const landings=[[-62,15],[61,18],[-82,38],[82,42],[0,55]];
  const rests=[-76,72,-68,79,-73]; // bewusst liegend/schief; niemals kerzengerade
  const drifts=[[-7,3],[8,2],[-9,4],[10,3],[6,4]];
  const [ox,oy]=landings[Math.max(0,Math.min(landings.length-1,index))];
  const restRot=rests[index%rests.length], [slideX,slideY]=drifts[index%drifts.length];
  const endX=MAP1_BOCK_PATH_END[0]+ox,endY=MAP1_BOCK_PATH_END[1]+oy;
  const finalX=endX+slideX,finalY=endY+slideY;
  Object.assign(mug.style,{position:'absolute',left:`${MAP1_BOCK_PATH_END[0]}px`,top:`${MAP1_BOCK_PATH_END[1]-115}px`,width:'21.7px',height:'auto',transform:'translate(-50%,-100%) rotate(0deg)',transformOrigin:'50% 72%',pointerEvents:'none',zIndex:'400',filter:'none'});
  mug.dataset.x=String(finalX); mug.dataset.y=String(finalY); mug.dataset.landed='0'; mug.dataset.picked='0';
  map1BockMugs.push(mug); world.appendChild(mug);
  // Sanfter Wurf: nur leichte Drehung in der Luft, danach zwei kleine Bounces + kurzes Rutschen.
  const anim=mug.animate([
    {left:`${MAP1_BOCK_PATH_END[0]}px`,top:`${MAP1_BOCK_PATH_END[1]-115}px`,transform:'translate(-50%,-100%) rotate(0deg)'},
    {left:`${MAP1_BOCK_PATH_END[0]+ox*.48}px`,top:`${MAP1_BOCK_PATH_END[1]-150}px`,transform:`translate(-50%,-100%) rotate(${restRot*.28}deg)`,offset:.34},
    {left:`${endX}px`,top:`${endY}px`,transform:`translate(-50%,-100%) rotate(${restRot}deg)`,offset:.64},
    {left:`${endX+slideX*.38}px`,top:`${endY-7}px`,transform:`translate(-50%,-100%) rotate(${restRot+(restRot<0?4:-4)}deg)`,offset:.75},
    {left:`${endX+slideX*.62}px`,top:`${endY+slideY*.35}px`,transform:`translate(-50%,-100%) rotate(${restRot}deg)`,offset:.82},
    {left:`${endX+slideX*.82}px`,top:`${endY+slideY*.15-3}px`,transform:`translate(-50%,-100%) rotate(${restRot+(restRot<0?2:-2)}deg)`,offset:.90},
    {left:`${finalX}px`,top:`${finalY}px`,transform:`translate(-50%,-100%) rotate(${restRot}deg)`}
  ],{duration:900,easing:'cubic-bezier(.22,.72,.28,1)',fill:'forwards'});
  anim.onfinish=()=>{
    mug.style.left=`${finalX}px`;mug.style.top=`${finalY}px`;mug.style.transform=`translate(-50%,-100%) rotate(${restRot}deg)`;
    mug.dataset.landed='1';
  };
}
function map1BockNearbyMug(){
  if(currentMap!==1||mapTransitioning)return null;
  let best=null,bestD=Infinity;
  for(const mug of map1BockMugs){
    if(!mug?.isConnected||mug.dataset.picked==='1'||mug.dataset.landed!=='1')continue;
    const x=+mug.dataset.x,y=+mug.dataset.y,d=Math.hypot(PLAYER.x-x,PLAYER.y-y);
    if(d<=42&&d<bestD){best=mug;bestD=d;}
  }
  return best;
}
function updateMap1BockMugCue(){
  const near=map1BockNearbyMug();
  for(const mug of map1BockMugs){if(mug?.isConnected&&mug.dataset.picked!=='1')mug.style.filter=mug===near?'brightness(1.35) drop-shadow(0 0 5px rgba(255,225,110,.98)) drop-shadow(0 0 10px rgba(255,190,55,.72))':'none';}
}
function showMap1MugPlusOne(mug){
  const x=+mug.dataset.x,y=+mug.dataset.y;
  const plus=document.createElement('div'); plus.textContent='+1';
  Object.assign(plus.style,{position:'absolute',left:`${x}px`,top:`${y-18}px`,transform:'translate(-50%,-50%)',font:'700 22px/1 sans-serif',color:'#55e66b',textShadow:'0 2px 3px rgba(0,0,0,.8)',pointerEvents:'none',zIndex:'30000',opacity:'1'});
  world.appendChild(plus);
  plus.animate([{transform:'translate(-50%,8px)',opacity:1},{transform:'translate(-50%,-30px)',opacity:1,offset:.55},{transform:'translate(-50%,-48px)',opacity:0}],{duration:1500,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>plus.remove(),1550);
}
function pickupMap1BockMug(){
  const mug=map1BockNearbyMug(); if(!mug)return false;
  mug.dataset.picked='1'; mug.style.filter='none'; showMap1MugPlusOne(mug);
  mug.animate([{opacity:1,transform:'translate(-50%,-100%) scale(1)'},{opacity:0,transform:'translate(-50%,-115%) scale(.72)'}],{duration:180,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>mug.remove(),190); return true;
}

const MAP1_BOCK_EXIT_PATH=[[768,525],[806,560],[850,610],[925,650],[973,711],[1078,782],[1205,849],[1345,930],[1460,995],[1575,1065]];
function bockPathLength(pts){let total=0;for(let i=0;i<pts.length-1;i++)total+=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);return total;}
const MAP1_BOCK_RIDE_SPEED=bockPathLength(MAP1_BOCK_PATH)/MAP1_BOCK_RIDE_DURATION;
const MAP1_BOCK_EXIT_DURATION=bockPathLength(MAP1_BOCK_EXIT_PATH)/MAP1_BOCK_RIDE_SPEED;
function bockExitPointAt(t){
  const pts=MAP1_BOCK_EXIT_PATH,lens=[];let total=0;for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);lens.push(l);total+=l;}let d=Math.max(0,Math.min(1,t))*total;for(let i=0;i<lens.length;i++){if(d<=lens[i]||i===lens.length-1){const q=lens[i]?d/lens[i]:0;return[pts[i][0]+(pts[i+1][0]-pts[i][0])*q,pts[i][1]+(pts[i+1][1]-pts[i][1])*q];}d-=lens[i];}return pts[pts.length-1];
}
function beginMap1BockDeparture(){
  if(!map1BockActive)return;
  const final=ensureMap1BockFinal(),rider=ensureMap1BockRider();
  map1BockStage='departPuff'; showBockPuff(MAP1_BOCK_PATH_END[0],MAP1_BOCK_PATH_END[1]);
  final.style.transition='opacity 420ms ease,filter 420ms ease';final.style.opacity='0';final.style.filter='blur(8px) brightness(2.1)';
  setTimeout(()=>{
    final.style.display='none';final.style.filter='none';
    rider.style.display='block';rider.style.opacity='1';rider.style.filter='none';rider.style.left=`${MAP1_BOCK_PATH_END[0]}px`;rider.style.top=`${MAP1_BOCK_PATH_END[1]}px`;rider.style.transform='translate(-50%,-100%) scale(1.14)';
    rider.src='assets/npc/bock-dismount.png?v=30';map1BockStage='departMount';
    map1BockExitTimer=setTimeout(()=>{
      rider.src='assets/npc/bock-stop.png?v=30';map1BockStage='departStand';
      map1BockExitTimer=setTimeout(()=>{map1BockStage='departRide';map1BockExitStart=performance.now();map1BockDepartureSound.pause();map1BockDepartureSound.currentTime=0;if(currentMap===1&&!mapTransitioning)map1BockDepartureSound.play().catch(()=>{});},1500);
    },500);
  },540);
}
function finishMap1BockDeparture(){
  const rider=ensureMap1BockRider();rider.style.display='none';map1BockStage='done';map1BockActive=false;syncMap1Scribe();
  bockFadeAudio(map1BockSong,0,1800,()=>{map1BockSong.pause();map1BockSong.currentTime=0;map1BockSong.volume=.72;});
  const {dark,fog}=ensureMap1BockFX();dark.style.transition='opacity 1800ms ease';dark.style.opacity='0';fog.style.transition='opacity 1600ms ease';fog.style.opacity='0';
  setTimeout(()=>{fog.style.display='none';dark.style.display='none';if(bgMusic){bgMusic.volume=0;bgMusic.play().catch(()=>{});bockFadeAudio(bgMusic,MAP1_BG_VOLUME,2200);}},1900);
}

function startMap1BockBeerServe(){
  if(!map1BockCanInteract())return false;
  map1BockServing=true;keys.clear();PLAYER.moving=false;hideMap1BockThought();updateMap1BockInteractionCue();
  const final=ensureMap1BockFinal();final.src='assets/npc/bock-bier.png?v=38';clearTimeout(map1BockServeTimer);
  map1BockServeTimer=setTimeout(()=>{
    if(!map1BockActive)return;
    final.src='assets/npc/bock-trinkt.png?v=38';
    map1BockDrinkSound.pause();
    try{map1BockDrinkSound.currentTime=Math.min(1,Math.max(0,(map1BockDrinkSound.duration||1.01)-.01));}catch(_){map1BockDrinkSound.currentTime=1;}
    if(currentMap===1&&!mapTransitioning)map1BockDrinkSound.play().catch(()=>{});

    // Rülpser 1 Sekunde VOR dem Krugwurf; Trink-Sound läuft unangetastet weiter.
    clearTimeout(map1BockBurpTimer);
    map1BockBurpTimer=setTimeout(()=>{
      if(!map1BockActive)return;
      map1BockBurpSound.currentTime=0;
      if(currentMap===1&&!mapTransitioning)map1BockBurpSound.play().catch(()=>{});
    },2000);

    map1BockServeTimer=setTimeout(()=>{
      if(currentMap!==1)return;
      final.src='assets/npc/bock-final.png?v=30';
      dropMap1BockMug(map1BockBeerCount);
      map1BockBeerCount++;map1BockServing=false;
      if(map1BockBeerCount<MAP1_BOCK_BEERS_REQUIRED){map1BockStage='waitingBeer';showMap1BockThought();}
      else{map1BockStage='fiveBeersDone';hideMap1BockThought();clearTimeout(map1BockExitTimer);map1BockExitTimer=setTimeout(beginMap1BockDeparture,1000);}
      updateMap1BockInteractionCue();
    },3000);
  },1000);
  return true;
}

function ensureMap1BockFinal(){
  if(map1BockFinal)return map1BockFinal;
  map1BockFinal=document.createElement('img');
  map1BockFinal.id='map1BockFinal';
  map1BockFinal.src='assets/npc/bock-final.png?v=30';
  map1BockFinal.alt=''; map1BockFinal.draggable=false;
  Object.assign(map1BockFinal.style,{position:'absolute',left:'0',top:'0',height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',opacity:'1',zIndex:'750'});
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
  const final=ensureMap1BockFinal();final.style.transition='none';final.style.opacity='1';final.style.filter='none';final.style.display='block';final.src='assets/npc/bock-final.png?v=30';
  map1BockStage='waitingBeer';
}

function updateMap1Bock(now){
  if(!map1BockActive)return;
  const rider=ensureMap1BockRider();
  if(currentMap!==1||mapTransitioning){
    // v43: Bock-Sequenz wird NICHT beendet. Nur Map-1-Visuals/SFX werden innen verborgen.
    rider.style.visibility='hidden';
  }else{
    rider.style.visibility='visible';
  }
  if(map1BockStage==='departRide'){
    const t=Math.min(1,(now-map1BockExitStart)/MAP1_BOCK_EXIT_DURATION);
    const [x,y]=bockExitPointAt(t);const seq=[1,2,3,2];const frame=seq[Math.floor((now-map1BockExitStart)/MAP1_BOCK_FRAME_MS)%seq.length];
    const wanted=`assets/npc/bock-reiter-${frame}.png?v=27`;if((rider.getAttribute('src')||'')!==wanted)rider.src=wanted;
    rider.style.left=`${x}px`;rider.style.top=`${y}px`;rider.style.transform='translate(-50%,-100%) scale(1.026)';rider.style.zIndex=String(19000+Math.round(y));
    if(t>=1)finishMap1BockDeparture();return;
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
          setTimeout(()=>{if(map1BockActive)showMap1BockThought();},4500);
          map1BockFinalTimer=setTimeout(finishMap1BockEvent,5000);
        },540);
      },500);
    },1500);
  }
}


/* MAP 1 – EVENT 3 (Taste 3): Pfeifender Bauer trifft Friedrich Bock.
   Additiv/isoliert: Event 1 und Event 2 werden nicht verändert. */
const map1Event3Whistle=new Audio('assets/audio/Human whistle (singing) - sound effect.mp3');
map1Event3Whistle.preload='auto';
map1Event3Whistle.volume=.88;
const map1Event3SlashSound=new Audio('assets/audio/swdth_04_converted_by_soundandgo.com_.mp3');
map1Event3SlashSound.preload='auto';
map1Event3SlashSound.volume=.95;

const map1Event3BockSpawnSound=new Audio('assets/audio/whinny_m_01_converted_by_soundandgo.com_.mp3');
map1Event3BockSpawnSound.preload='auto';
map1Event3BockSpawnSound.volume=.92;

const map1Event3BockRunSound=new Audio('assets/audio/trot_sing_01_converted_by_soundandgo.com_.mp3');
map1Event3BockRunSound.preload='auto';
map1Event3BockRunSound.volume=.88;

/* Event-3-Sounds besitzen absichtlich getrennte Audio-Objekte:
   Pfeifen, Wiehern/Spawn, Huflauf und Schwerthieb dürfen sich überlagern. */
map1Event3BockSpawnSound.addEventListener('ended',()=>{
  if(!map1Event3Active || !map1Event3BockStarted)return;
  map1Event3BockRunSound.currentTime=0;
  map1Event3BockRunSound.play().catch(()=>{});
});

const MAP1_EVENT3_FARMER_DELAY=3000;
const MAP1_EVENT3_BOCK_DELAY_AFTER_FARMER=4000;
const MAP1_EVENT3_FARMER_FRAME_MS=430; // gemütliches Schlendern: Original -> gespiegelt -> repeat
const MAP1_EVENT3_FARMER_DURATION=18500;
const MAP1_EVENT3_BOCK_FRAME_MS=MAP1_BOCK_FRAME_MS;
const MAP1_EVENT3_BOCK_DURATION=MAP1_RUNNER_DURATION; // Friedrich nimmt exakt die normale Laufroute der Frau.
const MAP1_EVENT3_READY_DISTANCE=235;
const MAP1_EVENT3_HIT_DISTANCE=78;

let map1Event3Active=false;
let map1Event3Farmer=null;
let map1Event3Bock=null;
let map1Event3Slash=null;
let map1Event3Blood=null;
let map1Event3FarmerStart=0;
let map1Event3BockStart=0;
let map1Event3FarmerStarted=false;
let map1Event3BockStarted=false;
let map1Event3AttackStage='none';
let map1Event3FarmerState='walk';
let map1Event3Timers=[];

function map1Event3Later(fn,ms){
  const id=setTimeout(fn,ms);
  map1Event3Timers.push(id);
  return id;
}
function clearMap1Event3Timers(){
  for(const id of map1Event3Timers)clearTimeout(id);
  map1Event3Timers=[];
}
function map1Event3PointAt(progress,reverse=false){
  const p=Math.max(0,Math.min(1,progress));
  return map1RunnerPointAt(reverse?1-p:p);
}
function ensureMap1Event3Farmer(){
  if(map1Event3Farmer)return map1Event3Farmer;
  map1Event3Farmer=document.createElement('img');
  map1Event3Farmer.id='map1Event3Farmer';
  map1Event3Farmer.src='assets/npc/event3-bauer-walk.png?v=71';
  map1Event3Farmer.alt='';map1Event3Farmer.draggable=false;
  Object.assign(map1Event3Farmer.style,{
    position:'absolute',left:'0',top:'0',width:'176.4px',height:'auto',
    transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',
    display:'none',zIndex:'13000',willChange:'left,top,transform'
  });
  world.appendChild(map1Event3Farmer);
  return map1Event3Farmer;
}
function ensureMap1Event3Bock(){
  if(map1Event3Bock)return map1Event3Bock;
  map1Event3Bock=document.createElement('img');
  map1Event3Bock.id='map1Event3Bock';
  map1Event3Bock.src='assets/npc/bock-reiter-1.png?v=27';
  map1Event3Bock.alt='';map1Event3Bock.draggable=false;
  Object.assign(map1Event3Bock.style,{
    position:'absolute',left:'0',top:'0',width:'103.075px',height:'auto',
    transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',
    display:'none',zIndex:'19000',willChange:'left,top,transform'
  });
  world.appendChild(map1Event3Bock);
  return map1Event3Bock;
}
function ensureMap1Event3Blood(){
  if(map1Event3Blood)return map1Event3Blood;
  map1Event3Blood=document.createElement('div');
  map1Event3Blood.id='map1Event3Blood';
  Object.assign(map1Event3Blood.style,{
    position:'absolute',left:'0',top:'0',width:'112px',height:'42px',
    transform:'translate(-50%,-52%) scale(.04)',transformOrigin:'50% 50%',
    borderRadius:'50%',pointerEvents:'none',display:'none',opacity:'0',
    zIndex:'1',
    background:'radial-gradient(ellipse at center,rgba(118,0,0,.96) 0%,rgba(151,5,5,.94) 48%,rgba(91,0,0,.88) 72%,rgba(80,0,0,0) 76%)',
    filter:'blur(.45px)',willChange:'transform,opacity'
  });
  world.appendChild(map1Event3Blood);
  return map1Event3Blood;
}
function ensureMap1Event3Slash(){
  if(map1Event3Slash)return map1Event3Slash;
  map1Event3Slash=document.createElement('div');
  map1Event3Slash.id='map1Event3Slash';
  Object.assign(map1Event3Slash.style,{
    position:'absolute',left:'0',top:'0',width:'18px',height:'132px',
    transformOrigin:'50% 0%',pointerEvents:'none',display:'none',opacity:'0',
    zIndex:'60000',borderRadius:'60% 40% 55% 45%',
    background:'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.98) 38%,rgba(255,226,155,.98) 54%,rgba(255,255,255,0))',
    boxShadow:'0 0 7px rgba(255,255,255,.98),0 0 15px rgba(255,210,115,.95)',
    filter:'blur(.15px)',willChange:'transform,opacity'
  });
  world.appendChild(map1Event3Slash);
  return map1Event3Slash;
}
function showMap1Event3Slash(x,y){
  const slash=ensureMap1Event3Slash();
  // Großer kurzer Hieb: mittig, leicht links versetzt, von oben nach unten.
  slash.style.left=`${x-22}px`;
  slash.style.top=`${y-142}px`;
  slash.style.display='block';
  slash.style.opacity='1';
  slash.getAnimations().forEach(a=>a.cancel());
  slash.animate([
    {transform:'translate(-50%,-8px) rotate(10deg) scaleY(.18)',opacity:0},
    {transform:'translate(-50%,0) rotate(10deg) scaleY(1)',opacity:1,offset:.28},
    {transform:'translate(-50%,70px) rotate(10deg) scaleY(1.05)',opacity:.95,offset:.72},
    {transform:'translate(-50%,104px) rotate(10deg) scaleY(.76)',opacity:0}
  ],{duration:430,easing:'cubic-bezier(.18,.72,.18,1)',fill:'forwards'});
  map1Event3Later(()=>{slash.style.display='none';slash.style.opacity='0';},450);
}
function growMap1Event3Blood(x,y,z){
  const blood=ensureMap1Event3Blood();
  blood.getAnimations().forEach(a=>a.cancel());
  blood.style.left=`${x-8}px`;blood.style.top=`${y-30}px`;
  blood.style.zIndex=String(Math.max(1,z-1));
  blood.style.display='block';blood.style.opacity='1';
  blood.animate([
    {transform:'translate(-50%,-52%) scale(.04)',opacity:.35},
    {transform:'translate(-50%,-52%) scale(.38)',opacity:.78,offset:.22},
    {transform:'translate(-50%,-52%) scale(.72)',opacity:.92,offset:.58},
    {transform:'translate(-50%,-52%) scale(1)',opacity:.96}
  ],{duration:4200,easing:'ease-out',fill:'forwards'});
}
function map1Event3FarmerHit(){
  if(!map1Event3Active||map1Event3AttackStage==='hit')return;
  map1Event3AttackStage='hit';
  setMap1GuestCount(0);
  changeMap1Popularity(-20);

  const farmer=ensureMap1Event3Farmer();
  const bock=ensureMap1Event3Bock();
  const fx=parseFloat(farmer.style.left)||0,fy=parseFloat(farmer.style.top)||0;
  const bx=parseFloat(bock.style.left)||0,by=parseFloat(bock.style.top)||0;

  // Friedrich: Schlagbild exakt 0,5 s, Bewegung läuft währenddessen unverändert weiter.
  bock.src='assets/npc/event3-bock-slash.png?v=71';
  bock.style.width='103.075px';
  // Treffer: Pfeif-Song endet INSTANT mit Beginn des Schwerthiebs.
  map1Event3Whistle.pause();
  map1Event3Whistle.currentTime=0;

  // Laufenden Trab am Treffer stoppen. Nach vollständigem Schwerthieb-Sound
  // exakt 0,5 s warten und DANN denselben Trab-Sound erneut starten.
  map1Event3BockRunSound.pause();
  map1Event3BockRunSound.currentTime=0;
  map1Event3SlashSound.pause();
  map1Event3SlashSound.currentTime=0;
  map1Event3SlashSound.onended=()=>{
    map1Event3SlashSound.onended=null;
    map1Event3Later(()=>{
      if(!map1Event3Active || !map1Event3BockStarted)return;
      map1Event3BockRunSound.pause();
      map1Event3BockRunSound.currentTime=0;
      map1Event3BockRunSound.play().catch(()=>{});
    },500);
  };
  map1Event3SlashSound.play().catch(()=>{});
  showMap1Event3Slash(bx,by);

  // Bauer: sofort kniend/Bauch haltend für exakt 1,5 s.
  map1Event3FarmerState='kneel';
  farmer.src='assets/npc/event3-bauer-kneel.png?v=71';
  farmer.style.width='92px';
  farmer.style.transform='translate(-50%,-100%) scale(1)';

  map1Event3Later(()=>{
    if(!map1Event3Active)return;
    // Nach exakt 0,5 s wieder Friedrichs bestehende Laufanimation.
    if(map1Event3BockStarted){
      map1Event3AttackStage='afterHit';
      bock.src='assets/npc/bock-reiter-1.png?v=27';
    }
  },500);

  map1Event3Later(()=>{
    if(!map1Event3Active)return;
    // Nach 1,5 s Bauer am Boden; Blutpfütze startet winzig und wächst UNTER ihm.
    map1Event3FarmerState='dead';
    farmer.src='assets/npc/event3-bauer-dead.png?v=71';
    farmer.style.width='128px';
    farmer.style.transform='translate(-50%,-100%) scale(1)';
    const z=13000+Math.round(fy);
    farmer.style.zIndex=String(z);
    growMap1Event3Blood(fx,fy,z);

    // Bodenbild exakt 5 s, danach Bauer + Blut despawnen.
    map1Event3Later(()=>{
      if(!map1Event3Active)return;
      farmer.style.display='none';
      const blood=ensureMap1Event3Blood();
      blood.style.display='none';blood.style.opacity='0';
      map1Event3FarmerState='gone';
    },5000);
  },1500);
}
function resetMap1Event3Visuals(){
  if(map1Event3Farmer){map1Event3Farmer.getAnimations().forEach(a=>a.cancel());map1Event3Farmer.style.display='none';}
  if(map1Event3Bock){map1Event3Bock.getAnimations().forEach(a=>a.cancel());map1Event3Bock.style.display='none';}
  if(map1Event3Slash){map1Event3Slash.getAnimations().forEach(a=>a.cancel());map1Event3Slash.style.display='none';}
  if(map1Event3Blood){map1Event3Blood.getAnimations().forEach(a=>a.cancel());map1Event3Blood.style.display='none';}
}
function finishMap1Event3(){
  if(!map1Event3Active)return;
  map1Event3Active=false;
  syncMap1Scribe();
  clearMap1Event3Timers();
  resetMap1Event3Visuals();
  map1Event3Whistle.pause();map1Event3Whistle.currentTime=0;
  map1Event3SlashSound.pause();map1Event3SlashSound.currentTime=0;map1Event3SlashSound.onended=null;
  map1Event3BockSpawnSound.pause();map1Event3BockSpawnSound.currentTime=0;
  map1Event3BockRunSound.pause();map1Event3BockRunSound.currentTime=0;
  if(currentMap===1&&!mapTransitioning&&bgMusic){
    bgMusic.volume=0;
    bgMusic.play().catch(()=>{});
    bockFadeAudio(bgMusic,MAP1_BG_VOLUME,900);
  }
}
function startMap1Event3(){
  if(currentMap!==1||mapTransitioning||map1Event3Active)return;
  map1Event3Active=true;
  setMap1GuestCount(0);
  syncMap1Scribe();
  clearMap1Event3Timers();
  resetMap1Event3Visuals();

  map1Event3FarmerStarted=false;
  map1Event3BockStarted=false;
  map1Event3AttackStage='none';
  map1Event3FarmerState='walk';

  // Taste 3: Pfeif-Song SOFORT.
  if(bgMusic)bgMusic.pause();
  map1Event3Whistle.pause();
  map1Event3Whistle.currentTime=0;
  map1Event3Whistle.volume=.88;
  map1Event3Whistle.play().catch(()=>{});

  // Nach exakt 3 s schlendert der Bauer vom unteren Wegende nach oben.
  map1Event3Later(()=>{
    if(!map1Event3Active)return;
    const farmer=ensureMap1Event3Farmer();
    map1Event3FarmerStarted=true;
    setMap1GuestCount(1);
    map1Event3FarmerStart=performance.now();
    map1Event3FarmerState='walk';
    farmer.src='assets/npc/event3-bauer-walk.png?v=71';
    farmer.style.width='176.4px';
    farmer.style.display='block';
    farmer.style.visibility='visible';
    farmer.style.opacity='1';
  },MAP1_EVENT3_FARMER_DELAY);

  // Exakt 4 s nach Bauer-Start: Friedrich oben am anderen Ende.
  map1Event3Later(()=>{
    if(!map1Event3Active)return;
    const bock=ensureMap1Event3Bock();
    map1Event3BockStarted=true;
    map1Event3BockStart=performance.now();
    map1Event3AttackStage='none';
    bock.src='assets/npc/bock-reiter-1.png?v=27';
    bock.style.width='103.075px';
    bock.style.display='block';
    bock.style.visibility='visible';
    bock.style.opacity='1';

    // Bock erscheint: Sound 2 sofort; dessen 'ended'-Handler startet direkt danach Sound 3.
    // Beide laufen unabhängig vom weiterhin pfeifenden Bauern.
    map1Event3BockRunSound.pause();
    map1Event3BockRunSound.currentTime=0;
    map1Event3BockSpawnSound.currentTime=0;
    map1Event3BockSpawnSound.play().catch(()=>{});
  },MAP1_EVENT3_FARMER_DELAY+MAP1_EVENT3_BOCK_DELAY_AFTER_FARMER);
}
function updateMap1Event3(now){
  if(!map1Event3Active)return;
  const farmer=ensureMap1Event3Farmer();
  const bock=ensureMap1Event3Bock();

  const visible=currentMap===1&&!mapTransitioning;
  farmer.style.visibility=visible?'visible':'hidden';
  bock.style.visibility=visible?'visible':'hidden';
  if(map1Event3Blood)map1Event3Blood.style.visibility=visible?'visible':'hidden';
  if(map1Event3Slash)map1Event3Slash.style.visibility=visible?'visible':'hidden';

  // Bauer läuft dieselbe markierte Map-1-Linie rückwärts: unten -> oben.
  if(map1Event3FarmerStarted && map1Event3FarmerState==='walk'){
    const t=Math.min(1,(now-map1Event3FarmerStart)/MAP1_EVENT3_FARMER_DURATION);
    const [x,y]=map1Event3PointAt(t,true);
    const mirrored=(Math.floor((now-map1Event3FarmerStart)/MAP1_EVENT3_FARMER_FRAME_MS)%2)===1;
    const perspective=.82+(1-t)*.34;
    farmer.style.left=`${x}px`;farmer.style.top=`${y}px`;
    farmer.style.transform=`translate(-50%,-100%) scale(${mirrored?-perspective:perspective},${perspective})`;
    farmer.style.zIndex=String(13000+Math.round(y));
  }

  if(map1Event3BockStarted){
    const t=Math.min(1,(now-map1Event3BockStart)/MAP1_EVENT3_BOCK_DURATION);
    const [x,y]=map1Event3PointAt(t,false);

    // Bewegung wird NIEMALS für Attacke angehalten.
    bock.style.left=`${x}px`;bock.style.top=`${y}px`;
    bock.style.transform='translate(-50%,-100%) scale(1.026)';
    bock.style.zIndex=String(19000+Math.round(y));

    if(map1Event3AttackStage!=='hit'){
      if(map1Event3AttackStage==='afterHit'){
        const seq=[1,2,3,2];
        const frame=seq[Math.floor((now-map1Event3BockStart)/MAP1_EVENT3_BOCK_FRAME_MS)%seq.length];
        const wanted=`assets/npc/bock-reiter-${frame}.png?v=27`;
        if((bock.getAttribute('src')||'')!==wanted)bock.src=wanted;
      }else if(map1Event3FarmerStarted && map1Event3FarmerState==='walk'){
        const fx=parseFloat(farmer.style.left)||0,fy=parseFloat(farmer.style.top)||0;
        const d=Math.hypot(x-fx,y-fy);

        if(d<=MAP1_EVENT3_HIT_DISTANCE){
          map1Event3FarmerHit();
        }else if(d<=MAP1_EVENT3_READY_DISTANCE){
          map1Event3AttackStage='ready';
          if((bock.getAttribute('src')||'')!=='assets/npc/event3-bock-attack-ready.png?v=71')
            bock.src='assets/npc/event3-bock-attack-ready.png?v=71';
        }else{
          const seq=[1,2,3,2];
          const frame=seq[Math.floor((now-map1Event3BockStart)/MAP1_EVENT3_BOCK_FRAME_MS)%seq.length];
          const wanted=`assets/npc/bock-reiter-${frame}.png?v=27`;
          if((bock.getAttribute('src')||'')!==wanted)bock.src=wanted;
        }
      }
    }

    // Schlagbild nur 0,5 s; danach bestehende Bock-Laufanimation bei identischer Bewegung.
    if(map1Event3AttackStage==='hit'){
      // Schlagbild bleibt timergesteuert exakt 0,5 s; Position läuft trotzdem weiter.
    }else if(map1Event3AttackStage==='afterHit'){
      const seq=[1,2,3,2];
      const frame=seq[Math.floor((now-map1Event3BockStart)/MAP1_EVENT3_BOCK_FRAME_MS)%seq.length];
      const wanted=`assets/npc/bock-reiter-${frame}.png?v=27`;
      if((bock.getAttribute('src')||'')!==wanted)bock.src=wanted;
    }

    if(t>=1){
      bock.style.display='none';
      map1Event3BockStarted=false;
      // Event darf nach dem Bauern-Tod sauber auslaufen.
      map1Event3Later(finishMap1Event3,1200);
    }
  }
}


const WORLD_W = 1536;
const WORLD_H = 1024;
const ZOOM_LEVELS = [1];

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
  if(currentMap!==2 || mapTransitioning || map2BarServing || playerHasBeer)return false;
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
    playerHasBeer=true;
    PLAYER.sequenceIndex=0; PLAYER.frameClock=0; PLAYER.frame=activePlayerSequence(PLAYER.direction)[0];
    showPlayerFrame(true);
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
    startMap1BearSong();
  },300);

  // Frau rennt weiterhin erst 0,5 s nach Beginn des Schreis los.
  map1RunnerTimer=setTimeout(()=>{
    map1RunnerActive=true;
    map1RunnerStart=performance.now();
    el.style.display='block';
    el.style.opacity='1';
  },500);

  // Bär + Bärensounds weiterhin erst nach komplettem Frauenschrei.
  map1RunnerSound.onended=()=>{
    startMap1Bear(performance.now()-MAP1_BEAR_DELAY);
    startMap1BearAudioLoop();
  };
}
function updateMap1Runner(now){
  const el=ensureMap1Runner();
  if(!map1RunnerActive){ el.style.display='none'; return; }
  if(currentMap!==1 || mapTransitioning){
    // v43: Event-Zeitachse läuft im Hintergrund weiter; nur Map-1-Bild/SFX sind innen unsichtbar/stumm.
    el.style.visibility='hidden';
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
    // v43: Bär läuft zeitlich weiter. Innen nur unsichtbar; Bärensounds sind stumm, Song läuft weiter.
    el.style.visibility='hidden';
    stopMap1BearEventAudio();
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
function syncMap1EventVisibility(){
  const onMap1=currentMap===1 && !mapTransitioning;
  // Nur die VISUALS von Map-1-Events verstecken. Zustände/Zeitachsen laufen weiter.
  if(map1Runner) map1Runner.style.visibility=onMap1 ? (map1RunnerActive?'visible':'hidden') : 'hidden';
  if(map1Bear) map1Bear.style.visibility=onMap1 ? (map1BearActive?'visible':'hidden') : 'hidden';
  if(map1BockRider && map1BockRider.style.display!=='none') map1BockRider.style.visibility=onMap1?'visible':'hidden';
  if(map1BockFinal && map1BockFinal.style.display!=='none') map1BockFinal.style.visibility=onMap1?'visible':'hidden';
  if(map1BockThought && map1BockThought.style.display!=='none') map1BockThought.style.visibility=onMap1?'visible':'hidden';
  for(const mug of map1BockMugs){if(mug?.isConnected)mug.style.visibility=onMap1?'visible':'hidden';}
  for(const mug of map1TableMugs.values()){if(mug?.isConnected)mug.style.visibility=onMap1?'visible':'hidden';}
  if(map1BockPuff)map1BockPuff.style.visibility=onMap1?'visible':'hidden';
  const fx=ensureMap1BockFX();
  if(!onMap1){fx.dark.style.visibility='hidden';fx.fog.style.visibility='hidden';}
  else {fx.dark.style.visibility='visible';fx.fog.style.visibility='visible';}
}

/* In Map 2 laufen die Event-Zeitachsen weiter. Mitgenommen werden aber ausschließlich
   die Event-SONGS; Schreie/Bärensounds/Bock-SFX bleiben innen stumm. */
function syncEventAudioForCurrentMap(){
  if(currentMap===2){
    map1RunnerSound.pause();
    stopMap1BearAudioLoop();
    [map1BockDepartureSound,map1BockDrinkSound,map1BockBurpSound].forEach(a=>a.pause());
  }
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
  updateMap1Event3(now);
  updateMap1BockInteractionCue();
  updateMap1TreeInteractionCue();
  if(map1TreeHideImage && map1TreeHiding)syncMap1TreeHideImagePosition();
  updateMap1BockMugCue();
  syncMap1EventVisibility();
  syncMap1Scribe();
  syncEventAudioForCurrentMap();
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
/* v74: Nur noch die vollständig herausgezoomte Ansicht; Mausrad verändert den Zoom nicht mehr. */
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

/* v63 – Bierstatus: Standard ist OHNE Bier. Die bisherigen Laufbilder/-folgen bleiben
   vollständig erhalten und werden erst verwendet, sobald an der Theke ein Bier gezapft wurde. */
const PLAYER_NO_BEER_SEQUENCES={
  front:[1,2,3,4],
  back:[1,2,3,4],
  right:[2,1,3],
  left:[2,1,3]
};
let playerHasBeer=false;
function activePlayerSequence(direction){
  return playerHasBeer ? PLAYER_SEQUENCES[direction] : PLAYER_NO_BEER_SEQUENCES[direction];
}

const keys=new Set();
let playerLastTime=performance.now();

/* Richtungswechsel: alle Player-Sprites bleiben als bereits decodierte Image-Objekte im RAM.
   Beim Wechsel wird das neue Richtungsbild im selben Tick gesetzt; zusätzlich sperrt ein
   Richtungs-Token verspätete Decode-/Load-Ergebnisse der alten Richtung aus. */
const PLAYER_IMAGE_CACHE=new Map();
let playerDirectionToken=0;

function playerSpritePath(direction,frame){
  const source=(direction==='left'||direction==='right') ? 'side' : direction;
  if(!playerHasBeer)return `assets/player/nobier-${source}-${frame}.png?v=69`;
  /* Bestehende Bier-Sprites exakt wie bisher. */
  const version=source==='back' ? '' : '?v=12';
  return `assets/player/${source}-${frame}.png${version}`;
}

function playerVisualScale(){
  let s=1;
  /* v72: ALLE OHNE-BIER-Richtungen insgesamt exakt 10 % größer.
     MIT Bier bleibt jede bisherige Skalierung EXAKT unangetastet. */
  if(!playerHasBeer)s*=1.10;
  if(PLAYER.direction==='back' && playerHasBeer)s*=.85;
  if(currentMap===2)s*=1.15; // NUR Map 2: bisherige Map-2-Skalierung bleibt erhalten.
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
  /* v66: Die neuen OHNE-BIER-Seitensprites blicken im Quellbild nach rechts:
     D/right = unverändert, A/left = gespiegelt.
     MIT BIER bleibt die bisherige Spiegelungslogik EXAKT unangetastet. */
  const mirrorSide = playerHasBeer
    ? PLAYER.direction==='right'
    : PLAYER.direction==='left';
  if(mirrorSide){
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
  PLAYER.frame=activePlayerSequence(direction)[0];
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
const TABLE_PASSAGE_EXTRA_WORLD=64; // historischer Wert; Stehtische nutzen unten separat exakt 0,5 cm (=8 Weltpixel) Restkollision an der STÜTZE
const TAFEL_PASSAGE_EXTRA_WORLD=40; // v35 24 + 16
const CHAIR_PASSAGE_EXTRA_WORLD=56; // v35 24 + 32
const TREE_PASSAGE_EXTRA_WORLD=48;  // +3 cm gegenüber v35

/* FIX v43: linker Stehtisch exakt 5 cm (= 80 Weltpixel) tiefer.
   Da Kollision und Tiefeneffekt die echte Elementposition lesen, wandert der Effekt automatisch mit. */
const LEFT_TABLE_DOWN_WORLD=104; // v44: insgesamt 6,5 cm tiefer (v43 5 cm + weitere 1,5 cm)
function applyMap1LayoutFixes(){
  const t=document.getElementById('stehtischLinks');
  if(t && t.dataset.v44Moved!=='1'){
    const top=parseFloat(getComputedStyle(t).top)||0;
    t.style.top=`${top+LEFT_TABLE_DOWN_WORLD}px`;
    t.dataset.v44Moved='1';
  }
}

/* Baum-Hitbox: ausschließlich der schmale Stamm. Krone und sichtbare Wurzelausläufer
   links/rechts/unten sind bewusst KEINE Kollision. Werte beziehen sich auf das Baum-PNG. */
const TREE_TRUNK_HITBOX={x1:.455,x2:.545,y2:.865}; // v45: y1 ist dynamisch exakt die Baum-Ebenenwechselgrenze

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
    // v55: Tischplatte KOMPLETT frei. Kollision beginnt erst an der eigentlichen
    // mittigen Stütze und bleibt darunter alpha-genau bis zum Fuß erhalten.
    // Beim verwendeten Stehtisch-PNG endet die Platte bei ca. 68 % der Bildhöhe;
    // darunter liegt ausschließlich Stütze/Fuß.
    const supportStart=Math.floor(s.sourceH*.68);
    return sy<supportStart;
  }
  return sy<=Math.min(s.sourceH-1,first+extraSource);
}

function propRatioPassage(s,x,y){
  if(currentMap!==1)return false;
  const id=s.el.id;
  if(id!=='wirtschaft' && id!=='baum')return false;

  const p=spriteLocalPoint(s,x,y);
  if(!p)return false;

  if(id==='baum'){
    /* v58 FINALER BAUM-FIX:
       Die Ebenengrenze ist eine durchgehende horizontale Linie über die KOMPLETTE
       Breite des Baum-PNGs. Transparente Lücken in der Krone dürfen den Spieler
       NIEMALS wieder auf die Vorderebene holen.
       Oberhalb/auf der Linie = Hintergrund, unterhalb = Vordergrund.
       Die Linie bleibt exakt an derselben Höhe wie bisher und ist zugleich die
       Oberkante der separaten Stamm-Hitbox. */
    const extraSource=TREE_PASSAGE_EXTRA_WORLD/p.dh*s.sourceH;
    const end=(s.sourceH-1)*(2/3)+extraSource;
    return p.sy<=Math.min(s.sourceH-1,end);
  }

  /* Wirtschaft bleibt wie bisher alpha-/motivgebunden. */
  if(p.alpha<24)return false;
  return p.sy/Math.max(1,s.sourceH-1)<0.50;
}

function standingTablePlatePassage(s,x,y){
  return furnitureTopPassage(s,x,y) || propRatioPassage(s,x,y);
}

/* Breitere Fußprobe statt nur eines einzigen Pixels. Dadurch bleibt die Figur beim
   Richtungswechsel stabil auf derselben Vorder-/Hinterebene und "clippt" am Baum nicht. */
function playerBehindSprite(sprite){
  /* v57 Baum-Minifix:
     Der Baum darf den Ebenenwechsel nur EINMAL auslösen. Die bisherige breite
     5-Punkt-Fußprobe konnte an der Baumkontur mehrere Probes nacheinander
     ein-/austreten lassen -> sichtbar / verdeckt / sichtbar / verdeckt.
     Für den Baum deshalb exakt EIN stabiler Fußpunkt. Effektgrenze, Baumposition
     und Stamm-Hitbox bleiben unverändert. */
  if(sprite?.el?.id==='baum'){
    return propRatioPassage(sprite,PLAYER.x,PLAYER.y);
  }

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


/* MAP 1 – STEHTISCH-AUSSCHANK v45.
   Aktiv NUR bei direktem Kontakt UND korrekter Blickrichtung:
   oben + S/front, unten + W/back, rechts + A/left, links + D/right.
   Leertaste: 1 s Ausschankpose; danach normale Haltung + voller Krug mittig auf der Tischplatte. */
let map1TableServing=false;
let map1TableServeTimer=0;
const map1TableMugs=new Map();
const MAP1_TABLE_ACTION_MS=1000;
const MAP1_TABLE_TOUCH=8;
const MAP1_TABLE_ACTION_SPRITES={
  back:'assets/player/tisch-w.png?v=47', // W = Anhang 1
  front:'assets/player/tisch-s.png?v=47', // S = Anhang 2
  right:'assets/player/tisch-d.png?v=46',
  left:'assets/player/tisch-a.png?v=46'
};

function tableSpriteById(id){
  const el=document.getElementById(id);
  return el ? collisionSprites.find(s=>s.el===el) : null;
}
function rawSpriteOpaqueAt(s,x,y){
  const p=spriteLocalPoint(s,x,y);
  return !!p && p.alpha>=24;
}
function tableOpaqueVerticalBoundsAtX(s,worldX){
  const el=s.el,left=px(el,'left'),top=px(el,'top'),dw=el.offsetWidth,dh=el.offsetHeight;
  if(!dw||!dh||worldX<left||worldX>left+dw)return null;
  const sx=Math.min(s.sourceW-1,Math.max(0,Math.floor((worldX-left)/dw*s.sourceW)));
  let first=-1,last=-1;
  for(let sy=0;sy<s.sourceH;sy++){
    if(s.alpha[sy*s.sourceW+sx]>=24){if(first<0)first=sy;last=sy;}
  }
  if(first<0)return null;
  return {
    top:top+(first/s.sourceH)*dh,
    bottom:top+((last+1)/s.sourceH)*dh
  };
}
function tableTouchesInFacingDirection(s,dir){
  if(!s)return false;
  const el=s.el,left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  if(!w||!h)return false;
  const right=left+w,bottom=top+h;
  const r=PLAYER.radius;
  const gap=10;
  const downExtra=24;       // v48: gegenüber v47 nochmals +1 cm nach unten
  const sideTopCut=80;      // v48: A/D von oben nochmals je 1 cm kürzer (gesamt 5 cm)
  const sideInnerExtra=24;  // v51: A/D je 0,5 cm (=8 Weltpixel) von der Mitte weg; exakt 1 cm Mitte frei
  const sideOuterExtra=0;   // v48: A von rechts / D von links jeweils 2 cm kürzer als v47
  const wLeftToleranceExtra=24; // v53: W-Haltung auf gleicher Linie weitere 0,5 cm (=8 Weltpixel) nach LINKS erweitert
  const vb=tableOpaqueVerticalBoundsAtX(s,PLAYER.x);

  if(dir==='front'){ // OBERHALB + S: direkt an die TISCH-HITBOX andocken
    /* v54: S dockt an die echte Restkollision UNTEN an der Stütze an.
       Tischplatte und obere Stütze sind passierbar. Entlang der Spieler-X-Spalte suchen wir
       deshalb die ERSTE alpha-opake Stelle, die nach standingTablePlatePassage() noch blockiert.
       Das ist exakt die Oberkante des verbleibenden 0,5-cm-Stützenstreifens. */
    const probeHalf=Math.max(3,r*.55);
    const xs=[PLAYER.x,PLAYER.x-probeHalf,PLAYER.x+probeHalf];
    let hitboxTop=Infinity;
    const scanStep=1;
    for(const x of xs){
      for(let y=top;y<=bottom;y+=scanStep){
        if(rawSpriteOpaqueAt(s,x,y) && !standingTablePlatePassage(s,x,y)){
          hitboxTop=Math.min(hitboxTop,y);
          break;
        }
      }
    }
    if(!Number.isFinite(hitboxTop))return false;
    // Mini-Toleranz NACH OBEN: sobald der Fußkreis direkt an der echten Hitbox anliegt.
    const playerBottom=PLAYER.y+r;
    const topTolerance=10;
    return PLAYER.x>=left-r && PLAYER.x<=right+r &&
           playerBottom<=hitboxTop+2 && hitboxTop-playerBottom<=topTolerance;
  }
  if(dir==='back'){ // UNTERHALB + W: exakt an der Stützen-Hitbox, mit 0,5 cm erlaubtem Eindringen
    const edge=vb?vb.bottom:bottom;
    const dockY=edge+r-8;
    return PLAYER.x>=left-r-wLeftToleranceExtra && PLAYER.x<=right+r &&
           Math.abs(PLAYER.y-dockY)<=gap;
  }
  if(dir==='right'){ // LINKS + D
    return PLAYER.y>=top-r+sideTopCut && PLAYER.y<=bottom+r+downExtra &&
           PLAYER.x<=left+sideInnerExtra && left-PLAYER.x<=r+gap+sideOuterExtra;
  }
  if(dir==='left'){ // RECHTS + A
    return PLAYER.y>=top-r+sideTopCut && PLAYER.y<=bottom+r+downExtra &&
           PLAYER.x>=right-sideInnerExtra && PLAYER.x-right<=r+gap+sideOuterExtra;
  }
  return false;
}
/* v59 – LANGE TAFEL:
   Ausschließlich zentral von UNTEN andocken, Blickrichtung W/back.
   Kleine Toleranz nach unten sowie links/rechts. Keine Seiten-/Oberseiten-Interaktion.
   Stehtische bleiben vollständig in ihrer bisherigen Logik. */
const MAP1_TAFEL_DOCK_X_TOLERANCE=72;
const MAP1_TAFEL_DOCK_Y_TOLERANCE=14;

function map1InteractiveTafel(){
  if(currentMap!==1||mapTransitioning||map1TableServing||PLAYER.direction!=='back')return null;
  const s=tableSpriteById('tafel');
  if(!s)return null;

  const el=s.el;
  const left=px(el,'left'), top=px(el,'top'), w=el.offsetWidth, h=el.offsetHeight;
  if(!w||!h)return null;

  const cx=left+w/2;
  const vb=tableOpaqueVerticalBoundsAtX(s,cx);
  const edge=vb?vb.bottom:(top+h);
  const dockY=edge+PLAYER.radius;

  return Math.abs(PLAYER.x-cx)<=MAP1_TAFEL_DOCK_X_TOLERANCE &&
         PLAYER.y>=dockY-MAP1_TAFEL_DOCK_Y_TOLERANCE &&
         PLAYER.y<=dockY+MAP1_TAFEL_DOCK_Y_TOLERANCE
    ? s : null;
}

function map1InteractiveTable(){
  if(currentMap!==1||mapTransitioning||map1TableServing||!playerHasBeer)return null;

  // Lange Tafel hat eine eigene, strikt W-only Zone von unten.
  const tafel=map1InteractiveTafel();
  if(tafel)return tafel;

  // Bestehende Stehtischlogik unverändert.
  for(const id of STANDING_TABLE_IDS){
    const s=tableSpriteById(id); if(!s)continue;
    // Die Blickrichtung definiert eindeutig die erlaubte Tischseite. Keine Diagonal-/Fernaktivierung.
    if(tableTouchesInFacingDirection(s,PLAYER.direction))return s;
  }
  return null;
}
function updateMap1TableInteractionCue(){
  const active=map1InteractiveTable();

  // Stehtische: exakt bisheriges Verhalten.
  for(const id of STANDING_TABLE_IDS){
    const el=document.getElementById(id); if(!el)continue;
    el.style.filter=(active&&active.el===el)
      ?'brightness(1.24) drop-shadow(0 0 6px rgba(255,225,110,.98)) drop-shadow(0 0 12px rgba(255,190,55,.72))'
      :'none';
  }

  // v59: Lange Tafel leuchtet NUR in ihrer zentralen W-Andockzone von unten.
  const tafel=document.getElementById('tafel');
  if(tafel){
    tafel.style.filter=(active&&active.el===tafel)
      ?'brightness(1.24) drop-shadow(0 0 6px rgba(255,225,110,.98)) drop-shadow(0 0 12px rgba(255,190,55,.72))'
      :'none';
  }
}
function ensureTableMug(tableSprite){
  const id=tableSprite.el.id;
  let mug=map1TableMugs.get(id);
  if(!mug){
    mug=document.createElement('img');
    mug.alt=''; mug.draggable=false;
    mug.src='assets/npc/bock-wunsch.png?v=38';
    Object.assign(mug.style,{position:'absolute',width:'28px',height:'28px',objectFit:'contain',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'750',transform:'translate(-50%,-100%)'});
    world.appendChild(mug); map1TableMugs.set(id,mug);
  }
  const el=tableSprite.el,left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  // v59: Krug der LANGEN TAFEL exakt mittig auf der Tafel.
  // z=750 liegt vor Tafel/Stuhl/Props (500), aber hinter dem Charakter (1000).
  mug.style.left=`${left+w/2}px`;
  mug.style.top=el.id==='tafel' ? `${top+h*.32}px` : `${top+h*.23}px`;
  mug.style.zIndex='750';
  mug.style.display='block';
  return mug;
}
function startMap1TableServe(){
  const table=map1InteractiveTable();
  if(!table)return false;
  map1TableServing=true; keys.clear(); PLAYER.moving=false; PLAYER.frameClock=0;
  updateMap1TableInteractionCue();
  const dir=PLAYER.direction;
  const src=MAP1_TABLE_ACTION_SPRITES[dir];
  player.setAttribute('src',src);
  player.style.zIndex=(dir==='front')?String(MAP1_PLAYER_BEHIND_Z):'1000'; // v50: S-Ausschank bleibt hinter dem Tisch; A/D/W unverändert
  const scale=playerVisualScale();
  // A ist als eigenes, physisch gespiegeltes D-Asset enthalten; deshalb hier keine zweite Spiegelung.
  player.style.transform=`translate(-50%,-100%) scale(${scale})`;
  clearTimeout(map1TableServeTimer);
  map1TableServeTimer=setTimeout(()=>{
    ensureTableMug(table);
    map1TableServing=false;
    playerHasBeer=false;
    PLAYER.sequenceIndex=0; PLAYER.frameClock=0; PLAYER.frame=activePlayerSequence(PLAYER.direction)[0];
    showPlayerFrame(true);
    updateStandingTableDepth();
    updateMap1TableInteractionCue();
  },MAP1_TABLE_ACTION_MS);
  return true;
}



/* MAP 1 – BAUM-VERSTECK v62.
   Ausschließlich additiv: Bock-Event bleibt vollständig unangetastet.
   Von UNTEN mit W an den Stamm andocken -> Baum leuchtet. Leertaste -> Spieler
   verschwindet weich, Kronenbild + Blattstoß erscheinen. Erneute Leertaste -> zurück. */
const MAP1_TREE_HIDE_IMAGE='assets/npc/baum-versteck.png?v=01';
let map1TreeHiding=false;
let map1TreeTransitioning=false;
let map1TreeHideImage=null;
let map1TreeLeafLayer=null;
const MAP1_TREE_DOCK_TOLERANCE_X=34;
const MAP1_TREE_DOCK_TOLERANCE_Y=16;

function map1TreeSprite(){
  const el=document.getElementById('baum');
  return el ? collisionSprites.find(s=>s.el===el) : null;
}
function map1TreeDockPoint(){
  const s=map1TreeSprite(); if(!s)return null;
  const el=s.el,left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  if(!w||!h)return null;
  return {x:left+w*.5,y:top+h*TREE_TRUNK_HITBOX.y2+PLAYER.radius+2,left,top,w,h};
}
function map1TreeCanInteract(){
  if(currentMap!==1||mapTransitioning||map1TreeHiding||map1TreeTransitioning||map1TableServing)return false;
  if(PLAYER.direction!=='back')return false;
  const d=map1TreeDockPoint(); if(!d)return false;
  return Math.abs(PLAYER.x-d.x)<=MAP1_TREE_DOCK_TOLERANCE_X &&
         PLAYER.y>=d.y-MAP1_TREE_DOCK_TOLERANCE_Y && PLAYER.y<=d.y+MAP1_TREE_DOCK_TOLERANCE_Y;
}
function updateMap1TreeInteractionCue(){
  const tree=document.getElementById('baum'); if(!tree)return;
  if(currentMap===1 && map1TreeCanInteract()){
    tree.style.filter='brightness(1.18) drop-shadow(0 0 6px rgba(255,225,110,.98)) drop-shadow(0 0 12px rgba(255,190,55,.75))';
  }else tree.style.filter='none';
}
function ensureMap1TreeHideFX(){
  const tree=document.getElementById('baum'); if(!tree)return null;
  if(!map1TreeLeafLayer){
    map1TreeLeafLayer=document.createElement('div');
    map1TreeLeafLayer.id='map1TreeLeafLayer';
    Object.assign(map1TreeLeafLayer.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'visible',zIndex:'503'});
    world.appendChild(map1TreeLeafLayer);
  }
  if(!map1TreeHideImage){
    map1TreeHideImage=document.createElement('img');
    map1TreeHideImage.id='map1TreeHideImage';map1TreeHideImage.src=MAP1_TREE_HIDE_IMAGE;map1TreeHideImage.alt='';map1TreeHideImage.draggable=false;
    Object.assign(map1TreeHideImage.style,{position:'absolute',display:'none',opacity:'0',height:'auto',objectFit:'contain',pointerEvents:'none',userSelect:'none',zIndex:'502',transition:'opacity 360ms ease,transform 420ms cubic-bezier(.2,.85,.25,1)',willChange:'opacity,transform'});
    world.appendChild(map1TreeHideImage);
  }
  syncMap1TreeHideImagePosition();
  return {image:map1TreeHideImage,leaves:map1TreeLeafLayer};
}
function syncMap1TreeHideImagePosition(){
  if(!map1TreeHideImage)return;
  const d=map1TreeDockPoint(); if(!d)return;
  /* Klein, oben und exakt horizontal in der Baumkrone zentriert. */
  const width=Math.max(52,Math.min(92,d.w*.19))*1.15;
  map1TreeHideImage.style.width=`${width}px`;
  map1TreeHideImage.style.left=`${d.left+d.w*.5}px`;
  map1TreeHideImage.style.top=`${d.top+d.h*.155}px`;
  map1TreeHideImage.style.transform='translate(-50%,-18%) scale(.88)';
}
function burstMap1TreeLeaves(){
  const fx=ensureMap1TreeHideFX(),d=map1TreeDockPoint(); if(!fx||!d)return;
  const originX=d.left+d.w*.5, originY=d.top+d.h*.24;
  const glyphs=['●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆','●','◆'];
  glyphs.forEach((glyph,i)=>{
    const leaf=document.createElement('span');leaf.textContent=glyph;
    const size=5+(i%4)*2;
    Object.assign(leaf.style,{position:'absolute',left:`${originX}px`,top:`${originY}px`,font:`900 ${size}px/1 Georgia,serif`,color:i%3===0?'#78a83a':(i%3===1?'#4f8b2c':'#96bd4d'),textShadow:'0 1px 1px rgba(30,60,15,.35)',pointerEvents:'none',opacity:'1',transform:'translate(-50%,-50%) rotate(0deg)',willChange:'transform,opacity'});
    fx.leaves.appendChild(leaf);
    const angle=-Math.PI*.95+(Math.PI*1.9)*(i/(glyphs.length-1));
    const burst=24+(i%7)*7;
    const dx=Math.cos(angle)*burst;
    const up=-22-Math.abs(Math.sin(angle))*42-(i%5)*5;
    const fall=165+(i%6)*17;
    const drift=dx+(i%2?18:-18);
    const rot=(i%2?1:-1)*(180+37*i);
    const anim=leaf.animate([
      {transform:'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(.7)',opacity:0,offset:0},
      {transform:`translate(-50%,-50%) translate(${dx}px,${up}px) rotate(${rot*.28}deg) scale(1)`,opacity:1,offset:.18},
      {transform:`translate(-50%,-50%) translate(${drift*.82}px,${fall*.55}px) rotate(${rot*.72}deg) scale(.92)`,opacity:.95,offset:.72},
      {transform:`translate(-50%,-50%) translate(${drift}px,${fall}px) rotate(${rot}deg) scale(.72)`,opacity:0,offset:1}
    ],{duration:1500+(i%5)*95,easing:'cubic-bezier(.18,.65,.28,1)',fill:'forwards'});
    anim.onfinish=()=>leaf.remove();
  });
}
function startMap1TreeHide(){
  if(!map1TreeCanInteract())return false;
  const fx=ensureMap1TreeHideFX(); if(!fx)return false;
  map1TreeTransitioning=true;keys.clear();PLAYER.moving=false;PLAYER.frameClock=0;
  const tree=document.getElementById('baum'); if(tree)tree.style.filter='none';
  player.style.transition='opacity 360ms ease';player.style.opacity='0';
  burstMap1TreeLeaves();
  fx.image.style.display='block';fx.image.style.opacity='0';syncMap1TreeHideImagePosition();
  setTimeout(()=>{
    if(!map1TreeTransitioning)return;
    fx.image.style.opacity='1';fx.image.style.transform='translate(-50%,-18%) scale(1)';
  },150);
  setTimeout(()=>{
    map1TreeHiding=true;map1TreeTransitioning=false;player.style.visibility='hidden';player.style.opacity='0';
  },380);
  return true;
}
function leaveMap1TreeHide(){
  if(!map1TreeHiding||map1TreeTransitioning)return false;
  const fx=ensureMap1TreeHideFX(),d=map1TreeDockPoint(); if(!fx||!d)return false;
  map1TreeTransitioning=true;map1TreeHiding=false;keys.clear();PLAYER.moving=false;PLAYER.frameClock=0;
  burstMap1TreeLeaves();
  fx.image.style.opacity='0';fx.image.style.transform='translate(-50%,-18%) scale(.88)';
  PLAYER.x=d.x;PLAYER.y=d.y;setPlayerDirection('front');PLAYER.sequenceIndex=0;PLAYER.frameClock=0;PLAYER.frame=activePlayerSequence('front')[0];showPlayerFrame(true);
  player.style.left=`${PLAYER.x}px`;player.style.top=`${PLAYER.y}px`;player.style.visibility='visible';player.style.opacity='0';player.style.transition='opacity 360ms ease';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{player.style.opacity='1';}));
  setTimeout(()=>{fx.image.style.display='none';map1TreeTransitioning=false;player.style.transition='';playerLastTime=performance.now();updateMap1TreeInteractionCue();},390);
  return true;
}
function toggleMap1TreeHide(){
  if(map1TreeTransitioning)return true;
  if(map1TreeHiding)return leaveMap1TreeHide();
  return startMap1TreeHide();
}

function playerCanStand(x,y){
  const margin=10;
  if(x<margin||y<margin||x>WORLD_W-margin||y>WORLD_H-margin)return false;
  if(currentMap===2)return map2CanStand(x,y);
  return !window.BurgCollision?.circleBlocked(x,y,PLAYER.radius);
}
function map1CanWEnterTableSupport(x,y){
  if(currentMap!==1 || PLAYER.direction!=='back')return false;

  // Niemals durch andere Props/Wände tunneln: die Sonderfreigabe gilt ausschließlich
  // für die drei Stehtische.
  const blockedByNonTable=(px0,py0)=>{
    for(const sp of collisionSprites){
      if(STANDING_TABLE_IDS.has(sp.el.id))continue;
      if(pointHitsSprite(sp,px0,py0))return true;
    }
    return false;
  };
  if(blockedByNonTable(x,y))return false;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    if(blockedByNonTable(x+Math.cos(a)*PLAYER.radius,y+Math.sin(a)*PLAYER.radius))return false;
  }

  // W darf exakt 0,5 cm (= 8 Weltpixel) in die UNTERE Kante der Stützen-Hitbox hinein.
  for(const id of STANDING_TABLE_IDS){
    const sp=tableSpriteById(id); if(!sp)continue;
    const el=sp.el,left=px(el,'left'),right=left+el.offsetWidth;
    if(x<left-PLAYER.radius || x>right+PLAYER.radius)continue;
    const vb=tableOpaqueVerticalBoundsAtX(sp,x); if(!vb)continue;
    const minCenterY=vb.bottom+PLAYER.radius-8;
    const maxCenterY=vb.bottom+PLAYER.radius+2;
    if(y>=minCenterY && y<=maxCenterY)return true;
  }
  return false;
}

/* v56: Erlaubtes Andocken darf den Spieler niemals in der Stehtisch-Stütze festhalten.
   Ist der Spielerkreis bereits mit einer Stehtisch-Stütze überlappt, darf er sich von
   genau diesem Tisch wieder wegbewegen. Andere Props/Wände bleiben voll kollidierend. */
function circleHitsSpecificSprite(s,x,y,r=PLAYER.radius){
  if(pointHitsSprite(s,x,y))return true;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    if(pointHitsSprite(s,x+Math.cos(a)*r,y+Math.sin(a)*r))return true;
  }
  return false;
}
function circleBlockedByNonTable(x,y,r=PLAYER.radius){
  for(const s of collisionSprites){
    if(STANDING_TABLE_IDS.has(s.el.id))continue;
    if(circleHitsSpecificSprite(s,x,y,r))return true;
  }
  return false;
}
function map1CanEscapeStandingTable(fromX,fromY,toX,toY){
  if(currentMap!==1)return false;

  let touchedTable=null;
  for(const id of STANDING_TABLE_IDS){
    const s=tableSpriteById(id);
    if(s && circleHitsSpecificSprite(s,fromX,fromY)){
      touchedTable=s;
      break;
    }
  }
  if(!touchedTable)return false;
  if(circleBlockedByNonTable(toX,toY))return false;

  const el=touchedTable.el;
  const cx=px(el,'left')+el.offsetWidth/2;
  const cy=px(el,'top')+el.offsetHeight*.82;
  const moveX=toX-fromX, moveY=toY-fromY;
  const awayX=fromX-cx, awayY=fromY-cy;

  // Nur VOM Tisch weg freigeben; niemals weiter hinein oder hindurch.
  return moveX*awayX + moveY*awayY > 0;
}

function movePlayerAxis(dx,dy){
  const nx=PLAYER.x+dx,ny=PLAYER.y+dy;

  if(dx){
    const normalFree=playerCanStand(nx,PLAYER.y);
    const tableEscape=map1CanEscapeStandingTable(PLAYER.x,PLAYER.y,nx,PLAYER.y);
    if(normalFree||tableEscape)PLAYER.x=nx;
  }

  if(dy){
    const normalFree=playerCanStand(PLAYER.x,ny);
    const wTableDock=dy<0 && map1CanWEnterTableSupport(PLAYER.x,ny);
    const tableEscape=map1CanEscapeStandingTable(PLAYER.x,PLAYER.y,PLAYER.x,ny);
    if((normalFree||wTableDock||tableEscape) &&
       !map2BarBlocksMove(PLAYER.x,PLAYER.y,PLAYER.x,ny))PLAYER.y=ny;
  }
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

const MAP_IMAGE_SOURCES=['assets/maps/terrasse.jpg','assets/maps/wirtschaft-innen.jpg?v=18'];
const MAP_IMAGE_CACHE=new Map();

function preloadTransitionMaps(){
  for(const src of MAP_IMAGE_SOURCES){
    if(MAP_IMAGE_CACHE.has(src))continue;
    const img=new Image();
    img.decoding='async';
    img.src=src;
    const ready=img.decode ? img.decode().catch(()=>{}) :
      new Promise(r=>{if(img.complete)r();else{img.onload=r;img.onerror=r;}});
    img._ready=ready;
    MAP_IMAGE_CACHE.set(src,img);
  }
}
preloadTransitionMaps();

async function ensureTransitionMapReady(src){
  preloadTransitionMaps();
  const img=MAP_IMAGE_CACHE.get(src);
  if(img?._ready)await img._ready;
}

function swapMapInstant(src){
  map.src=src;
}

async function enterWirtschaft(){
  if(mapTransitioning||currentMap!==1)return;

  // v59: Triggerkontakt startet Sound UND Iris im selben Tick.
  // Der Sound läuft während des kompletten Übergangs unabhängig weiter.
  mapTransitioning=true;
  playDoorPassSound();
  keys.clear();
  PLAYER.moving=false;
  PLAYER.frameClock=0;

  const mapReady=ensureTransitionMapReady('assets/maps/wirtschaft-innen.jpg?v=18');
  await animateIris(150,0,650);
  setIrisRadius(0); // während des Map-Tauschs garantiert geschlossen
  await mapReady;

  currentMap=2;
  map2Room='guestroom';
  map2InMiddleWall=false;
  map2MiddleDoorPassArmed=true;
  document.body.classList.add('map2');
  updateMap2BarVisibility();
  swapMapInstant('assets/maps/wirtschaft-innen.jpg?v=18');

  PLAYER.x=MAP2_SPAWN.x;
  PLAYER.y=MAP2_SPAWN.y;
  PLAYER.direction='back';
  PLAYER.sequenceIndex=0;
  PLAYER.frameClock=0;
  PLAYER.frame=activePlayerSequence('back')[0];
  player.style.left=`${PLAYER.x}px`;
  player.style.top=`${PLAYER.y}px`;
  showPlayerFrame(true);

  // Einen echten Paint der neuen Karte unter der geschlossenen Iris erzwingen.
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  await animateIris(0,150,700);
  finishIrisOpen();

  mapTransitioning=false;
  playerLastTime=performance.now();
}

async function leaveWirtschaft(){
  if(mapTransitioning||currentMap!==2)return;

  // v59: Auch beim Rückweg Iris SOFORT bei Zonenberührung; Türsound läuft weiter.
  mapTransitioning=true;
  playDoorPassSound();
  keys.clear(); PLAYER.moving=false; PLAYER.frameClock=0;

  const mapReady=ensureTransitionMapReady('assets/maps/terrasse.jpg');
  await animateIris(150,0,650);
  setIrisRadius(0);
  await mapReady;
  currentMap=1; map2Room='guestroom'; map2InMiddleWall=false; map2MiddleDoorPassArmed=true;
  document.body.classList.remove('map2');
  updateMap2BarVisibility();
  swapMapInstant('assets/maps/terrasse.jpg');
  PLAYER.x=778; PLAYER.y=356; PLAYER.direction='front';
  PLAYER.sequenceIndex=0; PLAYER.frameClock=0; PLAYER.frame=activePlayerSequence('front')[0];
  player.style.left=`${PLAYER.x}px`; player.style.top=`${PLAYER.y}px`;
  showPlayerFrame(true);
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
  if(mapTransitioning || map2BarServing || map1TableServing || map1TreeHiding || map1TreeTransitioning){ playerLastTime=now; updateMap2BarInteractionCue(); updateMap1TableInteractionCue(); return; }

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
      const seq=activePlayerSequence(PLAYER.direction);
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
  updateMap1TableInteractionCue();
  // Bock-Charaktertiefe, OHNE die bereits berechnete MAP-1-Prop-Ebene zu überschreiben.
  if(currentMap===1 && map1BockFinal && map1BockFinal.style.display!=='none'){
    const playerIsBehindProp = Number(player.style.zIndex)===MAP1_PLAYER_BEHIND_Z;
    if(playerIsBehindProp){
      map1BockFinal.style.zIndex='498';
    }else if(PLAYER.y>MAP1_BOCK_FOOT_Y){
      map1BockFinal.style.zIndex='750';
      player.style.zIndex=String(MAP1_PLAYER_FRONT_Z);
    }else{
      map1BockFinal.style.zIndex='750';
      player.style.zIndex='749';
    }
  }
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d'].includes(k)){keys.add(k);e.preventDefault();}
  if(k==='1' && !e.repeat){e.preventDefault();startMap1Runner();}
  if(k==='2' && !e.repeat){e.preventDefault();startMap1BockEvent();}
  if(k==='3' && !e.repeat){e.preventDefault();startMap1Event3();}
});
window.addEventListener('keydown',e=>{
  if((e.key==='^'||e.code==='Backquote')&&!e.repeat){e.preventDefault();pickupMap1BockMug();return;}
  if(e.code==='Space'){
    e.preventDefault();
    if(!e.repeat){ if(!toggleMap1TreeHide() && !startMap1TableServe() && !startMap1BockBeerServe()) startMap2BarServe(); }
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
  /* v43: Baum kollidiert NUR am Stamm. Die Effekt-/Tiefenzone bleibt davon unabhängig. */
  if(currentMap===1 && s.el.id==='baum'){
    const p=spriteLocalPoint(s,x,y);
    if(!p || p.alpha<24)return false;
    const nx=p.sx/Math.max(1,s.sourceW-1), ny=p.sy/Math.max(1,s.sourceH-1);
    // EXAKT dieselbe Grenze wie der Ebenenwechsel: oberhalb/inkl. Hinter-Baum-Zone keine Stammkollision.
    const extraSource=TREE_PASSAGE_EXTRA_WORLD/p.dh*s.sourceH;
    const depthEndSource=Math.min(s.sourceH-1,(s.sourceH-1)*(2/3)+extraSource);
    const collisionStart=depthEndSource/Math.max(1,s.sourceH-1);
    return nx>=TREE_TRUNK_HITBOX.x1 && nx<=TREE_TRUNK_HITBOX.x2 &&
           ny>collisionStart && ny<=TREE_TRUNK_HITBOX.y2;
  }
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
  'assets/player/side-3.png?v=12','assets/player/side-4.png?v=12',
  'assets/player/tisch-w.png?v=47','assets/player/tisch-s.png?v=47',
  'assets/player/tisch-d.png?v=46','assets/player/tisch-a.png?v=46',
  'assets/player/nobier-front-1.png?v=69','assets/player/nobier-front-2.png?v=69',
  'assets/player/nobier-front-3.png?v=69','assets/player/nobier-front-4.png?v=69',
  'assets/player/nobier-back-1.png?v=69','assets/player/nobier-back-2.png?v=69',
  'assets/player/nobier-back-3.png?v=69','assets/player/nobier-back-4.png?v=69',
  'assets/player/nobier-side-1.png?v=69','assets/player/nobier-side-2.png?v=69',
  'assets/player/nobier-side-3.png?v=69'
];
const EVENT_IMAGE_CACHE=new Map();
async function preloadMap1BearFrames(){
  /* v74 ANTI-FREEZE: Event-/NPC-Bilder bleiben als decodierte Image-Objekte dauerhaft im RAM.
     Dadurch müssen sie nach Inaktivität oder mehreren Eventwechseln nicht neu decodiert werden. */
  const paths=[
    'assets/npc/frau-run-1.png?v=02','assets/npc/frau-run-2.png?v=02',
    'assets/npc/baer-run-1.png?v=22','assets/npc/baer-run-2.png?v=22','assets/npc/baer-run-3.png?v=22',
    'assets/npc/bock-reiter-1.png?v=27','assets/npc/bock-reiter-2.png?v=27','assets/npc/bock-reiter-3.png?v=27',
    'assets/npc/bock-stop.png?v=30','assets/npc/bock-dismount.png?v=30','assets/npc/bock-dismount.png?v=29',
    'assets/npc/bock-final.png?v=30','assets/npc/bock-wunsch.png?v=38','assets/npc/bock-bier.png?v=38',
    'assets/npc/bock-trinkt.png?v=38','assets/npc/bock-krug-leer.png?v=38',
    'assets/npc/event3-bock-attack-ready.png?v=71','assets/npc/event3-bock-slash.png?v=71',
    'assets/npc/event3-bauer-walk.png?v=71','assets/npc/event3-bauer-kneel.png?v=71','assets/npc/event3-bauer-dead.png?v=71',
    'assets/npc/baum-versteck.png?v=01'
  ];
  await Promise.all(paths.map(src=>new Promise(resolve=>{
    const img=new Image();
    img.decoding='async';
    EVENT_IMAGE_CACHE.set(src,img);
    let done=false;
    const finish=async()=>{if(done)return;done=true;try{if(img.decode)await img.decode();}catch(_){}resolve();};
    img.onload=finish;
    img.onerror=()=>{console.error('EVENT-PRELOAD FEHLER:',src);finish();};
    img.src=src;
    if(img.complete&&img.naturalWidth)finish();
  })));
}

async function preloadPlayerFrames(){
  /* v70 ANTI-FREEZE:
     Alle Laufbilder werden VOR game-ready angefordert, decodiert und als lebende
     Image-Objekte im RAM gehalten. No-Beer benutzt damit beim Laufen niemals erst
     im Bewegungs-Tick einen neuen Netzwerk-/Decode-Pfad. */
  await Promise.all(PLAYER_FRAME_PATHS.map(src=>new Promise(resolve=>{
    const img=new Image();
    img.decoding='async';
    img.fetchPriority='high';
    PLAYER_IMAGE_CACHE.set(src,img);
    const finish=async()=>{
      try{ if(img.decode) await img.decode(); }catch(_){}
      resolve();
    };
    img.onload=finish;
    img.onerror=resolve;
    img.src=src;
    if(img.complete && img.naturalWidth)finish();
  })));
}

function resumeAnimationSystem(){
  /* v74: Browser dürfen requestAnimationFrame/Decoding bei inaktiven Tabs drosseln.
     Beim Zurückkehren Zeitbasis und aktuellen Player-Frame sauber neu synchronisieren,
     ohne Eventinhalte, Timings, Sounds oder Positionen zu verändern. */
  playerLastTime=performance.now();
  if(player)showPlayerFrame(true);
  cancelAnimationFrame(rafId);
  rafId=requestAnimationFrame(draw);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeAnimationSystem();});
window.addEventListener('focus',resumeAnimationSystem);
window.addEventListener('pageshow',resumeAnimationSystem);

async function start(){
  calculateBaseScale();
  setIrisRadius(150);
  finishIrisOpen();
  currentX=currentY=targetX=targetY=0;

  await preloadPlayerFrames();
  await preloadMap1BearFrames();
  applyMap1LayoutFixes();
  ensureMap1Runner();
  ensureMap1Bear();
  ensureMap1Scribe();
  syncMap1Scribe(true);
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