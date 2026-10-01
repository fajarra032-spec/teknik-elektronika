// ======================================================
// JADWAL PER JAM: tampilkan jam saat ini + jam berikutnya
// Sumber data: /api/jadwal (status sudah dihitung server, WITA/NTP)
// ======================================================
(function () {
    var REFRESH_MS = 15000;   // ambil ulang data
    var PAGE_MS = 8000;       // ganti halaman jika baris terlalu banyak
    var PANEL_MS = 5000;      // ganti kelas di panel "sedang berlangsung"
    var MAX_ROWS = 8;         // baris per halaman

    var tbody = document.getElementById("slotTbody");
    var panel = document.getElementById("slotBerlangsung");
    var info = document.getElementById("slotInfo");
    if (!tbody || !panel) return;

    var lastSig = "", lastRoomHtml = "";
    var rows = [], ongoing = [], nextItems = [], allItems = [], page = 0, panelIdx = 0, nextIdx = 0;
    var offsetMs = 0;                       // selisih jam server (NTP) - jam browser
    var roomEl = document.getElementById("roomStatus");

    // detik sejak tengah malam WITA, mengikuti jam server
    function nowSec() {
        var t = Date.now() + offsetMs + 8 * 3600000;
        return Math.floor((t % 86400000) / 1000);
    }
    function hms(sec) {
        sec = Math.max(0, sec);
        var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), d = sec % 60;
        return [h, m, d].map(function (n) { return String(n).padStart(2, "0"); }).join(" : ");
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
    }

    function toMin(t) {
        var p = String(t).trim().replace(/[.\/]/g, ":").split(":");
        return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    }

    function parseJam(jam) {
        var s = String(jam || "").replace(/\./g, ":").replace(/(\d{2}:\d{2})-(\d{2})$/, "$1:$2");
        var m = s.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (!m) return null;
        return { start: toMin(m[1]), end: toMin(m[2]), label: m[1].padStart(5, "0") + "–" + m[2].padStart(5, "0") };
    }

    function susun(data) {
        var items = [];
        data.forEach(function (d) {
            var j = parseJam(d.jam);
            if (j) items.push({ d: d, j: j });
        });

        var now = items.filter(function (x) { return x.d.status === "Berlangsung"; });
        var upcoming = items.filter(function (x) { return x.d.status === "Belum Mulai"; });

        // jam berikutnya = waktu mulai paling awal di antara yang belum mulai
        var next = [];
        if (upcoming.length) {
            var t = Math.min.apply(null, upcoming.map(function (x) { return x.j.start; }));
            next = upcoming.filter(function (x) { return x.j.start === t; });
        }

        function urut(a, b) {
            return a.j.start - b.j.start || String(a.d.ruangan).localeCompare(String(b.d.ruangan));
        }
        now.sort(urut); next.sort(urut);

        ongoing = now;
        nextItems = next;
        allItems = items;
        rows = now.map(function (x) { x.aktif = true; return x; })
            .concat(next.map(function (x) { x.aktif = false; return x; }));
    }

    function renderTabel() {
        // render ulang hanya bila data berubah (agar posisi scroll tidak melompat)
        var sig = JSON.stringify(rows.map(function (x) { return [x.aktif, x.d.jam, x.d.matkul, x.d.prodi, x.d.dosen, x.d.ruangan]; }));
        if (sig === lastSig) return;
        lastSig = sig;
        var slice = rows;

        if (!rows.length) {
            tbody.innerHTML = '<tr class="kosong"><td colspan="5">Tidak ada kelas pada jam ini maupun berikutnya</td></tr>';
        } else {
            tbody.innerHTML = slice.map(function (x) {
                return '<tr class="' + (x.aktif ? "aktif" : "berikut") + '">' +
                    '<td class="c-jam"><div class="jam-cell"><span class="jam-txt">' + esc(x.j.label) + '</span><span class="badge ' +
                        (x.aktif ? "b-now" : "b-next") + '">' + (x.aktif ? "SEKARANG" : "BERIKUTNYA") + '</span></div></td>' +
                    '<td class="c-matkul">' + esc(x.d.matkul) + '</td>' +
                    '<td>' + esc(x.d.prodi) + '</td>' +
                    '<td>' + esc(x.d.dosen) + '</td>' +
                    '<td class="c-ruang">' + esc(x.d.ruangan) + '</td></tr>';
            }).join("");
        }
        if (info) info.textContent = rows.length ? rows.length + " kelas" : "";
    }

    function ico(c, t) { return '<span><i class="fa-solid ' + c + '"></i>' + esc(t) + '</span>'; }

    function renderPanel() {
        if (panelIdx >= ongoing.length) panelIdx = 0;
        var kiri;
        if (!ongoing.length) {
            kiri = '<div class="card now idle"><div class="lbl"><span class="dot off"></span>BELUM ADA KELAS BERLANGSUNG</div>' +
                '<div class="mk">Silakan menunggu jadwal berikutnya</div></div>';
        } else {
            var x = ongoing[panelIdx].d;
            kiri = '<div class="card now"><div class="lbl"><span class="dot"></span>SEDANG BERLANGSUNG' +
                (ongoing.length > 1 ? ' <em>' + (panelIdx + 1) + '/' + ongoing.length + '</em>' : '') + '</div>' +
                '<div class="mk">' + esc(x.matkul) + '</div>' +
                '<div class="meta">' + ico("fa-graduation-cap", x.prodi) + ico("fa-door-open", x.ruangan) + ico("fa-user-tie", x.dosen) + '</div>' +
                '<div class="cd-row">Sisa waktu <span class="cd big" id="cdSisa"></span></div></div>';
        }
        var kanan = "";
        if (nextItems.length) {
            if (nextIdx >= nextItems.length) nextIdx = 0;
            var n = nextItems[nextIdx];
            kanan = '<div class="card next"><div class="lbl"><i class="fa-regular fa-clock"></i>BERIKUTNYA • ' + esc(n.j.label) +
                (nextItems.length > 1 ? ' <em>' + (nextIdx + 1) + '/' + nextItems.length + '</em>' : '') + '</div>' +
                '<div class="mk">' + esc(n.d.matkul) + '</div>' +
                '<div class="meta">' + ico("fa-graduation-cap", n.d.prodi) + ico("fa-door-open", n.d.ruangan) + ico("fa-user-tie", n.d.dosen) + '</div>' +
                '<div class="cd-row">Mulai dalam <span class="cd" id="cdMulai"></span></div></div>';
        }
        panel.innerHTML = kiri + kanan;
        tick();
    }

    function tick() {
        var n = nowSec();
        var a = document.getElementById("cdSisa");
        if (a && ongoing.length) a.textContent = hms(ongoing[Math.min(panelIdx, ongoing.length - 1)].j.end * 60 - n);
        var b = document.getElementById("cdMulai");
        if (b && nextItems.length) b.textContent = hms(nextItems[0].j.start * 60 - n);
        // pergantian jam: ambil data baru
        var batas = ongoing.map(function (x) { return x.j.end; }).concat(nextItems.map(function (x) { return x.j.start; }));
        if (batas.some(function (m) { return m * 60 === n; })) setTimeout(muat, 1500);
        renderRuangan(n);
    }

    // status ruangan dari jadwal hari ini
    function renderRuangan(n) {
        if (!roomEl) return;
        var rooms = {};
        allItems.forEach(function (x) {
            var key = String(x.d.ruangan || "").trim().toLowerCase();
            if (!key) return;
            var r = rooms[key] || (rooms[key] = { nama: String(x.d.ruangan).trim(), st: 0 });
            if (n >= x.j.start * 60 && n < x.j.end * 60) r.st = 2;
            else if (x.j.start * 60 > n && x.j.start * 60 - n <= 1800 && r.st < 1) r.st = 1;
        });
        var ks = Object.keys(rooms);
        var used = ks.filter(function (k) { return rooms[k].st === 2; }).length;
        var stEl = document.getElementById("slotStats");
        function tile(v, l, c) { return '<div class="tile ' + c + '"><b>' + v + '</b><span>' + l + '</span></div>'; }
        if (stEl) stEl.innerHTML = tile(ongoing.length, "KELAS BERLANGSUNG", "t-now") +
            tile(used + "/" + ks.length, "RUANG DIGUNAKAN", "t-room") + tile(nextItems.length, "KELAS BERIKUTNYA", "t-next");
        var label = ["Kosong", "Akan digunakan", "Digunakan"], cls = ["kosong", "akan", "pakai"];
        var html = Object.keys(rooms).sort().map(function (k) {
            var r = rooms[k];
            return '<span class="room ' + cls[r.st] + '"><i></i>' + esc(r.nama) + '<em>' + label[r.st] + '</em></span>';
        }).join("");
        var target = document.getElementById("roomScroll") || roomEl;
        if (html !== lastRoomHtml) { lastRoomHtml = html; target.innerHTML = html; }
    }

    function muat() {
        fetch("/api/waktu", { cache: "no-store" })
            .then(function (r) { return r.json(); })
            .then(function (w) { if (w && w.timestamp) offsetMs = w.timestamp - Date.now(); })
            .catch(function () {})
            .then(function () { return fetch("/api/jadwal", { cache: "no-store" }); })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                susun(Array.isArray(data) ? data : []);
                renderTabel(); renderPanel();
            })
            .catch(function (e) { console.error("Jadwal per jam gagal dimuat:", e); });
    }

    // ---- auto-scroll ke bawah bila isi tabel lebih tinggi dari layar ----
    function autoScroll(id) {
        var box = document.getElementById(id);
        if (!box || !window.requestAnimationFrame) return;
        var SPEED = 35;      // px per detik
        var PAUSE = 3000;    // jeda di atas & di bawah (ms)
        var pos = 0, last = 0, wait = PAUSE, atEnd = false;
        function frame(ts) {
            var dt = last ? Math.min(ts - last, 100) : 0;
            last = ts;
            var max = box.scrollHeight - box.clientHeight;
            if (max <= 2) {
                pos = 0; box.scrollTop = 0; atEnd = false; wait = PAUSE;
            } else if (wait > 0) {
                wait -= dt;
            } else if (atEnd) {
                pos = 0; box.scrollTop = 0; atEnd = false; wait = PAUSE;
            } else {
                pos += SPEED * dt / 1000;
                if (pos >= max) { pos = max; atEnd = true; wait = PAUSE; }
                box.scrollTop = pos;
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
    autoScroll("slotScroll");
    autoScroll("roomScroll");

    muat();
    setInterval(muat, REFRESH_MS);
    setInterval(function () { panelIdx++; nextIdx++; renderPanel(); }, PANEL_MS);
    setInterval(tick, 1000);
})();
