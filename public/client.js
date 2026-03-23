const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreboardEl = document.getElementById("scoreboard");
const eventsEl = document.getElementById("events");
const latencyEl = document.getElementById("latency");
const hudEl = document.getElementById("hud");
const weaponStatusEl = document.getElementById("weaponStatus");
const spectatorStatusEl = document.getElementById("spectatorStatus");
const matchStatusEl = document.getElementById("matchStatus");
const mouseLockLineEl = document.getElementById("mouseLockLine");

const lobbyEl = document.getElementById("lobby");
const nameInput = document.getElementById("nameInput");
const saveNameBtn = document.getElementById("saveName");
const roomNameInput = document.getElementById("roomNameInput");
const createRoomBtn = document.getElementById("createRoom");
const createSpectate = document.getElementById("createSpectate");
const roomPasswordInput = document.getElementById("roomPasswordInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinCodeBtn = document.getElementById("joinCode");
const codeSpectate = document.getElementById("codeSpectate");
const rejoinLastBtn = document.getElementById("rejoinLast");
const roomListEl = document.getElementById("roomList");
const lobbyStatusEl = document.getElementById("lobbyStatus");
const lobbyErrorEl = document.getElementById("lobbyError");
const leaveRoomBtn = document.getElementById("leaveRoom");
const nameHintEl = document.getElementById("nameHint");
const teamsEl = document.getElementById("teams");
const killfeedEl = document.getElementById("killfeed");
const chatEl = document.getElementById("chat");
const chatMessagesEl = document.getElementById("chatMessages");
const chatInputEl = document.getElementById("chatInput");
const chatSendBtn = document.getElementById("chatSend");
const chatScopeGlobalBtn = document.getElementById("chatScopeGlobal");
const chatScopeTeamBtn = document.getElementById("chatScopeTeam");
const chatMutedEl = document.getElementById("chatMuted");
const minimapEl = document.getElementById("minimap");
const minimapCtx = minimapEl.getContext("2d");
const mapVoteEl = document.getElementById("mapVote");
const spectateControlsEl = document.getElementById("spectateControls");
const spectatePrevBtn = document.getElementById("spectatePrev");
const spectateNextBtn = document.getElementById("spectateNext");
const settingsEl = document.getElementById("settings");
const settingVolumeEl = document.getElementById("settingVolume");
const settingVolumeValueEl = document.getElementById("settingVolumeValue");
const settingSensitivityEl = document.getElementById("settingSensitivity");
const settingSensitivityValueEl = document.getElementById("settingSensitivityValue");
const settingUiScaleEl = document.getElementById("settingUiScale");
const settingUiScaleValueEl = document.getElementById("settingUiScaleValue");
const touchControlsEl = document.getElementById("touch-controls");
const touchJoystickEl = document.getElementById("touch-joystick");
const touchJoystickStickEl = document.getElementById("touch-joystick-stick");
const touchFireBtn = document.getElementById("touch-fire");
const touchGrenadeBtn = document.getElementById("touch-grenade");

let state = {
  players: [],
  bullets: [],
  obstacles: [],
  powerups: [],
  grenades: [],
  match: null,
  world: { width: 2200, height: 1400 },
  room: null,
};
let selfId = null;
let roomId = null;
let role = null;
let playerName = "";
let minPlayers = 2;
let maxPlayers = 10;
let chatScope = "global";
const events = [];
const mutedNames = new Map();
const blockedNames = new Map();
const killfeed = [];
let killfeedHideTimer = null;
let spectatorTargetId = null;
let spectatorFreeCam = false;
const spectatorInput = { up: false, down: false, left: false, right: false };
let spectatorCam = { x: 0, y: 0 };
let lastFrameTime = performance.now();
let audioCtx = null;
let lastShotSoundAt = 0;
let hitFlashUntil = 0;
const damagePopups = [];
const MAX_DAMAGE_POPUPS = 20;
const explosions = [];
let teamsPos = null;
let teamsDrag = null;
let recoilAngle = 0;
let localLastShotAt = 0;
const WEAPON_LABELS = {
  rifle: "Rifle",
  pistol: "Pistol",
};
const WEAPON_STATS = {
  rifle: { recoil: 0.02, recovery: 0.12, spread: 0.03, cooldown: 120 },
  pistol: { recoil: 0.04, recovery: 0.16, spread: 0.06, cooldown: 260 },
};
const MINIMAP_SIZE = 180;
const MINIMAP_SIZE_MOBILE = 150;
let minimapPos = null;
let minimapDrag = null;
const PANEL_IDS = [
  "hud",
  "scoreboard",
  "events",
  "chat",
  "settings",
  "killfeed",
  "mapVote",
  "spectateControls",
];
let panelPositions = {};
let panelDrag = null;
let settingsVisible = true;
let myMapVote = null;
let lastVoteKey = "";
let mapVoteVisible = false;
const DEFAULT_SETTINGS = {
  volume: 0.6,
  sensitivity: 1,
  uiScale: 1,
};
let settings = { ...DEFAULT_SETTINGS };

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
  throw: false,
  angle: 0,
  weapon: "rifle",
};

const mouse = { x: 0, y: 0 };
let pointerLocked = false;
let pointerSensitivity = 1.0;
const isTouchDevice =
  window.matchMedia("(pointer: coarse)").matches ||
  navigator.maxTouchPoints > 0 ||
  /Android|iPhone|iPad|iPod|Tablet|Mobile|Silk|Kindle|PlayBook/i.test(navigator.userAgent);
const touchState = {
  pointerId: null,
  centerX: 0,
  centerY: 0,
  radius: 50,
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const size = window.innerWidth <= 700 ? MINIMAP_SIZE_MOBILE : MINIMAP_SIZE;
  minimapEl.width = size;
  minimapEl.height = size;
  applyMinimapPosition();
  applyTeamsPosition();
  applyPanelPositions();
}

window.addEventListener("resize", resize);
loadMinimapPosition();
loadTeamsPosition();
loadPanelPositions();
loadSettings();
if (isTouchDevice) {
  document.body.classList.add("touch");
  if (mouseLockLineEl) {
    mouseLockLineEl.textContent = "Touch: drag to aim · Fire button to shoot";
  }
} else if (mouseLockLineEl) {
  mouseLockLineEl.textContent = "Mouse Lock: Click canvas (Esc to release)";
}
resize();
applySettings();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function applyTouchVector(x, y) {
  if (!isTouchDevice) return;
  const threshold = 0.2;
  input.left = x < -threshold;
  input.right = x > threshold;
  input.up = y < -threshold;
  input.down = y > threshold;
}

function resetTouchJoystick() {
  if (touchJoystickStickEl) {
    touchJoystickStickEl.style.transform = "translate(0, 0)";
  }
  touchState.pointerId = null;
  applyTouchVector(0, 0);
}

function ensureAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone(freq, duration, type, volume) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  const base = typeof volume === "number" ? volume : 0.05;
  gain.gain.value = base * settings.volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playShotSound() {
  playTone(520, 0.05, "square", 0.05);
}

function playHitSound() {
  playTone(220, 0.08, "triangle", 0.06);
}

function playKillSound() {
  playTone(140, 0.12, "sawtooth", 0.07);
  setTimeout(() => playTone(200, 0.08, "sawtooth", 0.06), 90);
}

function playExplosionSound() {
  playTone(110, 0.2, "square", 0.08);
  setTimeout(() => playTone(70, 0.18, "square", 0.07), 60);
}

function defaultMinimapPosition() {
  const edge = window.innerWidth <= 700 ? 12 : 24;
  const top = window.innerWidth <= 700 ? 320 : 320;
  const rect = minimapEl.getBoundingClientRect();
  const size = rect.width || minimapEl.width || MINIMAP_SIZE;
  return {
    x: window.innerWidth - size - edge,
    y: top,
  };
}

