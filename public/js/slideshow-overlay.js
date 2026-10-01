// Saat slideshow/video layar penuh tampil: video memenuhi layar, header & running text jadi transparan di atasnya
(function () {
    var box = document.getElementById("slideshowContainer");
    if (!box) return;

    function tampil() {
        var cs = getComputedStyle(box);
        if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.01) return false;
        return !!box.querySelector("img, video, iframe, canvas");
    }
    function cek() { document.body.classList.toggle("slideshow-on", tampil()); }

    cek();
    setInterval(cek, 400);                                   // cadangan bila tv.js hanya mengubah style
    new MutationObserver(cek).observe(box, { childList: true, subtree: true, attributes: true });
})();
