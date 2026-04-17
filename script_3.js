
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js?v=13', { scope: './' }).catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
}