function defaultTeamsPosition() {
  const edge = window.innerWidth <= 700 ? 12 : 24;
  const top = window.innerWidth <= 700 ? 150 : 170;
  const rect = teamsEl.getBoundingClientRect();
  const width = rect.width || 220;
  const height = rect.height || 140;
  return {
    x: window.innerWidth - width - edge,
    y: top,
    width,
    height,
  };
}

function loadMinimapPosition() {
  try {
    const raw = localStorage.getItem("pvp_minimap_pos");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      minimapPos = { x: parsed.x, y: parsed.y };
    }
  } catch (err) {
    minimapPos = null;
  }
}

function loadTeamsPosition() {
  try {
    const raw = localStorage.getItem("pvp_teams_pos");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      teamsPos = { x: parsed.x, y: parsed.y };
    }
  } catch (err) {
    teamsPos = null;
  }
}

function loadPanelPositions() {
  try {
    const raw = localStorage.getItem("pvp_panel_positions");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      panelPositions = parsed;
    }
  } catch (err) {
    panelPositions = {};
  }
}

function savePanelPositions() {
  try {
    localStorage.setItem("pvp_panel_positions", JSON.stringify(panelPositions));
  } catch (err) {
    // ignore storage errors
  }
}

function applyPanelPosition(id) {
  const el = document.getElementById(id);
  if (!el) return;
  let pos = panelPositions[id];
  if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
    const rect = el.getBoundingClientRect();
    let startX = rect.left;
    if (id === "killfeed" || id === "mapVote") {
      startX = (window.innerWidth - rect.width) / 2;
    }
    pos = { x: startX, y: rect.top };
    panelPositions[id] = pos;
  }
  const edge = 8;
  const rect = el.getBoundingClientRect();
  const width = rect.width || 200;
  const height = rect.height || 120;
  pos.x = clamp(pos.x, edge, Math.max(edge, window.innerWidth - width - edge));
  pos.y = clamp(pos.y, edge, Math.max(edge, window.innerHeight - height - edge));
  el.style.left = `${pos.x}px`;
  el.style.top = `${pos.y}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
}

function applyPanelPositions() {
  PANEL_IDS.forEach((id) => applyPanelPosition(id));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("pvp_settings");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (typeof parsed.volume === "number") settings.volume = clamp(parsed.volume, 0, 1);
    if (typeof parsed.sensitivity === "number")
      settings.sensitivity = clamp(parsed.sensitivity, 0.4, 2.5);
    if (typeof parsed.uiScale === "number") settings.uiScale = clamp(parsed.uiScale, 0.8, 1.4);
  } catch (err) {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem("pvp_settings", JSON.stringify(settings));
  } catch (err) {
    // ignore storage errors
  }
}

function applySettings() {
  pointerSensitivity = settings.sensitivity;
  document.documentElement.style.setProperty("--ui-scale", settings.uiScale);
  if (settingVolumeEl) settingVolumeEl.value = Math.round(settings.volume * 100);
  if (settingVolumeValueEl) settingVolumeValueEl.textContent = `${Math.round(settings.volume * 100)}%`;
  if (settingSensitivityEl) settingSensitivityEl.value = settings.sensitivity.toFixed(2);
  if (settingSensitivityValueEl)
    settingSensitivityValueEl.textContent = settings.sensitivity.toFixed(2);
  if (settingUiScaleEl) settingUiScaleEl.value = settings.uiScale.toFixed(2);
  if (settingUiScaleValueEl) settingUiScaleValueEl.textContent = settings.uiScale.toFixed(2);
  applyMinimapPosition();
  applyTeamsPosition();
  applyPanelPositions();
}

function saveMinimapPosition() {
  if (!minimapPos) return;
  try {
    localStorage.setItem("pvp_minimap_pos", JSON.stringify(minimapPos));
  } catch (err) {
    // ignore storage errors
  }
}

function saveTeamsPosition() {
  if (!teamsPos) return;
  try {
    localStorage.setItem("pvp_teams_pos", JSON.stringify(teamsPos));
  } catch (err) {
    // ignore storage errors
  }
}

function applyMinimapPosition() {
  if (!minimapPos) {
    minimapPos = defaultMinimapPosition();
  }
  const edge = window.innerWidth <= 700 ? 12 : 24;
  const rect = minimapEl.getBoundingClientRect();
  const size = rect.width || minimapEl.width || MINIMAP_SIZE;
  minimapPos.x = clamp(minimapPos.x, edge, window.innerWidth - size - edge);
  minimapPos.y = clamp(minimapPos.y, edge, window.innerHeight - size - edge);
  minimapEl.style.left = `${minimapPos.x}px`;
  minimapEl.style.top = `${minimapPos.y}px`;
  minimapEl.style.right = "auto";
}

function applyTeamsPosition() {
  if (!teamsPos) {
    teamsPos = defaultTeamsPosition();
  }
  const edge = window.innerWidth <= 700 ? 12 : 24;
  const rect = teamsEl.getBoundingClientRect();
  const width = rect.width || 220;
  const height = rect.height || 140;
  teamsPos.x = clamp(teamsPos.x, edge, window.innerWidth - width - edge);
  teamsPos.y = clamp(teamsPos.y, edge, window.innerHeight - height - edge);
  teamsEl.style.left = `${teamsPos.x}px`;
  teamsEl.style.top = `${teamsPos.y}px`;
  teamsEl.style.right = "auto";
}

function showLobby(show) {
  lobbyEl.classList.toggle("hidden", !show);
  hudEl.style.display = show ? "none" : "block";
  scoreboardEl.style.display = show ? "none" : "block";
  teamsEl.style.display = show ? "none" : "block";
  eventsEl.style.display = show ? "none" : "block";
  killfeedEl.style.display = show ? "none" : "block";
  chatEl.style.display = show ? "none" : "flex";
  minimapEl.style.display = show ? "none" : "block";
  if (mapVoteEl) mapVoteEl.style.display = show ? "none" : mapVoteEl.style.display;
  if (settingsEl) settingsEl.style.display = show ? "none" : settingsVisible ? "flex" : "none";
  if (spectateControlsEl) spectateControlsEl.style.display = "none";
  if (touchControlsEl) touchControlsEl.style.display = show ? "none" : "";
  if (show) {
    minimapEl.classList.remove("dragging");
    minimapDrag = null;
    teamsEl.classList.remove("team-dragging");
    teamsDrag = null;
  }
  if (show && document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

function showLobbyError(message) {
  lobbyErrorEl.textContent = message || "";
}

function showLobbyStatus(message) {
  lobbyStatusEl.textContent = message || "";
}

function resetInput() {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.shoot = false;
  input.throw = false;
  input.angle = 0;
  input.weapon = "rifle";
  spectatorInput.up = false;
  spectatorInput.down = false;
  spectatorInput.left = false;
  spectatorInput.right = false;
  resetTouchJoystick();
}

function normalizeName(name) {
  return (name || "").toString().trim().toLowerCase();
}

function updateMutedDisplay() {
  const muted = [...mutedNames.values()];
  const blocked = [...blockedNames.values()];
  if (!muted.length && !blocked.length) {
    chatMutedEl.textContent = "";
    return;
  }
  const parts = [];
  if (muted.length) parts.push(`Muted: ${muted.join(", ")}`);
  if (blocked.length) parts.push(`Blocked: ${blocked.join(", ")}`);
  chatMutedEl.textContent = parts.join(" · ");
}

function loadLastServerCode() {
  const code = localStorage.getItem("pvp_last_code");
  if (code) {
    roomCodeInput.value = code;
    rejoinLastBtn.style.display = "inline-flex";
    rejoinLastBtn.textContent = `Rejoin last (${code})`;
  } else {
    rejoinLastBtn.style.display = "none";
  }
}

function saveLastServerCode(code) {
  if (!code) return;
  localStorage.setItem("pvp_last_code", code);
  loadLastServerCode();
}

function setChatScope(scope) {
  chatScope = scope === "team" ? "team" : "global";
  updateChatScopeUI();
}

function updateChatScopeUI() {
  const teamAvailable = role === "player";
  if (!teamAvailable && chatScope === "team") {
    chatScope = "global";
  }
  chatScopeGlobalBtn.classList.toggle("active", chatScope === "global");
  chatScopeTeamBtn.classList.toggle("active", chatScope === "team");
  chatScopeTeamBtn.disabled = !teamAvailable;
}

function formatTime(ts) {
  const date = new Date(ts);
  const h = `${date.getHours()}`.padStart(2, "0");
  const m = `${date.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

function formatTimer(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(total / 60);
  const secs = `${total % 60}`.padStart(2, "0");
  return `${mins}:${secs}`;
}

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function syncName() {
  const name = (nameInput.value || "").trim().slice(0, 16);
  if (!name) {
    showLobbyError("Enter a call sign first.");
    return null;
  }
  showLobbyError("");
  playerName = name;
  socket.emit("profile:set", playerName);
  nameHintEl.textContent = `Using call sign: ${playerName}`;
  return playerName;
}

saveNameBtn.addEventListener("click", () => {
  syncName();
});

nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") syncName();
});

