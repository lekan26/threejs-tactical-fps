// Weapon system: general weapons (Longshot AR-9, Stinger SMG-12, Longbow DMR, Sidearm P9)
// with data entries for damage, head damage, fire rate, magazine, reserve, reload time, spread, recoil, zoom.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const WEAPON_DEFS = {
  'Longshot AR-9': {
    name: 'Longshot AR-9',
    type: 'primary',
    magSize: 30,
    reserve: 90,
    bodyDmg: 34,
    headDmg: 100,
    fireGap: 1 / 9,
    reloadTime: 2.2,
    automatic: true,
    adsFov: 50,
    recoilKick: 0.055,
    spreadBase: 0.002,
  },
  'Stinger SMG-12': {
    name: 'Stinger SMG-12',
    type: 'primary',
    magSize: 32,
    reserve: 96,
    bodyDmg: 22,
    headDmg: 66,
    fireGap: 1 / 13,
    reloadTime: 1.8,
    automatic: true,
    adsFov: 55,
    recoilKick: 0.04,
    spreadBase: 0.004,
  },
  'Longbow DMR': {
    name: 'Longbow DMR',
    type: 'primary',
    magSize: 5,
    reserve: 25,
    bodyDmg: 80,
    headDmg: 200,
    fireGap: 1 / 2.5,
    reloadTime: 2.5,
    automatic: false,
    adsFov: 25,
    isDmr: true,
    recoilKick: 0.12,
    spreadBase: 0.0005,
  },
  'Sidearm P9': {
    name: 'Sidearm P9',
    type: 'sidearm',
    magSize: 12,
    reserve: 36,
    bodyDmg: 25,
    headDmg: 75,
    fireGap: 1 / 5.5,
    reloadTime: 1.6,
    automatic: false,
    adsFov: 55,
    recoilKick: 0.035,
    spreadBase: 0.003,
  },
};

export function createWeapon(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const model = new THREE.Group();
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), bodyMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.4), grip);
  barrel.position.set(0, 0.025, -0.38);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
  stock.position.set(0, -0.02, 0.3);
  model.add(receiver, barrel, stock);
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 5);
  flashLight.position.set(0.24, -0.16, -0.6);
  camera.add(flashLight);

  // Weapon inventory: primary slot (default Longshot AR-9) and sidearm slot (Sidearm P9)
  let primaryName = 'Longshot AR-9';
  const inventory = {
    primary: { defName: 'Longshot AR-9', mag: 30, reserve: 90, cooldown: 0, reloadLeft: 0 },
    sidearm: { defName: 'Sidearm P9', mag: 12, reserve: 36, cooldown: 0, reloadLeft: 0 },
  };

  let activeSlot = 'primary'; // 'primary' or 'sidearm'

  const state = {
    get slot() { return activeSlot; },
    get activeDef() {
      const name = activeSlot === 'primary' ? primaryName : 'Sidearm P9';
      return WEAPON_DEFS[name] || WEAPON_DEFS['Longshot AR-9'];
    },
    get current() {
      return inventory[activeSlot];
    },
    flash: 0,
    kick: 0,
  };

  function setPrimary(name) {
    if (WEAPON_DEFS[name]) {
      primaryName = name;
      const def = WEAPON_DEFS[name];
      inventory.primary = { defName: name, mag: def.magSize, reserve: def.reserve, cooldown: 0, reloadLeft: 0 };
    }
  }

  function selectSlot(slot) {
    if (slot === 'primary' || slot === 'sidearm') {
      activeSlot = slot;
    }
  }

  function step(dt, ads) {
    state.flash = Math.max(0, state.flash - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 14);

    const cur = inventory[activeSlot];
    const def = state.activeDef;
    cur.cooldown = Math.max(0, cur.cooldown - dt);

    if (cur.reloadLeft > 0) {
      cur.reloadLeft = Math.max(0, cur.reloadLeft - dt);
      model.rotation.x = -0.55 * Math.min(1, (def.reloadTime - cur.reloadLeft) * 2);
      if (cur.reloadLeft === 0) {
        const need = def.magSize - cur.mag;
        const take = Math.min(need, cur.reserve);
        cur.mag += take;
        cur.reserve -= take;
      }
    } else {
      model.position.z = -0.42 + state.kick + (ads ? 0.08 : 0);
      model.position.x = ads ? 0.08 : 0.24;
      model.rotation.x = state.kick * 2.2;
    }
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 30;
    flashLight.intensity = state.flash > 0 ? 18 : 0;
  }

  return {
    state,
    step,
    setPrimary,
    selectSlot,
    ready() {
      const cur = inventory[activeSlot];
      return cur.mag > 0 && cur.cooldown === 0 && cur.reloadLeft === 0;
    },
    pullTrigger() {
      const def = state.activeDef;
      const cur = inventory[activeSlot];
      cur.cooldown = def.fireGap;
      state.flash = 0.06;
      state.kick = def.recoilKick;
    },
    takeRound() {
      const cur = inventory[activeSlot];
      if (cur.mag <= 0) return false;
      cur.mag -= 1;
      return true;
    },
    reload() {
      const def = state.activeDef;
      const cur = inventory[activeSlot];
      if (cur.reloadLeft > 0 || cur.mag === def.magSize || cur.reserve === 0) return;
      cur.reloadLeft = def.reloadTime;
    },
    spread(speed, crouching, ads) {
      const def = state.activeDef;
      let base = def.spreadBase;
      if (speed > 1.0) base += 0.025;
      if (crouching) base *= 0.6;
      if (ads) base *= def.isDmr ? 0.1 : 0.35;
      return base;
    },
    refill() {
      for (const s of ['primary', 'sidearm']) {
        const name = s === 'primary' ? primaryName : 'Sidearm P9';
        const def = WEAPON_DEFS[name];
        inventory[s] = { defName: name, mag: def.magSize, reserve: def.reserve, cooldown: 0, reloadLeft: 0 };
      }
      state.flash = 0;
      state.kick = 0;
    },
  };
}
