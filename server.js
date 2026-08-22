const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize database file for PINs and Push Subscriptions persistence
let dbData = { pins: {}, subscriptions: {} };
if (fs.existsSync(DB_FILE)) {
  try {
    dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!dbData.pins) dbData.pins = {};
    if (!dbData.subscriptions) dbData.subscriptions = {};
  } catch (e) {
    console.error("Error reading db.json, resetting...", e);
  }
} else {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

// Generate VAPID keys dynamically if not exists
if (!dbData.vapidKeys) {
  dbData.vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

// Configure web-push details
webpush.setVapidDetails(
  'mailto:admin@shadowlink.local',
  dbData.vapidKeys.publicKey,
  dbData.vapidKeys.privateKey
);

// Predefined 9 secret codename users mapped to real names
const users = [
  { id: 'u1', name: 'Raven', realName: 'Deepak Nautiyal', avatarColor: 'linear-gradient(135deg, #FF6B6B, #FF8E53)' },
  { id: 'u2', name: 'Cipher', realName: 'Ayush Sharma', avatarColor: 'linear-gradient(135deg, #F3A683, #F19066)' },
  { id: 'u3', name: 'Falcon', realName: 'Vipul Tiwari', avatarColor: 'linear-gradient(135deg, #4834D4, #686DE0)' },
  { id: 'u4', name: 'Orion', realName: 'Chandra Prakash Maurya', avatarColor: 'linear-gradient(135deg, #1DD1A1, #10AC84)' },
  { id: 'u5', name: 'Shadow', realName: 'Navneet Tiwari', avatarColor: 'linear-gradient(135deg, #FF9F43, #FFB142)' },
  { id: 'u6', name: 'Viper', realName: 'Amit Chahar', avatarColor: 'linear-gradient(135deg, #0984E3, #74B9FF)' },
  { id: 'u7', name: 'Phoenix', realName: 'Tattvam Shiva Chaturvedi', avatarColor: 'linear-gradient(135deg, #2C3E50, #34495E)' },
  { id: 'u8', name: 'Ghost', realName: 'Prakhar Kumar Singh', avatarColor: 'linear-gradient(135deg, #E84393, #FD79A8)' },
  { id: 'u9', name: 'Wolf', realName: 'Manas Maurya', avatarColor: 'linear-gradient(135deg, #6C5CE7, #A29BFE)' }
];

// In-memory messages storage
let messages = [];

// Map to track active user socket connections
const userSockets = new Map();

// Enable CORS middleware manually
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Fetch users list
app.get('/api/users', (req, res) => {
  const usersWithPinStatus = users.map(u => ({
    ...u,
    hasPin: !!dbData.pins[u.id]
  }));
  res.json(usersWithPinStatus);
});

// Verify user PIN
app.post('/api/login', (req, res) => {
  const { userId, pin } = req.body;
  if (!users.some(u => u.id === userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  const savedPin = dbData.pins[userId];
  if (!savedPin) {
    return res.json({ status: 'NO_PIN' });
  }
  if (savedPin === pin) {
    return res.json({ status: 'SUCCESS' });
  } else {
    return res.json({ status: 'WRONG_PIN' });
  }
});

// Create/Update user PIN
app.post('/api/set-pin', (req, res) => {
  const { userId, pin } = req.body;
  if (!users.some(u => u.id === userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be a 4-digit number' });
  }
  dbData.pins[userId] = pin;
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  return res.json({ status: 'SUCCESS' });
});

// Get VAPID Public Key
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: dbData.vapidKeys.publicKey });
});

// Save Web Push Subscription for a user
app.post('/api/subscribe', (req, res) => {
  const { userId, subscription } = req.body;
  if (!users.some(u => u.id === userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  dbData.subscriptions[userId] = subscription;
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  res.json({ success: true });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  let currentUserId = null;

  socket.on('register', (userId) => {
    if (!users.some(u => u.id === userId)) {
      socket.emit('error-msg', 'Invalid User ID');
      return;
    }
    
    currentUserId = userId;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Broadcast user online status
    io.emit('user-status', { userId, status: 'online' });

    // Send history of unopened or recently active messages involving this user
    const userMessages = messages.filter(msg => msg.from === userId || msg.to === userId)
      .map(msg => {
        if (msg.status === 'destroyed') {
          return { ...msg, text: '• Message self-destructed •' };
        }
        return msg;
      });
    
    socket.emit('message-history', userMessages);
  });

  socket.on('send-message', (data) => {
    if (!currentUserId) return;
    const { to, text } = data;

    if (!text || text.trim().length === 0) return;
    if (text.length > 160) {
      socket.emit('error-msg', 'Message exceeds 160 characters limit');
      return;
    }

    const newMessage = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      from: currentUserId,
      to,
      text: text.trim(),
      timestamp: Date.now(),
      status: 'unopened',
      openTimer: 10,
      expiresAt: null
    };

    messages.push(newMessage);

    // Send to recipient via WebSocket if online
    const recipientSockets = userSockets.get(to);
    let recipientOnline = false;
    if (recipientSockets && recipientSockets.size > 0) {
      recipientOnline = true;
      recipientSockets.forEach(sid => {
        io.to(sid).emit('new-message', newMessage);
      });
    }

    // Trigger Web Push Notification if recipient is not online/connected
    if (!recipientOnline) {
      const subscription = dbData.subscriptions[to];
      if (subscription) {
        const sender = users.find(u => u.id === currentUserId);
        const payload = JSON.stringify({
          title: `New Snap from ${sender ? sender.name : 'Someone'}`,
          body: 'You received a new disappearing snap!',
          tag: newMessage.id,
          senderId: currentUserId
        });

        webpush.sendNotification(subscription, payload).catch(err => {
          console.error('Error sending push notification to ' + to, err.message);
          // If subscription has expired or is no longer valid, delete it
          if (err.statusCode === 410 || err.statusCode === 404) {
            delete dbData.subscriptions[to];
            fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
          }
        });
      }
    }

    // Send confirmation to sender
    const senderSockets = userSockets.get(currentUserId);
    if (senderSockets) {
      senderSockets.forEach(sid => {
        io.to(sid).emit('new-message', newMessage);
      });
    }
  });

  socket.on('open-message', (messageId) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg) return;

    if (msg.to !== currentUserId || msg.status !== 'unopened') return;

    msg.status = 'opened';
    msg.expiresAt = Date.now() + (msg.openTimer * 1000);

    const notifyUsers = [msg.from, msg.to];
    notifyUsers.forEach(uId => {
      const sids = userSockets.get(uId);
      if (sids) {
        sids.forEach(sid => {
          io.to(sid).emit('message-updated', {
            id: msg.id,
            status: msg.status,
            expiresAt: msg.expiresAt,
            openTimer: msg.openTimer
          });
        });
      }
    });

    // Set server-side countdown trigger to destroy message
    setTimeout(() => {
      msg.status = 'destroyed';
      msg.text = '• Message self-destructed •';
      
      notifyUsers.forEach(uId => {
        const sids = userSockets.get(uId);
        if (sids) {
          sids.forEach(sid => {
            io.to(sid).emit('message-updated', {
              id: msg.id,
              status: msg.status,
              text: msg.text,
              expiresAt: msg.expiresAt
            });
          });
        }
      });
    }, msg.openTimer * 1000);
  });

  socket.on('disconnect', () => {
    if (currentUserId && userSockets.has(currentUserId)) {
      const sids = userSockets.get(currentUserId);
      sids.delete(socket.id);
      if (sids.size === 0) {
        userSockets.delete(currentUserId);
        io.emit('user-status', { userId: currentUserId, status: 'offline' });
      }
    }
  });
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShadowLink running at http://localhost:${PORT}`);
});
