/*!
 * sw-register.js — daftarkan service worker (lihat sw.js) supaya
 * asset situs ini di-cache browser dan loading berikutnya lebih cepat.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {
      // gagal daftar SW (mis. dibuka dari file://) -> abaikan, situs tetap jalan
    });
  });
}
