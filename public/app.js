// Global error catcher for diagnostics
window.onerror = function(message, source, lineno, colno, error) {
  alert("App Error: " + message + " (Line " + lineno + ")");
  return false;
};

// Static 9 users list to fallback on when server is offline or page is opened via file://
const staticUsers = [
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

// Determine backend server URL dynamically
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('192.168.') || window.location.hostname.includes('loca.lt')
  ? '' // Connects to local host
  : 'https://shadowlink-2tnf.onrender.com';

// Initialize Socket.io safely
let socket = null;
let isOfflineMode = false;

try {
  if (typeof io !== 'undefined') {
    socket = io(BACKEND_URL);
  } else {
    console.warn("Socket.io client library not loaded. Falling back to offline simulation mode.");
    isOfflineMode = true;
  }
} catch (e) {
  console.warn("Failed to connect to real-time server. Falling back to offline simulation mode.", e);
  isOfflineMode = true;
}

let usersList = staticUsers;
let onlineUsers = new Set();
let currentUser = null;
let activeRecipientId = null;
let messageHistory = [];
let activeCountdownInterval = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const usersGrid = document.getElementById('users-grid');
const contactsList = document.getElementById('contacts-list');
const onlineCountEl = document.getElementById('online-count');

const currentUserName = document.getElementById('current-user-name');
const currentUserAvatar = document.getElementById('current-user-avatar');
const logoutBtn = document.getElementById('logout-btn');

const chatPlaceholder = document.getElementById('chat-placeholder');
const chatWindow = document.getElementById('chat-window');
const recipientAvatar = document.getElementById('recipient-avatar');
const recipientName = document.getElementById('recipient-name');
const recipientStatus = document.getElementById('recipient-status');

const messagesList = document.getElementById('messages-list');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const charCounter = document.getElementById('char-counter');
const sendBtn = document.getElementById('send-btn');
const backBtn = document.getElementById('back-btn');

// PIN Authentication DOM Elements
const pinAuthOverlay = document.getElementById('pin-auth-overlay');
const pinAvatar = document.getElementById('pin-avatar');
const pinTitle = document.getElementById('pin-title');
const pinDesc = document.getElementById('pin-desc');
const pinForm = document.getElementById('pin-form');
const pinInput = document.getElementById('pin-input');
const pinErrorMsg = document.getElementById('pin-error-msg');
const pinCancelBtn = document.getElementById('pin-cancel-btn');
const pinSubmitBtn = document.getElementById('pin-submit-btn');

// Snap Viewer DOM Elements
const snapViewerOverlay = document.getElementById('snap-viewer-overlay');
const viewerAvatar = document.getElementById('viewer-avatar');
const viewerSenderName = document.getElementById('viewer-sender-name');
const snapTextContent = document.getElementById('snap-text-content');
const countdownProgress = document.getElementById('countdown-progress');
const countdownNumber = document.getElementById('countdown-number');

// Web Audio API Synthesized Sounds
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'send') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (type === 'receive') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(450, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'destroy') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn("Audio Context blocked or unsupported:", e);
  }
}

// Fetch Users List on Page Load (with fallback)
async function fetchUsers() {
  if (isOfflineMode || window.location.protocol === 'file:') {
    isOfflineMode = true;
    console.log("Running in offline LocalStorage simulation mode.");
    usersList = staticUsers;
    staticUsers.forEach(u => onlineUsers.add(u.id));
    renderUsersGrid();
    loadOfflineHistory();
    return;
  }

  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error("HTTP error " + res.status);
    usersList = await res.json();
    renderUsersGrid();
  } catch (err) {
    console.warn("Error fetching /api/users, falling back to static list", err);
    isOfflineMode = true;
    usersList = staticUsers;
    staticUsers.forEach(u => onlineUsers.add(u.id));
    renderUsersGrid();
    loadOfflineHistory();
  }
}

let pendingLoginUser = null;
let isSettingNewPin = false;

