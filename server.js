const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const WORLD = { width: 2200, height: 1400 };
const TICK_RATE = 60;
const SNAPSHOT_RATE = 20;
const PLAYER_SPEED = 280;
const PLAYER_RADIUS = 18;
const MAX_HP = 100;
const BULLET_RADIUS = 4;
const BULLET_LIFE_MS = 1400;
const FIRE_COOLDOWN_MS = 160;
const MAX_PLAYERS = 10;
const MIN_PLAYERS = 2;

const SPAWN_SHIELD_MS = 2500;
const GRENADE_COOLDOWN_MS = 1400;
const GRENADE_SPEED = 420;
const GRENADE_FUSE_MS = 900;
const GRENADE_RADIUS = 150;
const GRENADE_DAMAGE = 60;
const GRENADE_BODY_RADIUS = 6;

const MATCH_DURATION_MS = 180000;
const MATCH_SCORE_LIMIT = 20;
const MATCH_RESTART_MS = 10000;
const MAP_VOTE_OPTIONS = 3;
const MAP_VOTE_DURATION_MS = 8000;

const WEAPONS = {
  rifle: { name: "Rifle", cooldownMs: 120, damage: 22, speed: 720, spread: 0.045 },
  pistol: { name: "Pistol", cooldownMs: 260, damage: 34, speed: 620, spread: 0.08 },
};

const MAPS = [
  {
    name: "Crossfire",
    obstacles: [
      { x: 320, y: 220, w: 260, h: 90 },
      { x: 820, y: 520, w: 320, h: 140 },
      { x: 1400, y: 260, w: 240, h: 220 },
      { x: 520, y: 960, w: 300, h: 110 },
      { x: 1220, y: 940, w: 320, h: 90 },
    ],
  },
  {
    name: "Depot",
    obstacles: [
      { x: 260, y: 260, w: 220, h: 160 },
      { x: 720, y: 240, w: 180, h: 320 },
      { x: 1120, y: 520, w: 320, h: 120 },
      { x: 1520, y: 220, w: 220, h: 180 },
      { x: 520, y: 900, w: 420, h: 120 },
      { x: 1280, y: 880, w: 260, h: 140 },
    ],
  },
  {
    name: "Ridge",
    obstacles: [
      { x: 360, y: 180, w: 320, h: 120 },
      { x: 920, y: 320, w: 260, h: 180 },
      { x: 1480, y: 280, w: 220, h: 260 },
      { x: 260, y: 760, w: 300, h: 160 },
      { x: 720, y: 980, w: 260, h: 140 },
      { x: 1380, y: 900, w: 360, h: 160 },
    ],
  },
];

const POWERUP_RADIUS = 12;
const POWERUP_MAX = 4;
const POWERUP_LIFE_MS = 35000;
const POWERUP_SPAWN_MIN = 8000;
const POWERUP_SPAWN_MAX = 14000;
const SPEED_BOOST_MS = 6000;
const RAPID_FIRE_MS = 6000;
const SPEED_MULTIPLIER = 1.6;
const RAPID_MULTIPLIER = 0.45;

const POWERUP_TYPES = {
  health: { name: "Medkit" },
  speed: { name: "Speed Boost" },
  rapid: { name: "Rapid Fire" },
};

const rooms = new Map();
let roomSeq = 1;
let mapSeq = 0;

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function circleIntersectsRect(x, y, radius, rect) {
  const closestX = clamp(x, rect.x, rect.x + rect.w);
  const closestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - closestX;
  const dy = y - closestY;
  return dx * dx + dy * dy < radius * radius;
}

function collidesObstacleCircle(x, y, radius, obstacles) {
  if (!obstacles || !obstacles.length) return false;
  for (const obs of obstacles) {
    if (circleIntersectsRect(x, y, radius, obs)) {
      return true;
    }
  }
  return false;
}

function collidesObstacle(x, y, obstacles) {
  return collidesObstacleCircle(x, y, PLAYER_RADIUS, obstacles);
}

