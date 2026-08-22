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
    const data = e.data.json();
    const options = {
      body: data.body,
      icon: 'https://img.icons8.com/color/192/000000/ghost.png',
      badge: 'https://img.icons8.com/color/96/000000/ghost.png',
      tag: data.tag,
      vibrate: [100, 50, 100],
      data: { senderId: data.senderId }
    };
    e.waitUntil(
      self.registration.showNotification(data.title, options)
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
