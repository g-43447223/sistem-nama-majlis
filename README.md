# Sistem Nama Majlis

Sistem paparan nama murid untuk majlis sekolah — seperti konvokesyen universiti.

Murid membawa **kad QR**. Cikgu mengimbas dengan **mesin scanner USB** atau **kamera telefon**.
Nama, kelas, gambar dan background majlis terus terpampang di skrin projektor.

Semua data disimpan di dalam laptop. Sistem ini berjalan pada rangkaian tempatan dan
**tidak memerlukan internet**.

---

## 1. Mula pantas

**Pilihan A — laptop jadi pelayan (paling senang, tiada internet diperlukan)**

1. Pasang **Node.js 22.5 atau lebih baru** (https://nodejs.org) — sekali sahaja.
2. Dobel-klik **`mula.bat`**.
3. Pelayar terbuka di `http://localhost` (port **80**, jadi tiada nombor port perlu ditaip;
   kamera telefon di `https://<IP-laptop>` pada port 443).
4. Pada halaman itu ada **kod QR** — telefon pada Wi-Fi yang sama terus membuka
   halaman pengimbas dengan sekali imbas QR, tanpa menaip.

**Pilihan B — satu arahan, dapat pautan internet untuk semua perangkat**

1. Dobel-klik **`pautan-online.bat`** (atau `npm run online`) — perlukan internet + `cloudflared`.
2. Tetingkap memaparkan pautan seperti `https://xxxx.trycloudflare.com/display.html`
   dan **kunci majlis**. Kunci dijana sekali lalu disimpan dalam **`kunci.txt`**, jadi
   ia kekal sama setiap kali anda mulakan semula.
3. Semua pautan turut ditulis ke **`pautan-online.txt`** — cetak atau lekat di meja kaunter.
4. **Admin → Kehadiran → “Pautan kaunter untuk perangkat lain”** memaparkan **kod QR**:
   cikgu imbas sahaja dengan kamera telefon, terus masuk halaman daftar hadir
   (kunci sudah ditampal automatik pada pautan itu).
5. Jika terowong terputus tengah majlis, `online.js` membuka semula automatik dan
   mencetak **PAUTAN BARU** (kunci tetap sama). Pautan tunnel boleh berubah bila
   ia dibuka semula — itu sebabnya guna QR dari panel Admin, jangan tulis tangan.
6. Projektor melalui pautan internet akan menerima nama dalam **~1–3 saat**
   (lihat nota teknikal tentang hampiran `/api/papan`); pada LAN/`hotspot` lebih kurang **50 ms**.

**Pilihan C — hosting tetap** (Render/Railway/Fly/VPS): lihat **13. Naik ke hosting**.
URL kekal, HTTPS asli, tiada tetingkap terminal perlu dibiarkan terbuka.

Atau melalui terminal:

```bash
npm install
npm start          # LAN, port 80
npm run online     # LAN + pautan internet melalui cloudflared
```

Untuk hentikan pelayan: tekan `Ctrl + C` dalam tetingkap terminal, atau tutup
tetingkap `mula.bat` / `pautan-online.bat`.

> **URL GitHub bukan untuk dibuka oleh perangkat** — ia hanya gudang kod.
> Yang digunakan telefon/laptop ialah pautan Pilihan A, B atau C di atas.
> GitHub berguna untuk simpan/berkongsi kod, atau untuk `git clone` ke laptop ganti.

---

## 2. Skrin-skrin dalam sistem

| Skrin | Pautan | Kegunaan |
|---|---|---|
| **Utama** | `/` | Pintu masuk, ringkasan majlis & QR pautan pengimbas |
| **Paparan** | `/display.html` | Untuk laptop yang disambung ke projektor |
| **Pengimbas** | `/scan.html` | Mengimbas kad **dengan** paparan nama di skrin |
| **Kaunter daftar hadir** | `/scan.html?mod=daftar` | Mengimbas kad **tanpa** paparan — hanya rekod kehadiran |
| **Admin** | `/admin.html` | Urus murid (+ anugerah), kehadiran, tetapan, kad QR |
| **Senarai MC** | `/admin.html#mc` | Nama & anugerah untuk pengacara majlis, boleh cetak/PDF |
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

Susun atur paparan nama: **gambar murid besar di kiri** (bingkai potret 4:5, emas),
**butiran di kanan** — `TAHNIAH`, nama penuh (2–3 baris, saiz automatik ikut panjang nama),
garis emas, dan badge kelas. Gambar masuk dari kiri, teks masuk dari kanan.

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

**Import dari folder (paling mudah untuk senarai besar).** Salin folder gambar ke dalam
folder sistem ini, kemudian buka **Admin → Murid → Folder gambar**:

1. Taip nama folder, contoh `GAMBAR & NAMA IBNU SINA`.
2. Kelas dikesan sendiri daripada nama folder (boleh pilih manual jika perlu).
3. Tekan **Semak sahaja** — laporan menunjukkan setiap fail dipadankan dengan murid siapa,
   mana yang namanya hampir dieja, dan murid mana yang belum dapat gambar.
4. Tekan **Import gambar** untuk menyalin masuk. Gambar disimpan dalam `public/uploads/`
   dengan nama kod murid (contoh `SKPIPRA002.jpg`).

Nama fail boleh ikut pola:

```
IS 1 - MUHAMMAD TASHRIQ.jpg
IK - 1 MUHAMMAD FARIZ BIN KHAIRUL.jpg
IQ 1-MUHAMMAD AFEEF HAZIQ BIN NASRI.jpg
```

Sistem memadankan **perkataan nama dalam nama fail** dengan nama murid dalam kelas yang
sama. Ejaan sedikit berbeza (contoh `MUHAMAD` vs `MUHAMMAD`) masih dipadankan tetapi
disenaraikan sebagai "ejaan hampir" supaya anda boleh semak. Fail yang tidak padan tidak
mengusik apa-apa.

**Pukal ikut kod (cara lama):** namakan setiap fail gambar dengan **kod murid**, contoh:

```
NM26-0001.jpg
NM26-0002.jpg
NM26-0003.jpg
```

Kemudian pilih semua fail melalui **Gambar pukal**. Gambar yang namanya tidak sepadan
dengan kod murid akan diabaikan.

Jika tiada gambar, sistem akan menjana avatar berinisial secara automatik.

**Saiz gambar.** Gambar murid dikecilkan sendiri kepada sisi panjang ≤1000 px, JPEG
kualiti 85 apabila anda import/muat naik — menjimatkan ruang & memaparkan gambar lebih
laju pada skrin projektor. Logo, crest & background **tidak** diusik. Kalau anda
kumpul banyak gambar besar dari telefon (bermegah satu), boleh kempakan sekali jalan:

```
node tools/kempa-gambar.js --semak    lihat anggaran jimat (tiada perubahan)
node tools/kempa-gambar.js            kempa semua gambar murid sedia ada
```

Muat naik gambar melalui pelayar (butang *Gambar pukal* / satu gambar) hadnya **10 MB
satu fail**; gambar lebih besar akan ditolak. Import dari folder tiada had saiz tetapi
tetap dikempakan.

---

## 4. Cetak kad QR

1. Buka **Admin → Kad QR**.
2. Pilih kelas (atau semua kelas).
3. Tekan **Buka halaman cetak**.
4. Tekan **Cetak** dan pilih:
   - Kertas **A4**
   - Skala **100%**
   - Hidupkan **Background graphics**

Susun atur: **2 lajur × 4 baris = 8 kad setiap halaman**. Setiap kad mengandungi nama sekolah,
nama majlis, kod QR (26 × 26 mm), nama penuh murid, kelas, dan kod unik. Potong ikut garis kad.

### 4.1 Nama panjang & teks terpotong

Kad akan **menyesuaikan saiz tulisan sendiri** (`qr.js` → `muatSemuaKad`):

- Nama panjang dikecilkan dari 10.5pt sehingga 6.4pt selagi perlu (berlapis, tanpa elipsis) supaya
  **kesemua nama terbit penuh**.
- Baris nama dibenarkan hingga 3 baris; jika masih tidak muat, kad itu **membesar**
  (kelas `.longgar`) dan operator diberi notifikasi — supaya tiada teks hilang.
- Nama sekolah & tajuk majlis kini boleh membalut 2 baris (dahulunya `nowrap` + “…”, jadi
  “Sekolah Kebangsaan Pulau Indah” kelihatan terpotong).
- Kod QR diperkecil 30 mm → **26 mm** untuk memberi ruang kepada nama; pada 26 mm saiz modul
  masih ~1 mm, sangat mudah diimbas kamera telefon/mesin scanner.
- Pengiraan saiz dijalankan apabila halaman dibuka, bila kelas ditukar, bila tetingkap
  berubah saiz, dan **sebelum dicetak** (butang Cetak menjalankannya dahulu).

Diuji pada 373 kad sebenar: **0 kad terpotong**, proses muat-ikut-saiz ambil **1 ms**;
nama 96 aksara masih muat (8pt, 3 baris) dalam kad 60 mm.

> Kod QR mengandungi **kod murid** (contoh `NM26-0001`), bukan URL. Ini bermakna kad
> kekal sah walaupun alamat IP laptop berubah.

---

### 4.2 Anugerah murid

Setiap murid boleh dipasangkan **satu anugerah utama** (medan pilihan `anugerah`).

### Isi anugerah

| Cara | Sesuai untuk |
|---|---|
| **Admin → Murid → Sunting → Anugerah** (ada autofill daripada nilai sedia ada) | beberapa orang / pembetulan |
| **Import CSV** dengan lajur `anugerah` | satu pengisian penuh |
| **Import CSV `kod,anugerah` + kotak “Kemas kini ikut kod”** | isi anugerah beramai-ramai **tanpa** mengusik nama/kelas/gambar |

Contoh CSV kemas kini:

```csv
kod,anugerah
SKPID6001,ANUGERAH PELAJAR CEMERLANG
SKPID6002,ANUGERAH KEPEMIMPINAN
```

- Nilai disimpan **seperti yang ditaip** (semua huruf besar pun cantik pada plat emas).
- Had **90 aksara**; baris baharu & ruang berganda dibersihkan automatik.
- Sunting nama/kelas **tidak** memadam anugerah (kekal melainkan anda kosongkan medan itu).
- `Admin → Murid` ada lajur **Anugerah**, penapis, dan **chip kiraan** termasuk
  *Belum ada anugerah* — paling guna waktu rehearsal untuk cari nama yang tertinggal.
  Klik chip → senarai ditapis serta-merta.

### Pada skrin projektor

Plat emas muncul **di bawah nama** (nama → garis → anugerah → kelas), dengan ikon pingat.

- 3 tier saiz automatik: ≤28 aksara (penuh), 29–46 (`a-sederhana`), >46 (`a-panjang`),
  dan teks sentiasa membalut kemas dalam lajur (tidak keluar dari plat).
- Murid **tanpa** anugerah → paparan sama sepenuhnya seperti dulu (tiada ruang terbiar).
- **Admin → Tetapan → “Papar anugerah pada skrin”** untuk matikan sementara ketika sesi
  yang tiada penyampaian anugerah — data tidak dipadam, dan skrin yang sedang tayang
  berubah serta-merta.

### Senarai MC (pengacara majlis)

**Admin → Senarai MC**: nama + anugerah disusun ikut kelas (atau ikut anugerah), dengan
penapis kelas/anugerah, carian, dan suis *Hanya ada anugerah* (lalai ON).

- `Cetak / Simpan PDF` → halaman A4 bersih, patah halaman ikut kelas.
- `Muat turun CSV` → `/api/mc.csv` (Bil, Kelas, Nama, Kod, Anugerah).
- Kiraan serta-merta ikut senarai anugerah, jadi “siapa belum dapat anugerah” mudah dilihat.

### Eksport

`attendance.csv` kini menyertakan lajur **Anugerah**:
`Bil, Nama, Kelas, Kod, Anugerah, Status, Daftar hadir, Sumber daftar, Dipaparkan, Sumber papar`.
Cermin Google Sheets tidak berubah (kekal lajur kehadiran) — anugerah boleh dibaca dari CSV.

## 5. Kamera telefon

Kamera pada telefon memerlukan sambungan **HTTPS**. Sistem menyediakan ini secara automatik
pada port **443** (port 3443 jika `HTTPS_PORT` diubah atau port 443 occupied).

**Cara paling senang (tanpa menaip):** buka halaman utama di laptop projektor,
biarkan telefon mengimbas **kod QR** yang dipaparkan di situ — telefon terus membuka
halaman pengimbas.

Jika perlu menaip:

1. Pastikan telefon dan laptop berada pada **Wi-Fi yang sama**.
2. Di telefon, buka:

   ```
   https://<IP-laptop>/scan.html
   ```

   Contoh: `https://192.168.0.41/scan.html` — IP sebenar dipaparkan semasa pelayan
   bermula, dan pada halaman utama.
3. Pelayar akan menunjukkan amaran sijil (kerana sijil dijana sendiri). Tekan
   **Advanced → Proceed** / **Teruskan**.
4. Benarkan akses kamera.
5. Halakan kamera ke kod QR murid.

Amaran sijil hanya perlu diterima **sekali** pada setiap telefon.

> Untuk kaunter daftar hadir di telefon, gunakan:
> `https://<IP-laptop>/scan.html?mod=daftar` (tambah `&kunci=<kunci>` jika sistem
> berjalan dengan `MAJLIS_KUNCI`, contohnya dalam mod online)

> Jika kamera tidak dibuka melalui HTTPS, sistem akan memaparkan mesej dan membuka versi
> selamat secara automatik.

### Mesin scanner USB

Kebanyakan scanner barcode bertindak seperti papan kekunci. Cukup buka halaman **Pengimbas**,
letakkan kursor pada medan kod, dan imbas. Kod akan dihantar bersama `Enter`.

### 5.1 Langkah penuh — setiap perangkat guna Wi-Fi / data sendiri (4G)

Gunakan ini bila kawasan sekolah luas dan perangkat **tidak** berada pada Wi-Fi yang sama.

**A. Di laptop yang jadi pelayan (1 laptop sahaja)**

1. Pastikan laptop itu ada internet (Wi-Fi sekolah, atau tethering/USB dari telefon).
2. Dobel-klik **`pautan-online.bat`**.
3. Tunggu sehingga keluar blok **`PAUTAN ONLINE SIAP`** (lebih kurang 10 saat).
4. Jangan tutup tetingkap itu sepanjang majlis.

**B. Di laptop projektor**

5. Buka pautan **Paparan (projektor)** yang dicetak di tetingkap itu, contoh:
   `https://xxxx-yyyy-zzzz.trycloudflare.com/display.html`
6. Tekan **F11** (skrin penuh). Skrin akan memaparkan logo program + `SELAMAT DATANG`.

**C. Di telefon cikgu kaunter (berbilang telefon boleh serentak)**

7. Buka pautan **Kaunter daftar hadir** (sudah mengandungi `&kunci=`):
   `https://xxxx-yyyy-zzzz.trycloudflare.com/scan.html?mod=daftar&kunci=<kunci>`
   — atau lebih senang: di laptop, buka **Admin → Kehadiran**, masukkan kunci,
   dan biarkan telefon mengimbas **kod QR** yang dipaparkan di situ.
8. Dalam halaman itu tekan **Buka kamera fon**, kemudian **Benarkan (Allow)** akses kamera.
9. Imbas kad murid satu persatu. Papan keputusan menunjukkan **DIDAFTAR** dan
   kiraan hadir bertambah — **nama tidak keluar di projektor**.

**D. Semasa majlis (nama perlu keluar di skrin)**

10. Pada peranti yang mengimbas untuk majlis, buka pautan **Pengimbas majlis**
    (atau tukar suis di bahagian atas halaman pengimbas kepada **Paparan nama**).
11. Imbas kad yang sama → nama murid terpapar di projektor (lewat sedikit melalui
    internet, lebih kurang 1–3 saat; pada LAN dalam ~0.05 saat).

**E. Selepas majlis**

12. **Admin → Kehadiran → Muat turun CSV** (lajur *Daftar kaunter* & *Dipaparkan*),
    atau **Hantar ke Sheets** jika cermin Google Sheets sudah dipasang.

**Kalau pautan tidak dibuka / nama tidak keluar**

- Pastikan tetingkap `pautan-online.bat` masih terbuka, dan laptop itu masih ada internet.
- Teringat: pautan **bertukar** apabila terowong dimulakan semula — ambil pautan/QR
  terkini dari tetingkap itu atau dari fail **`pautan-online.txt`**.
- Kunci majlis tersimpan dalam **`kunci.txt`** (kekal antara mulakan).
- Telefon yang pernah memasukkan kunci tidak perlu menaip lagi; jika ditolak, buka
  `.../admin.html` atau pautan ber`&kunci=` sekali sahaja.
- Satu laptop hanya layak ~6 tab pelayan (had pelayar); sebarkan perangkat ke
  beberapa laptop/telefon, bukan banyak tab pada satu mesin.

### 5.2 Pilih cara ikut jarak — LAN / hotspot / 4G / hosting

Pilih mengikut jarak & kemudahan rangkaian:

| Keadaan | Cara | Pautan yang dibuka |
|---|---|---|
| Semua dalam julat Wi-Fi sekolah yang sama | **LAN** (`mula.bat`) | `http://<IP-laptop>/scan.html?mod=daftar` |
| Kaunter jauh, Wi-Fi sekolah tak sampai / **AP isolation** | **Hotspot Windows** pada laptop | `http://192.168.137.1/scan.html?mod=daftar` |
| Kawasan luas, perangkat guna **4G/Maxis sendiri** | **`pautan-online.bat`** | `https://xxxx.trycloudflare.com/scan.html?mod=daftar&kunci=<kunci>` |
| Nak URL tetap sepanjang tahun | **Hosting** (Render/Railway/VPS) | `https://nama-anda.onrender.com/scan.html?mod=daftar` |

Uji hotspot: **Settings → Network & internet → Mobile hotspot → On**, kemudian
`ipconfig | findstr 192.168.137` di laptop. Kalau keluar `192.168.137.1`, semua perangkat
yang join hotspot itu boleh buka `http://192.168.137.1/scan.html?mod=daftar`
(tanpa internet langsung, jarak lebih kurang 15–30 m).

> **Privasi:** dalam mod online, senarai murid hanya boleh dibaca oleh pihak yang
> memegang `MAJLIS_KUNCI`. Pastikan pautan Admin tidak disebarkan ke khalayak —
> yang diedarkan ke kaunter ialah pautan **pengimbas/daftar hadir** sahaja
> (QR di panel Admin sudah mengandungi kunci). Untuk data pelajar sebenar,ikut
> kelulusan pentadbiran sekolah/JPN sebelum mana-mana perkhidmatan awam digunakan.

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

### 6.4 Dua suis Kawalan Paparan (tempo masa nama)

Di **Admin → Tetapan** ada dua suis. Keduanya boleh ditukar **semasa majlis sedang
berjalan** — perubahan sampai serta-merta ke semua skrin, tanpa perlu tekan
*Simpan Tetapan* atau muat semula.

**1. Tukar serta-merta** (hidup secara lalai)

- Imbasan baharu **terus menggantikan** nama yang sedang dipaparkan.
- Kalau dimatikan, kelakuan lama digunakan: nama beratur dan keluar ikut tempoh paparan.
- Ada pelindung selama 0.9 saat supaya skrin tidak berkelip bila mesin pengimbas
  menghantar dua kod serentak. Dalam tempoh itu, hanya nama **terakhir** yang akan keluar.

**2. Kekal sampai imbasan seterusnya** (mati secara lalai)

- Nama murid **tidak hilang sendiri**. Ia kekal di skrin selama murid itu berada di pentas,
  dan bertukar sendiri sebaik kad murid seterusnya diimbas.
- Apabila suis ini hidup, nilai **Tempoh paparan diabaikan**.
- Untuk kembali ke logo program: tekan butang **Papar Logo Majlis** di
  **Admin → Mod Demo**, atau tekan **Esc** / **Space** pada komputer projektor.

Cara saya syorkan untuk hari majlis:

| Segmen | Suis yang hidup |
|---|---|
| Penyampaian anugerah satu per satu | Tukar serta-merta ✓ · Kekal ✓ |
| Paparan beramai-ramai (contoh: senarai nama kelas ditayang berturut-turut) | Tukar serta-merta ✗ · Kekal ✗ (pakai tempoh 5–10 saat) |

Skrin yang dibuka melalui pautan internet (mod terowong) juga menerima pertukaran yang
sama, walaupun ia menggunakan kaedah bertanya-berkala sebagai jalan sokongan.

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
| Anugerah murid | Satu anugerah utama per murid; plat emas di bawah nama (lihat 4.2) |
| Papar anugerah pada skrin | Hidup/matikan plat anugerah tanpa memadam data (lihat 4.2) |
| Tukar serta-merta | Imbasan baharu terus menggantikan nama yang sedang tersenarai (lihat 6.4) |
| Kekal sampai imbasan seterusnya | Nama tidak hilang sendiri; tempoh paparan diabaikan (lihat 6.4) |
| Mod formal paparan | Sembunyi butang bunyi, “menunggu imbasan” & kiraan giliran (lihat 6.3) |
| Cermin Google Sheets | Hantar kehadiran ke Sheet secara automatik (lihat 8.1) |

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
- **Kosongkan Rekod** memadam kedua-dua peringkat (daftar + papar) dalam **laptop** —
  inilah yang dibuat **selepas sesi latihan**, supaya semua kad boleh dipaparkan semula.
  Skrin projektor pada semua perangkat terus kosong (peristiwa `reset` dihantar automatik).
- Reset **seorang murid** juga boleh: di jadual Kehadiran ada lajur **Tindakan** →
  tekan ikon **pusing-balik (reset)** pada baris murid itu sahaja. Berguna kalau kad
  tersalah imbas, atau murid sudah imbas tetapi namanya belum sempat keluar.
- Google Sheet **tidak** ikut kosong. Untuk itu tekan **Kosongkan Google Sheets**
  (memadam semua baris data dalam sheet, baris tajuk dikekalkan; rekod laptop tidak diusik).
- Cadangan selepas latihan: **Kosongkan Rekod** → **Kosongkan Google Sheets** (jika guna
  cermin) → imbas satu kad ujian untuk pastikan nama keluar semula → **Kosongkan Rekod** sekali
  lagi sebelum majlis benar-benar bermula.

#### 8.1 API reset (untuk kegunaan pantas)

| Tindakan | Cara |
|---|---|
| Kosongkan semua rekod | Admin → Kehadiran → **Kosongkan Rekod** (`DELETE /api/attendance`) |
| Reset seorang murid | butang reset pada baris murid (`DELETE /api/attendance/:id`) |
| Skrin kembali ke logo | Admin → Mod Demo → **Papar Logo Majlis** (`POST /api/display/logo`) atau Esc / Space pada komputer projektor |
| Kosongkan Google Sheets | Admin → Kehadiran → **Kosongkan Google Sheets** (`POST /api/sheets/kosongkan`) |
| Semak sebelum reset | penapis *Sudah dipaparkan* / *Daftar kaunter sahaja* di jadual Kehadiran |

---

### 8.2 Cermin Google Sheets (pilihan)

Kehadiran boleh dihantar **automatik** ke fail Google Sheet — sesuai jika pejabat
perlukan rekod hidup, tetapi sistem tetap berjalan pada laptop (tiada internet
pun majlis tak terbantut).

### Sediakan Apps Script ( sekali sahaja )

1. Buka fail Google Sheet → **Extensions → Apps Script**.
2. Padam kod sedia ada, tampal keseluruhan fail **`google-apps-script.gs`** dari repo ini.
3. (Disyorkan) **File → Project Properties → Script Properties** → tambah kunci
   `KUNCI` dengan nilai rahsia anda, contoh `RAPI2026`.
4. **Deploy → New deployment → Web app**, dengan:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
5. Salin URL yang berakhir `/exec`.

### Hubungkan dari sistem

1. **Admin → Tetapan → Cermin Google Sheets (pilihan)**.
2. Tampal URL `/exec` (+ kunci rahsia jika anda set `KUNCI`).
3. Tekan **Uji Sambungan** — status akan memaparkan “Sambungan OK”.
4. Kekangkan **Hantar automatik selepas tiap imbasan** (lalai: aktif).
5. **Hantar Semua Sekarang** untuk muat naik balik semua rekod (pendua ditapis
   oleh Apps Script, jadi ia selamat ditekan berkali-kali).
6. Di **Admin → Kehadiran** ada butang **Hantar ke Sheets** dengan kiraan rekod
   yang masih tertunggak.

### Cara ia bekerja (dan sebab ia selamat)

- Setiap imbasan disimpan dalam pangkalan data tempatan **dahulu**, kemudian
  dimasukkan ke baris gilir `sheets_queue` dan dihantar ke Google dalam latar belakang.
- Jika internet putus / Sheet belum boleh dicapai: **paparan nama tidak terjejas**.
  Rekod kekal dalam baris gilir dan dicuba semula setiap ~25 saat (dan apabila
  butang “Hantar” ditekan). Selepas 12 kali gagal, rekod itu dibuang daripada giliran
  supaya baris gilir tidak membesar — tetapi rekod kehadiran tetap ada dalam sistem.
- Hantaran ditapis mengikut `Kod + Peringkat + Masa Imbas`, jadi pengulangan tidak
  melahirkan baris berganda dalam Sheet.
- Sheet akan dicipta sendiri atas nama **Kehadiran** dengan lajur:
  `Rekod Pada | Kod | Nama | Kelas | Peringkat | Sumber | Masa Imbas | Kiriman`.
- Had kuota Google Sheets (300 baca + 300 tulis/min per projek; 60/min per pengguna)
  bukan masalah di sini kerana hanya **satu** pelayan yang menghantar, dan hanya
  satu hantaran bagi setiap sekumpulan imbasan.

> **Google Sheets bukan enjin masa-nyata.** Jangan buang SQLite untuk paparan:
> nama murid perlu muncul serta-merta, dan Sheets hanya boleh dipantau secara
> berala (polling) dengan had yang ketat. Guna Sheets sebagai **laporan/cermin**.

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
├─ google-apps-script.gs Kod untuk Apps Script (cermin Google Sheets)
├─ Dockerfile           Imej container untuk hosting
├─ render.yaml          Blueprint Render (web + volum kekal)
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
- **Cermin Google Sheets:** jadual `sheets_queue` menyimpan rekod yang belum berjaya
  dihantar; `POST /api/sheets/uji` dan `POST /api/sheets/hantar` (`{ "semua": true }`
  untuk muat naik balik) + cubaan automatik setiap ~25 saat. Hantaran ke Apps Script
  menggunakan `Content-Type: text/plain` (elak preflight CORS) dan menjangkakan
  respons `{ ok: true, ... }`.
- **Kunci majlis (`MAJLIS_KUNCI`):** dihantar sebagai header `x-majlis-kunci`, cookie
  `majlis_kunci`, `?kunci=` pada pautan, atau medan `kunci` dalam badan permintaan.
  `GET /api/health`, `GET /api/kuasa`, `GET /api/bootstrap`, `GET /api/papan`,
  `GET /api/events` dan avatar sentiasa awam supaya skrin projektor tidak perlu login.
- **Hampiran paparan (`GET /api/papan`):** sebahagian terowong/proxy (contohnya
  cloudflared) menyimpan buffer bagi sambungan berpanjangan, jadi peristiwa SSE
  tidak sampai ke pelayar. Skrin paparan mengesan “nadi” SSE yang senyap lebih
  ~1.8 saat dan beralih kepada soal-jawab ringkas `/api/papan?sejak=<ms>` setiap
  1.2 saat, jadi nama masih keluar (kelewatan ~1–3 saat). Pada rangkaian LAN biasa,
  SSE berfungsi sepenuhnya dan tiada hampiran digunakan.
- **`online.js` / `pautan-online.bat`:** melancarkan `server.js` pada port 80 dengan
  `AWAN=1` + `MAJLIS_KUNCI` (dijana rawak jika tidak diberi) dan membuka terowong
  `cloudflared` untuk mendapatkan pautan internet sementara.
- **Anugerah:** lajur `students.anugerah` (NULL = tiada). Dinormalkan
  (`normalisasiAnugerah`): satu baris, ruang tunggal, had 90 aksara. `PUT` tanpa medan
  `anugerah` = nilai kekal; string kosong = sengaja dikosongkan. Dibawa dalam
  `publicStudent()` jadi ia turut berada dalam peristiwa SSE `reveal`, suapan
  `/api/papan`, senarai MC dan `attendance.csv`.
- **Import dua mod:** tambah baharu (lalai) atau `mod: "kemas kini"` — yang kedua cukup
  lajur `kod,anugerah` dan hanya menyentuh lajur yang wujud dalam CSV.
- **Senarai MC:** `GET /api/mc` (berkumpulan, `susun=kelas|anugerah`, `hanya=0|1`) dan
  `GET /api/mc.csv`; dicetak melalui `@media print` dalam `admin.css` (class `print-mc`
  pada `<body>` semasa cetak supaya hanya tab MC yang keluar).
- **`GET /api/sheets/uji` menggunakan GET (doGet)** supaya ujian sambungan tidak menulis
  baris ke Google Sheet anda.

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
