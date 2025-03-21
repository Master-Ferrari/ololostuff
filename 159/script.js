// Размеры доски
const rows = 5, cols = 9;
let board = [];
let currentTurn = 0;
let gameOver = false;

// Таймер хода
const turnTime = 30;
let remainingTime = turnTime;
let turnTimerInterval = null;

// Флаги и параметры игры
let isHost = false;
let maxPlayers = 0;
let players = []; // для хоста: объекты { index, peerId, conn, nickname }
let myPlayerIndex = null; // для всех игроков
const targetWords = ["ABCD", "BADC", "CDAB", "DCBA"]; // комбинации для игроков

// Звуковой эффект смены хода
const audioTurnChange = new Audio("https://crudblobs.blob.core.windows.net/sounds/001.wav");

// PeerJS
let peer = null;
// Для подключающихся (не-хост) используем один connection (соединение с хостом)
let conn = null;

// DOM-элементы
const statusDiv = document.getElementById("status");
const boardDiv = document.getElementById("board");
const letterSelectionDiv = document.getElementById("letterSelection");
const playerWordDiv = document.getElementById("playerWord");
const waitingInfoDiv = document.getElementById("waitingInfo");
const legendDiv = document.getElementById("legend");

const hostBtn = document.getElementById("hostBtn");
const playerCountSelect = document.getElementById("playerCount");
const startGameBtn = document.getElementById("startGameBtn");
const joinIdInput = document.getElementById("joinId");
const joinBtn = document.getElementById("joinBtn");
const nicknameInput = document.getElementById("nickname");

let selectedCell = null; // выбранная ячейка для хода

// ========= Инициализация подключения =========

// Для хоста: создать комнату
hostBtn.addEventListener("click", () => {
  isHost = true;
  myPlayerIndex = 0; // хост – игрок 1 (индекс 0)
  
  // Получаем ник хоста
  let nick = nicknameInput.value.trim();
  if (!nick) nick = "Игрок 1";
  
  // Скрываем поля для подключения
  joinIdInput.style.display = "none";
  joinBtn.style.display = "none";
  
  // Показываем выбор числа игроков
  playerCountSelect.style.display = "inline-block";
  
  // Инициализируем список игроков (хост – игрок 0)
  players = [{ index: 0, peerId: null, conn: null, nickname: nick }];
  
  initPeer();
});

// Для подключающихся: ввести ID хоста и ник
joinBtn.addEventListener("click", () => {
  isHost = false;
  const hostId = joinIdInput.value.trim();
  if (!hostId) {
    alert("Введите ID хоста");
    return;
  }
  
  let nick = nicknameInput.value.trim();
  if (!nick) nick = "Игрок";
  
  initPeer(hostId, nick);
});

// Инициализация PeerJS
function initPeer(hostId, nick) {
  peer = new Peer();

  peer.on('open', (id) => {
    console.log("Мой peer ID: " + id);
    if (isHost) {
      players[0].peerId = id;
      updateStatus("Комната создана. Ваш ID: " + id + ". Ожидание подключения...");
    } else {
      updateStatus("Подключение к хосту...");
      conn = peer.connect(hostId);
      setupConnection(conn);
      // Отправляем ник после установления соединения
      conn.on('open', () => {
        conn.send({ type: "nickname", nickname: nick });
      });
    }
  });

  if (isHost) {
    // При входящем соединении от другого игрока
    peer.on('connection', (connection) => {
      connection.on('open', () => {
        // Назначаем новому игроку индекс = players.length (хост – индекс 0)
        let assignedIndex = players.length;
        connection.playerIndex = assignedIndex; // сохраняем индекс в объекте соединения
        players.push({ index: assignedIndex, peerId: connection.peer, conn: connection, nickname: "Игрок " + (assignedIndex + 1) });
        // Отправляем игроку его индекс и общее число игроков (из выпадающего списка)
        connection.send({ type: "assignPlayer", index: assignedIndex, maxPlayers: parseInt(playerCountSelect.value) });
        updateWaitingInfo();
        setupConnection(connection);
      });
    });
  }
}

// Настройка соединения: прослушка сообщений и ошибок
function setupConnection(connection) {
  connection.on('data', (data) => {
    onDataReceived(data, connection);
  });
  connection.on('error', (err) => {
    console.error(err);
    updateStatus("Ошибка подключения");
  });
}

// Обновление информации о подключённых игроках (для хоста)
function updateWaitingInfo() {
  const count = players.length;
  maxPlayers = parseInt(playerCountSelect.value);
  let nicks = players.map(p => p.nickname).join(", ");
  waitingInfoDiv.textContent = "Подключено: " + count + " из " + maxPlayers + ". Ники: " + nicks;
  if (count === maxPlayers) {
    startGameBtn.style.display = "inline-block";
    updateStatus("Все игроки подключены. Нажмите 'Начать игру'.");
  }
}

