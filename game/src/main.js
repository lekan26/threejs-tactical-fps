// Main game loop and state integration: fixed 60Hz simulation, raycasting hit detection,
// weapon switching, economy, rounds, bots, bomb, grenades, audio, and screenshot mode handlers.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createWeapon } from './weapon.js';
import { createTargets } from './targets.js';
import { createHud } from './hud.js';
import { gameState } from './state.js';
import { buyItem, awardKill, awardRoundEnd } from './economy.js';
import { createBots } from './bots.js';
import { createBomb } from './bomb.js';
import { createRoundManager } from './rounds.js';
import { audio } from './audio.js';
import { createGrenades } from './grenades.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 140);
scene.add(camera);

const world = createWorld(scene);
const targets = createTargets(scene);
const weapon = createWeapon(camera);
const hud = createHud();
const player = createPlayer(world.colliders);
const bots = createBots(scene, world, player);
const bomb = createBomb(scene);
const grenades = createGrenades(scene, world, player, bots, hud, audio);
const rounds = createRoundManager(player, bots, bomb, hud, weapon);
const input = createInput(renderer.domElement, onLockChange);

const tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.8 });
const activeTracers = [];
function addTracer(start, end) {
  const geom = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(geom, tracerMat);
  scene.add(line);
  activeTracers.push({ line, life: 0.08 });
}
function stepTracers(dt) {
  for (let i = activeTracers.length - 1; i >= 0; i--) {
    const t = activeTracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      scene.remove(t.line);
      activeTracers.splice(i, 1);
    }
  }
}

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const shootables = world.shootables.concat(targets.hitMeshes).concat(bots.hitMeshes);
const shootDir = new THREE.Vector3();

const body = player.state;
const markerHoldMs = shot ? 4000 : 90;

hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, weapon.state.activeDef.name);
hud.setStatus(body.health, body.armour, body.money);
hud.setScores(gameState.attackerScore, gameState.defenderScore);
hud.setAliveCounts(bots.livingCount('attackers') + (body.health > 0 ? 1 : 0), bots.livingCount('defenders'));
hud.setTimer(gameState.timer);

hud.onPlay(() => {
  if (shot) return;
  audio.init();
  if (gameState.phase === 'matchEnded') {
    gameState.attackerScore = 0;
    gameState.defenderScore = 0;
    rounds.startBuyPhase();
  }
  input.requestLock();
});

hud.onBuy((itemId) => {
  const res = buyItem(itemId, weapon);
  hud.showBanner(res.message);
  hud.setStatus(body.health, body.armour, body.money);
  hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, weapon.state.activeDef.name);
});

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    if (gameState.phase === 'buy' && gameState.timer <= 0) {
      rounds.startLivePhase();
    }
    hud.hideOverlay();
  } else if (gameState.phase !== 'matchEnded') {
    hud.showOverlay(gameState.phase === 'live' ? 'paused' : 'start');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spreadVal) {
  if (!weapon.ready()) return false;
  if (!weapon.takeRound()) return false;

  audio.playShot(weapon.state.activeDef.name);

  camera.getWorldDirection(shootDir);
  const startPos = camera.position.clone();
  shootDir.x += (random() * 2 - 1) * spreadVal;
  shootDir.y += (random() * 2 - 1) * spreadVal;
  shootDir.z += (random() * 2 - 1) * spreadVal;
  shootDir.normalize();

  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, shootDir);
  const hit = raycaster.intersectObjects(shootables, false)[0];

  const endPos = hit ? hit.point.clone() : camera.position.clone().addScaledVector(shootDir, 80);
  addTracer(startPos, endPos);

  if (hit) {
    const isHead = hit.object.userData.part === 'head';
    const def = weapon.state.activeDef;
    const dmg = isHead ? def.headDmg : def.bodyDmg;

    if (hit.object.userData.target) {
      const killed = targets.damage(hit.object, dmg);
      if (killed) {
        awardKill();
        audio.playKill();
        hud.addKillFeed(`Player eliminated target (${isHead ? 'HEADSHOT' : 'BODY'})`);
      } else {
        audio.playHitmarker();
      }
      hud.hitMarker(killed, markerHoldMs);
    } else if (hit.object.userData.bot) {
      const killed = bots.damageBot(hit.object, dmg);
      if (killed) {
        awardKill();
        audio.playKill();
        hud.addKillFeed(`Player eliminated bot (${isHead ? 'HEADSHOT' : 'BODY'})`);
      } else {
        audio.playHitmarker();
      }
      hud.hitMarker(killed, markerHoldMs);
    }
    hud.setStatus(body.health, body.armour, body.money);
  }

  bots.alertBotsToSound(body.position, 25);

  weapon.pullTrigger();
  player.recoil(weapon.state.activeDef.recoilKick * 0.2 + random() * 0.003, (random() * 2 - 1) * 0.003);
  hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, weapon.state.activeDef.name);
  return true;
}

