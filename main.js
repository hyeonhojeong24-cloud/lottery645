/**
 * AppManager - Central state management with Auth, Bots, & History
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.users = JSON.parse(localStorage.getItem('lotto_users')) || {};
    this.currentUser = JSON.parse(localStorage.getItem('lotto_session')) || null;
    this.history = JSON.parse(localStorage.getItem('lotto_history')) || [];
    this.bots = JSON.parse(localStorage.getItem('lotto_bots')) || this.initBots();
    
    this.globalState = JSON.parse(localStorage.getItem('lotto_global')) || {
      rolloverPrize: 0,
      currentRound: 1,
      totalSales: 0,
      lastDrawTime: null
    };

    this.slots = Array(5).fill(null);
    this.COST_PER_GAME = 1000;
    
    if (this.currentUser && this.users[this.currentUser]) {
      const user = this.users[this.currentUser];
      this.checkLoginBonus(user);
      this.points = user.points;
      this.saveData();
    } else {
      this.points = 0;
    }

    this.initAutomatedDraw();
  }

  initBots() {
    const names = ['AI_Lotto', 'LuckyStrike', 'NumberMaster', 'FortuneCookie', 'JackpotFinder', 'RichGuy', 'LottoBot', 'ZeroToHero'];
    const bots = {};
    for(let i=1; i<=50; i++) {
      const id = `${names[i % names.length]}_${i}`;
      bots[id] = { id, points: 100000, totalWins: 0 };
    }
    localStorage.setItem('lotto_bots', JSON.stringify(bots));
    return bots;
  }

  saveData() {
    localStorage.setItem('lotto_users', JSON.stringify(this.users));
    localStorage.setItem('lotto_global', JSON.stringify(this.globalState));
    localStorage.setItem('lotto_history', JSON.stringify(this.history));
    localStorage.setItem('lotto_bots', JSON.stringify(this.bots));
    if (this.currentUser) {
      localStorage.setItem('lotto_session', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('lotto_session');
    }
  }

  signup(id, pw, email = '') {
    if (this.users[id]) {
      alert('이미 존재하는 아이디입니다.');
      return false;
    }
    const today = new Date().toISOString().split('T')[0];
    this.users[id] = {
      id,
      pw,
      email,
      points: 100000,
      lastLogin: today,
      purchased: [],
      wins: []
    };
    this.saveData();
    alert('회원가입 완료! 100,000 포인트가 지급되었습니다.');
    return this.login(id, pw);
  }

  login(id, pw) {
    const user = this.users[id];
    if (!user || user.pw !== pw) {
      alert('아이디 또는 비밀번호가 틀립니다.');
      return false;
    }
    this.currentUser = id;
    this.checkLoginBonus(user);
    this.points = user.points;
    this.saveData();
    this.dispatchEvent(new CustomEvent('auth-changed', { detail: id }));
    this.dispatchEvent(new CustomEvent('points-updated', { detail: this.points }));
    return true;
  }

  logout() {
    this.currentUser = null;
    this.points = 0;
    this.saveData();
    this.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
    this.dispatchEvent(new CustomEvent('points-updated', { detail: 0 }));
  }

  checkLoginBonus(user) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr !== user.lastLogin) {
      const lastLoginDate = new Date(user.lastLogin);
      const diffDays = Math.ceil(Math.abs(new Date() - lastLoginDate) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        user.points += 200000;
        alert('일일 접속 보너스 200,000 포인트 지급!');
      } else {
        alert('7일 이상 미접속으로 보너스 미지급');
      }
      user.lastLogin = todayStr;
    }
  }

  updatePoints(amount) {
    if (!this.currentUser) return;
    this.points += amount;
    this.users[this.currentUser].points = this.points;
    this.saveData();
    this.dispatchEvent(new CustomEvent('points-updated', { detail: this.points }));
  }

  confirmSelection(numbers, isAuto = false) {
    if (!this.currentUser) {
      alert('로그인이 필요한 서비스입니다.');
      return false;
    }
    const nextSlotIndex = this.slots.findIndex(slot => slot === null);
    if (nextSlotIndex === -1) {
      alert('모든 슬롯이 가득 찼습니다.');
      return false;
    }
    this.slots[nextSlotIndex] = {
      numbers: [...numbers].sort((a, b) => a - b),
      isAuto: isAuto && numbers.length === 6
    };
    this.dispatchEvent(new CustomEvent('slots-updated', { detail: this.slots }));
    return true;
  }

  removeSlot(index) {
    this.slots[index] = null;
    this.dispatchEvent(new CustomEvent('slots-updated', { detail: this.slots }));
  }

  clearSlots() {
    this.slots = Array(5).fill(null);
    this.dispatchEvent(new CustomEvent('slots-updated', { detail: this.slots }));
  }

  purchase() {
    const count = this.slots.filter(s => s !== null).length;
    const totalCost = count * this.COST_PER_GAME;
    if (count === 0) return alert('선택된 번호가 없습니다.');
    if (this.points < totalCost) return alert('보유포인트가 부족합니다.');

    const user = this.users[this.currentUser];
    if (!user.purchased) user.purchased = [];
    
    this.slots.forEach(slot => {
      if (slot) {
        user.purchased.push({
          round: this.globalState.currentRound,
          numbers: slot.numbers,
          isAuto: slot.isAuto
        });
      }
    });

    this.updatePoints(-totalCost);
    this.globalState.totalSales += totalCost;
    this.clearSlots();
    this.saveData();
    alert(`${count}게임 구매 완료!`);
    return true;
  }

  initAutomatedDraw() {
    setInterval(() => {
      const now = new Date();
      const lastDraw = this.globalState.lastDrawTime ? new Date(this.globalState.lastDrawTime) : new Date(0);
      if (now - lastDraw > 1000 * 60 * 60) { 
        this.draw();
      }
    }, 60000);
  }

  draw() {
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    const winning = [];
    for(let i=0; i<6; i++) winning.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    winning.sort((a, b) => a - b);
    const bonus = pool[Math.floor(Math.random() * pool.length)];

    let botSales = 0;
    Object.values(this.bots).forEach(bot => {
      const buyCount = Math.floor(Math.random() * 5) + 1;
      bot.currentTickets = [];
      for(let i=0; i<buyCount; i++) {
        const nums = [];
        const botPool = Array.from({length: 45}, (_, i) => i + 1);
        for(let j=0; j<6; j++) nums.push(botPool.splice(Math.floor(Math.random() * botPool.length), 1)[0]);
        bot.currentTickets.push(nums.sort((a,b)=>a-b));
      }
      botSales += buyCount * 1000;
    });

    const totalRoundSales = this.globalState.totalSales + botSales;
    let prizePool = (totalRoundSales * 0.5) + this.globalState.rolloverPrize;
    const winners = {1:[], 2:[], 3:[], 4:[], 5:[]};

    const allPlayers = [...Object.values(this.bots)];
    if(this.currentUser) allPlayers.push({ id: this.currentUser, currentTickets: this.users[this.currentUser].purchased.filter(t => t.round === this.globalState.currentRound).map(t => t.numbers) });

    allPlayers.forEach(player => {
      if(!player.currentTickets) return;
      player.currentTickets.forEach(nums => {
        const match = nums.filter(n => winning.includes(n)).length;
        const bonusMatch = nums.includes(bonus);
        let rank = 0;
        if (match === 6) rank = 1;
        else if (match === 5 && bonusMatch) rank = 2;
        else if (match === 5) rank = 3;
        else if (match === 4) rank = 4;
        else if (match === 3) rank = 5;
        if(rank > 0) winners[rank].push({ id: player.id, numbers: nums });
      });
    });

    const fixed4th = 50000;
    const fixed5th = 5000;
    const totalFixed = (winners[4].length * fixed4th) + (winners[5].length * fixed5th);
    const remainingPool = Math.max(0, prizePool - totalFixed);
    
    const rankPrizes = {
      1: winners[1].length > 0 ? Math.floor((remainingPool * 0.75) / winners[1].length) : 0,
      2: winners[2].length > 0 ? Math.floor((remainingPool * 0.125) / winners[2].length) : 0,
      3: winners[3].length > 0 ? Math.floor((remainingPool * 0.125) / winners[3].length) : 0,
      4: fixed4th,
      5: fixed5th
    };

    allPlayers.forEach(player => {
      let winSum = 0;
      if(!player.currentTickets) return;
      player.currentTickets.forEach(nums => {
        const match = nums.filter(n => winning.includes(n)).length;
        const bonusMatch = nums.includes(bonus);
        let r = 0;
        if (match === 6) r = 1; else if (match === 5 && bonusMatch) r = 2; else if (match === 5) r = 3; else if (match === 4) r = 4; else if (match === 3) r = 5;
        if(r > 0) winSum += rankPrizes[r];
      });

      if(this.bots[player.id]) {
        this.bots[player.id].totalWins += winSum;
        this.bots[player.id].points += winSum;
      } else if(player.id === this.currentUser) {
        if(winSum > 0) {
          this.users[this.currentUser].wins.push({ round: this.globalState.currentRound, amount: winSum });
          this.updatePoints(winSum);
        }
      }
    });

    this.history.unshift({
      round: this.globalState.currentRound,
      winning,
      bonus,
      winners: { 1: winners[1].length, 2: winners[2].length, 3: winners[3].length, 4: winners[4].length, 5: winners[5].length },
      prizes: rankPrizes,
      totalSales: totalRoundSales
    });

    this.globalState.rolloverPrize = (winners[1].length === 0 ? remainingPool * 0.75 : 0) +
                                    (winners[2].length === 0 ? remainingPool * 0.125 : 0) +
                                    (winners[3].length === 0 ? remainingPool * 0.125 : 0);
    this.globalState.currentRound++;
    this.globalState.totalSales = 0;
    this.globalState.lastDrawTime = new Date().toISOString();
    this.saveData();

    this.dispatchEvent(new CustomEvent('draw-completed', { detail: this.history[0] }));
  }

  getRankings() {
    const all = [...Object.values(this.bots)];
    if(this.currentUser) {
      const userWin = this.users[this.currentUser].wins?.reduce((a,b)=>a+b.amount, 0) || 0;
      all.push({ id: this.currentUser, totalWins: userWin, isUser: true });
    }
    return all.sort((a,b) => b.totalWins - a.totalWins);
  }
}

const app = new AppManager();

function getBallClass(num) {
  if (num <= 10) return 'ball-1-10';
  if (num <= 20) return 'ball-11-20';
  if (num <= 30) return 'ball-21-30';
  if (num <= 40) return 'ball-31-40';
  return 'ball-41-45';
}

/**
 * Lotto Header
 */
