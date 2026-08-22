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
        data = { title: "New Snap", body: e.data.text() };
      }
    }
    const options = {
      body: data.body || "You received a new disappearing message",
      icon: 'https://img.icons8.com/color/192/000000/ghost.png',
      badge: 'https://img.icons8.com/color/96/000000/ghost.png',
      tag: data.tag || 'new-snap',
      vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 200], // Wake-up vibration pattern
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
