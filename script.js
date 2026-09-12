// 元号データベース = [{name: 元号, year: 元年の西暦}, ...]
import {eraList} from "./eraList.js";

// 見えてる数字絡み
let totalScore = 0;
let targetValue = 0;
let scoreResetTimer = null;

// ドラッグ中の情報
let draggedCard = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isFromHand = false;
let dragGhost = null;
let startPointerX = 0;
let startPointerY = 0;
let hasDragged = false;
let preventNextClick = false;

// ゲームタイマー
const GAME_TIME_LIMIT = 90;
let endTime = 0;
let timerInterval = null;
let isGameOver = true;
const timerDisplay = document.getElementById("gameTimer");

let roundTimer = 0;


const handArea = document.getElementById("handArea");
const fieldArea = document.getElementById("fieldArea");
const actionArea = document.getElementById("actionArea");

const startBtn = document.getElementById("startBtn");
const confirmBtn = document.getElementById("comfirm");

const scoreDisplay = document.getElementById("score");
const targetDisplay = document.getElementById("targetDisplay");
const currentSumDisplay = document.getElementById("currentSum");

const prepareArea = document.getElementById("prepareArea");
const toggleHandBtn = document.getElementById("toggleHandBtn");

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeBtn = document.getElementById('closeModalBtn');
const openListBtn = document.getElementById("openList");
const howToBtn = document.getElementById("howTo");



// ゲーム処理
function startRound() {
  if (isGameOver) return;
  roundTimer = Date.now()/1000;

  handArea.innerHTML = "";
  fieldArea.innerHTML = "";
  confirmBtn.disabled = false;

  prepareArea.classList.remove("closed");
  toggleHandBtn.textContent = "▼";


  // 手札生成
  const shuffled = [...eraList].sort(() => 0.5 - Math.random());
  const selectedCards = shuffled.slice(0, 5);

  // 目標値生成
  const sampleCount = Math.floor(Math.random() * 3) + 1; // 手札の1-3枚の合計地付近
  const sampleCards = [...selectedCards].sort(() => 0.5 - Math.random()).slice(0, sampleCount);
  const baseTarget = sampleCards.reduce((sum, card) => sum + card.year, 0);
  const offset = Math.floor(Math.random() * 61) - 30; // 最大誤差30とす
  targetValue = Math.max(100, baseTarget + offset);

  targetDisplay.textContent = `目標の数値: ${targetValue}`;
  updateFieldSum();

  // 手札カードを描画
  selectedCards.forEach((era, index) => {
    const cardEl = createCardElement(era, index);
    handArea.appendChild(cardEl);
  });
}

// カードのHTML要素生成
function createCardElement(era, cardId) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  card.dataset.year = era.year;
  card.dataset.cardId = cardId;

  card.innerHTML = `
    <span class="era-name">${era.name}</span>
    <span class="era-year">${era.year}年</span>
  `;

  // ドラッグイベント
  card.addEventListener("pointerdown", (e) => startDrag(e, card, true));
  // タップ/クリックでも移動可能
  card.addEventListener("click", () => {
    if (card.classList.contains("disabled") || isGameOver) return;
    
    const cardRect = card.getBoundingClientRect();
    const fieldRect = fieldArea.getBoundingClientRect();

    const defaultX = cardRect.left - fieldRect.left;
    const defaultY = fieldRect.height/3;

    placeCloneToField(card, defaultX, defaultY);
  });

  return card;
}





// ドラッグ管理
// フィールド用の複製カードを生成
function createFieldClone(handCard, x, y) {
  const clone = handCard.cloneNode(true);
  clone.addEventListener("pointerdown", (e) => startDrag(e, clone, false));
  clone.addEventListener("click", () => removeCloneFromField(clone));
  setPosition(clone, x, y);
  return clone;
}

// 座標のクランプと反映
function setPosition(el, x, y) {
  const rect = fieldArea.getBoundingClientRect();
  const cardWidth = 75; // カード幅
  const cardHeight = 50; // カード高

  // 上下左右、フィールドの端から10pxより内側に。
  const minX = 10;
  const maxX = Math.max(10, rect.width - cardWidth - 10);
  const minY = 10; 
  const maxY = Math.max(10, rect.height - cardHeight - 10);

  el.style.left = `${Math.min(Math.max(minX, x), maxX)}px`;
  el.style.top = `${Math.min(Math.max(minY, y), maxY)}px`;
}

// 手札カードからフィールドへ配置
function placeCloneToField(handCard, x, y) {
  const clone = createFieldClone(handCard, x, y);
  fieldArea.appendChild(clone);
  handCard.classList.add("disabled");
  updateFieldSum();
}

