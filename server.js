'use strict';

const express = require('express');
const multer = require('multer');
const qrcode = require('qrcode');
const selfsigned = require('selfsigned');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const https = require('node:https');
const crypto = require('node:crypto');

const store = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3443;
const PUBLIC_DIR = path.join(__dirname, 'public');

/* Pada hosting, volum kekal biasanya di luar folder aplikasi. */
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(PUBLIC_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* Platform (Render/Fly/Railway/VPS ber-Nginx) mengurus HTTPS sendiri. */
const CLOUD =
  String(process.env.AWAN || '') === '1' ||
  Boolean(process.env.RENDER) ||
  Boolean(process.env.FLY_APP_NAME) ||
  Boolean(process.env.RAILWAY_ENVIRONMENT) ||
  Boolean(process.env.KUBERNETES_SERVICE_HOST);

/* Kunci majlis. Jika ditetapkan, semua endpoint API (kecuali yang dinyatakan
   awam) memerlukan kunci ini — wajib diisi apabila sistem online. */
const KUNCI = String(process.env.MAJLIS_KUNCI || '').trim();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ------------------------------------------------------------------ */
/*  Muat naik fail                                                     */
/* ------------------------------------------------------------------ */

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const prefix =
        file.fieldname === 'latar'
          ? 'latar'
          : file.fieldname === 'logo'
            ? 'logo'
            : file.fieldname === 'sekolah'
              ? 'sekolah'
              : 'murid';
      cb(null, `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      const err = new Error('Jenis fail tidak disokong. Guna JPG, PNG, WEBP, GIF atau AVIF.');
      err.status = 400;
      return cb(err);
    }
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      const err = new Error('Fail yang dimuat naik mesti gambar.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

function removeUpload(webPath) {
  if (!webPath || typeof webPath !== 'string' || !webPath.startsWith('/uploads/')) return;
  const full = path.join(UPLOAD_DIR, path.basename(webPath));
  if (!full.startsWith(UPLOAD_DIR)) return;
  fs.promises.unlink(full).catch(() => {});
}

/* ------------------------------------------------------------------ */
/*  Server-Sent Events                                                 */
/* ------------------------------------------------------------------ */

const sseClients = new Set();

/* Papan gantian: simpan paparan terkini supaya skrin boleh "_poll" apabila
   sambungan langsung tersekat (contohnya melalui terowong/proxy yang
   menyimpan buffered response). */
const papanTerbaru = [];
const PAPAN_TAHAP = 120000; /* simpan 2 minit */
const PAPAN_BILANGAN = 30;

function papanSimpan(payload) {
  papanTerbaru.push(payload);
  if (papanTerbaru.length > PAPAN_BILANGAN) papanTerbaru.shift();
  const had = Date.now() - PAPAN_TAHAP;
  while (papanTerbaru.length && papanTerbaru[0].at < had) papanTerbaru.shift();
}

app.get('/api/papan', (req, res) => {
  const sejak = Number(req.query.sejak) || 0;
  res.json({
    settings: store.getSettings(),
    ...store.stats(),
    reveal: papanTerbaru.filter((r) => r.at > sejak),
    masa: Date.now(),
  });
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');
  res.write('event: hello\ndata: {}\n\n');
  sseClients.add(res);

  const ping = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      /* ignore */
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

function sendEvent(type, payload) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Utiliti                                                            */
/* ------------------------------------------------------------------ */

function lanAddress() {
  const candidates = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const addr of list || []) {
      if (addr.family === 'IPv4' && !addr.internal) candidates.push(addr.address);
    }
  }
  candidates.sort((a, b) => {
    const score = (ip) =>
      ip.startsWith('192.168.') ? 3 : ip.startsWith('10.') ? 2 : ip.startsWith('172.') ? 1 : 0;
    return score(b) - score(a);
  });
  return candidates[0] || 'localhost';
}

function normalizeKod(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value) || value.includes('?')) {
    try {
      const url = new URL(value, 'http://localhost');
      const fromQuery =
        url.searchParams.get('kod') ||
        url.searchParams.get('code') ||
        url.searchParams.get('id');
      if (fromQuery) value = fromQuery;
      else {
        const last = url.pathname.split('/').filter(Boolean).pop();
        if (last) value = decodeURIComponent(last);
      }
    } catch {
      /* guna nilai asal */
    }
  }

  return value.trim().toUpperCase();
}

function publicStudent(student) {
  if (!student) return null;
  return {
    id: student.id,
    kod: student.kod,
    nama: student.nama,
    kelas: student.kelas,
    foto: student.foto || `/api/avatar/${encodeURIComponent(student.id)}`,
  };
}

function parseCsv(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);

  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
}

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const timeFormatter = new Intl.DateTimeFormat('ms-MY', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Kuala_Lumpur',
});

function formatTime(ms) {
  return timeFormatter.format(new Date(Number(ms) || Date.now()));
}

function buildScanPayload(student, extras = {}) {
  return {
    student: publicStudent(student),
    at: Date.now(),
    ...store.stats(),
    ...extras,
  };
}

/* ------------------------------------------------------------------ */
/*  Kawalan akses — perlu diisi apabila sistem berada di internet      */
/* ------------------------------------------------------------------ */

const LALUAN_AWAM = [
  /^\/api\/health$/,
  /^\/api\/bootstrap$/,
  /^\/api\/events$/,
  /^\/api\/kuasa$/,
  /^\/api\/buka-kuasa$/,
  /^\/api\/papan$/,
  /^\/api\/avatar\/[^/]+$/,
  /^\/api\/qr-link$/,
];

function kunciSama(sempena, ikatan) {
  const a = Buffer.from(String(sempena));
  const b = Buffer.from(String(ikatan));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function ambilKunci(req) {
  const daripadaHeader = req.get('x-majlis-kunci');
  if (daripadaHeader) return String(daripadaHeader).trim();
  const cookie = String(req.headers.cookie || '').match(/(?:^|;\s*)majlis_kunci=([^;]+)/);
  if (cookie) {
    try {
      return decodeURIComponent(cookie[1]);
    } catch {
      return '';
    }
  }
  return String(
    req.query.kunci ||
      (req.body && req.body.kunci) ||
      ''
  ).trim();
}

app.use('/api', (req, res, next) => {
  if (!KUNCI) return next(); /* mod lokal (laptop + Wi-Fi sekolah): terbuka */

  const laluan = `/api${req.path === '/' ? '' : req.path}`;
  if (LALUAN_AWAM.some((pattern) => pattern.test(laluan))) return next();

  const nilai = ambilKunci(req);
  if (nilai && kunciSama(nilai, KUNCI)) return next();

  return res.status(401).json({ error: 'Kunci majlis diperlukan.', perluKunci: true });
});

app.post('/api/buka-kuasa', (req, res) => {
  const nilai = String((req.body && req.body.kunci) || '').trim();
  if (!KUNCI) return res.json({ ok: true, perluKunci: false });
  if (!nilai || !kunciSama(nilai, KUNCI)) {
    return res.status(401).json({ error: 'Kunci salah.', perluKunci: true });
  }
  const selamat = req.secure || req.get('x-forwarded-proto') === 'https';
  res.setHeader(
    'Set-Cookie',
    `majlis_kunci=${encodeURIComponent(nilai)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${selamat ? '; Secure' : ''}`
  );
  res.json({ ok: true, perluKunci: true });
});

app.get('/api/kuasa', (_req, res) => {
  res.json({ perluKunci: Boolean(KUNCI) });
});

app.get('/api/health', (_req, res) => {
  const stats = store.stats();
  res.json({
    ok: true,
    versi: require('./package.json').version,
    mod: KUNCI ? 'online' : 'lokal',
    murid: stats.total,
    hadir: stats.hadir,
    daftar: stats.daftar,
    dipapar: stats.dipapar,
    sambungan: sseClients.size,
    masa: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/*  Maklumat asas                                                      */
/* ------------------------------------------------------------------ */

/* Alamat yang dilihat peranti: pada hosting guna header permintaan,
   bukan IP laptop. */
function alamatAsas(req) {
  const tersurat = String(process.env.PUBLIC_URL || '').trim();
  if (tersurat) return tersurat.replace(/\/+$/, '');
  const host = req.get('x-forwarded-host') || req.get('host') || `${lanAddress()}:${PORT}`;
  const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
  return `${proto}://${host}`;
}

/* Port lalai tidak perlu ditaip — http://192.168.0.41 sudah cukup. */
function tampalPort(port, proto) {
  const lalai = proto === 'https' ? 443 : 80;
  return Number(port) === lalai ? '' : `:${port}`;
}

app.get('/api/bootstrap', (req, res) => {
  const settings = store.getSettings();
  const lan = lanAddress();
  const asas = CLOUD ? alamatAsas(req) : `http://${lan}${tampalPort(PORT, 'http')}`;
  const kamera = CLOUD ? asas : `https://${lan}${tampalPort(HTTPS_PORT, 'https')}`;

  res.json({
    settings,
    ...store.stats(),
    lan,
    port: PORT,
    mod: KUNCI ? 'online' : 'lokal',
    perluKunci: Boolean(KUNCI),
    urls: {
      asas,
      paparan: `${asas}/display.html`,
      pengimbas: `${asas}/scan.html`,
      kaunter: `${asas}/scan.html?mod=daftar`,
      kaunterFon: `${kamera}/scan.html?mod=daftar`,
      kamera: `${kamera}/scan.html`,
      admin: `${asas}/admin.html`,
      kad: `${asas}/qr.html`,
      lokal: `http://localhost${tampalPort(PORT, 'http')}`,
      lokalKamera: `https://localhost${tampalPort(HTTPS_PORT, 'https')}/scan.html`,
    },
  });
});

/* ------------------------------------------------------------------ */
/*  Murid                                                              */
/* ------------------------------------------------------------------ */

app.get('/api/students', (req, res) => {
  const q = String(req.query.q || '').trim();
  const kelas = String(req.query.kelas || '').trim();
  const rows = store.listStudents({ q, kelas });
  res.json({
    students: rows.map((s) => ({
      ...publicStudent(s),
      hadir: Boolean(s.masa),
      masa: s.masa || null,
      masaLabel: s.masa ? formatTime(s.masa) : null,
      daftar: Boolean(s.daftar_at),
      daftarLabel: s.daftar_at ? formatTime(s.daftar_at) : null,
      dipapar: Boolean(s.papar_at),
      paparLabel: s.papar_at ? formatTime(s.papar_at) : null,
      created_at: s.created_at,
    })),
    ...store.stats(),
  });
});

app.get('/api/students/:id', (req, res) => {
  const student = store.getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Murid tidak dijumpai.' });
  res.json({ student: publicStudent(student) });
});

app.post('/api/students', (req, res) => {
  const nama = String(req.body.nama || '').trim();
  const kelas = String(req.body.kelas || '').trim();
  let kod = normalizeKod(req.body.kod);

  if (!nama) return res.status(400).json({ error: 'Nama murid diperlukan.' });
  if (!kelas) return res.status(400).json({ error: 'Kelas diperlukan.' });

  if (!kod) kod = store.nextKod();
  const clash = store.db.prepare('SELECT id FROM students WHERE UPPER(kod) = ?').get(kod);
  if (clash) return res.status(409).json({ error: `Kod ${kod} sudah digunakan.` });

  const id = 'm' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  store.db
    .prepare('INSERT INTO students (id, kod, nama, kelas, foto, created_at) VALUES (?, ?, ?, ?, NULL, ?)')
    .run(id, kod, nama, kelas, Date.now());

  const student = store.getStudentById(id);
  sendEvent('students', { reason: 'add', ...store.stats() });
  res.status(201).json({ student: publicStudent(student) });
});

app.put('/api/students/:id', (req, res) => {
  const existing = store.getStudentById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Murid tidak dijumpai.' });

  const nama = String(req.body.nama ?? existing.nama).trim();
  const kelas = String(req.body.kelas ?? existing.kelas).trim();
  let kod = normalizeKod(req.body.kod ?? existing.kod);

  if (!nama) return res.status(400).json({ error: 'Nama murid diperlukan.' });
  if (!kelas) return res.status(400).json({ error: 'Kelas diperlukan.' });
  if (!kod) kod = existing.kod;

  const clash = store.db
    .prepare('SELECT id FROM students WHERE UPPER(kod) = ? AND id <> ?')
    .get(kod, existing.id);
  if (clash) return res.status(409).json({ error: `Kod ${kod} sudah digunakan.` });

  store.db
    .prepare('UPDATE students SET nama = ?, kelas = ?, kod = ? WHERE id = ?')
    .run(nama, kelas, kod, existing.id);

  sendEvent('students', { reason: 'edit', ...store.stats() });
  res.json({ student: publicStudent(store.getStudentById(existing.id)) });
});

app.delete('/api/students/:id', (req, res) => {
  const student = store.getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Murid tidak dijumpai.' });
  removeUpload(student.foto);
  store.db.prepare('DELETE FROM students WHERE id = ?').run(student.id);
  sendEvent('students', { reason: 'delete', ...store.stats() });
  res.json({ ok: true });
});

app.post('/api/students/:id/photo', upload.single('foto'), (req, res) => {
  const student = store.getStudentById(req.params.id);
  if (!student) {
    if (req.file) removeUpload(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: 'Murid tidak dijumpai.' });
  }
  if (!req.file) return res.status(400).json({ error: 'Tiada gambar dimuat naik.' });

  const old = student.foto;
  const webPath = `/uploads/${req.file.filename}`;
  store.db.prepare('UPDATE students SET foto = ? WHERE id = ?').run(webPath, student.id);
  removeUpload(old);
  res.json({ student: publicStudent(store.getStudentById(student.id)) });
});

/* ------------------------------------------------------------------ */
/*  Muat naik gambar pukal (nama fail = kod murid)                     */
/* ------------------------------------------------------------------ */

app.post('/api/photos/bulk', upload.array('foto', 300), (req, res) => {
  const files = req.files || [];
  const matched = [];
  const unmatched = [];

  for (const file of files) {
    const webPath = `/uploads/${file.filename}`;
    const base = path.basename(file.originalname, path.extname(file.originalname));
    const key = normalizeKod(base);
    const student = store.getStudentByKod(key);
    if (!student) {
      removeUpload(webPath);
      unmatched.push(file.originalname);
      continue;
    }
    removeUpload(student.foto);
    store.db.prepare('UPDATE students SET foto = ? WHERE id = ?').run(webPath, student.id);
    matched.push({ kod: student.kod, nama: student.nama, fail: file.originalname });
  }

  sendEvent('students', { reason: 'photos', ...store.stats() });
  res.json({ matched, unmatched, total: files.length });
});

/* ------------------------------------------------------------------ */
/*  Import CSV                                                         */
/* ------------------------------------------------------------------ */

app.post('/api/import', (req, res) => {
  const csv = String(req.body.csv || '');
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV perlu ada baris tajuk dan sekurang-kurangnya satu murid.' });
  }

  const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const idx = {
    nama: header.findIndex((h) => ['nama', 'name', 'namamurid'].includes(h)),
    kelas: header.findIndex((h) => ['kelas', 'class', 'darjah'].includes(h)),
    kod: header.findIndex((h) => ['kod', 'code', 'kodqr', 'id'].includes(h)),
    foto: header.findIndex((h) => ['foto', 'gambar', 'photo', 'image'].includes(h)),
  };

  if (idx.nama === -1 || idx.kelas === -1) {
    return res.status(400).json({
      error: 'Tajuk CSV mesti ada sekurang-kurangnya lajur "nama" dan "kelas".',
    });
  }

  const insert = store.db.prepare(
    'INSERT INTO students (id, kod, nama, kelas, foto, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const findKod = store.db.prepare('SELECT id FROM students WHERE UPPER(kod) = ?');
  let added = 0;
  const skipped = [];
  const errors = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const nama = (row[idx.nama] || '').trim();
    const kelas = (row[idx.kelas] || '').trim();
    if (!nama || !kelas) {
      errors.push(`Baris ${i + 1}: nama atau kelas kosong.`);
      continue;
    }

    let kod = idx.kod >= 0 ? normalizeKod(row[idx.kod]) : '';
    if (!kod) kod = store.nextKod();
    if (findKod.get(kod)) {
      skipped.push(`${nama} (${kod})`);
      continue;
    }

    let foto = null;
    if (idx.foto >= 0) {
      const raw = (row[idx.foto] || '').trim().replace(/\\/g, '/');
      if (raw) foto = raw.startsWith('/') ? raw : `/uploads/${raw}`;
    }

    const id = 'm' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    insert.run(id, kod, nama, kelas, foto, Date.now());
    added += 1;
  }

  sendEvent('students', { reason: 'import', ...store.stats() });
  res.json({ added, skipped, errors, ...store.stats() });
});