function spawnPoint(obstacles) {
  for (let i = 0; i < 25; i += 1) {
    const point = {
      x: randRange(60, WORLD.width - 60),
      y: randRange(60, WORLD.height - 60),
    };
    if (!collidesObstacle(point.x, point.y, obstacles)) {
      return point;
    }
  }
  return {
    x: randRange(60, WORLD.width - 60),
    y: randRange(60, WORLD.height - 60),
  };
}

function findFreePoint(radius, obstacles) {
  for (let i = 0; i < 30; i += 1) {
    const point = {
      x: randRange(radius + 30, WORLD.width - radius - 30),
      y: randRange(radius + 30, WORLD.height - radius - 30),
    };
    if (!collidesObstacleCircle(point.x, point.y, radius, obstacles)) {
      return point;
    }
  }
  return {
    x: randRange(radius + 30, WORLD.width - radius - 30),
    y: randRange(radius + 30, WORLD.height - radius - 30),
  };
}

function sanitizeName(name) {
  const cleaned = (name || "").toString().trim().slice(0, 16);
  return cleaned || "Player";
}

function sanitizeRoomName(name) {
  const cleaned = (name || "").toString().trim().slice(0, 20);
  return cleaned || "Skirmish";
}

function sanitizeChat(text) {
  const cleaned = (text || "").toString().replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 140);
}

function sanitizePassword(value) {
  const cleaned = (value || "").toString().trim();
  if (!cleaned) return "";
  return cleaned.slice(0, 24);
}