createRoomBtn.addEventListener("click", () => {
  if (!syncName()) return;
  showLobbyStatus("Creating server...");
  socket.emit("room:create", {
    roomName: roomNameInput.value,
    password: roomPasswordInput.value,
    asSpectator: createSpectate.checked,
  });
});

roomNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") createRoomBtn.click();
});

joinCodeBtn.addEventListener("click", () => {
  if (!syncName()) return;
  const code = (roomCodeInput.value || "").trim();
  if (!code) {
    showLobbyError("Enter a server code.");
    return;
  }
  showLobbyStatus("Joining by code...");
  socket.emit("room:join-code", {
    code,
    asSpectator: codeSpectate.checked,
    password: roomPasswordInput.value,
  });
});

rejoinLastBtn.addEventListener("click", () => {
  if (!syncName()) return;
  const code = (roomCodeInput.value || "").trim();
  if (!code) {
    showLobbyError("Enter a server code.");
    return;
  }
  showLobbyStatus("Rejoining server...");
  socket.emit("room:join-code", {
    code,
    asSpectator: codeSpectate.checked,
    password: roomPasswordInput.value,
  });
});

roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinCodeBtn.click();
});

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

if (spectatePrevBtn) {
  spectatePrevBtn.addEventListener("click", () => {
    cycleSpectatorTarget(-1);
  });
}

if (spectateNextBtn) {
  spectateNextBtn.addEventListener("click", () => {
    cycleSpectatorTarget(1);
  });
}

if (settingVolumeEl) {
  settingVolumeEl.addEventListener("input", () => {
    const value = Number(settingVolumeEl.value || 0);
    settings.volume = clamp(value / 100, 0, 1);
    applySettings();
    saveSettings();
  });
}

if (settingSensitivityEl) {
  settingSensitivityEl.addEventListener("input", () => {
    const value = Number(settingSensitivityEl.value || 1);
    settings.sensitivity = clamp(value, 0.4, 2.5);
    applySettings();
    saveSettings();
  });
}

if (settingUiScaleEl) {
  settingUiScaleEl.addEventListener("input", () => {
    const value = Number(settingUiScaleEl.value || 1);
    settings.uiScale = clamp(value, 0.8, 1.4);
    applySettings();
    saveSettings();
  });
}

leaveRoomBtn.addEventListener("click", () => {
  socket.emit("room:leave");
});

chatScopeGlobalBtn.addEventListener("click", () => setChatScope("global"));
chatScopeTeamBtn.addEventListener("click", () => setChatScope("team"));

function joinRoom(targetRoomId, asSpectator) {
  if (!syncName()) return;
  showLobbyStatus("Joining server...");
  socket.emit("room:join", {
    roomId: targetRoomId,
    asSpectator,
    password: roomPasswordInput.value,
  });
}

socket.on("connect", () => {
  showLobby(true);
  showLobbyStatus("Connected. Loading servers...");
  updateChatScopeUI();
  updateMutedDisplay();
  loadLastServerCode();
  socket.emit("lobby:list");
});

socket.on("connect_error", () => {
  showLobby(true);
  showLobbyError("Unable to reach server. Is it running?");
  showLobbyStatus("");
  latencyEl.textContent = "Offline";
});

socket.on("disconnect", () => {
  showLobby(true);
  showLobbyError("Disconnected from server.");
  showLobbyStatus("");
  latencyEl.textContent = "Offline";
});

socket.on("profile:ok", (data) => {
  if (data && data.name) {
    playerName = data.name;
    nameInput.value = data.name;
  }
});

socket.on("lobby:list", (data) => {
  renderRoomList(data.rooms || []);
  showLobbyStatus("");
});

socket.on("room:joined", (data) => {
  selfId = data.id;
  roomId = data.roomId;
  role = data.role;
  minPlayers = data.minPlayers;
  maxPlayers = data.maxPlayers;
  if (isTouchDevice) {
    mouse.x = canvas.width / 2;
    mouse.y = canvas.height / 2;
  }
  state.room = {
    id: data.roomId,
    name: data.roomName,
    code: data.roomCode,
    map: data.roomMap,
    minPlayers,
    maxPlayers,
    players: 0,
    spectators: 0,
    active: false,
  };
  saveLastServerCode(data.roomCode);
  events.length = 0;
  killfeed.length = 0;
  renderKillfeed();
  renderEvents();
  showLobby(false);
  resetInput();
  spectatorFreeCam = false;
  damagePopups.length = 0;
  hitFlashUntil = 0;
  chatMessagesEl.innerHTML = "";
  chatInputEl.value = "";
  setChatScope("global");
  updateChatScopeUI();
  updateWeaponStatus();
  spectatorTargetId = null;
  updateMutedDisplay();
  showLobbyError("");
  showLobbyStatus("");
});

socket.on("room:left", () => {
  selfId = null;
  roomId = null;
  role = null;
  myMapVote = null;
  lastVoteKey = "";
  if (mapVoteEl) mapVoteEl.style.display = "none";
  state = {
    players: [],
    bullets: [],
    obstacles: [],
    powerups: [],
    grenades: [],
    match: null,
    world: state.world,
    room: null,
  };
  events.length = 0;
  killfeed.length = 0;
  renderKillfeed();
  renderEvents();
  resetInput();
  spectatorFreeCam = false;
  damagePopups.length = 0;
  hitFlashUntil = 0;
  chatMessagesEl.innerHTML = "";
  chatInputEl.value = "";
  setChatScope("global");
  updateChatScopeUI();
  spectatorTargetId = null;
  updateScoreboard();
  updateStatus();
  showLobby(true);
});

socket.on("room:error", (message) => {
  showLobbyError(message || "Unable to join server.");
});

socket.on("state", (snapshot) => {
  state = snapshot;
  updateScoreboard();
  updateTeamsPanel();
  updateMapVotePanel();
  if (role === "spectator" && !spectatorFreeCam) {
    const stillThere = state.players.find((p) => p.id === spectatorTargetId);
    if (!stillThere && state.players.length) {
      spectatorTargetId = state.players[0].id;
    }
  }
  updateStatus();
});