class LottoHeader extends HTMLElement {
  connectedCallback() {
    this.render();
    app.addEventListener('auth-changed', () => this.render());
    app.addEventListener('points-updated', (e) => this.updatePoints(e.detail));
  }

  updatePoints(points) {
    const el = this.querySelector('#header-points');
    if (el) el.textContent = points.toLocaleString() + '원';
  }

  render() {
    const user = app.currentUser;
    this.innerHTML = `
      <header style="background: white; border-bottom: 1px solid #ddd; padding: 15px 0; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
        <div style="max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 1rem;">
          <h1 style="font-size: 1.5rem; color: var(--lotto-magenta); font-weight: 800; cursor:pointer;" onclick="window.router.navigate('purchase')">LOTTO 6/45</h1>
          <nav style="display: flex; gap: 20px;">
            <a href="#" onclick="window.router.navigate('purchase')" style="text-decoration:none; color:#333; font-weight:bold;">구매하기</a>
            <a href="#" onclick="window.router.navigate('history')" style="text-decoration:none; color:#333; font-weight:bold;">당첨/이력</a>
          </nav>
          <div style="display: flex; gap: 12px; align-items: center;">
            ${user ? `
              <span style="font-size: 0.9rem; font-weight: bold; color: #333;">${user}님</span>
              <span id="header-points" style="font-size: 0.9rem; color: var(--lotto-orange); font-weight: bold;">${app.points.toLocaleString()}원</span>
              <button id="logout-btn" class="btn btn-outline" style="border-color: #eee;">로그아웃</button>
            ` : `
              <button id="btn-login" class="btn btn-outline" style="border-color: #eee; background: #fafafa;">로그인</button>
              <button id="btn-signup" class="btn btn-primary" style="padding: 6px 15px; font-size: 0.85rem;">회원가입</button>
            `}
          </div>
        </div>
      </header>
    `;

    if (user) {
      this.querySelector('#logout-btn').onclick = () => app.logout();
    } else {
      this.querySelector('#btn-login').onclick = () => {
        const auth = document.querySelector('lotto-auth');
        auth.setMode('login');
        auth.show();
      };
      this.querySelector('#btn-signup').onclick = () => {
        const auth = document.querySelector('lotto-auth');
        auth.setMode('signup');
        auth.show();
      };
    }
  }
}
customElements.define('lotto-header', LottoHeader);

