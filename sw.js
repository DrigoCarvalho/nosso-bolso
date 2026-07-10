const CACHE = 'nosso-bolso-v5';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API (Apps Script) e requisições não-GET: sempre rede, nunca cache
  if (e.request.method !== 'GET' || url.hostname.includes('script.google')) return;

  // App (navegação / index.html): REDE PRIMEIRO, cache só como reserva offline.
  // Garante que atualizações apareçam na primeira reabertura.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // Fontes do Google: cache dinâmico (funciona offline após 1º uso)
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // Demais estáticos (ícones, manifest): cache primeiro
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
