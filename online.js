'use strict';

/*  online.js — satu arahan untuk mendapatkan pautan internet yang boleh
 *  dibuka oleh semua perangkat (telefon kaunter, laptop admin, projektor),
 *  walaupun tiap-tiap peranti guna Wi-Fi atau data telefon yang berbeza.
 *
 *  Penggunaan:
 *    node online.js                        (port 80, atau port lain jika occupied)
 *    MAJLIS_KUNCI=RAPI-2026 node online.js (paksa kunci tertentu)
 *    PORT=3000 node online.js              (paksa port tertentu)
 *
 *  Fail yang dihasilkan:
 *    kunci.txt           — kunci majlis (kekal antara mulakan; jangan kongsi umum)
 *    pautan-online.txt   — URL public terkini, untuk dicetak/di-lekat di kaunter
 *
 *  Perlukan: internet + cloudflared
 *  Muat turun cloudflared:
 *    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const CLOUDFLARED = process.env.CLOUDFLARED || 'cloudflared';
const FAIL_KUNCI = path.join(__dirname, 'kunci.txt');
const FAIL_PAUTAN = path.join(__dirname, 'pautan-online.txt');

/* ------------------------------------------------------------------ */
/*  Port: pilih yang pertama kali kosong (80 > 3000 > 8080 > 4000)     */
/* ------------------------------------------------------------------ */

function portBebas(port) {
  return new Promise((resolve) => {
    const penguji = net.createServer();
    penguji.once('error', () => resolve(false));
    penguji.once('listening', () => penguji.close(() => resolve(true)));
    /* Sama seperti server.js: bind semua interface (0.0.0.0). */
    penguji.listen(port, '0.0.0.0');
  });
}

/* ------------------------------------------------------------------ */
/*  Kunci: MAJLIS_KUNCI > kunci.txt > jana rawak (lalu disimpan)       */
/* ------------------------------------------------------------------ */

function dapatkanKunci() {
  const daripadaEnv = String(process.env.MAJLIS_KUNCI || '').trim();
  if (daripadaEnv) return { kunci: daripadaEnv, cara: 'MAJLIS_KUNCI (persekitaran)' };
  try {
    const tersimpan = fs.readFileSync(FAIL_KUNCI, 'utf8').trim();
    if (tersimpan) return { kunci: tersimpan, cara: 'kunci.txt (kekal)' };
  } catch {
    /* belum ada fail */
  }
  const baru = crypto.randomBytes(3).toString('hex').toUpperCase();
  try {
    fs.writeFileSync(FAIL_KUNCI, baru + '\n', 'utf8');
  } catch {
    /* abai */
  }
  return { kunci: baru, cara: 'dijana automatik & disimpan ke kunci.txt' };
}

const { kunci: KUNCI, cara: CARA_KUNCI } = dapatkanKunci();

let pautanKini = '';
let penyangga = '';
let cubaan = 0;
let dihentikan = false;
let terowong = null;
let pelayan = null;
let PORT = Number(process.env.PORT) || 80;

/* ------------------------------------------------------------------ */
/*  Output untuk operator & fail untuk kaunter                         */
/* ------------------------------------------------------------------ */

function senaraiPautan(asas) {
  return [
    ['Paparan (projektor)', `${asas}/display.html`],
    ['Pengimbas majlis', `${asas}/scan.html?kunci=${KUNCI}`],
    ['Kaunter daftar hadir', `${asas}/scan.html?mod=daftar&kunci=${KUNCI}`],
    ['Admin', `${asas}/admin.html`],
    ['Bantuan + QR', `${asas}/`],
  ];
}

function paparPautan(asas, baharu) {
  console.log('');
  console.log('  ================================================================');
  console.log('   ' + (baharu ? 'PAUTAN BARU ' : 'PAUTAN ONLINE SIAP ') + '— buka di perangkat mana-mana rangkaian');
  console.log('  ================================================================');
  for (const [label, pautan] of senaraiPautan(asas)) {
    console.log('   ' + label.padEnd(21) + ': ' + pautan);
  }
  console.log('  ----------------------------------------------------------------');
  console.log('   Kunci majlis        : ' + KUNCI + '   (' + CARA_KUNCI + ')');
  console.log('   Cara paling senang  : buka ' + asas + '/admin.html , masukkan kunci,');
  console.log('                         lalu paparkan QR di Kehadiran untuk telefon cikgu.');
  console.log('   Salinan untuk cetak : pautan-online.txt');
  console.log('  ----------------------------------------------------------------');
  console.log('   Kekalkan tetingkap ini terbuka. Ctrl+C untuk berhenti.');
  console.log('');

  const teks = [
    'PAUTAN ONLINE — Sistem Nama Majlis',
    'Dihasilkan: ' + new Date().toLocaleString('ms-MY'),
    'Port pelayan: ' + PORT + (PORT === 80 ? '' : ' (port 80/443 sedang dipakai perisian lain)'),
    '',
    ...senaraiPautan(asas).map(([label, pautan]) => label.padEnd(21) + ': ' + pautan),
    '',
    'Kunci majlis       : ' + KUNCI,
    'QR telefon         : Admin -> Kehadiran -> Pautan kaunter untuk perangkat lain',
    'Nota               : pautan ini bertukar jika terowong dimulakan semula.',
    '',
  ].join('\r\n');
  try {
    fs.writeFileSync(FAIL_PAUTAN, teks, 'utf8');
  } catch {
    /* abai */
  }
}

