// ========== NETWORKING CHO GAME ==========
let gameSocket = null;

// Khởi tạo socket cho game
export function initGameSocket() {
  if (gameSocket && gameSocket.connected) return;
  
  gameSocket = io();
  console.log("🎮 Game socket initialized");
}

// Gửi dữ liệu người chơi
export function sendPlayer(data) {
  if (!gameSocket || !gameSocket.connected) return;
  gameSocket.emit("move", data);
}

// Lắng nghe danh sách người chơi
export function listenPlayers(callback) {
  if (!gameSocket) {
    initGameSocket();
  }
  
  gameSocket.on("players", (players) => {
    callback(players);
  });
}

// Ngắt kết nối
export function disconnectGame() {
  if (gameSocket) {
    gameSocket.disconnect();
    gameSocket = null;
  }
}
