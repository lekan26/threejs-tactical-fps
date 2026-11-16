// Economy and Buy Menu logic: prices, loadout rules, rewards.
import { gameState } from './state.js';

export const CATALOG = [
  { id: 'ar9', name: 'Longshot AR-9', price: 2700, type: 'primary' },
  { id: 'smg12', name: 'Stinger SMG-12', price: 1500, type: 'primary' },
  { id: 'dmr', name: 'Longbow DMR', price: 4000, type: 'primary' },
  { id: 'armour', name: 'Armour Vest', price: 650, type: 'armour' },
  { id: 'frag', name: 'Frag Grenade', price: 300, type: 'grenade' },
  { id: 'smoke', name: 'Smoke Grenade', price: 300, type: 'grenade' },
  { id: 'p9', name: 'Sidearm P9', price: 0, type: 'sidearm' },
];

export function buyItem(itemId, weaponSystem) {
  if (gameState.phase !== 'buy') return { success: false, message: 'Can only buy during Buy Phase' };
  const item = CATALOG.find(i => i.id === itemId);
  if (!item) return { success: false, message: 'Unknown item' };

  if (gameState.player.money < item.price) {
    return { success: false, message: `Not enough money (needs $${item.price}, has $${gameState.player.money})` };
  }

  if (item.type === 'primary') {
    gameState.player.money -= item.price;
    gameState.player.primary = item.name;
    weaponSystem.setPrimary(item.name);
    return { success: true, message: `Purchased ${item.name}` };
  } else if (item.type === 'armour') {
    if (gameState.player.hasArmour) return { success: false, message: 'Armour already owned' };
    gameState.player.money -= item.price;
    gameState.player.hasArmour = true;
    gameState.player.armour = 50;
    return { success: true, message: 'Purchased Armour Vest' };
  } else if (item.type === 'grenade') {
    if (itemId === 'frag' && gameState.player.hasFrag) return { success: false, message: 'Frag grenade already owned' };
    if (itemId === 'smoke' && gameState.player.hasSmoke) return { success: false, message: 'Smoke grenade already owned' };
    gameState.player.money -= item.price;
    if (itemId === 'frag') gameState.player.hasFrag = true;
    if (itemId === 'smoke') gameState.player.hasSmoke = true;
    return { success: true, message: `Purchased ${item.name}` };
  } else if (item.type === 'sidearm') {
    return { success: true, message: 'Sidearm P9 is already owned' };
  }
  return { success: false, message: 'Invalid purchase' };
}

export function awardKill() {
  gameState.player.money = Math.min(16000, gameState.player.money + gameState.economy.killReward);
}

export function awardPlant() {
  gameState.player.money = Math.min(16000, gameState.player.money + gameState.economy.plantReward);
}

export function awardRoundEnd(winnerTeam) {
  const isAttackerWin = winnerTeam === 'attackers';
  // If player is attacker and attackers win, or player is defender and defenders win
  // Assume player is Attacker as specified ("the player is the attacker bomb carrier")
  const playerTeam = 'attackers';
  const won = winnerTeam === playerTeam;

  if (won) {
    gameState.player.money = Math.min(16000, gameState.player.money + gameState.economy.winReward);
    gameState.economy.consecutiveLosses = 0;
  } else {
    gameState.economy.consecutiveLosses = Math.min(4, gameState.economy.consecutiveLosses + 1);
    const lossReward = Math.min(
      gameState.economy.maxLossReward,
      gameState.economy.baseLossReward + (gameState.economy.consecutiveLosses - 1) * gameState.economy.lossIncrement
    );
    gameState.player.money = Math.min(16000, gameState.player.money + lossReward);
  }
}
