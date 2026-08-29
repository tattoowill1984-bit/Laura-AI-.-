const CACHE_NAME = 'larua-autonomous-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Clean up legacy periodic sync tags if present
      if ('periodicSync' in self.registration) {
        try {
          const tags = await self.registration.periodicSync.getTags();
          for (const tag of tags) {
            await self.registration.periodicSync.unregister(tag);
          }
        } catch {}
      }
    })()
  );
});

// Periodic background health check loop while worker is active
setInterval(() => {
  performHealthCheck();
}, 60000);

async function performHealthCheck() {
  try {
    await fetch('/api/status');
  } catch {}
}

