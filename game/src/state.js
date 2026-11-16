// Central Game State for Foundry Yard Tactical FPS
import * as THREE from 'three';

export const gameState = {
  phase: 'buy', // 'buy', 'live', 'ended', 'matchEnded'
  timer: 15,    // active phase timer (15s buy, 100s live, 5s end)
  buyTimer: 15,
  liveTimer: 100,
  endTimer: 5,
  attackerScore: 0,
  defenderScore: 0,
  matchWinScore: 5,

  player: {
    money: 800,
    health: 100,
    armour: 0,
    primary: 'Longshot AR-9', // owned primary
    sidearm: 'Sidearm P9',   // always owned
    hasArmour: false,
    hasFrag: false,
    hasSmoke: false,
    activeSlot: 0, // 0: primary, 1: sidearm, 2: grenade/slot
  },

  economy: {
    consecutiveLosses: 0,
    killReward: 300,
    winReward: 3250,
    baseLossReward: 1900,
    lossIncrement: 500,
    maxLossReward: 2900,
    plantReward: 300,
  },

  bomb: {
    carrier: 'player', // 'player' or bot id or null
    planted: false,
    position: new THREE.Vector3(),
    site: null, // 'A' or 'B'
    timer: 45,
    plantProgress: 0,
    defuseProgress: 0,
    planter: null,
    defuser: null,
    exploded: false,
    defused: false,
  },

  bots: [], // list of bot instances
  killFeed: [],
  bannerText: 'BUY PHASE - PRESS B TO BUY',
  winner: null, // 'attackers' or 'defenders'
};