function assignTeam(room) {
  let teamA = 0;
  let teamB = 0;
  for (const player of room.players.values()) {
    if (player.team === "A") teamA += 1;
    if (player.team === "B") teamB += 1;
  }
  return teamA <= teamB ? "A" : "B";
}

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  while (!code || Array.from(rooms.values()).some((room) => room.code === code)) {
    code = "";
    for (let i = 0; i < 5; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return code;
}

function makeRoomId() {
  let id = "";
  while (!id || rooms.has(id)) {
    id = `room-${roomSeq++}`;
  }
  return id;
}

function pickMap(index) {
  return MAPS[index % MAPS.length];
}

function findMapByName(name) {
  return MAPS.find((map) => map.name === name);
}

function applyMap(room, map, now) {
  room.mapName = map.name;
  room.obstacles = map.obstacles;
  room.bullets.length = 0;
  room.powerups.length = 0;
  room.powerupSeq = 0;
  room.grenades.length = 0;
  room.grenadeSeq = 0;
  room.nextPowerupAt = now + 2000;

  for (const player of room.players.values()) {
    const pos = spawnPoint(room.obstacles);
    player.x = pos.x;
    player.y = pos.y;
    player.hp = MAX_HP;
    player.speedBoostUntil = 0;
    player.rapidUntil = 0;
    player.spawnShieldUntil = now + SPAWN_SHIELD_MS;
    player.lastShotAt = 0;
    player.lastGrenadeAt = 0;
  }
}

function buildVoteOptions(room) {
  const available = MAPS.map((map) => map.name).filter((name) => name !== room.mapName);
  const options = [];
  const total = Math.min(MAP_VOTE_OPTIONS, MAPS.length);
  while (options.length < total) {
    if (available.length) {
      const index = Math.floor(Math.random() * available.length);
      options.push(available.splice(index, 1)[0]);
    } else {
      options.push(MAPS[options.length % MAPS.length].name);
    }
  }
  return options;
}

function tallyVotes(room) {
  const counts = new Map();
  for (const option of room.voteOptions) {
    counts.set(option, 0);
  }
  for (const choice of room.votes.values()) {
    if (counts.has(choice)) {
      counts.set(choice, counts.get(choice) + 1);
    }
  }
  const list = room.voteOptions.map((option) => counts.get(option) || 0);
  return list;
}

function startMapVote(room, now) {
  room.voteOptions = buildVoteOptions(room);
  room.votes = new Map();
  room.voteEndsAt = now + MAP_VOTE_DURATION_MS;
  emitChatSystem(room.id, "Map vote started! Pick the next map.");
  io.to(room.id).emit("event", { type: "map-vote", options: room.voteOptions });
}

function finalizeMapVote(room, now) {
  if (!room.voteOptions.length) return;
  const counts = tallyVotes(room);
  let best = -1;
  let winners = [];
  counts.forEach((count, index) => {
    if (count > best) {
      best = count;
      winners = [room.voteOptions[index]];
    } else if (count === best) {
      winners.push(room.voteOptions[index]);
    }
  });

  let selected = winners.length
    ? winners[Math.floor(Math.random() * winners.length)]
    : room.voteOptions[0];

  const map = findMapByName(selected) || pickMap(room.mapIndex + 1);
  room.mapIndex = MAPS.findIndex((entry) => entry.name === map.name);
  if (room.mapIndex < 0) room.mapIndex = 0;
  applyMap(room, map, now);
  emitChatSystem(room.id, `Map set to ${room.mapName}`);
  io.to(room.id).emit("event", { type: "map", name: room.mapName });
  emitLobbyUpdate();

  room.voteOptions = [];
  room.votes = new Map();
  room.voteEndsAt = null;
}

function createPlayer(id, name, team, obstacles, now = Date.now()) {
  const pos = spawnPoint(obstacles);
  return {
    id,
    name: sanitizeName(name),
    team,
    x: pos.x,
    y: pos.y,
    angle: 0,
    hp: MAX_HP,
    kills: 0,
    deaths: 0,
    weapon: "rifle",
    speedBoostUntil: 0,
    rapidUntil: 0,
    spawnShieldUntil: now + SPAWN_SHIELD_MS,
    lastGrenadeAt: 0,
    input: {
      up: false,
      down: false,
      left: false,
      right: false,
      shoot: false,
      throw: false,
      angle: 0,
    },
    lastShotAt: 0,
  };
}

function createRoom(name, password) {
  const mapIndex = mapSeq++ % MAPS.length;
  const map = pickMap(mapIndex);
  return {
    id: makeRoomId(),
    name: sanitizeRoomName(name),
    code: makeRoomCode(),
    password: sanitizePassword(password),
    mapIndex,
    mapName: map.name,
    obstacles: map.obstacles,
    powerups: [],
    powerupSeq: 0,
    nextPowerupAt: Date.now() + 2000,
    grenades: [],
    grenadeSeq: 0,
    scores: { A: 0, B: 0 },
    matchState: "waiting",
    matchStartAt: null,
    matchEndsAt: null,
    nextMatchAt: null,
    matchWinner: null,
    voteOptions: [],
    votes: new Map(),
    voteEndsAt: null,
    scoreLimit: MATCH_SCORE_LIMIT,
    matchDurationMs: MATCH_DURATION_MS,
    players: new Map(),
    spectators: new Map(),
    bullets: [],
    bulletSeq: 0,
  };
}

function roomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    code: room.code,
    map: room.mapName,
    private: !!room.password,
    players: room.players.size,
    spectators: room.spectators.size,
    maxPlayers: MAX_PLAYERS,
    minPlayers: MIN_PLAYERS,
    active: room.players.size >= MIN_PLAYERS,
  };
}

function emitChatSystem(roomId, text) {
  io.to(roomId).emit("chat:system", { text, time: Date.now() });
}

function emitLobbyUpdate() {
  const list = Array.from(rooms.values()).map(roomSummary);
  io.emit("lobby:list", { rooms: list });
}

function joinRoom(socket, room, role) {
  leaveRoom(socket, false);

  socket.join(room.id);
  socket.data.roomId = room.id;
  socket.data.role = role;
  socket.data.team = null;

  if (role === "player") {
    const team = assignTeam(room);
    const player = createPlayer(socket.id, socket.data.name, team, room.obstacles, Date.now());
    socket.data.team = team;
    room.players.set(socket.id, player);
    io.to(room.id).emit("event", { type: "join", name: player.name });
    emitChatSystem(room.id, `${player.name} joined Team ${team}`);
  } else {
    const spectator = { id: socket.id, name: socket.data.name };
    room.spectators.set(socket.id, spectator);
    io.to(room.id).emit("event", { type: "spectate-join", name: spectator.name });
    emitChatSystem(room.id, `${spectator.name} is spectating`);
  }

  socket.emit("room:joined", {
    id: socket.id,
    roomId: room.id,
    roomName: room.name,
    roomCode: room.code,
    roomMap: room.mapName,
    role,
    team: socket.data.team,
    world: WORLD,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
  });

  emitLobbyUpdate();
}

