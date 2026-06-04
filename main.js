/**
 * AppManager - Central state management with Auth & Persistence
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.users = JSON.parse(localStorage.getItem('lotto_users')) || {};
    this.currentUser = JSON.parse(localStorage.getItem('lotto_session')) || null;
    
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
      points: 100000, // Signup bonus
      lastLogin: today
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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const lastLogin = new Date(user.lastLogin);
    const lastLoginStr = user.lastLogin;

    if (todayStr !== lastLoginStr) {
      const diffTime = Math.abs(today - lastLogin);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= 7) {
        alert('7일 이상 미접속으로 일일 보너스가 지급되지 않았습니다.');
      } else {
        user.points += 200000;
        alert('환영합니다! 일일 접속 보너스 200,000 포인트가 지급되었습니다.');
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
    
    if (count === 0) {
      alert('선택된 번호가 없습니다.');
      return false;
    }

    if (this.points < totalCost) {
      alert('보유포인트가 부족합니다.');
      return false;
    }

    this.updatePoints(-totalCost);
    this.clearSlots();
    alert(`${count}게임 구매가 완료되었습니다!`);
    return true;
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