/* ------------------------------------------------------------------ */
/*  Imbas / kehadiran                                                  */
/* ------------------------------------------------------------------ */

/* Dua peringkat imbasan:
   mod = 'papar'  → nama murid dipaparkan di skrin projektor (aliran majlis)
   mod = 'daftar' → hanya rekod kehadiran di kaunter, TIADA paparan di skrin   */

app.post('/api/scan', (req, res) => {
  const kod = normalizeKod(req.body.kod);
  const source = ['scanner', 'kamera', 'manual'].includes(req.body.source)
    ? req.body.source
    : 'scanner';
  const mod = req.body.mod === 'daftar' ? 'daftar' : 'papar';

  if (!kod) return res.status(400).json({ ok: false, status: 'empty', message: 'Kod kosong.' });

  const student = store.getStudentByKod(kod);
  if (!student) {
    return res.json({
      ok: false,
      status: 'unknown',
      mod,
      message: `Kod "${kod}" tidak dikenali.`,
      kod,
    });
  }

  const result = store.markAttendance(student.id, source, mod);
  const rekod = store.getAttendanceFor(student.id);

  /* Cermin Google Sheets: masuk giliran, hantar tanpa menghalang paparan. */
  if (!result.duplicate && String(store.getSettings().sheets_url || '').trim()) {
    tambahKeGiliran({
      kod: student.kod,
      nama: student.nama,
      kelas: student.kelas,
      mod,
      sumber: source,
      masa: result.at,
    });
    if (String(store.getSettings().sheets_auto) !== '0') {
      setImmediate(() => sheetsSirap({ senyap: true }).catch(() => {}));
    }
  }

  const tahap = {
    id: student.id,
    kod: student.kod,
    nama: student.nama,
    kelas: student.kelas,
    daftar: rekod?.daftar_at || null,
    daftarLabel: rekod?.daftar_at ? formatTime(rekod.daftar_at) : null,
    dipapar: rekod?.papar_at || null,
    paparLabel: rekod?.papar_at ? formatTime(rekod.papar_at) : null,
  };

  if (result.duplicate) {
    const at = mod === 'daftar' ? rekod?.daftar_at : rekod?.papar_at;
    return res.json({
      ok: false,
      status: 'duplicate',
      mod,
      message:
        mod === 'daftar'
          ? `${student.nama} sudah didaftarkan di kaunter.`
          : `${student.nama} sudah dipaparkan pada skrin.`,
      student: publicStudent(student),
      tahap,
      at,
      atLabel: at ? formatTime(at) : null,
      ...store.stats(),
    });
  }

  if (mod === 'daftar') {
    /* Senyap: tiada peristiwa 'reveal' dihantar ke skrin paparan. */
    sendEvent('stats', store.stats());
    return res.json({
      ok: true,
      status: 'ok',
      mod,
      message: `${student.nama} — ${student.kelas} didaftarkan hadir.`,
      student: publicStudent(student),
      tahap,
      ...store.stats(),
    });
  }

  const payload = buildScanPayload(student, { source, mod });
  papanSimpan(payload);
  sendEvent('reveal', payload);
  sendEvent('stats', store.stats());
  res.json({
    ok: true,
    status: 'ok',
    mod,
    message: `${student.nama} — ${student.kelas}`,
    student: publicStudent(student),
    tahap,
    ...store.stats(),
  });
});