// Triggered when a user card is clicked
function requestPinLogin(user) {
  pendingLoginUser = user;
  pinErrorMsg.style.display = 'none';
  pinInput.value = '';
  pinSubmitBtn.disabled = true;

  // Set avatar in modal
  pinAvatar.style.background = user.avatarColor;
  pinAvatar.textContent = getInitials(user.name);

  // Check if PIN status is set
  if (isOfflineMode) {
    const offlinePins = JSON.parse(localStorage.getItem('snap_pins') || '{}');
    const existingPin = offlinePins[user.id];
    if (!existingPin) {
      isSettingNewPin = true;
      pinTitle.textContent = "Create PIN";
      pinDesc.textContent = "Choose a 4-digit PIN to secure your profile";
      pinSubmitBtn.textContent = "Set PIN";
    } else {
      isSettingNewPin = false;
      pinTitle.textContent = "Verify PIN";
      pinDesc.textContent = "Enter your 4-digit PIN to login";
      pinSubmitBtn.textContent = "Verify";
    }
    pinAuthOverlay.classList.add('active');
    setTimeout(() => pinInput.focus(), 100);
  } else {
    // Online check
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, pin: '' }) // empty PIN checks status
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'NO_PIN') {
        isSettingNewPin = true;
        pinTitle.textContent = "Create PIN";
        pinDesc.textContent = "Choose a 4-digit PIN to secure your profile";
        pinSubmitBtn.textContent = "Set PIN";
      } else {
        isSettingNewPin = false;
        pinTitle.textContent = "Verify PIN";
        pinDesc.textContent = "Enter your 4-digit PIN to login";
        pinSubmitBtn.textContent = "Verify";
      }
      pinAuthOverlay.classList.add('active');
      setTimeout(() => pinInput.focus(), 100);
    })
    .catch(err => {
      console.warn("Online PIN check failed, using offline fallback", err);
      isOfflineMode = true;
      requestPinLogin(user);
    });
  }
}

// Render the secret codename list in login screen
function renderUsersGrid() {
  usersGrid.innerHTML = '';
  usersList.forEach(user => {
    const btn = document.createElement('button');
    btn.className = 'user-select-name-btn';
    btn.textContent = user.name;
    btn.addEventListener('click', () => requestPinLogin(user));
    usersGrid.appendChild(btn);
  });
}

function getInitials(name) {
  // Return first letter of name
  return name.charAt(0);
}

// Login trigger
function loginAs(user) {
  try {
    currentUser = user;
    
    // Set current user profiles (only shows secret name in UI)
    currentUserName.textContent = user.name;
    currentUserAvatar.style.background = user.avatarColor;
    currentUserAvatar.textContent = getInitials(user.name);

    // Transition screen
    loginScreen.classList.remove('active');
    dashboardScreen.classList.add('active');

    // Register user
    if (!isOfflineMode && socket) {
      socket.emit('register', user.id);
    } else {
      onlineUsers.add(user.id);
      loadOfflineHistory();
    }
    requestNotificationPermission();
    renderContacts();
  } catch (err) {
    console.error("Error inside loginAs: " + err.message);
  }
}

// Listeners for PIN Modal
pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/[^0-9]/g, '');
  pinSubmitBtn.disabled = pinInput.value.length !== 4;
});

pinCancelBtn.addEventListener('click', () => {
  pinAuthOverlay.classList.remove('active');
  pendingLoginUser = null;
});

pinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const enteredPin = pinInput.value;
  if (enteredPin.length !== 4 || !pendingLoginUser) return;

  if (isOfflineMode) {
    const offlinePins = JSON.parse(localStorage.getItem('snap_pins') || '{}');
    if (isSettingNewPin) {
      offlinePins[pendingLoginUser.id] = enteredPin;
      localStorage.setItem('snap_pins', JSON.stringify(offlinePins));
      pinAuthOverlay.classList.remove('active');
      loginAs(pendingLoginUser);
    } else {
      if (offlinePins[pendingLoginUser.id] === enteredPin) {
        pinAuthOverlay.classList.remove('active');
        loginAs(pendingLoginUser);
      } else {
        pinErrorMsg.style.display = 'block';
        pinInput.value = '';
        pinSubmitBtn.disabled = true;
        playSound('destroy');
      }
    }
  } else {
    const url = isSettingNewPin ? '/api/set-pin' : '/api/login';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pendingLoginUser.id, pin: enteredPin })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'SUCCESS') {
        pinAuthOverlay.classList.remove('active');
        loginAs(pendingLoginUser);
      } else {
        pinErrorMsg.style.display = 'block';
        pinInput.value = '';
        pinSubmitBtn.disabled = true;
        playSound('destroy');
      }
    })
    .catch(err => {
      alert("Error verifying PIN: " + err.message);
    });
  }
});

