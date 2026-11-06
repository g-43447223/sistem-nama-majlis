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

  document.getElementById('qrClassFilter').addEventListener('change', (event) => {
    kelas = event.target.value;
    const url = new URL(location.href);
    if (kelas) url.searchParams.set('kelas', kelas);
    else url.searchParams.delete('kelas');
    history.replaceState(null, '', url);
    render();
  });

  document.getElementById('qrPrint').addEventListener('click', () => window.print());

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
    } catch (err) {
      window.UI.toast(err.message, 'bad');
    }
  })();
})();
