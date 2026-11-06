'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

/* DATA_DIR boleh dipindah ke volum kekal pada hosting (Render/Fly/Railway). */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'majlis.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id         TEXT PRIMARY KEY,
    kod        TEXT NOT NULL UNIQUE,
    nama       TEXT NOT NULL,
    kelas      TEXT NOT NULL,
    foto       TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    scanned_at INTEGER NOT NULL,
    source     TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_students_kelas ON students(kelas);
  CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance(scanned_at);

  /* Baris gilir cermin Google Sheets - rekod yang belum berjaya dihantar. */
  CREATE TABLE IF NOT EXISTS sheets_queue (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kod        TEXT NOT NULL,
    nama       TEXT,
    kelas      TEXT,
    mod        TEXT,
    sumber     TEXT,
    masa       INTEGER,
    percubaan  INTEGER DEFAULT 0,
    dibuat     INTEGER NOT NULL
  );
`);

/* ------------------------------------------------------------------
   Penghijrahan: kehadiran dua peringkat
   - daftar_at : imbasan di kaunter daftar hadir (tanpa paparan skrin)
   - papar_at  : imbasan semasa majlis (nama terpapar di projektor)
   ------------------------------------------------------------------ */

const attendanceCols = db.prepare('PRAGMA table_info(attendance)').all().map((c) => c.name);

if (!attendanceCols.includes('daftar_at')) {
  db.exec('ALTER TABLE attendance ADD COLUMN daftar_at INTEGER');
  db.exec('ALTER TABLE attendance ADD COLUMN daftar_source TEXT');
  db.exec('ALTER TABLE attendance ADD COLUMN papar_at INTEGER');
  db.exec('ALTER TABLE attendance ADD COLUMN papar_source TEXT');
}

/* Rekod lama dihasilkan oleh imbasan semasa majlis, jadi anggap sudah dipaparkan. */
db.exec(
  'UPDATE attendance SET papar_at = scanned_at, papar_source = source WHERE papar_at IS NULL AND daftar_at IS NULL'
);

const DEFAULT_SETTINGS = {
  tajuk_majlis: 'Majlis Apresiasi Murid Cemerlang',
  subtajuk: 'Sesi 2026',
  nama_sekolah: 'Sekolah Kebangsaan Pulau Indah 2',
  cap_penjuru: '',
  tempoh_paparan: '6',
  bunyi: '1',
  background: '',
  logo: '',
  logo_saiz: 'penuh',
  logo_sekolah: '',
  mod_formal: '1',
  papar_kehadiran: '1',
  sheets_url: '',
  sheets_auto: '1',
  sheets_kunci: '',
};

const SEED = [
  ['6 AMANAH', 'Ahmad Zafran bin Ismail'],
  ['6 AMANAH', 'Nur Aisyah binti Rahman'],
  ['6 AMANAH', 'Muhammad Hazim bin Sharain'],
  ['6 AMANAH', 'Puteri Sarah binti Azman'],
  ['6 AMANAH', 'Muhammad Danish bin Roslan'],
  ['6 AMANAH', 'Nurul Izzah binti Kamal'],
  ['6 AMANAH', 'Amirul Hakim bin Zulkifli'],
  ['6 AMANAH', 'Siti Nurhaliza binti Osman'],
  ['6 BESTARI', 'Muhammad Irfan bin Yusof'],
  ['6 BESTARI', 'Nur Damia binti Hamzah'],
  ['6 BESTARI', 'Aqil Rayyan bin Nasir'],
  ['6 BESTARI', 'Alia Sofea binti Rahim'],
  ['6 BESTARI', 'Muhammad Firdaus bin Anuar'],
  ['6 BESTARI', 'Nur Aliya binti Salleh'],
  ['6 BESTARI', 'Wan Afiq bin Wan Azmi'],
  ['6 BESTARI', 'Nur Syazwani binti Idris'],
  ['5 CEKAL', 'Muhammad Adam bin Faizal'],
  ['5 CEKAL', 'Nur Hana binti Khairul'],
  ['5 CEKAL', 'Zikry Haikal bin Azhar'],
  ['5 CEKAL', 'Aina Mardhiah binti Latif'],
  ['5 CEKAL', 'Harith Iskandar bin Rizal'],
  ['5 CEKAL', 'Nurul Fatihah binti Sani'],
  ['5 DINAMIK', 'Muhammad Umar bin Hafiz'],
  ['5 DINAMIK', 'Nur Elysha binti Rosli'],
  ['5 DINAMIK', 'Syafiq Aiman bin Zainal'],
  ['5 DINAMIK', 'Dayana Batrisya binti Amir'],
  ['5 DINAMIK', 'Luqman Hakim bin Jasni'],
  ['5 DINAMIK', 'Nur Anis binti Mazlan'],
];

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSettings(patch) {
  const allowed = Object.keys(DEFAULT_SETTINGS);
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.includes(k)) stmt.run(k, String(v ?? ''));
  }
  return getSettings();
}

function nextKod() {
  const rows = db.prepare("SELECT kod FROM students WHERE kod LIKE 'NM26-%'").all();
  let max = 0;
  for (const r of rows) {
    const n = parseInt(String(r.kod).slice(5), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return 'NM26-' + String(max + 1).padStart(4, '0');
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM students').get().n;
  if (count > 0) return;
  const now = Date.now();
  const ins = db.prepare(
    'INSERT INTO students (id, kod, nama, kelas, foto, created_at) VALUES (?, ?, ?, ?, NULL, ?)'
  );
  SEED.forEach(([kelas, nama], i) => {
    ins.run('m' + (i + 1), 'NM26-' + String(i + 1).padStart(4, '0'), nama, kelas, now);
  });
}

function getStudentById(id) {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id);
}

function getStudentByKod(kod) {
  return db.prepare('SELECT * FROM students WHERE UPPER(kod) = ? OR UPPER(id) = ?').get(kod, kod);
}

function attendanceCount() {
  return db.prepare('SELECT COUNT(*) AS n FROM attendance').get().n;
}

function stats() {
  const total = db.prepare('SELECT COUNT(*) AS n FROM students').get().n;
  const hadir = attendanceCount();
  const daftar = db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE daftar_at IS NOT NULL').get().n;
  const dipapar = db.prepare('SELECT COUNT(*) AS n FROM attendance WHERE papar_at IS NOT NULL').get().n;
  const perClass = db
    .prepare(
      `SELECT s.kelas AS kelas,
              COUNT(s.id) AS total,
              SUM(CASE WHEN a.id IS NULL THEN 0 ELSE 1 END) AS hadir,
              SUM(CASE WHEN a.daftar_at IS NULL THEN 0 ELSE 1 END) AS daftar,
              SUM(CASE WHEN a.papar_at IS NULL THEN 0 ELSE 1 END) AS dipapar
       FROM students s
       LEFT JOIN attendance a ON a.student_id = s.id
       GROUP BY s.kelas
       ORDER BY s.kelas`
    )
    .all();
  return {
    total,
    hadir,
    belum: total - hadir,
    daftar,
    belum_daftar: total - daftar,
    dipapar,
    belum_papar: total - dipapar,
    perClass,
  };
}

function listStudents({ q = '', kelas = '' } = {}) {
  let sql = `SELECT s.*, a.scanned_at AS masa, a.daftar_at, a.papar_at
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id
             WHERE 1 = 1`;
  const args = [];
  if (q) {
    sql += ' AND (s.nama LIKE ? OR s.kod LIKE ? OR s.kelas LIKE ?)';
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  if (kelas) {
    sql += ' AND s.kelas = ?';
    args.push(kelas);
  }
  sql += ' ORDER BY s.kelas, s.nama';
  return db.prepare(sql).all(...args);
}

function listAttendance() {
  return db
    .prepare(
      `SELECT a.id, a.student_id, a.scanned_at, a.source,
              a.daftar_at, a.daftar_source, a.papar_at, a.papar_source,
              s.nama, s.kelas, s.kod, s.foto
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       ORDER BY a.scanned_at DESC`
    )
    .all();
}

function getAttendanceFor(studentId) {
  return db.prepare('SELECT * FROM attendance WHERE student_id = ?').get(studentId);
}

/* ------------------------------------------------------------------
   Rekod kehadiran ikut peringkat.
   mod = 'papar'  → imbasan semasa majlis (nama keluar di skrin)
   mod = 'daftar' → imbasan di kaunter daftar hadir (tiada paparan)
   ------------------------------------------------------------------ */

function markAttendance(studentId, source, mod = 'papar') {
  const at = Date.now();
  const src = source || 'scanner';
  const kolom = mod === 'daftar' ? ['daftar_at', 'daftar_source'] : ['papar_at', 'papar_source'];
  const row = db.prepare('SELECT * FROM attendance WHERE student_id = ?').get(studentId);

  if (row && row[kolom[0]]) return { duplicate: true, row, mod };

  if (row) {
    db.prepare(`UPDATE attendance SET ${kolom[0]} = ?, ${kolom[1]} = ? WHERE student_id = ?`).run(
      at,
      src,
      studentId
    );
  } else {
    db.prepare(
      `INSERT INTO attendance (student_id, scanned_at, source, ${kolom[0]}, ${kolom[1]})
       VALUES (?, ?, ?, ?, ?)`
    ).run(studentId, at, src, at, src);
  }

  return { duplicate: false, at, mod };
}

function clearAttendance() {
  db.prepare('DELETE FROM attendance').run();
  /* Giliran cermin Sheets ikut dikosongkan supaya rekod yang sudah dipadam
     tidak dihantar ke Google Sheet. */
  db.prepare('DELETE FROM sheets_queue').run();
}

/* ------------------------------------------------------------------
   Baris gilir cermin Google Sheets
   ------------------------------------------------------------------ */

function sheetsEnqueue({ kod, nama, kelas, mod, sumber, masa }) {
  db.prepare(
    'INSERT INTO sheets_queue (kod, nama, kelas, mod, sumber, masa, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(kod, nama, kelas, mod, sumber, masa || Date.now(), Date.now());
}

function sheetsBelumHantar(batas = 50) {
  return db.prepare('SELECT * FROM sheets_queue ORDER BY id ASC LIMIT ?').all(batas);
}

function sheetsBuang(ids) {
  if (!ids.length) return 0;
  const buang = db.prepare('DELETE FROM sheets_queue WHERE id = ?');
  let n = 0;
  for (const id of ids) n += buang.run(id).changes;
  return n;
}

function sheetsTandaiGagal(ids) {
  if (!ids.length) return 0;
  const naik = db.prepare('UPDATE sheets_queue SET percubaan = percubaan + 1 WHERE id = ?');
  let n = 0;
  for (const id of ids) n += naik.run(id).changes;
  /* Buang rekod yang sudah 12 kali gagal supaya baris gilir tak membesar. */
  db.prepare('DELETE FROM sheets_queue WHERE percubaan >= 12').run();
  return n;
}

function sheetsKosongkan() {
  db.prepare('DELETE FROM sheets_queue').run();
}

function sheetsMenunggu() {
  return db.prepare('SELECT COUNT(*) AS n FROM sheets_queue').get().n;
}

seed();

module.exports = {
  db,
  DATA_DIR,
  DEFAULT_SETTINGS,
  getSettings,
  setSettings,
  nextKod,
  getStudentById,
  getStudentByKod,
  stats,
  attendanceCount,
  listStudents,
  listAttendance,
  getAttendanceFor,
  markAttendance,
  clearAttendance,
  sheetsEnqueue,
  sheetsBelumHantar,
  sheetsBuang,
  sheetsTandaiGagal,
  sheetsKosongkan,
  sheetsMenunggu,
};
