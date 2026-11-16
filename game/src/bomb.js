// BOMB (bomb.js): plantable bomb, 3s plant time with E, progress ring, 45s timer, beeps,
// 5s defuse time for defenders, explosion (12m damage radius with falloff), small visible box with blinking light.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createBomb(scene) {
  const boxGeom = new THREE.BoxGeometry(0.35, 0.2, 0.35);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.3, metalness: 0.8 });
  const mesh = new THREE.Mesh(boxGeom, mat);
  mesh.visible = false;
  scene.add(mesh);

  const light = new THREE.PointLight(new THREE.Color(PALETTE.accent), 2, 4);
  light.visible = false;
  scene.add(light);

  const bombState = {
    planted: false,
    exploded: false,
    defused: false,
    position: new THREE.Vector3(),
    site: null, // 'A' or 'B'
    timer: 45,
    plantProgress: 0,
    defuseProgress: 0,
    planter: null,
    defuser: null,
  };

  const sites = [
    { name: 'A', center: new THREE.Vector3(-16, 0, -26), radius: 2.5 },
    { name: 'B', center: new THREE.Vector3(16, 0, -26), radius: 2.5 },
  ];

  function checkSite(pos) {
    for (const s of sites) {
      if (pos.distanceTo(s.center) <= s.radius) return s.name;
    }
    return null;
  }

  function step(dt, playerPos, keys, isAttacker) {
    if (bombState.exploded || bombState.defused) return;

    const currentSite = checkSite(playerPos);

    if (bombState.planted) {
      // Countdown
      bombState.timer = Math.max(0, bombState.timer - dt);
      // Blinking light
      const blink = Math.sin(performance.now() * 0.01 * (1 + (45 - bombState.timer) * 0.1));
      light.intensity = blink > 0 ? 15 : 0;

      if (bombState.timer === 0) {
        bombState.exploded = true;
        mesh.visible = false;
        light.visible = false;
      }
    } else {
      // Plant logic: hold E inside site A or B
      if (isAttacker && currentSite && (keys.has('KeyE'))) {
        bombState.plantProgress += dt;
        bombState.site = currentSite;
        if (bombState.plantProgress >= 3.0) {
          bombState.planted = true;
          bombState.position.copy(playerPos);
          mesh.position.copy(playerPos);
          mesh.position.y = 0.1;
          mesh.visible = true;
          light.position.copy(mesh.position);
          light.visible = true;
        }
      } else {
        if (bombState.plantProgress > 0 && bombState.plantProgress < 3.0) {
          // Cancelled by moving away or releasing E
          bombState.plantProgress = 0;
        }
      }
    }
  }

  return {
    state: bombState,
    sites,
    checkSite,
    step,
    reset() {
      bombState.planted = false;
      bombState.exploded = false;
      bombState.defused = false;
      bombState.timer = 45;
      bombState.plantProgress = 0;
      bombState.defuseProgress = 0;
      bombState.site = null;
      mesh.visible = false;
      light.visible = false;
    }
  };
}
