'use strict';

/*  online.js — satu arahan untuk mendapatkan pautan internet yang boleh
 *  diberikan kepada semua perangkat (telefon kaunter, laptop admin, projektor).
 *
 *  Penggunaan:
 *    node online.js                        (port 80, kunci dijana sekali & disimpan)
 *    MAJLIS_KUNCI=RAPI-2026 node online.js (paksa kunci tertentu)
 *    PORT=3000 node online.js              (jika port 80 occupied)
 *
 *  Fail yang dihasilkan:
 *    kunci.txt        — kunci majlis (kekal antara mulakan; jangan kongsi)
 *    pautan-online.txt — URL public terkini, untuk dibuka/dicetak semula
 *
 *  Perlukan: internet + cloudflared
 *  Muat turun: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 80;
const LALUAN_TEMPATAN = `http://127.0.0.1:${PORT}`;
const CLOUDFLARED = process.env.CLOUDFLARED || 'cloudflared';
const FAIL_KUNCI = path.join(__dirname, 'kunci.txt');
const FAIL_PAUTAN = path.join(__dirname, 'pautan-online.txt');

/* 1. Kunci: teks persekitaran > kunci.txt > jana rawak (lalu disimpan) */
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
    /* fail boleh ditulis kemudian */
  }
  return { kunci: baru, cara: 'dijana automatik & disimpan ke kunci.txt' };
}

const { kunci: KUNCI, cara: CARA_KUNCI } = dapatkanKunci();

let penyangga = '';
let pautanKini = '';
let cubaan = 0;
let dihentikan = false;

function simpanPautan(asas) {
  pautanKini = asas;
  const teks = [
    'PAUTAN ONLINE — Sistem Nama Majlis',
    'Dihasilkan: ' + new Date().toLocaleString('ms-MY'),
    '',
    'Paparan (projektor) : ' + asas + '/display.html',
    'Pengimbas majlis   : ' + asas + '/scan.html?kunci=' + KUNCI,
    'Kaunter daftar     : ' + asas + '/scan.html?mod=daftar&kunci=' + KUNCI,
    'Admin              : ' + asas + '/admin.html',
    'Bantuan + QR       : ' + asas + '/',
    '',
    'Kunci majlis       : ' + KUNCI,
    'QR untuk telefon ada di Admin -> Kehadiran -> Pautan kaunter untuk perangkat lain',
    '',
  ].join('\r\n');
  try {
    fs.writeFileSync(FAIL_PAUTAN, teks, 'utf8');
  } catch {
    /* abai */
  }
  return teks;
}

function paparPautan(asas, baharu) {
  console.log('');
  console.log('  ================================================================');
  console.log('   ' + (baharu ? 'PAUTAN BARU ' : 'PAUTAN ONLINE SIAP ') + '— buka di mana-mana perangkat');
  console.log('  ================================================================');
  console.log('   Paparan (projektor) : ' + asas + '/display.html');
  console.log('   Pengimbas majlis   : ' + asas + '/scan.html?kunci=' + KUNCI);
  console.log('   Kaunter daftar     : ' + asas + '/scan.html?mod=daftar&kunci=' + KUNCI);
  console.log('   Admin              : ' + asas + '/admin.html');
  console.log('   Bantuan + QR       : ' + asas + '/');
  console.log('  ----------------------------------------------------------------');
  console.log('   Kunci majlis       : ' + KUNCI + '   (' + CARA_KUNCI + ')');
  console.log('   Salin fail         : pautan-online.txt (untuk cetak/lekat di kaunter)');
  console.log('   Kod QR telefon pula ada di Admin -> Kehadiran.');
  console.log('  ----------------------------------------------------------------');
  console.log('   Kekalkan tetingkap ini terbuka. Ctrl+C untuk berhenti.');
  console.log('');
  simpanPautan(asas);
}

/* 2. Pelayan */
console.log('');
console.log('  Melancarkan pelayan pada port ' + PORT + '...');

const pelayan = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(PORT),
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

/* 3. Terowong — dengan auto-hidup semula kalau mati tengah majlis */
let terowong = null;

function mulaTerowong() {
  penyangga = '';
  terowong = spawn(CLOUDFLARED, ['tunnel', '--url', LALUAN_TEMPATAN, '--no-autoupdate'], {
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
      console.log('\n  Terowong gagal dibuka selepas 6 kali cubaan. Periksa internet, kemudian mulakan semula.');
      tutup();
      return;
    }
    const saat = Math.min(30, 3 * cubaan);
    console.log('\n  Terowong tertutup (kod ' + kod + '). Mencuba semula dalam ' + saat + ' saat...');
    setTimeout(() => {
      if (!dihentikan) mulaTerowong();
    }, saat * 1000);
  });
}

mulaTerowong();

function tutup() {
  if (dihentikan) return;
  dihentikan = true;
  try {
    if (terowong) terowong.kill();
  } catch {
    /* abai */
  }
  try {
    pelayan.kill();
  } catch {
    /* abai */
  }
  if (pautanKini) console.log('\n  Pautan terakhir: ' + pautanKini + ' (tersimpan dalam pautan-online.txt)\n');
  process.exit(0);
}

process.on('SIGINT', tutup);
process.on('SIGTERM', tutup);