// フィールドカードの削除・手札の復帰
function removeCloneFromField(clone) {
  const cardId = clone.dataset.cardId;
  const handCard = handArea.querySelector(`[data-card-id="${cardId}"]`);
  if (handCard) handCard.classList.remove("disabled");
  clone.remove();
  updateFieldSum();
}


window.addEventListener("click", (e) => {
  if (preventNextClick) {
    e.stopImmediatePropagation();
    e.preventDefault();
    preventNextClick = false;
  }
}, true);


// ドラッグ開始処理
function startDrag(e, card, fromHand) {
  if (e.button !== undefined && e.button !== 0) return;
  if (card.classList.contains("disabled") || isGameOver) return;
  draggedCard = card;
  isFromHand = fromHand;
  const rect = card.getBoundingClientRect(); // 要素の表示上の位置大きさを取得
  startPointerX = e.clientX;
  startPointerY = e.clientY;
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  dragGhost = card.cloneNode(true);
  dragGhost.style.position = "fixed";
  dragGhost.style.pointerEvents = "none";
  dragGhost.style.zIndex = "9999";
  dragGhost.style.opacity = "0.85";
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  dragGhost.style.left = `${e.clientX - dragOffsetX}px`;
  dragGhost.style.top = `${e.clientY - dragOffsetY}px`;
  document.body.appendChild(dragGhost);

  if (!isFromHand) {
    card.style.opacity = "0.2";
  }

  e.preventDefault();
}


// 移動中
window.addEventListener("pointermove", (e)=> {
  if (!draggedCard || !dragGhost) return;

  // 5px以上移動したらドラッグと認定
  if (!hasDragged && Math.hypot(e.clientX - startPointerX, e.clientY - startPointerY) > 5) {
    hasDragged = true;
  }
  dragGhost.style.left = `${e.clientX - dragOffsetX}px`;
  dragGhost.style.top = `${e.clientY - dragOffsetY}px`;
})


// 離した時
window.addEventListener("pointerup", (e) => {
  if (!draggedCard) return;
  if (dragGhost) {
    dragGhost.remove();
    dragGhost = null;
  }
  if (!isFromHand) {
    draggedCard.style.opacity = "1";
  }
  if (!hasDragged) {
    draggedCard = null;
    isFromHand = false;
    return;
  }

  if (hasDragged) {
    preventNextClick = true;
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    const toHand = dropTarget ? dropTarget.closest("#handArea") : null;
    const fieldRect = fieldArea.getBoundingClientRect();
    const x = e.clientX - fieldRect.left - dragOffsetX;
    const y = e.clientY - fieldRect.top - dragOffsetY;

    if (isFromHand && !toHand) {
      placeCloneToField(draggedCard, x, y);
    } else if (!isFromHand && toHand) {
      removeCloneFromField(draggedCard);
    } else if (!isFromHand && !toHand) {
      setPosition(draggedCard, x, y);
      updateFieldSum();
    }
  }

  draggedCard = null;
  isFromHand = false;
  hasDragged = false;

  setTimeout(() => {
    preventNextClick = false;
  }, 200);
})





// 選択されたフィールドの西暦合計
function updateFieldSum() {
  const fieldCards = fieldArea.querySelectorAll(".card");
  let sum = 0;
  fieldCards.forEach((card) => {
    sum += parseInt(card.dataset.year, 10);
  });
  currentSumDisplay.textContent = `現在の選択合計: ${sum}`;
  return sum;
}

// 確定ボタンを押したときのスコア計算
confirmBtn.addEventListener("click", () => {
  if (isGameOver) return;

  const currentSum = updateFieldSum();
  const diff = Math.abs(targetValue - currentSum);
  let gainedScore = 0;
  let isSpeed = Math.ceil(Date.now() / 1000 - roundTimer);

  if (diff === 0) {
    gainedScore = targetValue * 1.25;
  } else if (diff > targetValue *0.75) {
    gainedScore = 0;
  } else {
    gainedScore = Math.ceil(targetValue / Math.sqrt(diff));
  };
  if (isSpeed <= 5) {
    gainedScore *= 1.25;
  } else {
    gainedScore = Math.max(0, gainedScore - isSpeed * 10);
  };
  gainedScore = Math.ceil(gainedScore);
  console.log(`速度: ${isSpeed}, 誤差: ${diff}, 得点: ${gainedScore}`);

  totalScore += gainedScore;
  confirmBtn.disabled = true;

  scoreDisplay.textContent = `現在の得点: ${totalScore} 点 + ${gainedScore}`;
  if (scoreResetTimer) clearTimeout(scoreResetTimer);
  scoreResetTimer = setTimeout(() => {
    scoreDisplay.textContent = `現在の得点: ${totalScore} 点`;
  }, 3000);

  if (!isGameOver) startRound();
});