socket.on("event", (evt) => {
  if (!evt) return;
  if (evt.type === "join") {
    pushEvent(`${evt.name} joined`);
  }
  if (evt.type === "leave") {
    pushEvent(`${evt.name} left`);
  }
  if (evt.type === "spectate-join") {
    pushEvent(`${evt.name} is spectating`);
  }
  if (evt.type === "spectate-leave") {
    pushEvent(`${evt.name} stopped spectating`);
  }
  if (evt.type === "kill") {
    pushKillfeed(`${evt.killer} eliminated ${evt.victim}`);
  }
  if (evt.type === "map") {
    pushEvent(`Map rotated to ${evt.name}`);
  }
  if (evt.type === "match" && evt.state === "start") {
    pushEvent("Match started!");
  }
  if (evt.type === "match" && evt.state === "end") {
    const winner = evt.winner ? `Team ${evt.winner} wins!` : "Draw!";
    pushEvent(`Match ended. ${winner}`);
  }
});

socket.on("chat:message", (msg) => {
  if (!msg) return;
  appendChatMessage(msg);
});

socket.on("chat:system", (msg) => {
  if (!msg) return;
  appendSystemMessage(msg);
});

socket.on("hit", (data) => {
  if (!data) return;
  hitFlashUntil = performance.now() + 120;
  if (typeof data.x === "number" && typeof data.y === "number") {
    damagePopups.push({
      x: data.x,
      y: data.y,
      damage: data.damage || 0,
      createdAt: performance.now(),
    });
    while (damagePopups.length > MAX_DAMAGE_POPUPS) damagePopups.shift();
  }
  ensureAudio();
  playHitSound();
  if (data.killed) {
    playKillSound();
  }
});

socket.on("grenade:explode", (data) => {
  if (!data) return;
  explosions.push({
    x: data.x,
    y: data.y,
    radius: data.radius || 120,
    createdAt: performance.now(),
  });
  ensureAudio();
  playExplosionSound();
});

function renderRoomList(rooms) {
  roomListEl.innerHTML = "";
  if (!rooms.length) {
    const empty = document.createElement("div");
    empty.className = "room-item";
    empty.textContent = "No servers yet. Create one to start.";
    roomListEl.appendChild(empty);
    return;
  }

  rooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "room-item";

    const meta = document.createElement("div");
    meta.className = "room-meta";

    const name = document.createElement("div");
    name.className = "room-name";
    name.textContent = room.name;

    const info = document.createElement("div");
    info.className = "room-info";
    const waiting = room.players < room.minPlayers;
    const status = waiting
      ? `Waiting for ${room.minPlayers - room.players} player(s)`
      : "LIVE";
    const mapLabel = room.map ? `Map ${room.map}` : "Map ?";
    const privacy = room.private ? "Private" : "Public";
    info.textContent = `Code ${room.code} · ${mapLabel} · ${privacy} · Players ${room.players}/${room.maxPlayers} · Spectators ${room.spectators} · ${status}`;

    meta.appendChild(name);
    meta.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "room-actions";

    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Join";
    joinBtn.disabled = room.players >= room.maxPlayers;
    joinBtn.addEventListener("click", () => joinRoom(room.id, false));

    const spectateBtn = document.createElement("button");
    spectateBtn.textContent = "Spectate";
    spectateBtn.addEventListener("click", () => joinRoom(room.id, true));

    actions.appendChild(joinBtn);
    actions.appendChild(spectateBtn);

    item.appendChild(meta);
    item.appendChild(actions);

    roomListEl.appendChild(item);
  });
}

function pushEvent(text) {
  events.unshift({ text, time: Date.now() });
  if (events.length > 5) events.pop();
  renderEvents();
}

function renderEvents() {
  eventsEl.innerHTML = events
    .map((evt) => `<div class="event-line">${evt.text}</div>`)
    .join("");
}

function pushKillfeed(text) {
  killfeed.unshift({ text, time: Date.now() });
  if (killfeed.length > 5) killfeed.pop();
  renderKillfeed();
  if (killfeedHideTimer) {
    clearTimeout(killfeedHideTimer);
  }
  killfeedHideTimer = setTimeout(() => {
    killfeed.length = 0;
    renderKillfeed();
  }, 3000);
}

function renderKillfeed() {
  if (!killfeed.length) {
    killfeedEl.innerHTML = "";
    killfeedEl.style.opacity = "0";
    return;
  }
  killfeedEl.style.opacity = "1";
  killfeedEl.innerHTML = killfeed
    .map((entry) => `<div class="kill-line">${escapeHtml(entry.text)}</div>`)
    .join("");
}

function updateScoreboard() {
  if (!state.room) {
    scoreboardEl.innerHTML = `
      <div class="score-title">Scoreboard</div>
      <div class="score-row">Waiting in lobby...</div>
    `;
    return;
  }

  const players = [...state.players].sort((a, b) => b.kills - a.kills);
  const status = state.room.active
    ? "LIVE"
    : `Waiting for ${Math.max(state.room.minPlayers - state.room.players, 0)} player(s)`;
  const teamCounts = players.reduce(
    (acc, player) => {
      if (player.team === "A") acc.A += 1;
      if (player.team === "B") acc.B += 1;
      return acc;
    },
    { A: 0, B: 0 }
  );

  const matchRow = state.match
    ? `<div class="score-row">Score: ${state.match.scores.A}-${state.match.scores.B} / ${state.match.scoreLimit}</div>`
    : "";

  const metaRows = `
    <div class="score-row">Room: ${state.room.name}</div>
    <div class="score-row">Code: ${state.room.code || "—"}</div>
    <div class="score-row">Map: ${state.room.map || "—"}</div>
    <div class="score-row">Players: ${state.room.players}/${state.room.maxPlayers}</div>
    <div class="score-row">Spectators: ${state.room.spectators}</div>
    <div class="score-row">Status: ${status}</div>
    <div class="score-row">Role: ${role === "spectator" ? "Spectator" : "Player"}</div>
    <div class="score-row">Teams: A ${teamCounts.A} · B ${teamCounts.B}</div>
    ${matchRow}
  `;

  if (!players.length) {
    scoreboardEl.innerHTML = `
      <div class="score-title">Scoreboard</div>
      ${metaRows}
      <div class="score-row">Waiting for players...</div>
    `;
    return;
  }

  const rows = players
    .map((p) => {
      const isSelf = p.id === selfId;
      const safeName = escapeHtml(p.name);
      const teamClass = p.team === "A" ? "team-a" : "team-b";
      const badge = p.team ? `<span class="team-badge ${teamClass}">${p.team}</span>` : "";
      const name = isSelf ? `<strong>${badge}${safeName}</strong>` : `${badge}${safeName}`;
      return `
        <div class="score-row">
          <span>${name}</span>
          <span>${p.kills}/${p.deaths}</span>
        </div>
      `;
    })
    .join("");

  scoreboardEl.innerHTML = `
    <div class="score-title">Scoreboard</div>
    ${metaRows}
    ${rows}
  `;
}

function updateTeamsPanel() {
  if (!state.room) {
    teamsEl.innerHTML = `
      <div class="team-title">Teams</div>
      <div class="score-row">Join a server to view teams.</div>
    `;
    return;
  }

  const players = [...state.players];
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  const renderList = (team) =>
    team
      .map((player) => {
        const name = escapeHtml(player.name);
        return `<div class="team-player"><span>${name}</span><span>${player.kills}</span></div>`;
      })
      .join("");

  const scoreA = state.match ? state.match.scores.A : 0;
  const scoreB = state.match ? state.match.scores.B : 0;
  teamsEl.innerHTML = `
    <div class="team-title">Team A (${teamA.length}) · ${scoreA}</div>
    <div class="team-list">${renderList(teamA) || "<div class=\"team-player\"><span>No players</span></div>"}</div>
    <div class="team-title">Team B (${teamB.length}) · ${scoreB}</div>
    <div class="team-list">${renderList(teamB) || "<div class=\"team-player\"><span>No players</span></div>"}</div>
  `;
}

