// Car Movement System - Service Worker
// Version: 2.0 - Enhanced Caching & Update System

const APP_VERSION = '2.0.0';
const CACHE_NAME = `car-movement-system-${APP_VERSION}`;
const DYNAMIC_CACHE = 'car-movement-dynamic-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.css',
  '/main.js',
  '/manifest.json',
  '/browserconfig.xml',
  '/al-masaood-logo.png'
];

// ============================================
// INSTALL EVENT - Cache Static Assets
// ============================================

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing version', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets...');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        console.log('[Service Worker] All static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
        throw error;
      })
  );
});

// ============================================
// ACTIVATE EVENT - Clean Up Old Caches
// ============================================

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating version', APP_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients immediately
      self.clients.claim(),
      
      // Notify all clients about the update
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
            message: 'Service Worker updated successfully'
          });
        });
      })
    ]).then(() => {
      console.log('[Service Worker] Activation complete');
    })
  );
});

// ============================================
// FETCH EVENT - Smart Caching Strategy
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Skip Firebase and external resources
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('gstatic') ||
      url.hostname.includes('googleapis') ||
      !url.origin.startsWith(self.location.origin)) {
    return event.respondWith(fetch(request));
  }
  
  event.respondWith(
    handleFetchRequest(request)
      .catch(() => {
        // Fallback for offline
        return caches.match('/index.html');
      })
  );
});

async function handleFetchRequest(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);
  
  // Try cache first for static assets
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Update cache in background if online
    if (navigator.onLine) {
      updateCacheInBackground(request, cache);
    }
    return cachedResponse;
  }
  
  // Try network for everything else
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses (except for API calls)
    if (networkResponse.ok && !url.pathname.includes('/api/')) {
      const clone = networkResponse.clone();
      cache.put(request, clone);
      
      // Also update dynamic cache
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      dynamicCache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // If network fails and we're looking for HTML, serve offline page
    if (request.headers.get('accept').includes('text/html')) {
      const offlinePage = await cache.match('/index.html');
      if (offlinePage) return offlinePage;
    }
    throw error;
  }
}

async function updateCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silent fail for background updates
  }
}

// ============================================
// MESSAGE EVENT - Communication with App
// ============================================

self.addEventListener('message', (event) => {
  const { data, ports } = event;
  console.log('[Service Worker] Received message:', data);
  
  switch (data.action) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CHECK_FOR_UPDATES':
      checkForUpdates().then(hasUpdate => {
        event.source.postMessage({
          type: 'UPDATE_CHECK_RESULT',
          hasUpdate,
          version: APP_VERSION,
          timestamp: new Date().toISOString()
        });
      });
      break;
      
    case 'GET_CACHE_INFO':
      getCacheInfo(ports ? ports[0] : null);
      break;
      
    case 'CLEAR_CACHE':
      clearUserCache().then(() => {
        event.source.postMessage({
          type: 'CACHE_CLEARED',
          timestamp: new Date().toISOString()
        });
      });
      break;
      
    case 'GET_VERSION':
      event.source.postMessage({
        type: 'VERSION_INFO',
        version: APP_VERSION,
        timestamp: new Date().toISOString()
      });
      break;
  }
});

// ============================================
// UPDATE MANAGEMENT
// ============================================

async function checkForUpdates() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const updatePromises = STATIC_ASSETS.map(async (asset) => {
      try {
        const networkResponse = await fetch(asset, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        const cachedResponse = await cache.match(asset);
        if (!cachedResponse) return true;
        
        const cachedETag = cachedResponse.headers.get('etag');
        const networkETag = networkResponse.headers.get('etag');
        
        if (cachedETag && networkETag && cachedETag !== networkETag) {
          return true;
        }
        
        const cachedLength = cachedResponse.headers.get('content-length');
        const networkLength = networkResponse.headers.get('content-length');
        return cachedLength !== networkLength;
      } catch {
        return false;
      }
    });
    
    const results = await Promise.all(updatePromises);
    return results.some(hasUpdate => hasUpdate);
  } catch (error) {
    console.error('[Service Worker] Error checking for updates:', error);
    return false;
  }
}