function leaveRoom(socket, notify = true) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const role = socket.data.role;
  socket.leave(roomId);

  if (role === "player") {
    const player = room.players.get(socket.id);
    if (player) {
      io.to(roomId).emit("event", { type: "leave", name: player.name });
      emitChatSystem(roomId, `${player.name} left`);
      room.players.delete(socket.id);
    }
  } else if (role === "spectator") {
    const spectator = room.spectators.get(socket.id);
    if (spectator) {
      io.to(roomId).emit("event", { type: "spectate-leave", name: spectator.name });
      emitChatSystem(roomId, `${spectator.name} stopped spectating`);
      room.spectators.delete(socket.id);
    }
  }

  if (room.votes) {
    room.votes.delete(socket.id);
  }

  socket.data.roomId = null;
  socket.data.role = null;
  socket.data.team = null;

  if (room.players.size === 0 && room.spectators.size === 0) {
    rooms.delete(roomId);
  }

  if (notify) {
    socket.emit("room:left");
  }

  emitLobbyUpdate();
}

io.on("connection", (socket) => {
  socket.data.name = "Player";
  socket.data.roomId = null;
  socket.data.role = null;
  socket.data.team = null;
  socket.data.lastChatAt = 0;

  socket.emit("lobby:list", { rooms: Array.from(rooms.values()).map(roomSummary) });

  socket.on("profile:set", (name) => {
    socket.data.name = sanitizeName(name);
    socket.emit("profile:ok", { name: socket.data.name });
  });

  socket.on("lobby:list", () => {
    socket.emit("lobby:list", { rooms: Array.from(rooms.values()).map(roomSummary) });
  });

  socket.on("room:create", (data = {}) => {
    const room = createRoom(data.roomName, data.password);
    rooms.set(room.id, room);
    const role = data.asSpectator ? "spectator" : "player";
    joinRoom(socket, room, role);
  });

  socket.on("room:join", (data = {}) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit("room:error", "Server not found.");
      return;
    }
    if (room.password) {
      const password = sanitizePassword(data.password);
      if (!password || password !== room.password) {
        socket.emit("room:error", "Wrong password.");
        return;
      }
    }

    const role = data.asSpectator ? "spectator" : "player";
    if (role === "player" && room.players.size >= MAX_PLAYERS) {
      socket.emit("room:error", "Server is full.");
      return;
    }

    joinRoom(socket, room, role);
  });

  socket.on("room:join-code", (data = {}) => {
    const raw = (data.code || "").toString().trim().toUpperCase();
    const code = raw.replace(/[^A-Z0-9]/g, "").slice(0, 8);
    if (!code) {
      socket.emit("room:error", "Enter a server code.");
      return;
    }
    const room = Array.from(rooms.values()).find((r) => r.code === code);
    if (!room) {
      socket.emit("room:error", "Code not found.");
      return;
    }
    if (room.password) {
      const password = sanitizePassword(data.password);
      if (!password || password !== room.password) {
        socket.emit("room:error", "Wrong password.");
        return;
      }
    }

    const role = data.asSpectator ? "spectator" : "player";
    if (role === "player" && room.players.size >= MAX_PLAYERS) {
      socket.emit("room:error", "Server is full.");
      return;
    }

    joinRoom(socket, room, role);
  });

  socket.on("room:leave", () => {
    leaveRoom(socket, true);
  });

  socket.on("chat:send", (text) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const payload = typeof text === "object" && text !== null ? text : { text };
    const message = sanitizeChat(payload.text);
    if (!message) return;

    const now = Date.now();
    if (now - socket.data.lastChatAt < 400) return;
    socket.data.lastChatAt = now;

    const scope = payload.scope === "team" ? "team" : "global";
    const chatPayload = {
      name: socket.data.name,
      role: socket.data.role,
      team: socket.data.team,
      scope,
      text: message,
      time: now,
    };

    if (scope === "team") {
      if (socket.data.role !== "player" || !socket.data.team) return;
      for (const player of room.players.values()) {
        if (player.team === socket.data.team) {
          io.to(player.id).emit("chat:message", chatPayload);
        }
      }
      return;
    }

    io.to(roomId).emit("chat:message", chatPayload);
  });

  socket.on("map:vote", (data = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (socket.data.role !== "player") return;
    if (room.matchState !== "ended") return;
    if (!room.voteOptions || !room.voteOptions.length) return;
    if (!room.voteEndsAt || Date.now() >= room.voteEndsAt) return;
    const option = (data.option || "").toString().trim();
    if (!room.voteOptions.includes(option)) return;
    room.votes.set(socket.id, option);
  });

  socket.on("input", (data) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (socket.data.role !== "player") return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const weaponKey = typeof data.weapon === "string" ? data.weapon : player.weapon;
    if (WEAPONS[weaponKey]) {
      player.weapon = weaponKey;
    }

    player.input = {
      up: !!data.up,
      down: !!data.down,
      left: !!data.left,
      right: !!data.right,
      shoot: !!data.shoot,
      throw: !!data.throw,
      angle: typeof data.angle === "number" ? data.angle : player.angle,
    };
  });

  socket.on("disconnect", () => {
    leaveRoom(socket, false);
  });
});

