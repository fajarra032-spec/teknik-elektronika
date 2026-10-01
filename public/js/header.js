// Jam & tanggal header (WITA), mengikuti jam server (NTP) dari /api/waktu
(function () {
    var HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
    var BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    var hm = document.getElementById("hdHM"), ss = document.getElementById("hdSS"),
        hari = document.getElementById("hdHari"), tgl = document.getElementById("hdTanggal");
    if (!hm) return;
    var offset = 0, lastDay = -1;
    var p2 = function (n) { return String(n).padStart(2, "0"); };

    function sinkron() {
        fetch("/api/waktu", { cache: "no-store" }).then(function (r) { return r.json(); })
            .then(function (w) { if (w && w.timestamp) offset = w.timestamp - Date.now(); })
            .catch(function () {});
    }
    function tick() {
        var d = new Date(Date.now() + offset + 8 * 3600000);   // geser ke WITA, baca sebagai UTC
        hm.textContent = p2(d.getUTCHours()) + ":" + p2(d.getUTCMinutes());
        ss.textContent = p2(d.getUTCSeconds());
        if (d.getUTCDate() !== lastDay) {
            lastDay = d.getUTCDate();
            hari.textContent = HARI[d.getUTCDay()];
            tgl.textContent = d.getUTCDate() + " " + BULAN[d.getUTCMonth()] + " " + d.getUTCFullYear();
        }
        setTimeout(tick, 1000 - (Date.now() % 1000));           // selaras dengan pergantian detik
    }
    sinkron(); setInterval(sinkron, 5 * 60 * 1000);
    tick();
})();