// Render Sidebar contacts list (shows only secret codenames)
function renderContacts() {
  if (!currentUser) return;
  contactsList.innerHTML = '';
  
  // Exclude current user from contact list
  const team = usersList.filter(u => u.id !== currentUser.id);

  team.forEach(member => {
    const isOnline = onlineUsers.has(member.id);
    const lastMsg = getLatestMessageWith(member.id);
    const unreadCount = getUnreadCountFrom(member.id);

    let detailText = "Tap to chat";

    if (lastMsg) {
      if (lastMsg.status === 'unopened') {
        detailText = lastMsg.from === currentUser.id ? 'Sent a snap' : 'New snap received!';
      } else if (lastMsg.status === 'opened') {
        detailText = 'Snap viewed';
      } else {
        detailText = 'Snap destroyed';
      }
    }

    const card = document.createElement('div');
    card.className = `contact-card ${activeRecipientId === member.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="avatar" style="background: ${member.avatarColor}">
        ${getInitials(member.name)}
        <span class="status-indicator ${isOnline ? 'online' : ''}"></span>
      </div>
      <div class="contact-meta">
        <h4>${member.name}</h4>
        <p>${detailText}</p>
      </div>
      ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
    `;

    card.addEventListener('click', () => selectRecipient(member));
    contactsList.appendChild(card);
  });

  // Update online count
  onlineCountEl.textContent = onlineUsers.has(currentUser.id) ? onlineUsers.size - 1 : onlineUsers.size;
}

// Select colleague to chat
function selectRecipient(member) {
  activeRecipientId = member.id;
  
  // Update Active Chat Header
  recipientName.textContent = member.name;
  recipientAvatar.style.background = member.avatarColor;
  recipientAvatar.textContent = getInitials(member.name);
  
  const isOnline = onlineUsers.has(member.id);
  recipientStatus.textContent = isOnline ? 'online' : 'offline';
  recipientStatus.className = isOnline ? 'online' : '';

  // Show Chat Window
  chatPlaceholder.classList.remove('active');
  chatWindow.classList.add('active');
  document.querySelector('.dashboard-layout').classList.add('chat-mode');

  // Redraw contacts to mark active and clear unread badge visual
  renderContacts();
  renderMessages();

  // Scroll to bottom of chat
  scrollToBottom();
}

// Get latest exchange message with user
function getLatestMessageWith(userId) {
  const list = messageHistory.filter(msg => 
    (msg.from === currentUser.id && msg.to === userId) || 
    (msg.from === userId && msg.to === currentUser.id)
  );
  return list.length ? list[list.length - 1] : null;
}

// Get count of unopened snaps received from user
function getUnreadCountFrom(userId) {
  return messageHistory.filter(msg => 
    msg.from === userId && 
    msg.to === currentUser.id && 
    msg.status === 'unopened'
  ).length;
}

// Render chat messages
function renderMessages() {
  if (!activeRecipientId) return;

  messagesList.innerHTML = '';
  
  const relevantMsgs = messageHistory.filter(msg => 
    (msg.from === currentUser.id && msg.to === activeRecipientId) || 
    (msg.from === activeRecipientId && msg.to === currentUser.id)
  );

  if (relevantMsgs.length === 0) {
    messagesList.innerHTML = `
      <div class="chat-placeholder active" style="position: static; padding: 20px;">
        <i class="fa-regular fa-paper-plane" style="font-size: 2.5rem;"></i>
        <h3>Send a snap!</h3>
        <p>Your chat will remain private. Snaps disappear after being opened.</p>
      </div>
    `;
    return;
  }

  relevantMsgs.forEach(msg => {
    const isSentByMe = msg.from === currentUser.id;
    const wrapper = document.createElement('div');
    wrapper.className = `message-bubble-wrapper ${isSentByMe ? 'sent' : 'received'}`;

    let innerHTML = '';

    const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isSentByMe) {
      innerHTML = `
        <div class="message-bubble">
          <div class="message-bubble-header">
            <span><i class="fa-solid fa-ghost snap-icon"></i>Short Snap</span>
          </div>
          <div class="snap-status-text">
            ${getStatusIcon(msg.status)}
            <span>${capitalize(msg.status)}</span>
          </div>
          <span class="message-time">${formattedTime}</span>
        </div>
      `;
    } else {
      if (msg.status === 'unopened') {
        innerHTML = `
          <div class="message-bubble">
            <div class="message-bubble-header">
              <span>New Snap Received</span>
            </div>
            <button class="snap-action-btn" onclick="openSnap('${msg.id}')">
              <i class="fa-solid fa-eye"></i> Tap to View
            </button>
            <span class="message-time">${formattedTime}</span>
          </div>
        `;
      } else if (msg.status === 'opened') {
        innerHTML = `
          <div class="message-bubble">
            <div class="message-bubble-header">
              <span>Snap Opened</span>
            </div>
            <div class="snap-destroyed-placeholder">
              <i class="fa-solid fa-spinner fa-spin"></i> Viewing snap...
            </div>
            <span class="message-time">${formattedTime}</span>
          </div>
        `;
      } else {
        innerHTML = `
          <div class="message-bubble">
            <div class="message-bubble-header">
              <span>Snap Status</span>
            </div>
            <div class="snap-destroyed-placeholder">
              <i class="fa-solid fa-fire"></i> Message self-destructed
            </div>
            <span class="message-time">${formattedTime}</span>
          </div>
        `;
      }
    }

    wrapper.innerHTML = innerHTML;
    messagesList.appendChild(wrapper);
  });
}