/**
 * Lotto Auth Modal
 */
class LottoAuth extends HTMLElement {
  constructor() {
    super();
    this.mode = 'login';
  }

  connectedCallback() {
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  show() { this.style.display = 'flex'; }
  hide() { this.style.display = 'none'; }

  render() {
    this.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000;
    `;
    this.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 8px; width: 320px; box-shadow: var(--shadow-lg);">
        <h2 style="margin-bottom: 20px; text-align: center; color: var(--lotto-magenta);">${this.mode === 'login' ? '로그인' : '회원가입'}</h2>
        <form id="auth-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="text" id="auth-id" placeholder="아이디" required style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          <input type="password" id="auth-pw" placeholder="비밀번호" required style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          ${this.mode === 'signup' ? '<input type="email" id="auth-email" placeholder="이메일 (선택)" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">' : ''}
          <button type="submit" class="btn btn-purchase" style="padding: 12px; font-size: 1rem;">${this.mode === 'login' ? '로그인' : '회원가입'}</button>
        </form>
        <div style="margin-top: 15px; text-align: center; font-size: 0.85rem;">
          <a href="#" id="toggle-auth" style="color: var(--lotto-blue-btn); text-decoration: none;">${this.mode === 'login' ? '회원가입 하러가기' : '로그인 하러가기'}</a>
          <br><br><button id="close-auth" style="background: none; border: none; color: #999; cursor: pointer;">닫기</button>
        </div>
      </div>
    `;
    this.querySelector('#auth-form').onsubmit = (e) => {
      e.preventDefault();
      const id = this.querySelector('#auth-id').value;
      const pw = this.querySelector('#auth-pw').value;
      if (this.mode === 'login') { if (app.login(id, pw)) this.hide(); }
      else { if (app.signup(id, pw, this.querySelector('#auth-email')?.value || '')) this.hide(); }
    };
    this.querySelector('#toggle-auth').onclick = (e) => { e.preventDefault(); this.mode = this.mode === 'login' ? 'signup' : 'login'; this.render(); };
    this.querySelector('#close-auth').onclick = () => this.hide();
  }
}
customElements.define('lotto-auth', LottoAuth);

/**
 * Lotto Selector
 */
class LottoSelector extends HTMLElement {
  constructor() {
    super();
    this.selectedNumbers = new Set();
  }

