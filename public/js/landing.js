'use strict';

(async function init() {
  const { api, esc } = window.UI;

  try {
    const info = await api('/api/bootstrap');

    /* Senarai nama mungkin dilindungi kunci majlis — halaman utama tidak
       perlu memintanya, cukup papar ringkasan. */
    let roster = { students: [] };
    try {
      roster = await api('/api/students', { tanyaKunci: false });
    } catch {
      /* tiada akses pratonton nama */
    }

    document.getElementById('namaSekolah').textContent = info.settings.nama_sekolah;
    document.getElementById('previewSekolah').textContent = info.settings.nama_sekolah;
    document.getElementById('footerTajuk').textContent = info.settings.tajuk_majlis;

    const statHadir = document.getElementById('statHadir');
    const statTotal = document.getElementById('statTotal');
    const statKelas = document.getElementById('statKelas');
    const previewHadir = document.getElementById('previewHadir');

    statHadir.textContent = info.hadir;
    statTotal.textContent = info.total;
    statKelas.textContent = info.perClass.length;

    // Kemas kini statistik secara langsung apabila murid diimbas.
    if ('EventSource' in window) {
      const events = new EventSource('/api/events');
      const liveStats = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (typeof data.hadir === 'number') statHadir.textContent = data.hadir;
          if (typeof data.total === 'number') statTotal.textContent = data.total;
          if (Array.isArray(data.perClass)) statKelas.textContent = data.perClass.length;
          if (previewHadir && typeof data.hadir === 'number' && typeof data.total === 'number') {
            previewHadir.textContent = `Kehadiran ${data.hadir} / ${data.total}`;
          }
        } catch {
          /* abaikan data tidak sah */
        }
      };
      events.addEventListener('stats', liveStats);
      events.addEventListener('students', liveStats);
      events.addEventListener('reset', liveStats);
    }

    /* Kunci hanya ditampal pada pautan jika pelayan memang memintanya
       (mod hosting). Mod lokal tidak memerlukannya. */
    const kunciSimpanan = info.perluKunci && window.UI.kunciSaya ? window.UI.kunciSaya() : '';
    const pautanImbas = info.urls.pengimbas + (kunciSimpanan ? `?kunci=${encodeURIComponent(kunciSimpanan)}` : '');

    document.getElementById('lanUrl').textContent = pautanImbas.replace(/^https?:\/\//, '');
    document.getElementById('scanQr').src =
      '/api/qr-link?size=180&url=' + encodeURIComponent(pautanImbas);

    const hadirEl = document.getElementById('previewHadir');
    hadirEl.textContent = `Kehadiran ${info.hadir} / ${info.total}`;

    document.getElementById('previewTarikh').textContent = new Date()
      .toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase();

    const list = (roster.students || []).filter((s) => s.nama);
    if (list.length) {
      const picks = [...list].sort(() => Math.random() - 0.5).slice(0, 4);
      let index = 0;

      const paint = () => {
        const s = picks[index % picks.length];
        const nameEl = document.getElementById('previewNama');
        const classEl = document.getElementById('previewKelas');
        const initEl = document.getElementById('previewInitials');

        nameEl.style.opacity = '0';
        classEl.style.opacity = '0';

        setTimeout(() => {
          nameEl.textContent = s.nama;
          classEl.textContent = s.kelas;
          initEl.textContent = window.UI.initials(s.nama);
          nameEl.style.opacity = '1';
          classEl.style.opacity = '1';
        }, 220);

        index += 1;
      };

      document.getElementById('previewNama').style.transition = 'opacity .25s ease';
      document.getElementById('previewKelas').style.transition = 'opacity .25s ease';
      paint();
      setInterval(paint, 4200);
    }
  } catch (err) {
    console.error(err);
    window.UI.toast('Tidak dapat menghubungi pelayan. Pastikan server berjalan.', 'bad');
  }
})();
