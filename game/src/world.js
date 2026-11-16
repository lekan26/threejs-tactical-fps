// Foundry Yard: an industrial yard at dusk with canvas textures, hazard stripes, crate labels,
// floodlight cones over bomb sites, emissive lamp strips, lanes, and colliders.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

function createHazardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e2228';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f0a830';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(32, 0); ctx.lineTo(0, 32); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(64, 0); ctx.lineTo(96, 0); ctx.lineTo(0, 96); ctx.lineTo(0, 64); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(128, 0); ctx.lineTo(128, 32); ctx.lineTo(32, 128); ctx.lineTo(0, 128); ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

function createCrateTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e2228';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#f0a830';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 128);
  ctx.strokeStyle = '#f0a830';
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 224, 224);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.4 : 0.75,
      metalness: name === 'accent' ? 0.2 : 0.05,
    });
  }

  const hazardMat = new THREE.MeshStandardMaterial({
    map: createHazardTexture(),
    roughness: 0.6,
  });

  const crateA_Mat = new THREE.MeshStandardMaterial({
    map: createCrateTexture('SITE A'),
    roughness: 0.6,
  });

  const crateB_Mat = new THREE.MeshStandardMaterial({
    map: createCrateTexture('SITE B'),
    roughness: 0.6,
  });

  const lampMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(PALETTE.accent),
    emissive: new THREE.Color(PALETTE.accent),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material = 'surface', customMat = null) {
    const mat = customMat || materials[material] || materials.surface;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function cylinder(radiusTop, radiusBottom, height, radialSegments, x, y, z, material = 'hairline') {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
      materials[material] || materials.surface
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Ground floor with floor markings / hazard border
  box(42, 0.4, 64, 0, -0.2, 0, 'canvas');

  // Outer perimeter walls
  box(0.6, 5.0, 64, -21, 2.5, 0, 'surface');
  box(0.6, 5.0, 64, 21, 2.5, 0, 'surface');
  box(42.6, 5.0, 0.6, 0, 2.5, -32, 'surface');
  box(42.6, 5.0, 0.6, 0, 2.5, 32, 'surface');

  // Central container stack with hazard / labels
  box(6.8, 2.6, 3.2, 0, 1.3, -2, 'hairline', crateA_Mat);
  box(6.8, 2.6, 3.2, 0, 1.3, 3, 'hairline', crateB_Mat);

  // A Long cover
  box(2.2, 1.2, 4.0, -14, 0.6, -12, 'hairline', hazardMat);
  box(1.8, 0.9, 1.8, -14, 0.45, -2, 'hairline');
  box(2.2, 1.4, 3.0, -14, 0.7, 10, 'hairline');

  // B Tunnel cover
  box(2.2, 1.2, 4.0, 14, 0.6, -12, 'hairline', hazardMat);
  box(1.8, 0.9, 1.8, 14, 0.45, 1, 'hairline');
  box(2.2, 1.4, 3.0, 14, 0.7, 12, 'hairline');

  // Mid connector cover & barrels
  cylinder(0.5, 0.5, 1.2, 12, -4, 0.6, -8, 'hairline');
  cylinder(0.5, 0.5, 1.2, 12, 4, 0.6, -8, 'hairline');
  cylinder(0.5, 0.5, 1.2, 12, -4, 0.6, 8, 'hairline');
  cylinder(0.5, 0.5, 1.2, 12, 4, 0.6, 8, 'hairline');

  // Bomb Site A & B
  box(4.0, 0.2, 4.0, -16, 0.1, -26, 'accent');
  box(4.0, 0.2, 4.0, 16, 0.1, -26, 'accent');

  // Emissive lamp strips on walls and along lanes / bomb sites
  box(0.2, 0.2, 8.0, -20.6, 4.0, -15, 'canvas', lampMaterial);
  box(0.2, 0.2, 8.0, 20.6, 4.0, -15, 'canvas', lampMaterial);
  box(0.2, 0.2, 8.0, -20.6, 4.0, 15, 'canvas', lampMaterial);
  box(0.2, 0.2, 8.0, 20.6, 4.0, 15, 'canvas', lampMaterial);

  // Additional emissive lamp strips along lanes and over bomb sites
  box(4.2, 0.2, 0.2, -16, 0.2, -28, 'canvas', lampMaterial);
  box(0.2, 0.2, 4.2, -18, 0.2, -26, 'canvas', lampMaterial);
  box(4.2, 0.2, 0.2, 16, 0.2, -28, 'canvas', lampMaterial);
  box(0.2, 0.2, 4.2, 18, 0.2, -26, 'canvas', lampMaterial);

  // Warm floodlight cones over both bomb sites
  const spotA = new THREE.SpotLight(new THREE.Color(PALETTE.accent), 14, 55, Math.PI / 2.5, 0.4, 1);
  spotA.position.set(-16, 16, -26);
  spotA.target.position.set(-16, 0, -26);
  scene.add(spotA, spotA.target);

  const spotB = new THREE.SpotLight(new THREE.Color(PALETTE.accent), 14, 55, Math.PI / 2.5, 0.4, 1);
  spotB.position.set(16, 16, -26);
  spotB.target.position.set(16, 0, -26);
  scene.add(spotB, spotB.target);

  const waypoints = [
    { name: 'attacker-spawn', position: new THREE.Vector3(0, 0, 26) },
    { name: 'defender-spawn', position: new THREE.Vector3(0, 0, -26) },
    { name: 'site-a', position: new THREE.Vector3(-16, 0, -26) },
    { name: 'site-b', position: new THREE.Vector3(16, 0, -26) },
    { name: 'mid-yard', position: new THREE.Vector3(0, 0, 0) },
    { name: 'a-long', position: new THREE.Vector3(-14, 0, -5) },
    { name: 'b-tunnel', position: new THREE.Vector3(14, 0, -5) },
  ];

  const lanes = {
    aLong: [new THREE.Vector3(-14, 0, 20), new THREE.Vector3(-14, 0, 0), new THREE.Vector3(-14, 0, -20)],
    mid: [new THREE.Vector3(0, 0, 20), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -20)],
    bTunnel: [new THREE.Vector3(14, 0, 20), new THREE.Vector3(14, 0, 0), new THREE.Vector3(14, 0, -20)],
  };

  // Dusk sky gradient dome / atmosphere
  scene.background = new THREE.Color(PALETTE.canvas);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 22, 75);

  const ambient = new THREE.AmbientLight(new THREE.Color(PALETTE.ink), 1.0);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(new THREE.Color(PALETTE.surface), new THREE.Color(PALETTE.canvas), 3.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(new THREE.Color(PALETTE.ink), 3.8);
  dir.position.set(12, 24, 12);
  dir.target.position.set(0, 0, 0);
  scene.add(dir, dir.target);

  const fill = new THREE.DirectionalLight(new THREE.Color(PALETTE.muted), 2.0);
  fill.position.set(-12, 16, -10);
  scene.add(fill);

  return { colliders, shootables, group, waypoints, lanes };
}