let footstepTimer = 0;

function step(dt) {
  rounds.step(dt);
  bomb.step(dt, body.position, input.state.keys, true);
  bots.step(dt, performance.now() / 1000, body.position, world.colliders, grenades);
  grenades.step(dt, body.position, world.colliders);
  stepTracers(dt);

  const speed = player.groundSpeed();
  if (speed > 1.0 && body.onGround) {
    footstepTimer += dt;
    if (footstepTimer >= 0.4) {
      audio.playFootstep();
      footstepTimer = 0;
    }
  }

  const events = input.consumeEvents();
  for (const ev of events) {
    if (ev === 'Digit1') weapon.selectSlot('primary');
    if (ev === 'Digit2') weapon.selectSlot('sidearm');
    if (ev === 'KeyR') {
      weapon.reload();
      audio.playReload();
    }
    if (ev === 'KeyB') {
      if (gameState.phase === 'buy') {
        const overlayEl = document.getElementById('overlay');
        if (overlayEl.hidden) hud.showOverlay('start');
        else hud.hideOverlay();
      }
    }
    if (ev === 'Digit3') buyItem('frag', weapon);
    if (ev === 'Digit4') {
      if (gameState.player.hasFrag) {
        grenades.throwGrenade('frag', camera, gameState.player);
      } else if (gameState.player.hasSmoke) {
        grenades.throwGrenade('smoke', camera, gameState.player);
      } else {
        hud.showBanner('No grenades carried. Buy in shop (B).');
      }
    }
  }

  const def = weapon.state.activeDef;
  const spread = weapon.spread(speed, body.crouching, input.state.ads);
  hud.setCrosshairSpread(spread);
  hud.showDmrScope(def.isDmr && input.state.ads);

  if (gameState.phase !== 'buy') {
    player.step(dt, input.state.keys);
  }
  weapon.step(dt, input.state.ads);
  targets.step(dt, performance.now() / 1000);

  const targetFov = input.state.ads ? def.adsFov : 74;
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 16);
  camera.updateProjectionMatrix();

  hud.setTimer(gameState.timer);
  hud.setStatus(body.health, body.armour, body.money);
  hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, def.name);
  hud.setAliveCounts(bots.livingCount('attackers') + (body.health > 0 ? 1 : 0), bots.livingCount('defenders'));

  if (bomb.state.planted) {
    hud.setBombStatus(`BOMB PLANTED (${Math.ceil(bomb.state.timer)}s) - DEFUSE WITH E`);
    if (Math.random() < 0.05) audio.playBeep(1 + (45 - bomb.state.timer) * 0.05);
  } else if (bomb.state.plantProgress > 0) {
    hud.setBombStatus(`PLANTING... ${Math.round(bomb.state.plantProgress * 33)}%`);
  } else {
    hud.setBombStatus('');
  }

  if (input.state.firing && weapon.ready() && gameState.phase === 'live') {
    if (def.automatic || input.consumeEvents().includes('MouseDown')) {
      shoot(shot ? 0 : spread);
    } else {
      shoot(shot ? 0 : spread);
      input.state.firing = false;
    }
  }

  if (body.health <= 0 && gameState.phase === 'live') {
    audio.playLoss();
    rounds.endRound('defenders', 'Attacker eliminated');
  }
}

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);

    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
  }
  renderer.render(scene, camera);
}

let frozen = false;

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  body.pitch = 0;
  body.yaw = 0;
  if (name === 'play') {
    body.position.set(-14, 0, 5);
    settle(20);
    aimAt(new THREE.Vector3(-14, 1.0, -10));
    addTracer(camera.position, new THREE.Vector3(-14, 1.0, -15));
    shoot(0);
    settle(10);
  } else if (name === 'end') {
    gameState.phase = 'matchEnded';
    gameState.attackerScore = 5;
    hud.setScores(5, 0);
    body.position.set(0, 0, 10);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, -4));
    hud.showOverlay('end', 'ATTACKERS WIN THE MATCH! Click restart.');
  } else if (name === 'buy') {
    body.position.set(0, 0, 24);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, 0));
    rounds.startBuyPhase();
    hud.showOverlay('buy');
  } else if (name === 'start') {
    body.position.set(0, 0, 24);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, 0));
    rounds.startBuyPhase();
    hud.showOverlay('start');
  } else {
    body.position.set(0, 0, 24);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.5, 0));
    rounds.startBuyPhase();
    hud.showOverlay('buy');
  }
  hud.setStatus(body.health, body.armour, body.money);
  hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, weapon.state.activeDef.name);
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

syncCamera();
if (shot) {
  runShot(shot);
} else {
  rounds.startBuyPhase();
  requestAnimationFrame(frame);
}