/* ------------------------------------------------------------------ */
/*  Mula                                                               */
/* ------------------------------------------------------------------ */

(async function mula() {
  const calon = [Number(process.env.PORT) || 80, 3000, 8080, 4000];
  let dipilih = calon[0];
  for (const c of calon) {
    if (await portBebas(c)) {
      dipilih = c;
      break;
    }
    console.log('  Port ' + c + ' sedang dipakai — mencuba port seterusnya...');
  }
  PORT = dipilih;
  const LALUAN_TEMPATAN = `http://127.0.0.1:${dipilih}`;

  console.log('');
  console.log('  Melancarkan pelayan pada port ' + dipilih + '...');

  pelayan = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(dipilih),
      HTTPS_PORT: '0', /* cloudflared memberi HTTPS sebenar — sijil sendiri tak perlu */
      AWAN: '1',
      MAJLIS_KUNCI: KUNCI,
    },
  });

  const saliran = (aliran) => (b) => process[aliran].write(String(b).replace(/^/gm, '  | '));
  pelayan.stdout.on('data', saliran('stdout'));
  pelayan.stderr.on('data', saliran('stderr'));
  pelayan.on('exit', (kod) => {
    if (!dihentikan) {
      console.log('\n  Pelayan berhenti (kod ' + kod + '). Memberhentikan terowong.');
      tutup();
    }
  });

  mulaTerowong(LALUAN_TEMPATAN);
})();

/* Terowong — auto-hidup semula jika mati tengah majlis */
function mulaTerowong(laluanTempatan) {
  penyangga = '';
  terowong = spawn(CLOUDFLARED, ['tunnel', '--url', laluanTempatan, '--no-autoupdate'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const periksa = (b) => {
    penyangga += String(b);
    const padan = penyangga.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (padan && pautanKini !== padan[0]) {
      const sudahPernah = Boolean(pautanKini);
      pautanKini = padan[0];
      cubaan = 0;
      paparPautan(padan[0], sudahPernah);
    }
  };

  terowong.stderr.on('data', periksa);
  terowong.stdout.on('data', periksa);

  terowong.on('error', (err) => {
    if (err && err.code === 'ENOENT') {
      console.log('\n  cloudflared tidak ditemui di dalam sistem.');
      console.log('  Muat turun: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      console.log('  Atau: CLOUDFLARED="C:\\path\\cloudflared.exe" node online.js');
    } else {
      console.log('\n  Ralat terowong: ' + (err && err.message));
    }
    tutup();
  });

  terowong.on('exit', (kod) => {
    if (dihentikan) return;
    cubaan += 1;
    if (cubaan > 6) {
      console.log('\n  Terowong gagal dibuka selepas 6 cubaan. Periksa internet, kemudian mulakan semula.');
      tutup();
      return;
    }
    const saat = Math.min(30, 3 * cubaan);
    console.log('\n  Terowong tertutup (kod ' + kod + '). Mencuba semula dalam ' + saat + ' saat...');
    setTimeout(() => {
      if (!dihentikan) mulaTerowong(laluanTempatan);
    }, saat * 1000);
  });
}

function tutup() {
  if (dihentikan) return;
  dihentikan = true;
  try {
    if (terowong) terowong.kill();
  } catch {
    /* abai */
  }
  try {
    if (pelayan) pelayan.kill();
  } catch {
    /* abai */
  }
  if (pautanKini) console.log('\n  Pautan terakhir: ' + pautanKini + ' (tersimpan dalam pautan-online.txt)\n');
  process.exit(0);
}

process.on('SIGINT', tutup);
process.on('SIGTERM', tutup);
