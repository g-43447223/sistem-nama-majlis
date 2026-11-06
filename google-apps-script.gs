/**
 * CERMIN GOOGLE SHEETS untuk Sistem Nama Majlis
 * ---------------------------------------------
 * Cara guna (lebih kurang 5 minit):
 *  1. Buka fail Google Sheet anda (atau buat baharu) → Extensions → Apps Script.
 *  2. Padam kod sedia ada dan tampal kesemua kod dalam fail ini.
 *  3. (Disyorkan) Menu: File → Project properties → Script properties →
 *     tambah kunci `KUNCI` dengan nilai rahsia, contohnya `RAPI2026`.
 *     Masukkan nilai yang sama di Admin → Tetapan → "Kunci rahsia Sheets".
 *     Jika dibiarkan kosong, Apps Script akan menerima semua hantaran.
 *  4. Deploy → New deployment → Web app:
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5. Salin URL yang berakhir `/exec` → tampal di Admin → Tetapan →
 *     Cermin Google Sheets → tekan "Uji Sambungan" lalu "Hantar Semua Sekarang".
 *
 * Sheet "Kehadiran" akan dicipta sendiri dengan lajur:
 *   Rekod Pada | Kod | Nama | Kelas | Peringkat | Sumber | Masa Imbas | Kiriman
 */

const NAMA_SHEET = 'Kehadiran';
const LAJUR = [
  'Rekod Pada',
  'Kod',
  'Nama',
  'Kelas',
  'Peringkat',
  'Sumber',
  'Masa Imbas',
  'Kiriman',
];

/** Label yang sepadan dengan `mod` daripada pelayan. */
function sheetsLabel_(mod) {
  if (mod === 'daftar') return 'Daftar kaunter';
  if (mod === 'papar') return 'Dipaparkan';
  return String(mod || '');
}

/** Pastikan sheet + baris tajuk wujud. */
function sheetsPersediaan_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(NAMA_SHEET);
  if (!sheet) sheet = ss.insertSheet(NAMA_SHEET);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(LAJUR);
    sheet.getRange(1, 1, 1, LAJUR.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/** Kunci rahsia (Script Properties: KUNCI). Tiada kunci = terima semua. */
function sheetsKunciSah_(data) {
  const dijangka = PropertiesService.getScriptProperties().getProperty('KUNCI') || '';
  if (!dijangka) return true;
  return String(data.kunci || '') === dijangka;
}

/** Format masa untuk lajur "Masa Imbas". */
function sheetsMasa_(ms) {
  if (!ms) return '';
  return Utilities.formatDate(new Date(Number(ms)), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, mesej: 'Cermin Sistem Nama Majlis aktif', lajur: LAJUR })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const keluaran = (obj) =>
    ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

  let data;
  try {
    data = JSON.parse(String(e.postData.contents));
  } catch (err) {
    return keluaran({ ok: false, error: 'JSON tidak sah' });
  }

  if (!sheetsKunciSah_(data)) return keluaran({ ok: false, error: 'Kunci tidak sepadan' });

  /* Perintah khas: kosongkan baris latihan (baris tajuk dikekalkan). */
  if (data.perintah === 'kosongkan') {
    const sheetKosong = sheetsPersediaan_();
    const terakhir = sheetKosong.getLastRow();
    let dipadam = 0;
    if (terakhir > 1) {
      dipadam = terakhir - 1;
      sheetKosong.deleteRows(2, dipadam);
    }
    return keluaran({ ok: true, dipadam });
  }

  const baris = Array.isArray(data.baris) ? data.baris : [];
  if (!baris.length) return keluaran({ ok: true, diterima: 0, dilangkau: 0 });

  const sheet = sheetsPersediaan_();
  const kiriman = Utilities.getUuid().slice(0, 8);
  const kini = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  /* Bina set kunci untuk elak pendua apabila pelayan menghantar semula. */
  const sedia = new Set();
  const barisTerakhir = sheet.getLastRow();
  if (barisTerakhir > 1) {
    const nilai = sheet.getRange(2, 2, barisTerakhir - 1, 6).getValues();
    nilai.forEach((r) => sedia.add([r[0], r[3], r[5]].join('|')));
  }

  const baru = [];
  let diterima = 0;
  let dilangkau = 0;

  baris.forEach((b) => {
    const peringkat = sheetsLabel_(b.mod);
    const masaImbas = sheetsMasa_(b.masa);
    const kunci = [b.kod, peringkat, masaImbas].join('|');
    if (sedia.has(kunci)) {
      dilangkau += 1;
      return;
    }
    sedia.add(kunci);
    baru.push([kini, b.kod || '', b.nama || '', b.kelas || '', peringkat, b.sumber || '', masaImbas, kiriman]);
    diterima += 1;
  });

  if (baru.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, baru.length, LAJUR.length).setValues(baru);
  }

  return keluaran({ ok: true, diterima: diterima, dilangkau: dilangkau, kiriman: kiriman });
}
