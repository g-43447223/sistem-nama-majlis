'use strict';

(function qrPage() {
  const { api, esc } = window.UI;

  let settings = {
    nama_sekolah: 'Sekolah Kebangsaan Pulau Indah 2',
    tajuk_majlis: 'Majlis Apresiasi Murid Cemerlang',
  };
  let students = [];
  let kelas = new URLSearchParams(location.search).get('kelas') || '';

  function render() {
    const filter = document.getElementById('qrClassFilter');
    const classes = [...new Set(students.map((s) => s.kelas))].sort();

    filter.innerHTML =
      '<option value="">Semua kelas</option>' +
      classes.map((c) => `<option value="${esc(c)}"${c === kelas ? ' selected' : ''}>${esc(c)}</option>`).join('');

    const list = students.filter((s) => !kelas || s.kelas === kelas);

    document.getElementById('qrSummary').textContent = `${list.length} kad`;
    document.getElementById('qrEmpty').classList.toggle('hidden', list.length > 0);

    document.getElementById('qgrid').innerHTML = list
      .map(
        (s) => `<article class="qcard">
          <div class="qcard-head">${esc(settings.nama_sekolah)}</div>
          <div class="qcard-event">${esc(settings.tajuk_majlis)}</div>
          <img class="qcard-qr" src="/api/qr/${encodeURIComponent(s.kod)}?size=340" alt="Kod QR ${esc(
          s.kod
        )}" />
          <div class="qcard-name">${esc(s.nama)}</div>
          <div class="qcard-kelas">${esc(s.kelas)}</div>
          <div class="qcard-foot"><span>Imbas di skrin majlis</span><b>${esc(s.kod)}</b></div>
        </article>`
      )
      .join('');
  }

  /* ------------------------------------------------------------------
     Muat ikut saiz: kecilkan tulisan sehingga muat dalam kad.
     Cara lama memotong nama (line-clamp + ellipsis); sekarang tulisan
     dibesarkan/dikecilkan supaya SEMUA butiran terbit penuh.
     ------------------------------------------------------------------ */

  const HAD_NAMA = { maks: 10.5, minima: 6.4, langkah: 0.35 };
  const HAD_KEPALA = { maks: 6, minima: 4.2, langkah: 0.2 };
  const HAD_MAJLIS = { maks: 5.6, minima: 4, langkah: 0.2 };

  function susut(kad, el, had) {
    if (!el) return;
    let saiz = had.maks;
    el.style.fontSize = saiz + 'pt';
    let pengira = 0;
    while (saiz - had.langkah >= had.minima && lebih(kad) && pengira < 40) {
      saiz = Math.round((saiz - had.langkah) * 100) / 100;
      el.style.fontSize = saiz + 'pt';
      pengira += 1;
    }
  }

  function lebih(kad) {
    return kad.scrollHeight - kad.clientHeight > 0.6;
  }

  function muatKad(kad) {
    kad.classList.remove('longgar');

    /* Dua pusingan: nama ialah pengguna ruang terbesar, tetapi kad
       masih boleh terkeluar kerana baris nama + kelas + kod. */
    for (let pusingan = 0; pusingan < 2; pusingan += 1) {
      susut(kad, kad.querySelector('.qcard-name'), HAD_NAMA);
      susut(kad, kad.querySelector('.qcard-head'), HAD_KEPALA);
      susut(kad, kad.querySelector('.qcard-event'), HAD_MAJLIS);
      if (!lebih(kad)) break;
    }

    /* Nama masih terlalu panjang walaupun pada 6.4pt: benarkan kad
       membesar (supaya teks tidak hilang) dan maklumkan operator. */
    if (lebih(kad)) {
      kad.classList.add('longgar');
      kad.dataset.panjang = '1';
    }
  }

  function muatSemuaKad() {
    const kad = Array.from(document.querySelectorAll('#qgrid .qcard'));
    for (const satu of kad) muatKad(satu);
    return kad;
  }

  function laporkanKad() {
    const kad = muatSemuaKad();
    const panjang = kad.filter((k) => k.classList.contains('longgar'));
    if (panjang.length) {
      const nama = panjang.map((k) => k.querySelector('.qcard-name').textContent.trim());
      window.UI.toast(
        `${panjang.length} kad terlalu panjang — kad itu dibesarkan supaya nama tak terpotong: ${nama
          .slice(0, 3)
          .join(', ')}${panjang.length > 3 ? '…' : ''}`,
        'warn'
      );
    }
  }

  function susunSemula() {
    /* QR mempunyai saiz tetap (26mm) jadi pengiraan boleh dibuat serta-merta. */
    laporkanKad();

    /* Sahkan semula selepas semua gambar selesai dimuat. */
    const gambar = Array.from(document.querySelectorAll('#qgrid img.qcard-qr'));
    Promise.all(
      gambar.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
      )
    ).then(laporkanKad);
  }

  document.getElementById('qrClassFilter').addEventListener('change', (event) => {
    kelas = event.target.value;
    const url = new URL(location.href);
    if (kelas) url.searchParams.set('kelas', kelas);
    else url.searchParams.delete('kelas');
    history.replaceState(null, '', url);
    render();
    susunSemula();
  });

  document.getElementById('qrPrint').addEventListener('click', () => {
    laporkanKad();
    window.print();
  });

  /* Saiz kad berubah pada skrin kecil; susun semula apabila tetingkup berubah. */
  let ubahUkuran = null;
  window.addEventListener('resize', () => {
    clearTimeout(ubahUkuran);
    ubahUkuran = setTimeout(laporkanKad, 250);
  });

  (async function boot() {
    try {
      const info = await api('/api/bootstrap');
      settings = info.settings;
      document.getElementById('qrSubtitle').textContent = `${settings.nama_sekolah} · ${settings.tajuk_majlis}`;
      document.title = `Kad QR — ${settings.tajuk_majlis}`;

      const data = await api('/api/students');
      students = data.students || [];

      // Jika kelas dalam URL tidak wujud, kembali ke semua.
      if (kelas && !students.some((s) => s.kelas === kelas)) kelas = '';

      render();
      susunSemula();
    } catch (err) {
      window.UI.toast(err.message, 'bad');
    }
  })();
})();