async function getCacheInfo(port) {
  try {
    const cacheNames = await caches.keys();
    const cacheInfo = {
      version: APP_VERSION,
      caches: cacheNames,
      cacheDetails: []
    };
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      cacheInfo.cacheDetails.push({
        name: cacheName,
        size: requests.length,
        urls: requests.map(req => req.url).slice(0, 5)
      });
    }
    
    if (port) {
      port.postMessage({
        type: 'CACHE_INFO',
        data: cacheInfo,
        timestamp: new Date().toISOString()
      });
    }
    
    return cacheInfo;
  } catch (error) {
    console.error('[Service Worker] Error getting cache info:', error);
    return null;
  }
}

async function clearUserCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('[Service Worker] All caches cleared');
    return true;
  } catch (error) {
    console.error('[Service Worker] Error clearing cache:', error);
    return false;
  }
}

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'Car Movement System',
      body: 'New update available',
      icon: '/al-masaood-logo.png'
    };
  }
  
  const options = {
    body: data.body || 'New notification from Car Movement System',
    icon: data.icon || '/al-masaood-logo.png',
    badge: '/al-masaood-logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: new Date().toISOString(),
      action: data.action || 'open'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Car Movement System', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
    // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ============================================
// BACKGROUND SYNC
// ============================================

self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  console.log('[Service Worker] Syncing pending data...');
  
  try {
    // This would typically sync with IndexedDB or local storage
    // For now, just log success
    console.log('[Service Worker] Data sync complete');
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    return Promise.reject(error);
  }
}

// ============================================
// PERIODIC SYNC & CLEANUP
// ============================================

// Clean up old cache entries periodically
async function cleanupOldCaches() {
  try {
    const cacheNames = await caches.keys();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const cacheName of cacheNames) {
      if (cacheName === DYNAMIC_CACHE) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const dateHeader = response.headers.get('date');
            if (dateHeader) {
              const responseDate = new Date(dateHeader).getTime();
              if (responseDate < oneWeekAgo) {
                await cache.delete(request);
              }
            }
          }
        }
      }
    }
    
    console.log('[Service Worker] Cache cleanup completed');
  } catch (error) {
    console.error('[Service Worker] Cache cleanup failed:', error);
  }
}

// Run cleanup once per day
setInterval(() => {
  if (navigator.onLine) {
    cleanupOldCaches();
  }
}, 24 * 60 * 60 * 1000);

// ============================================
// OFFLINE/ONLINE DETECTION
// ============================================

self.addEventListener('offline', () => {
  console.log('[Service Worker] App is offline');
  
  // Notify clients
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'APP_OFFLINE',
        timestamp: new Date().toISOString(),
        message: 'You are currently offline'
      });
    });
  });
});

self.addEventListener('online', () => {
  console.log('[Service Worker] App is back online');
  
  // Notify clients and trigger sync
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'APP_ONLINE',
        timestamp: new Date().toISOString(),
        message: 'Connection restored'
      });
    });
  });
  
  // Trigger background sync if available
  if ('sync' in self.registration) {
    self.registration.sync.register('sync-data');
  }
});

// ============================================
// ERROR HANDLING
// ============================================

self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
  
  // Log error to analytics if available
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'SW_ERROR',
        error: event.error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    });
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

// ============================================
// INITIALIZATION
// ============================================

console.log('[Service Worker] Car Movement System Service Worker loaded');
console.log('[Service Worker] Version:', APP_VERSION);
console.log('[Service Worker] Cache name:', CACHE_NAME);
console.log('[Service Worker] Static assets:', STATIC_ASSETS.length);

// Initial cleanup on load
cleanupOldCaches();

// Export for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_VERSION,
    CACHE_NAME,
    STATIC_ASSETS,
    handleFetchRequest,
    checkForUpdates,
    getCacheInfo,
    clearUserCache
  };
}