function updateMapVotePanel() {
  if (!mapVoteEl) return;
  const vote = state.match && state.match.vote ? state.match.vote : null;
  if (!vote || !Array.isArray(vote.options) || vote.options.length === 0) {
    mapVoteEl.style.display = "none";
    lastVoteKey = "";
    mapVoteVisible = false;
    mapVoteEl.classList.remove("show");
    return;
  }
  if (state.match && state.match.state !== "ended") {
    mapVoteEl.style.display = "none";
    mapVoteVisible = false;
    mapVoteEl.classList.remove("show");
    return;
  }

  const endsInMs = vote.endsInMs || 0;
  if (endsInMs <= 0) {
    mapVoteEl.style.display = "none";
    mapVoteVisible = false;
    mapVoteEl.classList.remove("show");
    return;
  }

  const key = vote.options.join("|");
  if (key !== lastVoteKey) {
    myMapVote = null;
    lastVoteKey = key;
  }

  const seconds = Math.max(1, Math.ceil(endsInMs / 1000));
  mapVoteEl.style.display = "block";
  if (!mapVoteVisible) {
    mapVoteVisible = true;
    mapVoteEl.classList.remove("show");
    void mapVoteEl.offsetWidth;
    mapVoteEl.classList.add("show");
    ensureAudio();
    playTone(420, 0.08, "triangle", 0.05);
  }
  mapVoteEl.innerHTML = `
    <div class="map-vote-title">Map Vote</div>
    <div class="map-vote-timer">Ends in ${seconds}s</div>
    ${vote.options
      .map((option, index) => {
        const count = Array.isArray(vote.counts) ? vote.counts[index] || 0 : 0;
        const safeOption = escapeHtml(option);
        return `
          <div class="map-vote-option">
            <span>${safeOption}</span>
            <span class="map-vote-count">${count} vote(s)</span>
            <button type="button" data-option="${safeOption}">Vote</button>
          </div>
        `;
      })
      .join("")}
  `;

  const canVote = role === "player";
  mapVoteEl.querySelectorAll("button[data-option]").forEach((btn) => {
    const option = btn.getAttribute("data-option");
    if (!canVote) {
      btn.disabled = true;
    }
    if (myMapVote && option === myMapVote) {
      btn.classList.add("active");
    }
    btn.addEventListener("click", () => {
      if (!canVote) return;
      myMapVote = option;
      socket.emit("map:vote", { option });
      ensureAudio();
      playTone(520, 0.06, "square", 0.04);
      updateMapVotePanel();
    });
  });
}

function updateWeaponStatus() {
  if (role !== "player") {
    weaponStatusEl.textContent = "Weapon: —";
    return;
  }
  const label = WEAPON_LABELS[input.weapon] || "Rifle";
  weaponStatusEl.textContent = `Weapon: ${label} (1/2 to swap)`;
}

function updateStatus() {
  if (!state.room) {
    latencyEl.textContent = "In lobby";
    weaponStatusEl.textContent = "";
    spectatorStatusEl.textContent = "";
    matchStatusEl.textContent = "";
    return;
  }
  if (touchControlsEl) {
    touchControlsEl.style.display =
      role === "player" && isTouchDevice ? "" : "none";
  }
  if (spectateControlsEl) {
    spectateControlsEl.style.display =
      role === "spectator" && isTouchDevice ? "flex" : "none";
  }
  const status = state.room.active ? "LIVE" : "WAITING";
  latencyEl.textContent = `${state.room.name} · ${status}`;
  updateWeaponStatus();

  if (state.match) {
    if (state.match.state === "running") {
      matchStatusEl.textContent = `Match: ${formatTimer(state.match.timeLeftMs)} · Score ${state.match.scores.A}-${state.match.scores.B}/${state.match.scoreLimit}`;
    } else if (state.match.state === "ended") {
      const winner = state.match.winner ? `Team ${state.match.winner} wins` : "Draw";
      matchStatusEl.textContent = `Match ended · ${winner} · Next in ${formatTimer(
        state.match.nextStartMs
      )}`;
    } else {
      matchStatusEl.textContent = `Waiting for players · Next in ${formatTimer(
        state.match.nextStartMs
      )}`;
    }
  } else {
    matchStatusEl.textContent = "";
  }

  if (role === "spectator") {
    if (spectatorFreeCam) {
      spectatorStatusEl.textContent = "Spectating: Free Cam (F to toggle, WASD to move)";
    } else {
      const target = state.players.find((p) => p.id === spectatorTargetId);
      const label = target ? target.name : "No players";
      spectatorStatusEl.textContent = `Spectating: ${label} ([ / ] to change)`;
    }
  } else {
    spectatorStatusEl.textContent = "";
  }
}

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

function setWeapon(key) {
  if (role !== "player") return;
  if (!WEAPON_LABELS[key]) return;
  input.weapon = key;
  updateWeaponStatus();
}

function toggleSpectatorFreeCam() {
  if (role !== "spectator") return;
  spectatorFreeCam = !spectatorFreeCam;
  if (spectatorFreeCam) {
    const focus = state.players.find((p) => p.id === spectatorTargetId) || state.players[0];
    spectatorCam = {
      x: focus ? focus.x : state.world.width / 2,
      y: focus ? focus.y : state.world.height / 2,
    };
  } else {
    spectatorInput.up = false;
    spectatorInput.down = false;
    spectatorInput.left = false;
    spectatorInput.right = false;
  }
  updateStatus();
}

function cycleSpectatorTarget(step) {
  if (role !== "spectator") return;
  if (spectatorFreeCam) return;
  if (!state.players.length) {
    spectatorTargetId = null;
    updateStatus();
    return;
  }
  let index = state.players.findIndex((p) => p.id === spectatorTargetId);
  if (index < 0) index = 0;
  index = (index + step + state.players.length) % state.players.length;
  spectatorTargetId = state.players[index].id;
  updateStatus();
}

function setKey(key, pressed) {
  if (role === "player") {
    if (key === "w" || key === "ArrowUp") input.up = pressed;
    if (key === "s" || key === "ArrowDown") input.down = pressed;
    if (key === "a" || key === "ArrowLeft") input.left = pressed;
    if (key === "d" || key === "ArrowRight") input.right = pressed;
    return;
  }

  if (role === "spectator" && spectatorFreeCam) {
    if (key === "w" || key === "ArrowUp") spectatorInput.up = pressed;
    if (key === "s" || key === "ArrowDown") spectatorInput.down = pressed;
    if (key === "a" || key === "ArrowLeft") spectatorInput.left = pressed;
    if (key === "d" || key === "ArrowRight") spectatorInput.right = pressed;
  }
}

window.addEventListener("keydown", (event) => {
  if (isTypingTarget(event.target)) return;
  if (event.key === "1") {
    ensureAudio();
    setWeapon("rifle");
  }
  if (event.key === "2") {
    ensureAudio();
    setWeapon("pistol");
  }
  if (event.key === "g" || event.key === "G") {
    if (role === "player") {
      input.throw = true;
      setTimeout(() => {
        input.throw = false;
      }, 50);
    }
  }
  if (event.key === "o" || event.key === "O") {
    toggleSettingsPanel();
  }
  if (event.key === "[" || event.code === "BracketLeft") cycleSpectatorTarget(-1);
  if (event.key === "]" || event.code === "BracketRight") cycleSpectatorTarget(1);
  if (event.key === "/" || event.code === "Slash") cycleSpectatorTarget(1);
  if (event.key === "f" || event.key === "F") toggleSpectatorFreeCam();
  setKey(event.key, true);
});

