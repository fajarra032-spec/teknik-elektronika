// Cuaca Palopo (Open-Meteo, tanpa API key). Kondisi ditulis dalam bahasa Indonesia.
(function () {
    var LAT = -3.0016, LON = 120.1985;       // Palopo
    var REFRESH_MS = 10 * 60 * 1000, RETRY_MS = 60 * 1000;
    var el = {
        icon: document.getElementById("cwIcon"), temp: document.getElementById("cwTemp"),
        desc: document.getElementById("cwDesc"), extra: document.getElementById("cwExtra"),
        card: document.getElementById("cuacaCard")
    };
    if (!el.icon) return;

    // [teks, ikon siang, ikon malam, warna]
    function kondisi(code, cloud, day) {
        if (code === 0) return cloud <= 10 && day
            ? ["Sangat Cerah", "fa-sun", "fa-moon", "#ffd23f"]
            : ["Cerah", "fa-sun", "fa-moon", "#ffd23f"];
        if (code === 1) return ["Cerah Berawan", "fa-cloud-sun", "fa-cloud-moon", "#ffd23f"];
        if (code === 2) return ["Berawan Sebagian", "fa-cloud-sun", "fa-cloud-moon", "#cfe3ff"];
        if (code === 3) return ["Berawan", "fa-cloud", "fa-cloud", "#cfe3ff"];
        if (code === 45 || code === 48) return ["Berkabut", "fa-smog", "fa-smog", "#cfd8e6"];
        if (code >= 51 && code <= 57) return ["Gerimis", "fa-cloud-rain", "fa-cloud-rain", "#6ab0ff"];
        if (code === 61 || code === 80) return ["Hujan Ringan", "fa-cloud-rain", "fa-cloud-rain", "#6ab0ff"];
        if (code === 63 || code === 81) return ["Hujan Sedang", "fa-cloud-showers-heavy", "fa-cloud-showers-heavy", "#4a9bff"];
        if (code === 65 || code === 82 || code === 66 || code === 67) return ["Hujan Lebat", "fa-cloud-showers-heavy", "fa-cloud-showers-heavy", "#3b82f6"];
        if (code >= 95) return ["Badai Petir", "fa-cloud-bolt", "fa-cloud-bolt", "#ffcc33"];
        return ["Berawan", "fa-cloud", "fa-cloud", "#cfe3ff"];
    }

    function tampil(c) {
        var k = kondisi(c.weather_code, c.cloud_cover, c.is_day === 1);
        el.icon.className = "fa-solid " + (c.is_day === 1 ? k[1] : k[2]) + " cw-icon";
        el.icon.style.color = k[3];
        el.temp.textContent = Math.round(c.temperature_2m) + "°C";
        el.desc.textContent = k[0];
        el.extra.textContent = "Lembap " + Math.round(c.relative_humidity_2m) + "% • Angin " + Math.round(c.wind_speed_10m) + " km/j";
    }

    function muat() {
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON +
            "&current=temperature_2m,relative_humidity_2m,weather_code,cloud_cover,is_day,wind_speed_10m&timezone=Asia%2FMakassar";
        fetch(url, { cache: "no-store" })
            .then(function (r) { return r.json(); })
            .then(function (j) { tampil(j.current); setTimeout(muat, REFRESH_MS); })
            .catch(function () { setTimeout(muat, RETRY_MS); });   // tampilan terakhir tetap dipakai
    }
    muat();
})();