app.get('/api/attendance', (req, res) => {
  const rows = store.listAttendance();
  res.json({
    sheets: {
      menunggu: store.sheetsMenunggu(),
      diatur: Boolean(String(store.getSettings().sheets_url || '').trim()),
      auto: String(store.getSettings().sheets_auto) !== '0',
    },
    attendance: rows.map((r) => ({
      id: r.id,
      student: publicStudent({ id: r.student_id, kod: r.kod, nama: r.nama, kelas: r.kelas, foto: r.foto }),
      scanned_at: r.scanned_at,
      masa: formatTime(r.scanned_at),
      source: r.source,
      daftar_at: r.daftar_at || null,
      daftarLabel: r.daftar_at ? formatTime(r.daftar_at) : null,
      daftar_source: r.daftar_source || null,
      papar_at: r.papar_at || null,
      paparLabel: r.papar_at ? formatTime(r.papar_at) : null,
      papar_source: r.papar_source || null,
    })),
    ...store.stats(),
  });
});

app.get('/api/attendance.csv', (req, res) => {
  const rows = store.listAttendance();
  const labels = { scanner: 'Mesin scanner', kamera: 'Kamera fon', manual: 'Taip manual' };
  const lines = [
    ['Bil', 'Nama', 'Kelas', 'Kod', 'Status', 'Daftar hadir', 'Sumber daftar', 'Dipaparkan', 'Sumber papar'].join(','),
  ];
  rows
    .slice()
    .reverse()
    .forEach((r, i) => {
      const status =
        r.daftar_at && r.papar_at
          ? 'Didaftar & dipaparkan'
          : r.daftar_at
            ? 'Didaftar sahaja'
            : r.papar_at
              ? 'Dipaparkan sahaja'
              : 'Hadir';
      lines.push(
        [
          i + 1,
          r.nama,
          r.kelas,
          r.kod,
          status,
          r.daftar_at ? formatTime(r.daftar_at) : '-',
          r.daftar_at ? labels[r.daftar_source] || r.daftar_source || '' : '-',
          r.papar_at ? formatTime(r.papar_at) : '-',
          r.papar_at ? labels[r.papar_source] || r.papar_source || '' : '-',
        ]
          .map(csvEscape)
          .join(',')
      );
    });
  const body = '\uFEFF' + lines.join('\r\n') + '\r\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="kehadiran-majlis.csv"');
  res.send(body);
});

