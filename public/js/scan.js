'use strict';

(function scanner() {
  const { api, toast, beep, ensureAudio, fmtTime } = window.UI;

  const form = document.getElementById('scanForm');
  const input = document.getElementById('kod');
  const submitBtn = document.getElementById('submitBtn');
  const result = document.getElementById('result');
  const resultIcon = document.getElementById('resultIcon');
  const resultBody = document.getElementById('resultBody');
  const statusPill = document.getElementById('statusPill');
  const statusText = document.getElementById('statusText');
  const camPanel = document.getElementById('camPanel');
  const camVideo = document.getElementById('cam');
  const camBtn = document.getElementById('camBtn');
  const camClose = document.getElementById('camClose');
  const camStatus = document.getElementById('camStatus');

  const recentList = document.getElementById('recentList');
  const recentEmpty = document.getElementById('recentEmpty');
  const recentCount = document.getElementById('recentCount');
  const modeSwitch = document.getElementById('modeSwitch');
  const modeNote = document.getElementById('modeNote');

  const MOD = {
    papar: {
      tajuk: 'Imbas kad murid',
      petua:
        'Guna mesin scanner USB — kod akan dihantar terus ke skrin paparan. Atau buka kamera fon untuk mengimbas kad QR murid.',
      nota: 'Nama murid akan <b>terpapar di skrin projektor</b> selepas kad diimbas.',
      sedia: 'Setiap kad hanya dipaparkan sekali.',
      labelOk: 'Dipaparkan',
      labelDup: 'Sudah dipaparkan',
    },
    daftar: {
      tajuk: 'Daftar kehadiran di kaunter',
      petua:
        'Imbas kad QR murid ketika mereka tiba. Murid direkod sebagai HADIR tetapi nama TIDAK keluar di skrin paparan.',
      nota:
        'Mod kaunter: imbasan <b>tidak dipaparkan</b> di skrin majlis. Nama boleh dipaparkan kemudian semasa majlis.',
      sedia: 'Kad direkod sebagai hadir sahaja — tiada paparan skrin.',
      labelOk: 'Didaftar',
      labelDup: 'Sudah daftar',
    },
  };

  let mod = 'papar';

  const icons = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.6 17a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
    bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    idle:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 8V6a2 2 0 012-2h2M20 8V6a2 2 0 00-2-2h-2M4 16v2a2 2 0 002 2h2M20 16v2a2 2 0 01-2 2h-2"/><path d="M4 12h16"/></svg>',
  };

  let info = null;
  let busy = false;
  let recent = [];
  let camOpen = false;
  let camStream = null;
  let camTimer = null;
  let detector = null;
  let jsQrReady = false;
  let lastCode = '';
  let lastCodeAt = 0;

  /* ---------------------------------------------------------------- */
  /*  Paparan keputusan                                                */
  /* ---------------------------------------------------------------- */

  function setResult(kind, data = {}) {
    result.className = `result${kind && kind !== 'idle' ? ' ' + kind : ''}`;
    result.classList.toggle('has-photo', kind === 'ok' || kind === 'warn');

    if ((kind === 'ok' || kind === 'warn') && data.student) {
      const s = data.student;
      resultIcon.innerHTML = `<img class="result-photo" src="${
        s.foto || '/api/avatar/' + encodeURIComponent(s.id)
      }" alt="" onerror="this.onerror=null;this.src='/api/avatar/${encodeURIComponent(s.id)}'">`;
      resultBody.innerHTML = `
        <h3>${escapeHtml(s.nama)}</h3>
        <div class="meta">
          <b>${escapeHtml(s.kelas)}</b>
          <span>${escapeHtml(s.kod)}</span>
          <span class="result-time">${fmtTime(Date.now())}</span>
        </div>
        <div class="msg">${escapeHtml(data.message || '')}</div>`;
      return;
    }

    if (kind === 'bad') {
      resultIcon.innerHTML = icons.bad;
      resultBody.innerHTML = `
        <h3>Kod tidak dikenali</h3>
        <div class="meta"><span>${escapeHtml(data.kod || '')}</span></div>
        <div class="msg">${escapeHtml(data.message || 'Kod ini tiada dalam senarai murid.')}</div>`;
      return;
    }

    resultIcon.innerHTML = icons.idle;
    resultBody.innerHTML = `
      <h3>${mod === 'daftar' ? 'Sedia untuk daftar hadir' : 'Sedia untuk mengimbas'}</h3>
      <div class="meta"><span>${MOD[mod].sedia}</span></div>`;
  }

  function escapeHtml(value) {
    return window.UI.esc(value);
  }

  /* ---------------------------------------------------------------- */
  /*  Statistik & senarai terkini                                     */
  /* ---------------------------------------------------------------- */

  function applyStats(stats) {
    if (!stats) return;
    const total = stats.total ?? 0;
    const hadir = stats.hadir ?? 0;
    document.getElementById('sHadir').textContent = hadir;
    document.getElementById('sTotal').textContent = total;
    document.getElementById('sBelum').textContent = Math.max(0, total - hadir);
  }

  function pushRecent(kind, data) {
    const teks = MOD[mod];
    recent.unshift({
      kind,
      nama: data.student ? data.student.nama : 'Kod tidak dikenali',
      kelas: data.student ? data.student.kelas : data.kod || '',
      foto: data.student ? data.student.foto : '',
      kod: data.student ? data.student.kod : data.kod || '',
      masa: fmtTime(Date.now()),
      label:
        kind === 'ok' ? teks.labelOk : kind === 'warn' ? teks.labelDup : 'Tidak dikenali',
    });
    recent = recent.slice(0, 8);
    renderRecent();
  }

  function renderRecent() {
    recentEmpty.classList.toggle('hidden', recent.length > 0);
    recentCount.textContent = recent.length ? `${recent.length} terkini` : '0';
    recentList.innerHTML = recent
      .map(
        (r) => `
        <li>
          ${
            r.foto
              ? `<img class="recent-avatar" src="${escapeHtml(r.foto)}" alt="" onerror="this.style.display='none'">`
              : `<span class="recent-avatar" style="display:grid;place-items:center;font-size:.7rem;color:#d8b45f">${escapeHtml(
                  window.UI.initials(r.nama)
                )}</span>`
          }
          <div class="recent-info">
            <b>${escapeHtml(r.nama)}</b>
            <small>${escapeHtml(r.kelas)}${r.kelas ? ' · ' : ''}${escapeHtml(r.label)}</small>
          </div>
          <span class="recent-time">${escapeHtml(r.masa)}</span>
        </li>`
      )
      .join('');
  }

  /* ---------------------------------------------------------------- */
  /*  Mod imbasan: paparan nama / daftar hadir sahaja                  */
  /* ---------------------------------------------------------------- */

  function setMode(next, opts = {}) {
    mod = next === 'daftar' ? 'daftar' : 'papar';
    const teks = MOD[mod];

    document.querySelectorAll('.mode-btn').forEach((btn) => {
      const aktif = btn.dataset.mod === mod;
      btn.classList.toggle('active', aktif);
      btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });
    document.body.classList.toggle('mode-daftar', mod === 'daftar');

    const recentHead = document.querySelector('.recent-head b');
    if (recentHead) recentHead.textContent = mod === 'daftar' ? 'Daftar terakhir' : 'Imbasan terakhir';

    const tajuk = document.getElementById('scanTajuk');
    const petua = document.getElementById('scanPetua');
    if (tajuk) tajuk.textContent = teks.tajuk;
    if (petua) petua.textContent = teks.petua;
    if (modeNote) modeNote.innerHTML = teks.nota;

    document.title = `${mod === 'daftar' ? 'Daftar Hadir' : 'Pengimbas'} — ${
      (info && info.settings && info.settings.tajuk_majlis) || 'Sistem Nama Majlis'
    }`;

    setResult('idle');
    renderRecent();

    try {
      if (opts.simpan !== false) window.localStorage.setItem('scan.mod', mod);
      const url = new URL(window.location.href);
      url.searchParams.set('mod', mod);
      window.history.replaceState(null, '', url);
    } catch {
      /* pelayar lama: abaikan */
    }
  }

  if (modeSwitch) {
    modeSwitch.addEventListener('click', (event) => {
      const btn = event.target.closest('.mode-btn');
      if (!btn || btn.dataset.mod === mod) return;
      setMode(btn.dataset.mod);
      toast(
        mod === 'daftar'
          ? 'Mod kaunter aktif — imbasan TIDAK akan keluar di skrin majlis.'
          : 'Mod paparan aktif — nama akan keluar di skrin majlis.',
        'warn'
      );
      input.focus();
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Hantar imbasan                                                   */
  /* ---------------------------------------------------------------- */

  async function submitScan(rawKod, source) {
    const kod = String(rawKod || '').trim();
    if (!kod || busy) return;

    busy = true;
    submitBtn.disabled = true;

    try {
      const data = await api('/api/scan', {
        method: 'POST',
        body: { kod, source, mod },
      });

      applyStats(data);

      if (data.status === 'ok') {
        const mesej =
          data.mod === 'daftar'
            ? `${data.student.nama} — ${data.student.kelas} · direkod hadir (tiada paparan skrin)`
            : data.message;
        setResult('ok', { ...data, message: mesej });
        pushRecent('ok', data);
        beep('ok');
        camStatus.textContent = `Berjaya: ${data.student.nama}`;
      } else if (data.status === 'duplicate') {
        setResult('warn', {
          ...data,
          message: `${data.message || 'Sudah diimbas.'}${data.atLabel ? ` (${data.atLabel})` : ''}`,
        });
        pushRecent('warn', data);
        beep('duplicate');
        camStatus.textContent = `Sudah diimbas: ${data.student.nama}`;
      } else {
        setResult('bad', data);
        pushRecent('bad', data);
        beep('bad');
        camStatus.textContent = 'Kod tidak dikenali.';
      }

      setOnline(true);
    } catch (err) {
      console.error(err);
      setOnline(false);
      toast(err.message || 'Gagal menghubungi pelayan.', 'bad');
      beep('bad');
    } finally {
      busy = false;
      submitBtn.disabled = false;
      if (!camOpen) input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const kod = input.value.trim();

    if (!kod) {
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      input.focus();
      return;
    }

    input.value = '';
    submitScan(kod, 'scanner');
    input.focus();
  });

  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    try {
      input.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  });

  document.addEventListener('keydown', () => {
    ensureAudio();
  }, { once: true });

  // Fokus semula medan apabila pengguna klik ruang kosong.
  document.addEventListener('click', (event) => {
    if (camOpen) return;
    if (event.target.closest('button, a, input, textarea, select, video, .cam')) return;
    input.focus();
  });

  setInterval(() => {
    if (!camOpen && document.activeElement === document.body) input.focus();
  }, 1200);

  /* ---------------------------------------------------------------- */
  /*  Kamera                                                           */
  /* ---------------------------------------------------------------- */

  function loadJsQr() {
    if (jsQrReady) return Promise.resolve();
    if (window.jsQR) {
      jsQrReady = true;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/jsQR.js';
      script.onload = () => {
        jsQrReady = Boolean(window.jsQR);
        resolve();
      };
      script.onerror = () => reject(new Error('Gagal memuatkan pengimbas QR.'));
      document.head.appendChild(script);
    });
  }

  async function setupDetector() {
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes('qr_code')) {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          return;
        }
      } catch {
        /* guna jsQR */
      }
    }
    await loadJsQr();
  }

  const scanCanvas = document.createElement('canvas');
  const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });

  async function detectFrame() {
    if (!camOpen || camVideo.readyState < 2) return;

    let value = '';

    if (detector) {
      try {
        const codes = await detector.detect(camVideo);
        if (codes && codes.length) value = codes[0].rawValue || '';
      } catch {
        // BarcodeDetector gagal pada peranti ini — tukar ke jsQR.
        detector = null;
        try {
          await loadJsQr();
        } catch {
          return;
        }
        if (camOpen) camStatus.textContent = 'Halakan kamera ke kod QR (mod serasi)…';
      }
    }

    if (!value && window.jsQR) {
      try {
        const width = 520;
        const ratio = camVideo.videoHeight / camVideo.videoWidth || 1;
        const height = Math.round(width * ratio);
        scanCanvas.width = width;
        scanCanvas.height = height;
        scanCtx.drawImage(camVideo, 0, 0, width, height);
        const image = scanCtx.getImageData(0, 0, width, height);
        const found = window.jsQR(image.data, width, height, { inversionAttempts: 'dontInvert' });
        if (found) value = found.data || '';
      } catch {
        return;
      }
    }

    value = value.trim();
    if (!value) return;

    const now = Date.now();
    if (value === lastCode && now - lastCodeAt < 3000) return;
    lastCode = value;
    lastCodeAt = now;

    camStatus.textContent = `Dikesan: ${value}`;
    submitScan(value, 'kamera');
  }

  async function openCamera() {
    ensureAudio();

    if (!window.isSecureContext) {
      toast('Kamera perlukan sambungan selamat. Membuka versi HTTPS…', 'warn');
      setTimeout(() => {
        if (info && info.urls && info.urls.kamera) window.location.href = info.urls.kamera;
      }, 900);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Peranti ini tidak menyokong akses kamera. Guna mesin scanner USB.', 'bad');
      return;
    }

    camOpen = true;
    camPanel.classList.remove('hidden');
    camBtn.disabled = true;
    camStatus.textContent = 'Membuka kamera…';

    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      camVideo.srcObject = camStream;
      await camVideo.play();

      await setupDetector();

      camStatus.textContent = detector
        ? 'Halakan kamera ke kod QR…'
        : 'Halakan kamera ke kod QR (mod serasi)…';

      clearInterval(camTimer);
      camTimer = setInterval(detectFrame, 240);
    } catch (err) {
      console.error(err);
      camOpen = false;
      camPanel.classList.add('hidden');
      camBtn.disabled = false;

      let message = 'Kamera tidak dapat dibuka.';
      if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        message = 'Kebenaran kamera ditolak. Benarkan akses kamera pada pelayar.';
      } else if (err && err.name === 'NotFoundError') {
        message = 'Tiada kamera dikesan pada peranti ini.';
      } else if (err && err.name === 'NotReadableError') {
        message = 'Kamera sedang digunakan oleh aplikasi lain.';
      }
      toast(message, 'bad');
      input.focus();
    }
  }

  function closeCamera() {
    camOpen = false;
    clearInterval(camTimer);
    camTimer = null;

    if (camStream) {
      for (const track of camStream.getTracks()) track.stop();
      camStream = null;
    }
    camVideo.srcObject = null;
    camPanel.classList.add('hidden');
    camBtn.disabled = false;
    lastCode = '';
    input.focus();
  }

  camBtn.addEventListener('click', () => {
    if (camOpen) closeCamera();
    else openCamera();
  });

  camClose.addEventListener('click', closeCamera);

  window.addEventListener('beforeunload', () => {
    if (camStream) for (const track of camStream.getTracks()) track.stop();
  });

  /* ---------------------------------------------------------------- */
  /*  Status sambungan                                                 */
  /* ---------------------------------------------------------------- */

  function setOnline(online) {
    statusPill.classList.toggle('off', !online);
    statusText.textContent = online ? 'Bersambung' : 'Terputus';
  }

  function connectEvents() {
    const source = new EventSource('/api/events');

    source.addEventListener('open', () => setOnline(true));

    source.addEventListener('stats', (event) => {
      try {
        applyStats(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('reset', (event) => {
      try {
        applyStats(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
      recent = [];
      renderRecent();
      setResult('idle');
      toast('Rekod kehadiran telah dikosongkan.', 'warn');
    });

    source.addEventListener('students', (event) => {
      try {
        applyStats(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('error', () => setOnline(false));
  }

  /* ---------------------------------------------------------------- */
  /*  Mula                                                             */
  /* ---------------------------------------------------------------- */

  (async function boot() {
    try {
      info = await api('/api/bootstrap');
      applyStats(info);

      if (info.settings && info.settings.nama_sekolah) {
        document.getElementById('namaSekolah').textContent = `${info.settings.nama_sekolah} · Pengimbas`;
      }
      if (info.settings && info.settings.tajuk_majlis) {
        document.title = `Pengimbas — ${info.settings.tajuk_majlis}`;
      }

      // Beri amaran jika dibuka melalui HTTP pada telefon (kamera tak dibenarkan).
      if (!window.isSecureContext) {
        camBtn.title = 'Kamera memerlukan versi HTTPS';
      }

      // Mod: ?mod=daftar > localStorage > papar (lalai selamat untuk majlis)
      const param = new URLSearchParams(window.location.search).get('mod');
      let tersimpan = null;
      try {
        tersimpan = window.localStorage.getItem('scan.mod');
      } catch {
        /* mod privasi */
      }
      setMode(param || tersimpan || 'papar', { simpan: Boolean(param) });
    } catch (err) {
      setOnline(false);
      toast('Pelayan tidak dapat dihubungi. Pastikan ia masih berjalan.', 'bad');
    }

    renderRecent();
    input.focus();
    connectEvents();

    setTimeout(() => input.focus(), 300);
  })();
})();