window.addEventListener("keyup", (event) => {
  if (isTypingTarget(event.target)) return;
  setKey(event.key, false);
});

if (isTouchDevice && touchJoystickEl) {
  touchJoystickEl.addEventListener("pointerdown", (event) => {
    if (role !== "player") return;
    touchJoystickEl.setPointerCapture(event.pointerId);
    touchState.pointerId = event.pointerId;
    const rect = touchJoystickEl.getBoundingClientRect();
    touchState.centerX = rect.left + rect.width / 2;
    touchState.centerY = rect.top + rect.height / 2;
    touchState.radius = Math.max(30, rect.width * 0.35);
    event.preventDefault();
  });

  touchJoystickEl.addEventListener("pointermove", (event) => {
    if (touchState.pointerId !== event.pointerId) return;
    const dx = event.clientX - touchState.centerX;
    const dy = event.clientY - touchState.centerY;
    const distance = Math.hypot(dx, dy) || 1;
    const clamped = distance > touchState.radius ? touchState.radius / distance : 1;
    const stickX = dx * clamped;
    const stickY = dy * clamped;
    if (touchJoystickStickEl) {
      touchJoystickStickEl.style.transform = `translate(${stickX}px, ${stickY}px)`;
    }
    applyTouchVector(stickX / touchState.radius, stickY / touchState.radius);
  });

  const endJoystick = (event) => {
    if (touchState.pointerId !== event.pointerId) return;
    if (touchJoystickEl.hasPointerCapture(event.pointerId)) {
      touchJoystickEl.releasePointerCapture(event.pointerId);
    }
    resetTouchJoystick();
  };

  touchJoystickEl.addEventListener("pointerup", endJoystick);
  touchJoystickEl.addEventListener("pointercancel", endJoystick);
}

if (isTouchDevice && touchFireBtn) {
  touchFireBtn.addEventListener("pointerdown", (event) => {
    if (role !== "player") return;
    ensureAudio();
    touchFireBtn.setPointerCapture(event.pointerId);
    input.shoot = true;
    event.preventDefault();
  });

  const releaseFire = (event) => {
    if (event.pointerId && touchFireBtn.hasPointerCapture(event.pointerId)) {
      touchFireBtn.releasePointerCapture(event.pointerId);
    }
    input.shoot = false;
  };

  touchFireBtn.addEventListener("pointerup", releaseFire);
  touchFireBtn.addEventListener("pointercancel", releaseFire);
}

if (isTouchDevice && touchGrenadeBtn) {
  touchGrenadeBtn.addEventListener("pointerdown", (event) => {
    if (role !== "player") return;
    input.throw = true;
    setTimeout(() => {
      input.throw = false;
    }, 50);
    event.preventDefault();
  });
}

if (isTouchDevice) {
  const handleTouchAim = (event) => {
    if (role !== "player") return;
    const touch = event.touches[0];
    if (!touch) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = clamp(touch.clientX - rect.left, 0, canvas.width);
    mouse.y = clamp(touch.clientY - rect.top, 0, canvas.height);
    updateAngle();
    event.preventDefault();
  };

  canvas.addEventListener("touchstart", handleTouchAim, { passive: false });
  canvas.addEventListener("touchmove", handleTouchAim, { passive: false });
}

canvas.addEventListener("mousemove", (event) => {
  if (pointerLocked) {
    mouse.x = clamp(mouse.x + event.movementX * pointerSensitivity, 0, canvas.width);
    mouse.y = clamp(mouse.y + event.movementY * pointerSensitivity, 0, canvas.height);
  } else {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  updateAngle();
});

canvas.addEventListener("mousedown", () => {
  ensureAudio();
  if (!pointerLocked && roomId && role === "player" && !isTouchDevice) {
    canvas.requestPointerLock();
  }
  if (role !== "player") return;
  input.shoot = true;
});

window.addEventListener("mouseup", () => {
  input.shoot = false;
});

window.addEventListener("blur", () => {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
  input.shoot = false;
  spectatorInput.up = false;
  spectatorInput.down = false;
  spectatorInput.left = false;
  spectatorInput.right = false;
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    mouse.x = canvas.width / 2;
    mouse.y = canvas.height / 2;
  }
});

function isMutedName(name) {
  const key = normalizeName(name);
  return mutedNames.has(key) || blockedNames.has(key);
}

function setSettingsVisible(visible) {
  settingsVisible = visible;
  if (!settingsEl) return;
  settingsEl.style.display = visible ? "flex" : "none";
}

function toggleSettingsPanel() {
  if (!settingsEl || !state.room) return;
  setSettingsVisible(!settingsVisible);
  applyPanelPositions();
}

function isPanelDragTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "SELECT") return false;
  if (target.isContentEditable) return false;
  if (target.closest(".chat-messages")) return false;
  return true;
}

function appendSystemMessage(msg) {
  const line = document.createElement("div");
  line.className = "chat-line chat-system";
  const timeSpan = document.createElement("span");
  timeSpan.className = "chat-time";
  timeSpan.textContent = `[${formatTime(msg.time || Date.now())}]`;
  const textSpan = document.createElement("span");
  textSpan.textContent = ` ${msg.text}`;
  line.appendChild(timeSpan);
  line.appendChild(textSpan);
  chatMessagesEl.appendChild(line);
  while (chatMessagesEl.children.length > 80) {
    chatMessagesEl.removeChild(chatMessagesEl.firstChild);
  }
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function handleChatCommand(text) {
  if (!text.startsWith("/")) return false;
  const parts = text.slice(1).split(" ");
  const command = (parts.shift() || "").toLowerCase();
  const name = parts.join(" ").trim();

  if (!name) {
    appendSystemMessage({ text: "Command requires a player name.", time: Date.now() });
    return true;
  }

  const key = normalizeName(name);
  if (!key) return true;

  if (command === "mute") {
    mutedNames.set(key, name);
    appendSystemMessage({ text: `Muted ${name}.`, time: Date.now() });
    updateMutedDisplay();
    return true;
  }

  if (command === "unmute") {
    mutedNames.delete(key);
    appendSystemMessage({ text: `Unmuted ${name}.`, time: Date.now() });
    updateMutedDisplay();
    return true;
  }

  if (command === "block") {
    blockedNames.set(key, name);
    appendSystemMessage({ text: `Blocked ${name}.`, time: Date.now() });
    updateMutedDisplay();
    return true;
  }

  if (command === "unblock") {
    blockedNames.delete(key);
    appendSystemMessage({ text: `Unblocked ${name}.`, time: Date.now() });
    updateMutedDisplay();
    return true;
  }

  appendSystemMessage({ text: "Unknown command.", time: Date.now() });
  return true;
}

function sendChat() {
  if (!roomId) return;
  const text = (chatInputEl.value || "").trim();
  if (!text) return;
  if (handleChatCommand(text)) {
    chatInputEl.value = "";
    chatInputEl.focus();
    return;
  }
  if (chatScope === "team" && role !== "player") {
    appendSystemMessage({ text: "Team chat is for players only.", time: Date.now() });
    chatInputEl.value = "";
    chatInputEl.focus();
    return;
  }
  socket.emit("chat:send", { text, scope: chatScope });
  chatInputEl.value = "";
  chatInputEl.focus();
}

chatSendBtn.addEventListener("click", () => {
  sendChat();
});

chatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendChat();
  }
});

