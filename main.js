/**
 * AppManager - Central state management
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.points = 100000; // Starting points
    this.cart = [];
    this.MAX_CART_SIZE = 100;
    this.COST_PER_GAME = 1000;
  }

  updatePoints(amount) {
    this.points += amount;
    this.dispatchEvent(new CustomEvent('points-updated', { detail: this.points }));
  }

  addToCart(numbers, isAuto = false) {
    if (this.cart.length >= this.MAX_CART_SIZE) {
      alert(`최대 ${this.MAX_CART_SIZE}게임까지 구매 가능합니다.`);
      return false;
    }
    
    this.cart.push({
      id: Date.now() + Math.random(),
      numbers: [...numbers].sort((a, b) => a - b),
      isAuto
    });
    
    this.dispatchEvent(new CustomEvent('cart-updated', { detail: this.cart }));
    return true;
  }

  removeFromCart(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    this.dispatchEvent(new CustomEvent('cart-updated', { detail: this.cart }));
  }

  clearCart() {
    this.cart = [];
    this.dispatchEvent(new CustomEvent('cart-updated', { detail: this.cart }));
  }

  purchase() {
    const totalCost = this.cart.length * this.COST_PER_GAME;
    if (this.points < totalCost) {
      alert('포인트가 부족합니다.');
      return false;
    }
    
    if (this.cart.length === 0) {
      alert('구매할 로또가 없습니다.');
      return false;
    }

    this.updatePoints(-totalCost);
    const purchasedGames = [...this.cart];
    this.clearCart();
    alert(`${purchasedGames.length}게임 구매가 완료되었습니다!`);
    return true;
  }
}

const app = new AppManager();

/**
 * Helper to get ball class based on number
 */
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
    app.addEventListener('points-updated', (e) => this.updatePoints(e.detail));
  }

  updatePoints(points) {
    const el = this.querySelector('#points-display');
    if (el) el.textContent = points.toLocaleString();
  }

  render() {
    this.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
        <h1 style="font-size: 1.5rem; color: var(--primary-color);">Lotto 6/45</h1>
        <div style="display: flex; align-items: center; gap: 1.5rem;">
          <div style="background: #f1f5f9; padding: 0.5rem 1rem; border-radius: var(--radius-full); display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.875rem; color: var(--text-muted);">보유 포인트:</span>
            <span id="points-display" style="font-weight: bold; color: var(--primary-color);">${app.points.toLocaleString()}</span>
            <span style="font-size: 0.75rem; font-weight: bold;">P</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline" style="font-size: 0.875rem;">로그인</button>
            <button class="btn btn-primary" style="font-size: 0.875rem;">회원가입</button>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define('lotto-header', LottoHeader);

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
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.querySelector('.number-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      
      const num = parseInt(btn.dataset.num);
      if (this.selectedNumbers.has(num)) {
        this.selectedNumbers.delete(num);
        btn.classList.remove('selected');
      } else {
        if (this.selectedNumbers.size >= 6) {
          alert('최대 6개까지만 선택 가능합니다.');
          return;
        }
        this.selectedNumbers.add(num);
        btn.classList.add('selected');
      }
      this.updateSelectedDisplay();
    });

    this.querySelector('#auto-select').addEventListener('click', () => {
      this.autoSelect();
    });

    this.querySelector('#auto-five').addEventListener('click', () => {
      for (let i = 0; i < 5; i++) {
        const nums = this.generateRandomNumbers();
        app.addToCart(nums, true);
      }
    });

    this.querySelector('#reset-select').addEventListener('click', () => {
      this.resetSelection();
    });

    this.querySelector('#add-to-cart').addEventListener('click', () => {
      if (this.selectedNumbers.size !== 6) {
        alert('번호 6개를 모두 선택해주세요.');
        return;
      }
      if (app.addToCart(Array.from(this.selectedNumbers), false)) {
        this.resetSelection();
      }
    });
  }

  autoSelect() {
    this.resetSelection();
    const nums = this.generateRandomNumbers();
    nums.forEach(n => {
      this.selectedNumbers.add(n);
      this.querySelector(`.num-btn[data-num="${n}"]`).classList.add('selected');
    });
    this.updateSelectedDisplay();
  }

  generateRandomNumbers() {
    const nums = new Set();
    while (nums.size < 6) {
      nums.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(nums);
  }

  resetSelection() {
    this.selectedNumbers.clear();
    this.querySelectorAll('.num-btn').forEach(btn => btn.classList.remove('selected'));
    this.updateSelectedDisplay();
  }

  updateSelectedDisplay() {
    const container = this.querySelector('#selected-preview');
    container.innerHTML = '';
    Array.from(this.selectedNumbers).sort((a,b) => a-b).forEach(n => {
      const ball = document.createElement('div');
      ball.className = `lotto-ball ${getBallClass(n)}`;
      ball.textContent = n;
      container.appendChild(ball);
    });
  }

  render() {
    let gridHtml = '';
    for (let i = 1; i <= 45; i++) {
      gridHtml += `<button class="num-btn btn btn-outline" data-num="${i}" style="width: 100%; aspect-ratio: 1; padding: 0;">${i}</button>`;
    }

    this.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          번호 선택
          <span style="font-size: 0.875rem; color: var(--text-muted); font-weight: normal;">${app.COST_PER_GAME.toLocaleString()} P / 게임</span>
        </h2>
        
        <div class="number-grid">
          ${gridHtml}
        </div>

        <div style="background: #f8fafc; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; min-height: 60px;">
          <div id="selected-preview" style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <span style="color: var(--text-muted); font-size: 0.875rem;">번호를 선택하거나 자동 선택을 눌러주세요.</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <button id="auto-select" class="btn btn-outline">자동 선택</button>
          <button id="auto-five" class="btn btn-outline" style="border-color: var(--accent-color); color: var(--accent-color);">자동 5게임 추가</button>
          <button id="reset-select" class="btn btn-outline" style="border-color: var(--danger-color); color: var(--danger-color);">초기화</button>
          <button id="add-to-cart" class="btn btn-primary">선택 번호 추가</button>
        </div>
      </div>
      
      <style>
        .num-btn.selected {
          background-color: var(--primary-color) !important;
          color: white !important;
          border-color: var(--primary-color) !important;
        }
      </style>
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
    app.addEventListener('cart-updated', (e) => this.updateCart(e.detail));
  }

  updateCart(cart) {
    const list = this.querySelector('#cart-items');
    list.innerHTML = '';
    
    if (cart.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">선택된 게임이 없습니다.</div>';
    } else {
      cart.forEach(item => {
        const div = document.createElement('div');
        div.style = 'display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;';
        
        let ballsHtml = '';
        item.numbers.forEach(n => {
          ballsHtml += `<div class="lotto-ball ${getBallClass(n)}" style="width: 24px; height: 24px; font-size: 0.65rem;">${n}</div>`;
        });

        div.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="display: flex; gap: 0.25rem;">${ballsHtml}</div>
            <span style="font-size: 0.65rem; color: var(--text-muted);">${item.isAuto ? '자동' : '수동'}</span>
          </div>
          <button class="remove-btn" data-id="${item.id}" style="background: none; border: none; color: var(--danger-color); cursor: pointer; padding: 0.25rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
          </button>
        `;
        list.appendChild(div);
      });
    }

    this.querySelector('#cart-count').textContent = cart.length;
    this.querySelector('#total-price').textContent = (cart.length * app.COST_PER_GAME).toLocaleString();
    
    // Setup remove buttons
    this.querySelectorAll('.remove-btn').forEach(btn => {
      btn.onclick = () => app.removeFromCart(btn.dataset.id);
    });
  }

  render() {
    this.innerHTML = `
      <div class="card" style="height: fit-content; position: sticky; top: 100px;">
        <h2 style="margin-bottom: 1rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">구매 목록</h2>
        
        <div id="cart-items" style="max-height: 400px; overflow-y: auto; margin-bottom: 1.5rem;">
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">선택된 게임이 없습니다.</div>
        </div>

        <div style="border-top: 2px solid #f1f5f9; padding-top: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="color: var(--text-muted);">수량</span>
            <span style="font-weight: bold;"><span id="cart-count">0</span> / ${app.MAX_CART_SIZE}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem; font-size: 1.25rem; font-weight: bold;">
            <span>결제 금액</span>
            <span style="color: var(--primary-color);"><span id="total-price">0</span> P</span>
          </div>
          <button id="purchase-btn" class="btn btn-primary" style="width: 100%; padding: 1rem;">구매하기</button>
        </div>
      </div>
    `;

    this.querySelector('#purchase-btn').onclick = () => app.purchase();
  }
}
customElements.define('lotto-cart', LottoCart);
