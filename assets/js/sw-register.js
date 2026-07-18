/*!
 * sw-register.js — SEKARANG JADI SCRIPT PEMBERSIH, BUKAN PENDAFTAR SW.
 * -----------------------------------------------------------------
 * Sebelumnya file ini mendaftarkan Service Worker (sw.js) untuk
 * cache file statis. Ternyata itu bikin bug: begitu browser sudah
 * pasang SW versi lama, Chrome cuma mau cek versi baru maksimal
 * 1x/24 jam KECUALI DevTools dibuka — jadi dashboard bisa nyangkut
 * di versi lama sampai satu hari penuh untuk pengguna yang sudah
 * pernah buka situs ini sebelumnya.
 *
 * Sekarang: SW dihapus total. Script ini otomatis membersihkan SW
 * + cache lama dari browser siapa pun yang sempat ke-install (sekali
 * jalan, permanen bersih), tanpa perlu F12 / hard refresh manual.
 * GitHub Pages sendiri sudah cukup cepat lewat HTTP cache biasa.
 * -----------------------------------------------------------------
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (reg) { reg.unregister(); });
  }).catch(function () {});
}
if (window.caches && caches.keys) {
  caches.keys().then(function (keys) {
    keys.forEach(function (k) { caches.delete(k); });
  }).catch(function () {});
}

