// GRENADES (grenades.js): frag grenade (arcs, bounces, 1.6s fuse, flash, ring, 8m falloff damage, camera shake)
// and smoke grenade (6m cloud, 12s duration, blocks bot vision). Thrown with throw key 4.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createGrenades(scene, world, player, bots, hud, audio) {
  const grenades = [];
  const smokes = [];

  const fragGeom = new THREE.SphereGeometry(0.1, 8, 8);
  const fragMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.8 });
  const smokeGeom = new THREE.SphereGeometry(0.12, 8, 8);
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });

  const ringGeom = new THREE.RingGeometry(0.1, 0.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), side: THREE.DoubleSide, transparent: true, opacity: 0.8 });

  function throwGrenade(type, camera, playerState) {
    if (type === 'frag' && !playerState.hasFrag) return false;
    if (type === 'smoke' && !playerState.hasSmoke) return false;

    if (type === 'frag') playerState.hasFrag = false;
    if (type === 'smoke') playerState.hasSmoke = false;

    const mesh = new THREE.Mesh(type === 'frag' ? fragGeom : smokeGeom, type === 'frag' ? fragMat : smokeMat);
    const pos = camera.position.clone();
    mesh.position.copy(pos);
    scene.add(mesh);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const velocity = dir.clone().multiplyScalar(14).add(new THREE.Vector3(0, 4, 0));

    grenades.push({
      mesh,
      type,
      position: pos,
      velocity,
      age: 0,
      bounced: false,
      exploded: false,
    });
    audio.playReload();
    return true;
  }

  function step(dt, playerPos, colliders) {
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.life -= dt;
      if (s.life <= 0) {
        if (s.mesh) scene.remove(s.mesh);
        smokes.splice(i, 1);
      }
    }

    for (let i = grenades.length - 1; i >= 0; i--) {
      const g = grenades[i];
      g.age += dt;
      g.velocity.y -= 18 * dt;
      g.position.addScaledVector(g.velocity, dt);
      g.mesh.position.copy(g.position);

      if (g.position.y <= 0.1) {
        g.position.y = 0.1;
        if (!g.bounced) {
          g.velocity.y = -g.velocity.y * 0.4;
          g.velocity.x *= 0.6;
          g.velocity.z *= 0.6;
          g.bounced = true;
        } else {
          g.velocity.set(0, 0, 0);
        }
      }

      if (g.type === 'frag' && g.age >= 1.6 && !g.exploded) {
        g.exploded = true;
        scene.remove(g.mesh);
        audio.playExplosion();

        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.position.copy(g.position);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);
        let ringAge = 0;
        const ringAnim = setInterval(() => {
          ringAge += 0.05;
          ring.scale.setScalar(1 + ringAge * 25);
          ring.material.opacity = Math.max(0, 0.8 - ringAge);
          if (ringAge >= 0.8) {
            clearInterval(ringAnim);
            scene.remove(ring);
          }
        }, 30);

        const distToPlayer = g.position.distanceTo(playerPos);
        if (distToPlayer <= 8) {
          const factor = 1 - (distToPlayer / 8);
          const dmg = Math.round(70 * factor);
          if (player.state.armour > 0) {
            const abs = Math.min(player.state.armour, dmg * 0.5);
            player.state.armour -= abs;
            player.state.health -= (dmg - abs);
          } else {
            player.state.health -= dmg;
          }
          hud.showBanner(`WARNING: Grenade blast near you! (-${dmg} HP)`);
        }

        for (const b of bots.bots) {
          if (!b.alive) continue;
          const d = g.position.distanceTo(b.group.position);
          if (d <= 8) {
            const factor = 1 - (d / 8);
            bots.damageBot(b.torso, Math.round(90 * factor));
          }
        }

        grenades.splice(i, 1);
      } else if (g.type === 'smoke' && g.age >= 1.5 && !g.exploded) {
        g.exploded = true;
        scene.remove(g.mesh);

        const cloudGroup = new THREE.Group();
        cloudGroup.position.copy(g.position);
        const cloudMat = new THREE.MeshStandardMaterial({ color: 0x999999, transparent: true, opacity: 0.6, roughness: 1 });
        for (let c = 0; c < 8; c++) {
          const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 8), cloudMat);
          sphere.position.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
          cloudGroup.add(sphere);
        }
        scene.add(cloudGroup);

        smokes.push({
          position: g.position.clone(),
          radius: 3.0, // ~6m diameter
          life: 12.0,
          mesh: cloudGroup,
        });

        hud.showBanner('Smoke grenade deployed (lasts 12s)');
        grenades.splice(i, 1);
      }
    }
  }

  function isBlockedBySmoke(posA, posB) {
    for (const s of smokes) {
      const line = new THREE.Vector3().subVectors(posB, posA);
      const len = line.length();
      line.normalize();
      const toSmoke = new THREE.Vector3().subVectors(s.position, posA);
      const proj = toSmoke.dot(line);
      if (proj >= 0 && proj <= len) {
        const nearest = posA.clone().addScaledVector(line, proj);
        if (nearest.distanceTo(s.position) <= s.radius) {
          return true;
        }
      }
    }
    return false;
  }

  return {
    throwGrenade,
    step,
    isBlockedBySmoke,
    reset() {
      for (const g of grenades) scene.remove(g.mesh);
      grenades.length = 0;
      for (const s of smokes) if (s.mesh) scene.remove(s.mesh);
      smokes.length = 0;
    }
  };
}