function getStatusIcon(status) {
  if (status === 'unopened') return '<i class="fa-solid fa-square" style="color: var(--accent-blue)"></i>';
  if (status === 'opened') return '<i class="fa-solid fa-square-arrow-up-right" style="color: var(--accent-color)"></i>';
  return '<i class="fa-solid fa-fire" style="color: var(--accent-red)"></i>';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Request to open snap
window.openSnap = function(messageId) {
  if (!isOfflineMode && socket) {
    socket.emit('open-message', messageId);
  } else {
    const msg = messageHistory.find(m => m.id === messageId);
    if (msg && msg.status === 'unopened') {
      msg.status = 'opened';
      msg.expiresAt = Date.now() + (msg.openTimer * 1000);
      saveOfflineHistory();
      renderContacts();
      renderMessages();
      showSnapViewer(msg);

      setTimeout(() => {
        msg.status = 'destroyed';
        msg.text = '• Message self-destructed •';
        saveOfflineHistory();
        playSound('destroy');
        renderContacts();
        renderMessages();
        if (snapViewerOverlay.classList.contains('active')) {
          closeSnapViewer();
        }
      }, msg.openTimer * 1000);
    }
  }
};

// Show Snap Modal & Trigger countdown logic
function showSnapViewer(msg) {
  const sender = usersList.find(u => u.id === msg.from);
  viewerSenderName.textContent = sender ? sender.name : 'Unknown';
  viewerAvatar.style.background = sender ? sender.avatarColor : '#ccc';
  viewerAvatar.textContent = sender ? getInitials(sender.name) : '??';
  
  snapTextContent.textContent = msg.text;
  snapViewerOverlay.classList.add('active');

  const duration = msg.openTimer;
  
  if (activeCountdownInterval) clearInterval(activeCountdownInterval);
  
  const totalOffset = 94;
  
  function updateTimer() {
    const msRemaining = msg.expiresAt - Date.now();
    const secRemaining = Math.max(0, Math.ceil(msRemaining / 1000));
    
    countdownNumber.textContent = secRemaining;

    const percentage = Math.max(0, msRemaining / (duration * 1000));
    const offset = totalOffset - (percentage * totalOffset);
    countdownProgress.style.strokeDashoffset = offset;

    if (msRemaining <= 0) {
      clearInterval(activeCountdownInterval);
      closeSnapViewer();
    }
  }

  updateTimer();
  activeCountdownInterval = setInterval(updateTimer, 100);
}

function closeSnapViewer() {
  snapViewerOverlay.classList.remove('active');
  if (activeCountdownInterval) {
    clearInterval(activeCountdownInterval);
    activeCountdownInterval = null;
  }
}

// Character counter and input validation
messageInput.addEventListener('input', () => {
  const remaining = 160 - messageInput.value.length;
  charCounter.textContent = remaining;
  
  if (remaining < 20) {
    charCounter.style.color = 'var(--accent-red)';
  } else {
    charCounter.style.color = 'var(--text-secondary)';
  }

  sendBtn.disabled = messageInput.value.trim().length === 0;
});

// Submit text message
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text.length > 0 && activeRecipientId) {
    if (!isOfflineMode && socket) {
      socket.emit('send-message', {
        to: activeRecipientId,
        text: text
      });
    } else {
      const newMsg = {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        from: currentUser.id,
        to: activeRecipientId,
        text: text,
        timestamp: Date.now(),
        status: 'unopened',
        openTimer: 10,
        expiresAt: null
      };
      messageHistory.push(newMsg);
      saveOfflineHistory();
      playSound('send');
      renderContacts();
      renderMessages();
    }

    messageInput.value = '';
    charCounter.textContent = '160';
    charCounter.style.color = 'var(--text-secondary)';
    sendBtn.disabled = true;
    scrollToBottom();
  }
});

