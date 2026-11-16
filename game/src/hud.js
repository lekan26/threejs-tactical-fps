// DOM HUD overlay: health, armour, money, ammo, timer, team scores, crosshair spread,
// hitmarker, kill feed, banners, overlay / buy menu, alive counts, bomb hud, dmr scope.
const COPY = {
  start: {
    showBuyMenu: true,
    showCard: false,
  },
  buy: {
    title: 'Foundry Yard',
    copy: 'Industrial tactical shooter at dusk. Clear the yard or plant the objective. Click to play.',
    action: 'Click to play',
    showBuyMenu: true,
    showCard: true,
  },
  paused: {
    title: 'Foundry Yard',
    copy: 'Paused. Click to resume.',
    action: 'Click to resume',
    showBuyMenu: false,
    showCard: true,
  },
  end: {
    title: 'Round Over',
    copy: 'Round ended.',
    action: 'Next Round',
    showBuyMenu: false,
    showCard: true,
  },
};

export function createHud() {
  const overlay = document.getElementById('overlay');
  const title = document.getElementById('overlay-title');
  const copy = document.getElementById('overlay-copy');
  const play = document.getElementById('play');
  const ammo = document.getElementById('ammo');
  const ammoMag = document.getElementById('ammo-mag');
  const ammoReserve = document.getElementById('ammo-reserve');
  const statHp = document.getElementById('stat-hp');
  const statArm = document.getElementById('stat-arm');
  const statMoney = document.getElementById('stat-money');
  const buyStatMoney = document.getElementById('buy-stat-money');
  const scoreAtt = document.getElementById('score-att');
  const scoreDef = document.getElementById('score-def');
  const attAlive = document.getElementById('att-alive');
  const defAlive = document.getElementById('def-alive');
  const timerEl = document.getElementById('timer');
  const weaponNameEl = document.getElementById('weapon-name');
  const hitmarker = document.getElementById('hitmarker');
  const crosshair = document.getElementById('crosshair');
  const banner = document.getElementById('banner');
  const killFeed = document.getElementById('kill-feed');
  const bombHud = document.getElementById('bomb-hud');
  const dmrScope = document.getElementById('dmr-scope');
  const vignette = document.getElementById('vignette');

  const btnBuyAr9 = document.getElementById('btn-buy-ar9');
  const btnBuySmg12 = document.getElementById('btn-buy-smg12');
  const btnBuyDmr = document.getElementById('btn-buy-dmr');
  const btnBuyArmour = document.getElementById('btn-buy-armour');
  const btnBuyFrag = document.getElementById('btn-buy-frag');
  const btnBuySmoke = document.getElementById('btn-buy-smoke');
  const btnBuyP9 = document.getElementById('btn-buy-p9');

  let hitTimer = 0;
  let bannerTimer = 0;
  let lastMag = -1;
  let lastReserve = -1;
  let lastHp = -1;
  let lastArm = -1;
  let lastMoney = -1;

  return {
    setAmmo(mag, reserve, weaponName) {
      if (mag === lastMag && reserve === lastReserve) return;
      lastMag = mag;
      lastReserve = reserve;
      ammoMag.textContent = String(mag);
      ammoReserve.textContent = `/ ${reserve}`;
      ammo.classList.toggle('empty', mag === 0);
      if (weaponName) weaponNameEl.textContent = weaponName;
    },
    setStatus(hp, arm, money, hasFrag, hasSmoke) {
      if (hp !== lastHp) {
        lastHp = hp;
        statHp.textContent = String(hp);
        if (hp <= 30) {
          statHp.classList.add('low-health');
          vignette.classList.add('active');
        } else {
          statHp.classList.remove('low-health');
          vignette.classList.remove('active');
        }
      }
      if (arm !== lastArm) {
        lastArm = arm;
        statArm.textContent = String(arm);
      }
      if (money !== lastMoney) {
        lastMoney = money;
        statMoney.textContent = String(money);
        if (buyStatMoney) buyStatMoney.textContent = String(money);
      }
    },
    setScores(att, def) {
      scoreAtt.textContent = String(att);
      scoreDef.textContent = String(def);
    },
    setAliveCounts(att, def) {
      attAlive.textContent = String(att);
      defAlive.textContent = String(def);
    },
    setBombStatus(text) {
      bombHud.textContent = text;
    },
    setTimer(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      timerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    },
    setCrosshairSpread(spread) {
      const px = 16 + spread * 400;
      crosshair.style.width = `${px * 2}px`;
      crosshair.style.height = `${px * 2}px`;
    },
    showDmrScope(show) {
      dmrScope.classList.toggle('show', show);
    },
    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.style.transform = killed ? 'translate(-50%, -50%) rotate(45deg) scale(1.25)' : '';
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => {
        hitmarker.classList.remove('on');
        hitmarker.style.transform = '';
      }, holdMs);
    },
    showBanner(text, durationMs = 2500) {
      banner.textContent = text;
      banner.classList.add('show');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        banner.classList.remove('show');
      }, durationMs);
    },
    addKillFeed(text) {
      const item = document.createElement('div');
      item.className = 'kill-item';
      item.textContent = text;
      killFeed.appendChild(item);
      setTimeout(() => item.remove(), 4000);
    },
    showOverlay(mode, extraText) {
      const cfg = COPY[mode] || COPY.buy;
      const headerGroup = document.getElementById('overlay-header-group');
      const buyMenuGroup = document.getElementById('buy-menu-group');
      if (headerGroup) headerGroup.style.display = cfg.showCard ? 'block' : 'none';
      if (buyMenuGroup) buyMenuGroup.style.display = cfg.showBuyMenu ? 'block' : 'none';
      if (cfg.showCard) {
        title.textContent = cfg.title;
        copy.textContent = extraText ? `${cfg.copy} ${extraText}` : cfg.copy;
        play.textContent = cfg.action;
      }
      overlay.hidden = false;
      if (cfg.showCard && play) play.focus();
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      play.addEventListener('click', handler);
    },
    onBuy(handler) {
      if (btnBuyAr9) btnBuyAr9.addEventListener('click', () => handler('ar9'));
      if (btnBuySmg12) btnBuySmg12.addEventListener('click', () => handler('smg12'));
      if (btnBuyDmr) btnBuyDmr.addEventListener('click', () => handler('dmr'));
      if (btnBuyArmour) btnBuyArmour.addEventListener('click', () => handler('armour'));
      if (btnBuyFrag) btnBuyFrag.addEventListener('click', () => handler('frag'));
      if (btnBuySmoke) btnBuySmoke.addEventListener('click', () => handler('smoke'));
      if (btnBuyP9) btnBuyP9.addEventListener('click', () => handler('p9'));
    },
  };
}