app.delete('/api/attendance', (req, res) => {
  store.clearAttendance();
  sendEvent('reset', { ...store.stats() });
  res.json({ ok: true, ...store.stats() });
});

/* Reset seorang murid — kad boleh dipaparkan semula (contoh: tersalah
   imbas semasa latihan atau sebelum giliran). */
app.delete('/api/attendance/:id', (req, res) => {
  const student = store.getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Murid tidak dijumpai.' });

  const dibuang = store.clearAttendanceFor(student.id);
  sendEvent('stats', store.stats());
  sendEvent('students', { reason: 'reset-seorang', ...store.stats() });
  res.json({ ok: true, dibuang, murid: publicStudent(student), ...store.stats() });
});

/* ------------------------------------------------------------------ */
/*  Cermin Google Sheets (hantar & ulangi automatik)                   */
/* ------------------------------------------------------------------ */

const SHEETS_TAMAT = 9000; /* ms */
const SHEETS_BATAS = 50; /* maksimum satu hantaran */
let sheetsSibuk = false;

function sheetsUrlSah(url) {
  try {
    const u = new URL(String(url || '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function tambahKeGiliran({ kod, nama, kelas, mod, sumber, masa }) {
  try {
    store.sheetsEnqueue({ kod, nama, kelas, mod, sumber, masa });
  } catch (err) {
    console.error('[sheets] gagal memasukkan giliran:', err.message);
  }
}

/* Hantar apa yang tergendala ke Apps Script. Dipanggil selepas tiap imbasan
   dan secara berkala. Kegagalan TIDAK menjejaskan paparan. */
async function sheetsSirap({ senyap = true } = {}) {
  const settings = store.getSettings();
  const url = String(settings.sheets_url || '').trim();
  if (sheetsSibuk) return { ok: true, diabaikan: 'sedang menghantar' };
  if (!url || !sheetsUrlSah(url)) {
    return { ok: false, mesej: 'Tiada URL Sheets diatur.', menunggu: store.sheetsMenunggu() };
  }

  sheetsSibuk = true;
  try {
    const baris = store.sheetsBelumHantar(SHEETS_BATAS);
    if (!baris.length) return { ok: true, dihantar: 0, menunggu: 0 };

    const badan = {
      perintah: 'hantar',
      sumber: 'Sistem Nama Majlis',
      kunci: String(settings.sheets_kunci || ''),
      masa_hantar: Date.now(),
      baris: baris.map((b) => ({
        kod: b.kod,
        nama: b.nama,
        kelas: b.kelas,
        mod: b.mod,
        sumber: b.sumber,
        masa: b.masa,
      })),
    };

    const penutup = new AbortController();
    const tamat = setTimeout(() => penutup.abort(), SHEETS_TAMAT);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(badan),
        signal: penutup.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(tamat);
    }

    const teks = await res.text();
    let json = null;
    try {
      json = JSON.parse(teks);
    } catch {
      /* Apps Script biasa pulangkan HTML jika tiada kebenaran */
    }

    if (!res.ok || !json || json.ok !== true) {
      store.sheetsTandaiGagal(baris.map((b) => b.id));
      const mesej =
        (json && (json.error || json.message)) ||
        (res.status === 403 || teks.includes('<title>')
          ? 'Akses Apps Script ditolak — deploy sebagai "Anyone".'
          : `Respons tidak dijangka (HTTP ${res.status}).`);
      if (!senyap) return { ok: false, mesej, menunggu: store.sheetsMenunggu() };
      console.warn('[sheets] hantar gagal:', mesej);
      return { ok: false, mesej };
    }

    const id = baris.map((b) => b.id);
    const buang = store.sheetsBuang(id);
    const baki = store.sheetsMenunggu();
    /* Jika masih banyak tertunggak, sambung batch seterusnya. */
    if (baki > 0) {
      setImmediate(() => sheetsSirap({ senyap: true }).catch(() => {}));
    }
    return { ok: true, dihantar: buang, menunggu: baki, diterima: json.diterima };
  } catch (err) {
    const sebab = err && err.name === 'AbortError' ? 'Tempoh tamat (sambungan lambat)' : err.message;
    try {
      store.sheetsTandaiGagal(store.sheetsBelumHantar(SHEETS_BATAS).map((b) => b.id));
    } catch {
      /* abai */
    }
    if (!senyap) return { ok: false, mesej: sebab, menunggu: store.sheetsMenunggu() };
    console.warn('[sheets] hantar gagal:', sebab);
    return { ok: false, mesej: sebab };
  } finally {
    sheetsSibuk = false;
  }
}

app.post('/api/sheets/uji', async (_req, res) => {
  const settings = store.getSettings();
  const url = String(settings.sheets_url || '').trim();
  if (!url || !sheetsUrlSah(url)) {
    return res.status(400).json({ error: 'Isi URL Web App Apps Script dahulu.' });
  }
  try {
    const penutup = new AbortController();
    const tamat = setTimeout(() => penutup.abort(), 12000);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          perintah: 'uji',
          sumber: 'Sistem Nama Majlis',
          kunci: String(settings.sheets_kunci || ''),
          masa_hantar: Date.now(),
          baris: [{ kod: 'UJIAN', nama: 'Ujian sambungan', kelas: '-', mod: 'uji', sumber: 'sistem', masa: Date.now() }],
        }),
        signal: penutup.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(tamat);
    }
    const teks = await r.text();
    let json = null;
    try {
      json = JSON.parse(teks);
    } catch {
      /* bukan JSON */
    }
    return res.json({
      ok: r.ok && json && json.ok === true,
      http: r.status,
      respons: json || teks.slice(0, 220),
    });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

/* Padam baris rehearsal dalam Google Sheet ( header dikekalkan ).
   Ini tidak memadam rekod dalam laptop — itu ada butangnya sendiri. */
app.post('/api/sheets/kosongkan', async (_req, res) => {
  const settings = store.getSettings();
  const url = String(settings.sheets_url || '').trim();
  if (!url || !sheetsUrlSah(url)) {
    return res.status(400).json({ error: 'Tiada URL Google Sheets diatur.' });
  }
  try {
    const penutup = new AbortController();
    const tamat = setTimeout(() => penutup.abort(), 15000);
    let r;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          perintah: 'kosongkan',
          sumber: 'Sistem Nama Majlis',
          kunci: String(settings.sheets_kunci || ''),
        }),
        signal: penutup.signal,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(tamat);
    }
    const teks = await r.text();
    let json = null;
    try {
      json = JSON.parse(teks);
    } catch {
      /* bukan JSON */
    }
    if (!r.ok || !json || json.ok !== true) {
      const sebab = (json && json.error) || `HTTP ${r.status}`;
      return res.json({ ok: false, error: sebab });
    }
    return res.json({ ok: true, dipadam: json.dipadam || 0 });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

app.post('/api/sheets/hantar', async (req, res) => {
  /* semua = true: masukkan semula SEMUA rekod kehadiran ke giliran
     (Apps Script menapis pendua, jadi ini selamat untuk backfill). */
  if (req.body && req.body.semua) {
    store.sheetsKosongkan();
    for (const r of store.listAttendance()) {
      if (r.daftar_at) {
        store.sheetsEnqueue({
          kod: r.kod,
          nama: r.nama,
          kelas: r.kelas,
          mod: 'daftar',
          sumber: r.daftar_source || r.source,
          masa: r.daftar_at,
        });
      }
      if (r.papar_at) {
        store.sheetsEnqueue({
          kod: r.kod,
          nama: r.nama,
          kelas: r.kelas,
          mod: 'papar',
          sumber: r.papar_source || r.source,
          masa: r.papar_at,
        });
      }
    }
  }
  const hasil = await sheetsSirap({ senyap: false });
  res.json({ ...hasil, menunggu: store.sheetsMenunggu(), murid: store.stats().total });
});

/* Cuba semula secara berkala selagi ada yang tertunggak. */
setInterval(() => {
  const settings = store.getSettings();
  if (String(settings.sheets_auto) === '0') return;
  if (!String(settings.sheets_url || '').trim()) return;
  if (store.sheetsMenunggu() === 0) return;
  sheetsSirap({ senyap: true }).catch(() => {});
}, 25000).unref?.();

/* ------------------------------------------------------------------ */
/*  Paparan (demo / kawalan)                                           */
/* ------------------------------------------------------------------ */

app.post('/api/demo', (req, res) => {
  const student =
    store.getStudentById(String(req.body.id || '')) ||
    store.getStudentByKod(normalizeKod(req.body.kod));
  if (!student) return res.status(404).json({ error: 'Murid tidak dijumpai.' });

  const payload = buildScanPayload(student, { demo: true, source: 'demo' });
  papanSimpan(payload);
  sendEvent('reveal', payload);
  res.json({ ok: true, student: publicStudent(student) });
});

app.post('/api/display/ping', (req, res) => {
  sendEvent('ping-display', { at: Date.now() });
  res.json({ ok: true, clients: sseClients.size });
});

/* ------------------------------------------------------------------ */
/*  Tetapan                                                            */
/* ------------------------------------------------------------------ */

app.post('/api/settings', (req, res) => {
  const patch = {};
  const body = req.body || {};
  for (const key of Object.keys(store.DEFAULT_SETTINGS)) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (patch.tempoh_paparan !== undefined) {
    const n = Math.min(30, Math.max(2, Number(patch.tempoh_paparan) || 6));
    patch.tempoh_paparan = String(n);
  }
  if (patch.logo_saiz !== undefined) {
    const allowed = ['sederhana', 'besar', 'penuh'];
    patch.logo_saiz = allowed.includes(String(patch.logo_saiz)) ? String(patch.logo_saiz) : 'penuh';
  }
  if (patch.sheets_url !== undefined) {
    const url = String(patch.sheets_url).trim();
    if (url && !sheetsUrlSah(url)) {
      return res.status(400).json({ error: 'URL Google Sheets tidak sah (mesti http/https).' });
    }
    patch.sheets_url = url;
  }
  if (patch.sheets_auto !== undefined) {
    patch.sheets_auto = String(patch.sheets_auto) === '0' ? '0' : '1';
  }
  const settings = store.setSettings(patch);
  sendEvent('settings', settings);
  res.json({ settings });
});

app.post('/api/background', upload.single('latar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada gambar dimuat naik.' });
  const settings = store.getSettings();
  const old = settings.background;
  const webPath = `/uploads/${req.file.filename}`;
  const next = store.setSettings({ background: webPath });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

app.post('/api/background/reset', (req, res) => {
  const settings = store.getSettings();
  const old = settings.background;
  const next = store.setSettings({ background: '' });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

/* ------------------------------------------------------------------ */
/*  Logo majlis (papar semasa skrin menunggu)                          */
/* ------------------------------------------------------------------ */

app.post('/api/logo', upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada logo dimuat naik.' });
  const settings = store.getSettings();
  const old = settings.logo;
  const webPath = `/uploads/${req.file.filename}`;
  const next = store.setSettings({ logo: webPath });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

app.post('/api/logo/reset', (req, res) => {
  const settings = store.getSettings();
  const old = settings.logo;
  const next = store.setSettings({ logo: '' });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

/* ------------------------------------------------------------------ */
/*  Logo sekolah (penjuru atas kiri skrin paparan)                     */
/* ------------------------------------------------------------------ */

app.post('/api/logo-sekolah', upload.single('sekolah'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Tiada logo dimuat naik.' });
  const settings = store.getSettings();
  const old = settings.logo_sekolah;
  const webPath = `/uploads/${req.file.filename}`;
  const next = store.setSettings({ logo_sekolah: webPath });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

app.post('/api/logo-sekolah/reset', (req, res) => {
  const settings = store.getSettings();
  const old = settings.logo_sekolah;
  const next = store.setSettings({ logo_sekolah: '' });
  removeUpload(old);
  sendEvent('settings', next);
  res.json({ settings: next });
});

/* ------------------------------------------------------------------ */
/*  Kad QR & avatar                                                    */
/* ------------------------------------------------------------------ */

app.get('/api/qr/:kod', async (req, res) => {
  const kod = normalizeKod(req.params.kod);
  if (!kod) return res.status(400).send('Kod kosong');
  try {
    const size = Math.min(900, Math.max(120, Number(req.query.size) || 320));
    const png = await qrcode.toBuffer(kod, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1b33ff', light: '#ffffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(png);
  } catch (err) {
    res.status(500).send('Gagal jana QR');
  }
});

app.get('/api/qr-link', async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) return res.status(400).send('URL tidak sah');
  try {
    const size = Math.min(900, Math.max(120, Number(req.query.size) || 320));
    const png = await qrcode.toBuffer(url, {
      type: 'png',
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1b33ff', light: '#ffffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(png);
  } catch {
    res.status(500).send('Gagal jana QR');
  }
});

app.get('/api/avatar/:id', (req, res) => {
  const rawId = String(req.params.id || '').replace(/\.svg$/i, '');
  const student = store.getStudentById(rawId);
  const nama = student ? student.nama : '?';

  const initials = nama
    .split(/\s+/)
    .filter((w) => !/^(bin|binti|bt|a\/l|anak)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  let hash = 0;
  for (const ch of nama) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const hue = hash;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 38% 26%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 24) % 360} 42% 16%)"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="300" r="228" fill="none" stroke="#d4af37" stroke-opacity="0.55" stroke-width="4"/>
  <text x="300" y="300" text-anchor="middle" dominant-baseline="central"
        font-family="Georgia, 'Times New Roman', serif" font-size="190" fill="#f5efe0" letter-spacing="6">${initials.replace(/[<>&"]/g, '')}</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(svg);
});

/* ------------------------------------------------------------------ */
/*  Statik                                                             */
/* ------------------------------------------------------------------ */

/* Folder muat naik boleh berada di volum berasingan pada hosting. */
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: 0, etag: true }));

app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak dijumpai.' });
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    err.status = 413;
    err.message = 'Saiz gambar melebihi had 10 MB.';
  }
  console.error('[ralat]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Ralat pelayan.' });
});

/* ------------------------------------------------------------------ */
/*  Sijil HTTPS untuk kamera telefon (LAN)                             */
/* ------------------------------------------------------------------ */

const CERT_DIR = path.join(__dirname, 'data', 'certs');
const CERT_KEY = path.join(CERT_DIR, 'key.pem');
const CERT_CRT = path.join(CERT_DIR, 'cert.pem');
const CERT_META = path.join(CERT_DIR, 'meta.json');

async function ensureCerts() {
  const lan = lanAddress();
  try {
    if (fs.existsSync(CERT_KEY) && fs.existsSync(CERT_CRT) && fs.existsSync(CERT_META)) {
      const meta = JSON.parse(fs.readFileSync(CERT_META, 'utf8'));
      if (meta.lan === lan) {
        return {
          key: fs.readFileSync(CERT_KEY, 'utf8'),
          cert: fs.readFileSync(CERT_CRT, 'utf8'),
        };
      }
    }
  } catch {
    /* jana semula */
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  const notBeforeDate = new Date();
  const notAfterDate = new Date(notBeforeDate);
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);

  // selfsigned v5: generate() adalah async dan menggunakan notAfterDate (bukan `days`).
  const pems = await selfsigned.generate(
    [{ name: 'commonName', value: `Sistem Nama Majlis (${lan})` }],
    {
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate,
      notAfterDate,
      extensions: [
        { name: 'basicConstraints', cA: false },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
        { name: 'extKeyUsage', serverAuth: true },
        {
          name: 'subjectAltName',
          altNames: [
            { type: 2, value: 'localhost' },
            { type: 7, ip: '127.0.0.1' },
            { type: 7, ip: lan },
          ],
        },
      ],
    }
  );

  if (!pems || !pems.private || !pems.cert) {
    throw new Error('Sijil tidak lengkap dijana.');
  }

  fs.writeFileSync(CERT_KEY, pems.private);
  fs.writeFileSync(CERT_CRT, pems.cert);
  fs.writeFileSync(CERT_META, JSON.stringify({ lan, dibuat: new Date().toISOString() }, null, 2));
  return { key: pems.private, cert: pems.cert };
}

/* ------------------------------------------------------------------ */
/*  Mula                                                               */
/* ------------------------------------------------------------------ */

const server = app.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddress();
  console.log('');
  console.log('  SISTEM NAMA MAJLIS');
  console.log('  ------------------');

  if (CLOUD) {
    const asas = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
    console.log(`  Mod        : AWAN (hosting)`);
    console.log(`  Paparan    : ${asas}/display.html`);
    console.log(`  Pengimbas  : ${asas}/scan.html`);
    console.log(`  Kaunter    : ${asas}/scan.html?mod=daftar`);
    console.log(`  Admin      : ${asas}/admin.html`);
    console.log(`  Keselamatan: ${KUNCI ? 'kunci majlis DIPAKAI' : 'TIADA KUNCI — isi MAJLIS_KUNCI sebelum public'}`);
    console.log('');
    console.log('  Data       :', store.DATA_DIR, '|', process.env.UPLOAD_DIR || 'public/uploads');
    console.log('');
    return;
  }

  const portHttp = tampalPort(PORT, 'http');
  const portHttps = tampalPort(HTTPS_PORT, 'https');
  console.log(`  Paparan   : http://localhost${portHttp}/display.html`);
  console.log(`  Pengimbas : http://localhost${portHttp}/scan.html`);
  console.log(`  Admin     : http://localhost${portHttp}/admin.html`);
  console.log(`  Rangkaian : http://${lan}${portHttp}   <- buka ini di perangkat lain`);
  console.log('');
  console.log(`  Kamera fon: https://${lan}${portHttps}/scan.html`);
  console.log(`              (imbas QR pada http://${lan}${portHttp}/ untuk buka ini di telefon)`);
  console.log('              (Terima amaran sijil sekali sahaja pada telefon.)');
  console.log('');
  console.log('  Nak pautan internet untuk semua perangkat? jalan: npm run online');
  if (KUNCI) {
    console.log('');
    console.log('  Kunci majlis aktif — tambah ?kunci=... pada pautan peranti lain.');
  }
  console.log('');
  console.log('  Tekan Ctrl+C untuk hentikan pelayan.');
  console.log('');
});

let httpsServer = null;

/* Pada hosting, TLS diurus platform (Let's Encrypt). Sijil sendiri hanya
   untuk penggunaan LAN — dan boleh dimatikan dengan HTTPS_PORT=0. */
const HTTPS_AKTIF = !CLOUD && HTTPS_PORT > 0;

(async function startHttps() {
  if (!HTTPS_AKTIF) return;
  try {
    const creds = await ensureCerts();
    httpsServer = https.createServer(creds, app);
    httpsServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`  Port HTTPS ${HTTPS_PORT} sedang digunakan — kamera fon tidak aktif.`);
      } else {
        console.warn('  HTTPS tidak dapat dimulakan:', err.message);
      }
      httpsServer = null;
    });
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      console.log(`  HTTPS     : https://localhost:${HTTPS_PORT} (untuk kamera telefon)`);
    });
  } catch (err) {
    console.warn('  HTTPS tidak dapat dijana:', err.message);
  }
})();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} sedang digunakan. Tutup aplikasi lain atau jalankan: set PORT=3001 && npm start\n`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

function shutdown() {
  console.log('\n  Menutup pelayan...');
  for (const client of sseClients) {
    try {
      client.end();
    } catch {
      /* ignore */
    }
  }
  if (httpsServer) {
    try {
      httpsServer.close();
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
