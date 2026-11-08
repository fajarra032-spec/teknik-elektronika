# Draf Template WhatsApp (diajukan ke Meta, kategori UTILITY, bahasa Indonesia)

Pesan yang dimulai oleh prodi di luar jendela 24 jam **wajib** memakai template yang sudah disetujui.
Semua template memakai 3 variabel: `{{1}}` nama penerima, `{{2}}` judul, `{{3}}` keterangan + tautan.

| Nama template | Isi |
|---|---|
| `nilai_keluar` | Halo {{1}}, ada pembaruan nilai di Sistem Informasi Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. Prodi Teknik Elektronika. |
| `info_magang` | Halo {{1}}, informasi magang Anda: {{2}}. {{3}} Terima kasih. Prodi Teknik Elektronika. |
| `pengingat_logbook` | Halo {{1}}, pengingat dari Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. |
| `pengingat_kuliah` | Halo {{1}}, pengingat jadwal dari Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. |
| `info_dosen` | Yth. {{1}}, informasi dari Sistem Informasi Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. |
| `info_layanan` | Halo {{1}}, pemberitahuan layanan Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. |

Contoh isi variabel untuk formulir pengajuan Meta ada di `helpers/waTemplates.js` (properti `contoh`).

## Mode kirim
- `WA_SEND_MODE=text` (bawaan): mengirim `{ to, text }`. Hanya berhasil dalam jendela 24 jam.
- `WA_SEND_MODE=template`: mengirim `{ to, template: { name, language: "id", params: [nama, judul, keterangan] } }`.
  **Notification API (`POST /internal/messages`) harus diperluas** agar menerima field `template` ini dan
  meneruskannya ke Meta Cloud API (`type: "template"`, `components[body].parameters`). Kode API tersebut
  belum saya lihat, jadi bentuk request di atas adalah kontrak yang diusulkan.
