/**
 * AppManager - Central state management
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.points = 100000; // Restored to 100,000 points
    this.slots = Array(5).fill(null); // Fixed 5 slots (A-E)
    this.COST_PER_GAME = 1000;
  }

  updatePoints(amount) {
    this.points += amount;
    this.dispatchEvent(new CustomEvent('points-updated', { detail: this.points }));
  }

  confirmSelection(numbers, isAuto = false) {
    const nextSlotIndex = this.slots.findIndex(slot => slot === null);
    if (nextSlotIndex === -1) {
      alert('모든 슬롯이 가득 찼습니다.');
      return false;
    }
    
    this.slots[nextSlotIndex] = {
      numbers: [...numbers].sort((a, b) => a - b),
      isAuto: isAuto && numbers.length === 6 // Only true if 0 were selected initially
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
  }
  render() {
    this.innerHTML = `
      <header style="background: white; border-bottom: 1px solid #ddd; padding: 15px 0; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
        <div style="max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 1rem;">
          <h1 style="font-size: 1.5rem; color: var(--lotto-magenta); font-weight: 800; letter-spacing: -0.5px;">LOTTO 6/45</h1>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" style="border-color: #eee; background: #fafafa;">로그인</button>
            <button class="btn btn-outline" style="border-color: #eee; background: #fafafa;">회원가입</button>
          </div>
        </div>
      </header>
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
