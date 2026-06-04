/**
 * AppManager - Central state management with Auth & Persistence
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.users = JSON.parse(localStorage.getItem('lotto_users')) || {};
    this.currentUser = JSON.parse(localStorage.getItem('lotto_session')) || null;
    
    // Lotto Global State (Rollover prize, total sales, etc.)
    this.globalState = JSON.parse(localStorage.getItem('lotto_global')) || {
      rolloverPrize: 0,
      currentRound: 1,
      totalSales: 0
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
  }

  saveData() {
    localStorage.setItem('lotto_users', JSON.stringify(this.users));
    localStorage.setItem('lotto_global', JSON.stringify(this.globalState));
    if (this.currentUser) {
      localStorage.setItem('lotto_session', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('lotto_session');
    }
  }

  // ... (signup, login, logout, checkLoginBonus, updatePoints remain the same)

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

  purchase() {
    const count = this.slots.filter(s => s !== null).length;
    const totalCost = count * this.COST_PER_GAME;
    
    if (count === 0) {
      alert('선택된 번호가 없습니다.');
      return false;
    }

    if (this.points < totalCost) {
      alert('보유포인트가 부족합니다.');
      return false;
    }

    // Track purchase in user data
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
    this.globalState.totalSales += (totalCost + (Math.random() * 5000000)); // Simulate virtual sales
    this.clearSlots();
    this.saveData();
    alert(`${count}게임 구매가 완료되었습니다!`);
    return true;
  }

  draw() {
    // 1. Generate Winning Numbers
    const pool = Array.from({length: 45}, (_, i) => i + 1);
    const winning = [];
    for(let i=0; i<6; i++) {
      winning.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    winning.sort((a, b) => a - b);
    const bonus = pool[Math.floor(Math.random() * pool.length)];

    // 2. Calculate Prize Pool (50% of total sales + rollover)
    let prizePool = (this.globalState.totalSales * 0.5) + this.globalState.rolloverPrize;
    const fixed5th = 5000;
    const fixed4th = 50000;

    const results = {
      round: this.globalState.currentRound,
      winning,
      bonus,
      winners: {1:[], 2:[], 3:[], 4:[], 5:[]},
      myResult: []
    };

    // 3. Match user tickets
    if (this.currentUser) {
      const user = this.users[this.currentUser];
      if (user.purchased) {
        user.purchased.filter(t => t.round === this.globalState.currentRound).forEach(ticket => {
          const matchCount = ticket.numbers.filter(n => winning.includes(n)).length;
          const bonusMatch = ticket.numbers.includes(bonus);
          let rank = 0;

          if (matchCount === 6) rank = 1;
          else if (matchCount === 5 && bonusMatch) rank = 2;
          else if (matchCount === 5) rank = 3;
          else if (matchCount === 4) rank = 4;
          else if (matchCount === 3) rank = 5;

          if (rank > 0) results.winners[rank].push(this.currentUser);
          results.myResult.push({ numbers: ticket.numbers, rank });
        });
      }
    }

    // 4. Simulate other winners (rough estimation for realism)
    const totalTickets = this.globalState.totalSales / 1000;
    [1, 2, 3, 4, 5].forEach(rank => {
      const prob = rank === 1 ? 1/8145060 : rank === 2 ? 1/1357510 : rank === 3 ? 1/35724 : rank === 4 ? 1/733 : 1/45;
      const virtualWinners = Math.floor(totalTickets * prob);
      for(let i=0; i<virtualWinners; i++) results.winners[rank].push('VirtualPlayer');
    });

    // 5. Distribute Prizes
    const winCounts = [1,2,3,4,5].map(r => results.winners[r].length);
    const pool1 = prizePool * 0.75; // 1st gets 75% of remaining after fixed prizes
    const pool2 = prizePool * 0.125;
    const pool3 = prizePool * 0.125;

    let totalFixed = (winCounts[3] * fixed4th) + (winCounts[4] * fixed5th);
    let remainingPool = Math.max(0, prizePool - totalFixed);
    
    const prizes = {
      1: winCounts[0] > 0 ? Math.floor((remainingPool * 0.75) / winCounts[0]) : 0,
      2: winCounts[1] > 0 ? Math.floor((remainingPool * 0.125) / winCounts[1]) : 0,
      3: winCounts[2] > 0 ? Math.floor((remainingPool * 0.125) / winCounts[2]) : 0,
      4: fixed4th,
      5: fixed5th
    };

    // 6. Give prizes to current user
    let myTotalWin = 0;
    results.myResult.forEach(res => {
      if (res.rank > 0) myTotalWin += prizes[res.rank];
    });
    if (myTotalWin > 0) this.updatePoints(myTotalWin);

    // 7. Rollover Logic
    this.globalState.rolloverPrize = (winCounts[0] === 0 ? remainingPool * 0.75 : 0) +
                                    (winCounts[1] === 0 ? remainingPool * 0.125 : 0) +
                                    (winCounts[2] === 0 ? remainingPool * 0.125 : 0);
    
    this.globalState.currentRound++;
    this.globalState.totalSales = 0;
    this.saveData();

    this.dispatchEvent(new CustomEvent('draw-completed', { detail: { results, prizes, myTotalWin } }));
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