  connectedCallback() {
    this.render();
    this.attachEvents();
  }

  attachEvents() {
    const grid = this.querySelector('.num-grid');
    grid.onclick = (e) => {
      const box = e.target.closest('.num-box');
      if (!box) return;
      const num = parseInt(box.dataset.num);
      if (this.selectedNumbers.has(num)) {
        this.selectedNumbers.delete(num);
        box.classList.remove('selected');
      } else {
        if (this.selectedNumbers.size >= 6) return alert('최대 6개까지만 선택 가능합니다.');
        this.selectedNumbers.add(num);
        box.classList.add('selected');
      }
    };
    this.querySelector('#reset-btn').onclick = () => this.resetSelection();
    this.querySelector('#auto-btn').onclick = () => {
      if (this.selectedNumbers.size === 6) this.resetSelection();
      const available = Array.from({length: 45}, (_, i) => i + 1).filter(n => !this.selectedNumbers.has(n));
      while (this.selectedNumbers.size < 6) {
        const picked = available.splice(Math.floor(Math.random() * available.length), 1)[0];
        this.selectedNumbers.add(picked);
        this.querySelector(`.num-box[data-num="${picked}"]`).classList.add('selected');
      }
    };
    this.querySelector('#confirm-btn').onclick = () => {
      if (this.selectedNumbers.size > 0 && this.selectedNumbers.size < 6) return alert('번호를 6개 모두 선택하거나, [자동선택]을 눌러 채워주세요.');
      const qty = parseInt(this.querySelector('#qty-select').value);
      for(let i=0; i<qty; i++) {
        const isAuto = this.selectedNumbers.size === 0;
        const nums = isAuto ? Array.from({length:6}, () => Math.floor(Math.random()*45)+1) : Array.from(this.selectedNumbers);
        if (!app.confirmSelection(nums, isAuto)) break;
      }
      this.resetSelection();
    };
  }

