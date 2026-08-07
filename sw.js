/* Service worker — network-first dengan fallback cache (offline support) */
var CACHE = 'ftg-v5';
var CORE = [
  './', 'index.html', 'login.html', 'ftg-config.js', 'mentee-dashboard.html', 'mentor-dashboard.html',
  'admin-dashboard.html', 'admin-akun.html',
  'design-thinking-module.html', 'workshop-library.html', 'assignment-submission.html',
  'progress-tracker.html', 'mentor-feedback.html', 'kpi-leaderboard.html',
  'opening-ceremony.html', 'closing-ceremony.html',
  'app.js', 'responsive.css', 'manifest.json',
  'assets/ftg-logo.png', 'assets/gi-logo.png', 'assets/icon-192.png', 'assets/icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || e.request.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var clone = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});
