// Loutrons : garde tous les fichiers de l'appli en cache pour qu'elle marche sans connexion.
// À chaque modification d'un de ces fichiers, changer VERSION : c'est ce qui fait récupérer la nouvelle version aux téléphones.
// Même numéro que dans js/version.js (affiché dans Réglages).
const VERSION = '3.3';
const CACHE = 'loutrons-' + VERSION;
// Photos des exercices : pas toutes téléchargées à l'installation (environ 5 Mo), mais gardées dès qu'on les a vues une fois.
// Cache à part, conservé d'une version à l'autre.
const PHOTOS = 'loutrons-photos-1';
const FILES = [
  './',
  'index.html',
  'js/app.js',
  'js/actions.js',
  'js/backup.js',
  'js/bodymap.js',
  'js/chart.js',
  'js/data.js',
  'js/emile.js',
  'js/ring.js',
  'js/energy.js',
  'js/nav.js',
  'js/recipes.js',
  'js/engine.js',
  'js/food.js',
  'js/library.js',
  'js/nutrition.js',
  'js/render.js',
  'js/scanner.js',
  'js/store.js',
  'js/timers.js',
  'js/util.js',
  'js/version.js',
  'js/views/calendar.js',
  'js/views/editors.js',
  'js/views/fiche.js',
  'js/views/movement.js',
  'js/views/food.js',
  'js/views/goal.js',
  'js/views/history.js',
  'js/views/picker.js',
  'js/views/profile.js',
  'js/views/program.js',
  'js/views/progress.js',
  'js/views/session.js',
  'js/views/setup.js',
  'js/views/today.js',
  'js/views/activity.js',
  'manifest.webmanifest',
  'vendor/zxing/zxing.min.js',
  'data/ciqual.json',
  'icons/logo.png',
  'icons/emile.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'fonts/archivo.woff2'
];

self.addEventListener('install', e => {
  // cache: 'reload' : ne pas reprendre une ancienne copie du cache HTTP
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => (k.indexOf('loutrons-') === 0 || k.indexOf('grow-up-') === 0) && k !== CACHE && k !== PHOTOS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache d'abord : l'appli s'ouvre tout de suite, même avec un mauvais réseau à la salle
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.indexOf('/photos/') >= 0) {
    e.respondWith(caches.open(PHOTOS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(err => {
    if (req.mode === 'navigate') return caches.match('./');
    throw err;
  })));
});