  resetSelection() {
    this.selectedNumbers.clear();
    this.querySelectorAll('.num-box').forEach(b => b.classList.remove('selected'));
  }

  render() {
    let gridHtml = '';
    for (let i = 1; i <= 45; i++) gridHtml += `<div class="num-box" data-num="${i}">${i}</div>`;
    this.innerHTML = `
      <div class="selection-panel" style="box-shadow: var(--shadow-md);">
        <div style="background: var(--lotto-magenta); color: white; padding: 12px; font-weight: bold; text-align: center; font-size: 1.1rem;">직접 선택 (1,000원)</div>
        <div class="num-grid">${gridHtml}</div>
        <div style="display: flex; justify-content: space-around; padding: 15px; border-top: 1px solid #f0f0f0; background: #fafafa;">
          <button id="reset-btn" class="btn btn-pink-text" style="flex: 1; margin: 0 5px;">[초기화]</button>
          <button id="auto-btn" class="btn btn-pink-text" style="flex: 1; margin: 0 5px;">[자동선택]</button>
        </div>
      </div>
      <div style="margin-top: 20px; background: white; padding: 15px; border-radius: var(--radius-md); border: 1px solid #ddd;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
          <span style="font-weight: bold; font-size: 0.9rem; color: #555;">적용수량</span>
          <select id="qty-select" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem;">
            ${[1,2,3,4,5].map(v => `<option value="${v}">${v}개</option>`).join('')}
          </select>
        </div>
        <button id="confirm-btn" class="btn btn-confirm">확인</button>
      </div>
    `;
  }
}
customElements.define('lotto-selector', LottoSelector);

/**
 * Lotto Cart
 */
class LottoCart extends HTMLElement {
  connectedCallback() {
    this.render();
    app.addEventListener('slots-updated', (e) => this.updateSlots(e.detail));
    app.addEventListener('points-updated', (e) => this.updatePoints(e.detail));
  }

  updatePoints(p) { const el = this.querySelector('#balance-text'); if (el) el.textContent = p.toLocaleString() + '원'; }

  updateSlots(slots) {
    const container = this.querySelector('#slots-container');
    if (!container) return;
    container.innerHTML = '';
    let total = 0;
    slots.forEach((slot, index) => {
      const prefix = String.fromCharCode(65 + index);
      const div = document.createElement('div');
      div.className = 'game-slot';
      if (slot) {
        total++;
        div.innerHTML = `<span class="prefix" style="color: var(--lotto-blue-btn);">${prefix}</span>
          <div style="display: flex; align-items: center;">${slot.numbers.map(n => `<div class="lotto-ball ${getBallClass(n)}" style="margin-right: 4px;">${n}</div>`).join('')}</div>
          <div class="slot-actions"><button class="del-btn" data-index="${index}" style="color: var(--lotto-pink);">삭제</button></div>`;
      } else {
        div.innerHTML = `<span class="prefix" style="color: var(--lotto-blue-btn);">${prefix}</span>
          <div style="display: flex; align-items: center;"><span class="status-text" style="margin-right: 15px; font-size: 0.75rem; width: 40px;">미지정</span>${Array(6).fill('<div class="lotto-ball ball-empty" style="margin-right: 4px;"></div>').join('')}</div>
          <div class="slot-actions"></div>`;
      }
      container.appendChild(div);
    });
    container.querySelectorAll('.del-btn').forEach(btn => btn.onclick = () => app.removeSlot(parseInt(btn.dataset.index)));
    this.querySelector('#total-price').textContent = (total * 1000).toLocaleString() + '원';
  }

