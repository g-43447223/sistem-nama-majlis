/* ------------------------------------------------------------------
 * Kempa gambar murid yang SUDAH masuk ke sistem.
 *
 *   node tools/kempa-gambar.js            → kempa semua
 *   node tools/kempa-gambar.js --semak    → kira jimat sahaja, tak ubah
 *
 * Logo, crest & background TIDAK disentuh — hanya gambar yang
 * dirujuk lajur students.foto. Saiz sasaran: sisi panjang ≤1000px,
 * JPEG kualiti 85 (sama dengan kempa automatik semasa import).
 * ------------------------------------------------------------------ */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const store = require('../db');

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'public', 'uploads');

const PANJANG = 1000;
const KUALITI = 85;
const SEMAK = process.argv.includes('--semak');

/* Elak SQLITE_BUSY kalau pelayan masih berjalan (WAL). */
try {
  store.db.exec('PRAGMA busy_timeout = 8000;');
} catch {
  /* abai */
}

(async () => {
  const rows = store.db
    .prepare("SELECT id, nama, foto FROM students WHERE foto LIKE '/uploads/%'")
    .all();

  let sebelum = 0;
  let selepas = 0;
  let dikempa = 0;
  let dikekalkan = 0;
  const ralat = [];

  for (const r of rows) {
    const full = path.join(UPLOAD_DIR, path.basename(r.foto));
    if (!fs.existsSync(full)) {
      ralat.push(`${r.nama}: fail hilang (${r.foto})`);
      continue;
    }

    const saizAsal = fs.statSync(full).size;
    sebelum += saizAsal;

    let meta;
    try {
      meta = await sharp(full, { failOn: 'none' }).metadata();
    } catch {
      ralat.push(`${r.nama}: tak dapat dibaca`);
      selepas += saizAsal;
      continue;
    }

    const panjang = Math.max(meta.width || 0, meta.height || 0);
    const ext = path.extname(full).toLowerCase();
    const sudahPatut = panjang <= PANJANG && saizAsal <= 350 * 1024 && (ext === '.jpg' || ext === '.jpeg');

    if (sudahPatut) {
      dikekalkan += 1;
      selepas += saizAsal;
      continue;
    }

    const tujuan = full.replace(/\.([a-z0-9]+)$/i, '') + '.jpg';

    if (SEMAK) {
      /* Anggaran sahaja — jangan tulis apa-apa. */
      dikempa += 1;
      selepas += Math.round(saizAsal * 0.06);
      continue;
    }

    try {
      const sementara = tujuan + '.tmp';
      await sharp(full, { failOn: 'none' })
        .rotate()
        .resize({ width: PANJANG, height: PANJANG, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: KUALITI, mozjpeg: true })
        .toFile(sementara, { force: true });
      fs.renameSync(sementara, tujuan);

      const saizBaru = fs.statSync(tujuan).size;
      selepas += saizBaru;
      dikempa += 1;

      if (tujuan !== full) {
        fs.rmSync(full, { force: true });
        const webBaru = `/uploads/${path.basename(tujuan)}`;
        store.db.prepare('UPDATE students SET foto = ? WHERE id = ?').run(webBaru, r.id);
      }
    } catch (e) {
      ralat.push(`${r.nama}: ${e.message}`);
      selepas += saizAsal;
    }
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB';
  console.log(SEMAK ? '== ANGGARAN (tiada perubahan dibuat) ==' : '== SELESAI KEMPA ==');
  console.log(`   rujukan diperiksa : ${rows.length}`);
  console.log(`   dikempa           : ${dikempa}`);
  console.log(`   sudah cukup kecil : ${dikekalkan}`);
  console.log(`   saiz sebelum      : ${mb(sebelum)}`);
  console.log(`   saiz selepas      : ${mb(selepas)}${SEMAK ? ' (anggaran)' : ''}`);
  console.log(`   jimat             : ${mb(sebelum - selepas)}`);
  if (ralat.length) {
    console.log('   RALAT:');
    for (const e of ralat) console.log(`     - ${e}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error('RALAT:', e);
  process.exit(1);
});
