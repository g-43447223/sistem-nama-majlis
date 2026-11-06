'use strict';

/*  online.js — satu arahan untuk mendapatkan pautan internet yang boleh
 *  diberikan kepada semua perangkat (telefon kaunter, laptop admin, projektor).
 *
 *  Penggunaan:
 *    node online.js                       (port 80, kunci dijana automatik)
 *    MAJLIS_KUNCI=RAPI-2026 node online.js (guna kunci anda sendiri)
 *    PORT=3000 node online.js             (jika port 80 occupied)
 *
 *  Perlu: internet + cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
 *  Nota:  jika MAJLIS_KUNCI tidak diberi, satu kunci rawak dijana supaya
 *         pelayan public tidak boleh diubah suai oleh orang luar.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 80;
const LALUAN_TEMPATAN = `http://127.0.0.1:${PORT}`;
const CLOUDFLARED = process.env.CLOUDFLARED || 'cloudflared';

const kunciDiberi = String(process.env.MAJLIS_KUNCI || '').trim();
const KUNCI = kunciDiberi || crypto.randomBytes(3).toString('hex').toUpperCase();
const KUNCI_DIJANA = !kunciDiberi;

let selesai = false;
let penyangga = '';

const pelayan = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(PORT),
    HTTPS_PORT: '0', /* cloudflared mengurus HTTPS — sijil sendiri tidak perlu */
    AWAN: '1',
    MAJLIS_KUNCI: KUNCI,
  },
});

const cetak = (aliran) => (b) => process[aliran].write(String(b).replace(/^/gm, '  | '));
pelayan.stdout.on('data', cetak('stdout'));
pelayan.stderr.on('data', cetak('stderr'));
pelayan.on('exit', (kod) => {
  if (kod && kod !== 0 && kod !== null) console.log('\n  Pelayan berhenti (kod ' + kod + ').');
  tutup();
});

function papar(asas) {
  console.log('');
  console.log('  ================================================================');
  console.log('   PAUTAN ONLINE SIAP — buka di mana-mana perangkat, mana-mana rangkaian');
  console.log('  ================================================================');
  console.log('   Paparan (projektor) : ' + asas + '/display.html');
  console.log('   Pengimbas majlis   : ' + asas + '/scan.html?kunci=' + KUNCI);
  console.log('   Kaunter daftar     : ' + asas + '/scan.html?mod=daftar&kunci=' + KUNCI);
  console.log('   Admin              : ' + asas + '/admin.html');
  console.log('   Bantuan + QR       : ' + asas + '/');
  console.log('  ----------------------------------------------------------------');
  console.log('   Kunci majlis       : ' + KUNCI + (KUNCI_DIJANA ? '   (dijana automatik)' : ''));
  console.log('   Buka ' + asas + '/ di laptop, tekan QR pada skrin untuk');
  console.log('   menghantar telefon ke halaman pengimbas tanpa menaip.');
  console.log('  ----------------------------------------------------------------');
  console.log('   Kekalkan tetingkap ini terbuka. Ctrl+C untuk berhenti.');
  console.log('');
}

const terowong = spawn(CLOUDFLARED, ['tunnel', '--url', LALUAN_TEMPATAN, '--no-autoupdate'], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
});

terowong.stderr.on('data', (b) => {
  penyangga += String(b);
  const padan = penyangga.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (padan && !selesai) {
    selesai = true;
    papar(padan[0]);
    penyangga = '';
  }
});
terowong.stdout.on('data', (b) => {
  const padan = String(b).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (padan && !selesai) {
    selesai = true;
    papar(padan[0]);
  }
});

terowong.on('error', (err) => {
  if (err && err.code === 'ENOENT') {
    console.log('\n  cloudflared tidak ditemui.');
    console.log('  Muat turun: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    console.log('  Atau letak lokasi fail: CLOUDFLARED="C:\\path\\cloudflared.exe" node online.js');
  } else {
    console.log('\n  Gagal membuka terowong: ' + (err && err.message));
  }
  tutup();
});

terowong.on('exit', (kod) => {
  if (!selesai) console.log('\n  Terowong ditutup (kod ' + kod + '). Semak sambungan internet.');
  tutup();
});

function tutup() {
  try {
    terowong.kill();
  } catch {
    /* abai */
  }
  try {
    pelayan.kill();
  } catch {
    /* abai */
  }
  process.exit(0);
}

process.on('SIGINT', tutup);
process.on('SIGTERM', tutup);

console.log('');
console.log('  Menyambungkan ke internet melalui cloudflared...');