// Хост: начать игру (после подключения нужного числа игроков)
startGameBtn.addEventListener("click", () => {
  maxPlayers = parseInt(playerCountSelect.value);
  initGameState();
  // Рассылаем сообщение всем игрокам
  broadcast({ type: "startGame", board: board, currentTurn: currentTurn, maxPlayers: maxPlayers });
  startGame();
});

// ========= Запуск игры =========

function initGameState() {
  board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = "";
    }
  }
  currentTurn = 0;
  gameOver = false;
}

function startGame() {
  // Скрываем блок подключения
  document.getElementById("connection").style.display = "none";
  // Отображаем слово игрока согласно его индексу
  playerWordDiv.textContent = "Ваше слово: " + targetWords[myPlayerIndex];
  createBoardUI();
  updateStatus(currentTurn === myPlayerIndex ? "Ваш ход" : "Ход: " + getPlayerNickname(currentTurn));
  updateLegend();
  startTurnTimer();
}

// ========= Отрисовка доски =========

function createBoardUI() {
  boardDiv.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener("click", cellClickHandler);
      boardDiv.appendChild(cell);
    }
  }
}

function updateCellUI(r, c, letter) {
  const cells = boardDiv.getElementsByClassName("cell");
  for (let cell of cells) {
    if (parseInt(cell.dataset.row) === r && parseInt(cell.dataset.col) === c) {
      cell.textContent = letter;
      cell.style.cursor = "default";
      break;
    }
  }
}

// ========= Таймер и легенда =========

function startTurnTimer() {
  remainingTime = turnTime;
  clearInterval(turnTimerInterval);
  turnTimerInterval = setInterval(() => {
    remainingTime--;
    updateLegend();
    if (remainingTime <= 0) {
      clearInterval(turnTimerInterval);
      if (isHost && isMyTurn() && !gameOver) {
        processTimeout();
      }
    }
  }, 1000);
  updateLegend();
}

function processTimeout() {
  updateStatus("Время вышло. Ход пропущен.");
  // Пропускаем ход: переходим к следующему игроку
  let oldTurn = currentTurn;
  currentTurn = (currentTurn + 1) % maxPlayers;
  if (oldTurn !== currentTurn) {
    audioTurnChange.play();
  }
  broadcast({ type: "timeout", currentTurn: currentTurn });
  updateLegend();
  startTurnTimer();
  updateStatus(currentTurn === myPlayerIndex ? "Ваш ход" : "Ход: " + getPlayerNickname(currentTurn));
}

function updateLegend() {
  if (!maxPlayers) return;
  let html = "<strong>Легенда:</strong><br>";
  for (let i = 0; i < maxPlayers; i++) {
    let nick = (players[i] && players[i].nickname) ? players[i].nickname : ("Игрок " + (i + 1));
    let line = nick + ": " + targetWords[i];
    if (i === currentTurn) {
      line += " <-- ход (" + remainingTime + " сек)";
      html += "<div style='font-weight:bold; color:red;'>" + line + "</div>";
    } else {
      html += "<div>" + line + "</div>";
    }
  }
  legendDiv.innerHTML = html;
}

function getPlayerNickname(index) {
  return (players[index] && players[index].nickname) ? players[index].nickname : ("Игрок " + (index + 1));
}

// ========= Ход игрока =========

function isMyTurn() {
  return myPlayerIndex === currentTurn;
}

function cellClickHandler(e) {
  if (!isMyTurn() || gameOver) return;
  const cell = e.currentTarget;
  const r = parseInt(cell.dataset.row);
  const c = parseInt(cell.dataset.col);
  if (board[r][c] !== "") return;
  selectedCell = { row: r, col: c };
  letterSelectionDiv.style.display = "block";
}

// Обработчики выбора символа
document.querySelectorAll("#letterSelection button").forEach(btn => {
  btn.addEventListener("click", (e) => {
    const letter = e.currentTarget.dataset.letter;
    if (selectedCell && !gameOver && isMyTurn()) {
      const { row, col } = selectedCell;
      if (isHost) {
        // Если хост – сразу обрабатываем ход
        processMove(row, col, letter, myPlayerIndex);
      } else {
        // Если не хост – посылаем сообщение хосту
        conn.send({ type: "move", row: row, col: col, letter: letter });
      }
      letterSelectionDiv.style.display = "none";
      selectedCell = null;
    }
  });
});

// ========= Обработка сообщений =========