minimapEl.addEventListener("pointerdown", (event) => {
  if (document.pointerLockElement === canvas) return;
  minimapEl.setPointerCapture(event.pointerId);
  const rect = minimapEl.getBoundingClientRect();
  minimapDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: minimapPos ? minimapPos.x : rect.left,
    originY: minimapPos ? minimapPos.y : rect.top,
  };
  minimapEl.classList.add("dragging");
});

minimapEl.addEventListener("pointermove", (event) => {
  if (!minimapDrag || minimapDrag.id !== event.pointerId) return;
  minimapPos = {
    x: minimapDrag.originX + (event.clientX - minimapDrag.startX),
    y: minimapDrag.originY + (event.clientY - minimapDrag.startY),
  };
  applyMinimapPosition();
});

function endMinimapDrag(event) {
  if (!minimapDrag || minimapDrag.id !== event.pointerId) return;
  minimapEl.releasePointerCapture(event.pointerId);
  minimapEl.classList.remove("dragging");
  minimapDrag = null;
  saveMinimapPosition();
}

minimapEl.addEventListener("pointerup", endMinimapDrag);
minimapEl.addEventListener("pointercancel", endMinimapDrag);

teamsEl.addEventListener("pointerdown", (event) => {
  if (document.pointerLockElement === canvas) return;
  teamsEl.setPointerCapture(event.pointerId);
  const rect = teamsEl.getBoundingClientRect();
  teamsDrag = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: teamsPos ? teamsPos.x : rect.left,
    originY: teamsPos ? teamsPos.y : rect.top,
  };
  teamsEl.classList.add("team-dragging");
});

teamsEl.addEventListener("pointermove", (event) => {
  if (!teamsDrag || teamsDrag.id !== event.pointerId) return;
  teamsPos = {
    x: teamsDrag.originX + (event.clientX - teamsDrag.startX),
    y: teamsDrag.originY + (event.clientY - teamsDrag.startY),
  };
  applyTeamsPosition();
});

function endTeamsDrag(event) {
  if (!teamsDrag || teamsDrag.id !== event.pointerId) return;
  teamsEl.releasePointerCapture(event.pointerId);
  teamsEl.classList.remove("team-dragging");
  teamsDrag = null;
  saveTeamsPosition();
}

teamsEl.addEventListener("pointerup", endTeamsDrag);
teamsEl.addEventListener("pointercancel", endTeamsDrag);

PANEL_IDS.forEach((id) => {
  const panel = document.getElementById(id);
  if (!panel) return;

  panel.addEventListener("pointerdown", (event) => {
    if (document.pointerLockElement === canvas) return;
    if (!isPanelDragTarget(event.target)) return;
    if (typeof event.button === "number" && event.button !== 0) return;
    const rect = panel.getBoundingClientRect();
    panelDrag = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panelPositions[id]?.x ?? rect.left,
      originY: panelPositions[id]?.y ?? rect.top,
    };
    panel.setPointerCapture(event.pointerId);
    panel.classList.add("dragging");
    event.preventDefault();
  });

  panel.addEventListener("pointermove", (event) => {
    if (!panelDrag || panelDrag.id !== id) return;
    if (panelDrag.pointerId !== event.pointerId) return;
    panelPositions[id] = {
      x: panelDrag.originX + (event.clientX - panelDrag.startX),
      y: panelDrag.originY + (event.clientY - panelDrag.startY),
    };
    applyPanelPosition(id);
  });

  const endPanelDrag = (event) => {
    if (!panelDrag || panelDrag.id !== id) return;
    if (panelDrag.pointerId !== event.pointerId) return;
    if (panel.hasPointerCapture(event.pointerId)) {
      panel.releasePointerCapture(event.pointerId);
    }
    panel.classList.remove("dragging");
    panelDrag = null;
    savePanelPositions();
  };

  panel.addEventListener("pointerup", endPanelDrag);
  panel.addEventListener("pointercancel", endPanelDrag);
});

