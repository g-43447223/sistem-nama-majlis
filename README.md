# Sistem Nama Majlis

Sistem paparan nama murid untuk majlis sekolah — seperti konvokesyen universiti.

Murid membawa **kad QR**. Cikgu mengimbas dengan **mesin scanner USB** atau **kamera telefon**.
Nama, kelas, gambar dan background majlis terus terpampang di skrin projektor.

Semua data disimpan di dalam laptop. Sistem ini berjalan pada rangkaian tempatan dan
**tidak memerlukan internet**.

---

## 1. Mula pantas

1. Pasang **Node.js 22.5 atau lebih baru** (https://nodejs.org).
2. Dobel-klik **`mula.bat`**.
3. Pelayar akan terbuka di `http://localhost:3000`.

Atau melalui terminal:

```bash
npm install
npm start
```

Untuk hentikan pelayan: tekan `Ctrl + C` dalam tetingkap terminal, atau tutup tetingkap `mula.bat`.

---

## 2. Enam skrin dalam sistem

| Skrin | Pautan | Kegunaan |
|---|---|---|
| **Utama** | `/` | Pintu masuk dan ringkasan majlis |
| **Paparan** | `/display.html` | Untuk laptop yang disambung ke projektor |
| **Pengimbas** | `/scan.html` | Mengimbas kad **dengan** paparan nama di skrin |
| **Kaunter daftar hadir** | `/scan.html?mod=daftar` | Mengimbas kad **tanpa** paparan — hanya rekod kehadiran |
| **Admin** | `/admin.html` | Urus murid, gambar, kehadiran, tetapan, kad QR |
| **Cetak Kad QR** | `/qr.html` | Halaman cetak kad murid |

Halaman pengimbas mempunyai suis mod di bahagian atas: **Paparan nama** dan
**Daftar hadir sahaja**. Mod dipilih disimpan pada peranti tersebut, jadi kaunter
yang sudah ditetapkan ke mod daftar akan kekal di mod itu apabila dibuka semula.

### Sebelum majlis — daftar hadir di kaunter

1. Di laptop/telefon kaunter, buka **Admin → Kehadiran → Buka Kaunter Daftar Hadir**
   (atau taip `/scan.html?mod=daftar`).
2. Imbas kad QR murid yang tiba. Papan keputusan menunjukkan **DIDAFTAR** dan
   bilangan hadir bertambah — **tiada nama keluar di projektor**.
3. Murid yang sama masih boleh dipaparkan namanya semasa majlis (lihat bawah).

### Semasa majlis

1. Buka **Paparan** di laptop yang disambung ke projektor. Tekan `F11` untuk skrin penuh.
2. Buka **Pengimbas** di peranti yang mempunyai scanner/kamera (mod **Paparan nama**).
3. Imbas kad murid. Nama akan muncul secara automatik di skrin paparan.
4. Setiap murid hanya dipaparkan **sekali semasa majlis**. Imbasan berulang ditolak
   (“sudah dipaparkan pada skrin”), dan imbasan kaunter berulang ditolak
   (“sudah didaftarkan di kaunter”) — kedua-duanya berasingan.

> Satu kad, dua rekod berbeza: **daftar kaunter** (ketibaan) dan **paparan majlis**
> (nama keluar di skrin). Daftar hadir tidak menghalang nama murid dipaparkan kemudian.

---

## 3. Menyediakan data murid

### 3.1 Import CSV

Dalam **Admin → Murid → Import CSV**, tampal atau pilih fail CSV dengan format:

```csv
nama,kelas,kod
Ahmad Zafran bin Ismail,6 AMANAH,
Nur Aisyah binti Rahman,6 AMANAH,
Muhammad Irfan bin Yusof,6 BESTARI,
```

- Lajur `nama` dan `kelas` wajib.
- Lajur `kod` **pilihan**. Jika kosong, sistem menjana kod seperti `NM26-0031`.
- Lajur `foto` juga pilihan (laluan fail dalam `public/uploads/`).

Muat turun templat CSV melalui butang **Muat turun templat**.

### 3.2 Gambar murid

**Satu murid:** klik ikon kamera pada baris murid.

**Pukal:** namakan setiap fail gambar dengan **kod murid**, contoh:

```
NM26-0001.jpg
NM26-0002.jpg
NM26-0003.jpg
```

Kemudian pilih semua fail melalui **Gambar pukal**. Gambar yang namanya tidak sepadan
dengan kod murid akan diabaikan.

Jika tiada gambar, sistem akan menjana avatar berinisial secara automatik.

---

## 4. Cetak kad QR

1. Buka **Admin → Kad QR**.
2. Pilih kelas (atau semua kelas).
3. Tekan **Buka halaman cetak**.
4. Tekan **Cetak** dan pilih:
   - Kertas **A4**
   - Skala **100%**
   - Hidupkan **Background graphics**

Susun atur: **2 lajur × 4 baris = 8 kad setiap halaman**. Setiap kad mengandungi nama,
kelas, kod QR dan nama majlis. Potong ikut garis kad.

> Kod QR mengandungi **kod murid** (contoh `NM26-0001`), bukan URL. Ini bermakna kad
> kekal sah walaupun alamat IP laptop berubah.

---

## 5. Kamera telefon

Kamera pada telefon memerlukan sambungan **HTTPS**. Sistem menyediakan ini secara automatik
pada port **3443**.

1. Pastikan telefon dan laptop berada pada **Wi-Fi yang sama**.
2. Di telefon, buka:

   ```
   https://<IP-laptop>:3443/scan.html
   ```

   Contoh: `https://192.168.0.41:3443/scan.html` — IP sebenar dipaparkan semasa pelayan
   bermula, dan pada halaman utama.
3. Pelayar akan menunjukkan amaran sijil (kerana sijil dijana sendiri). Tekan
   **Advanced → Proceed** / **Teruskan**.
4. Benarkan akses kamera.
5. Halakan kamera ke kod QR murid.

Amaran sijil hanya perlu diterima **sekali** pada setiap telefon.

> Untuk kaunter daftar hadir di telefon, gunakan:
> `https://192.168.0.41:3443/scan.html?mod=daftar`

> Jika kamera tidak dibuka melalui HTTPS, sistem akan memaparkan mesej dan membuka versi
> selamat secara automatik.

### Mesin scanner USB

Kebanyakan scanner barcode bertindak seperti papan kekunci. Cukup buka halaman **Pengimbas**,
letakkan kursor pada medan kod, dan imbas. Kod akan dihantar bersama `Enter`.

---

## 6. Background majlis

1. Buka **Admin → Tetapan**.
2. Di bahagian **Background skrin paparan**, muat naik gambar.
3. Saiz disyorkan: **1920 × 1080 piksel** (landskap), format JPG/PNG.
4. Perubahan terus dihantar ke skrin paparan yang sedang dibuka.

Gunakan gambar yang tidak terlalu terang di bahagian tengah supaya nama murid kekal jelas.
Jika tiada background dimuat naik, sistem menggunakan latar gradien navy-emas.

### 6.1 Logo program (tengah skrin menunggu)

Selepas nama seorang murid habis dipaparkan, skrin akan kembali ke **paparan logo
program**, bukan lagi mesej “Sila imbas kod QR anda”.

1. Buka **Admin → Tetapan → Logo program (tengah skrin menunggu)**.
2. Muat naik logo program (PNG atau WEBP berlatar lutsinar paling cantik).
3. Pilih **Saiz logo di ruang tengah**:

   | Pilihan | Kira-kira saiz pada skrin |
   |---|---|
   | Penuhi ruang tengah (lalai) | 60% tinggi / 86% lebar |
   | Besar | 45% tinggi / 70% lebar |
   | Sederhana | 32% tinggi / 56% lebar |

4. Tekan **Guna emblem lalai** untuk buang logo — paparan akan menggunakan emblem
   bintang sistem (saiz yang sama).

Pilihan saiz serta logo yang dimuat naik dihantar **serta-merta** ke semua skrin
paparan yang terbuka — tidak perlu tekan *Simpan Tetapan* atau muat semula halaman.

**Tips:** pastikan fail logo tidak mempunyai ruang kosong (padding) yang banyak di
sekelilingnya. Logo dengan padding lebar akan nampak kecil walaupun saiz dipilih
“Penuhi ruang tengah”, kerana sistem mengekalkan nisbah asal gambar.

### 6.2 Logo sekolah (penjuru atas kiri)

1. Buka **Admin → Tetapan → Logo sekolah (penjuru atas kiri)**.
2. Muat naik jata/lambang sekolah (PNG atau WEBP berlatar lutsinar disyorkan).
3. Logo menggantikan emblem bintang di penjuru atas kiri, di sebelah nama sekolah,
   dan dihantar serta-merta ke semua skrin paparan.
4. Tekan **Guna emblem lalai** untuk kembali ke emblem bintang.

Kotak logo di penjuru adalah samaada sederhana kecil (48–78 px) supaya bar atas kekal
kemas — guna fail yang nipis ruang kosongnya supaya jelas pada saiz itu.

### 6.3 Mod formal paparan

Secara lalai, **Mod formal paparan** aktif: skrin projektor hanya menunjukkan logo,
nama murid dan maklumat majlis. Yang disembunyikan:

- butang **Aktifkan bunyi**
- tulisan **Menunggu imbasan**
- kiraan **nama menunggu** (giliran)

Untuk mengaktifkan bunyi dalam mod ini, **gerakkan tetikus** (atau tekan kekunci apa
je) pada skrin paparan — butang kendalian muncul kira-kira 4 saat, kemudian hilang
sendiri. Matikan suis *Mod formal paparan* di Admin → Tetapan jika mahu semua kendalian
sentiasa kelihatan (contohnya ketika uji cuba).

> Nota: tulisan **“Sistem Nama Majlis”** di penjuru atas kiri sudah dibuang dari skrin
> paparan — ia nama sistem, bukan nama majlis. Yang tinggal hanya jata/logo sekolah dan
> nama sekolah. Jika anda perlukan baris kecil di bawah nama sekolah (contoh
> “Majlis Rasmi” atau “Kurma 1447”), isinya di **Admin → Tetapan → Teks kecil penjuru**;
> biarkan kosong untuk paparan paling bersih.

> Nota: pelayar hanya membenarkan audio selepas ada tindakan pengguna (klik/kekunci).
> Ini kekangan pelayar, bukan sistem ini.

---

## 7. Tetapan lain

| Tetapan | Kesan |
|---|---|
| Tajuk majlis | Dipaparkan di bar atas skrin paparan dan pada kad QR |
| Subtajuk / sesi | Teks kecil di bawah tajuk |
| Nama sekolah | Dipaparkan di penjuru kiri atas |
| Teks kecil penjuru | Baris kecil di bawah nama sekolah. **Kosong secara lalai** — tulisan “Sistem Nama Majlis” sudah dibuang kerana tidak sesuai untuk majlis formal |
| Tempoh paparan | Berapa lama setiap nama kekal di skrin (3–30 saat) |
| Bunyi sambutan | Bunyi lembut apabila nama muncul |
| Papar kiraan kehadiran | Tunjuk/sembunyi kiraan hadir di bawah skrin |
| Logo program | Lambang di tengah skrin semasa menunggu imbasan (lihat 6.1) |
| Saiz logo program | Sederhana / Besar / Penuhi ruang tengah — serta-merta |
| Logo sekolah | Lambang kecil di penjuru atas kiri (lihat 6.2) |
| Mod formal paparan | Sembunyi butang bunyi, “menunggu imbasan” & kiraan giliran (lihat 6.3) |

Tetapan bunyi perlu diaktifkan sekali pada skrin paparan dengan menekan butang
**Aktifkan bunyi** (kekangan pelayar). Dalam mod formal, gerakkan tetikus untuk
memaparkan butang itu sebentar.

---

## 8. Kehadiran (dua peringkat)

Kad QR yang sama digunakan untuk dua perkara berasingan:

| Peringkat | Cara | Kesan pada skrin |
|---|---|---|
| **Daftar di kaunter** | `/scan.html?mod=daftar` (Admin → Kehadiran → *Buka Kaunter Daftar Hadir*) | Tiada — hanya rekod & kiraan |
| **Imbasan majlis** | `/scan.html` (mod *Paparan nama*) | Nama murid terpapar |

- **Admin → Kehadiran** memaparkan dua lajur: *Daftar kaunter* dan *Dipaparkan*,
  berserta ringkasan **Daftar di kaunter**, **Dipaparkan**, **Belum diimbas** dan
  **Peratus hadir**.
- Penapis: *Belum diimbas langsung* (untuk mencari murid yang belum tiba),
  *Daftar kaunter sahaja (belum dipaparkan)*, dan *Sudah dipaparkan*.
- Imbasan berulang ditolak ikut peringkat — murid yang sudah daftar di kaunter
  **masih boleh** dipaparkan namanya semasa majlis, dan sebaliknya.
- **Muat turun CSV** menyertakan kedua-dua peringkat:
  `Bil, Nama, Kelas, Kod, Status, Daftar hadir, Sumber daftar, Dipaparkan, Sumber papar`.
- **Kosongkan Rekod** memadam kedua-dua peringkat (guna selepas sesi latihan).

---

## 9. Data & sandaran

| Perkara | Lokasi |
|---|---|
| Pangkalan data | `data/majlis.db` |
| Gambar murid, background, logo program & logo sekolah | `public/uploads/` |
| Sijil HTTPS | `data/certs/` |

Untuk sandaran, salin folder **`data`** dan **`public/uploads`**.

Untuk pindah ke komputer lain: salin keseluruhan folder projek (kecuali `node_modules`),
kemudian jalankan `npm install` dan `mula.bat`.

---

## 10. Masalah lazim

**Port 3000 sudah digunakan**

```bash
set PORT=3001
npm start
```

Atau tutup aplikasi lain yang menggunakan port tersebut.

**Telefon tidak dapat membuka halaman**

- Pastikan telefon dan laptop pada Wi-Fi yang sama.
- Benarkan Node.js melalui Windows Firewall (klik **Allow access** pada amaran pertama).
- Sesetengah Wi-Fi sekolah mengasingkan peranti (AP isolation). Jika ini berlaku, gunakan
  hotspot telefon atau minta admin rangkaian benarkan komunikasi antara peranti.

**Kamera telefon tidak dibuka**

- Pastikan anda membuka pautan **https://** (port 3443), bukan http.
- Terima amaran sijil terlebih dahulu.
- Benarkan kebenaran kamera pada pelayar.

**Nama tidak muncul di skrin paparan**

- Periksa mod pada halaman pengimbas — jika suis berada pada **Daftar hadir sahaja**,
  imbasan memang tidak akan memaparkan nama. Tukar kepada **Paparan nama**.
- Pastikan tab **Paparan** dibuka dan tidak tidur.
- Pastikan kedua-dua peranti menggunakan pelayan yang sama.
- Muat semula (refresh) halaman paparan — sambungan akan dipulihkan automatik.

**Butang “Aktifkan bunyi” tiada pada skrin paparan**

- Mod formal sedang aktif. Gerakkan tetikus atau tekan kekunci pada skrin paparan;
  butang itu muncul kira-kira 4 saat. Matikan *Mod formal paparan* di Admin → Tetapan
  jika mahu ia sentiasa kelihatan.

**Pelayan tergantung / halaman lambat dimuat**

- Setiap tab (paparan, pengimbas, admin) menyimpan satu sambungan langsung, dan pelayar
  hanya membenarkan sekitar **6 sambungan** ke pelayan yang sama.
- Elakkan membuka lebih 4 tab pada komputer yang sama; buka admin/pengimbas pada peranti
  berasingan, dan tutup tab ujian yang tidak diperlukan.

**IP laptop berubah**

Sijil HTTPS akan dijana semula secara automatik apabila IP berubah. Pautan pada halaman
utama juga akan dikemas kini. Kad QR tidak terjejas kerana ia menyimpan kod murid, bukan URL.

---

## 11. Struktur projek

```
sistem nama majlis/
├─ server.js            Pelayan Express + SSE + HTTPS
├─ db.js                Pangkalan data SQLite + data contoh
├─ package.json
├─ mula.bat             Pelancar Windows
├─ data/                Pangkalan data & sijil (dijana automatik)
├─ public/
│  ├─ index.html        Halaman utama
│  ├─ display.html      Skrin paparan
│  ├─ scan.html         Skrin pengimbas
│  ├─ admin.html        Panel admin
│  ├─ qr.html           Halaman cetak kad
│  ├─ css/
│  ├─ js/
│  ├─ vendor/jsQR.js    Pengimbas QR untuk kamera
│  └─ uploads/          Gambar murid, background, logo program & logo sekolah
└─ node_modules/
```

---

## 12. Nota teknikal

- **Node.js + Express** untuk pelayan.
- **SQLite** (`node:sqlite`) untuk data — tiada pemasangan pangkalan data berasingan.
- **Server-Sent Events (SSE)** untuk menghantar nama ke skrin paparan serta-merta.
- **qrcode** untuk menjana kod QR.
- **BarcodeDetector API** (Chrome/Edge Android) dengan fallback **jsQR** (iOS Safari, pelayar lain).
- **HTTPS sijil sendiri** pada port 3443 untuk akses kamera melalui LAN.
- Semua aset (CSS, JS, font sistem) disimpan setempat — tiada CDN, berfungsi tanpa internet.
- **Kehadiran dua peringkat:** satu baris `attendance` per murid dengan dua set lajur —
  `daftar_at` / `daftar_source` (kaunter) dan `papar_at` / `papar_source` (majlis).
  Penghijrahan dijalankan automatik semasa pelayan bermula; rekod lama dianggap
  sudah dipaparkan.
- **Mod imbasan** dihantar sebagai `mod` (`papar` atau `daftar`) ke `POST /api/scan`;
  hanya mod `papar` menghasilkan peristiwa SSE `reveal`.
- Statistik menyertakan `hadir`, `daftar`, `dipapar` dan pecahan per kelas untuk
  ketiga-tiganya.

---

## 13. Naik ke hosting (boleh digunakan dari mana-mana)

Sistem ini boleh dijalankan pada pelayan internet, bukan hanya laptop. GitHub hanya
menyimpan kod — untuk online, perlukan pelayan yang menjalankan Node secara berterusan.
Repo ini sudah disertakan `Dockerfile` dan `render.yaml` untuk tujuan itu.

### Langkah di Render (paling mudah)

1. Push kod ke GitHub (repo ini sudah dibuat: `g-43447223/sistem-nama-majlis`).
2. Di [render.com](https://render.com) → **New + → Blueprint** → pilih repo.
3. Render akan membaca `render.yaml` dan mencipta servis Docker + **volum kekal `/data`**.
4. Isi dua `Environment Key`:
   - `MAJLIS_KUNCI` — kata laluan sistem (**wajib**, jika tidak sesiapa boleh ubah data)
   - `PUBLIC_URL` — contoh `https://sistem-nama-majlis.onrender.com`
5. Deploy. Buka `https://<domain>/admin.html`, masukkan kunci, muat naik senarai murid,
   dan gunakan `https://<domain>/scan.html?kunci=<kunci>` pada telefon kaunter/pengimbas.
6. Guna pelan **Starter ke atas** — pelan percuma tidak menyokong volum dan akan
   “tidur” (putus sambungan SSE ketika majlis berlangsung).

Alternatif lain: Railway, Fly.io, atau VPS (Node 24 + Nginx sebagai TLS). Mana-mana
platform yang boleh menjalankan Node 24 dan mempunyai storan kekal adalah memadai.

### Pemboleh ubah sekitar

| Pemboleh ubah | Lalai | Kegunaan |
|---|---|---|
| `PORT` | `3000` | Port pelayan (platform biasanya tetapkan) |
| `HTTPS_PORT` | `3443` | Port sijil sendiri untuk kamera LAN; `0` untuk matikan |
| `DATA_DIR` | `data/` | Lokasi `majlis.db` — **mesti pada volum kekal** |
| `UPLOAD_DIR` | `public/uploads` | Gambar murid, background, logo |
| `PUBLIC_URL` | — | Alamat awam penuh (dipakai untuk pautan & QR pada halaman utama) |
| `MAJLIS_KUNCI` | — | Kunci majlis; kosong = mod lokal tanpa kawalan |
| `AWAN` | auto | `1` untuk mod hosting (langgar sijil sendiri, pautan ikut header permintaan) |

### Apa yang dilindungi oleh `MAJLIS_KUNCI`

Terlindung: menambah/sunting/memadam murid, import CSV, muat naik gambar & logo,
mengubah tetapan, mod demo, memadam rekod kehadiran, senarai penuh murid, dan gambar
kad QR.

Terbuka (supaya majlis berjalan lancar): halaman paparan, sambungan langsung paparan,
`/api/health`, dan avatar janaan. **Imbasan kad memerlukan kunci** — sebab itu
pautan kaunter sebaiknya dihantar sebagai `?kunci=...`.

Kunci disimpan dalam pelayar peranti tersebut (dan sebagai cookie selepas dimasukkan),
jadi setiap telefon/laptop hanya perlu sekali. Gunakan pautan:

```
https://<domain>/scan.html?kunci=<MAJLIS_KUNCI>          # mod paparan nama
https://<domain>/scan.html?mod=daftar&kunci=<MAJLIS_KUNCI>  # mod kaunter
```

### Pertimbangan sebelum online

- **Ketersediaan:** jika internet sekolah putus, majlis berhenti mengimbas. Laptop
  sebagai pelayan (mod LAN) tidak bergantung pada internet — inilah sebab utama
  sistem ini dibina untuk rangkaian tempatan.
- **Privasi data murid:** menyimpan nama + gambar murid pada pelayan awam biasanya
  memerlukan kelulusan pentadbir sekolah/JPN. Jika dibenarkan, pastikan `MAJLIS_KUNCI`
  kuat, domain HTTPS, dan buat sandaran `data/` secara berkala.
- **Peranti banyak:** setiap pelayar had ~6 sambungan ke satu domain; satu pelayan
  hosting mampu melayani banyak perangkat berasingan.

### Repositori GitHub

```bash
git init -b main
git add .
git commit -m "Sistem Nama Majlis"
gh repo create sistem-nama-majlis --public --source=. --remote=origin --push
```

`data/`, `public/uploads/`, `node_modules/` dan `*.pem` sentiasa dikecualikan oleh
`.gitignore` — gambar murid, pangkalan data dan kunci HTTPS tidak akan naik ke GitHub.
