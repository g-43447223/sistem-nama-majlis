'use strict';

(function display() {
  const { api, beep, ensureAudio } = window.UI;

  const stage = document.getElementById('stage');
  const bg = document.getElementById('bg');
  const idle = document.getElementById('idle');
  const idleLogo = document.getElementById('idleLogo');
  const reveal = document.getElementById('reveal');
  const foto = document.getElementById('foto');
  const nama = document.getElementById('nama');
  const kelas = document.getElementById('kelas');
  const eyebrow = document.getElementById('eyebrow');
  const demoBadge = document.getElementById('demoBadge');
  const queueBadge = document.getElementById('queueBadge');
  const hadirEl = document.getElementById('hadir');
  const totalEl = document.getElementById('total');
  const barFill = document.getElementById('barFill');
  const attendanceBox = document.getElementById('attendanceBox');
  const conn = document.getElementById('conn');
  const soundBtn = document.getElementById('soundBtn');
  const crest = document.getElementById('crest');
  const crestLogo = document.getElementById('crestLogo');

  const state = {
    settings: {
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
    },
    stats: { total: 0, hadir: 0 },
    queue: [],
    showing: false,
    timer: null,
    audioReady: false,
  };

  /* ---------------------------------------------------------------- */
  /*  Jam                                                              */
  /* ---------------------------------------------------------------- */

  function tickClock() {
    const now = new Date();
    document.getElementById('jam').textContent = now.toLocaleTimeString('ms-MY', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    document.getElementById('tarikh').textContent = now
      .toLocaleDateString('ms-MY', { day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
  }

  setInterval(tickClock, 1000);
  tickClock();

  /* ---------------------------------------------------------------- */
  /*  Tetapan & statistik                                              */
  /* ---------------------------------------------------------------- */

  function applySettings(settings) {
    state.settings = { ...state.settings, ...settings };

    document.getElementById('namaSekolah').textContent = state.settings.nama_sekolah || '';
    document.getElementById('tajukMajlis').textContent = state.settings.tajuk_majlis || '';
    document.getElementById('subtajukMajlis').textContent = state.settings.subtajuk || '';
    document.getElementById('footerTajuk').textContent = state.settings.tajuk_majlis || '';

    /* Teks kecil penjuru — kosong melainkan guru menetapkannya di Admin. */
    const cap = document.getElementById('capPenjuru');
    const brandText = document.getElementById('brandText');
    cap.textContent = state.settings.cap_penjuru || '';
    brandText.classList.toggle('blank', !state.settings.cap_penjuru);

    const tajuk = state.settings.tajuk_majlis || 'Paparan Majlis';
    document.title = `Paparan — ${tajuk}`;

    attendanceBox.style.display = state.settings.papar_kehadiran === '1' ? '' : 'none';

    const path = state.settings.background || '';
    if (path) {
      const url = `url("${String(path).replace(/"/g, '\\"')}")`;
      const preload = new Image();
      preload.onload = () => {
        bg.style.backgroundImage = url;
        bg.classList.remove('is-empty');
      };
      preload.onerror = () => {
        bg.style.backgroundImage = '';
        bg.classList.add('is-empty');
      };
      preload.src = path;
    } else {
      bg.style.backgroundImage = '';
      bg.classList.add('is-empty');
    }

    applyIdleLogo(state.settings.logo || '');
    applyCrestLogo(state.settings.logo_sekolah || '');

    /* Mod formal: sembunyi butang bunyi, penanda menunggu & giliran. */
    const formal = state.settings.mod_formal !== '0';
    stage.classList.toggle('formal', formal);
    if (!formal) stage.classList.remove('awake');
  }

  /* Logo sekolah pada penjuru atas kiri. */
  function applyCrestLogo(path) {
    if (!path) {
      crest.classList.remove('has-logo');
      crestLogo.removeAttribute('src');
      return;
    }
    const preload = new Image();
    preload.onload = () => {
      crestLogo.src = path;
      crest.classList.add('has-logo');
    };
    preload.onerror = () => {
      crest.classList.remove('has-logo');
      crestLogo.removeAttribute('src');
    };
    preload.src = path;
  }

  /* Dalam mod formal, kendalian dipaparkan sebentar apabila tetikus bergerak. */
  let awakeTimer = null;
  function wakeControls() {
    if (!stage.classList.contains('formal')) return;
    stage.classList.add('awake');
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(() => stage.classList.remove('awake'), 4000);
  }

  window.addEventListener('pointermove', wakeControls, { passive: true });
  window.addEventListener('keydown', wakeControls);

  /* Logo majlis dipaparkan di tengah skrin semasa menunggu imbasan. */
  const LOGO_SIZES = ['sederhana', 'besar', 'penuh'];

  function applyIdleLogo(path) {
    const size = LOGO_SIZES.includes(state.settings.logo_saiz) ? state.settings.logo_saiz : 'penuh';
    idle.classList.remove('logo-sederhana', 'logo-besar', 'logo-penuh');
    idle.classList.add(`logo-${size}`);

    if (!path) {
      idle.classList.remove('has-logo');
      idleLogo.removeAttribute('src');
      return;
    }

    const preload = new Image();
    preload.onload = () => {
      idleLogo.src = path;
      idle.classList.add('has-logo');
    };
    // Jika fail logo hilang, kembali ke emblem lalai — skrin tidak kosong.
    preload.onerror = () => {
      idle.classList.remove('has-logo');
      idleLogo.removeAttribute('src');
    };
    preload.src = path;
  }

  function applyStats(stats) {
    if (!stats) return;
    state.stats = { ...state.stats, ...stats };
    hadirEl.textContent = state.stats.hadir ?? 0;
    totalEl.textContent = state.stats.total ?? 0;
    const pct = state.stats.total ? Math.round((state.stats.hadir / state.stats.total) * 100) : 0;
    barFill.style.width = `${Math.min(100, pct)}%`;
  }

  function updateQueueBadge() {
    const n = state.queue.length;
    queueBadge.textContent = `${n} nama menunggu`;
    queueBadge.classList.toggle('on', n > 0);
  }

  /* ---------------------------------------------------------------- */
  /*  Paparan murid                                                    */
  /* ---------------------------------------------------------------- */

  function fallbackPhoto(student) {
    foto.onerror = null;
    foto.src = `/api/avatar/${encodeURIComponent(student.id)}`;
  }

  function showStudent(data) {
    if (!data || !data.student) {
      state.showing = false;
      drain();
      return;
    }

    const { student } = data;

    foto.onerror = () => fallbackPhoto(student);
    foto.src = student.foto || `/api/avatar/${encodeURIComponent(student.id)}`;
    foto.alt = `Gambar ${student.nama}`;

    nama.textContent = student.nama;
    kelas.textContent = student.kelas;
    eyebrow.textContent = 'Tahniah';

    demoBadge.classList.toggle('hidden', !data.demo);
    applyStats(data);

    stage.classList.add('showing');
    reveal.classList.remove('is-in');
    void reveal.offsetWidth;
    reveal.classList.add('is-in');

    if (state.settings.bunyi === '1' && state.audioReady) {
      try {
        beep('reveal');
      } catch {
        /* ignore */
      }
    }
    confettiBurst();

    const seconds = Math.max(2, Math.min(30, Number(state.settings.tempoh_paparan) || 6));
    clearTimeout(state.timer);
    state.timer = setTimeout(hide, seconds * 1000);

    // Jika gambar lambat/fail, pastikan paparan tidak tersangkut.
    clearTimeout(state.timerGuard);
    state.timerGuard = setTimeout(() => {
      if (foto.complete && foto.naturalWidth === 0) fallbackPhoto(student);
    }, 1200);
  }

  function hide() {
    stage.classList.remove('showing');
    clearTimeout(state.timer);
    setTimeout(() => {
      reveal.classList.remove('is-in');
      demoBadge.classList.add('hidden');
      state.showing = false;
      drain();
    }, 480);
  }

  function drain() {
    if (state.showing) return;
    if (!state.queue.length) {
      updateQueueBadge();
      return;
    }
    const next = state.queue.shift();
    state.showing = true;
    updateQueueBadge();
    showStudent(next);
  }

  function enqueue(data) {
    if (!data || !data.student) return;
    if (state.queue.length > 40) state.queue.splice(0, state.queue.length - 40);
    state.queue.push(data);
    updateQueueBadge();
    drain();
  }

  /* ---------------------------------------------------------------- */
  /*  Confetti ringan                                                  */
  /* ---------------------------------------------------------------- */

  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;

  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  function confettiBurst() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const colors = ['#f0d99a', '#d8b45f', '#f7f2e7', '#7fb7a1', '#c98f4a'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.34;

    for (let i = 0; i < 110; i += 1) {
      const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.9;
      const speed = 5 + Math.random() * 9;
      particles.push({
        x: cx + (Math.random() - 0.5) * 120,
        y: cy + (Math.random() - 0.5) * 60,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 3 + Math.random() * 6,
        h: 5 + Math.random() * 9,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.28,
        color: colors[(Math.random() * colors.length) | 0],
        life: 1,
        decay: 0.006 + Math.random() * 0.006,
      });
    }

    if (!rafId) rafId = requestAnimationFrame(animateConfetti);
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const p of particles) {
      p.vy += 0.16;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.decay;

      if (p.life <= 0 || p.y > window.innerHeight + 40) continue;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    particles = particles.filter((p) => p.life > 0 && p.y <= window.innerHeight + 40);

    if (particles.length) {
      rafId = requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      rafId = null;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Bunyi                                                            */
  /* ---------------------------------------------------------------- */

  function unlockAudio() {
    try {
      const ctxAudio = ensureAudio();
      if (ctxAudio && ctxAudio.state === 'running') {
        state.audioReady = true;
        soundBtn.classList.add('hidden');
        beep('ok');
      }
    } catch {
      /* ignore */
    }
  }

  soundBtn.addEventListener('click', unlockAudio);
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  /* ---------------------------------------------------------------
     Hampiran gantian: jika sambungan langsung tersumbat (contohnya
     terowong/proxy yang menyimpan buffer), paparan akan bertanya
     pelayan setiap 2 saat supaya nama tetap keluar.
     --------------------------------------------------------------- */

  let nadiSambungan = Date.now();
  let papanSejak = Date.now();
  let papanSibuk = false;
  let tetapanCap = '';

  function tandaHidup() {
    nadiSambungan = Date.now();
  }

  async function hirapPapan() {
    if (papanSibuk) return;
    papanSibuk = true;
    try {
      const data = await api('/api/papan?sejak=' + papanSejak, { tanyaKunci: false });
      const cap = JSON.stringify(data.settings || {});
      if (cap !== tetapanCap) {
        tetapanCap = cap;
        applySettings(data.settings || {});
      }
      applyStats(data);
      for (const reveal of data.reveal || []) {
        if (reveal.at > papanSejak) papanSejak = reveal.at;
        enqueue(reveal);
      }
    } catch {
      /* pelayan belum sedia — cuba lagi pada giliran berikutnya */
    } finally {
      papanSibuk = false;
    }
  }

  setInterval(() => {
    /* Guna hampiran bila sambungan langsung diam lebih ~1.8 saat.
       Pada LAN, SSE sentiasa hidup jadi tiada hampiran diperlukan. */
    if (Date.now() - nadiSambungan > 1800) hirapPapan();
  }, 1200);

  /* ---------------------------------------------------------------- */
  /*  Sambungan langsung                                               */
  /* ---------------------------------------------------------------- */

  let source = null;
  let sambungSemula = null;

  function connect() {
    if (source) source.close();

    source = new EventSource('/api/events');

    /* Setiap peristiwa menghidupkan "nadi"; adanya nadi = tidak perlu hirap. */
    const dengar = (nama, fungsi) => {
      source.addEventListener(nama, (event) => {
        tandaHidup();
        try {
          fungsi(event && event.data ? JSON.parse(event.data) : {});
        } catch (err) {
          if (nama === 'reveal') console.error(err);
        }
      });
    };

    dengar('hello', () => conn.classList.remove('on'));

    dengar('reveal', (data) => {
      if (data.at) papanSejak = Math.max(papanSejak, data.at);
      enqueue(data);
    });

    dengar('stats', (data) => applyStats(data));

    dengar('settings', (data) => applySettings(data));

    dengar('reset', (data) => {
      applyStats(data);
      state.queue = [];
      papanSejak = Date.now();
      updateQueueBadge();
      if (state.showing) hide();
    });

    dengar('students', (data) => applyStats(data));

    source.addEventListener('error', () => {
      conn.classList.add('on');
      /* Pelayar kadangkala menyerah mencuba semula (contohnya selepas pelayan
         dimulakan semula atau tab pernah tidur). Paksa sambungan baru. */
      clearTimeout(sambungSemula);
      sambungSemula = setTimeout(() => {
        if (!source || source.readyState === EventSource.CLOSED) connect();
      }, 3000);
    });

    source.addEventListener('open', () => {
      conn.classList.remove('on');
      tandaHidup();
      clearTimeout(sambungSemula);
    });
  }

  /* Peninjau: pastikan paparan sentiasa bersambung walaupun tab ditinggalkan. */
  setInterval(() => {
    if (!source || source.readyState === EventSource.CLOSED) connect();
  }, 10000);

  /* ---------------------------------------------------------------- */
  /*  Mula                                                             */
  /* ---------------------------------------------------------------- */

  (async function boot() {
    try {
      const info = await api('/api/bootstrap');
      applySettings(info.settings);
      applyStats(info);
    } catch (err) {
      console.error(err);
      conn.classList.add('on');
    }
    connect();
  })();

  // Kekalkan skrin hidup jika tab dipaparkan semula.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && source && source.readyState === EventSource.CLOSED) connect();
  });
})();
