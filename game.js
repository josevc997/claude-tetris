'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#4db6ac', // U - teal
  '#f06292', // F - pink
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,0,8],[8,8,8],[0,0,0]],                  // U
  [[9,9,9,0],[9,0,0,0],[9,9,9,0],[9,0,0,0]],  // F
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const overlayRecords = document.getElementById('overlay-records');
const overlayStats = document.getElementById('overlay-stats');
const overlayResetBtn = document.getElementById('overlay-reset-btn');
const startScreen = document.getElementById('start-screen');
const startRecords = document.getElementById('start-records');
const startStats = document.getElementById('start-stats');
const playBtn = document.getElementById('play-btn');
const startResetBtn = document.getElementById('start-reset-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, gameBestCombo, recordSaved;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 9) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    if (combo > gameBestCombo) gameBestCombo = combo;
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = 0;
  gameBestCombo = 0;
  recordSaved = false;
  lastTime = performance.now();
  hideGameOverRecords();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ---- Records (localStorage) ----
const RECORDS_KEY = 'tetris.records';
const MAX_RECORDS = 5;

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return emptyRecords();
    const data = JSON.parse(raw);
    const scores = Array.isArray(data.scores) ? data.scores : [];
    return {
      scores: scores
        .filter(s => s && typeof s.score === 'number')
        .map(s => ({
          name: String(s.name || '').slice(0, 12),
          score: s.score,
          lines: Number(s.lines) || 0,
          level: Number(s.level) || 1,
          date: s.date || '',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (err) {
    return emptyRecords();
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (err) {
    // localStorage unavailable (private mode, quota) — records stay in memory only
  }
}

function resetRecords() {
  const records = emptyRecords();
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch (err) {
    // ignore
  }
  return records;
}

function qualifies(value) {
  if (value <= 0) return false;
  const scores = loadRecords().scores;
  return scores.length < MAX_RECORDS || value > scores[scores.length - 1].score;
}

function addRecord(name, value, linesDone, levelReached) {
  const records = loadRecords();
  const entry = {
    name: String(name || 'Anónimo').trim().slice(0, 12) || 'Anónimo',
    score: value,
    lines: linesDone,
    level: levelReached,
    date: new Date().toISOString(),
  };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, MAX_RECORDS);
  saveRecords(records);
  return records.scores.indexOf(entry);
}

function updateBestStats(gameCombo, gameLines) {
  const records = loadRecords();
  if (gameCombo > records.bestCombo) records.bestCombo = gameCombo;
  if (gameLines > records.maxLines) records.maxLines = gameLines;
  saveRecords(records);
  return records;
}

function renderRecords(containerEl, highlightIndex) {
  const records = loadRecords();
  containerEl.textContent = '';
  if (records.scores.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Sin records todavía';
    containerEl.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'records-table';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  [['#', ''], ['NOMBRE', 'col-name'], ['PUNTOS', ''], ['LÍNEAS', ''], ['NIVEL', '']].forEach(([text, cls]) => {
    const th = document.createElement('th');
    th.textContent = text;
    if (cls) th.className = cls;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  records.scores.forEach((entry, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.className = 'is-new';
    const cells = [
      [String(i + 1), ''],
      [entry.name, 'col-name'],
      [entry.score.toLocaleString(), ''],
      [String(entry.lines), ''],
      [String(entry.level), ''],
    ];
    cells.forEach(([text, cls]) => {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  containerEl.appendChild(table);
}

function renderStats(el) {
  const records = loadRecords();
  el.textContent = `Mejor combo: ${records.bestCombo} · Líneas máx: ${records.maxLines}`;
}

function renderAllRecords(highlightIndex) {
  renderRecords(startRecords);
  renderStats(startStats);
  renderRecords(overlayRecords, highlightIndex);
  renderStats(overlayStats);
}

function showStartScreen() {
  renderAllRecords();
  startScreen.classList.remove('hidden');
}

function showNameFormIfQualifies() {
  if (gameOver && !recordSaved && qualifies(score)) {
    nameForm.classList.remove('hidden');
    nameInput.focus();
  } else {
    nameForm.classList.add('hidden');
  }
}

function showGameOverRecords() {
  updateBestStats(gameBestCombo, lines);
  nameInput.value = '';
  showNameFormIfQualifies();
  overlayRecords.classList.remove('hidden');
  overlayStats.classList.remove('hidden');
  overlayResetBtn.classList.remove('hidden');
  renderAllRecords();
}

function hideGameOverRecords() {
  nameForm.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  overlayStats.classList.add('hidden');
  overlayResetBtn.classList.add('hidden');
  nameInput.blur();
}

function submitRecord() {
  if (nameForm.classList.contains('hidden')) return;
  const idx = addRecord(nameInput.value, score, lines, level);
  recordSaved = true;
  nameForm.classList.add('hidden');
  nameInput.blur();
  renderAllRecords(idx);
}

function bindResetButton(btn) {
  let armed = false;
  let timer = null;
  const disarm = () => {
    armed = false;
    btn.textContent = 'Borrar records';
    btn.classList.remove('is-confirm');
    clearTimeout(timer);
  };
  btn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      btn.textContent = '¿Seguro?';
      btn.classList.add('is-confirm');
      timer = setTimeout(disarm, 3000);
      return;
    }
    resetRecords();
    disarm();
    if (gameOver) updateBestStats(gameBestCombo, lines);
    renderAllRecords();
    showNameFormIfQualifies();
  });
}

saveRecordBtn.addEventListener('click', submitRecord);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    submitRecord();
  }
});
playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});
bindResetButton(startResetBtn);
bindResetButton(overlayResetBtn);

document.addEventListener('keydown', e => {
  if (!startScreen.classList.contains('hidden')) return;
  if (document.activeElement === nameInput) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

showStartScreen();
