'use strict';

/* Utiliti dikongsi semua halaman */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

async function api(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };

  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, opts);
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.error) || (typeof data === 'string' && data) || 'Ralat pelayan.';
    const err = new Error(message);
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, kind = '') {
  let host = document.getElementById('toast');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`.trim();
  el.textContent = message;
  host.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, 3400);
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter((w) => w && !/^(bin|binti|bt|a\/l|anak)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function fmtTime(ms, withDate = false) {
  const d = new Date(Number(ms) || Date.now());
  const time = d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (!withDate) return time;
  return d.toLocaleString('ms-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* Bunyi ringkas guna Web Audio (tiada fail luaran) */
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep(kind = 'ok') {
  const ctx = ensureAudio();
  if (!ctx) return;

  const notes = {
    ok: [
      [660, 0.0],
      [880, 0.09],
      [1320, 0.18],
    ],
    duplicate: [
      [440, 0.0],
      [330, 0.12],
    ],
    bad: [
      [220, 0.0],
      [180, 0.14],
    ],
    reveal: [
      [523.25, 0.0],
      [659.25, 0.1],
      [783.99, 0.2],
      [1046.5, 0.32],
    ],
  }[kind] || [];

  for (const [freq, delay] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + 0.4);
  }
}

function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

window.UI = { $, $$, esc, api, toast, initials, fmtTime, beep, ensureAudio, debounce };