function onDataReceived(data, connection) {
  console.log("Получено:", data);
  if (data.type === "assignPlayer") {
    // Для подключающихся: получение своего индекса и числа игроков
    myPlayerIndex = data.index;
    maxPlayers = data.maxPlayers;
    updateStatus("Подключено. Ожидание начала игры...");
  } else if (data.type === "nickname") {
    // Для хоста: получение ника от подключившегося игрока
    if (isHost && connection.playerIndex !== undefined) {
      players[connection.playerIndex].nickname = data.nickname;
      updateWaitingInfo();
    }
  } else if (data.type === "startGame") {
    board = data.board;
    currentTurn = data.currentTurn;
    maxPlayers = data.maxPlayers;
    startGame();
  } else if (data.type === "move") {
    if (!isHost) {
      let oldTurn = currentTurn;
      const { row, col, letter, currentTurn: newTurn, winner } = data;
      board[row][col] = letter;
      updateCellUI(row, col, letter);
      currentTurn = newTurn;
      if (oldTurn !== currentTurn) {
         audioTurnChange.play();
      }
      if (winner !== undefined && winner !== null) {
        updateStatus(winner === myPlayerIndex ? "Вы выиграли!" : "Победил: " + getPlayerNickname(winner));
        gameOver = true;
        clearInterval(turnTimerInterval);
      } else {
        updateStatus(currentTurn === myPlayerIndex ? "Ваш ход" : "Ход: " + getPlayerNickname(currentTurn));
        startTurnTimer();
      }
      updateLegend();
    } else {
      // Если хост получает ход от подключившегося игрока:
      const playerIndex = connection.playerIndex;
      if (playerIndex === currentTurn && board[data.row][data.col] === "") {
        processMove(data.row, data.col, data.letter, playerIndex);
      }
    }
  } else if (data.type === "timeout") {
    let oldTurn = currentTurn;
    currentTurn = data.currentTurn;
    if (oldTurn !== currentTurn) {
      audioTurnChange.play();
    }
    updateLegend();
    startTurnTimer();
    updateStatus(currentTurn === myPlayerIndex ? "Ваш ход" : "Ход: " + getPlayerNickname(currentTurn));
  }
}

// ========= Обработка хода (на стороне хоста) =========

function processMove(row, col, letter, playerIndex) {
  if (playerIndex !== currentTurn || board[row][col] !== "") return;
  board[row][col] = letter;
  updateCellUI(row, col, letter);
  
  // Проверяем, составил ли игрок свою комбинацию
  let winner = null;
  if (checkWin(board, targetWords[playerIndex])) {
    winner = playerIndex;
    gameOver = true;
    clearInterval(turnTimerInterval);
  }
  
  let oldTurn = currentTurn;
  // Если игра не окончена – переходим к следующему ходу
  if (!gameOver) {
    currentTurn = (currentTurn + 1) % maxPlayers;
  }
  if (oldTurn !== currentTurn) {
    audioTurnChange.play();
  }
  
  // Рассылаем сообщение всем игрокам
  broadcast({ type: "move", row: row, col: col, letter: letter, currentTurn: currentTurn, winner: winner });
  
  // Обновляем статус для хоста
  if (gameOver) {
    updateStatus(winner === myPlayerIndex ? "Вы выиграли!" : "Победил: " + getPlayerNickname(winner));
  } else {
    updateStatus(currentTurn === myPlayerIndex ? "Ваш ход" : "Ход: " + getPlayerNickname(currentTurn));
  }
  updateLegend();
  startTurnTimer();
}

// Рассылка сообщений от хоста всем подключённым игрокам
function broadcast(message) {
  players.forEach(p => {
    if (p.index !== 0 && p.conn && p.conn.open) {
      p.conn.send(message);
    }
  });
  // Хост уже обновил свою доску – дополнительная локальная обработка не нужна.
}

// ========= Функции отрисовки статуса и проверки победы =========

function updateStatus(message) {
  statusDiv.textContent = message;
}

function checkWin(b, target) {
  // Проверка по горизонтали, вертикали и диагонали
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (b[r][c] === target[0]) {
        // Горизонтально
        if (c <= cols - target.length) {
          let win = true;
          for (let i = 0; i < target.length; i++) {
            if (b[r][c + i] !== target[i]) win = false;
          }
          if (win) return true;
        }
        // Вертикально
        if (r <= rows - target.length) {
          let win = true;
          for (let i = 0; i < target.length; i++) {
            if (b[r + i][c] !== target[i]) win = false;
          }
          if (win) return true;
        }
        // Диагонально
        if (r <= rows - target.length && c <= cols - target.length) {
          let win = true;
          for (let i = 0; i < target.length; i++) {
            if (b[r + i][c + i] !== target[i]) win = false;
          }
          if (win) return true;
        }
      }
    }
  }
  return false;
}
