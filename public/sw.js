const CACHE_NAME = 'shadowlink-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching PWA Assets...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  console.log('Service Worker Activated');
});

// Fetch Event (Network First fallback to Cache)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request);
    })
  );
});

// Handle push event (triggers mobile background push notifications)
self.addEventListener('push', (e) => {
  try {
    let data = {};
    if (e.data) {
      try {
        data = e.data.json();
      } catch (err) {
        data = { title: "New Message", body: e.data.text() };
      }
    }
    const options = {
      body: data.body || "You received a new disappearing message",
      icon: 'https://img.icons8.com/color/192/000000/ghost.png',
      badge: 'https://img.icons8.com/color/96/000000/ghost.png',
      tag: data.tag || 'new-message',
      vibrate: [1000, 200, 1000, 200, 1000], // Heavy vibration pattern (1s vibration, 0.2s pause)
      sound: 'default', // Trigger default device sound to wake screen
      requireInteraction: true, // Keep notification active to wake screen
      renotify: true, // Force sound/vibe on new messages
      actions: [
        { action: 'open', title: 'Open Chat' }
      ],
      data: { senderId: data.senderId }
    };
    
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If the app is currently open and focused in the foreground, do not show duplicate push banner
        const isAppActive = clientList.some(client => client.focused || client.visibilityState === 'visible');
        if (!isAppActive) {
          return self.registration.showNotification(data.title || "ShadowLink Alert", options);
        }
      })
    );
  } catch (err) {
    console.error('Error receiving push event:', err);
  }
});

// Handle notification click on mobile devices
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