// Back button handler for mobile layout
backBtn.addEventListener('click', () => {
  activeRecipientId = null;
  chatWindow.classList.remove('active');
  chatPlaceholder.classList.add('active');
  document.querySelector('.dashboard-layout').classList.remove('chat-mode');
  renderContacts();
});

// Logout handler
logoutBtn.addEventListener('click', () => {
  currentUser = null;
  activeRecipientId = null;
  messageHistory = [];
  
  document.querySelector('.dashboard-layout').classList.remove('chat-mode');

  if (!isOfflineMode && socket) {
    socket.disconnect();
    onlineUsers.clear();
  }

  dashboardScreen.classList.remove('active');
  loginScreen.classList.add('active');

  if (!isOfflineMode && socket) {
    socket.connect();
  } else {
    loadOfflineHistory();
  }
});

// Scroll helper
function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Offline Storage handlers (Secured to prevent cross-user snooping)
function saveOfflineHistory() {
  const data = localStorage.getItem('snap_history');
  let fullHistory = [];
  if (data) {
    try {
      fullHistory = JSON.parse(data);
    } catch(e) {
      fullHistory = [];
    }
  }
  
  if (currentUser) {
    const otherUsersMsgs = fullHistory.filter(msg => msg.from !== currentUser.id && msg.to !== currentUser.id);
    const updatedHistory = [...otherUsersMsgs, ...messageHistory];
    localStorage.setItem('snap_history', JSON.stringify(updatedHistory));
  } else {
    localStorage.setItem('snap_history', JSON.stringify(messageHistory));
  }
}

function loadOfflineHistory() {
  const data = localStorage.getItem('snap_history');
  if (data) {
    try {
      const fullHistory = JSON.parse(data);
      if (currentUser) {
        messageHistory = fullHistory.filter(msg => msg.from === currentUser.id || msg.to === currentUser.id);
      } else {
        messageHistory = [];
      }
    } catch(e) {
      messageHistory = [];
    }
  } else {
    messageHistory = [];
  }
}

// Web Socket Listeners (Active if online)
if (!isOfflineMode && socket) {
  socket.on('user-status', ({ userId, status }) => {
    if (status === 'online') {
      onlineUsers.add(userId);
    } else {
      onlineUsers.delete(userId);
    }
    renderContacts();
    if (activeRecipientId === userId) {
      const isOnline = onlineUsers.has(userId);
      recipientStatus.textContent = isOnline ? 'online' : 'offline';
      recipientStatus.className = isOnline ? 'online' : '';
    }
  });

  socket.on('message-history', (history) => {
    messageHistory = history;
    renderContacts();
    renderMessages();
    scrollToBottom();
  });

  socket.on('new-message', (msg) => {
    messageHistory.push(msg);
    if (currentUser && msg.from === currentUser.id) {
      playSound('send');
    } else {
      playSound('receive');
      showLocalNotification(msg); // Trigger push notification for received snaps
    }
    renderContacts();
    renderMessages();
    scrollToBottom();
  });

  socket.on('message-updated', (updatedData) => {
    const idx = messageHistory.findIndex(m => m.id === updatedData.id);
    if (idx !== -1) {
      const oldStatus = messageHistory[idx].status;
      messageHistory[idx] = { ...messageHistory[idx], ...updatedData };
      
      if (updatedData.status === 'destroyed' && oldStatus !== 'destroyed') {
        playSound('destroy');
      }

      renderContacts();
      renderMessages();

      if (currentUser && updatedData.status === 'opened' && messageHistory[idx].to === currentUser.id) {
        showSnapViewer(messageHistory[idx]);
      }

      if (updatedData.status === 'destroyed' && snapViewerOverlay.classList.contains('active')) {
        closeSnapViewer();
      }
    }
  });

  socket.on('error-msg', (msg) => {
    alert(msg);
  });
}

// Native HTML5 Web Notification handlers for PWA
function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

function showLocalNotification(msg) {
  if ('Notification' in window && Notification.permission === 'granted') {
    // Only send notification if document is hidden OR sender is not the currently active chat
    if (msg.from !== currentUser.id && (document.hidden || msg.from !== activeRecipientId)) {
      const sender = usersList.find(u => u.id === msg.from);
      const senderName = sender ? sender.name : "Someone";
      
      const notification = new Notification(`New message from ${senderName}`, {
        body: "You received a new disappearing snap!",
        icon: "https://img.icons8.com/color/192/000000/ghost.png",
        tag: msg.id
      });

      notification.onclick = () => {
        window.focus();
        if (sender) {
          selectRecipient(sender);
        }
        notification.close();
      };
    }
  }
}

// Initialize App
fetchUsers();