function appendChatMessage(msg) {
  if (isMutedName(msg.name)) return;
  const line = document.createElement("div");
  line.className = "chat-line";
  const roleLabel = msg.role === "spectator" ? "spectator" : "player";
  const timeSpan = document.createElement("span");
  timeSpan.className = "chat-time";
  timeSpan.textContent = `[${formatTime(msg.time || Date.now())}]`;
  const scopeLabel = msg.scope === "team" ? "team" : "global";
  const scopeSpan = document.createElement("span");
  scopeSpan.className = "chat-role";
  scopeSpan.textContent = `[${scopeLabel}]`;
  const nameSpan = document.createElement("span");
  nameSpan.className = "chat-name";
  nameSpan.textContent = msg.name;

  const roleSpan = document.createElement("span");
  roleSpan.className = "chat-role";
  roleSpan.textContent = `(${roleLabel})`;

  const textSpan = document.createElement("span");
  textSpan.textContent = ` ${msg.text}`;

  line.appendChild(timeSpan);
  line.appendChild(scopeSpan);
  line.appendChild(nameSpan);
  line.appendChild(roleSpan);
  line.appendChild(textSpan);
  chatMessagesEl.appendChild(line);
  while (chatMessagesEl.children.length > 80) {
    chatMessagesEl.removeChild(chatMessagesEl.firstChild);
  }
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function updateAngle() {
  if (role !== "player") return;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const baseAngle = Math.atan2(mouse.y - centerY, mouse.x - centerX);
  input.angle = baseAngle + recoilAngle;
}

setInterval(() => {
  if (!selfId || role !== "player") return;
  if (input.shoot) {
    const stats = WEAPON_STATS[input.weapon] || WEAPON_STATS.rifle;
    const now = performance.now();
    if (now - localLastShotAt >= stats.cooldown) {
      localLastShotAt = now;
      recoilAngle = clamp(recoilAngle - stats.recoil, -0.35, 0.35);
    }
  }
  if (input.shoot) {
    const now = performance.now();
    if (now - lastShotSoundAt > 110) {
      ensureAudio();
      playShotSound();
      lastShotSoundAt = now;
    }
  }
  socket.emit("input", input);
}, 1000 / 30);

function worldToScreen(x, y, cam) {
  return { x: x - cam.x, y: y - cam.y };
}

function drawGrid(cam) {
  const spacing = 80;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 1;

  const startX = Math.floor(cam.x / spacing) * spacing;
  const startY = Math.floor(cam.y / spacing) * spacing;

  for (let x = startX; x < cam.x + canvas.width; x += spacing) {
    const screenX = x - cam.x;
    ctx.beginPath();
    ctx.moveTo(screenX, 0);
    ctx.lineTo(screenX, canvas.height);
    ctx.stroke();
  }

  for (let y = startY; y < cam.y + canvas.height; y += spacing) {
    const screenY = y - cam.y;
    ctx.beginPath();
    ctx.moveTo(0, screenY);
    ctx.lineTo(canvas.width, screenY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawWorldBounds(cam) {
  ctx.save();
  ctx.strokeStyle = "rgba(55, 243, 193, 0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-cam.x, -cam.y, state.world.width, state.world.height);
  ctx.restore();
}

function updateSpectatorCam(dt) {
  if (!spectatorFreeCam) return;
  let dx = 0;
  let dy = 0;
  if (spectatorInput.left) dx -= 1;
  if (spectatorInput.right) dx += 1;
  if (spectatorInput.up) dy -= 1;
  if (spectatorInput.down) dy += 1;
  if (dx === 0 && dy === 0) return;
  const dir = normalize(dx, dy);
  const speed = 420;
  spectatorCam.x = clamp(spectatorCam.x + dir.x * speed * dt, 0, state.world.width);
  spectatorCam.y = clamp(spectatorCam.y + dir.y * speed * dt, 0, state.world.height);
}

function drawObstacles(cam) {
  if (!state.obstacles || !state.obstacles.length) return;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1.5;
  for (const obs of state.obstacles) {
    const x = obs.x - cam.x;
    const y = obs.y - cam.y;
    ctx.fillRect(x, y, obs.w, obs.h);
    ctx.strokeRect(x, y, obs.w, obs.h);
  }
  ctx.restore();
}

function drawPowerups(cam) {
  if (!state.powerups || !state.powerups.length) return;
  for (const power of state.powerups) {
    const pos = worldToScreen(power.x, power.y, cam);
    const color =
      power.type === "health"
        ? "#59f79c"
        : power.type === "speed"
        ? "#5dd3ff"
        : "#ffd36d";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.font = "10px 'Space Mono', monospace";
    ctx.textAlign = "center";
    const label = power.type === "health" ? "+" : power.type === "speed" ? "S" : "R";
    ctx.fillText(label, pos.x, pos.y + 3);
  }
}

function drawGrenades(cam) {
  if (!state.grenades || !state.grenades.length) return;
  for (const grenade of state.grenades) {
    const pos = worldToScreen(grenade.x, grenade.y, cam);
    ctx.fillStyle = "#ff7a7a";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExplosions(cam, now) {
  if (!explosions.length) return;
  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    const boom = explosions[i];
    const age = now - boom.createdAt;
    if (age > 600) {
      explosions.splice(i, 1);
      continue;
    }
    const progress = age / 600;
    const radius = boom.radius * progress;
    const alpha = 1 - progress;
    const pos = worldToScreen(boom.x, boom.y, cam);
    ctx.strokeStyle = `rgba(255, 140, 90, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawDamagePopups(cam, now) {
  if (!damagePopups.length) return;
  ctx.save();
  ctx.font = "12px 'Space Mono', monospace";
  ctx.textAlign = "center";
  for (let i = damagePopups.length - 1; i >= 0; i -= 1) {
    const popup = damagePopups[i];
    const age = now - popup.createdAt;
    if (age > 1000) {
      damagePopups.splice(i, 1);
      continue;
    }
    const alpha = 1 - age / 1000;
    const rise = age * 0.04;
    const pos = worldToScreen(popup.x, popup.y, cam);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(`-${popup.damage}`, pos.x, pos.y - 12 - rise);
  }
  ctx.restore();
}

function drawHitMarker(now) {
  if (now > hitFlashUntil) return;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  const size = 8;
  ctx.beginPath();
  ctx.moveTo(centerX - size, centerY - size);
  ctx.lineTo(centerX - 2, centerY - 2);
  ctx.moveTo(centerX + size, centerY - size);
  ctx.lineTo(centerX + 2, centerY - 2);
  ctx.moveTo(centerX - size, centerY + size);
  ctx.lineTo(centerX - 2, centerY + 2);
  ctx.moveTo(centerX + size, centerY + size);
  ctx.lineTo(centerX + 2, centerY + 2);
  ctx.stroke();
  ctx.restore();
}

function drawMinimap() {
  if (!state.room) return;
  const width = minimapEl.width;
  const height = minimapEl.height;
  minimapCtx.clearRect(0, 0, width, height);

  minimapCtx.fillStyle = "rgba(10, 15, 24, 0.9)";
  minimapCtx.fillRect(0, 0, width, height);

  minimapCtx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(0.5, 0.5, width - 1, height - 1);

  const scaleX = width / state.world.width;
  const scaleY = height / state.world.height;

  if (state.obstacles && state.obstacles.length) {
    minimapCtx.fillStyle = "rgba(255, 255, 255, 0.2)";
    for (const obs of state.obstacles) {
      minimapCtx.fillRect(obs.x * scaleX, obs.y * scaleY, obs.w * scaleX, obs.h * scaleY);
    }
  }

  if (state.powerups && state.powerups.length) {
    for (const power of state.powerups) {
      const color =
        power.type === "health"
          ? "#59f79c"
          : power.type === "speed"
          ? "#5dd3ff"
          : "#ffd36d";
      minimapCtx.fillStyle = color;
      minimapCtx.beginPath();
      minimapCtx.arc(power.x * scaleX, power.y * scaleY, 2, 0, Math.PI * 2);
      minimapCtx.fill();
    }
  }

  for (const player of state.players) {
    const x = player.x * scaleX;
    const y = player.y * scaleY;
    const isSelf = player.id === selfId;
    const color = player.team === "A" ? "#37f3c1" : "#ff9f52";
    minimapCtx.fillStyle = color;
    minimapCtx.beginPath();
    minimapCtx.arc(x, y, isSelf ? 4 : 3, 0, Math.PI * 2);
    minimapCtx.fill();

    if (isSelf) {
      minimapCtx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      minimapCtx.lineWidth = 1;
      minimapCtx.beginPath();
      minimapCtx.arc(x, y, 6, 0, Math.PI * 2);
      minimapCtx.stroke();
    }
  }
}

function draw() {
  requestAnimationFrame(draw);
  const now = performance.now();
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  updateSpectatorCam(dt);
  const stats = WEAPON_STATS[input.weapon] || WEAPON_STATS.rifle;
  const recovery = Math.max(0, 1 - stats.recovery * dt * 60);
  recoilAngle *= recovery;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const me = state.players.find((p) => p.id === selfId);
  let focus = me;
  if (role === "spectator") {
    if (spectatorFreeCam) {
      focus = { x: spectatorCam.x, y: spectatorCam.y };
    } else {
      focus = state.players.find((p) => p.id === spectatorTargetId) || state.players[0];
    }
  }
  const cam = {
    x: focus ? focus.x - canvas.width / 2 : state.world.width / 2 - canvas.width / 2,
    y: focus ? focus.y - canvas.height / 2 : state.world.height / 2 - canvas.height / 2,
  };

  drawGrid(cam);
  drawWorldBounds(cam);
  drawObstacles(cam);
  drawPowerups(cam);
  drawGrenades(cam);

  for (const bullet of state.bullets) {
    const pos = worldToScreen(bullet.x, bullet.y, cam);
    ctx.fillStyle = "#ffd36d";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawExplosions(cam, now);

  for (const player of state.players) {
    const pos = worldToScreen(player.x, player.y, cam);
    const isSelf = player.id === selfId;
    const teamColor = player.team === "A" ? "#37f3c1" : "#ff9f52";

    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
    ctx.fill();

    if (player.shieldUntil && player.shieldUntil > Date.now()) {
      ctx.strokeStyle = "rgba(120, 200, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    const gunLength = 26;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(
      pos.x + Math.cos(player.angle) * gunLength,
      pos.y + Math.sin(player.angle) * gunLength
    );
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(pos.x - 22, pos.y - 30, 44, 6);
    ctx.fillStyle = teamColor;
    ctx.fillRect(pos.x - 22, pos.y - 30, (player.hp / 100) * 44, 6);

    ctx.fillStyle = "#f1f5ff";
    ctx.font = "12px 'Space Mono', monospace";
    ctx.textAlign = "center";
    const label = player.team ? `${player.name} [${player.team}]` : player.name;
    ctx.fillText(label, pos.x, pos.y - 38);
  }

  drawDamagePopups(cam, now);

  if (role === "player" && me) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    const spread = stats.spread || 0;
    const recoilSize = Math.abs(recoilAngle) * 120;
    const radius = 6 + spread * 220 + recoilSize;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  updateAngle();
  drawMinimap();
  drawHitMarker(now);
}

draw();
