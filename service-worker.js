// service-worker.js — Simple Auto-Update SW

const CACHE_NAME = "car-movement-v1";

// عند التثبيت: حذف أي كاش قديم
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.skipWaiting();
});

// عند التفعيل: تفعيل النسخة الجديدة فورًا
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// لا نستخدم fetch caching — نسمح للمتصفح بجلب الملفات مباشرة
self.addEventListener("fetch", () => {
  // intentionally empty
});