function spawnBullet(room, player) {
  const weapon = WEAPONS[player.weapon] || WEAPONS.rifle;
  const spread = weapon.spread || 0;
  const angle = player.angle + (Math.random() * 2 - 1) * spread;
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const spawnOffset = PLAYER_RADIUS + 6;
  const bullet = {
    id: ++room.bulletSeq,
    owner: player.id,
    x: player.x + dir.x * spawnOffset,
    y: player.y + dir.y * spawnOffset,
    vx: dir.x * weapon.speed,
    vy: dir.y * weapon.speed,
    damage: weapon.damage,
    weapon: player.weapon,
    bornAt: Date.now(),
  };
  room.bullets.push(bullet);
}

function movePlayer(player, dx, dy, obstacles) {
  const prevX = player.x;
  const prevY = player.y;

  let nextX = clamp(prevX + dx, PLAYER_RADIUS, WORLD.width - PLAYER_RADIUS);
  let nextY = clamp(prevY + dy, PLAYER_RADIUS, WORLD.height - PLAYER_RADIUS);

  if (collidesObstacle(nextX, prevY, obstacles)) {
    nextX = prevX;
  }
  if (collidesObstacle(nextX, nextY, obstacles)) {
    nextY = prevY;
  }

  player.x = nextX;
  player.y = nextY;
}

function bulletHitsObstacle(bullet, obstacles) {
  if (!obstacles || !obstacles.length) return false;
  const radius = bullet.radius || BULLET_RADIUS;
  for (const obs of obstacles) {
    if (
      bullet.x + radius > obs.x &&
      bullet.x - radius < obs.x + obs.w &&
      bullet.y + radius > obs.y &&
      bullet.y - radius < obs.y + obs.h
    ) {
      return true;
    }
  }
  return false;
}

