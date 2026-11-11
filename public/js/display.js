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
  const anugerah = document.getElementById('anugerah');
  const anugerahTeks = document.getElementById('anugerahTeks');
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
      papar_anugerah: '1',
      ganggu_serta_merta: '1',
      papar_kekal: '0',
    },
    stats: { total: 0, hadir: 0 },
    anugerahSemasa: '',
    queue: [],
    showing: false,
    timer: null,
    timerGanti: null,
    mulaTayang: 0,
    gantiTangguh: null,
    audioReady: false,
  };

  /* Pelindung supaya skrin tidak berkelip bila pengimbas menghantar
     dua kod dalam masa yang sangat dekat. */
  const TAHAN_MIN = 900;

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

    /* Suis anugerah boleh ditukar ketika majlis — kemas kini plat segera. */
    paparAnugerah(state.anugerahSemasa);
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

  /* Kekunci pintasan pada komputer projektor: Esc atau Space = kembali ke logo. */
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' && event.code !== 'Space' && event.key !== ' ') return;
    const target = event.target;
    const adaFokusInteraktif =
      target &&
      target !== document.body &&
      typeof target.closest === 'function' &&
      target.closest('button, a, input, select, textarea, video');
    if (adaFokusInteraktif) return;
    event.preventDefault();
    kembaliLogo();
  });

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
    foto.classList.add('avatar');
  }

  /* Plat anugerah: kosong = tiada elemen dipaparkan (susun atur kekal sama). */
  function paparAnugerah(teks) {
    const nilai = String(teks || '').trim();
    const nampak = Boolean(nilai) && state.settings.papar_anugerah !== '0';

    reveal.classList.toggle('punya-anugerah', nampak);
    anugerah.classList.toggle('hidden', !nampak);
    anugerah.classList.toggle('a-sederhana', nampak && nilai.length > 28 && nilai.length <= 46);
    anugerah.classList.toggle('a-panjang', nampak && nilai.length > 46);
    anugerahTeks.textContent = nampak ? nilai : '';
  }

  function showStudent(data) {
    if (!data || !data.student) {
      state.showing = false;
      drain();
      return;
    }

    const { student } = data;

    foto.onerror = () => fallbackPhoto(student);
    const puncaFoto = student.foto || `/api/avatar/${encodeURIComponent(student.id)}`;
    foto.src = puncaFoto;
    foto.alt = `Gambar ${student.nama}`;
    /* Avatar janaan adalah segi empat: biarkannya utuh dalam bingkai potret. */
    foto.classList.toggle('avatar', String(puncaFoto).startsWith('/api/avatar'));

    nama.textContent = student.nama;
    kelas.textContent = student.kelas;
    eyebrow.textContent = 'Tahniah';

    /* Skala saiz nama ikut panjang — lajur kanan lebih sempit sekarang. */
    const aksara = String(student.nama || '').trim().length;
    nama.classList.toggle('nama-panjang', aksara > 26 && aksara <= 44);
    nama.classList.toggle('nama-sangat-panjang', aksara > 44);

    paparAnugerah(student.anugerah);
    state.anugerahSemasa = student.anugerah || '';

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
    state.mulaiTayang = Date.now();

    /* Mod Kekal: nama tidak hilang sendiri — menunggu imbasan seterusnya. */
    if (String(state.settings.papar_kekal) === '1') {
      state.timer = null;
    } else {
      state.timer = setTimeout(hide, seconds * 1000);
    }

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

  /* Kembali ke paparan logo: kosongkan gilir & nama yang menunggu ganti. */
  function kembaliLogo() {
    state.queue = [];
    state.gantiTangguh = null;
    clearTimeout(state.timer);
    clearTimeout(state.timerGanti);
    updateQueueBadge();

    if (state.showing || stage.classList.contains('showing')) {
      hide();
    } else {
      stage.classList.remove('showing');
      reveal.classList.remove('is-in');
      demoBadge.classList.add('hidden');
      state.showing = false;
    }
  }

  function drain() {
    if (state.showing) return;

    if (state.gantiTangguh) {
      const t = state.gantiTangguh;
      state.gantiTangguh = null;
      clearTimeout(state.timerGanti);
      state.showing = true;
      showStudent(t);
      return;
    }

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

    /* Suis "Tukar serta-merta": nama baharu menggantikan nama sedia ada. */
    if (String(state.settings.ganggu_serta_merta) !== '0') {
      if (!state.showing) {
        state.showing = true;
        updateQueueBadge();
        showStudent(data);
        return;
      }

      const sejak = Date.now() - state.mulaiTayang;
      if (sejak < TAHAN_MIN) {
        /* Baru muncul: simpan yang terakhir, ganti sebaik pelindung tamat. */
        state.gantiTangguh = data;
        clearTimeout(state.timerGanti);
        state.timerGanti = setTimeout(() => {
          const t = state.gantiTangguh;
          state.gantiTangguh = null;
          if (t) showStudent(t);
        }, TAHAN_MIN - sejak);
        return;
      }

      clearTimeout(state.timer);
      clearTimeout(state.timerGanti);
      state.gantiTangguh = null;
      state.queue = [];
      updateQueueBadge();
      showStudent(data);
      return;
    }

    /* Kelakuan asal: beratur ikut tempoh paparan. */
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
      const senarai = data.reveal || [];
      if (String(state.settings.ganggu_serta_merta) !== '0') {
        /* Mod ganti serta-merta: yang lama sudah lapuk, ambil yang terakhir. */
        for (const r of senarai) if (r.at > papanSejak) papanSejak = r.at;
        if (senarai.length) enqueue(senarai[senarai.length - 1]);
      } else {
        for (const reveal of senarai) {
          if (reveal.at > papanSejak) papanSejak = reveal.at;
          enqueue(reveal);
        }
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
      state.gantiTangguh = null;
      clearTimeout(state.timerGanti);
      papanSejak = Date.now();
      updateQueueBadge();
      if (state.showing) hide();
    });

    /* Butang "Papar Logo Majlis" dari Admin. */
    dengar('bersihkan', () => {
      papanSejak = Date.now();
      kembaliLogo();
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
