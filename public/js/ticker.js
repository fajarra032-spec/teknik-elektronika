// Running text: kecepatan tetap (px/detik) berapa pun panjang teksnya
(function () {
    var SPEED = 110; // px per detik
    var el = document.getElementById("runningText");
    if (!el) return;
    function atur() {
        el.style.animation = "none";
        void el.offsetWidth;                         // restart animasi
        var dur = Math.max(10, el.scrollWidth / SPEED);
        el.style.animation = "tickerMove " + dur.toFixed(1) + "s linear infinite";
    }
    atur();
    window.addEventListener("resize", atur);
    // teks diganti oleh tv.js / admin -> hitung ulang durasi
    new MutationObserver(atur).observe(el, { childList: true, characterData: true, subtree: true });
})();