function applyDamage(room, target, shooter, damage, now, source) {
  if (target.spawnShieldUntil && target.spawnShieldUntil > now) {
    return { hit: true, killed: false, blocked: true };
  }
  target.hp -= damage;
  const killed = target.hp <= 0;

  if (shooter) {
    io.to(shooter.id).emit("hit", {
      x: target.x,
      y: target.y,
      damage,
      target: target.name,
      killed,
      source,
    });
  }

  if (killed) {
    if (shooter) shooter.kills += 1;
    target.deaths += 1;
    target.hp = MAX_HP;
    target.speedBoostUntil = 0;
    target.rapidUntil = 0;
    target.spawnShieldUntil = now + SPAWN_SHIELD_MS;
    const pos = spawnPoint(room.obstacles);
    target.x = pos.x;
    target.y = pos.y;

    if (shooter && shooter.team) {
      room.scores[shooter.team] += 1;
    }

    if (shooter) {
      io.to(room.id).emit("event", {
        type: "kill",
        killer: shooter.name,
        victim: target.name,
      });
    }
  }

  return { hit: true, killed, blocked: false };
}

function explodeGrenade(room, grenade, now) {
  for (const target of room.players.values()) {
    const shooter = room.players.get(grenade.owner);
    if (shooter && shooter.team && shooter.team === target.team) continue;
    const dist = Math.hypot(target.x - grenade.x, target.y - grenade.y);
    if (dist > GRENADE_RADIUS) continue;
    const ratio = 1 - dist / GRENADE_RADIUS;
    const damage = Math.max(10, Math.round(GRENADE_DAMAGE * ratio));
    applyDamage(room, target, shooter, damage, now, "grenade");
  }
  io.to(room.id).emit("grenade:explode", {
    x: grenade.x,
    y: grenade.y,
    radius: GRENADE_RADIUS,
  });
}

function spawnGrenade(room, player, now) {
  const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
  const spawnOffset = PLAYER_RADIUS + 8;
  const grenade = {
    id: ++room.grenadeSeq,
    owner: player.id,
    x: player.x + dir.x * spawnOffset,
    y: player.y + dir.y * spawnOffset,
    vx: dir.x * GRENADE_SPEED,
    vy: dir.y * GRENADE_SPEED,
    radius: GRENADE_BODY_RADIUS,
    bornAt: now,
    explodeAt: now + GRENADE_FUSE_MS,
  };
  room.grenades.push(grenade);
}

function updateGrenades(room, dt, now) {
  if (room.matchState !== "running") {
    if (room.grenades.length) room.grenades.length = 0;
    return;
  }

  for (let i = room.grenades.length - 1; i >= 0; i -= 1) {
    const grenade = room.grenades[i];
    grenade.x += grenade.vx * dt;
    grenade.y += grenade.vy * dt;

    const outOfBounds =
      grenade.x < -60 ||
      grenade.y < -60 ||
      grenade.x > WORLD.width + 60 ||
      grenade.y > WORLD.height + 60;

    const hitObstacle = bulletHitsObstacle(grenade, room.obstacles);

    if (outOfBounds || hitObstacle || now >= grenade.explodeAt) {
      room.grenades.splice(i, 1);
      explodeGrenade(room, grenade, now);
    }
  }
}

function spawnPowerup(room, now) {
  const types = ["health", "health", "speed", "rapid"];
  const type = types[Math.floor(Math.random() * types.length)];
  const point = findFreePoint(POWERUP_RADIUS, room.obstacles);
  room.powerups.push({
    id: ++room.powerupSeq,
    type,
    x: point.x,
    y: point.y,
    expiresAt: now + POWERUP_LIFE_MS,
  });
}

function applyPowerup(room, player, powerup, now) {
  if (powerup.type === "health") {
    player.hp = Math.min(MAX_HP, player.hp + 40);
  }
  if (powerup.type === "speed") {
    player.speedBoostUntil = now + SPEED_BOOST_MS;
  }
  if (powerup.type === "rapid") {
    player.rapidUntil = now + RAPID_FIRE_MS;
  }

  const label = POWERUP_TYPES[powerup.type]?.name || "Powerup";
  emitChatSystem(room.id, `${player.name} picked up ${label}`);
}

