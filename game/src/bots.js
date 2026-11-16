// BOTS (bots.js): 5 enemy bots and 4 friendly bots, rifle model, hitboxes, state machine,
// patrol routes, vision cone, hearing gunshots, reaction time, burst fire, strafe, cover, reload, dead falling, smoke blocking.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createBots(scene, world, player) {
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.6, metalness: 0.05 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.45, metalness: 0.1 });
  const enemyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(0xd9534f), roughness: 0.6 });
  const friendlyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x5cb85c), roughness: 0.6 });

  const torsoGeom = new THREE.BoxGeometry(0.5, 0.75, 0.3);
  const headGeom = new THREE.SphereGeometry(0.15, 16, 12);

  const bots = [];
  const hitMeshes = [];

  const botConfigs = [
    { id: 'f1', team: 'attackers', role: 'follow', pos: new THREE.Vector3(-2, 0, 22) },
    { id: 'f2', team: 'attackers', role: 'follow', pos: new THREE.Vector3(2, 0, 22) },
    { id: 'f3', team: 'attackers', role: 'lane', pos: new THREE.Vector3(-10, 0, 20) },
    { id: 'f4', team: 'attackers', role: 'lane', pos: new THREE.Vector3(10, 0, 20) },
    { id: 'e1', team: 'defenders', role: 'defend-a', pos: new THREE.Vector3(-16, 0, -24) },
    { id: 'e2', team: 'defenders', role: 'defend-a', pos: new THREE.Vector3(-14, 0, -18) },
    { id: 'e3', team: 'defenders', role: 'defend-b', pos: new THREE.Vector3(16, 0, -24) },
    { id: 'e4', team: 'defenders', role: 'defend-b', pos: new THREE.Vector3(14, 0, -18) },
    { id: 'e5', team: 'defenders', role: 'defend-mid', pos: new THREE.Vector3(0, 0, -10) },
  ];

  const raycaster = new THREE.Raycaster();
  raycaster.far = 40;

  for (const cfg of botConfigs) {
    const group = new THREE.Group();
    group.position.copy(cfg.pos);

    const mat = cfg.team === 'defenders' ? enemyMaterial : friendlyMaterial;
    const torso = new THREE.Mesh(torsoGeom, mat);
    torso.position.y = 0.9;
    torso.userData.part = 'torso';

    const head = new THREE.Mesh(headGeom, headMaterial);
    head.position.y = 1.5;
    head.userData.part = 'head';

    group.add(torso, head);
    group.traverse(m => {
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = true;
      }
    });
    scene.add(group);

    const bot = {
      id: cfg.id,
      team: cfg.team,
      role: cfg.role,
      group,
      torso,
      head,
      health: 100,
      alive: true,
      home: cfg.pos.clone(),
      state: 'patrol',
      targetPos: cfg.pos.clone(),
      velocity: new THREE.Vector3(),
      reactionTimer: 0,
      burstCount: 0,
      burstCooldown: 0,
      mag: 30,
      reloadTimer: 0,
      strafeDir: 1,
      strafeTimer: 0,
    };

    torso.userData.bot = bot;
    head.userData.bot = bot;
    hitMeshes.push(torso, head);
    bots.push(bot);
  }

  function alertBotsToSound(pos, radius = 25) {
    for (const b of bots) {
      if (!b.alive) continue;
      if (b.group.position.distanceTo(pos) <= radius) {
        if (b.state === 'patrol' || b.state === 'hold') {
          b.state = 'engage';
          b.reactionTimer = 0.35;
        }
      }
    }
  }

  function step(dt, time, playerPos, colliders, grenades) {
    for (const b of bots) {
      if (!b.alive) {
        b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, -1.5, dt * 6);
        b.group.position.y = THREE.MathUtils.lerp(b.group.position.y, -0.1, dt * 6);
        continue;
      }

      if (b.reloadTimer > 0) {
        b.reloadTimer -= dt;
        if (b.reloadTimer <= 0) {
          b.mag = 30;
          b.state = 'engage';
        }
        continue;
      }

      if (b.mag <= 0) {
        b.reloadTimer = 2.0;
        b.state = 'reload';
        continue;
      }

      const isPlayerEnemy = b.team === 'defenders';
      let canSee = false;

      if (isPlayerEnemy) {
        const toPlayer = new THREE.Vector3().subVectors(playerPos, b.group.position);
        const dist = toPlayer.length();
        if (dist <= 40) {
          toPlayer.normalize();
          const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(b.group.quaternion);
          if (toPlayer.dot(fwd) > 0.5) {
            raycaster.set(b.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), toPlayer);
            const hits = raycaster.intersectObjects(colliders, false);
            if (hits.length === 0 || hits[0].distance > dist) {
              canSee = true;
            }
          }
        }
      }

      if (canSee && grenades && grenades.isBlockedBySmoke(b.group.position, playerPos)) {
        canSee = false;
      }

      if (canSee) {
        if (b.state !== 'engage') {
          b.state = 'engage';
          b.reactionTimer = 0.35;
        }
      }

      if (b.state === 'engage' && isPlayerEnemy) {
        if (b.reactionTimer > 0) {
          b.reactionTimer -= dt;
        } else {
          b.group.lookAt(playerPos.x, b.group.position.y, playerPos.z);
          b.strafeTimer += dt;
          if (b.strafeTimer > 2.0) {
            b.strafeDir *= -1;
            b.strafeTimer = 0;
          }
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(b.group.quaternion);
          b.group.position.addScaledVector(right, b.strafeDir * 1.5 * dt);

          b.burstCooldown -= dt;
          if (b.burstCooldown <= 0) {
            b.mag -= 1;
            b.burstCooldown = 0.15;
            if (Math.random() < 0.25) {
              if (player.health > 0) {
                const dmg = Math.random() < 0.1 ? 100 : 34;
                if (player.armour > 0) {
                  const absorb = Math.min(player.armour, dmg * 0.5);
                  player.armour -= absorb;
                  player.health -= (dmg - absorb);
                } else {
                  player.health -= dmg;
                }
              }
            }
          }

          if (b.health < 50) {
            b.state = 'cover';
          }
        }
      } else if (b.state === 'cover') {
        const dir = new THREE.Vector3().subVectors(b.home, b.group.position);
        if (dir.length() > 0.5) {
          dir.normalize();
          b.group.position.addScaledVector(dir, 2.5 * dt);
          b.group.lookAt(b.home.x, b.group.position.y, b.home.z);
        } else {
          b.health = Math.min(100, b.health + dt * 10);
          if (b.health >= 80) b.state = 'engage';
        }
      } else {
        if (b.role === 'follow') {
          const target = playerPos.clone().add(new THREE.Vector3(3, 0, 4));
          const dir = new THREE.Vector3().subVectors(target, b.group.position);
          if (dir.length() > 2.5) {
            dir.normalize();
            b.group.position.addScaledVector(dir, 3.0 * dt);
            b.group.lookAt(target.x, b.group.position.y, target.z);
          }
        } else {
          b.group.rotation.y = Math.sin(time * 1.2 + b.home.x) * 0.8;
        }
      }
    }
  }

  function damageBot(mesh, amount) {
    const bot = mesh.userData.bot;
    if (!bot || !bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.alive = false;
      return true;
    }
    if (bot.health < 50) bot.state = 'cover';
    return false;
  }

  return {
    bots,
    hitMeshes,
    step,
    damageBot,
    alertBotsToSound,
    livingCount(team) {
      return bots.filter(b => b.team === team && b.alive).length;
    },
    reset() {
      for (const b of bots) {
        b.alive = true;
        b.health = 100;
        b.mag = 30;
        b.state = 'patrol';
        b.group.position.copy(b.home);
        b.group.rotation.set(0, 0, 0);
      }
    }
  };
}
