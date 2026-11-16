// ROUNDS (rounds.js): phase management (Buy phase 15s, Live phase 100s, End phase 5s),
// scores, first to 5 match wins, win conditions for attackers and defenders, round reset.
import { gameState } from './state.js';

export function createRoundManager(player, bots, bomb, hud, weapon) {
  function startBuyPhase() {
    gameState.phase = 'buy';
    gameState.timer = 15;
    bomb.reset();
    player.reset();
    bots.reset();
    weapon.refill();
    hud.showBanner('BUY PHASE - PRESS B TO BUY (15s)');
    hud.setStatus(player.state.health, player.state.armour, player.state.money);
    hud.setAmmo(weapon.state.current.mag, weapon.state.current.reserve, weapon.state.activeDef.name);
  }

  function startLivePhase() {
    gameState.phase = 'live';
    gameState.timer = 100;
    hud.showBanner('ROUND LIVE - ELIMINATE ENEMIES OR PLANT BOMB');
  }

  function endRound(winnerTeam, reason) {
    gameState.phase = 'ended';
    gameState.timer = 5;
    if (winnerTeam === 'attackers') {
      gameState.attackerScore += 1;
      hud.showBanner(`ATTACKERS WIN ROUND: ${reason}`);
    } else {
      gameState.defenderScore += 1;
      hud.showBanner(`DEFENDERS WIN ROUND: ${reason}`);
    }
    hud.setScores(gameState.attackerScore, gameState.defenderScore);

    // Check match win (first to 5)
    if (gameState.attackerScore >= 5 || gameState.defenderScore >= 5) {
      gameState.phase = 'matchEnded';
      const matchWinner = gameState.attackerScore >= 5 ? 'ATTACKERS' : 'DEFENDERS';
      hud.showOverlay('end', `${matchWinner} WIN THE MATCH! Click restart.`);
    }
  }

  function step(dt) {
    if (gameState.phase === 'buy') {
      gameState.timer = Math.max(0, gameState.timer - dt);
      if (gameState.timer <= 0) {
        startLivePhase();
      }
    } else if (gameState.phase === 'live') {
      // If bomb is planted, live timer stops and bomb timer runs
      if (bomb.state.planted) {
        if (bomb.state.exploded) {
          endRound('attackers', 'Bomb detonated');
        } else if (bomb.state.defused) {
          endRound('defenders', 'Bomb defused');
        }
      } else {
        gameState.timer = Math.max(0, gameState.timer - dt);
        if (gameState.timer <= 0) {
          endRound('defenders', 'Time expired without plant');
        }
      }

      // Check elimination conditions
      const aliveAttackers = bots.livingCount('attackers') + (player.state.health > 0 ? 1 : 0);
      const aliveDefenders = bots.livingCount('defenders');

      if (aliveDefenders === 0) {
        endRound('attackers', 'All defenders eliminated');
      } else if (aliveAttackers === 0) {
        endRound('defenders', 'All attackers eliminated');
      }
    } else if (gameState.phase === 'ended') {
      gameState.timer = Math.max(0, gameState.timer - dt);
      if (gameState.timer <= 0) {
        startBuyPhase();
      }
    }
  }

  return {
    startBuyPhase,
    startLivePhase,
    endRound,
    step,
  };
}