function updatePowerups(room, now) {
  if (room.matchState !== "running") {
    if (room.powerups.length) room.powerups.length = 0;
    return;
  }

  for (let i = room.powerups.length - 1; i >= 0; i -= 1) {
    if (room.powerups[i].expiresAt <= now) {
      room.powerups.splice(i, 1);
    }
  }

  if (room.powerups.length < POWERUP_MAX && now >= room.nextPowerupAt) {
    spawnPowerup(room, now);
    room.nextPowerupAt = now + randRange(POWERUP_SPAWN_MIN, POWERUP_SPAWN_MAX);
  }

  for (const player of room.players.values()) {
    for (let i = room.powerups.length - 1; i >= 0; i -= 1) {
      const powerup = room.powerups[i];
      const hit =
        distanceSq(player, powerup) <=
        (PLAYER_RADIUS + POWERUP_RADIUS) * (PLAYER_RADIUS + POWERUP_RADIUS);
      if (!hit) continue;
      applyPowerup(room, player, powerup, now);
      room.powerups.splice(i, 1);
    }
  }
}

function startMatch(room, now) {
  room.matchState = "running";
  room.matchStartAt = now;
  room.matchEndsAt = now + room.matchDurationMs;
  room.nextMatchAt = null;
  room.matchWinner = null;
  room.scores = { A: 0, B: 0 };
  room.voteOptions = [];
  room.votes = new Map();
  room.voteEndsAt = null;

  for (const player of room.players.values()) {
    player.kills = 0;
    player.deaths = 0;
    player.hp = MAX_HP;
    player.speedBoostUntil = 0;
    player.rapidUntil = 0;
    player.spawnShieldUntil = now + SPAWN_SHIELD_MS;
    const pos = spawnPoint(room.obstacles);
    player.x = pos.x;
    player.y = pos.y;
    player.lastShotAt = 0;
    player.lastGrenadeAt = 0;
  }

  emitChatSystem(room.id, "Match started!");
  io.to(room.id).emit("event", { type: "match", state: "start" });
}

function endMatch(room, now, winner) {
  room.matchState = "ended";
  room.matchWinner = winner;
  room.nextMatchAt = now + MATCH_RESTART_MS;
  room.matchEndsAt = now;
  emitChatSystem(room.id, winner ? `Team ${winner} wins!` : "Match ended in a draw.");
  io.to(room.id).emit("event", { type: "match", state: "end", winner });
  startMapVote(room, now);
}

function ensureMatch(room, now) {
  if (room.players.size < MIN_PLAYERS) {
    if (room.matchState !== "waiting") {
      room.matchState = "waiting";
      room.matchStartAt = null;
      room.matchEndsAt = null;
      room.nextMatchAt = now + 5000;
      emitChatSystem(room.id, "Waiting for players...");
    }
    room.voteOptions = [];
    room.votes = new Map();
    room.voteEndsAt = null;
    return;
  }

  if (room.matchState === "ended" && room.voteEndsAt && now >= room.voteEndsAt) {
    finalizeMapVote(room, now);
  }

  if (room.matchState === "waiting" || room.matchState === "ended") {
    if (!room.voteEndsAt && (!room.nextMatchAt || now >= room.nextMatchAt)) {
      startMatch(room, now);
    }
  }

  if (room.matchState === "running") {
    if (now >= room.matchEndsAt) {
      const winner =
        room.scores.A > room.scores.B ? "A" : room.scores.B > room.scores.A ? "B" : null;
      endMatch(room, now, winner);
      return;
    }

    if (room.scores.A >= room.scoreLimit || room.scores.B >= room.scoreLimit) {
      const winner = room.scores.A >= room.scoreLimit ? "A" : "B";
      endMatch(room, now, winner);
    }
  }
}

function rotateMap(room, now) {
  const nextIndex = (room.mapIndex + 1) % MAPS.length;
  const map = pickMap(nextIndex);
  room.mapIndex = nextIndex;
  applyMap(room, map, now);

  emitChatSystem(room.id, `Map rotated to ${room.mapName}`);
  io.to(room.id).emit("event", { type: "map", name: room.mapName });
  emitLobbyUpdate();
}

