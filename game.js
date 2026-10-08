'use strict';

/* v105: Lokale Scheduler überschreiben keine nativen Browserfunktionen.
   Eine pausierbare Spielzeit für Laufwege, Timer und alle RAF-Abläufe. */
const gameNativeTimeout=window.setTimeout.bind(window),gameNativeClear=window.clearTimeout.bind(window);
const gameNativeRAF=window.requestAnimationFrame.bind(window),gameNativeCancel=window.cancelAnimationFrame.bind(window);
let gamePaused=false,gamePauseAt=0,gamePausedTotal=0,gameResumeTask=null,gameScheduleId=0;
const gameTimers=new Map(),gameFrames=new Map(),gameAudio=new Set(),gamePausedAudio=new Set(),gamePausedAnimations=new Set();
function gameNow(){return (gamePaused?gamePauseAt:performance.now())-gamePausedTotal;}
const Audio=class extends window.Audio{constructor(...args){super(...args);gameAudio.add(this);}};
function gameArmTimer(id,item){
  item.native=gameNativeTimeout(()=>{if(gamePaused)return;gameTimers.delete(id);item.fn(...item.args);},Math.max(0,item.due-gameNow()));
}
function gameSetTimeout(fn,delay=0,...args){const id=++gameScheduleId,item={fn,args,due:gameNow()+Math.max(0,Number(delay)||0),native:null};gameTimers.set(id,item);if(!gamePaused)gameArmTimer(id,item);return id;}
function gameClearTimeout(id){const item=gameTimers.get(id);if(item){gameNativeClear(item.native);gameTimers.delete(id);}}
function gameArmFrame(id,item){item.native=gameNativeRAF(()=>{if(gamePaused)return;gameFrames.delete(id);item.fn(gameNow());});}
function gameRequestAnimationFrame(fn){const id=++gameScheduleId,item={fn,native:null};gameFrames.set(id,item);if(!gamePaused)gameArmFrame(id,item);return id;}
function gameCancelAnimationFrame(id){const item=gameFrames.get(id);if(item){gameNativeCancel(item.native);gameFrames.delete(id);}}
function pauseAnimationSystem(){
  if(gamePaused)return;
  gamePauseAt=performance.now();gamePaused=true;
  keys.clear();
  for(const item of gameTimers.values())gameNativeClear(item.native);
  for(const item of gameFrames.values())gameNativeCancel(item.native);
  gameAudio.add(bgMusic);
  for(const a of gameAudio)if(a&&!a.paused&&!a.ended){gamePausedAudio.add(a);a.pause();}
  for(const a of document.getAnimations())if(a.playState==='running'){gamePausedAnimations.add(a);a.pause();}
}


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

/* v77 – laute Interaktionssounds: Krug abstellen, Baum-Versteck, Bierzapfen. */
const map1TablePutDownSound=new Audio('assets/audio/puller_impact_converted_by_soundandgo.com_.mp3');
const map1TreeHideSound=new Audio('assets/audio/harvest_01_converted_by_soundandgo.com_.mp3');
const map2BeerTapSound=new Audio('assets/audio/cauldron_01_converted_by_soundandgo.com_.mp3');
[map1TablePutDownSound,map1TreeHideSound,map2BeerTapSound].forEach(a=>{a.preload='auto';a.volume=1;});
function playLoudInteractionSound(a){a.pause();a.currentTime=0;a.play().catch(()=>{});}

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
  normal:'assets/npc/schreiber-1.png?v=76',
  bock:'assets/npc/schreiber-2.png?v=76',
  warning:'assets/npc/schreiber-3.png?v=76',
  low:'assets/npc/schreiber-4.png?v=77',
  critical:'assets/npc/schreiber-6.png?v=79',
  gameover:'assets/npc/schreiber-gameover.png?v=81',
  happy:'assets/npc/schreiber-5.png?v=77'
};
let map1Popularity=69;
let map1GuestCount=0;
let map1ScribeWrap=null,map1ScribeImage=null,map1ScribePopularity=null,map1ScribeGuests=null;
let map1ScribeMode='normal';
let map1GameOverStarted=false;
let map1GameOverOverlay=null,map1GameOverDust=null,map1GameOverReplay=null;

/* v84 – Schreiber: vollständige Beliebtheits-Sprachlogik. Bereichssounds nur beim Eintritt. */
const map1GameOverSound=new Audio('assets/audio/General_Warning2_converted_by_soundandgo.com_ (1).mp3');
const map1Popularity40Sound=new Audio('assets/audio/Pop_Popularity5_converted_by_soundandgo.com_(1).mp3');
const map1PopularityUnder50Sound=new Audio('assets/audio/Pop_Emigrate_converted_by_soundandgo.com_.mp3');
const map1Popularity1to19Sound=new Audio('assets/audio/Pop_Popularity7_converted_by_soundandgo.com_ (1).mp3');
const map1Popularity20to39Sound=new Audio('assets/audio/Pop_Popularity8_converted_by_soundandgo.com_.mp3');
const map1PopularityImmigrateSound=new Audio('assets/audio/Pop_Immigrate_converted_by_soundandgo.com_(1).mp3');
const map1Popularity50to69Sound=new Audio('assets/audio/Pop_Popularity4_converted_by_soundandgo.com_.mp3');
const map1Popularity70to89Sound=new Audio('assets/audio/Pop_Popularity2_converted_by_soundandgo.com_ (1).mp3');
const map1Popularity90to100Sound=new Audio('assets/audio/Pop_Popularity1_converted_by_soundandgo.com_ (2).mp3');
const map1Popularity90Song=new Audio('assets/audio/Pints a Flowin.mp3');
map1Popularity90Song.preload='auto';map1Popularity90Song.volume=.72;map1Popularity90Song.loop=true;
[map1GameOverSound,map1Popularity40Sound,map1PopularityUnder50Sound,map1Popularity1to19Sound,map1Popularity20to39Sound,map1PopularityImmigrateSound,map1Popularity50to69Sound,map1Popularity70to89Sound,map1Popularity90to100Sound].forEach(a=>{a.preload='auto';a.volume=1;});
let map1PopularitySoundQueue=[];
let map1PopularitySoundPlaying=false;
function playNextMap1PopularitySound(){
  if(map1PopularitySoundPlaying||!map1PopularitySoundQueue.length)return;
  const item=map1PopularitySoundQueue.shift();
  const a=item.audio||item, delay=item.delay||0;
  map1PopularitySoundPlaying=true;a.pause();a.currentTime=0;
  const done=()=>{a.onended=null;gameSetTimeout(()=>{map1PopularitySoundPlaying=false;playNextMap1PopularitySound();},delay);};
  a.onended=done;
  const pr=a.play();if(pr&&typeof pr.catch==='function')pr.catch(()=>done());
}
function queueMap1PopularitySound(a,delay=0){map1PopularitySoundQueue.push({audio:a,delay});playNextMap1PopularitySound();}
function scheduleMap1PopularitySounds(oldValue,newValue){
  const priority=[];
  const ranges=[];
  // Ein-/Auswanderung hat IMMER Vorrang. Danach vier Sekunden Stille vor einer Bereichsmeldung.
  if(oldValue>=50&&newValue<50)priority.push(map1PopularityUnder50Sound);
  if(oldValue<50&&newValue>=50)priority.push(map1PopularityImmigrateSound);
  if(newValue>=40&&newValue<=49 && !(oldValue>=40&&oldValue<=49))ranges.push(map1Popularity40Sound);
  if(newValue>=20&&newValue<=39 && !(oldValue>=20&&oldValue<=39))ranges.push(map1Popularity20to39Sound);
  if(newValue>=1&&newValue<=19 && !(oldValue>=1&&oldValue<=19))ranges.push(map1Popularity1to19Sound);
  if(newValue>=50&&newValue<=69 && !(oldValue>=50&&oldValue<=69))ranges.push(map1Popularity50to69Sound);
  if(newValue>=70&&newValue<=89 && !(oldValue>=70&&oldValue<=89))ranges.push(map1Popularity70to89Sound);
  if(newValue>=90&&newValue<=100 && !(oldValue>=90&&oldValue<=100))ranges.push(map1Popularity90to100Sound);
  if(priority.length||ranges.length)gameSetTimeout(()=>{
    for(let i=0;i<priority.length;i++)queueMap1PopularitySound(priority[i], i===priority.length-1&&ranges.length?4000:0);
    for(const a of ranges)queueMap1PopularitySound(a);
  },3000);
}

let map1ScribeConfetti=null;
function syncMap1ScribeConfetti(){
  ensureMap1Scribe();
  const active=map1Popularity>=90&&map1Popularity<=100&&!map1GameOverStarted;
  if(!map1ScribeConfetti){
    const st=document.createElement('style');st.id='map1ScribeConfettiStyle';st.textContent=`
      @keyframes map1ConfettiFall{0%{transform:translate3d(0,-35px,0) rotate(0deg);opacity:0}8%{opacity:1}100%{transform:translate3d(var(--drift),230px,0) rotate(760deg);opacity:.95}}`;
    document.head.appendChild(st);
    map1ScribeConfetti=document.createElement('div');map1ScribeConfetti.id='map1ScribeConfetti';
    Object.assign(map1ScribeConfetti.style,{position:'absolute',left:'0',bottom:'0',width:'clamp(105px,11.7vw,176px)',height:'clamp(190px,23vw,340px)',overflow:'hidden',pointerEvents:'none',zIndex:'70010',display:'none'});
    const colors=['#f4c542','#d33','#2aa83a','#4b78d1','#b54bd1','#fff1a8'];
    for(let i=0;i<34;i++){const c=document.createElement('i');Object.assign(c.style,{position:'absolute',left:`${(i*37)%100}%`,top:`${-8-(i%7)*9}px`,width:`${5+(i%3)*2}px`,height:`${8+(i%4)*2}px`,background:colors[i%colors.length],opacity:'.95',borderRadius:'1px',animation:`map1ConfettiFall ${1.7+(i%6)*.22}s linear ${-(i%9)*.31}s infinite`});c.style.setProperty('--drift',`${-35+(i*19)%70}px`);map1ScribeConfetti.appendChild(c);}
    game.appendChild(map1ScribeConfetti);
  }
  map1ScribeConfetti.style.display=active?'block':'none';
}
function map1EventMusicIsActive(){
  return !!(map1RunnerActive||map1BearActive||map1BockActive||map1Event3Active||map1Event4Active||map1Event5Active||
    !map1BearSong.paused||!map1BockSong.paused||!map1Event4Music.paused||!map1Event5Music.paused);
}
function pauseMap1Popularity90Song(reset=false){
  if(!map1Popularity90Song.paused)map1Popularity90Song.pause();
  if(reset)map1Popularity90Song.currentTime=0;
}
function resumeMap1AmbientMusic(){
  if(map1GameOverStarted||currentMap!==1||mapTransitioning)return;
  if(map1EventMusicIsActive())return;
  if(map1Popularity>=90&&map1Popularity<=100){
    if(bgMusic)bgMusic.pause();
    if(map1Popularity90Song.paused)map1Popularity90Song.play().catch(()=>{});
  }else{
    pauseMap1Popularity90Song(true);
    if(bgMusic){
      bgMusic.volume=0;
      bgMusic.play().catch(()=>{});
      bockFadeAudio(bgMusic,MAP1_BG_VOLUME,900);
    }
  }
}
function syncMap1Popularity90Song(){
  const active=map1Popularity>=90&&map1Popularity<=100&&!map1GameOverStarted&&currentMap===1&&!mapTransitioning&&!map1EventMusicIsActive();
  if(active){
    if(bgMusic)bgMusic.pause();
    if(map1Popularity90Song.paused)map1Popularity90Song.play().catch(()=>{});
  }else{
    pauseMap1Popularity90Song(map1Popularity<90);
    if(map1Popularity<90&&!map1EventMusicIsActive()&&currentMap===1&&!mapTransitioning&&bgMusic&&bgMusic.paused){
      bgMusic.volume=MAP1_BG_VOLUME;bgMusic.play().catch(()=>{});
    }
  }
}

