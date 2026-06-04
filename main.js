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

  // ... (auth methods same)

  initAutomatedDraw() {
    setInterval(() => {
      const now = new Date();
      // Simulate: Every minute checks if it's "9:00 PM" in game-time or if enough time has passed
      // For this simulator, we'll check if lastDraw was more than 1 hour ago for faster testing,
      // but the UI will say "Next draw at 9 PM"
      const lastDraw = this.globalState.lastDrawTime ? new Date(this.globalState.lastDrawTime) : new Date(0);
      if (now - lastDraw > 1000 * 60 * 60) { // Auto draw every 1 hour for simulator engagement
        this.draw();
      }
    }, 60000);
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
    alert('회원가입이 완료되었습니다! 100,000 포인트가 지급되었습니다.');
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
      const diffDays = Math.ceil(Math.abs(new Date() - new Date(user.lastLogin)) / (1000 * 60 * 60 * 24));
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

  draw() {
    // 1. Winning Numbers
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    const winning = [];
    for(let i=0; i<6; i++) winning.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    winning.sort((a, b) => a - b);
    const bonus = pool[Math.floor(Math.random() * pool.length)];

    // 2. Bot Simulation
    let botSales = 0;
    Object.values(this.bots).forEach(bot => {
      const buyCount = Math.floor(Math.random() * 5) + 1; // Bots buy 1-5 games
      bot.currentTickets = [];
      for(let i=0; i<buyCount; i++) {
        const nums = [];
        const botPool = Array.from({length: 45}, (_, i) => i + 1);
        for(let j=0; j<6; j++) nums.push(botPool.splice(Math.floor(Math.random() * botPool.length), 1)[0]);
        bot.currentTickets.push(nums.sort((a,b)=>a-b));
      }
      botSales += buyCount * 1000;
    });

    // 3. Prize Pool
    const totalRoundSales = this.globalState.totalSales + botSales;
    let prizePool = (totalRoundSales * 0.5) + this.globalState.rolloverPrize;
    const winners = {1:[], 2:[], 3:[], 4:[], 5:[]};

    // 4. Checking All Players (User + Bots)
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

    // 5. Prize Distribution
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

    // 6. Update Bot/User Prize Data
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

    // 7. Store History
    this.history.unshift({
      round: this.globalState.currentRound,
      winning,
      bonus,
      winners: { 1: winners[1].length, 2: winners[2].length, 3: winners[3].length, 4: winners[4].length, 5: winners[5].length },
      prizes: rankPrizes,
      totalSales: totalRoundSales
    });

    // 8. Reset Global
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
 * <lotto-dashboard> Component - Tab switching between Ranking, History, My Page
 */
class LottoDashboard extends HTMLElement {
  constructor() {
    super();
    this.currentTab = 'ranking';
  }

  connectedCallback() {
    this.render();
    app.addEventListener('draw-completed', () => this.render());
    app.addEventListener('auth-changed', () => this.render());
  }

  render() {
    this.innerHTML = `
      <div class="card" style="margin-top: 2rem;">
        <div class="nav-tabs">
          <div class="nav-tab ${this.currentTab === 'ranking' ? 'active' : ''}" data-tab="ranking">상금 랭킹</div>
          <div class="nav-tab ${this.currentTab === 'history' ? 'active' : ''}" data-tab="history">지난 회차 이력</div>
          <div class="nav-tab ${this.currentTab === 'mypage' ? 'active' : ''}" data-tab="mypage">내 정보/내역</div>
        </div>
        <div id="tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.querySelectorAll('.nav-tab').forEach(tab => {
      tab.onclick = () => {
        this.currentTab = tab.dataset.tab;
        this.render();
      };
    });
  }

  renderTabContent() {
    if (this.currentTab === 'ranking') return this.renderRanking();
    if (this.currentTab === 'history') return this.renderHistory();
    if (this.currentTab === 'mypage') return this.renderMyPage();
  }

  renderRanking() {
    const rankings = app.getRankings();
    const top20 = rankings.slice(0, 20);
    const userRank = app.currentUser ? rankings.findIndex(r => r.id === app.currentUser) + 1 : 0;
    
    let rows = top20.map((r, i) => `
      <tr class="${r.id === app.currentUser ? 'rank-highlight' : ''}">
        <td>${i+1}</td>
        <td>${r.id}</td>
        <td>${r.totalWins.toLocaleString()}원</td>
        <td>${i < 3 ? `<span class="badge badge-${['1st','2nd','3rd'][i]}">${i+1}위</span>` : ''}</td>
      </tr>
    `).join('');

    return `
      <div>
        <table class="ranking-table">
          <thead><tr><th>순위</th><th>아이디</th><th>누적 상금</th><th>비고</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${userRank > 0 ? `
          <div style="margin-top: 20px; padding: 15px; background: var(--lotto-pink-light); border-radius: 8px; text-align: center; font-weight: bold; color: var(--lotto-magenta);">
            당신의 현재 랭킹: ${userRank}위
          </div>
        ` : ''}
      </div>
    `;
  }

  renderHistory() {
    if (app.history.length === 0) return '<div style="padding: 2rem; text-align: center; color: #999;">회차 이력이 없습니다.</div>';
    
    return app.history.map(h => `
      <div class="history-item">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-weight: bold; font-size: 1.1rem; color: var(--lotto-blue-grey);">제 ${h.round}회 당첨 결과</span>
          <span style="font-size: 0.8rem; color: #999;">총 판매액: ${h.totalSales.toLocaleString()}원</span>
        </div>
        <div style="display: flex; gap: 5px; justify-content: center; margin: 15px 0;">
          ${h.winning.map(n => `<div class="lotto-ball ${getBallClass(n)}" style="width: 24px; height: 24px; font-size: 0.7rem;">${n}</div>`).join('')}
          <span style="font-weight: bold; color: #ccc;">+</span>
          <div class="lotto-ball ${getBallClass(h.bonus)}" style="width: 24px; height: 24px; font-size: 0.7rem;">${h.bonus}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; font-size: 0.75rem; text-align: center;">
          <div>1등: ${h.winners[1]}명</div>
          <div>2등: ${h.winners[2]}명</div>
          <div>3등: ${h.winners[3]}명</div>
          <div>4등: ${h.winners[4]}명</div>
          <div>5등: ${h.winners[5]}명</div>
        </div>
      </div>
    `).join('');
  }

  renderMyPage() {
    if (!app.currentUser) return '<div style="padding: 2rem; text-align: center; color: #999;">로그인 후 확인 가능합니다.</div>';
    
    const user = app.users[app.currentUser];
    const purchased = user.purchased || [];
    const wins = user.wins || [];

    return `
      <div>
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
          <div style="flex: 1; background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.8rem; color: #666;">내 보유 포인트</div>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--lotto-magenta);">${app.points.toLocaleString()} P</div>
          </div>
          <div style="flex: 1; background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.8rem; color: #666;">누적 당첨 상금</div>
            <div style="font-size: 1.2rem; font-weight: bold; color: var(--lotto-blue-btn);">${wins.reduce((a,b)=>a+b.amount,0).toLocaleString()}원</div>
          </div>
        </div>
        
        <h3 style="font-size: 1rem; margin-bottom: 10px;">최근 구매 내역</h3>
        <div style="max-height: 200px; overflow-y: auto; font-size: 0.85rem; border: 1px solid #eee; border-radius: 4px;">
          ${purchased.slice().reverse().map(p => `
            <div style="padding: 8px; border-bottom: 1px solid #f9f9f9; display: flex; justify-content: space-between;">
              <span>제 ${p.round}회 (${p.isAuto ? '자동' : '수동'})</span>
              <span style="font-family: monospace;">${p.numbers.join(', ')}</span>
            </div>
          `).join('') || '<div style="padding: 10px; color: #999;">구매 내역이 없습니다.</div>'}
        </div>
      </div>
    `;
  }
}
customElements.define('lotto-dashboard', LottoDashboard);

/**
 * <lotto-result> Component - Draw button and results display
 */
class LottoResult extends HTMLElement {
  connectedCallback() {
    this.render();
    app.addEventListener('draw-completed', (e) => this.showResults(e.detail));
  }

  showResults({ results, prizes, myTotalWin }) {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 2000;
    `;

    let winBallsHtml = results.winning.map(n => `<div class="lotto-ball ${getBallClass(n)}">${n}</div>`).join('');
    let bonusBallHtml = `<div class="lotto-ball ${getBallClass(results.bonus)}">${results.bonus}</div>`;

    let myWinsHtml = results.myResult.filter(r => r.rank > 0).map(r => `
      <div style="margin-top: 5px; font-size: 0.9rem;">
        [${r.rank}등 당첨] ${r.numbers.join(', ')} -> +${prizes[r.rank].toLocaleString()}원
      </div>
    `).join('');

    modal.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 12px; width: 450px; text-align: center; box-shadow: var(--shadow-lg);">
        <h2 style="color: var(--lotto-magenta); margin-bottom: 20px;">제 ${results.round}회 추첨 결과</h2>
        
        <div style="margin-bottom: 20px;">
          <div style="font-size: 0.9rem; color: #666; mb: 10px;">당첨 번호</div>
          <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
            ${winBallsHtml}
            <span style="font-weight: bold; font-size: 1.5rem; color: #999; margin: 0 5px;">+</span>
            ${bonusBallHtml}
          </div>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">내 당첨 내역</div>
          ${myWinsHtml || '<div style="color: #999;">당첨 내역이 없습니다.</div>'}
          <div style="margin-top: 15px; font-size: 1.2rem; font-weight: 800; color: var(--lotto-orange);">
            총 획득: ${myTotalWin.toLocaleString()}원
          </div>
        </div>

        <div style="font-size: 0.8rem; color: #666; text-align: left; margin-bottom: 20px;">
          1등 당첨금: ${prizes[1].toLocaleString()}원 (${results.winners[1].length}명)<br>
          다음 이월금: ${app.globalState.rolloverPrize.toLocaleString()}원
        </div>

        <button id="close-result" class="btn btn-purchase" style="width: 100%;">확인</button>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('#close-result').onclick = () => {
      modal.remove();
      location.reload(); // Refresh to update round/UI
    };
  }

  render() {
    this.innerHTML = `
      <div style="margin-top: 20px; padding: 20px; background: white; border-radius: 8px; border: 2px dashed var(--lotto-magenta); text-align: center;">
        <div style="font-weight: bold; margin-bottom: 10px; color: var(--lotto-magenta);">[테스트 모드]</div>
        <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px;">
          현재 제 ${app.globalState.currentRound}회차 진행 중<br>
          판매 금액: ${app.globalState.totalSales.toLocaleString()}원
        </p>
        <button id="draw-btn" class="btn btn-primary" style="background: var(--lotto-magenta); width: 100%; padding: 12px;">즉시 추첨 진행</button>
      </div>
    `;

    this.querySelector('#draw-btn').onclick = () => {
      if (confirm('현재 회차 추첨을 진행하시겠습니까?')) {
        app.draw();
      }
    };
  }
}
customElements.define('lotto-result', LottoResult);

/**
 * <lotto-header> Component
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
          <h1 style="font-size: 1.5rem; color: var(--lotto-magenta); font-weight: 800; letter-spacing: -0.5px;">LOTTO 6/45</h1>
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
 * <lotto-auth> Component - Modal for Login/Signup
 */
class LottoAuth extends HTMLElement {
  constructor() {
    super();
    this.mode = 'login'; // 'login' or 'signup'
  }

  connectedCallback() {
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  show() {
    this.style.display = 'flex';
  }

  hide() {
    this.style.display = 'none';
  }

  toggleMode() {
    this.mode = this.mode === 'login' ? 'signup' : 'login';
    this.render();
  }

  handleAuth(e) {
    e.preventDefault();
    const id = this.querySelector('#auth-id').value;
    const pw = this.querySelector('#auth-pw').value;
    
    if (this.mode === 'login') {
      if (app.login(id, pw)) this.hide();
    } else {
      const email = this.querySelector('#auth-email')?.value || '';
      if (app.signup(id, pw, email)) this.hide();
    }
  }

  render() {
    this.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000;
    `;

    this.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 8px; width: 320px; box-shadow: var(--shadow-lg);">
        <h2 style="margin-bottom: 20px; text-align: center; color: var(--lotto-magenta);">
          ${this.mode === 'login' ? '로그인' : '회원가입'}
        </h2>
        <form id="auth-form" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="text" id="auth-id" placeholder="아이디" required style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          <input type="password" id="auth-pw" placeholder="비밀번호" required style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          ${this.mode === 'signup' ? `
            <input type="email" id="auth-email" placeholder="이메일 (선택)" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
          ` : ''}
          <button type="submit" class="btn btn-purchase" style="padding: 12px; font-size: 1rem;">
            ${this.mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
        <div style="margin-top: 15px; text-align: center; font-size: 0.85rem;">
          <a href="#" id="toggle-auth" style="color: var(--lotto-blue-btn); text-decoration: none;">
            ${this.mode === 'login' ? '회원가입 하러가기' : '로그인 하러가기'}
          </a>
          <br><br>
          <button id="close-auth" style="background: none; border: none; color: #999; cursor: pointer;">닫기</button>
        </div>
      </div>
    `;

    this.querySelector('#auth-form').onsubmit = (e) => this.handleAuth(e);
    this.querySelector('#toggle-auth').onclick = (e) => {
      e.preventDefault();
      this.toggleMode();
    };
    this.querySelector('#close-auth').onclick = () => this.hide();
  }
}
customElements.define('lotto-auth', LottoAuth);

/**
 * <lotto-selector> Component
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
        if (this.selectedNumbers.size >= 6) {
          alert('최대 6개까지만 선택 가능합니다.');
          return;
        }
        this.selectedNumbers.add(num);
        box.classList.add('selected');
      }
    };

    this.querySelector('#reset-btn').onclick = () => this.resetSelection();
    
    // Intelligent Auto-Fill Logic
    this.querySelector('#auto-btn').onclick = () => {
      if (this.selectedNumbers.size === 6) {
        this.resetSelection(); // If already 6, start over
      }
      
      const currentNums = Array.from(this.selectedNumbers);
      const remainingCount = 6 - currentNums.length;
      
      const available = [];
      for (let i = 1; i <= 45; i++) {
        if (!this.selectedNumbers.has(i)) available.push(i);
      }

      // Shuffle and pick remaining
      for (let i = 0; i < remainingCount; i++) {
        const randomIndex = Math.floor(Math.random() * available.length);
        const picked = available.splice(randomIndex, 1)[0];
        this.selectedNumbers.add(picked);
        this.querySelector(`.num-box[data-num="${picked}"]`).classList.add('selected');
      }
    };

    this.querySelector('#confirm-btn').onclick = () => {
      if (this.selectedNumbers.size > 0 && this.selectedNumbers.size < 6) {
        alert('번호를 6개 모두 선택하거나, [자동선택]을 눌러 채워주세요.');
        return;
      }

      const qty = parseInt(this.querySelector('#qty-select').value);
      for(let i=0; i<qty; i++) {
        const isInitialAuto = this.selectedNumbers.size === 0;
        const nums = isInitialAuto ? this.generateRandomNumbers() : Array.from(this.selectedNumbers);
        if (!app.confirmSelection(nums, isInitialAuto)) break;
      }
      this.resetSelection();
    };
  }

  generateRandomNumbers() {
    const nums = new Set();
    while (nums.size < 6) nums.add(Math.floor(Math.random() * 45) + 1);
    return Array.from(nums);
  }

  resetSelection() {
    this.selectedNumbers.clear();
    this.querySelectorAll('.num-box').forEach(b => b.classList.remove('selected'));
  }

  render() {
    let gridHtml = '';
    for (let i = 1; i <= 45; i++) {
      gridHtml += `<div class="num-box" data-num="${i}">${i}</div>`;
    }

    this.innerHTML = `
      <div class="selection-panel" style="box-shadow: var(--shadow-md);">
        <div style="background: var(--lotto-magenta); color: white; padding: 12px; font-weight: bold; text-align: center; font-size: 1.1rem;">직접 선택 (1,000원)</div>
        <div class="num-grid">
          ${gridHtml}
        </div>
        <div style="display: flex; justify-content: space-around; padding: 15px; border-top: 1px solid #f0f0f0; background: #fafafa;">
          <button id="reset-btn" class="btn btn-pink-text" style="flex: 1; margin: 0 5px;">[초기화]</button>
          <button id="auto-btn" class="btn btn-pink-text" style="flex: 1; margin: 0 5px;">[자동선택]</button>
          <button id="my-num-btn" class="btn btn-pink-text" style="flex: 1; margin: 0 5px;">[나의번호]</button>
        </div>
      </div>
      
      <div style="margin-top: 20px; background: white; padding: 15px; border-radius: var(--radius-md); border: 1px solid #ddd;">
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
          <span style="font-weight: bold; font-size: 0.9rem; color: #555;">적용수량</span>
          <select id="qty-select" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem;">
            <option value="1">1개</option>
            <option value="2">2개</option>
            <option value="3">3개</option>
            <option value="4">4개</option>
            <option value="5">5개</option>
          </select>
        </div>
        <button id="confirm-btn" class="btn btn-confirm">확인</button>
      </div>
    `;
  }
}
customElements.define('lotto-selector', LottoSelector);

/**
 * <lotto-cart> Component
 */
class LottoCart extends HTMLElement {
  connectedCallback() {
    this.render();
    app.addEventListener('slots-updated', (e) => this.updateSlots(e.detail));
    app.addEventListener('points-updated', (e) => this.updatePoints(e.detail));
  }

  updatePoints(points) {
    const el = this.querySelector('#balance-text');
    if (el) el.textContent = points.toLocaleString() + '원';
  }

  updateSlots(slots) {
    const container = this.querySelector('#slots-container');
    if (!container) return;
    
    container.innerHTML = '';
    let totalCount = 0;

    slots.forEach((slot, index) => {
      const prefix = String.fromCharCode(65 + index); // A, B, C, D, E
      const div = document.createElement('div');
      div.className = 'game-slot';
      
      let content = '';
      if (slot) {
        totalCount++;
        let ballsHtml = '';
        slot.numbers.forEach(n => {
          ballsHtml += `<div class="lotto-ball ${getBallClass(n)}" style="margin-right: 4px;">${n}</div>`;
        });
        content = `<div style="display: flex; align-items: center;">${ballsHtml}</div>`;
      } else {
        let emptyBalls = '';
        for(let i=0; i<6; i++) emptyBalls += `<div class="lotto-ball ball-empty" style="margin-right: 4px;"></div>`;
        content = `<div style="display: flex; align-items: center;">
          <span class="status-text" style="margin-right: 15px; font-size: 0.75rem; width: 40px;">미지정</span>
          ${emptyBalls}
        </div>`;
      }

      div.innerHTML = `
        <span class="prefix" style="color: var(--lotto-blue-btn);">${prefix}</span>
        ${content}
        <div class="slot-actions">
          <button style="color: #666;">수정</button>
          <button class="del-btn" data-index="${index}" style="color: var(--lotto-pink);">삭제</button>
        </div>
      `;
      container.appendChild(div);
    });

    // Re-attach delete events
    container.querySelectorAll('.del-btn').forEach(btn => {
      btn.onclick = () => app.removeSlot(parseInt(btn.dataset.index));
    });
    
    this.querySelector('#total-price').textContent = (totalCount * app.COST_PER_GAME).toLocaleString() + '원';
  }

  render() {
    this.innerHTML = `
      <div class="confirmation-panel" style="box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 2px solid var(--lotto-blue-grey); background: #fafafa;">
          <h2 style="font-size: 1.1rem; color: var(--lotto-blue-grey);">선택 번호 확인</h2>
          <button id="clear-slots" style="background: #757575; color: white; border: none; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold;">전체 초기화</button>
        </div>
        
        <div id="slots-container" style="flex: 1; background: white;">
          <!-- A-E slots rendered here -->
        </div>

        <div style="padding: 20px; background: #f1f5f9; border-top: 1px solid #ddd;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 0.8rem; color: #666; font-weight: 600;">보유포인트</span>
                <button style="font-size: 0.7rem; border: 1px solid #ccc; padding: 1px 6px; background: white; border-radius: 2px;">충전</button>
              </div>
              <div id="balance-text" style="font-size: 1.4rem; font-weight: 800; color: #333;">${app.points.toLocaleString()}원</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.8rem; color: #666; font-weight: 600; margin-bottom: 4px;">결제 금액</div>
              <div id="total-price" style="font-size: 1.4rem; font-weight: 800; color: var(--lotto-orange);">0원</div>
            </div>
          </div>
          <button id="purchase-btn" class="btn btn-purchase" style="border-radius: var(--radius-md); font-weight: 800; letter-spacing: 1px; box-shadow: 0 4px 0 #0d47a1;">구매하기</button>
        </div>
      </div>
    `;

    this.querySelector('#clear-slots').onclick = () => app.clearSlots();
    this.querySelector('#purchase-btn').onclick = () => app.purchase();
    this.updateSlots(app.slots);
  }
}
customElements.define('lotto-cart', LottoCart);
