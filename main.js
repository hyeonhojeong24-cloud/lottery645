/**
 * AppManager - Central state management
 */
class AppManager extends EventTarget {
  constructor() {
    super();
    this.points = 25000; // Starting points as per prompt
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
      isAuto
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
      alert('보유예치금이 부족합니다.');
      return false;
    }

    this.updatePoints(-totalCost);
    this.clearSlots();
    alert('구매가 완료되었습니다!');
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
      <header style="background: white; border-bottom: 1px solid #ddd; padding: 10px 0; margin-bottom: 10px;">
        <div style="max-width: 1000px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 1rem;">
          <h1 style="font-size: 1.25rem; color: #333;">로또 6/45 구매</h1>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-outline" style="border: 1px solid #ddd; padding: 4px 12px;">로그인</button>
            <button class="btn btn-outline" style="border: 1px solid #ddd; padding: 4px 12px;">회원가입</button>
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
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.querySelector('.num-grid').addEventListener('click', (e) => {
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
    });

    this.querySelector('#reset-btn').addEventListener('click', () => this.resetSelection());
    this.querySelector('#auto-btn').addEventListener('click', () => this.autoSelect());
    this.querySelector('#confirm-btn').addEventListener('click', () => {
      const qty = parseInt(this.querySelector('#qty-select').value);
      for(let i=0; i<qty; i++) {
        const isAuto = this.selectedNumbers.size === 0;
        const nums = isAuto ? this.generateRandomNumbers() : Array.from(this.selectedNumbers);
        if (!app.confirmSelection(nums, isAuto)) break;
      }
      this.resetSelection();
    });
  }

  autoSelect() {
    this.resetSelection();
    const nums = this.generateRandomNumbers();
    nums.forEach(n => {
      this.selectedNumbers.add(n);
      this.querySelector(`.num-box[data-num="${n}"]`).classList.add('selected');
    });
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
      <div class="selection-panel">
        <div style="background: var(--lotto-magenta); color: white; padding: 8px 15px; font-weight: bold; text-align: center;">1,000원</div>
        <div class="num-grid">
          ${gridHtml}
        </div>
        <div style="display: flex; justify-content: space-around; padding: 10px; border-top: 1px solid var(--lotto-pink-light);">
          <button id="reset-btn" class="btn btn-pink-text">[초기화]</button>
          <button id="auto-btn" class="btn btn-pink-text">[자동선택]</button>
          <button id="my-num-btn" class="btn btn-pink-text">[나의번호등록]</button>
        </div>
      </div>
      
      <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 0.875rem; color: #333;">적용수량</span>
          <select id="qty-select" style="flex: 1; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </div>
        <button id="confirm-btn" class="btn btn-confirm">확인</button>
      </div>
    `;
  }
}
customElements.define('lotto-selector', LottoSelector);

/**
 * <lotto-cart> Component (Confirmation Area)
 */
class LottoCart extends HTMLElement {
  connectedCallback() {
    this.render();
    app.addEventListener('slots-updated', (e) => this.updateSlots(e.detail));
    app.addEventListener('points-updated', (e) => this.updatePoints(e.detail));
  }

  updatePoints(points) {
    this.querySelector('#balance-text').textContent = points.toLocaleString() + '원';
  }

  updateSlots(slots) {
    const container = this.querySelector('#slots-container');
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
          <span class="status-text" style="margin-right: 15px;">미지정</span>
          ${emptyBalls}
        </div>`;
      }

      div.innerHTML = `
        <span class="prefix">${prefix}</span>
        ${content}
        <div class="slot-actions">
          <button>수정</button>
          <button class="del-slot" data-index="${index}">삭제</button>
          <button>번호복사</button>
        </div>
      `;
      container.appendChild(div);
    });

    this.querySelector('.del-slot')?.forEach(btn => {
      btn.onclick = () => app.removeSlot(btn.dataset.index);
    });
    
    this.querySelector('#total-price').textContent = (totalCount * app.COST_PER_GAME).toLocaleString() + '원';
  }

  render() {
    this.innerHTML = `
      <div class="confirmation-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 2px solid var(--lotto-blue-grey);">
          <h2 style="font-size: 1rem;">선택 번호 확인</h2>
          <button id="clear-slots" style="background: #757575; color: white; border: none; padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">초기화</button>
        </div>
        
        <div id="slots-container" style="flex: 1;">
          <!-- A-E slots rendered here -->
        </div>

        <div style="padding: 15px; background: var(--lotto-blue-grey-light);">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <span style="font-size: 0.75rem; color: var(--text-muted);">보유예치금</span>
                <button style="font-size: 0.65rem; border: 1px solid #ddd; padding: 1px 4px; background: white;">충전</button>
              </div>
              <div id="balance-text" style="font-size: 1.5rem; font-weight: bold;">${app.points.toLocaleString()}원</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 5px;">결제 금액</div>
              <div id="total-price" style="font-size: 1.5rem; font-weight: bold; color: var(--lotto-orange);">0원</div>
            </div>
          </div>
        </div>
        <button id="purchase-btn" class="btn btn-purchase">구매하기</button>
      </div>
    `;

    this.querySelector('#clear-slots').onclick = () => app.clearSlots();
    this.querySelector('#purchase-btn').onclick = () => app.purchase();
    this.updateSlots(app.slots);
  }
}
customElements.define('lotto-cart', LottoCart);