function ensureMap1Scribe(){
  if(map1ScribeWrap)return map1ScribeWrap;
  map1ScribeWrap=document.createElement('div');
  map1ScribeWrap.id='map1Scribe';
  Object.assign(map1ScribeWrap.style,{
    position:'absolute',left:'0',bottom:'0',width:'clamp(105px, 11.97vw, 180.6px)',
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
  const numberBase={position:'absolute',bottom:'33.5%',fontFamily:'Georgia,serif',fontWeight:'900',fontSize:'clamp(10.5px,1.26vw,18.9px)',lineHeight:'1',textAlign:'center',minWidth:'1.8em',textShadow:'0 1px 1px rgba(255,245,220,.95), 0 0 2px rgba(255,245,220,.95)',pointerEvents:'none',zIndex:'2',transform:'translateX(-50%) rotate(-2deg)'};
  map1ScribePopularity=document.createElement('div');
  Object.assign(map1ScribePopularity.style,numberBase,{left:'25.0%',color:'#2aa83a'});
  map1ScribeGuests=document.createElement('div');
  Object.assign(map1ScribeGuests.style,numberBase,{left:'61.0%',color:'#c71919',transform:'translateX(-50%) rotate(2deg)'});
  map1ScribeWrap.append(map1ScribeImage,map1ScribePopularity,map1ScribeGuests);
  game.appendChild(map1ScribeWrap);
  renderMap1ScribeNumbers();
  return map1ScribeWrap;
}
function renderMap1ScribeNumbers(){
  if(!map1ScribePopularity||!map1ScribeGuests)return;
  map1ScribePopularity.textContent=String(map1Popularity);
  map1ScribePopularity.style.color=map1Popularity<50?'#c71919':'#2aa83a';
  map1ScribeGuests.textContent=String(map1GuestCount);
  map1ScribeGuests.style.color=map1GuestCount===0?'#c71919':'#111111';
}
function wantedMap1ScribeMode(){
  // Laufende Bockevents haben IMMER Vorrang: bei jeder neuen Taste 2/3 wird Bild 2 gezeigt.
  // Erst nach Eventende greift wieder der dauerhafte Beliebtheitszustand (40–49 => Bild 3).
  if(map1BockActive||(map1Event3Active&&map1Event3ScribeHit))return 'bock';
  if(map1Popularity>=80)return 'happy';
  if(map1Popularity>=40&&map1Popularity<=49)return 'warning';
  if(map1Popularity>=20&&map1Popularity<=39)return 'low';
  if(map1Popularity>=1&&map1Popularity<=19)return 'critical';
  return 'normal';
}
function syncMap1Scribe(force=false){
  ensureMap1Scribe();
  if(map1GameOverStarted)return;
  // v86 – Der Schreiber ist ein globales HUD und bleibt auf Map 1 UND Map 2 bestehen.
  // Beim Kartenwechsel wird er nicht mapabhängig entfernt; die Iris liegt darüber und
  // verdeckt ihn während des geschlossenen Übergangs automatisch.
  map1ScribeWrap.style.visibility='visible';
  const mode=wantedMap1ScribeMode();
  if(!force&&mode===map1ScribeMode)return;
  map1ScribeMode=mode;
  const src=MAP1_SCRIBE_IMAGES[mode];
  if((map1ScribeImage.getAttribute('src')||'')===src)return;
  map1ScribeImage.style.opacity='0';
  gameSetTimeout(()=>{
    if(!map1ScribeImage)return;
    map1ScribeImage.src=src;
    map1ScribeImage.style.transform='scaleX(-1)';
    const reveal=()=>{if(map1ScribeImage)map1ScribeImage.style.opacity='1';};
    if(map1ScribeImage.complete)gameRequestAnimationFrame(reveal); else map1ScribeImage.onload=reveal;
  },150);
}
function setMap1GuestCount(n){map1GuestCount=Math.max(0,Math.round(n));renderMap1ScribeNumbers();}
/* v96 – Besucherzahl ist immer der echte additive Kartenstand: normale Gäste + Event-3/5-Bauer. */
function syncMap1RealGuestCount(){
  const regular=(typeof map1GuestActive!=='undefined'&&map1GuestActive?1:0)+(typeof map1WomanActive!=='undefined'&&map1WomanActive?1:0);
  const event3=(typeof map1Event3Active!=='undefined'&&map1Event3Active&&map1Event3FarmerStarted&&map1Event3AttackStage!=='hit')?1:0;
  const event5=(typeof map1Event5Active!=='undefined'&&map1Event5Active&&map1Event5FarmerStarted&&map1Event5FireStage==='none')?1:0;
  setMap1GuestCount(regular+event3+event5+(typeof map1KingActive!=='undefined'&&map1KingActive?1:0));
}
function ensureMap1GameOverFX(){
  if(map1GameOverOverlay)return;
  const st=document.createElement('style');st.id='map1GameOverStyle';st.textContent=`
    @keyframes scribeDustPuff{0%{opacity:0;transform:translate(-50%,-50%) scale(.12)}18%{opacity:.98}70%{opacity:.82}100%{opacity:0;transform:translate(-50%,-50%) scale(3.5)}}
    @keyframes replayPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.08)}}`;
  document.head.appendChild(st);
  map1GameOverOverlay=document.createElement('div');Object.assign(map1GameOverOverlay.style,{position:'fixed',inset:'0',background:'#000',opacity:'0',pointerEvents:'none',zIndex:'89990',transition:'opacity 6500ms linear'});game.appendChild(map1GameOverOverlay);
  map1GameOverDust=document.createElement('div');Object.assign(map1GameOverDust.style,{position:'absolute',left:'6%',bottom:'13%',width:'150px',height:'150px',borderRadius:'50%',pointerEvents:'none',zIndex:'90010',display:'none',background:'radial-gradient(circle,rgba(214,181,128,.96) 0%,rgba(190,150,98,.88) 28%,rgba(161,120,76,.62) 50%,rgba(139,100,61,.28) 67%,rgba(139,100,61,0) 78%)',filter:'blur(7px)'});game.appendChild(map1GameOverDust);
  map1GameOverReplay=document.createElement('button');map1GameOverReplay.type='button';map1GameOverReplay.textContent='↻';map1GameOverReplay.setAttribute('aria-label','Spiel neu starten');Object.assign(map1GameOverReplay.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'104px',height:'104px',border:'3px solid rgba(220,190,140,.92)',borderRadius:'50%',background:'rgba(20,15,10,.7)',color:'#e3c79a',font:'700 76px/88px Georgia,serif',textAlign:'center',cursor:'pointer',zIndex:'90020',display:'none',opacity:'0',transition:'opacity 900ms ease',animation:'replayPulse 2.2s ease-in-out infinite'});map1GameOverReplay.onclick=()=>location.reload();game.appendChild(map1GameOverReplay);
}
function startMap1GameOver(){
  if(map1GameOverStarted)return;map1GameOverStarted=true;ensureMap1Scribe();ensureMap1GameOverFX();keys.clear();PLAYER.moving=false;
  map1GameOverSound.pause();map1GameOverSound.currentTime=0;map1GameOverSound.play().catch(()=>{});
  map1ScribePopularity.textContent='';map1ScribeGuests.textContent='';map1ScribeMode='gameover';map1ScribeImage.style.opacity='0';
  gameSetTimeout(()=>{map1ScribeImage.src=MAP1_SCRIBE_IMAGES.gameover;map1ScribeImage.style.transform='none';map1ScribeImage.style.opacity='1';},120);
  map1GameOverDust.style.display='block';map1GameOverDust.style.animation='none';void map1GameOverDust.offsetWidth;map1GameOverDust.style.animation='scribeDustPuff 5200ms ease-out forwards';
  gameSetTimeout(()=>{map1ScribeWrap.style.transition='opacity 900ms ease,filter 900ms ease';map1ScribeWrap.style.opacity='0';map1ScribeWrap.style.filter='blur(5px)';},4000);
  gameSetTimeout(()=>{map1ScribeWrap.style.visibility='hidden';map1GameOverOverlay.style.opacity='1';},4900);
  gameSetTimeout(()=>{map1GameOverReplay.style.display='block';gameRequestAnimationFrame(()=>map1GameOverReplay.style.opacity='1');map1GameOverReplay.style.pointerEvents='auto';},11400);
}
let map1PopularityDeltaQueue=[];
let map1PopularityDeltaBusy=false;
function runNextMap1PopularityDelta(){
  if(map1PopularityDeltaBusy||!map1PopularityDeltaQueue.length)return;
  map1PopularityDeltaBusy=true;
  const delta=map1PopularityDeltaQueue.shift();
  ensureMap1Scribe();
  const fx=document.createElement('div');
  fx.textContent=`${delta>0?'+':''}${delta}`;
  const positive=delta>0;
  Object.assign(fx.style,{
    position:'absolute',
    left:'50%',
    top:'4%',
    transform:'translate(-50%,0)',
    font:'700 22px/1 sans-serif',
    color:positive?'#2aa83a':'#c71919',
    textShadow:'0 2px 3px rgba(0,0,0,.8)',
    pointerEvents:'none',zIndex:'30000',opacity:'1',whiteSpace:'nowrap'
  });
  map1ScribeWrap.appendChild(fx);
  fx.animate([
    {transform:'translate(-50%,8px)',opacity:1},
    {transform:'translate(-50%,-72px)',opacity:1,offset:.62},
    {transform:'translate(-50%,-128px)',opacity:0}
  ],{duration:2800,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>fx.remove(),2850);
  // Nächste Beliebtheitsanzeige exakt 2 s später starten – niemals gleichzeitig.
  gameSetTimeout(()=>{map1PopularityDeltaBusy=false;runNextMap1PopularityDelta();},2000);
}
function showMap1PopularityDelta(delta){
  if(!delta)return;
  map1PopularityDeltaQueue.push(delta);
  runNextMap1PopularityDelta();
}
function changeMap1Popularity(delta){
  const old=map1Popularity;map1Popularity=Math.max(0,Math.min(100,map1Popularity+delta));
  const applied=map1Popularity-old;
  if(applied)showMap1PopularityDelta(applied);
  scheduleMap1PopularitySounds(old,map1Popularity);
  if(map1Popularity===0&&old>0){startMap1GameOver();return;}
  renderMap1ScribeNumbers();syncMap1Scribe();syncMap1ScribeConfetti();syncMap1Popularity90Song();
}

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
    position:'absolute',left:'0',top:'0',width:'118.53625px',height:'auto',
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
  gameSetTimeout(()=>{map1BockPuff?.remove();map1BockPuff=null;},760);
}

function startMap1BockEvent(){
  if(currentMap!==1 || mapTransitioning || map1BockActive)return;
  map1BockActive=true;
  pauseMap1Popularity90Song(false);
  map1BockStage='waiting';
  syncMap1Scribe();

  // Kompletter Wiederholungs-Reset für Taste 2.
  gameClearTimeout(map1BockServeTimer);
  gameClearTimeout(map1BockBurpTimer);
  gameClearTimeout(map1BockExitTimer);
  gameClearTimeout(map1BockFinalTimer);
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

  gameClearTimeout(map1RunnerTimer);
  gameClearTimeout(map1BockSpawnTimer);
  gameClearTimeout(map1BockArrivalTimer);
  gameClearTimeout(map1BockFinalTimer);
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
  map1RunnerTimer=gameSetTimeout(()=>{
    if(!map1BockActive)return;
    const woman=ensureMap1Runner();
    map1RunnerActive=true;
    map1RunnerStart=gameNow();
    woman.style.display='block';
    woman.style.opacity='1';
  },500);

  // Bildschirm sofort atmosphärisch abdunkeln + dichte Nebelschleier von links nach rechts.
  dark.style.display='block'; fog.style.display='block';
  fog.style.opacity='1'; // Taste 2: Nebel im selben Tick sichtbar, keine Anlaufverzögerung.
  gameRequestAnimationFrame(()=>{dark.style.opacity='1';});

  // Exakt 3 Sekunden nach Tastendruck: Reiter kommt auf derselben Grundlinie ins Bild.
  map1BockSpawnTimer=gameSetTimeout(()=>{
    if(!map1BockActive)return;
    map1BockStage='riding';
    map1BockStart=gameNow();
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
function showMap1BockThought(){ if(map1BockBeerCount>=MAP1_BOCK_BEERS_REQUIRED)return; const b=ensureMap1BockThought(); b.style.display='block';b.style.opacity='0';b.style.transform='scale(.72)';gameRequestAnimationFrame(()=>gameRequestAnimationFrame(()=>{b.style.opacity='1';b.style.transform='scale(1)';})); }
function hideMap1BockThought(){if(map1BockThought){map1BockThought.style.opacity='0';map1BockThought.style.transform='scale(.84)';gameSetTimeout(()=>{if(map1BockThought&&map1BockThought.style.opacity==='0')map1BockThought.style.display='none';},280);}}
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
  Object.assign(plus.style,{position:'absolute',left:`${x}px`,top:`${y-18}px`,transform:'translate(-50%,-50%)',font:'700 22px/1 sans-serif',color:'#f4c542',textShadow:'0 2px 3px rgba(0,0,0,.8)',pointerEvents:'none',zIndex:'30000',opacity:'1'});
  world.appendChild(plus);
  plus.animate([{transform:'translate(-50%,8px)',opacity:1},{transform:'translate(-50%,-30px)',opacity:1,offset:.55},{transform:'translate(-50%,-48px)',opacity:0}],{duration:1500,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>plus.remove(),1550);
}
function map1GuestNearbyEmptyMug(){
  if(currentMap!==1||mapTransitioning)return null;
  let best=null,bestD=Infinity;
  for(const mug of map1TableMugs.values()){
    if(!mug?.isConnected||mug.dataset.guestEmpty!=='1'||mug.dataset.picked==='1'||mug.style.display==='none')continue;
    const x=parseFloat(mug.style.left)||+mug.dataset.x||0,y=parseFloat(mug.style.top)||+mug.dataset.y||0;
    const d=Math.hypot(PLAYER.x-x,PLAYER.y-y);
    if(d<=42&&d<bestD){best=mug;bestD=d;}
  }
  return best;
}
function updateMap1GuestEmptyMugCue(){
  const near=map1GuestNearbyEmptyMug();
  for(const mug of map1TableMugs.values()){
    if(!mug?.isConnected||mug.dataset.guestEmpty!=='1'||mug.dataset.picked==='1')continue;
    mug.style.filter=mug===near?'brightness(1.35) drop-shadow(0 0 5px rgba(255,225,110,.98)) drop-shadow(0 0 10px rgba(255,190,55,.72))':'none';
  }
}
function pickupMap1GuestEmptyMug(){
  const mug=map1GuestNearbyEmptyMug();if(!mug)return false;
  mug.dataset.picked='1';mug.dataset.guestEmpty='0';mug.style.filter='none';
  const x=parseFloat(mug.style.left)||0,y=parseFloat(mug.style.top)||0;mug.dataset.x=String(x);mug.dataset.y=String(y);showMap1MugPlusOne(mug);
  mug.animate([{opacity:1,transform:'translate(-50%,-100%) scale(1)'},{opacity:0,transform:'translate(-50%,-115%) scale(.72)'}],{duration:180,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>{mug.style.display='none';mug.style.opacity='1';mug.style.transform='translate(-50%,-100%)';},190);return true;
}

function pickupMap1BockMug(){
  const mug=map1BockNearbyMug(); if(!mug)return false;
  mug.dataset.picked='1'; mug.style.filter='none'; showMap1MugPlusOne(mug);
  mug.animate([{opacity:1,transform:'translate(-50%,-100%) scale(1)'},{opacity:0,transform:'translate(-50%,-115%) scale(.72)'}],{duration:180,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>mug.remove(),190); return true;
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
  gameSetTimeout(()=>{
    final.style.display='none';final.style.filter='none';
    rider.style.display='block';rider.style.opacity='1';rider.style.filter='none';rider.style.left=`${MAP1_BOCK_PATH_END[0]}px`;rider.style.top=`${MAP1_BOCK_PATH_END[1]}px`;rider.style.transform='translate(-50%,-100%) scale(1.14)';
    rider.src='assets/npc/bock-dismount.png?v=30';map1BockStage='departMount';
    map1BockExitTimer=gameSetTimeout(()=>{
      rider.src='assets/npc/bock-stop.png?v=30';map1BockStage='departStand';
      map1BockExitTimer=gameSetTimeout(()=>{map1BockStage='departRide';map1BockExitStart=gameNow();map1BockDepartureSound.pause();map1BockDepartureSound.currentTime=0;if(currentMap===1&&!mapTransitioning)map1BockDepartureSound.play().catch(()=>{});},1500);
    },500);
  },540);
}
function finishMap1BockDeparture(){
  const rider=ensureMap1BockRider();rider.style.display='none';map1BockStage='done';map1BockActive=false;syncMap1Scribe();
  bockFadeAudio(map1BockSong,0,1800,()=>{map1BockSong.pause();map1BockSong.currentTime=0;map1BockSong.volume=.72;});
  const {dark,fog}=ensureMap1BockFX();dark.style.transition='opacity 1800ms ease';dark.style.opacity='0';fog.style.transition='opacity 1600ms ease';fog.style.opacity='0';
  gameSetTimeout(()=>{fog.style.display='none';dark.style.display='none';resumeMap1AmbientMusic();},1900);
}

function startMap1BockBeerServe(){
  if(!map1BockCanInteract())return false;
  map1BockServing=true;keys.clear();PLAYER.moving=false;hideMap1BockThought();updateMap1BockInteractionCue();
  const final=ensureMap1BockFinal();final.src='assets/npc/bock-bier.png?v=38';gameClearTimeout(map1BockServeTimer);
  map1BockServeTimer=gameSetTimeout(()=>{
    if(!map1BockActive)return;
    final.src='assets/npc/bock-trinkt.png?v=38';
    map1BockDrinkSound.pause();
    try{map1BockDrinkSound.currentTime=Math.min(1,Math.max(0,(map1BockDrinkSound.duration||1.01)-.01));}catch(_){map1BockDrinkSound.currentTime=1;}
    if(currentMap===1&&!mapTransitioning)map1BockDrinkSound.play().catch(()=>{});

    // Rülpser 1 Sekunde VOR dem Krugwurf; Trink-Sound läuft unangetastet weiter.
    gameClearTimeout(map1BockBurpTimer);
    map1BockBurpTimer=gameSetTimeout(()=>{
      if(!map1BockActive)return;
      map1BockBurpSound.currentTime=0;
      if(currentMap===1&&!mapTransitioning)map1BockBurpSound.play().catch(()=>{});
    },2000);

    map1BockServeTimer=gameSetTimeout(()=>{
      if(currentMap!==1)return;
      final.src='assets/npc/bock-final.png?v=30';
      dropMap1BockMug(map1BockBeerCount);
      map1BockBeerCount++;map1BockServing=false;
      if(map1BockBeerCount<MAP1_BOCK_BEERS_REQUIRED){map1BockStage='waitingBeer';showMap1BockThought();}
      else{map1BockStage='fiveBeersDone';hideMap1BockThought();gameClearTimeout(map1BockExitTimer);map1BockExitTimer=gameSetTimeout(beginMap1BockDeparture,1000);}
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
  const sync=()=>{const w=player?.offsetWidth||parseFloat(getComputedStyle(player).width)||96;map1BockFinal.style.width=`${w*1.15}px`;};
  sync();gameRequestAnimationFrame(sync);return map1BockFinal;
}
function bockFadeAudio(audio,target,duration,done){
  const from=audio.volume,start=gameNow();
  const step=now=>{const t=Math.min(1,(now-start)/duration);audio.volume=from+(target-from)*t;if(t<1)gameRequestAnimationFrame(step);else done?.();};
  gameRequestAnimationFrame(step);
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

    map1BockArrivalTimer=gameSetTimeout(()=>{
      if(!map1BockActive)return;

      // Danach Anhang 1 MITTE = Absteigen, exakt 0,5 s. Rechtes Bild wird NICHT benutzt.
      rider.src='assets/npc/bock-dismount.png?v=30';
      rider.style.transform='translate(-50%,-100%) scale(1.14)'; /* exakt Lauf-/Reitsprite-Größe */

      map1BockArrivalTimer=gameSetTimeout(()=>{
        if(!map1BockActive)return;
        showBockPuff(MAP1_BOCK_PATH_END[0],MAP1_BOCK_PATH_END[1]);
        rider.style.transition='opacity 520ms ease,filter 520ms ease,transform 520ms ease';
        rider.style.opacity='0';rider.style.filter='blur(8px) brightness(2.1)';
        rider.style.transform='translate(-50%,-100%) scale(1.14)';
        map1BockStage='puff';

        gameSetTimeout(()=>{
          rider.style.display='none';
          const final=ensureMap1BockFinal();
          final.style.left=`${MAP1_BOCK_PATH_END[0]}px`;
          final.style.top=`${MAP1_BOCK_PATH_END[1]}px`;
          final.style.transform='translate(-50%,-100%)';
          final.style.transition='opacity 380ms ease';
          final.style.opacity='0';final.style.display='block';
          gameRequestAnimationFrame(()=>{final.style.opacity='1';});
          map1BockStage='final';

          // 5 Sekunden stehen, dann Song/Nebel/Dunkelheit weich raus + normale Musik weich rein.
          gameSetTimeout(()=>{if(map1BockActive)showMap1BockThought();},4500);
          map1BockFinalTimer=gameSetTimeout(finishMap1BockEvent,5000);
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
let map1Event3ScribeHit=false; // v78: Taste 3 wechselt den Schreiber erst exakt beim Schwerthieb.
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
  const id=gameSetTimeout(fn,ms);
  map1Event3Timers.push(id);
  return id;
}
function clearMap1Event3Timers(){
  for(const id of map1Event3Timers)gameClearTimeout(id);
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
  map1Event3Farmer.dataset.npcRole='event3Farmer';
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
    position:'absolute',left:'0',top:'0',width:'84px',height:'42px',
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
  syncMap1RealGuestCount();
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
  // v78: Erst JETZT – exakt mit dem Schwerthieb-Sound – auf Schreiber Bild 2 wechseln.
  map1Event3ScribeHit=true;
  syncMap1Scribe();
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
  map1Event3ScribeHit=false;
  syncMap1Scribe();
  clearMap1Event3Timers();
  resetMap1Event3Visuals();
  map1Event3Whistle.pause();map1Event3Whistle.currentTime=0;
  map1Event3SlashSound.pause();map1Event3SlashSound.currentTime=0;map1Event3SlashSound.onended=null;
  map1Event3BockSpawnSound.pause();map1Event3BockSpawnSound.currentTime=0;
  map1Event3BockRunSound.pause();map1Event3BockRunSound.currentTime=0;
  syncMap1RealGuestCount();
  resumeMap1AmbientMusic();
}
function startMap1Event3(){
  if(currentMap!==1||mapTransitioning||map1Event3Active)return;
  map1Event3Active=true;
  pauseMap1Popularity90Song(false);
  map1Event3ScribeHit=false;
  map1Event3FarmerStarted=false;
  map1Event3BockStarted=false;
  map1Event3AttackStage='none';
  map1Event3FarmerState='walk';
  syncMap1RealGuestCount();
  syncMap1Scribe();
  clearMap1Event3Timers();
  resetMap1Event3Visuals();

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
    syncMap1RealGuestCount();
    map1Event3FarmerStart=gameNow();
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
    map1Event3BockStart=gameNow();
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
      }else if(map1Event3FarmerStarted && map1Event3FarmerState==='walk' && farmer===map1Event3Farmer && farmer.dataset.npcRole==='event3Farmer'){
        // Ausschließlich DER Event-3-Bauer ist Trefferziel. Normale Gäste werden komplett ignoriert.
        const fx=parseFloat(map1Event3Farmer.style.left)||0,fy=parseFloat(map1Event3Farmer.style.top)||0;
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

/* MAP 1 – EVENT 4 (Taste 4): Kalif. Additiv/isoliert; Events 1–3 bleiben unverändert. */
const MAP1_EVENT4_FRAME_MS=430;
const MAP1_EVENT4_DURATION=22000; // sehr langsamer Lauf, exakt auf der Bock-/Runner-Linie oben -> unten
const map1Event4Intro=new Audio('assets/audio/ca_extra_01_converted_by_soundandgo.com_ (1).mp3');
const map1Event4Music=new Audio('assets/audio/Stronghold Crusader Soundtrack - 03 Crusader.mp3');
const map1Event4Ignite=new Audio('assets/audio/firepop7_converted_by_soundandgo.com_.mp3');
const map1Event4Flame=new Audio('assets/audio/event5-flame.mp3');
map1Event4Intro.preload='auto';map1Event4Intro.volume=1;
map1Event4Music.preload='auto';map1Event4Music.volume=.72;map1Event4Music.loop=true;
map1Event4Ignite.preload='auto';map1Event4Ignite.volume=1;
map1Event4Flame.preload='auto';map1Event4Flame.volume=1;
let map1Event4Active=false,map1Event4Walking=false,map1Event4Kalif=null,map1Event4Start=0,map1Event4SpecialStart=-1,map1Event4PopularityDone=false;
let map1Event4IgniteAt=-1,map1Event4FireStart=-1,map1Event4FireDone=false;
function ensureMap1Event4Kalif(){
  if(map1Event4Kalif)return map1Event4Kalif;
  map1Event4Kalif=document.createElement('img');map1Event4Kalif.id='map1Event4Kalif';map1Event4Kalif.alt='';map1Event4Kalif.draggable=false;
  map1Event4Kalif.src='assets/npc/kalif-1.png?v=82';
  Object.assign(map1Event4Kalif.style,{position:'absolute',left:'0',top:'0',width:'112px',height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'19500',willChange:'left,top,transform'});
  world.appendChild(map1Event4Kalif);return map1Event4Kalif;
}
function finishMap1Event4(){
  if(!map1Event4Active)return;map1Event4Active=false;map1Event4Walking=false;
  map1Event4Intro.pause();map1Event4Intro.currentTime=0;map1Event4Intro.onended=null;
  map1Event4Ignite.pause();map1Event4Ignite.currentTime=0;
  map1Event4Flame.pause();map1Event4Flame.currentTime=0;
  map1Event4Music.pause();map1Event4Music.currentTime=0;
  if(map1Event4Kalif)map1Event4Kalif.style.display='none';
  resumeMap1AmbientMusic();
}
/* v112: Kalif-Intro erst gepuffert und nach abgeschlossenem Rücksprung auf 0 starten. */
const kalifAudioStarts=new WeakMap();
async function startKalifIntroAudio(intro,music,isActive){
  const token=(kalifAudioStarts.get(intro)||0)+1;kalifAudioStarts.set(intro,token);
  intro.pause();music.pause();
  const current=()=>kalifAudioStarts.get(intro)===token&&isActive();
  try{
    if(intro.readyState<4){
      await new Promise((resolve,reject)=>{
        const clean=()=>{intro.removeEventListener('canplaythrough',ready);intro.removeEventListener('error',failed);};
        const ready=()=>{clean();resolve();};
        const failed=()=>{clean();reject(new Error('Kalif-Intro konnte nicht geladen werden'));};
        intro.addEventListener('canplaythrough',ready);intro.addEventListener('error',failed);
        intro.load();
        if(intro.readyState>=4)ready();
      });
    }
    if(!current())return;
    intro.currentTime=0;
    if(intro.seeking)await new Promise(resolve=>intro.addEventListener('seeked',resolve,{once:true}));
    if(gamePaused)await new Promise(resolve=>gameRequestAnimationFrame(resolve));
    if(!current())return;
    music.currentTime=0;
    const introStarted=intro.play();
    const musicStarted=music.play();
    await Promise.all([introStarted,musicStarted]);
  }catch(error){console.error('KALIF-INTRO:',error);}
}

function startMap1Event4(){
  if(currentMap!==1||mapTransitioning||map1Event4Active)return;
  map1Event4Active=true;map1Event4Walking=false;map1Event4SpecialStart=-1;map1Event4PopularityDone=false;
  pauseMap1Popularity90Song(false);
  map1Event4IgniteAt=-1;map1Event4FireStart=-1;map1Event4FireDone=false;
  const kalif=ensureMap1Event4Kalif();kalif.style.display='none';
  if(bgMusic)bgMusic.pause();map1Event4Music.pause();map1Event4Music.currentTime=0;
  // Taste 4: Crusader-Song sofort zusammen mit dem Intro-Sound starten.
  // Intro und Musik werden gemeinsam nach der Audiovorbereitung gestartet.
  map1Event4Intro.pause();map1Event4Intro.currentTime=0;
  map1Event4Intro.onended=()=>{
    if(!map1Event4Active)return;
    // Musik läuft bereits seit Tastendruck; nach Intro erscheint der Kalif.
    map1Event4Start=gameNow();map1Event4Walking=true;
    kalif.src='assets/npc/kalif-1.png?v=82';kalif.style.display='block';kalif.style.visibility='visible';kalif.style.opacity='1';
  };
  startKalifIntroAudio(map1Event4Intro,map1Event4Music,()=>map1Event4Active);
}
function updateMap1Event4(now){
  if(!map1Event4Active)return;
  const kalif=ensureMap1Event4Kalif();kalif.style.visibility=(currentMap===1&&!mapTransitioning)?'visible':'hidden';
  if(!map1Event4Walking)return;
  const elapsed=now-map1Event4Start,t=Math.min(1,elapsed/MAP1_EVENT4_DURATION),p=map1RunnerPointAt(t);
  kalif.style.left=`${p[0]}px`;kalif.style.top=`${p[1]}px`;
  const perspective=(.82+t*.34)*.75;
  let src='assets/npc/kalif-1.png?v=82',mirror=false;
  if(map1Event4SpecialStart<0){
    const phase=Math.floor(elapsed/MAP1_EVENT4_FRAME_MS);
    mirror=(phase%2)===1;
    // Frühestens nach 5 s, aber zwingend erst NACH einem vollständig gezeigten gespiegelten Kalif-1-Frame.
    if(elapsed>=5000 && (phase%2)===0){map1Event4SpecialStart=phase*MAP1_EVENT4_FRAME_MS;}
  }
  if(map1Event4SpecialStart>=0){
    const se=elapsed-map1Event4SpecialStart;
    mirror=false;
    if(se<MAP1_EVENT4_FRAME_MS){src='assets/npc/kalif-2.png?v=82';}
    else if(se<MAP1_EVENT4_FRAME_MS*2){
      src='assets/npc/kalif-3.png?v=82';
      if(!map1Event4PopularityDone){
        map1Event4PopularityDone=true;changeMap1Popularity(2);
        map1Event4IgniteAt=now;
        map1Event4Ignite.currentTime=0;map1Event4Ignite.play().catch(()=>{});
      }
    }else{
      const post=Math.floor((se-MAP1_EVENT4_FRAME_MS*2)/MAP1_EVENT4_FRAME_MS)%2;
      src=post===0?'assets/npc/kalif-7.png?v=82':'assets/npc/kalif-8.png?v=82';
    }
  }
  // Genau 3 Sekunden nach dem Fackel-Anzünden: derselbe Feuerspucker-Effekt wie Event 5.
  // Nur Flammenbild + Feuerspucker-Sound; KEIN Schrei und KEIN Brenn-Loop.
  if(map1Event4IgniteAt>=0&&!map1Event4FireDone&&map1Event4FireStart<0&&now-map1Event4IgniteAt>=3000){
    map1Event4FireStart=now;
    changeMap1Popularity(10);
    map1Event4Flame.pause();map1Event4Flame.currentTime=0;map1Event4Flame.play().catch(()=>{});
  }
  if(map1Event4FireStart>=0&&!map1Event4FireDone){
    if(now-map1Event4FireStart<MAP1_EVENT4_FRAME_MS+300){
      src='assets/npc/event5-kalif-fire.png?v=87';mirror=false;
    }else{
      map1Event4FireDone=true;
      src='assets/npc/kalif-7.png?v=82';mirror=false;
    }
  }
  if((kalif.getAttribute('src')||'')!==src)kalif.src=src;
  kalif.style.width=src.includes('event5-kalif-fire.png')?'252px':'112px';
  kalif.style.transform=`translate(-50%,-100%) scale(${mirror?-perspective:perspective},${perspective})`;
  kalif.style.zIndex=String(19500+Math.round(p[1]));
  if(t>=1)finishMap1Event4();
}


/* MAP 1 – EVENT 5 (Taste 5): pfeifender Bauer + Kalif. Additiv/isoliert. */
const MAP1_EVENT5_FARMER_DELAY=MAP1_EVENT3_FARMER_DELAY;
const MAP1_EVENT5_FARMER_FRAME_MS=MAP1_EVENT3_FARMER_FRAME_MS;
const MAP1_EVENT5_FARMER_DURATION=MAP1_EVENT3_FARMER_DURATION;
const MAP1_EVENT5_KALIF_FRAME_MS=MAP1_EVENT4_FRAME_MS;
const MAP1_EVENT5_KALIF_DURATION=MAP1_EVENT4_DURATION;
const MAP1_EVENT5_FIRE_DISTANCE=235;
const MAP1_EVENT5_HIT_DISTANCE=78;
const map1Event5Whistle=new Audio('assets/audio/Human whistle (singing) - sound effect.mp3');
const map1Event5Intro=new Audio('assets/audio/ca_extra_01_converted_by_soundandgo.com_ (1).mp3');
const map1Event5Music=new Audio('assets/audio/Stronghold Crusader Soundtrack - 03 Crusader.mp3');
const map1Event5TorchIgnite=new Audio('assets/audio/firepop7_converted_by_soundandgo.com_.mp3');
const map1Event5Flame=new Audio('assets/audio/event5-flame.mp3');
const map1Event5Scream=new Audio('assets/audio/event5-scream.mp3');
const map1Event5BurnLoop=new Audio('assets/audio/event5-burn-loop.mp3');
map1Event5Whistle.preload='auto';map1Event5Whistle.volume=.88;
map1Event5Intro.preload='auto';map1Event5Intro.volume=1;
map1Event5Music.preload='auto';map1Event5Music.volume=.72;map1Event5Music.loop=true;
map1Event5TorchIgnite.preload='auto';map1Event5TorchIgnite.volume=1;
map1Event5Flame.preload='auto';map1Event5Flame.volume=1;
map1Event5Scream.preload='auto';map1Event5Scream.volume=1;
map1Event5BurnLoop.preload='auto';map1Event5BurnLoop.volume=1;
let map1Event5Active=false,map1Event5Farmer=null,map1Event5Kalif=null;
let map1Event5FarmerStarted=false,map1Event5KalifWalking=false;
let map1Event5FarmerStart=0,map1Event5KalifStart=0,map1Event5TorchStart=-1,map1Event5TorchSoundDone=false;
let map1Event5FireStage='none',map1Event5FireStart=0,map1Event5FirePendingAt=-1,map1Event5HitTime=0,map1Event5HitProgress=0;
let map1Event5FarmerState='walk',map1Event5BurnRepeat=0,map1Event5Timers=[];
function map1Event5Later(fn,ms){const id=gameSetTimeout(fn,ms);map1Event5Timers.push(id);return id;}
function clearMap1Event5Timers(){for(const id of map1Event5Timers)gameClearTimeout(id);map1Event5Timers=[];}
function ensureMap1Event5Farmer(){
  if(map1Event5Farmer)return map1Event5Farmer;
  map1Event5Farmer=document.createElement('img');map1Event5Farmer.id='map1Event5Farmer';map1Event5Farmer.alt='';map1Event5Farmer.draggable=false;
  map1Event5Farmer.dataset.npcRole='event5Farmer';
  map1Event5Farmer.src='assets/npc/event3-bauer-walk.png?v=71';
  Object.assign(map1Event5Farmer.style,{position:'absolute',left:'0',top:'0',width:'176.4px',height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'13000',willChange:'left,top,transform'});
  world.appendChild(map1Event5Farmer);return map1Event5Farmer;
}
function ensureMap1Event5Kalif(){
  if(map1Event5Kalif)return map1Event5Kalif;
  map1Event5Kalif=document.createElement('img');map1Event5Kalif.id='map1Event5Kalif';map1Event5Kalif.alt='';map1Event5Kalif.draggable=false;
  map1Event5Kalif.src='assets/npc/kalif-1.png?v=82';
  Object.assign(map1Event5Kalif.style,{position:'absolute',left:'0',top:'0',width:'112px',height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'19500',willChange:'left,top,transform'});
  world.appendChild(map1Event5Kalif);return map1Event5Kalif;
}
function stopMap1Event5BurnSounds(){
  map1Event5Scream.pause();map1Event5Scream.currentTime=0;
  map1Event5BurnLoop.pause();map1Event5BurnLoop.currentTime=0;map1Event5BurnLoop.onended=null;
}
function startMap1Event5AfterFlameSounds(){
  if(!map1Event5Active)return;
  map1Event5Scream.pause();map1Event5Scream.currentTime=0;map1Event5Scream.play().catch(()=>{});
  map1Event5BurnRepeat=0;
  map1Event5BurnLoop.pause();map1Event5BurnLoop.currentTime=0;map1Event5BurnLoop.onended=null;
  map1Event5BurnLoop.play().catch(()=>{});
}
function beginMap1Event5Kalif(){
  if(!map1Event5Active)return;
  const kalif=ensureMap1Event5Kalif();
  // Event 5: Kalif läuft bereits in exakt demselben Moment los, in dem Intro-Sound + Crusader-Song starten.
  // Dadurch bleibt die Fackel-Anzünd-Wegstelle an seiner Laufroute unverändert, die Begegnung mit dem Bauern liegt aber weiter unten.
  map1Event5KalifStart=gameNow();map1Event5KalifWalking=true;map1Event5TorchStart=-1;map1Event5TorchSoundDone=false;
  kalif.src='assets/npc/kalif-1.png?v=82';kalif.style.width='112px';kalif.style.display='block';kalif.style.visibility='visible';kalif.style.opacity='1';
  map1Event5Intro.onended=null;
  startKalifIntroAudio(map1Event5Intro,map1Event5Music,()=>map1Event5Active);
}
function finishMap1Event5(){
  if(!map1Event5Active)return;map1Event5Active=false;map1Event5FarmerStarted=false;map1Event5KalifWalking=false;
  clearMap1Event5Timers();
  map1Event5Whistle.pause();map1Event5Whistle.currentTime=0;
  map1Event5Intro.pause();map1Event5Intro.currentTime=0;map1Event5Intro.onended=null;
  map1Event5TorchIgnite.pause();map1Event5TorchIgnite.currentTime=0;
  map1Event5Flame.pause();map1Event5Flame.currentTime=0;map1Event5Flame.onended=null;
  stopMap1Event5BurnSounds();
  map1Event5Music.pause();map1Event5Music.currentTime=0;
  if(map1Event5Farmer)map1Event5Farmer.style.display='none';if(map1Event5Kalif)map1Event5Kalif.style.display='none';
  syncMap1RealGuestCount();
  resumeMap1AmbientMusic();
}
function startMap1Event5(){
  if(currentMap!==1||mapTransitioning||map1Event5Active)return;
  map1Event5Active=true;map1Event5FarmerStarted=false;map1Event5KalifWalking=false;map1Event5FarmerState='walk';map1Event5FireStage='none';map1Event5FirePendingAt=-1;map1Event5TorchStart=-1;map1Event5TorchSoundDone=false;
  pauseMap1Popularity90Song(false);
  syncMap1RealGuestCount();
  clearMap1Event5Timers();stopMap1Event5BurnSounds();
  const farmer=ensureMap1Event5Farmer(),kalif=ensureMap1Event5Kalif();farmer.style.display='none';kalif.style.display='none';
  if(bgMusic)bgMusic.pause();
  map1Event5Whistle.pause();map1Event5Whistle.currentTime=0;map1Event5Whistle.play().catch(()=>{});
  // Exakt wie Event 3: Pfeifen zuerst, Bauer nach 3 s. In genau diesem Moment startet Event-4-Kalif (Musik + Intro).
  map1Event5Later(()=>{
    if(!map1Event5Active)return;
    map1Event5FarmerStarted=true;map1Event5FarmerStart=gameNow();map1Event5FarmerState='walk';
    syncMap1RealGuestCount();
    farmer.src='assets/npc/event3-bauer-walk.png?v=71';farmer.style.width='176.4px';farmer.style.display='block';farmer.style.visibility='visible';farmer.style.opacity='1';
    beginMap1Event5Kalif();
  },MAP1_EVENT5_FARMER_DELAY);
}
function map1Event5Ignite(now){
  if(map1Event5FireStage!=='none')return;
  const kalif=ensureMap1Event5Kalif();map1Event5FireStage='fire';map1Event5FireStart=now;map1Event5FirePendingAt=-1;
  syncMap1RealGuestCount();
  changeMap1Popularity(-1);
  changeMap1Popularity(10);
  // Flammenbild zwingend NACH bereits gezeigtem kalif-8.
  kalif.src='assets/npc/event5-kalif-fire.png?v=87';
  map1Event5Flame.pause();map1Event5Flame.currentTime=0;
  let afterFlameStarted=false;
  const startAfterFlameOnce=()=>{if(afterFlameStarted||!map1Event5Active)return;afterFlameStarted=true;startMap1Event5AfterFlameSounds();};
  map1Event5Flame.onended=startAfterFlameOnce;
  const armAfterFlame=()=>{
    const d=map1Event5Flame.duration;
    if(Number.isFinite(d)&&d>0)map1Event5Later(startAfterFlameOnce,Math.max(0,(d-1)*1000));
  };
  if(map1Event5Flame.readyState>=1)armAfterFlame();else map1Event5Flame.addEventListener('loadedmetadata',armAfterFlame,{once:true});
  map1Event5Flame.play().catch(()=>{});
}
function map1Event5FarmerHit(now,progress){
  if(map1Event5FarmerState!=='walk')return;
  map1Event5FarmerState='burn';map1Event5HitTime=now;map1Event5HitProgress=progress;
  // Berührung: Pfeifen sofort aus; Kalifenmusik läuft ausdrücklich weiter.
  map1Event5Whistle.pause();map1Event5Whistle.currentTime=0;
  const farmer=ensureMap1Event5Farmer();farmer.src='assets/npc/event5-bauer-fire.png?v=87';farmer.style.width='176.4px';
}
function updateMap1Event5(now){
  if(!map1Event5Active)return;
  const farmer=ensureMap1Event5Farmer(),kalif=ensureMap1Event5Kalif();
  const visible=currentMap===1&&!mapTransitioning;farmer.style.visibility=visible?'visible':'hidden';kalif.style.visibility=visible?'visible':'hidden';
  let farmerT=0;
  if(map1Event5FarmerStarted){
    if(map1Event5FarmerState==='walk') farmerT=Math.min(1,(now-map1Event5FarmerStart)/MAP1_EVENT5_FARMER_DURATION);
    else farmerT=Math.min(1,map1Event5HitProgress+((now-map1Event5HitTime)/(MAP1_EVENT5_FARMER_DURATION/2)));
    const [fx,fy]=map1Event3PointAt(farmerT,true);
    const mirrored=(Math.floor((map1Event5FarmerState==='walk'?now-map1Event5FarmerStart:now-map1Event5HitTime)/MAP1_EVENT5_FARMER_FRAME_MS)%2)===1;
    const perspective=.82+(1-farmerT)*.34;
    farmer.style.left=`${fx}px`;farmer.style.top=`${fy}px`;
    farmer.style.transform=`translate(-50%,-100%) scale(${mirrored?-perspective:perspective},${perspective})`;
    farmer.style.zIndex=String(13000+Math.round(fy));
    if(farmerT>=1){farmer.style.display='none';map1Event5FarmerStarted=false;}
  }
  if(map1Event5KalifWalking){
    const elapsed=now-map1Event5KalifStart,kt=Math.min(1,elapsed/MAP1_EVENT5_KALIF_DURATION),[kx,ky]=map1RunnerPointAt(kt);
    kalif.style.left=`${kx}px`;kalif.style.top=`${ky}px`;kalif.style.zIndex=String(19500+Math.round(ky));
    const perspective=(.82+kt*.34)*.75;
    let src='assets/npc/kalif-1.png?v=82',mirror=false;
    if(map1Event5TorchStart<0){
      const phase=Math.floor(elapsed/MAP1_EVENT5_KALIF_FRAME_MS);mirror=(phase%2)===1;
      if(elapsed>=5000&&(phase%2)===0)map1Event5TorchStart=phase*MAP1_EVENT5_KALIF_FRAME_MS;
    }
    if(map1Event5TorchStart>=0){
      const se=elapsed-map1Event5TorchStart;mirror=false;
      if(se<MAP1_EVENT5_KALIF_FRAME_MS)src='assets/npc/kalif-2.png?v=82';
      else if(se<MAP1_EVENT5_KALIF_FRAME_MS*2){
        src='assets/npc/kalif-3.png?v=82';
        // Exakt wie Event 4: beim Wechsel auf das Flamme-Anzünden-Bild derselbe firepop-Sound.
        if(!map1Event5TorchSoundDone){map1Event5TorchSoundDone=true;changeMap1Popularity(2);map1Event5TorchIgnite.pause();map1Event5TorchIgnite.currentTime=0;map1Event5TorchIgnite.play().catch(()=>{});}
      }else{
        const post=Math.floor((se-MAP1_EVENT5_KALIF_FRAME_MS*2)/MAP1_EVENT5_KALIF_FRAME_MS)%2;
        src=post===0?'assets/npc/kalif-7.png?v=82':'assets/npc/kalif-8.png?v=82';
        if(map1Event5FireStage==='none'&&map1Event5FarmerStarted&&map1Event5FarmerState==='walk'&&farmer===map1Event5Farmer&&farmer.dataset.npcRole==='event5Farmer'){
          // Feuer-Nähe ausschließlich gegen den ORIGINALEN Event-5-Bauern prüfen.
          const fx=parseFloat(map1Event5Farmer.style.left)||0,fy=parseFloat(map1Event5Farmer.style.top)||0,d=Math.hypot(kx-fx,ky-fy);
          // Erst nachdem kalif-8 tatsächlich sichtbar war, darf beim nächsten Nähe-Check das Feuerbild kommen.
          const current=(kalif.getAttribute('src')||'');
          if(d<=MAP1_EVENT5_FIRE_DISTANCE&&current.includes('kalif-8.png')&&map1Event5FirePendingAt<0)map1Event5FirePendingAt=now+1000;
        }
      }
    }
    if(map1Event5FireStage==='none'&&map1Event5FirePendingAt>=0&&now>=map1Event5FirePendingAt){
      map1Event5Ignite(now);
    }
    if(map1Event5FireStage==='fire'){
      src='assets/npc/event5-kalif-fire.png?v=87';mirror=false;
      if(now-map1Event5FireStart>=MAP1_EVENT5_KALIF_FRAME_MS+300){map1Event5FireStage='afterFire';src='assets/npc/kalif-7.png?v=82';}
    }else if(map1Event5FireStage==='afterFire'){
      const post=Math.floor((now-map1Event5FireStart-(MAP1_EVENT5_KALIF_FRAME_MS+300))/MAP1_EVENT5_KALIF_FRAME_MS)%2;
      src=post===0?'assets/npc/kalif-7.png?v=82':'assets/npc/kalif-8.png?v=82';mirror=false;
      if(map1Event5FarmerStarted&&map1Event5FarmerState==='walk'&&farmer===map1Event5Farmer&&farmer.dataset.npcRole==='event5Farmer'){
        const fx=parseFloat(map1Event5Farmer.style.left)||0,fy=parseFloat(map1Event5Farmer.style.top)||0,d=Math.hypot(kx-fx,ky-fy);
        if(d<=MAP1_EVENT5_HIT_DISTANCE)map1Event5FarmerHit(now,farmerT);
      }
    }
    if((kalif.getAttribute('src')||'')!==src)kalif.src=src;
    // Das Feuerspuckerbild ist ein breites 3:2-Motiv. Nur für diesen Frame größer rendern,
    // damit der Kalif selbst dieselbe sichtbare Körpergröße wie seine normalen Kalif-Sprites behält.
    kalif.style.width=src.includes('event5-kalif-fire.png')?'252px':'112px';
    kalif.style.transform=`translate(-50%,-100%) scale(${mirror?-perspective:perspective},${perspective})`;
    if(kt>=1){kalif.style.display='none';map1Event5KalifWalking=false;map1Event5Later(finishMap1Event5,1200);}
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
  playLoudInteractionSound(map2BeerTapSound);
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
  const start=gameNow();
  const tick=now=>{
    if(!map2BarServing)return;
    const t=Math.min(1,(now-start)/MAP2_BAR_INTERACT.duration);
    progress.style.background=`conic-gradient(#ffd42a ${t*360}deg, rgba(255,212,42,.18) ${t*360}deg)`;
    if(t<1){ map2BarServeTimer=gameRequestAnimationFrame(tick); return; }
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
  map2BarServeTimer=gameRequestAnimationFrame(tick);
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
    map1Runner.style.width=`${w*1.15}px`;
  };
  syncRunnerSize();
  gameRequestAnimationFrame(syncRunnerSize);
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
  gameClearTimeout(map1BearLoopTimer);
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
  gameClearTimeout(map1BearSongStartTimer);
  map1BearSongStartTimer=null;
  if(map1BearSongFadeRAF)gameCancelAnimationFrame(map1BearSongFadeRAF);
  if(map1BearSongWatchRAF)gameCancelAnimationFrame(map1BearSongWatchRAF);
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
  resumeMap1AmbientMusic();
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

    map1BearSongWatchRAF=gameRequestAnimationFrame(watch);
  };

  map1BearSongWatchRAF=gameRequestAnimationFrame(watch);
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
      if(stillRunning())map1BearLoopTimer=gameSetTimeout(play2,500);
    };
  };
  const play2=()=>{
    if(!stillRunning())return;
    map1BearSound2.currentTime=0;
    map1BearSound2.play().catch(()=>{});
    map1BearSound2.onended=()=>{
      if(stillRunning())map1BearLoopTimer=gameSetTimeout(play3,1000);
    };
  };
  const play3=()=>{
    if(!stillRunning())return;
    map1BearSound3.currentTime=0;
    map1BearSound3.play().catch(()=>{});
    map1BearSound3.onended=()=>{
      if(stillRunning())map1BearLoopTimer=gameSetTimeout(play1,500);
    };
  };

  play1();
}

function startMap1Runner(){
  if(currentMap!==1 || mapTransitioning || map1RunnerActive)return;
  const el=ensureMap1Runner();

  pauseMap1Popularity90Song(false);

  // Taste 1: Schrei SOFORT. Er läuft vollständig weiter und wird NICHT vom Song beendet.
  gameClearTimeout(map1RunnerTimer);
  stopMap1BearAudioLoop();
  cancelMap1BearSongAutomation(true);
  map1RunnerSound.onended=null;
  map1RunnerSound.pause();
  map1RunnerSound.currentTime=0;
  if(bgMusic)bgMusic.pause();
  map1RunnerSound.play().catch(()=>{});

  // Exakt 0,3 s nach Beginn des Schreis startet Bear and the Maiden Fair parallel zum Schrei.
  map1BearSongStartTimer=gameSetTimeout(()=>{
    startMap1BearSong();
  },300);

  // Frau rennt weiterhin erst 0,5 s nach Beginn des Schreis los.
  map1RunnerTimer=gameSetTimeout(()=>{
    map1RunnerActive=true;
    map1RunnerStart=gameNow();
    el.style.display='block';
    el.style.opacity='1';
  },500);

  // Bär + Bärensounds weiterhin erst nach komplettem Frauenschrei.
  map1RunnerSound.onended=()=>{
    startMap1Bear(gameNow()-MAP1_BEAR_DELAY);
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
  const perspective=(.82+t*.34)*.75;
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
    map1Bear.style.width=`${w*1.84}px`;
  };
  syncBearSize();
  gameRequestAnimationFrame(syncBearSize);

  // Sprite sofort laden; bei Fehler zweites Asset probieren.
  map1Bear.src='assets/npc/baer-run-1.png?v=22';
  map1Bear.onerror=()=>{
    console.error('BÄR-ASSET NICHT GEFUNDEN:',map1Bear.src);
  };

  return map1Bear;
}

function startMap1Bear(startTime=gameNow()){
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

  const perspective=(.82+t*.34)*.75;
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
  const onMap1=currentMap===1; // v99: wie Spieler – bis zum echten Map-Swap sichtbar, beim Rückswap sofort sichtbar
  if(map1King)map1King.style.visibility=onMap1&&map1KingActive?'visible':'hidden';
  if(map1KingThought)map1KingThought.style.visibility=onMap1&&map1KingActive?'visible':'hidden';
  // Nur die VISUALS von Map-1-Events verstecken. Zustände/Zeitachsen laufen weiter.
  if(map1Runner) map1Runner.style.visibility=onMap1 ? (map1RunnerActive?'visible':'hidden') : 'hidden';
  if(map1Bear) map1Bear.style.visibility=onMap1 ? (map1BearActive?'visible':'hidden') : 'hidden';
  if(map1BockRider && map1BockRider.style.display!=='none') map1BockRider.style.visibility=onMap1?'visible':'hidden';
  if(map1BockFinal && map1BockFinal.style.display!=='none') map1BockFinal.style.visibility=onMap1?'visible':'hidden';
  if(map1BockThought && map1BockThought.style.display!=='none') map1BockThought.style.visibility=onMap1?'visible':'hidden';
  for(const mug of map1BockMugs){if(mug?.isConnected)mug.style.visibility=onMap1?'visible':'hidden';}
  for(const mug of map1TableMugs.values()){if(mug?.isConnected)mug.style.visibility=onMap1?'visible':'hidden';}
  if(map1GuestEl)map1GuestEl.style.visibility=onMap1&&map1GuestActive?'visible':'hidden';
  if(map1GuestThought&&map1GuestThought.style.display!=='none')map1GuestThought.style.visibility=onMap1?'visible':'hidden';
  if(map1WomanEl)map1WomanEl.style.visibility=onMap1&&map1WomanActive?'visible':'hidden';
  if(map1WomanThought&&map1WomanThought.style.display!=='none')map1WomanThought.style.visibility=onMap1?'visible':'hidden';
  if(map1BockPuff)map1BockPuff.style.visibility=onMap1?'visible':'hidden';
  const fx=ensureMap1BockFX();
  if(!onMap1){fx.dark.style.visibility='hidden';fx.fog.style.visibility='hidden';}
  else {fx.dark.style.visibility='visible';fx.fog.style.visibility='visible';}
}

/* In Map 2 laufen die Event-Zeitachsen weiter. Mitgenommen werden aber ausschließlich
   die Event-SONGS; Schreie/Bärensounds/Bock-SFX bleiben innen stumm. */
function syncEventAudioForCurrentMap(){
  if(currentMap===2){
    map1KingArrivalSound.pause();map1KingGreetingSound.pause();map1KingStandSound.pause();
    map1RunnerSound.pause();
    stopMap1BearAudioLoop();
    [map1BockDepartureSound,map1BockDrinkSound,map1BockBurpSound].forEach(a=>a.pause());
  }
}

/* v110: Eigenständiges Krötenevent; keine Kollision oder Änderung der Teichregeln. */
const MAP1_TOAD_SOURCES=[1,2,3,4].map(n=>`assets/npc/kroete-${n}.png?v=110`);
const MAP1_TOAD_SPLASH='assets/npc/kroete-splash.png?v=110';
let map1Toad=null,map1ToadEpoch=null,map1ToadCycle=-1,map1ToadLastAge=-1,map1ToadSide=1,map1ToadCollectedCycle=-1;
const map1ToadSound=new Audio('assets/audio/kroete-plop.mp3?v=110');
map1ToadSound.preload='auto';
function ensureMap1Toad(){
  if(map1Toad)return;
  map1Toad=document.createElement('img');
  map1Toad.id='map1Toad';map1Toad.alt='';map1Toad.draggable=false;
  Object.assign(map1Toad.style,{position:'absolute',pointerEvents:'none',maxWidth:'none',display:'none',transformOrigin:'50% 100%'});
  world.appendChild(map1Toad);
}
function map1ToadPose(age){
  // Frame 1: 180 ms; beide Flugbilder je 220 ms; Boden: 2000 + 1000 ms.
  if(age<180)return {frame:1,u:0,ground:false,mirror:false};
  if(age<620)return {frame:age<400?2:3,u:(age-180)/440,ground:false,mirror:false};
  if(age<3620)return {frame:4,u:1,ground:true,mirror:age>=2620};
  if(age<4060)return {frame:age<3840?2:3,u:1-(age-3620)/440,ground:false,mirror:true};
  if(age<4660)return {splash:true,u:0,ground:false,mirror:false};
  return null;
}
function map1ToadPoint(u){
  const pond=document.getElementById('teich');
  const x=px(pond,'left')+pond.offsetWidth*(map1ToadSide===1?.72:.30),y=px(pond,'top')+pond.offsetHeight*.51;
  return {x:x+map1ToadSide*105*u,y:y+18*u-48*Math.sin(Math.PI*u),groundY:y+18*u};
}
function playMap1ToadSound(){
  if(currentMap!==1||gamePaused)return;
  try{map1ToadSound.currentTime=0;const p=map1ToadSound.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}
}
function updateMap1Toad(now){
  if(map1ToadEpoch===null)return;
  ensureMap1Toad();
  const elapsed=now-map1ToadEpoch;
  if(elapsed<20000){map1Toad.style.display='none';return;}
  const cycle=Math.floor(elapsed/20000),age=elapsed-cycle*20000;
  if(cycle!==map1ToadCycle){map1ToadCycle=cycle;map1ToadLastAge=-1;map1ToadSide=Math.random()<.5?-1:1;}
  if(cycle===map1ToadCollectedCycle){map1Toad.style.display='none';map1Toad.style.filter='none';return;}
  if(map1ToadLastAge<0&&age<180)playMap1ToadSound();
  if(map1ToadLastAge<4060&&age>=4060&&age<4660)playMap1ToadSound();
  map1ToadLastAge=age;
  const pose=map1ToadPose(age);
  if(!pose||currentMap!==1){map1Toad.style.display='none';return;}
  const point=map1ToadPoint(pose.u);
  const src=pose.splash?MAP1_TOAD_SPLASH:MAP1_TOAD_SOURCES[pose.frame-1];
  if(map1Toad.getAttribute('src')!==src)map1Toad.src=src;
  Object.assign(map1Toad.style,{display:'block',left:`${point.x}px`,top:`${point.y}px`,width:pose.splash?'46px':'58px',height:pose.splash?'20.5px':'46.4px',
    transform:`translate(-50%, -100%) scaleX(${(pose.mirror?-1:1)*map1ToadSide})`,
    zIndex:String(PLAYER.y>point.groundY?(Number(player.style.zIndex)||10000)-1:(Number(player.style.zIndex)||10000)+1),
    filter:pose.ground&&Math.hypot(PLAYER.x-point.x,PLAYER.y-point.groundY)<=48?MAP1_LANDSCAPE_GLOW:'none'});
}

/* v112: Nur die leuchtenden Bodenposen sind mit ^ aufhebbar. */
function pickupMap1Toad(){
  if(currentMap!==1||mapTransitioning||gamePaused||map1AppleShake||map1ToadEpoch===null)return false;
  const elapsed=gameNow()-map1ToadEpoch,cycle=Math.floor(elapsed/20000);
  if(cycle<1||cycle!==map1ToadCycle||cycle===map1ToadCollectedCycle||!map1Toad||map1Toad.style.display==='none')return false;
  const pose=map1ToadPose(elapsed-cycle*20000);
  if(!pose?.ground)return false;
  const point=map1ToadPoint(1);
  if(Math.hypot(PLAYER.x-point.x,PLAYER.y-point.groundY)>48)return false;
  map1ToadCollectedCycle=cycle;
  map1Toad.dataset.x=String(point.x);map1Toad.dataset.y=String(point.groundY);
  showMap1MugPlusOne(map1Toad);
  map1Toad.style.display='none';map1Toad.style.filter='none';
  map1ToadSound.pause();map1ToadSound.currentTime=0;
  map1ToadPickupSound.pause();map1ToadPickupSound.currentTime=0;map1ToadPickupSound.play().catch(()=>{});
  return true;
}

/* v111: Apfelbaumaktion und Früchte auf der pausierbaren Weltzeit. */
const MAP1_APPLE_SHAKE_IMAGE='assets/player/apfelbaum-ruetteln.png?v=111';
const MAP1_APPLE_IMAGE='assets/props/apfel.png?v=111';
let map1AppleShake=null,map1AppleShakeEl=null;
const map1Apples=[];
let map1ApplesCollected=0;
/* v113: Shuffle-Bag bleibt über Rüttelaktionen hinweg erhalten. */
const map1AppleShakeSounds=[1,2,3,4].map(n=>new Audio(`assets/audio/apfelbaum-ruetteln-${n}.mp3?v=113`));
const map1AppleExtraSound=new Audio('assets/audio/apfelbaum-zusatz.mp3?v=115');
map1AppleExtraSound.preload='auto';map1AppleExtraSound.volume=1;
const map1ToadPickupSound=new Audio('assets/audio/kroete-aufsammeln.mp3?v=113');
[...map1AppleShakeSounds,map1ToadPickupSound].forEach(a=>{a.preload='auto';a.volume=1;});
let map1AppleSoundBag=[],map1AppleEffects=null;
function nextMap1AppleShakeSound(){
  if(!map1AppleSoundBag.length){
    map1AppleSoundBag=[...map1AppleShakeSounds];
    for(let i=map1AppleSoundBag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[map1AppleSoundBag[i],map1AppleSoundBag[j]]=[map1AppleSoundBag[j],map1AppleSoundBag[i]];}
  }
  return map1AppleSoundBag.pop();
}
function stopMap1AppleShakeEffects(){
  const fx=map1AppleEffects;if(!fx)return;
  map1AppleEffects=null;
  gameClearTimeout(fx.stopTimer);gameClearTimeout(fx.leafTimer);gameClearTimeout(fx.extraTimer);
  for(const sound of map1AppleShakeSounds){sound.onended=null;sound.pause();sound.currentTime=0;gamePausedAudio.delete(sound);}
  map1AppleExtraSound.pause();map1AppleExtraSound.currentTime=0;gamePausedAudio.delete(map1AppleExtraSound);
  fx.leaves.remove();
}
function startMap1AppleShakeEffects(){
  stopMap1AppleShakeEffects();
  const state=map1AppleShake;if(!state)return;
  const leaves=document.createElement('div');
  Object.assign(leaves.style,{position:'absolute',left:'0',top:'0',width:'100%',height:'100%',pointerEvents:'none',overflow:'visible',zIndex:'503'});
  world.appendChild(leaves);
  const fx={leaves,stopTimer:0,leafTimer:0,extraTimer:0};map1AppleEffects=fx;
  const playNext=()=>{
    if(map1AppleEffects!==fx||!map1AppleShake||gameNow()-state.start>=3000)return;
    const sound=nextMap1AppleShakeSound();sound.pause();sound.currentTime=0;
    sound.onended=playNext;sound.play().catch(()=>{});
  };
  const emitLeaves=()=>{
    if(map1AppleEffects!==fx||!map1AppleShake)return;
    const remaining=3000-(gameNow()-state.start);if(remaining<=0)return;
    const tree=state.tree;
    burstMap1TreeLeaves({leaves,originX:px(tree,'left')+tree.offsetWidth*.5,originY:px(tree,'top')+tree.offsetHeight*.24,durationLimit:remaining});
    fx.leafTimer=gameSetTimeout(emitLeaves,350);
  };
  fx.stopTimer=gameSetTimeout(stopMap1AppleShakeEffects,Math.max(0,3000-(gameNow()-state.start)));
  fx.extraTimer=gameSetTimeout(()=>{
    if(map1AppleEffects!==fx||!map1AppleShake||gameNow()-state.start>=3000)return;
    map1AppleExtraSound.pause();map1AppleExtraSound.currentTime=0;map1AppleExtraSound.play().catch(()=>{});
  },Math.max(0,1000-(gameNow()-state.start)));
  playNext();emitLeaves();
}

function map1AppleSprite(){return collisionSprites.find(s=>s.el.id==='apfelbaum');}
function startMap1AppleShake(){
  if(map1AppleShake)return true; // Leertaste während der Aktion verbrauchen.
  if(gamePaused||mapTransitioning||map1GameOverStarted||map1TableServing||map2BarServing||map1TreeHiding||map1TreeTransitioning)return false;
  const sp=map1AppleSprite();
  if(!map1AppleDockedFromBelow(sp))return false;
  const tree=sp.el;
  if(!map1AppleShakeEl){
    map1AppleShakeEl=document.createElement('img');map1AppleShakeEl.src=MAP1_APPLE_SHAKE_IMAGE;
    map1AppleShakeEl.alt='';map1AppleShakeEl.draggable=false;
    Object.assign(map1AppleShakeEl.style,{position:'absolute',maxWidth:'none',pointerEvents:'none',transformOrigin:'50% 100%'});
    world.appendChild(map1AppleShakeEl);
  }
  // Sichtbare Höhe des aktuellen W-Sprites, nicht die Breite des neuen Bildes, bestimmt die Größe.
  const cached=PLAYER_IMAGE_CACHE.get(playerSpritePath('back',PLAYER.frame));
  let visibleRatio=1;
  if(cached&&cached.naturalWidth&&cached.naturalHeight){
    try{
      const canvas=document.createElement('canvas');canvas.width=cached.naturalWidth;canvas.height=cached.naturalHeight;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(cached,0,0);
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let first=-1,last=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>=24){if(first<0)first=y;last=y;break;}
      if(first>=0)visibleRatio=(last-first+1)/canvas.height;
    }catch(_){}
  }
  const height=playerWorldHeight()*visibleRatio*.65*1.10; // v113: gegenüber v112 exakt 10 % größer
  map1AppleShake={start:gameNow(),tree,treeTransform:tree.style.transform,playerVisibility:player.style.visibility,x:PLAYER.x,y:PLAYER.y};
  Object.assign(map1AppleShakeEl.style,{display:'block',height:`${height}px`,width:'auto',left:`${PLAYER.x}px`,top:`${PLAYER.y}px`});
  PLAYER.moving=false;PLAYER.frameClock=0;player.style.visibility='hidden';
  startMap1AppleShakeEffects();
  updateMap1AppleShake(gameNow());return true;
}
function updateMap1AppleShake(now){
  const state=map1AppleShake;if(!state)return;
  if(now-state.start>=3000){
    stopMap1AppleShakeEffects();
    state.tree.style.transform=state.treeTransform;
    player.style.visibility=state.playerVisibility;
    map1AppleShakeEl.style.display='none';map1AppleShake=null;
    showPlayerFrame(true);playerLastTime=now;
    if(Math.random()<.5)dropMap1Apple(now);
    return;
  }
  const shift=Math.sin((now-state.start)/1000*Math.PI*2*7)*1.5;
  state.tree.style.transform=`${state.treeTransform&&state.treeTransform!=='none'?state.treeTransform+' ':''}translateX(${shift}px)`;
  Object.assign(map1AppleShakeEl.style,{left:`${state.x+shift}px`,top:`${state.y}px`,transform:'translate(-50%,-100%)',zIndex:player.style.zIndex,visibility:currentMap===1?'visible':'hidden'});
}
function map1AppleCrownDropPoint(sp){
  // Nur deckende Kronenpixel oberhalb des Stamms, einschließlich der Nachbarpixel.
  const candidates=[];
  const step=Math.max(1,Math.floor(Math.min(sp.sourceW,sp.sourceH)/80));
  const pad=Math.max(1,Math.round(sp.sourceW*.015));
  for(let sy=Math.floor(sp.sourceH*.12);sy<sp.sourceH*.62;sy+=step){
    for(let sx=Math.floor(sp.sourceW*.12);sx<sp.sourceW*.88;sx+=step){
      if([[0,0],[pad,0],[-pad,0],[0,pad],[0,-pad]].every(([dx,dy])=>sp.alpha[(sy+dy)*sp.sourceW+sx+dx]>=24))candidates.push([sx,sy]);
    }
  }
  if(!candidates.length)return null;
  const [sx,sy]=candidates[Math.floor(Math.random()*candidates.length)];
  return {x:px(sp.el,'left')+(sx+.5)/sp.sourceW*sp.el.offsetWidth,y:px(sp.el,'top')+(sy+.5)/sp.sourceH*sp.el.offsetHeight};
}
function dropMap1Apple(now){
  const sp=map1AppleSprite();if(!sp)return;
  const from=map1AppleCrownDropPoint(sp);if(!from)return;
  const landY=px(sp.el,'top')+sp.el.offsetHeight+PLAYER.radius+8;
  const distance=3+Math.random()*3;
  let angle=Math.random()*Math.PI*2,dx=0,dy=0;
  // Rollbahn bleibt gerade und nutzt dieselben festen Weltkonturen wie der Spieler.
  for(let attempt=0;attempt<32;attempt++){
    const tx=Math.cos(angle)*distance,ty=Math.sin(angle)*distance;
    if([0,.25,.5,.75,1].every(t=>{const x=from.x+tx*t,y=landY+ty*t;return x>=6&&x<=WORLD_W-6&&y>=6&&y<=WORLD_H-6&&!collisionSprites.some(s=>circleHitsSpecificSprite(s,x,y,6));})){dx=tx;dy=ty;break;}
    angle+=Math.PI*2/32;
  }
  if(!dx&&!dy)return;
  const el=document.createElement('img');el.src=MAP1_APPLE_IMAGE;el.alt='';el.draggable=false;
  Object.assign(el.style,{position:'absolute',width:'13px',height:'auto',maxWidth:'none',pointerEvents:'none',transformOrigin:'50% 75%'});
  el.dataset.picked='0';el.dataset.landed='0';world.appendChild(el);
  map1Apples.push({el,start:now,from,landY,dx,dy,distance,x:from.x,y:landY,rotation:0});
}
function map1NearbyApple(){
  if(currentMap!==1||mapTransitioning||gamePaused||map1AppleShake)return null;
  let best=null,bestD=Infinity;
  for(const a of map1Apples){if(a.el.dataset.picked==='1'||a.el.dataset.landed!=='1')continue;const d=Math.hypot(PLAYER.x-a.x,PLAYER.y-a.y);if(d<=42&&d<bestD){best=a;bestD=d;}}
  return best;
}
function pickupMap1Apple(){
  const a=map1NearbyApple();if(!a)return false;
  a.el.dataset.picked='1';a.el.dataset.x=String(a.x);a.el.dataset.y=String(a.y);
  map1ApplesCollected++;showMap1MugPlusOne(a.el);a.el.remove();
  map1Apples.splice(map1Apples.indexOf(a),1);return true;
}
function map1AppleDepth(a){
  // Dieselben Prop-Effektzonen wie beim Wirt; dessen Fußlinie hat bei Gleichstand Vorrang.
  let behind=false;
  for(const s of collisionSprites){if(s.el.id==='apfelbaum'||s.el.id==='teich')continue;if(playerBehindSprite(s,a.x,a.y))behind=true;}
  const playerBehind=Number(player.style.zIndex)<=MAP1_PLAYER_BEHIND_Z;
  let z=behind?MAP1_PLAYER_BEHIND_Z-2:MAP1_PLAYER_FRONT_Z-2;
  if(behind===playerBehind)z=(Number(player.style.zIndex)||MAP1_PLAYER_FRONT_Z)+(PLAYER.y>=a.y?-1:1);
  const sp=map1AppleSprite();
  if(sp&&map1AppleCrownAt(sp,a.x,a.y))z=Math.min(z,Number(sp.el.style.zIndex)-1);
  a.el.style.zIndex=String(z);
}
function updateMap1Apples(now){
  updateMap1AppleShake(now);
  for(const a of map1Apples){
    const age=Math.max(0,now-a.start);
    let visualY;
    if(age<550){const t=age/550;a.x=a.from.x;a.y=a.landY;visualY=a.from.y+(a.landY-a.from.y)*t*t;}
    else if(age<750){const t=(age-550)/200;a.x=a.from.x;a.y=a.landY;visualY=a.landY-4*Math.sin(Math.PI*t);}
    else{const t=Math.min(1,(age-750)/450),ease=t*t*(3-2*t);a.x=a.from.x+a.dx*ease;a.y=a.landY+a.dy*ease;visualY=a.y;a.rotation=360*a.distance/(Math.PI*13)*ease;if(t===1)a.el.dataset.landed='1';}
    a.el.dataset.x=String(a.x);a.el.dataset.y=String(a.y);
    Object.assign(a.el.style,{left:`${a.x}px`,top:`${visualY}px`,transform:`translate(-50%,-100%) rotate(${a.rotation}deg)`,visibility:currentMap===1?'visible':'hidden'});
    map1AppleDepth(a);
    // Pendant zu playerBehindSprite mit eigenen Koordinaten, Baum bleibt vorm Kronenobjekt.
    if(age<550){const sp=map1AppleSprite();if(sp)a.el.style.zIndex=String(Number(sp.el.style.zIndex)+1);}
  }
  const near=map1NearbyApple();for(const a of map1Apples)a.el.style.filter=a===near?MAP1_LANDSCAPE_GLOW:'none';
}

/* v116: Philipp ausschließlich auf Taste 6, eigener Referenzpfad ohne Kollisionen. */
const MAP1_KING_IMAGES=['assets/npc/philipp-walk.png?v=116','assets/npc/philipp-gruss.png?v=116','assets/npc/philipp-sitz.png?v=116','assets/npc/philipp-danke.png?v=117','assets/npc/philipp-trinken.png?v=117',...[1,2,3].map(n=>`assets/npc/philipp-return-${n}.png?v=117`)];
const map1KingStandSound=new Audio('assets/audio/philipp-aufstehen.mp3?v=117');
const map1KingArrivalSound=new Audio('assets/audio/philipp-ankunft.mp3?v=116');
const map1KingGreetingSound=new Audio('assets/audio/philipp-gruss.mp3?v=116');
[map1KingArrivalSound,map1KingGreetingSound,map1KingStandSound].forEach(a=>{a.preload='auto';a.volume=1;});
let map1King=null,map1KingThought=null,map1KingActive=false,map1KingStage='idle',map1KingStart=0,map1KingGreetingAt=0,map1KingHeight=110;
let map1KingWaitStart=0,map1KingServiceWaitMs=0,map1KingReturnStart=0,map1KingMugTimer=0,map1KingDrinkTimer=0;
const MAP1_KING_SPEED=55,MAP1_KING_FRAME_MS=285;
const MAP1_KING_PATH=[[1475,1065],[1434.367,1018.247],[1422.861,1010.577],[1411.356,1001.948],[1399.85,993.318],[1388.345,984.689],[1376.839,976.06],[1365.333,968.39],[1353.828,959.76],[1342.322,951.131],[1330.816,942.502],[1319.311,933.873],[1307.805,926.202],[1296.3,917.573],[1284.794,908.944],[1273.288,901.273],[1261.783,892.644],[1250.277,884.974],[1238.772,876.345],[1227.266,868.674],[1215.76,861.004],[1204.255,853.333],[1192.749,846.622],[1181.243,838.951],[1169.738,832.24],[1158.232,826.487],[1146.727,819.775],[1135.221,814.981],[1123.715,809.228],[1112.21,804.434],[1100.704,799.64],[1089.199,793.888],[1077.693,789.094],[1066.187,784.3],[1054.682,776.629],[1043.176,768.959],[1031.67,761.288],[1020.165,753.139],[1008.659,745.948],[997.154,737.318],[985.648,729.648],[974.142,721.978],[962.637,714.307],[951.131,706.637],[939.625,699.925],[928.12,693.213],[916.614,686.502],[905.109,679.79],[893.603,674.996],[882.097,670.202],[870.592,665.408],[859.086,662.532],[847.581,659.655],[836.075,657.738],[824.569,655.82],[813.064,653.903],[801.558,652.944],[790.052,651.985],[768,647]];
const MAP1_KING_PATH_LENGTH=bockPathLength(MAP1_KING_PATH);
function ensureMap1King(){
  if(map1King)return map1King;
  map1King=document.createElement('img');map1King.id='map1KingPhilipp';map1King.alt='';map1King.draggable=false;
  Object.assign(map1King.style,{position:'absolute',height:'110px',width:'auto',maxWidth:'none',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'501'});
  world.appendChild(map1King);return map1King;
}
function ensureMap1KingThought(){
  if(map1KingThought)return map1KingThought;
  // Dieselbe Bierblase, Größen, Farben und Einblendung wie bei den bisherigen Gästen.
  const b=document.createElement('div');map1KingThought=b;
  Object.assign(b.style,{position:'absolute',width:'92.4px',height:'75.6px',pointerEvents:'none',display:'none',opacity:'0',transform:'scale(.72)',transformOrigin:'20% 90%',zIndex:'23000',transition:'opacity 260ms ease, transform 340ms cubic-bezier(.2,.9,.2,1)'});
  const cloud=document.createElement('div');Object.assign(cloud.style,{position:'absolute',left:'12px',top:'0',width:'80.4px',height:'61.2px',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'52% 48% 46% 54% / 48% 55% 45% 52%',boxShadow:'0 4px 12px rgba(0,0,0,.28)'});
  const beer=document.createElement('img');beer.src='assets/npc/bock-wunsch.png?v=38';beer.alt='';beer.draggable=false;
  Object.assign(beer.style,{position:'absolute',left:'50%',top:'50%',width:'45.6px',height:'45.6px',objectFit:'contain',transform:'translate(-50%,-50%)'});cloud.appendChild(beer);
  const c1=document.createElement('div'),c2=document.createElement('div');[c1,c2].forEach(c=>Object.assign(c.style,{position:'absolute',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'50%',boxSizing:'border-box'}));
  Object.assign(c1.style,{left:'2px',top:'62px',width:'9px',height:'9px'});Object.assign(c2.style,{left:'6px',top:'49px',width:'15px',height:'15px'});
  b.append(c1,c2,cloud);world.appendChild(b);return b;
}
function setMap1KingPose(index,mirror=false){
  const el=ensureMap1King(),src=MAP1_KING_IMAGES[index];if(el.getAttribute('src')!==src)el.src=src;
  const seated=index>=2&&index<=4;
  const height=seated?map1KingHeight*.94:map1KingHeight;
  if(seated){
    const chair=document.getElementById('stuhl'),foot=MAP1_KING_PATH.at(-1)[1];
    const seatY=chair?px(chair,'top')+chair.offsetHeight*.78:foot-map1KingHeight*.45;
    // Alle Sitzgesten bleiben mit der Hüfte auf derselben Stuhlsitzfläche.
    const hip=[.52,.46,.44][index-2];el.style.left=`${MAP1_KING_PATH.at(-1)[0]}px`;el.style.top=`${seatY+height*(1-hip)}px`;
  }
  const anchors=[.49,.61,.52,.60,.60,.5,.5,.5],ax=mirror?1-anchors[index]:anchors[index];
  Object.assign(el.style,{height:`${height}px`,width:'auto',transformOrigin:`${ax*100}% 100%`,transform:`translate(${-ax*100}%,-100%) scaleX(${mirror?-1:1})`});
}
function startMap1KingEvent(){
  if(currentMap!==1||mapTransitioning||gamePaused||map1GameOverStarted||map1KingActive)return false;
  ensureMap1PropDepthOrder();ensureMap1King();ensureMap1KingThought();
  map1KingWaitStart=map1KingServiceWaitMs=0;clearMap1KingTimers();
  map1KingActive=true;map1KingStage='arriving';map1KingStart=gameNow();
  // Normalgröße der W-Figur ohne Bier, unabhängig von momentanem Bier-/Richtungsstatus.
  const back=PLAYER_IMAGE_CACHE.get('assets/player/nobier-back-1.png?v=69');
  map1KingHeight=1.05*(back?.naturalWidth&&back?.naturalHeight?player.offsetWidth*1.10*back.naturalHeight/back.naturalWidth:playerWorldHeight());
  map1KingThought.style.display='none';map1KingThought.style.opacity='0';
  map1King.style.display='block';setMap1KingPose(0,false);updateMap1King(gameNow());
  map1KingArrivalSound.pause();map1KingArrivalSound.currentTime=0;map1KingArrivalSound.play().catch(()=>{});syncMap1RealGuestCount();return true;
}
function clearMap1KingTimers(){
  gameClearTimeout(map1KingMugTimer);gameClearTimeout(map1KingDrinkTimer);map1KingMugTimer=map1KingDrinkTimer=0;
}
function hideMap1KingThought(){
  if(!map1KingThought)return;map1KingThought.style.opacity='0';map1KingThought.style.transform='scale(.84)';
  gameSetTimeout(()=>{if(map1KingThought&&map1KingThought.style.opacity==='0')map1KingThought.style.display='none';},280);
}
function resolveMap1KingSatisfaction(unserved=false){
  const kind=unserved?'red':map1GuestEmotionKind(map1KingServiceWaitMs);
  showMap1GuestEmotion('tafel',kind);
  if(!unserved)dropMap1GuestMoney('tafel',kind,10);
  if(kind==='green')changeMap1Popularity(5);else if(kind==='red')changeMap1Popularity(-10);
}
function beginMap1KingReturn(){
  if(!map1KingActive||map1KingStage==='returning')return;
  clearMap1KingTimers();hideMap1KingThought();map1KingStage='returning';map1KingReturnStart=gameNow();
  const [x,y]=MAP1_KING_PATH.at(-1);map1King.style.left=`${x}px`;map1King.style.top=`${y}px`;setMap1KingPose(5);
  if(currentMap===1){map1KingStandSound.pause();map1KingStandSound.currentTime=0;map1KingStandSound.play().catch(()=>{});}
}
function finishMap1King(){
  clearMap1KingTimers();map1KingActive=false;map1KingStage='idle';map1King.style.display='none';
  if(map1KingThought){map1KingThought.style.opacity='0';map1KingThought.style.display='none';}
  syncMap1RealGuestCount();
}
function map1KingBeerServed(table,mug){
  if(!map1KingActive||map1KingStage!=='seated'||table?.el?.id!=='tafel')return false;
  hideMap1KingThought();map1KingServiceWaitMs=Math.max(0,gameNow()-map1KingWaitStart);map1KingStage='beerOnTable';setMap1KingPose(3);
  map1KingMugTimer=gameSetTimeout(()=>{
    map1KingMugTimer=0;if(!map1KingActive||map1KingStage!=='beerOnTable')return;
    if(mug?.isConnected)mug.style.display='none';map1KingStage='drinking';setMap1KingPose(4);
    map1KingDrinkTimer=gameSetTimeout(()=>{
      map1KingDrinkTimer=0;if(!map1KingActive||map1KingStage!=='drinking')return;
      if(mug?.isConnected){
        mug.src='assets/npc/gast-krug-leer.png?v=92';mug.style.display='block';mug.style.filter='none';
        mug.dataset.guestEmpty='1';mug.dataset.picked='0';mug.dataset.landed='1';
        mug.dataset.x=String(parseFloat(mug.style.left)||0);mug.dataset.y=String(parseFloat(mug.style.top)||0);
      }
      resolveMap1KingSatisfaction(false);beginMap1KingReturn();
    },3000);
  },2000);
  return true;
}
function updateMap1King(now){
  if(!map1KingActive)return;
  const el=ensureMap1King(),visible=currentMap===1;
  el.style.visibility=visible?'visible':'hidden';
  if(map1KingStage==='arriving'){
    const t=Math.min(1,(now-map1KingStart)/(MAP1_KING_PATH_LENGTH/MAP1_KING_SPEED*1000));
    const [x,y]=t===1?MAP1_KING_PATH.at(-1):map1GuestPointOnPath(MAP1_KING_PATH,t);el.style.left=`${x}px`;el.style.top=`${y}px`;
    setMap1KingPose(0,Math.floor((now-map1KingStart)/MAP1_KING_FRAME_MS)%2===1);
    if(t===1){map1KingStage='greeting';map1KingGreetingAt=now;setMap1KingPose(1,false);if(visible){map1KingGreetingSound.pause();map1KingGreetingSound.currentTime=0;map1KingGreetingSound.play().catch(()=>{});}}
  }else if(map1KingStage==='greeting'&&now-map1KingGreetingAt>=2000){
    map1KingStage='seated';map1KingWaitStart=now;setMap1KingPose(2,false);
    const mug=map1ExistingFullTableMug('tafel');
    if(mug)map1KingBeerServed(tableSpriteById('tafel'),mug);
    else{
      const b=ensureMap1KingThought();b.style.display='block';b.style.opacity='0';b.style.transform='scale(.72)';
      gameRequestAnimationFrame(()=>gameRequestAnimationFrame(()=>{if(map1KingStage==='seated'){b.style.opacity='1';b.style.transform='scale(1)';}}));
    }
  }else if(map1KingStage==='seated'&&now-map1KingWaitStart>=90000){
    resolveMap1KingSatisfaction(true);beginMap1KingReturn();
  }else if(map1KingStage==='returning'){
    const t=Math.min(1,(now-map1KingReturnStart)/(MAP1_KING_PATH_LENGTH/MAP1_KING_SPEED*1000));
    const [x,y]=t===1?MAP1_KING_PATH[0]:map1GuestPointOnPath(MAP1_KING_PATH,1-t);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    const sequence=[5,7,6,7];setMap1KingPose(sequence[Math.floor((now-map1KingReturnStart)/MAP1_KING_FRAME_MS)%sequence.length]);
    if(t===1)finishMap1King();
  }
  if(map1KingThought.style.display!=='none'){
    map1KingThought.style.left=`${parseFloat(el.style.left)+18}px`;
    map1KingThought.style.top=`${parseFloat(el.style.top)-parseFloat(el.style.height)-82}px`;
    map1KingThought.style.visibility=visible?'visible':'hidden';
  }
}
function syncMap1KingDepth(){
  if(!map1KingActive||currentMap!==1)return;
  const table=document.getElementById('tafel'),chair=document.getElementById('stuhl');
  const chairZ=Number(chair?.style.zIndex)||MAP1_PROP_DEPTH_Z;
  map1King.style.zIndex=String(chairZ+1);
  if(table)table.style.zIndex=String(chairZ+2);
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
  updateMap1Event4(now);
  updateMap1Event5(now);
  updateMap1Guest(now);
  updateMap1Woman(now);
  updateMap1King(now);
  syncMap1NpcPlayerDepth();
  syncMap1KingDepth();
  syncMap1LandscapeDepth();
  updateMap1Toad(now);
  updateMap1Apples(now);
  updateMap1BockInteractionCue();
  updateMap1TreeInteractionCue();
  if(map1TreeHideImage && map1TreeHiding)syncMap1TreeHideImagePosition();
  updateMap1BockMugCue();
  updateMap1GuestEmptyMugCue();
  updateMap1MoneyCue();
  syncMap1EventVisibility();
  syncMap1Scribe();
  syncEventAudioForCurrentMap();
rafId=gameRequestAnimationFrame(draw);
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
    if(map1EventMusicIsActive()||map1Popularity>=90){syncMap1Popularity90Song();return;}
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
let playerLastTime=gameNow();

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
    const supportStart=Math.floor(s.sourceH*(.68+(1-.68)/3)); // v96: Rest-Hitbox von oben um 1/3 gekürzt; Tiefeneffekt folgt exakt derselben Linie
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
/* v109: nur die Spielfigur erhält vier zusätzliche Weltpixel Tischdurchgang.
   Die gemeinsame Prop-/NPC-Hitbox bleibt unverändert; unten bleibt eine feste Kante. */
function map1PlayerTablePassage(s,x,y){
  if(currentMap!==1||!STANDING_TABLE_IDS.has(s.el.id))return furnitureTopPassage(s,x,y);
  const p=spriteLocalPoint(s,x,y);if(!p)return false;
  const start=Math.floor(s.sourceH*(.68+(1-.68)/3));
  const edge=Math.min(p.top+p.dh-1,p.top+start/s.sourceH*p.dh+4);
  return y<edge;
}
function map1PlayerPointBlocked(x,y,skipPond=false){
  return collisionSprites.some(s=>{
    if(skipPond&&s.el.id==='teich')return false;
    if(map1PlayerTablePassage(s,x,y))return false;
    return pointHitsSprite(s,x,y);
  });
}
function map1PlayerCircleBlocked(x,y,r){
  if(map1PlayerPointBlocked(x,y))return true;
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;if(map1PlayerPointBlocked(x+Math.cos(a)*r,y+Math.sin(a)*r,true))return true;}
  return false;
}
function playerBehindSprite(sprite,x=PLAYER.x,y=PLAYER.y){
  /* v57 Baum-Minifix:
     Der Baum darf den Ebenenwechsel nur EINMAL auslösen. Die bisherige breite
     5-Punkt-Fußprobe konnte an der Baumkontur mehrere Probes nacheinander
     ein-/austreten lassen -> sichtbar / verdeckt / sichtbar / verdeckt.
     Für den Baum deshalb exakt EIN stabiler Fußpunkt. Effektgrenze, Baumposition
     und Stamm-Hitbox bleiben unverändert. */
  if(sprite?.el?.id==='baum'){
    return propRatioPassage(sprite,x,y);
  }

  const r=Math.max(5,PLAYER.radius*.72);
  const probes=[[0,0],[-r,0],[r,0],[-r*.55,-2],[r*.55,-2]];
  return probes.some(([ox,oy])=>
    map1PlayerTablePassage(sprite,x+ox,y+oy) ||
    propRatioPassage(sprite,x+ox,y+oy)
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
        if(rawSpriteOpaqueAt(s,x,y) && !map1PlayerTablePassage(s,x,y)){
          hitboxTop=Math.min(hitboxTop,y);
          break;
        }
      }
    }
    if(!Number.isFinite(hitboxTop))return false;
    // Mini-Toleranz NACH OBEN: sobald der Fußkreis direkt an der echten Hitbox anliegt.
    const playerBottom=PLAYER.y+r;
    const topTolerance=2; // v109: nur direkter S-Kontakt von oben
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

function map1TableHasFullBeer(id){
  const mug=map1TableMugs.get(id);
  return !!(mug?.isConnected&&mug.style.display!=='none'&&mug.dataset.guestEmpty!=='1'&&mug.dataset.picked!=='1');
}
function map1InteractiveTable(){
  if(currentMap!==1||mapTransitioning||map1TableServing||!playerHasBeer)return null;

  // v97: Freie Bedienreihenfolge. Ein Gast sperrt NUR exakt seine eigene Tischseite;
  // alle anderen Seiten und alle anderen Tische bleiben jederzeit zum Vorab-Abstellen frei.
  const tafel=map1InteractiveTafel();
  if(tafel&&!map1TableHasFullBeer('tafel'))return tafel;

  for(const id of STANDING_TABLE_IDS){
    const s=tableSpriteById(id); if(!s)continue;
    if(map1TableHasFullBeer(id))continue; // pro Tisch steht maximal ein voller Krug bereit
    if(map1GuestOccupiesRightTable()&&id==='stehtischRechts'&&PLAYER.direction==='front')continue;
    if(map1WomanOccupiesLeftTable()&&id==='stehtischLinks'&&PLAYER.direction==='right')continue;
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
  // Jeder neue Ausschank ist wieder ein VOLLER Krug; ein eventuell vom Gast
  // zurückgelassener leerer Krug wird dadurch am selben Platz ersetzt.
  // Wiederverwendeter Tischkrug: alte Pickup-/Fade-Animationen des vorigen Gasts
  // vollständig lösen, damit der volle Krug beim nächsten Servieren sicher sichtbar ist.
  try{mug.getAnimations().forEach(a=>a.cancel());}catch(_){}
  mug.src='assets/npc/bock-wunsch.png?v=38';
  mug.dataset.guestEmpty='0';mug.dataset.picked='0';mug.style.filter='none';mug.style.opacity='1';
  mug.style.transform='translate(-50%,-100%)';
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
  playLoudInteractionSound(map1TablePutDownSound);
  player.style.zIndex=(dir==='front')?String(MAP1_PLAYER_BEHIND_Z):'1000'; // v50: S-Ausschank bleibt hinter dem Tisch; A/D/W unverändert
  const scale=playerVisualScale();
  // A ist als eigenes, physisch gespiegeltes D-Asset enthalten; deshalb hier keine zweite Spiegelung.
  player.style.transform=`translate(-50%,-100%) scale(${scale})`;
  gameClearTimeout(map1TableServeTimer);
  map1TableServeTimer=gameSetTimeout(()=>{
    const servedMug=ensureTableMug(table);
    map1GuestBeerServed(table,servedMug);
    map1WomanBeerServed(table,servedMug);
    map1KingBeerServed(table,servedMug);
    map1TableServing=false;
    playerHasBeer=false;
    PLAYER.sequenceIndex=0; PLAYER.frameClock=0; PLAYER.frame=activePlayerSequence(PLAYER.direction)[0];
    showPlayerFrame(true);
    updateStandingTableDepth();
    updateMap1TableInteractionCue();
  },MAP1_TABLE_ACTION_MS);
  return true;
}




/* v98 – Gästezufriedenheit: kleine Masken steigen zentral von der Tischplatte auf.
   Zeit/Fade entsprechen der bestehenden Beliebtheitsanzeige am Schreiber. */
const MAP1_GUEST_EMOTION_IMAGES={
  green:'assets/npc/gast-emotion-gruen.png?v=98',
  yellow:'assets/npc/gast-emotion-gelb.png?v=98',
  red:'assets/npc/gast-emotion-rot.png?v=98'
};
/* v114: Zahlungen übernehmen exakt die Emotionswertung des bedienten Gasts. */
const MAP1_COIN_IMAGES=[1,2,3].map(n=>`assets/props/kupfer-${n}.png?v=114`);
const MAP1_COIN_WIDTHS=[11.0, 15.076, 16.9572]; // gemeinsamer Maßstab für die ausgeschnittenen Münzen
const MAP1_COIN_ANCHORS=[[.503001343,.506003426],[.496367159,.502770802],[.495100518,.544426940]]; // v115: Mittelpunkt der sichtbaren Alpha-Fläche
const map1MoneySounds=[1,2,3].map(n=>new Audio(`assets/audio/geld-${n}.mp3?v=114`));
map1MoneySounds.forEach(a=>{a.preload='auto';a.volume=1;});
const map1GuestMoney=[];
let map1MoneyTotal=0;
function dropMap1GuestMoney(tableId,kind,valueMultiplier=1){
  const table=document.getElementById(tableId),mug=map1TableMugs.get(tableId);
  if(!table||!mug?.isConnected||mug.dataset.guestEmpty!=='1')return;
  const count=kind==='green'?3:kind==='yellow'?2:1;
  const el=document.createElement('img');el.src=MAP1_COIN_IMAGES[count-1];el.alt='';el.draggable=false;
  const x=px(table,'left')+table.offsetWidth*.5,y=tableId==='tafel'?parseFloat(mug.style.top)+10:px(table,'top')+table.offsetHeight*.23+10;
  const [anchorX,anchorY]=MAP1_COIN_ANCHORS[count-1];
  Object.assign(el.style,{position:'absolute',left:`${x}px`,top:`${y}px`,width:`${MAP1_COIN_WIDTHS[count-1]}px`,height:'auto',maxWidth:'none',transform:`translate(${-anchorX*100}%,${-anchorY*100}%)`,pointerEvents:'none',zIndex:String((Number(mug.style.zIndex)||750)+1)});
  el.dataset.x=String(x);el.dataset.y=String(y);el.dataset.picked='0';
  world.appendChild(el);map1GuestMoney.push({el,count,value:count*valueMultiplier,x,y,tableId,mug});
}
function map1NearbyMoney(){
  if(currentMap!==1||mapTransitioning||gamePaused)return null;
  let best=null,bestD=Infinity;
  for(const money of map1GuestMoney){const d=Math.hypot(PLAYER.x-money.x,PLAYER.y-money.y);if(money.el.isConnected&&money.el.dataset.picked!=='1'&&d<=42&&d<bestD){best=money;bestD=d;}}
  return best;
}
function updateMap1MoneyCue(){
  const near=map1NearbyMoney();
  for(const money of map1GuestMoney){money.el.style.visibility=currentMap===1?'visible':'hidden';money.el.style.filter=money===near?MAP1_LANDSCAPE_GLOW:'none';money.el.style.zIndex=String((Number(money.mug.style.zIndex)||750)+1);}
}
function showMap1MoneyAtScribe(count,value=count){
  const scribe=ensureMap1Scribe(),fx=document.createElement('div');
  Object.assign(fx.style,{position:'absolute',left:'50%',top:'-6px',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px',pointerEvents:'none',zIndex:'30000',opacity:'0',transform:'translate(-50%,-100%)'});
  const coin=document.createElement('img');coin.src=MAP1_COIN_IMAGES[count-1];coin.alt='';coin.draggable=false;
  Object.assign(coin.style,{width:`${MAP1_COIN_WIDTHS[count-1]*1.8}px`,height:'auto',maxWidth:'none',pointerEvents:'none'});
  const plus=document.createElement('div');plus.textContent=`+${value}`;
  Object.assign(plus.style,{font:'700 22px/1 sans-serif',color:'#b87333',textShadow:'0 2px 3px rgba(0,0,0,.8)',whiteSpace:'nowrap'});
  fx.append(coin,plus);scribe.appendChild(fx);map1MoneyTotal+=value;
  fx.animate([{opacity:0,transform:'translate(-50%,-90%)'},{opacity:1,transform:'translate(-50%,-100%)',offset:.18},{opacity:1,transform:'translate(-50%,-120%)',offset:.65},{opacity:0,transform:'translate(-50%,-145%)'}],{duration:1500,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>fx.remove(),1500);
}
function pickupMap1Money(){
  const money=map1NearbyMoney();if(!money)return false;
  money.el.dataset.picked='1';money.el.remove();map1GuestMoney.splice(map1GuestMoney.indexOf(money),1);
  const sound=map1MoneySounds[money.count-1];sound.pause();sound.currentTime=0;sound.play().catch(()=>{});
  showMap1MoneyAtScribe(money.count,money.value??money.count);return true;
}

function showMap1GuestEmotion(tableId,kind){
  const table=document.getElementById(tableId),src=MAP1_GUEST_EMOTION_IMAGES[kind];
  if(!table||!src)return;
  // v99: Effekt in GAME statt WORLD. Dadurch bleibt eine bereits gestartete Maske auch
  // während/nach einem Türwechsel sichtbar und wird nicht mit Map-1-Visuals ausgeblendet.
  const tr=table.getBoundingClientRect(),gr=game.getBoundingClientRect();
  const sx=table.offsetWidth?tr.width/table.offsetWidth:1;
  const sy=table.offsetHeight?tr.height/table.offsetHeight:sx;
  const fx=document.createElement('img');fx.src=src;fx.alt='';fx.draggable=false;
  Object.assign(fx.style,{
    position:'absolute',left:`${tr.left-gr.left+tr.width/2}px`,top:`${tr.top-gr.top}px`,
    width:`${28.8*sx}px`,height:'auto', // exakt 40 % kleiner als bisherige 48 Weltpixel
    transform:'translate(-50%,0)',pointerEvents:'none',userSelect:'none',zIndex:'80000',opacity:'1'
  });
  game.appendChild(fx);
  fx.animate([
    {transform:'translate(-50%,0) scale(.82)',opacity:1},
    {transform:`translate(-50%,${-72*sy}px) scale(1)`,opacity:1,offset:.62},
    {transform:`translate(-50%,${-128*sy}px) scale(.92)`,opacity:0}
  ],{duration:2800,easing:'ease-out',fill:'forwards'});
  gameSetTimeout(()=>fx.remove(),2850);
}
function map1GuestEmotionKind(waitMs){return waitMs<30000?'green':waitMs<60000?'yellow':'red';}
function resolveMap1GuestSatisfaction(tableId,waitMs,unserved=false){
  const kind=unserved?'red':map1GuestEmotionKind(waitMs);
  showMap1GuestEmotion(tableId,kind);
  if(!unserved)dropMap1GuestMoney(tableId,kind);
  if(unserved)changeMap1Popularity(-2);
  else if(kind==='green')changeMap1Popularity(1);
  else if(kind==='yellow'){} // v100: neutral/gelb = ausdrücklich KEINE Beliebtheitsänderung
  else if(kind==='red')changeMap1Popularity(-1);
}

/* MAP 1 – ERSTE ECHTE GÄSTE v93: Bauer am rechten Stehtisch.
   Zwei Varianten teilen sich denselben Slot und können NIEMALS gleichzeitig existieren:
   SCHNELL: 50 % Versuch alle 30 s. LANGSAM: 50 % Versuch alle 60 s.
   Normale Gäste nur ab 50 Beliebtheit; fällt sie darunter, kehrt ein aktiver Bauer um. */
let map1GuestEl=null,map1GuestThought=null;
let map1GuestActive=false,map1GuestVariant='fast',map1GuestStage='idle';
let map1GuestPath=[],map1GuestStart=0,map1GuestDuration=0,map1GuestReturnStart=0,map1GuestReturnDuration=0;
let map1GuestFastInterval=0,map1GuestSlowInterval=0,map1GuestDrinkTimer=0,map1GuestMugTimer=0;
let map1GuestWaitStart=0,map1GuestServiceWaitMs=0;
const MAP1_GUEST_WIDTH=100.8; // v96: Bauer generell +5 %
const MAP1_GUEST_FAST_DURATION=7600;
const MAP1_GUEST_SLOW_DURATION=19000;
const MAP1_GUEST_FAST_FRAME_MS=285; // v101: nur Bildwechsel verlangsamt; Laufgeschwindigkeit bleibt unverändert
const MAP1_GUEST_SLOW_FRAME_MS=285; // v101: langsamer Bauer ebenfalls ruhigerer Bildwechsel; Bewegung bleibt 19 s langsam
const MAP1_GUEST_INTERACT_DISTANCE=92;

function ensureMap1Guest(){
  if(map1GuestEl)return map1GuestEl;
  map1GuestEl=document.createElement('img');map1GuestEl.id='map1GuestFarmer';
  // Normaler Schankgast ist KEIN Event-Bauer und darf niemals Event-3/5-Kollisionen auslösen.
  map1GuestEl.dataset.npcRole='normalGuest';
  map1GuestEl.src='assets/npc/gast-bauer-front-1.png?v=92';map1GuestEl.alt='';map1GuestEl.draggable=false;
  Object.assign(map1GuestEl.style,{position:'absolute',left:'0',top:'0',width:`${MAP1_GUEST_WIDTH}px`,height:'auto',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'12500',willChange:'left,top,transform,filter'});
  const syncGuestSize=()=>{const w=player?.offsetWidth||parseFloat(getComputedStyle(player).width)||MAP1_GUEST_WIDTH;map1GuestEl.style.width=`${w*1.05}px`;};syncGuestSize();gameRequestAnimationFrame(syncGuestSize);
  world.appendChild(map1GuestEl);return map1GuestEl;
}
function ensureMap1GuestThought(){
  if(map1GuestThought)return map1GuestThought;
  map1GuestThought=document.createElement('div');
  Object.assign(map1GuestThought.style,{position:'absolute',width:'92.4px',height:'75.6px',pointerEvents:'none',display:'none',opacity:'0',transform:'scale(.72)',transformOrigin:'20% 90%',zIndex:'23000',transition:'opacity 260ms ease, transform 340ms cubic-bezier(.2,.9,.2,1)'});
  const cloud=document.createElement('div');Object.assign(cloud.style,{position:'absolute',left:'12px',top:'0',width:'80.4px',height:'61.2px',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'52% 48% 46% 54% / 48% 55% 45% 52%',boxShadow:'0 4px 12px rgba(0,0,0,.28)'});
  const beer=document.createElement('img');beer.src='assets/npc/bock-wunsch.png?v=38';beer.alt='';beer.draggable=false;Object.assign(beer.style,{position:'absolute',left:'50%',top:'50%',width:'45.6px',height:'45.6px',objectFit:'contain',transform:'translate(-50%,-50%)'});cloud.appendChild(beer);
  const c1=document.createElement('div'),c2=document.createElement('div');[c1,c2].forEach(c=>Object.assign(c.style,{position:'absolute',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'50%',boxSizing:'border-box'}));Object.assign(c1.style,{left:'2px',top:'62px',width:'9px',height:'9px'});Object.assign(c2.style,{left:'6px',top:'49px',width:'15px',height:'15px'});
  map1GuestThought.append(c1,c2,cloud);world.appendChild(map1GuestThought);return map1GuestThought;
}
function map1GuestDockPoint(){
  const el=document.getElementById('stehtischRechts');
  if(!el)return [1130,470];
  const left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  // Gast kommt von OBEN und steht hinter der Tischplatte. Die Fußlinie liegt knapp in der oberen Tischzone.
  return [left+w*.50,top+h*(.68+(1-.68)/3)]; // v96: Fußlinie dockt exakt an die neue obere Rest-Hitboxkante an; Bauer bleibt hinter dem Tisch
}
function sampleMap1GuestArrivalPath(){
  const dock=map1GuestDockPoint();
  // Zunächst EXAKT die bestehende obere Laufroute, dann ein weicher kubischer Bogen zum rechten Stehtisch.
  const pts=MAP1_RUNNER_PATH.slice(0,5).map(p=>[p[0],p[1]]);
  const a=pts[pts.length-1],c1=[a[0]-18,a[1]+48],c2=[dock[0]-10,dock[1]-95];
  for(let i=1;i<=12;i++){
    const t=i/12,u=1-t;
    pts.push([u*u*u*a[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t*t*t*dock[0],u*u*u*a[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t*t*t*dock[1]]);
  }
  return pts;
}
function map1GuestPointOnPath(pts,t){
  const lens=[];let total=0;for(let i=0;i<pts.length-1;i++){const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);lens.push(l);total+=l;}
  let d=Math.max(0,Math.min(1,t))*total;
  for(let i=0;i<lens.length;i++){if(d<=lens[i]||i===lens.length-1){const q=lens[i]?d/lens[i]:0;return[pts[i][0]+(pts[i+1][0]-pts[i][0])*q,pts[i][1]+(pts[i+1][1]-pts[i][1])*q];}d-=lens[i];}
  return pts[pts.length-1];
}
function map1GuestPerspective(y){return 1.10;} // Breite bereits +5 %; bestehende Perspektive bleibt unverändert
const map1GuestFootAnchorCache=new Map();
function map1GuestAlphaFootAnchor(img){
  const key=img.currentSrc||img.src;if(map1GuestFootAnchorCache.has(key))return map1GuestFootAnchorCache.get(key);
  let anchor={x:.5,y:1};
  try{
    const c=document.createElement('canvas'),w=img.naturalWidth,h=img.naturalHeight;if(!w||!h)return anchor;
    c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
    const d=ctx.getImageData(0,0,w,h).data;let bottom=-1;
    for(let y=h-1;y>=0&&bottom<0;y--)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>24){bottom=y;break;}
    if(bottom>=0){
      const bandTop=Math.max(0,bottom-Math.max(2,Math.round(h*.035)));let minX=w,maxX=-1;
      for(let y=bandTop;y<=bottom;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>24){if(x<minX)minX=x;if(x>maxX)maxX=x;}
      if(maxX>=minX)anchor={x:((minX+maxX)/2)/w,y:bottom/h};
    }
  }catch(_){ }
  map1GuestFootAnchorCache.set(key,anchor);return anchor;
}
function setMap1GuestFrame(src,mirror=false,scale=1){
  const el=ensureMap1Guest();
  const apply=()=>{
    // v101: Jeder Lauf-PNG wird an seinem echten Alpha-Fußpunkt verankert. Dadurch liegen die Füße
    // frameübergreifend auf derselben Weltposition statt dass unterschiedlich beschnittene PNGs links/rechts springen.
    const a=map1GuestAlphaFootAnchor(el),ax=mirror?1-a.x:a.x;
    const poseScale=src.includes('gast-bauer-order-')?scale*1.05:scale;
    el.style.transformOrigin=`${ax*100}% ${a.y*100}%`;
    el.style.transform=`translate(${-ax*100}%,${-a.y*100}%) scale(${poseScale})${mirror?' rotateY(180deg)':''}`;
  };
  if((el.getAttribute('src')||'')!==src){el.onload=()=>{el.onload=null;apply();};el.src=src;if(el.complete&&el.naturalWidth){el.onload=null;apply();}}
  else apply();
}
function map1GuestOccupiesRightTable(){return map1GuestActive&&['ordering','waitingBeer','beerOnTable','drinking'].includes(map1GuestStage);}
function showMap1GuestThought(){
  const b=ensureMap1GuestThought(),[x,y]=map1GuestDockPoint();b.style.left=`${x+18}px`;b.style.top=`${y-204}px`;b.style.display='block';b.style.opacity='0';b.style.transform='scale(.72)';gameRequestAnimationFrame(()=>gameRequestAnimationFrame(()=>{if(map1GuestStage==='waitingBeer'){b.style.opacity='1';b.style.transform='scale(1)';}}));
}
function hideMap1GuestThought(){if(map1GuestThought){map1GuestThought.style.opacity='0';map1GuestThought.style.transform='scale(.84)';gameSetTimeout(()=>{if(map1GuestThought&&map1GuestThought.style.opacity==='0')map1GuestThought.style.display='none';},280);}}
function map1GuestCanTakeOrder(){return false;} // v98: Bestellung startet automatisch beim Andocken; keine Nähe-/Leuchtinteraktion mehr.
function takeMap1GuestOrder(){return false;}
function updateMap1GuestCue(){if(map1GuestEl)map1GuestEl.style.filter='none';}
function clearMap1GuestTimers(){gameClearTimeout(map1GuestDrinkTimer);gameClearTimeout(map1GuestMugTimer);map1GuestDrinkTimer=map1GuestMugTimer=0;}
function beginMap1GuestReturn(){
  if(!map1GuestActive||map1GuestStage==='returning')return;
  hideMap1GuestThought();clearMap1GuestTimers();map1GuestStage='returning';map1GuestReturnStart=gameNow();
  const full=sampleMap1GuestArrivalPath();const x=parseFloat(map1GuestEl.style.left),y=parseFloat(map1GuestEl.style.top);
  // Bei Beliebtheitsabfall auch vom aktuellen Platz aus sauber auf denselben Weg zurück.
  let nearest=full.length-1,best=Infinity;for(let i=0;i<full.length;i++){const d=Math.hypot(full[i][0]-x,full[i][1]-y);if(d<best){best=d;nearest=i;}}
  map1GuestPath=[[x,y],...full.slice(0,nearest+1).reverse()];
  const frac=Math.max(.28,map1GuestPath.length/full.length);map1GuestReturnDuration=(map1GuestVariant==='fast'?MAP1_GUEST_FAST_DURATION:MAP1_GUEST_SLOW_DURATION)*frac;
}
function finishMap1Guest(){
  map1GuestActive=false;map1GuestStage='idle';hideMap1GuestThought();clearMap1GuestTimers();if(map1GuestEl){map1GuestEl.style.display='none';map1GuestEl.style.filter='none';}syncMap1RealGuestCount();
}
function spawnMap1Guest(variant){
  if(map1GuestActive||map1GameOverStarted||map1Popularity<50||currentMap!==1)return false;
  const el=ensureMap1Guest();map1GuestActive=true;map1GuestVariant=variant;map1GuestStage='arriving';map1GuestPath=sampleMap1GuestArrivalPath();map1GuestStart=gameNow();map1GuestDuration=variant==='fast'?MAP1_GUEST_FAST_DURATION:MAP1_GUEST_SLOW_DURATION;
  el.style.display='block';el.style.visibility='visible';el.style.filter='none';const [x,y]=map1GuestPath[0];el.style.left=`${x}px`;el.style.top=`${y}px`;syncMap1RealGuestCount();return true;
}
function trySpawnMap1Guest(variant){if(map1GuestActive||map1Popularity<50||map1GameOverStarted)return;if(Math.random()<.5)spawnMap1Guest(variant);}
function scheduleMap1GuestSpawnAttempt(variant){
  const windowMs=variant==='fast'?30000:60000;
  // Versuch liegt jedes Mal ZUFÄLLIG innerhalb des neuen 30-/60-s-Fensters,
  // statt starr exakt auf Sekunde 30 bzw. 60 zu feuern. Die bestehende 50-%-Chance bleibt.
  const delay=1+Math.floor(Math.random()*windowMs);
  const id=gameSetTimeout(()=>{
    if(variant==='fast')map1GuestFastInterval=0;else map1GuestSlowInterval=0;
    trySpawnMap1Guest(variant);
    scheduleMap1GuestSpawnAttempt(variant);
  },delay);
  if(variant==='fast')map1GuestFastInterval=id;else map1GuestSlowInterval=id;
}
function initMap1Guests(){
  ensureMap1Guest();ensureMap1GuestThought();
  if(!map1GuestFastInterval)scheduleMap1GuestSpawnAttempt('fast');
  if(!map1GuestSlowInterval)scheduleMap1GuestSpawnAttempt('slow');
  initMap1Woman();
}
function map1ExistingFullTableMug(id){
  const mug=map1TableMugs.get(id);
  return map1TableHasFullBeer(id)?mug:null;
}
function map1GuestBeerServed(table,mug){
  if(!map1GuestActive||!['ordering','waitingBeer'].includes(map1GuestStage)||table?.el?.id!=='stehtischRechts')return false;
  hideMap1GuestThought();map1GuestServiceWaitMs=Math.max(0,gameNow()-map1GuestWaitStart);map1GuestStage='beerOnTable';
  const y=parseFloat(map1GuestEl.style.top)||map1GuestDockPoint()[1];
  // Solange der VOLLE Krug sichtbar auf dem Tisch steht, bleibt der Bauer in seiner Wartepose.
  setMap1GuestFrame('assets/npc/gast-bauer-order-3.png?v=92',false,map1GuestPerspective(y));
  map1GuestMugTimer=gameSetTimeout(()=>{
    if(!map1GuestActive||map1GuestStage!=='beerOnTable')return;
    if(mug?.isConnected)mug.style.display='none';
    // ERST JETZT – exakt mit dem Verschwinden des vollen Krugs – beginnt das Trinkbild.
    map1GuestStage='drinking';
    setMap1GuestFrame('assets/npc/gast-bauer-order-2.png?v=92',false,map1GuestPerspective(y));
    map1GuestDrinkTimer=gameSetTimeout(()=>{
      if(!map1GuestActive||map1GuestStage!=='drinking')return;
      if(mug?.isConnected){
        mug.src='assets/npc/gast-krug-leer.png?v=92';mug.style.display='block';mug.style.filter='none';
        mug.dataset.guestEmpty='1';mug.dataset.picked='0';mug.dataset.landed='1';
        mug.dataset.x=String(parseFloat(mug.style.left)||0);mug.dataset.y=String(parseFloat(mug.style.top)||0);
      }
      resolveMap1GuestSatisfaction('stehtischRechts',map1GuestServiceWaitMs,false);
      beginMap1GuestReturn();
    },3000);
  },2000);
  return true;
}
function updateMap1Guest(now){
  if(!map1GuestActive){updateMap1GuestCue();return;}
  if(map1Popularity<50&&!['returning'].includes(map1GuestStage))beginMap1GuestReturn();
  if(map1GuestStage==='waitingBeer'&&map1GuestWaitStart&&now-map1GuestWaitStart>=90000){
    hideMap1GuestThought();resolveMap1GuestSatisfaction('stehtischRechts',90000,true);beginMap1GuestReturn();
  }
  const el=ensureMap1Guest();
  if(map1GuestStage==='arriving'){
    const t=Math.min(1,(now-map1GuestStart)/map1GuestDuration),[x,y]=map1GuestPointOnPath(map1GuestPath,t),scale=map1GuestPerspective(y);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    if(map1GuestVariant==='fast'){
      // Schnell vorwärts: nur die beiden schnellen Laufbilder im Wechsel – KEINE Spiegelvarianten.
      const seq=[1,3],frame=seq[Math.floor((now-map1GuestStart)/MAP1_GUEST_FAST_FRAME_MS)%seq.length];
      setMap1GuestFrame(`assets/npc/gast-bauer-front-${frame}.png?v=92`,false,scale);
    }else{
      // Langsame Variante: gleiche Bildwechselgeschwindigkeit wie alle anderen, Bewegung bleibt 19 s langsam.
      const mirror=Math.floor((now-map1GuestStart)/MAP1_GUEST_SLOW_FRAME_MS)%2===1;
      setMap1GuestFrame('assets/npc/gast-bauer-front-2.png?v=92',mirror,scale);
    }
    if(t>=1){
      // v98: Beim Andocken sofort Bestellgeste + Bier-Gedankenblase, ganz ohne Spieler-Nähe.
      map1GuestWaitStart=gameNow();map1GuestServiceWaitMs=0;
      map1GuestStage='waitingBeer';setMap1GuestFrame('assets/npc/gast-bauer-order-1.png?v=92',false,scale);
      const mug=map1ExistingFullTableMug('stehtischRechts');
      if(mug)map1GuestBeerServed(tableSpriteById('stehtischRechts'),mug);
      else showMap1GuestThought();
    }
  }else if(map1GuestStage==='returning'){
    const t=Math.min(1,(now-map1GuestReturnStart)/Math.max(1,map1GuestReturnDuration)),[x,y]=map1GuestPointOnPath(map1GuestPath,t),scale=map1GuestPerspective(y);el.style.left=`${x}px`;el.style.top=`${y}px`;
    if(map1GuestVariant==='fast'){
      // v101: echte Rücklaufbilder 1/3, aber per Alpha-Fußanker exakt lagegleich – KEIN Spiegel-Trick.
      const seq=[1,3],frame=seq[Math.floor((now-map1GuestReturnStart)/MAP1_GUEST_FAST_FRAME_MS)%seq.length];
      setMap1GuestFrame(`assets/npc/gast-bauer-back-${frame}.png?v=92`,false,scale);
    }else{
      // Langsamer Rückweg behält ausdrücklich den bisherigen Spiegelwechsel.
      const mirror=Math.floor((now-map1GuestReturnStart)/MAP1_GUEST_SLOW_FRAME_MS)%2===1;setMap1GuestFrame('assets/npc/gast-bauer-back-2.png?v=92',mirror,scale);
    }
    if(t>=1)finishMap1Guest();
  }
  if(map1GuestThought&&map1GuestThought.style.display!=='none'){
    const x=parseFloat(el.style.left)||0,y=parseFloat(el.style.top)||0;map1GuestThought.style.left=`${x+18}px`;map1GuestThought.style.top=`${y-204}px`;
  }
  updateMap1GuestCue();
}

/* MAP 1 – GASTFRAU v97: linker Stehtisch, eigener Slot, unabhängig vom Bauern. */
let map1WomanEl=null,map1WomanThought=null;
let map1WomanActive=false,map1WomanStage='idle',map1WomanPath=[],map1WomanStart=0,map1WomanReturnStart=0;
let map1WomanSpawnTimer=0,map1WomanDrinkTimer=0,map1WomanMugTimer=0;
let map1WomanWaitStart=0,map1WomanServiceWaitMs=0;
const MAP1_WOMAN_DURATION=11000;
const MAP1_WOMAN_FRAME_MS=MAP1_GUEST_FAST_FRAME_MS;
const MAP1_WOMAN_INTERACT_DISTANCE=92;
function ensureMap1Woman(){
  if(map1WomanEl)return map1WomanEl;
  map1WomanEl=document.createElement('img');map1WomanEl.id='map1GuestWoman';map1WomanEl.dataset.npcRole='normalGuest';
  map1WomanEl.src='assets/npc/gast-frau-walk-1.png?v=95';map1WomanEl.alt='';map1WomanEl.draggable=false;
  // v98: feste BILDHÖHE statt feste Breite. Dadurch haben Walk + Order trotz unterschiedlicher
  // Quell-Seitenverhältnisse exakt dieselbe sichtbare Höhe und derselbe Fußanker bleibt stehen.
  Object.assign(map1WomanEl.style,{position:'absolute',left:'0',top:'0',width:'auto',height:'117.3612px',objectFit:'contain',transformOrigin:'50% 100%',pointerEvents:'none',userSelect:'none',display:'none',zIndex:'498',willChange:'left,top,transform,filter'});
  world.appendChild(map1WomanEl);return map1WomanEl;
}
function ensureMap1WomanThought(){
  if(map1WomanThought)return map1WomanThought;
  map1WomanThought=document.createElement('div');Object.assign(map1WomanThought.style,{position:'absolute',width:'92.4px',height:'75.6px',pointerEvents:'none',display:'none',opacity:'0',transform:'scale(.72)',transformOrigin:'20% 90%',zIndex:'23000',transition:'opacity 260ms ease, transform 340ms cubic-bezier(.2,.9,.2,1)'});
  const cloud=document.createElement('div');Object.assign(cloud.style,{position:'absolute',left:'12px',top:'0',width:'80.4px',height:'61.2px',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'52% 48% 46% 54% / 48% 55% 45% 52%',boxShadow:'0 4px 12px rgba(0,0,0,.28)'});
  const beer=document.createElement('img');beer.src='assets/npc/bock-wunsch.png?v=38';beer.alt='';beer.draggable=false;Object.assign(beer.style,{position:'absolute',left:'50%',top:'50%',width:'45.6px',height:'45.6px',objectFit:'contain',transform:'translate(-50%,-50%)'});cloud.appendChild(beer);
  const c1=document.createElement('div'),c2=document.createElement('div');[c1,c2].forEach(c=>Object.assign(c.style,{position:'absolute',background:'rgba(255,255,255,.97)',border:'3px solid rgba(55,45,35,.82)',borderRadius:'50%',boxSizing:'border-box'}));Object.assign(c1.style,{left:'2px',top:'62px',width:'9px',height:'9px'});Object.assign(c2.style,{left:'6px',top:'49px',width:'15px',height:'15px'});map1WomanThought.append(c1,c2,cloud);world.appendChild(map1WomanThought);return map1WomanThought;
}
/* v102: Ziel aus der echten Rest-Hitbox, nicht aus transparenten PNG-Rändern.
   Der Fußkreis berührt den Tisch von links; die Route endet genau dort. */
function map1WomanDockPoint(){
  const el=document.getElementById('stehtischLinks'),sp=tableSpriteById('stehtischLinks');
  if(!el||!sp)return null;
  const left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  if(!w||!h)return null;
  const supportStart=Math.floor(sp.sourceH*(.68+(1-.68)/3));
  let bottom=-1;
  for(let sy=sp.sourceH-1;sy>=supportStart&&bottom<0;sy--){
    for(let sx=0;sx<sp.sourceW;sx++)if(sp.alpha[sy*sp.sourceW+sx]>=24){bottom=sy;break;}
  }
  if(bottom<0)return null;
  const y=top+(bottom+.5)/sp.sourceH*h-6,r=12; // v103: Lauflinie 6 Weltpixel höher
  let freeX=left-r-1;
  for(let x=freeX+1;x<=left+w+r;x+=1){
    if(circleHitsSpecificSprite(sp,x,y,r)){
      // Erste Berührung: letzte freie Position plus höchstens ein Pixel Abstand.
      return [freeX-10,y]; // v104: zehn Weltpixel links vor dem bisherigen Andockpunkt
    }
    freeX=x;
  }
  return null;
}
function sampleMap1WomanPath(){
  const dock=map1WomanDockPoint();if(!dock)return [];
  // Keine festen Zwischenpunkte hinter dem Ziel: ausschließlich nach rechts.
  return [[Math.min(40,dock[0]),dock[1]],dock];
}
const MAP1_WOMAN_SCALE=.88485; // v100: Gastfrau gegenüber v99 exakt 10 % größer
function setMap1WomanFrame(src,mirror=false){
  const el=ensureMap1Woman();
  if((el.getAttribute('src')||'')!==src)el.src=src;
  // v100: EIN fester Fußanker für ALLE Frauenbilder. Keine bildabhängige X/Y-Korrektur mehr:
  // dadurch kein Bounce beim Wechsel Lauf -> Bestellung und kein Rechtsruck beim Rückweg.
  el.style.transform=`translate(-50%,-100%) scale(${MAP1_WOMAN_SCALE})${mirror?' rotateY(180deg)':''}`;
}
function map1WomanOccupiesLeftTable(){return map1WomanActive&&['ordering','waitingBeer','beerOnTable','drinking'].includes(map1WomanStage);}
function showMap1WomanThought(){const b=ensureMap1WomanThought(),x=parseFloat(map1WomanEl.style.left),y=parseFloat(map1WomanEl.style.top);b.style.left=`${x+18}px`;b.style.top=`${y-204}px`;b.style.display='block';b.style.opacity='0';b.style.transform='scale(.72)';gameRequestAnimationFrame(()=>gameRequestAnimationFrame(()=>{if(map1WomanStage==='waitingBeer'){b.style.opacity='1';b.style.transform='scale(1)';}}));}
function hideMap1WomanThought(){if(map1WomanThought){map1WomanThought.style.opacity='0';map1WomanThought.style.transform='scale(.84)';gameSetTimeout(()=>{if(map1WomanThought&&map1WomanThought.style.opacity==='0')map1WomanThought.style.display='none';},280);}}
function map1WomanCanTakeOrder(){return false;} // v98: automatische Bestellung beim Andocken; keine Nähe-/Leuchtinteraktion.
function takeMap1WomanOrder(){return false;}
function beginMap1WomanReturn(){if(!map1WomanActive||map1WomanStage==='returning')return;hideMap1WomanThought();gameClearTimeout(map1WomanDrinkTimer);gameClearTimeout(map1WomanMugTimer);map1WomanStage='returning';map1WomanReturnStart=gameNow();const x=parseFloat(map1WomanEl.style.left),y=parseFloat(map1WomanEl.style.top);const leftOnly=[[Math.min(40,x),y]].filter(p=>p[0]<x);map1WomanPath=[[x,y],...leftOnly];} // v101: erster Rückwegschritt kann ausschließlich nach LINKS gehen; kein Bounce/Rechtsruck möglich
function finishMap1Woman(){map1WomanActive=false;map1WomanStage='idle';hideMap1WomanThought();gameClearTimeout(map1WomanDrinkTimer);gameClearTimeout(map1WomanMugTimer);if(map1WomanEl){map1WomanEl.style.display='none';map1WomanEl.style.filter='none';}syncMap1RealGuestCount();}
function spawnMap1Woman(){if(map1WomanActive||map1GameOverStarted||map1Popularity<50||currentMap!==1)return false;const path=sampleMap1WomanPath();if(!path.length)return false;const el=ensureMap1Woman();map1WomanActive=true;map1WomanStage='arriving';map1WomanPath=path;map1WomanStart=gameNow();const[x,y]=map1WomanPath[0];el.style.left=`${x}px`;el.style.top=`${y}px`;el.style.display='block';el.style.visibility='visible';syncMap1RealGuestCount();return true;}
function scheduleMap1WomanSpawn(){const delay=1+Math.floor(Math.random()*30000);map1WomanSpawnTimer=gameSetTimeout(()=>{map1WomanSpawnTimer=0;if(!map1WomanActive&&map1Popularity>=50&&!map1GameOverStarted&&Math.random()<.5)spawnMap1Woman();scheduleMap1WomanSpawn();},delay);}
function initMap1Woman(){ensureMap1Woman();ensureMap1WomanThought();if(!map1WomanSpawnTimer)scheduleMap1WomanSpawn();}
function map1WomanBeerServed(table,mug){
  if(!map1WomanActive||!['ordering','waitingBeer'].includes(map1WomanStage)||table?.el?.id!=='stehtischLinks')return false;hideMap1WomanThought();map1WomanServiceWaitMs=Math.max(0,gameNow()-map1WomanWaitStart);map1WomanStage='beerOnTable';setMap1WomanFrame('assets/npc/gast-frau-order-3.png?v=95');
  map1WomanMugTimer=gameSetTimeout(()=>{if(!map1WomanActive||map1WomanStage!=='beerOnTable')return;if(mug?.isConnected)mug.style.display='none';map1WomanStage='drinking';setMap1WomanFrame('assets/npc/gast-frau-order-2.png?v=95');
    map1WomanDrinkTimer=gameSetTimeout(()=>{if(!map1WomanActive||map1WomanStage!=='drinking')return;if(mug?.isConnected){mug.src='assets/npc/gast-krug-leer.png?v=92';mug.style.display='block';mug.style.filter='none';mug.dataset.guestEmpty='1';mug.dataset.picked='0';mug.dataset.landed='1';mug.dataset.x=String(parseFloat(mug.style.left)||0);mug.dataset.y=String(parseFloat(mug.style.top)||0);}resolveMap1GuestSatisfaction('stehtischLinks',map1WomanServiceWaitMs,false);beginMap1WomanReturn();},3000);
  },2000);return true;
}
function updateMap1Woman(now){
  if(!map1WomanActive)return;
  if(map1Popularity<50&&map1WomanStage!=='returning')beginMap1WomanReturn();
  if(map1WomanStage==='waitingBeer'&&map1WomanWaitStart&&now-map1WomanWaitStart>=90000){
    hideMap1WomanThought();resolveMap1GuestSatisfaction('stehtischLinks',90000,true);beginMap1WomanReturn();
  }
  const el=ensureMap1Woman();
  if(map1WomanStage==='arriving'){
    const t=Math.min(1,(now-map1WomanStart)/MAP1_WOMAN_DURATION),[x,y]=map1GuestPointOnPath(map1WomanPath,t);
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    const seq=[1,2,3,4],frame=seq[Math.floor((now-map1WomanStart)/MAP1_WOMAN_FRAME_MS)%4];
    setMap1WomanFrame(`assets/npc/gast-frau-walk-${frame}.png?v=95`,false);
    if(t>=1){
      // v98: KEIN Positionsreset. Exakt am letzten Laufpunkt stehen bleiben und dort direkt bestellen.
      map1WomanWaitStart=gameNow();map1WomanServiceWaitMs=0;
      map1WomanStage='waitingBeer';setMap1WomanFrame('assets/npc/gast-frau-order-1.png?v=95');
      const mug=map1ExistingFullTableMug('stehtischLinks');
      if(mug)map1WomanBeerServed(tableSpriteById('stehtischLinks'),mug);
      else showMap1WomanThought();
    }
  }else if(map1WomanStage==='returning'){
    const t=Math.min(1,(now-map1WomanReturnStart)/MAP1_WOMAN_DURATION),[x,y]=map1GuestPointOnPath(map1WomanPath,t);
    // v98: Rückweg beginnt exakt an der aktuellen Fußposition – kein Rechtsruck vor dem Loslaufen.
    el.style.left=`${x}px`;el.style.top=`${y}px`;
    const seq=[1,2,3,4],frame=seq[Math.floor((now-map1WomanReturnStart)/MAP1_WOMAN_FRAME_MS)%4];
    setMap1WomanFrame(`assets/npc/gast-frau-walk-${frame}.png?v=95`,true);
    if(t>=1)finishMap1Woman();
  }
  if(map1WomanThought&&map1WomanThought.style.display!=='none'){
    const x=parseFloat(el.style.left)||0,y=parseFloat(el.style.top)||0;map1WomanThought.style.left=`${x+18}px`;map1WomanThought.style.top=`${y-204}px`;
  }
  el.style.filter='none';
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
function burstMap1TreeLeaves(options=null){
  const fx=options?{leaves:options.leaves}:ensureMap1TreeHideFX(),d=options?null:map1TreeDockPoint(); if(!fx||(!options&&!d))return;
  const originX=options?options.originX:d.left+d.w*.5, originY=options?options.originY:d.top+d.h*.24;
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
    ],{duration:Math.min(1500+(i%5)*95,options?options.durationLimit:Infinity),easing:'cubic-bezier(.18,.65,.28,1)',fill:'forwards'});
    anim.onfinish=()=>leaf.remove();
  });
}
function startMap1TreeHide(){
  if(!map1TreeCanInteract())return false;
  const fx=ensureMap1TreeHideFX(); if(!fx)return false;
  map1TreeTransitioning=true;keys.clear();PLAYER.moving=false;PLAYER.frameClock=0;
  playLoudInteractionSound(map1TreeHideSound);
  const tree=document.getElementById('baum'); if(tree)tree.style.filter='none';
  player.style.transition='opacity 360ms ease';player.style.opacity='0';
  burstMap1TreeLeaves();
  fx.image.style.display='block';fx.image.style.opacity='0';syncMap1TreeHideImagePosition();
  gameSetTimeout(()=>{
    if(!map1TreeTransitioning)return;
    fx.image.style.opacity='1';fx.image.style.transform='translate(-50%,-18%) scale(1)';
  },150);
  gameSetTimeout(()=>{
    map1TreeHiding=true;map1TreeTransitioning=false;player.style.visibility='hidden';player.style.opacity='0';
  },380);
  return true;
}
function leaveMap1TreeHide(){
  if(!map1TreeHiding||map1TreeTransitioning)return false;
  const fx=ensureMap1TreeHideFX(),d=map1TreeDockPoint(); if(!fx||!d)return false;
  map1TreeTransitioning=true;map1TreeHiding=false;keys.clear();PLAYER.moving=false;PLAYER.frameClock=0;
  playLoudInteractionSound(map1TreeHideSound);
  burstMap1TreeLeaves();
  fx.image.style.opacity='0';fx.image.style.transform='translate(-50%,-18%) scale(.88)';
  PLAYER.x=d.x;PLAYER.y=d.y;setPlayerDirection('front');PLAYER.sequenceIndex=0;PLAYER.frameClock=0;PLAYER.frame=activePlayerSequence('front')[0];showPlayerFrame(true);
  player.style.left=`${PLAYER.x}px`;player.style.top=`${PLAYER.y}px`;player.style.visibility='visible';player.style.opacity='0';player.style.transition='opacity 360ms ease';
  gameRequestAnimationFrame(()=>gameRequestAnimationFrame(()=>{player.style.opacity='1';}));
  gameSetTimeout(()=>{fx.image.style.display='none';map1TreeTransitioning=false;player.style.transition='';playerLastTime=gameNow();updateMap1TreeInteractionCue();},390);
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
  return !map1PlayerCircleBlocked(x,y,PLAYER.radius);
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

/* v107: Referenzmarkierung – Fußpunktgrenze und gesperrte Stegachse. */
let map1PierPosition=null,map1PierEntryArmed=true;
function map1PondGeometry(){
  const el=document.getElementById('teich');if(!el)return null;
  const left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  const ax=left+w*.184,ay=top+h*.7106+9;
  const vx=w*(.425-.184),vy=h*(.493-.7106),len=Math.hypot(vx,vy);
  const g={cx:left+w*.51147,cy:top+h*.48570,rx:w*.40255,ry:h*.28720,angle:.097883,
    ax,ay,bx:ax+vx-vx/len*3,by:ay+vy-vy/len*3,
    entryAX:ax,entryAY:ay,entryRX:w*.0608,entryRY:h*.0754};
  // v115: Nur Eintrittsellipse entlang der unveränderten Steglinie an die Uferkontur schieben.
  const p=map1PondLocal(g,g.ax,g.ay),q=map1PondLocal(g,g.bx,g.by),dx=q[0]-p[0],dy=q[1]-p[1];
  const A=dx*dx+dy*dy,B=2*(p[0]*dx+p[1]*dy),C=p[0]*p[0]+p[1]*p[1]-1,disc=B*B-4*A*C;
  if(A>0&&disc>=0){const t=(-B-Math.sqrt(disc))/(2*A);if(t>=0&&t<=1){g.entryAX=g.ax+(g.bx-g.ax)*t;g.entryAY=g.ay+(g.by-g.ay)*t;}}
  return g;
}
function map1PondLocal(g,x,y){const dx=x-g.cx,dy=y-g.cy,c=Math.cos(g.angle),s=Math.sin(g.angle);return[(dx*c+dy*s)/g.rx,(-dx*s+dy*c)/g.ry];}
function map1PondInside(x,y){const g=map1PondGeometry();if(!g)return false;const[u,v]=map1PondLocal(g,x,y);return u*u+v*v<=1;}
function map1PierEntryContains(g,x,y){return ((x-g.entryAX)/g.entryRX)**2+((y-g.entryAY)/g.entryRY)**2<=1;}
function map1LandscapeStandFree(x,y){
  if(x<10||y<10||x>WORLD_W-10||y>WORLD_H-10)return false;
  return !collisionSprites.some(s=>s.el.id!=='teich'&&circleHitsSpecificSprite(s,x,y,PLAYER.radius));
}
function moveMap1Pier(dx,dy){
  if(currentMap!==1){map1PierPosition=null;map1PierEntryArmed=true;return false;}
  const g=map1PondGeometry();if(!g)return false;
  const vx=g.bx-g.ax,vy=g.by-g.ay,len=Math.hypot(vx,vy);
  if(map1PierPosition!==null){
    const up=keys.has('w')&&keys.has('d')&&!keys.has('a')&&!keys.has('s');
    const down=keys.has('s')&&keys.has('a')&&!keys.has('w')&&!keys.has('d');
    if(!up&&!down)return true;
    setPlayerDirection(up?'back':'front');
    const step=Math.hypot(dx,dy)/len,raw=map1PierPosition+(up?step:-step);
    const t=Math.max(0,Math.min(1,raw)),x=g.ax+vx*t,y=g.ay+vy*t;
    if(map1LandscapeStandFree(x,y)){map1PierPosition=t;PLAYER.x=x;PLAYER.y=y;}
    if(down&&raw<0){
      const x=g.ax+vx*raw,y=g.ay+vy*raw;
      if(map1LandscapeStandFree(x,y)){PLAYER.x=x;PLAYER.y=y;map1PierPosition=null;map1PierEntryArmed=false;}
    }
    return true;
  }
  if(!map1PierEntryArmed){if(!map1PierEntryContains(g,PLAYER.x,PLAYER.y))map1PierEntryArmed=true;return false;}
  // Segmentprüfung verhindert, dass auch bei einem langen Tick der Eintritt übersprungen wird.
  const ux=(PLAYER.x-g.entryAX)/g.entryRX,uy=(PLAYER.y-g.entryAY)/g.entryRY;
  const sx=dx/g.entryRX,sy=dy/g.entryRY,q=Math.max(0,Math.min(1,-(ux*sx+uy*sy)/(sx*sx+sy*sy||1)));
  if((ux+sx*q)**2+(uy+sy*q)**2<=1){
    const t=Math.max(0,Math.min(1,((PLAYER.x+dx-g.ax)*vx+(PLAYER.y+dy-g.ay)*vy)/(len*len)));
    const x=g.ax+vx*t,y=g.ay+vy*t;
    if(map1LandscapeStandFree(x,y)){map1PierPosition=t;PLAYER.x=x;PLAYER.y=y;setPlayerDirection(keys.has('s')&&keys.has('a')?'front':'back');return true;}
  }
  return false;
}
function slideMap1Pond(dx,dy){
  if(currentMap!==1)return false;
  const g=map1PondGeometry();if(!g)return false;
  const p=map1PondLocal(g,PLAYER.x,PLAYER.y),n=map1PondLocal(g,PLAYER.x+dx,PLAYER.y+dy),vx=n[0]-p[0],vy=n[1]-p[1];
  const near=Math.max(0,Math.min(1,-(p[0]*vx+p[1]*vy)/(vx*vx+vy*vy||1)));
  if((p[0]+vx*near)**2+(p[1]+vy*near)**2>1)return false;
  let lo=0,hi=near;
  for(let i=0;i<36;i++){const t=(lo+hi)/2,u=p[0]+vx*t,v=p[1]+vy*t;if(u*u+v*v>1)lo=t;else hi=t;}
  const t=lo,c=Math.cos(g.angle),s=Math.sin(g.angle),u=p[0]+vx*t,v=p[1]+vy*t;
  const hitX=PLAYER.x+dx*t,hitY=PLAYER.y+dy*t;
  let nx=c*u/g.rx-s*v/g.ry,ny=s*u/g.rx+c*v/g.ry;const length=Math.hypot(nx,ny)||1;nx/=length;ny/=length;
  const rx=dx*(1-t),ry=dy*(1-t),inward=Math.min(0,rx*nx+ry*ny);
  let x=hitX+rx-inward*nx,y=hitY+ry-inward*ny;
  const local=map1PondLocal(g,x,y),radius=Math.hypot(...local);
  if(radius<=1.00001){const a=local[0]/(radius||1),b=local[1]/(radius||1);x=g.cx+c*a*g.rx-s*b*g.ry+nx*.05;y=g.cy+s*a*g.rx+c*b*g.ry+ny*.05;}
  if(map1LandscapeStandFree(x,y)){PLAYER.x=x;PLAYER.y=y;}
  return true;
}

function movePlayerAxis(dx,dy){
  if(moveMap1Pier(dx,dy)||slideMap1Pond(dx,dy))return;
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
    const start=gameNow();

    const step=now=>{
      const t=Math.min(1,(now-start)/duration);
      const eased=t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
      setIrisRadius(from+(to-from)*eased);

      if(t<1){
        gameRequestAnimationFrame(step);
      }else{
        setIrisRadius(to);
        resolve();
      }
    };

    gameRequestAnimationFrame(step);
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
  await new Promise(r=>gameRequestAnimationFrame(()=>gameRequestAnimationFrame(r)));
  await animateIris(0,150,700);
  finishIrisOpen();

  mapTransitioning=false;
  playerLastTime=gameNow();
}

async function leaveWirtschaft(){
  if(mapTransitioning||currentMap!==2)return;

  // v59: Auch beim Rückweg Iris SOFORT bei Zonenberührung; Türsound läuft weiter.
  mapTransitioning=true;
  playDoorPassSound();
  PLAYER.moving=false; PLAYER.frameClock=0;

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
  await new Promise(r=>gameRequestAnimationFrame(()=>gameRequestAnimationFrame(r)));
  await animateIris(0,150,700); finishIrisOpen();
  mapTransitioning=false; playerLastTime=gameNow();
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

/* v78 – einheitliche Fußlinien-Tiefe NUR für Event-NPCs + Blut.
   Spieler unterhalb der NPC-Fußlinie = Spieler davor; oberhalb = Spieler dahinter.
   Props, Stehtische, Bierkrüge und deren bestehende Ebenenlogik bleiben unangetastet. */
function map1GuestBehindProps(){
  if(!map1GuestEl||!map1GuestActive)return false;
  const x=parseFloat(map1GuestEl.style.left),y=parseFloat(map1GuestEl.style.top);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  // Auch vor dem Posewechsel: der rechte Tisch liegt immer vor dem ankommenden Bauern.
  const table=document.getElementById('stehtischRechts');
  if(table){const left=px(table,'left'),top=px(table,'top'),w=table.offsetWidth,h=table.offsetHeight;
    if(x>=left-w*.5&&x<=left+w*1.5&&y>=top-40&&y<=top+h+40)return true;}
  const ids=[...STANDING_TABLE_IDS,...TOP_PASSAGE_IDS,'wirtschaft','baum'];
  for(const id of ids){const el=document.getElementById(id),sprite=el?collisionSprites.find(s=>s.el===el):null;if(sprite&&(furnitureTopPassage(sprite,x,y)||propRatioPassage(sprite,x,y)))return true;}
  return false;
}
function syncMap1NpcPlayerDepth(){
  if(currentMap!==1||!player)return;
  const playerZ=Number(player.style.zIndex)||10000;
  const apply=(el,footY)=>{
    if(!el||el.style.display==='none'||el.style.visibility==='hidden'||!Number.isFinite(footY))return;
    el.style.zIndex=String(PLAYER.y>footY?playerZ-1:playerZ+1);
  };
  apply(map1Runner,parseFloat(map1Runner?.style.top));
  apply(map1Bear,parseFloat(map1Bear?.style.top));
  apply(map1BockRider,parseFloat(map1BockRider?.style.top));
  apply(map1BockFinal,parseFloat(map1BockFinal?.style.top));
  // Laufender + kniender Bauer: bisherige Fußlinienregel bleibt exakt bestehen.
  // Liegender Bauer: Spieler liegt GENERELL davor, unabhängig von der Fußlinie.
  if(map1Event3FarmerState==='dead'&&map1Event3Farmer&&map1Event3Farmer.style.display!=='none'&&map1Event3Farmer.style.visibility!=='hidden')
    map1Event3Farmer.style.zIndex=String(playerZ-1);
  else apply(map1Event3Farmer,parseFloat(map1Event3Farmer?.style.top));
  apply(map1Event3Bock,parseFloat(map1Event3Bock?.style.top));
  apply(map1Event4Kalif,parseFloat(map1Event4Kalif?.style.top));
  // v111: Fußlinien statt fixer Gästeebenen, für beide Bauernvarianten und alle Frauenposen.
  const guests=[
    {el:map1GuestEl,active:map1GuestActive,behind:map1GuestOccupiesRightTable()||map1GuestBehindProps()},
    {el:map1WomanEl,active:map1WomanActive,behind:true}
  ].filter(g=>g.active&&g.el&&g.el.style.display!=='none'&&g.el.style.visibility!=='hidden');
  // Bei sichtbarer Überlappung hinter einem angedockten Gast bleibt auch der Tisch davor.
  // Außerhalb der Sprites ändern sich die bisherigen Prop-Effektzonen des Wirts nicht.
  for(const g of guests){
    const foot=parseFloat(g.el.style.top),x=parseFloat(g.el.style.left);
    const overlapX=Math.abs(PLAYER.x-x)<(player.offsetWidth*playerVisualScale()+g.el.offsetWidth)/2;
    const overlapY=PLAYER.y>foot-g.el.offsetHeight&&PLAYER.y-playerWorldHeight()<foot;
    if(g.behind&&PLAYER.y<foot&&overlapX&&overlapY&&Number(player.style.zIndex)>=MAP1_PLAYER_BEHIND_Z)
      player.style.zIndex=String(MAP1_PLAYER_BEHIND_Z-2);
  }
  const guestPlayerZ=Number(player.style.zIndex)||playerZ;
  for(const g of guests){
    const foot=parseFloat(g.el.style.top);
    g.el.style.zIndex=String(g.behind?Math.min(MAP1_PLAYER_BEHIND_Z-1,guestPlayerZ+(PLAYER.y>=foot?-1:1)):guestPlayerZ+(PLAYER.y>=foot?-1:1));
  }
  // Blut: KEINE Fußlinie. Immer eine Ebene hinter dem Bauern, somit ebenfalls hinter dem Spieler.
  if(map1Event3Blood&&map1Event3Blood.style.display!=='none'&&map1Event3Blood.style.visibility!=='hidden'&&map1Event3Farmer){
    const farmerZ=Number(map1Event3Farmer.style.zIndex);
    if(Number.isFinite(farmerZ))map1Event3Blood.style.zIndex=String(farmerZ-1);
  }
}

function updatePlayer(now){
  if(!player)return;
  if(map1GameOverStarted || map1AppleShake || mapTransitioning || map2BarServing || map1TableServing || map1TreeHiding || map1TreeTransitioning){ playerLastTime=now; updateMap2BarInteractionCue(); updateMap1TableInteractionCue(); return; }

  const dt=Math.min(.04,(now-playerLastTime)/1000);
  playerLastTime=now;

  let dx=0,dy=0;
  if(keys.has('a'))dx-=1;
  if(keys.has('d'))dx+=1;
  if(keys.has('w'))dy-=1;
  if(keys.has('s'))dy+=1;

  if(currentMap===1&&map1PierPosition!==null){
    const up=keys.has('w')&&keys.has('d')&&!keys.has('a')&&!keys.has('s');
    const down=keys.has('s')&&keys.has('a')&&!keys.has('w')&&!keys.has('d');
    if(!up&&!down){dx=0;dy=0;}
  }
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
  if(k==='4' && !e.repeat){e.preventDefault();startMap1Event4();}
  if(k==='5' && !e.repeat){e.preventDefault();startMap1Event5();}
  if(k==='6' && !e.repeat){e.preventDefault();startMap1KingEvent();}
});
window.addEventListener('keydown',e=>{
  if((e.key==='^'||e.code==='Backquote')&&!e.repeat){e.preventDefault();if(!pickupMap1Money()&&!pickupMap1Toad()&&!pickupMap1Apple()&&!pickupMap1GuestEmptyMug())pickupMap1BockMug();return;}
  if(e.code==='Space'){
    e.preventDefault();
    if(!e.repeat){ if(!startMap1AppleShake() && !toggleMap1TreeHide() && !takeMap1GuestOrder() && !takeMap1WomanOrder() && !startMap1TableServe() && !startMap1BockBeerServe()) startMap2BarServe(); }
  }
});

window.addEventListener('keyup',e=>{
  const k=e.key.toLowerCase();
  if(['w','a','s','d'].includes(k)){keys.delete(k);e.preventDefault();}
});
window.addEventListener('blur',()=>keys.clear());

/* v106: neue Landschaftsobjekte, unabhängig von den bisherigen Prop-Zonen. */
const MAP1_APPLE_TRUNK_POLY=[[.44,.72],[.61,.72],[.61,1],[.44,1]]; // v108: gerade Stammseiten, keine seitlichen Wurzel-Hitboxen
function map1AppleCrownAt(s,x,y){
  return map1AppleCrownBaseAt(s,x,y)||map1AppleCrownBaseAt(s,x,y-30);
}
function map1AppleCrownBaseAt(s,x,y){
  const p=spriteLocalPoint(s,x,y);if(!p)return false;
  const end=Math.floor(s.sourceH*.72);if(p.sy>=end)return false;
  // Innerhalb der Kronensilhouette bleiben auch kleine transparente Blattlücken stabil.
  let first=-1,last=-1;
  for(let sy=0;sy<end;sy++)if(s.alpha[sy*s.sourceW+p.sx]>=24){if(first<0)first=sy;last=sy;}
  return first>=0&&p.sy>=first&&p.sy<=last;
}
const MAP1_LANDSCAPE_GLOW='brightness(1.18) drop-shadow(0 0 6px rgba(255,225,110,.98)) drop-shadow(0 0 12px rgba(255,190,55,.75))';
function map1AppleDockedFromBelow(sp){
  if(currentMap!==1||PLAYER.direction!=='back'||!sp)return false;
  const el=sp.el,left=px(el,'left'),top=px(el,'top'),w=el.offsetWidth,h=el.offsetHeight;
  if(PLAYER.x<left+w*.44||PLAYER.x>=left+w*.61-3)return false;
  const sx=Math.max(0,Math.min(sp.sourceW-1,Math.floor((PLAYER.x-left)/w*sp.sourceW)));
  let bottom=-1;
  for(let sy=sp.sourceH-1;sy>=sp.sourceH*.72;sy--)if(sp.alpha[sy*sp.sourceW+sx]>=24){bottom=sy;break;}
  if(bottom<0)return false;
  const edge=top+(bottom+.5)/sp.sourceH*h;
  return PLAYER.y>=edge&&Math.abs(PLAYER.y-(edge+PLAYER.radius))<=8;
}
function syncMap1LandscapeDepth(){
  const tree=document.getElementById('apfelbaum'),pond=document.getElementById('teich');
  if(tree){
    tree.style.visibility=currentMap===1?'visible':'hidden';
    const sp=collisionSprites.find(s=>s.el===tree),z=Number(player.style.zIndex)||MAP1_PLAYER_FRONT_Z;
    tree.style.zIndex=String(currentMap===1&&sp&&map1AppleCrownAt(sp,PLAYER.x,PLAYER.y)?z+1:490);
    tree.style.filter=map1AppleDockedFromBelow(sp)?MAP1_LANDSCAPE_GLOW:'none';
  }
  if(pond){pond.style.visibility=currentMap===1?'visible':'hidden';pond.style.zIndex='490';
    pond.style.filter=currentMap===1&&map1PierPosition===1&&PLAYER.direction==='back'&&!(keys.has('s')&&keys.has('a'))?MAP1_LANDSCAPE_GLOW:'none';
  }
}
async function prepareMap1Landscape(){
  for(const id of ['apfelbaum','teich']){
    const el=document.getElementById(id);if(!el)continue;
    await buildAlphaCollision(el);
  }
  syncMap1LandscapeDepth();
}

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
  if(s.el.id==='apfelbaum'){
    if(currentMap!==1)return false;
    const p=spriteLocalPoint(s,x,y);if(!p||p.alpha<24)return false;
    return pointInPoly(p.sx/s.sourceW,p.sy/s.sourceH,MAP1_APPLE_TRUNK_POLY);
  }
  if(s.el.id==='teich')return currentMap===1&&map1PondInside(x,y);
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
    if(collisionSprites.some(s=>s.el.id!=='teich'&&pointHitsSprite(s,x+Math.cos(a)*r,y+Math.sin(a)*r)))return true;
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
    ...MAP1_KING_IMAGES,
    ...MAP1_COIN_IMAGES,
    ...MAP1_TOAD_SOURCES,MAP1_TOAD_SPLASH,MAP1_APPLE_SHAKE_IMAGE,MAP1_APPLE_IMAGE,
    'assets/npc/frau-run-1.png?v=02','assets/npc/frau-run-2.png?v=02',
    'assets/npc/baer-run-1.png?v=22','assets/npc/baer-run-2.png?v=22','assets/npc/baer-run-3.png?v=22',
    'assets/npc/bock-reiter-1.png?v=27','assets/npc/bock-reiter-2.png?v=27','assets/npc/bock-reiter-3.png?v=27',
    'assets/npc/bock-stop.png?v=30','assets/npc/bock-dismount.png?v=30','assets/npc/bock-dismount.png?v=29',
    'assets/npc/bock-final.png?v=30','assets/npc/bock-wunsch.png?v=38','assets/npc/bock-bier.png?v=38',
    'assets/npc/bock-trinkt.png?v=38','assets/npc/bock-krug-leer.png?v=38',
    'assets/npc/event3-bock-attack-ready.png?v=71','assets/npc/event3-bock-slash.png?v=71',
    'assets/npc/event3-bauer-walk.png?v=71','assets/npc/event3-bauer-kneel.png?v=71','assets/npc/event3-bauer-dead.png?v=71',
    'assets/npc/baum-versteck.png?v=01',
    'assets/npc/kalif-1.png?v=82','assets/npc/kalif-2.png?v=82','assets/npc/kalif-3.png?v=82','assets/npc/kalif-7.png?v=82','assets/npc/kalif-8.png?v=82',
    'assets/npc/schreiber-6.png?v=79','assets/npc/schreiber-gameover.png?v=79',
    'assets/npc/gast-bauer-front-1.png?v=92','assets/npc/gast-bauer-front-2.png?v=92','assets/npc/gast-bauer-front-3.png?v=92',
    'assets/npc/gast-bauer-order-1.png?v=92','assets/npc/gast-bauer-order-2.png?v=92','assets/npc/gast-bauer-order-3.png?v=92',
    'assets/npc/gast-bauer-back-1.png?v=92','assets/npc/gast-bauer-back-2.png?v=92','assets/npc/gast-bauer-back-3.png?v=92',
    'assets/npc/gast-krug-leer.png?v=92',
    'assets/props/apfelbaum.png?v=106','assets/props/teich.png?v=108',
    'assets/npc/gast-frau-walk-1.png?v=95','assets/npc/gast-frau-walk-2.png?v=95',
    'assets/npc/gast-frau-walk-3.png?v=95','assets/npc/gast-frau-walk-4.png?v=95',
    'assets/npc/gast-frau-order-1.png?v=95','assets/npc/gast-frau-order-2.png?v=95','assets/npc/gast-frau-order-3.png?v=95'
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

const GAME_RECOVERY_IMAGE_SOURCES=['assets/maps/terrasse.jpg', 'assets/maps/wirtschaft-innen.jpg?v=18', 'assets/npc/baer-run-1.png?v=22', 'assets/npc/baer-run-2.png?v=22', 'assets/npc/baer-run-3.png?v=22', 'assets/npc/baum-versteck.png?v=01', 'assets/npc/bock-bier.png?v=38', 'assets/npc/bock-dismount.png?v=29', 'assets/npc/bock-dismount.png?v=30', 'assets/npc/bock-final.png?v=30', 'assets/npc/bock-krug-leer.png?v=38', 'assets/npc/bock-reiter-1.png?v=27', 'assets/npc/bock-reiter-2.png?v=27', 'assets/npc/bock-reiter-3.png?v=27', 'assets/npc/bock-stop.png?v=30', 'assets/npc/bock-trinkt.png?v=38', 'assets/npc/bock-wunsch.png?v=38', 'assets/npc/event3-bauer-dead.png?v=71', 'assets/npc/event3-bauer-kneel.png?v=71', 'assets/npc/event3-bauer-walk.png?v=71', 'assets/npc/event3-bock-attack-ready.png?v=71', 'assets/npc/event3-bock-slash.png?v=71', 'assets/npc/event5-bauer-fire.png?v=87', 'assets/npc/event5-kalif-fire.png?v=87', 'assets/npc/frau-run-1.png?v=02', 'assets/npc/frau-run-2.png?v=02', 'assets/npc/gast-bauer-back-1.png?v=92', 'assets/npc/gast-bauer-back-2.png?v=92', 'assets/npc/gast-bauer-back-3.png?v=92', 'assets/npc/gast-bauer-front-1.png?v=92', 'assets/npc/gast-bauer-front-2.png?v=92', 'assets/npc/gast-bauer-front-3.png?v=92', 'assets/npc/gast-bauer-order-1.png?v=92', 'assets/npc/gast-bauer-order-2.png?v=92', 'assets/npc/gast-bauer-order-3.png?v=92', 'assets/npc/gast-emotion-gelb.png?v=98', 'assets/npc/gast-emotion-gruen.png?v=98', 'assets/npc/gast-emotion-rot.png?v=98', 'assets/npc/gast-frau-order-1.png?v=95', 'assets/npc/gast-frau-order-2.png?v=95', 'assets/npc/gast-frau-order-3.png?v=95', 'assets/npc/gast-frau-walk-1.png?v=95', 'assets/npc/gast-frau-walk-2.png?v=95', 'assets/npc/gast-frau-walk-3.png?v=95', 'assets/npc/gast-frau-walk-4.png?v=95', 'assets/npc/gast-krug-leer.png?v=92', 'assets/npc/kalif-1.png?v=82', 'assets/npc/kalif-2.png?v=82', 'assets/npc/kalif-3.png?v=82', 'assets/npc/kalif-7.png?v=82', 'assets/npc/kalif-8.png?v=82', 'assets/npc/schreiber-1.png?v=76', 'assets/npc/schreiber-2.png?v=76', 'assets/npc/schreiber-3.png?v=76', 'assets/npc/schreiber-4.png?v=77', 'assets/npc/schreiber-5.png?v=77', 'assets/npc/schreiber-6.png?v=79', 'assets/npc/schreiber-gameover.png?v=79', 'assets/npc/schreiber-gameover.png?v=81', 'assets/player/back-1.png', 'assets/player/back-2.png', 'assets/player/back-3.png', 'assets/player/back-4.png', 'assets/player/front-1.png?v=12', 'assets/player/front-2.png?v=12', 'assets/player/front-3.png?v=12', 'assets/player/front-4.png?v=12', 'assets/player/nobier-back-1.png?v=69', 'assets/player/nobier-back-2.png?v=69', 'assets/player/nobier-back-3.png?v=69', 'assets/player/nobier-back-4.png?v=69', 'assets/player/nobier-front-1.png?v=69', 'assets/player/nobier-front-2.png?v=69', 'assets/player/nobier-front-3.png?v=69', 'assets/player/nobier-front-4.png?v=69', 'assets/player/nobier-side-1.png?v=69', 'assets/player/nobier-side-2.png?v=69', 'assets/player/nobier-side-3.png?v=69', 'assets/player/side-1.png?v=12', 'assets/player/side-2.png?v=12', 'assets/player/side-3.png?v=12', 'assets/player/side-4.png?v=12', 'assets/player/tisch-a.png?v=46', 'assets/player/tisch-d.png?v=46', 'assets/player/tisch-s.png?v=47', 'assets/player/tisch-w.png?v=47', 'assets/props/theke-ausschank.png?v=01', 'assets/props/theke.png?v=03'];
async function rewarmGameImages(){
  const images=new Set([...PLAYER_IMAGE_CACHE.values(),...EVENT_IMAGE_CACHE.values(),...MAP_IMAGE_CACHE.values(),...document.querySelectorAll('img')]);
  for(const src of GAME_RECOVERY_IMAGE_SOURCES){
    if(!EVENT_IMAGE_CACHE.has(src)){const img=new Image();img.src=src;EVENT_IMAGE_CACHE.set(src,img);}
    images.add(EVENT_IMAGE_CACHE.get(src));
  }
  await Promise.all([...images].map(img=>new Promise(resolve=>{
    const timeout=gameNativeTimeout(resolve,8000);
    const ready=img.decode?img.decode():Promise.resolve();
    Promise.resolve(ready).catch(()=>{}).then(()=>{gameNativeClear(timeout);resolve();});
  })));
}
async function resumeAnimationSystem(){
  if(document.hidden||!document.body.classList.contains('game-ready'))return;
  if(gameResumeTask)return gameResumeTask;
  if(!gamePaused)return;
  gameResumeTask=(async()=>{
    await rewarmGameImages();
    if(document.hidden||!document.hasFocus())return;
    gamePausedTotal+=performance.now()-gamePauseAt;gamePaused=false;
    playerLastTime=gameNow();showPlayerFrame(true);
    for(const a of gamePausedAnimations)if(a.playState==='paused')a.play();
    gamePausedAnimations.clear();
    for(const a of gamePausedAudio)a.play().catch(()=>{});
    gamePausedAudio.clear();
    for(const [id,item] of gameTimers)gameArmTimer(id,item);
    for(const [id,item] of gameFrames)gameArmFrame(id,item);
    gameCancelAnimationFrame(rafId);rafId=gameRequestAnimationFrame(draw);
  })().finally(()=>{gameResumeTask=null;});
  return gameResumeTask;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAnimationSystem();else resumeAnimationSystem();});
window.addEventListener('blur',pauseAnimationSystem);
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
  await prepareMap1Landscape();
  ensureMap1Runner();
  ensureMap1Bear();
  ensureMap1Scribe();
  syncMap1Scribe(true);
  initMap1Guests();
  ensureMap1Toad();
  map1ToadEpoch=gameNow();
  ensureMap2Bar();
  ensureMap2BarAction();
  updateMap2BarVisibility();
  showPlayerFrame(true);
  if(player){
    player.style.left=`${PLAYER.x}px`;
    player.style.top=`${PLAYER.y}px`;
  }

  document.body.classList.add('game-ready');
  if(document.hidden)pauseAnimationSystem();
  gameCancelAnimationFrame(rafId);
  playerLastTime=gameNow();
  rafId=gameRequestAnimationFrame(draw);

  const collidables=[...document.querySelectorAll('.collidable[data-collision="alpha"]')];
  const baumCollision=document.getElementById('baum');
  if(baumCollision && !collidables.includes(baumCollision))collidables.push(baumCollision);
  Promise.all(collidables.filter(el=>!collisionSprites.some(s=>s.el===el)).map(buildAlphaCollision)).catch(console.error);
  if(gamePaused&&!document.hidden)resumeAnimationSystem();
}

if(map.complete&&map.naturalWidth>0){
  start();
}else{
  map.addEventListener('load',start,{once:true});
  map.addEventListener('error',()=>{
    document.getElementById('loading').textContent='KARTE KONNTE NICHT GELADEN WERDEN';
  },{once:true});
}