function updatePlayers(room, dt, now) {
  const matchActive = room.matchState === "running";

  for (const player of room.players.values()) {
    const input = player.input;
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const dir = normalize(dx, dy);
      const speedBoost = player.speedBoostUntil > now ? SPEED_MULTIPLIER : 1;
      const speed = PLAYER_SPEED * speedBoost;
      movePlayer(player, dir.x * speed * dt, dir.y * speed * dt, room.obstacles);
    }

    player.angle = input.angle;

    const weapon = WEAPONS[player.weapon] || WEAPONS.rifle;
    let cooldown = weapon.cooldownMs || FIRE_COOLDOWN_MS;
    if (player.rapidUntil > now) {
      cooldown *= RAPID_MULTIPLIER;
    }
    if (matchActive && input.shoot && now - player.lastShotAt >= cooldown) {
      player.lastShotAt = now;
      spawnBullet(room, player);
    }

    if (matchActive && input.throw && now - player.lastGrenadeAt >= GRENADE_COOLDOWN_MS) {
      player.lastGrenadeAt = now;
      spawnGrenade(room, player, now);
    }
  }
}

function updateBullets(room, dt, now) {
  if (room.matchState !== "running") {
    if (room.bullets.length) room.bullets.length = 0;
    return;
  }

  for (let i = room.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = room.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;

    const expired = now - bullet.bornAt > BULLET_LIFE_MS;
    const outOfBounds =
      bullet.x < -50 ||
      bullet.y < -50 ||
      bullet.x > WORLD.width + 50 ||
      bullet.y > WORLD.height + 50;

    if (expired || outOfBounds) {
      room.bullets.splice(i, 1);
      continue;
    }

    if (bulletHitsObstacle(bullet, room.obstacles)) {
      room.bullets.splice(i, 1);
      continue;
    }

    for (const target of room.players.values()) {
      if (target.id === bullet.owner) continue;
      const shooter = room.players.get(bullet.owner);
      if (shooter && shooter.team && shooter.team === target.team) continue;
      const hit =
        distanceSq(target, bullet) <=
        (PLAYER_RADIUS + BULLET_RADIUS) * (PLAYER_RADIUS + BULLET_RADIUS);
      if (!hit) continue;

      const damage = bullet.damage || 25;
      applyDamage(room, target, shooter, damage, now, "bullet");

      room.bullets.splice(i, 1);
      break;
    }
  }
}

let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  for (const room of rooms.values()) {
    if (room.players.size === 0) continue;
    ensureMatch(room, now);
    updatePlayers(room, dt, now);
    updateBullets(room, dt, now);
    updateGrenades(room, dt, now);
    updatePowerups(room, now);
  }
}, 1000 / TICK_RATE);

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const snapshot = {
      room: roomSummary(room),
      players: Array.from(room.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        kills: p.kills,
        deaths: p.deaths,
        weapon: p.weapon,
        shieldUntil: p.spawnShieldUntil,
        speedBoostUntil: p.speedBoostUntil,
        rapidUntil: p.rapidUntil,
      })),
      bullets: room.bullets.map((b) => ({ id: b.id, x: b.x, y: b.y })),
      grenades: room.grenades.map((g) => ({ id: g.id, x: g.x, y: g.y, explodeAt: g.explodeAt })),
      obstacles: room.obstacles,
      powerups: room.powerups.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
      match: {
        state: room.matchState,
        scoreLimit: room.scoreLimit,
        scores: room.scores,
        timeLeftMs: room.matchEndsAt ? Math.max(room.matchEndsAt - now, 0) : 0,
        winner: room.matchWinner,
        nextStartMs: room.nextMatchAt ? Math.max(room.nextMatchAt - now, 0) : 0,
        vote:
          room.voteOptions && room.voteOptions.length && room.voteEndsAt
            ? {
                options: room.voteOptions,
                counts: tallyVotes(room),
                endsInMs: Math.max(room.voteEndsAt - now, 0),
              }
            : null,
      },
      world: WORLD,
    };

    io.to(room.id).emit("state", snapshot);
  }
}, 1000 / SNAPSHOT_RATE);

server.listen(PORT, () => {
  console.log(`PvP server running on http://localhost:${PORT}`);
});
