// Offline support is added in the PWA step; until sw.js exists this is a no-op.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