// 開始と制限時間
startBtn.addEventListener("click", startGame);

function startGame() {
  totalScore = 0;
  isGameOver = false;
  scoreDisplay.textContent = `現在の得点: ${totalScore} 点`;
  endTime = Date.now() + GAME_TIME_LIMIT * 1000;
  
  if (timerInterval) clearInterval(timerInterval);
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    const remainigMs = endTime - Date.now();
    const remainingSec = Math.max(0, Math.ceil(remainigMs/1000));
    timerDisplay.textContent = `残り時間: ${remainingSec} 秒`;
    if (remainigMs <= 0) {
      clearInterval(timerInterval);
      endGame();
    }
  }, 200);
  startRound();
}

function updateTimerDisplay() {
  const remainingSec = Math.max(0, Math.ceil((endTime - Date.now())/1000));
  timerDisplay.textContent = `残り時間: ${remainingSec} 秒`;
}

function endGame() {
  clearInterval(timerInterval);
  isGameOver = true;
  confirmBtn.disabled = true;
  timerDisplay.textContent = "終了";

  handArea.querySelectorAll(".card").forEach(c => c.classList.add("disabled"));
  fieldArea.querySelectorAll(".card").forEach(c => c.classList.add("disabled"));

  setTimeout(() => {
    let finalResult = `最終スコア: ${totalScore} 点`;
    openModal("タイムアップ", finalResult ,true)
  }, 100);
}





// モーダルを開く
function openModal(title, content, isHtml = false) {
    modalTitle.textContent = title;
    if (isHtml) {
        modalBody.innerHTML = content;
    } else {
        modalBody.innerHTML = content.replace(/\n/g, '<br>');
    }
    modalOverlay.classList.add('active');
}

// モーダルを閉じる
function closeModal() {
    modalOverlay.classList.remove('active');
}

// 元号一覧の処理
function buildEraListHtml(targetYear) {
  if (isNaN(targetYear)) return "";

  return eraList.map((era) => {
    const yearsPassed = targetYear - era.year;
    if (yearsPassed > 0) {
      return `
        <div class="listItem">
          <strong>${era.name}</strong><br>
          <small>元年: ${era.year}年</small><br>
          <small>数え年: ${yearsPassed+1}年</small><br>
          <small>満 ${yearsPassed}周年</small>
        </div>
      `;
    } else {
      return `
        <div class="listItem">
          <strong>${era.name}</strong><br>
          <small>元年: ${era.year}年</small><br>
          <small>(未開始)</small>
        </div>
      `;
    }
  }).join("");
}

// 元号一覧ボタン
openListBtn.addEventListener("click", () => {
  const currentYear = new Date().getFullYear();
  const contentHtml = `
    <div class="eraInputWrap" style="display:flex; justify-content:center; align-items:center">
      <p>基準にする西暦を入力してください：</p>
      <input type="number" id="inputYYYYMMDD" value="${currentYear}"> 年
    </div>
    <div id="eraListContainer" class="listGrid">
      ${buildEraListHtml(currentYear)}
    </div>
  `;

  openModal("元号一覧・経過年数チェッカー", contentHtml, true);

  const inputYear = document.getElementById("inputYYYYMMDD");
  const listContainer = document.getElementById("eraListContainer");

  inputYear.addEventListener("input", () => {
    const targetYear = parseInt(inputYear.value, 10);
    listContainer.innerHTML = buildEraListHtml(targetYear);
  });
});

// 遊び方ボタン
howToBtn.addEventListener("click", () => {
  const usageTaxt = `
  <ol>
    <li>「ゲーム開始」を押すと5枚の元号カードが出現します。
    <li>カードをフィールドエリアへドラッグ＆ドロップ（またはクリック）して移動させます。
    <li>「現在の選択合計」を「目標の数値」 にできるだけ近づけてください。
    <li>「確定」を押すと誤差に応じてスコアが獲得できます。
  </ol>
  「現在の選択合計」に用いられる数字は「元年の西暦」です。
  `;
  openModal("遊び方", usageTaxt, true);
});


// 閉じるボタン
closeBtn.addEventListener('click', closeModal);
// 背景クリック
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        closeModal();
    }
});




// mainArea下(手札)の開閉
toggleHandBtn.addEventListener("click", () => {
  prepareArea.classList.toggle("closed");
  const isClosed = prepareArea.classList.contains("closed");
  toggleHandBtn.textContent = isClosed ? "▲" : "▼";
});