  render() {
    this.innerHTML = `
      <div class="confirmation-panel" style="box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 2px solid var(--lotto-blue-grey); background: #fafafa;">
          <h2 style="font-size: 1.1rem; color: var(--lotto-blue-grey);">선택 번호 확인</h2>
          <button id="clear-slots" style="background: #757575; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">초기화</button>
        </div>
        <div id="slots-container" style="flex: 1; background: white;"></div>
        <div style="padding: 20px; background: #f1f5f9; border-top: 1px solid #ddd;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div><div style="font-size: 0.8rem; color: #666;">보유포인트</div><div id="balance-text" style="font-size: 1.4rem; font-weight: 800;">${app.points.toLocaleString()}원</div></div>
            <div style="text-align: right;"><div style="font-size: 0.8rem; color: #666;">결제 금액</div><div id="total-price" style="font-size: 1.4rem; font-weight: 800; color: var(--lotto-orange);">0원</div></div>
          </div>
          <button id="purchase-btn" class="btn btn-purchase">구매하기</button>
        </div>
      </div>
    `;
    this.querySelector('#clear-slots').onclick = () => app.clearSlots();
    this.querySelector('#purchase-btn').onclick = () => app.purchase();
    this.updateSlots(app.slots);
  }
}
customElements.define('lotto-cart', LottoCart);

/**
 * Lotto Draw Control (Test)
 */
class LottoDrawControl extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div style="margin-top: 20px; padding: 15px; border: 2px dashed var(--lotto-magenta); border-radius: 8px; text-align: center;">
        <button id="draw-btn" class="btn btn-primary" style="background: var(--lotto-magenta); width: 100%;">즉시 추첨 진행 (테스트)</button>
      </div>
    `;
    this.querySelector('#draw-btn').onclick = () => { if(confirm('추첨을 진행하시겠습니까?')) app.draw(); };
  }
}
customElements.define('lotto-draw-control', LottoDrawControl);

/**
 * Lotto Dashboard (Ranking & History)
 */
class LottoDashboard extends HTMLElement {
  constructor() { super(); this.tab = 'ranking'; }
  connectedCallback() { this.render(); app.addEventListener('draw-completed', () => this.render()); }
  render() {
    this.innerHTML = `
      <div class="card" style="margin-top: 1rem;">
        <div class="nav-tabs">
          <div class="nav-tab ${this.tab === 'ranking' ? 'active' : ''}" data-tab="ranking">상금 랭킹</div>
          <div class="nav-tab ${this.tab === 'history' ? 'active' : ''}" data-tab="history">회차 이력</div>
          <div class="nav-tab ${this.tab === 'mypage' ? 'active' : ''}" data-tab="mypage">내 당첨내역</div>
        </div>
        <div id="tab-content" style="padding: 10px;">${this.renderContent()}</div>
      </div>
    `;
    this.querySelectorAll('.nav-tab').forEach(t => t.onclick = () => { this.tab = t.dataset.tab; this.render(); });
  }
  renderContent() {
    if (this.tab === 'ranking') {
      const ranks = app.getRankings();
      return `
        <table class="ranking-table">
          <thead><tr><th>순위</th><th>아이디</th><th>상금</th></tr></thead>
          <tbody>${ranks.slice(0, 20).map((r, i) => `<tr class="${r.isUser ? 'rank-highlight' : ''}"><td>${i+1}</td><td>${r.id}</td><td>${r.totalWins.toLocaleString()}원</td></tr>`).join('')}</tbody>
        </table>`;
    }
    if (this.tab === 'history') {
      return app.history.map(h => `
        <div class="history-item">
          <strong>제 ${h.round}회</strong> ${h.winning.join(', ')} + ${h.bonus} (1등 ${h.winners[1]}명)
        </div>`).join('') || '이력이 없습니다.';
    }
    if (this.tab === 'mypage') {
      if (!app.currentUser) return '로그인이 필요합니다.';
      const user = app.users[app.currentUser];
      return (user.wins || []).map(w => `<div>제 ${w.round}회 당첨: ${w.amount.toLocaleString()}원</div>`).join('') || '당첨 내역이 없습니다.';
    }
  }
}
customElements.define('lotto-dashboard', LottoDashboard);

/**
 * App Router
 */
class AppRouter {
  constructor() {
    this.main = document.querySelector('#main-view');
    window.router = this;
  }
  navigate(view) {
    this.main.innerHTML = '';
    if (view === 'purchase') {
      this.main.innerHTML = `
        <div class="app-container">
          <section><lotto-selector></lotto-selector></section>
          <aside><lotto-cart></lotto-cart><lotto-draw-control></lotto-draw-control></aside>
        </div>`;
    } else if (view === 'history') {
      this.main.innerHTML = `
        <div style="max-width: 1000px; margin: 2rem auto; padding: 0 1rem;">
          <lotto-dashboard></lotto-dashboard>
        </div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AppRouter().navigate('purchase');
});
