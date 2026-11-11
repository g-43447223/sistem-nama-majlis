'use strict';

(function admin() {
  const { api, toast, esc, fmtTime, initials, debounce } = window.UI;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const state = {
    info: null,
    settings: {},
    stats: { total: 0, hadir: 0, belum: 0, perClass: [] },
    students: [],
    senaraiAnugerah: [],
    mc: { kumpulan: [], jumlah: 0 },
    mcKelas: '',
    mcAnugerah: '',
    mcCari: '',
    mcSusun: 'kelas',
    mcHanya: true,
    attendance: [],
    tab: 'murid',
    search: '',
    filterKelas: '',
    searchAtt: '',
    filterPeringkat: '',
    filterAnugerah: '',
    searchDemo: '',
    photoTarget: null,
    qrKelas: '',
  };

  const sourceLabel = { scanner: 'Mesin scanner', kamera: 'Kamera', manual: 'Manual', demo: 'Demo' };

  /* ================================================================ */
  /*  Tab                                                              */
  /* ================================================================ */

  function switchTab(tab) {
    if (!document.getElementById(`tab-${tab}`)) return;
    state.tab = tab;

    $$('.side-link[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    $$('.tab-section').forEach((section) => {
      section.classList.toggle('active', section.id === `tab-${tab}`);
    });

    if (history.replaceState) history.replaceState(null, '', `#${tab}`);

    if (tab === 'kehadiran') loadAttendance();
    if (tab === 'mc') loadMc();
    if (tab === 'kad') {
      state.qrKelas = $('#qrKelas').value;
      renderQrPreview();
    }
    if (tab === 'demo') renderDemo();
  }

  $$('.side-link[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  /* ================================================================ */
  /*  Statistik & kelas                                                */
  /* ================================================================ */

  function updateStats(stats) {
    if (!stats) return;
    state.stats = { ...state.stats, ...stats };

    const total = state.stats.total ?? 0;
    const hadir = state.stats.hadir ?? 0;
    const daftar = state.stats.daftar ?? 0;
    const dipapar = state.stats.dipapar ?? 0;
    const belum = Math.max(0, total - hadir);
    const pct = total ? Math.round((hadir / total) * 100) : 0;

    $('#navMuridCount').textContent = total;
    $('#navHadirCount').textContent = hadir;
    $('#sideHadir').textContent = `${hadir} / ${total}`;

    const navMc = $('#navMcCount');
    if (navMc) navMc.textContent = state.stats.beranugerah ?? 0;

    if ($('#aTotal')) {
      $('#aTotal').textContent = total;
      $('#aDaftar').textContent = daftar;
      $('#aPapar').textContent = dipapar;
      $('#aBelum').textContent = belum;
      $('#aPeratus').textContent = `${pct}%`;
    }

    renderClassBreakdown(state.stats.perClass || []);
    renderClassOptions();
  }

  function renderClassBreakdown(perClass) {
    const host = $('#classBreakdown');
    if (!host) return;
    if (!perClass.length) {
      host.innerHTML = '<p class="muted" style="font-size:.82rem">Belum ada data kelas.</p>';
      return;
    }
    host.innerHTML = perClass
      .map((c) => {
        const pct = c.total ? Math.round(((c.hadir ?? c.dipapar ?? 0) / c.total) * 100) : 0;
        return `<div class="class-row">
          <b>${esc(c.kelas)}</b>
          <div class="track"><i style="width:${pct}%"></i></div>
          <span>Daftar ${c.daftar ?? 0} · Papar ${c.dipapar ?? 0} / ${c.total}</span>
        </div>`;
      })
      .join('');
  }

  function uniqueClasses() {
    return [...new Set(state.students.map((s) => s.kelas))].sort();
  }

  function renderClassOptions() {
    const classes = uniqueClasses();

    const filter = $('#filterKelas');
    const current = filter.value;
    filter.innerHTML =
      '<option value="">Semua kelas</option>' +
      classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    filter.value = classes.includes(current) ? current : '';

    const qr = $('#qrKelas');
    const qrCurrent = qr.value;
    qr.innerHTML =
      '<option value="">Semua kelas</option>' +
      classes.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    qr.value = classes.includes(qrCurrent) ? qrCurrent : '';

    const dl = $('#kelasList');
    dl.innerHTML = classes.map((c) => `<option value="${esc(c)}">`).join('');
  }

  /* ================================================================ */
  /*  Murid                                                            */
  /* ================================================================ */

  function renderStudents() {
    const q = state.search.toLowerCase();
    const list = state.students.filter((s) => {
      if (state.filterKelas && s.kelas !== state.filterKelas) return false;
      if (state.filterAnugerah === 'ada' && !(s.anugerah || '').trim()) return false;
      if (state.filterAnugerah === 'tiada' && (s.anugerah || '').trim()) return false;
      if (state.filterAnugerah && state.filterAnugerah !== 'ada' && state.filterAnugerah !== 'tiada') {
        if ((s.anugerah || '').trim().toUpperCase() !== state.filterAnugerah.toUpperCase()) return false;
      }
      if (!q) return true;
      return `${s.nama} ${s.kelas} ${s.kod} ${s.anugerah || ''}`.toLowerCase().includes(q);
    });

    const tbody = $('#studentsBody');
    const empty = $('#studentsEmpty');

    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = list
      .map(
        (s) => `<tr>
          <td>
            <div class="student-cell">
              <img class="avatar-sm" src="${esc(s.foto)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/api/avatar/${encodeURIComponent(s.id)}'">
              <div><b>${esc(s.nama)}</b><small>${esc(s.kod)}</small></div>
            </div>
          </td>
          <td>${esc(s.kelas)}</td>
          <td>${
            s.anugerah
              ? `<span class="anugerah-pill">${esc(s.anugerah)}</span>`
              : '<span class="muted" style="font-size:.78rem">—</span>'
          }</td>
          <td class="kod-cell">${esc(s.kod)}</td>
          <td>${
            s.dipapar
              ? `<span class="badge badge-ok">Dipapar</span> <span class="muted" style="font-size:.72rem">${esc(
                  s.paparLabel || s.masaLabel || ''
                )}</span>`
              : s.daftar
                ? `<span class="badge badge-warn">Daftar sahaja</span> <span class="muted" style="font-size:.72rem">${esc(
                    s.daftarLabel || ''
                  )}</span>`
                : '<span class="badge badge-dim">Belum</span>'
          }</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" type="button" data-action="photo" data-id="${esc(s.id)}" title="Tukar gambar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>
              </button>
              <button class="icon-btn" type="button" data-action="edit" data-id="${esc(s.id)}" title="Sunting">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>
              </button>
              <button class="icon-btn" type="button" data-action="delete" data-id="${esc(s.id)}" title="Padam">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/></svg>
              </button>
            </div>
          </td>
        </tr>`
      )
      .join('');
  }

  async function loadStudents() {
    try {
      const data = await api('/api/students');
      state.students = data.students || [];
      state.senaraiAnugerah = data.senaraiAnugerah || [];
      updateStats(data);
      renderStudents();
      renderQrPreview();
      renderDemo();
      renderAnugerahOptions();
      renderAnugerahRingkasan();
      renderMcKelasOptions();
      if (state.tab === 'mc') loadMc();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  /* Datalist + penapis anugerah (nilai unik daripada pangkalan data) */
  function renderAnugerahOptions() {
    const senarai = state.senaraiAnugerah || [];

    const dl = $('#anugerahList');
    if (dl) {
      dl.innerHTML = senarai
        .map((r) => `<option value="${esc(r.anugerah)}">${r.jumlah} murid</option>`)
        .join('');
    }

    const penapis = $('#filterAnugerah');
    if (penapis) {
      const pilih = penapis.value;
      penapis.innerHTML =
        '<option value="">Semua anugerah</option>' +
        '<option value="ada">Ada anugerah</option>' +
        '<option value="tiada">Belum ada anugerah</option>' +
        senarai.map((r) => `<option value="${esc(r.anugerah)}">${esc(r.anugerah)} (${r.jumlah})</option>`).join('');
      penapis.value = [ '', 'ada', 'tiada', ...senarai.map((r) => r.anugerah) ].includes(pilih) ? pilih : '';

      const lain = $('#mcAnugerah');
      if (lain) {
        const pilihLain = lain.value;
        lain.innerHTML =
          '<option value="">Semua anugerah</option>' +
          senarai.map((r) => `<option value="${esc(r.anugerah)}">${esc(r.anugerah)} (${r.jumlah})</option>`).join('');
        lain.value = ['', ...senarai.map((r) => r.anugerah)].includes(pilihLain) ? pilihLain : '';
      }
    }
  }

  /* Ringkasan "siapa belum ada anugerah" — penting semasa rehearsal */
  function renderAnugerahRingkasan() {
    const host = $('#anugerahRingkasan');
    const hostMc = $('#mcRingkasan');
    const senarai = state.senaraiAnugerah || [];
    const belum = (state.stats.total ?? 0) - (state.stats.beranugerah ?? 0);

    const teras = senarai.length
      ? senarai
          .map(
            (r) => `<button class="chip chip-anugerah" type="button" data-anugerah="${esc(r.anugerah)}">
                <b>${esc(r.anugerah)}</b><span>${r.jumlah}</span>
              </button>`
          )
          .join('') +
        `<button class="chip chip-kosong" type="button" data-anugerah="tiada">
            <b>Belum ada anugerah</b><span>${belum}</span>
          </button>`
      : `<span class="muted" style="font-size:.82rem">
            Belum ada anugerah direkod —${belum ? ` semua ${belum} murid belum diisi.` : ''}
         </span>`;

    if (host) host.innerHTML = teras;
    if (hostMc) hostMc.innerHTML = teras;
  }

  /* Klik chip ringkasan → tapis senarai mengikut anugerah itu */
  function pasChipAnugerah(event) {
    const chip = event.target.closest('[data-anugerah]');
    if (!chip) return;
    state.filterAnugerah = chip.dataset.anugerah;
    const penapis = $('#filterAnugerah');
    if (penapis) penapis.value = state.filterAnugerah;
    renderStudents();
    switchTab('murid');
  }

  $('#searchMurid').addEventListener('input', (event) => {
    state.search = event.target.value.trim();
    renderStudents();
  });

  $('#filterKelas').addEventListener('change', (event) => {
    state.filterKelas = event.target.value;
    renderStudents();
  });

  $('#filterAnugerah').addEventListener('change', (event) => {
    state.filterAnugerah = event.target.value;
    renderStudents();
  });

  $('#studentsBody').addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const student = state.students.find((s) => s.id === btn.dataset.id);
    if (!student) return;

    if (btn.dataset.action === 'edit') openStudentModal(student);
    if (btn.dataset.action === 'delete') deleteStudent(student);
    if (btn.dataset.action === 'photo') {
      state.photoTarget = student.id;
      $('#photoInput').value = '';
      $('#photoInput').click();
    }
  });

  function openStudentModal(student = null) {
    $('#studentForm').reset();
    $('#studentId').value = student ? student.id : '';
    $('#studentNama').value = student ? student.nama : '';
    $('#studentKelas').value = student ? student.kelas : '';
    $('#studentKod').value = student ? student.kod : '';
    $('#studentAnugerah').value = student ? student.anugerah || '' : '';
    $('#studentModalTitle').textContent = student ? 'Sunting murid' : 'Tambah murid';
    $('#studentModal').showModal();
    setTimeout(() => $('#studentNama').focus(), 40);
  }

  $('#btnAdd').addEventListener('click', () => openStudentModal());
  $('#studentModalClose').addEventListener('click', () => $('#studentModal').close());
  $('#studentCancel').addEventListener('click', () => $('#studentModal').close());

  $('#studentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('#studentId').value;
    const payload = {
      nama: $('#studentNama').value.trim(),
      kelas: $('#studentKelas').value.trim(),
      anugerah: $('#studentAnugerah').value.trim(),
      kod: $('#studentKod').value.trim(),
    };

    if (!payload.nama || !payload.kelas) {
      toast('Nama dan kelas diperlukan.', 'warn');
      return;
    }

    const saveBtn = $('#studentSave');
    saveBtn.disabled = true;

    try {
      if (id) await api(`/api/students/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
      else await api('/api/students', { method: 'POST', body: payload });

      $('#studentModal').close();
      toast(id ? 'Maklumat murid dikemas kini.' : 'Murid baharu ditambah.', 'ok');
      await loadStudents();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      saveBtn.disabled = false;
    }
  });

  async function deleteStudent(student) {
    const ok = window.confirm(
      `Padam ${student.nama}?\n\nRekod kehadiran murid ini juga akan dipadam. Tindakan ini tidak boleh dibatalkan.`
    );
    if (!ok) return;

    try {
      await api(`/api/students/${encodeURIComponent(student.id)}`, { method: 'DELETE' });
      toast('Murid telah dipadam.', 'ok');
      await loadStudents();
      if (state.tab === 'kehadiran') loadAttendance();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  /* Foto individu ---------------------------------------------------- */

  $('#photoInput').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !state.photoTarget) return;

    const form = new FormData();
    form.append('foto', file);

    try {
      await api(`/api/students/${encodeURIComponent(state.photoTarget)}/photo`, {
        method: 'POST',
        body: form,
      });
      toast('Gambar murid dikemas kini.', 'ok');
      await loadStudents();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      state.photoTarget = null;
      event.target.value = '';
    }
  });

  $('#bulkPhotos').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const form = new FormData();
    for (const file of files) form.append('foto', file);

    toast(`Memuat naik ${files.length} gambar…`);

    try {
      const result = await api('/api/photos/bulk', { method: 'POST', body: form });
      let message = `${result.matched.length} gambar dipadankan`;
      if (result.unmatched.length) message += `, ${result.unmatched.length} tidak sepadan`;
      toast(message + '.', result.unmatched.length ? 'warn' : 'ok');
      if (result.unmatched.length) {
        console.warn('Gambar tidak sepadan:', result.unmatched);
      }
      await loadStudents();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      event.target.value = '';
    }
  });

  /* Import gambar dari folder pelayan --------------------------------- */

  $('#btnFolderToggle').addEventListener('click', () => {
    const panel = $('#folderPanel');
    panel.classList.toggle('hidden');
    if (panel.classList.contains('hidden')) return;
    const sel = $('#folderKelas');
    if (sel.options.length <= 1) {
      $('#filterKelas')
        .querySelectorAll('option')
        .forEach((o) => {
          if (!o.value) return;
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.value;
          sel.appendChild(opt);
        });
    }
  });

  function paparLaporanFolder(r) {
    const box = $('#folderLaporan');
    box.classList.remove('hidden');
    const hampir = r.dipadang.filter((d) => d.hampir);
    const senarai = (tajuk, items) =>
      items.length
        ? `<div class="folder-bahagian"><h5>${tajuk}</h5><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
        : '';

    box.innerHTML = [
      `<div class="folder-ringkas"><b>${esc(r.kelas)}</b> · ${r.dipadang.length}/${r.jumlahFail} gambar ` +
        (r.kering ? 'sepadan (belum disalin)' : 'berjaya disalin') +
        (hampir.length ? ` · ${hampir.length} ejaan hampir` : '') +
        (r.gagal.length ? ` · ${r.gagal.length} gagal` : '') +
        (r.tanpaGambar.length ? ` · ${r.tanpaGambar.length} murid belum dapat gambar` : '') +
        '</div>',
      senarai(
        'Padanan ejaan hampir — sila semak',
        hampir.map((d) => `${d.fail} → ${d.nama}`)
      ),
      senarai(
        'Tidak sepadan',
        r.gagal.map((g) => `${g.fail} — ${g.sebab}${g.calon ? ` (calon: ${g.calon.join(' / ')})` : ''}`)
      ),
      senarai('Murid belum dapat gambar', r.tanpaGambar),
    ].join('');
  }

  async function kirimFolder(kering) {
    const folder = $('#folderPath').value.trim();
    if (!folder) {
      toast('Taip nama folder lebih dulu.', 'bad');
      return;
    }
    $('#folderStatus').textContent = kering ? 'Menyemak…' : 'Mengimport…';
    try {
      const r = await api('/api/photos/folder', {
        method: 'POST',
        body: { folder, kelas: $('#folderKelas').value, kering },
      });
      paparLaporanFolder(r);
      if (kering) {
        toast(
          `${r.dipadang.length} gambar sepadan dengan murid ${r.kelas}. Tekan "Import gambar" untuk salin.`,
          r.gagal.length ? 'warn' : 'ok'
        );
      } else {
        toast(`${r.dipadang.length} gambar sudah masuk ke sistem.`, r.gagal.length ? 'warn' : 'ok');
        await loadStudents();
      }
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      $('#folderStatus').textContent = '';
    }
  }

  $('#btnFolderSemak').addEventListener('click', () => kirimFolder(true));
  $('#btnFolderImport').addEventListener('click', () => kirimFolder(false));

  /* ================================================================ */
  /*  Import CSV                                                       */
  /* ================================================================ */

  $('#btnImport').addEventListener('click', () => {
    $('#importPanel').classList.toggle('hidden');
  });

  $('#csvFile').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      $('#csvText').value = await file.text();
      toast('Fail CSV dibaca.', 'ok');
    } catch {
      toast('Gagal membaca fail.', 'bad');
    }
  });

  $('#btnImportRun').addEventListener('click', async () => {
    const csv = $('#csvText').value.trim();
    if (!csv) {
      toast('Tampal kandungan CSV dahulu.', 'warn');
      return;
    }

    const status = $('#importStatus');
    status.textContent = 'Mengimport…';

    try {
      const mod = $('#importKemaskini') && $('#importKemaskini').checked ? 'kemas kini' : 'baharu';
      const result = await api('/api/import', { method: 'POST', body: { csv, mod } });

      const parts = [];
      if (result.mod === 'kemas kini') {
        parts.push(`${result.dikemaskini} murid dikemas kini`);
        if (result.skipped.length) parts.push(`${result.skipped.length} dilangkau (kod tiada)`);
      } else {
        parts.push(`${result.added} murid ditambah`);
        if (result.skipped.length) parts.push(`${result.skipped.length} dilangkau (kod sama)`);
      }
      if (result.errors.length) parts.push(`${result.errors.length} ralat`);
      parts.push(result.lajurAnugerah ? 'lajur anugerah dibaca ✓' : 'tiada lajur anugerah');
      status.textContent = parts.join(' · ');
      toast(parts.join(' · '), result.errors.length ? 'warn' : 'ok');
      if (result.errors.length) console.warn(result.errors);
      await loadStudents();
    } catch (err) {
      status.textContent = '';
      toast(err.message, 'bad');
    }
  });

  $('#btnTemplate').addEventListener('click', () => {
    const csv =
      'nama,kelas,kod,anugerah\n' +
      'Ahmad Zafran bin Ismail,6 AMANAH,,\n' +
      'Nur Aisyah binti Rahman,6 AMANAH,,ANUGERAH PELAJAR CEMERLANG\n' +
      'Muhammad Irfan bin Yusof,6 BESTARI,,ANUGERAH KEPEMIMPINAN\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'templat-murid.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ================================================================ */
  /*  Kehadiran                                                        */
  /* ================================================================ */

  async function loadAttendance() {
    try {
      const data = await api('/api/attendance');
      state.attendance = data.attendance || [];
      updateStats(data);

      if (data.sheets) {
        const tunggu = $('#sheetsTunggu');
        const btn = $('#sheetsKehadiran');
        const kosong = $('#sheetsKosong');
        if (tunggu) tunggu.textContent = data.sheets.menunggu;
        if (btn) btn.classList.toggle('hidden', !data.sheets.diatur);
        if (kosong) kosong.classList.toggle('hidden', !data.sheets.diatur);
      }

      if (!state.students.length) await loadStudents();
      renderAttendance();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  /* Gabungkan rekod imbasan dengan senarai murid supaya yang belum diimbas
     pun boleh disaring (berguna di kaunter daftar hadir). */
  function peringkatRows() {
    const peta = new Map(state.attendance.map((row) => [row.student.id, row]));
    return state.students.map((s) => {
      const row = peta.get(s.id);
      return {
        student: s,
        daftarLabel: (row && row.daftarLabel) || s.daftarLabel || null,
        daftarSource: row && row.daftar_source ? sourceLabel[row.daftar_source] || row.daftar_source : null,
        paparLabel: (row && row.paparLabel) || s.paparLabel || null,
        paparSource: row && row.papar_source ? sourceLabel[row.papar_source] || row.papar_source : null,
      };
    });
  }

  function renderAttendance() {
    const q = state.searchAtt.toLowerCase();
    const peringkat = state.filterPeringkat;

    const list = peringkatRows().filter((row) => {
      if (peringkat === 'belum' && (row.daftarLabel || row.paparLabel)) return false;
      if (peringkat === 'daftar' && (!row.daftarLabel || row.paparLabel)) return false;
      if (peringkat === 'papar' && !row.paparLabel) return false;
      if (!q) return true;
      return `${row.student.nama} ${row.student.kelas} ${row.student.kod}`.toLowerCase().includes(q);
    });

    const tbody = $('#attendanceBody');
    const empty = $('#attendanceEmpty');

    if (!list.length) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    const masa = (label, sumber) =>
      label
        ? `<div class="stage-cell"><b>${esc(label)}</b>${
            sumber ? `<small>${esc(sumber)}</small>` : ''
          }</div>`
        : '<span class="muted">—</span>';

    tbody.innerHTML = list
      .map(
        (row) => `<tr>
          <td>
            <div class="student-cell">
              <img class="avatar-sm" src="${esc(row.student.foto)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/api/avatar/${encodeURIComponent(
                row.student.id
              )}'">
              <div><b>${esc(row.student.nama)}</b><small>${esc(row.student.kod)}</small></div>
            </div>
          </td>
          <td>${esc(row.student.kelas)}</td>
          <td class="kod-cell">${esc(row.student.kod)}</td>
          <td>${masa(row.daftarLabel, row.daftarSource)}</td>
          <td>${masa(row.paparLabel, row.paparSource)}</td>
          <td>${
            row.daftarLabel || row.paparLabel
              ? `<button class="icon-btn" type="button" data-reset="${esc(row.student.id)}" title="Kosongkan rekod murid ini supaya kad boleh dipaparkan semula">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /></svg>
                </button>`
              : '<span class="muted">—</span>'
          }</td>
        </tr>`
      )
      .join('');
  }

  /* Reset rekod seorang murid (kad boleh dipakai semula) */
  $('#attendanceBody').addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-reset]');
    if (!btn) return;

    const id = btn.dataset.reset;
    const jumpa = peringkatRows().find((r) => r.student.id === id);
    const nama = jumpa ? jumpa.student.nama : 'murid ini';
    if (!window.confirm(`Kosongkan rekod "${nama}"?\n\nKad murid ini boleh didaftarkan dan dipaparkan semula.`)) return;

    try {
      await api('/api/attendance/' + encodeURIComponent(id), { method: 'DELETE' });
      toast(`Rekod ${nama} dibersihkan.`, 'ok');
      await loadAttendance();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  $('#filterPeringkat').addEventListener('change', (event) => {
    state.filterPeringkat = event.target.value;
    renderAttendance();
  });

  $('#searchAttendance').addEventListener('input', (event) => {
    state.searchAtt = event.target.value.trim();
    renderAttendance();
  });

  $('#btnResetAttendance').addEventListener('click', async () => {
    const ok = window.confirm(
      'Kosongkan SEMUA rekod kehadiran?\n\n' +
        'Semua nama boleh didaftarkan dan dipaparkan semula — ini yang perlu dibuat selepas sesi latihan.\n' +
        'Skir projektor akan dikosongkan serta-merta pada semua perangkat.\n\n' +
        'Google Sheet TIDAK diurus (guna butang “Kosongkan Google Sheets” jika perlu).\n' +
        'Tindakan ini tidak boleh dibatalkan.'
    );
    if (!ok) return;

    try {
      await api('/api/attendance', { method: 'DELETE' });
      toast('Rekod kehadiran dikosongkan.', 'ok');
      await loadAttendance();
      await loadStudents();
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  /* ================================================================ */
  /*  Senarai MC (pengacara majlis)                                  */
  /* ================================================================ */

  const MC_QUERY = () => {
    const q = new URLSearchParams();
    if (state.mcKelas) q.set('kelas', state.mcKelas);
    if (state.mcAnugerah) q.set('anugerah', state.mcAnugerah);
    if (state.mcCari) q.set('q', state.mcCari);
    if (state.mcSusun) q.set('susun', state.mcSusun);
    if (!state.mcHanya) q.set('hanya', '0');
    return q.toString();
  };

  async function loadMc() {
    try {
      const data = await api('/api/mc?' + MC_QUERY());
      state.mc = data;
      renderMc();
      const nav = $('#navMcCount');
      if (nav) nav.textContent = data.jumlah;
      const kiraan = $('#mcJumlah');
      if (kiraan) {
        kiraan.textContent = `${data.jumlah} nama` + (data.hanya ? ' (hanya ada anugerah)' : ' (semua murid)');
      }
      const csv = $('#mcCsvLink');
      if (csv) csv.href = '/api/mc.csv?' + MC_QUERY();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  function renderMc() {
    const host = $('#mcDokumen');
    const empty = $('#mcEmpty');
    if (!host) return;

    const kumpulan = state.mc.kumpulan || [];
    if (!kumpulan.length) {
      host.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');

    host.innerHTML = kumpulan
      .map(
        (k) => `<section class="mc-kumpulan">
          <h3 class="mc-tajuk">${esc(k.tajuk)}</h3>
          <table class="data mc-jadual">
            <tbody>
              ${k.ahli
                .map(
                  (a) => `<tr>
                    <td class="mc-bil">${a.bil}</td>
                    <td class="mc-nama"><b>${esc(a.nama)}</b>${
                      state.mc.susun === 'anugerah' ? '' : `<small>${esc(a.kelas)}</small>`
                    }</td>
                    <td class="mc-anugerah">${a.anugerah ? esc(a.anugerah) : '<span class="muted">—</span>'}</td>
                    <td class="mc-kod kod-cell">${esc(a.kod)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </section>`
      )
      .join('');
  }

  $('#mcCari')?.addEventListener('input', debounce(() => {
    state.mcCari = $('#mcCari').value.trim();
    loadMc();
  }, 300));

  ['mcKelas', 'mcAnugerah', 'mcSusun'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      state.mcKelas = $('#mcKelas').value;
      state.mcAnugerah = $('#mcAnugerah').value;
      state.mcSusun = $('#mcSusun').value;
      loadMc();
    });
  });

  $('#mcHanya')?.addEventListener('change', (event) => {
    state.mcHanya = event.target.checked;
    loadMc();
  });

  $('#btnMcCetak')?.addEventListener('click', () => {
    renderMc();
    document.body.classList.add('print-mc');
    const selesai = () => {
      document.body.classList.remove('print-mc');
      window.removeEventListener('afterprint', selesai);
    };
    window.addEventListener('afterprint', selesai);
    window.print();
    setTimeout(selesai, 4000);
  });

  /* Padankan dropdown kelas MC dengan senarai kelas sedia ada */
  function renderMcKelasOptions() {
    const select = $('#mcKelas');
    if (!select) return;
    const kelas = [...new Set(state.students.map((s) => s.kelas))].sort();
    const pilih = select.value;
    select.innerHTML =
      '<option value="">Semua kelas</option>' +
      kelas.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    select.value = kelas.includes(pilih) ? pilih : '';
  }

  /* Klik chip anugerah dalam mana-mana ringkasan → tapis & buka tab murid */
  ['#anugerahRingkasan', '#mcRingkasan'].forEach((penentu) => {
    const el = document.querySelector(penentu);
    el?.addEventListener('click', pasChipAnugerah);
  });

  /* ================================================================ */
  /*  Kad QR                                                           */
  /* ================================================================ */

  function filteredForQr() {
    return state.students.filter((s) => !state.qrKelas || s.kelas === state.qrKelas);
  }

  function renderQrPreview() {
    const host = $('#qrPreview');
    if (!host || !state.students.length) return;

    const list = filteredForQr();
    const shown = list.slice(0, 18);
    $('#qrCount').textContent = `${list.length} kad`;

    host.innerHTML = shown
      .map(
        (s) => `<div class="mini-card">
          <img src="/api/qr/${encodeURIComponent(s.kod)}?size=260" alt="QR ${esc(s.kod)}" loading="lazy" />
          <b>${esc(s.nama)}</b>
          <span>${esc(s.kelas)}</span>
          <small>${esc(s.kod)}</small>
        </div>`
      )
      .join('');

    if (list.length > shown.length) {
      host.insertAdjacentHTML(
        'beforeend',
        `<div class="mini-card" style="display:grid;place-items:center;color:var(--muted);font-size:.8rem">
          +${list.length - shown.length} kad lagi<br />dalam halaman cetak
        </div>`
      );
    }
  }

  $('#qrKelas').addEventListener('change', (event) => {
    state.qrKelas = event.target.value;
    renderQrPreview();
  });

  $('#btnPrintQr').addEventListener('click', () => {
    const kelas = encodeURIComponent($('#qrKelas').value);
    window.open(`/qr.html${kelas ? `?kelas=${kelas}` : ''}`, '_blank');
  });

  /* ================================================================ */
  /*  Tetapan                                                          */
  /* ================================================================ */

  function fillSettingsForm(settings) {
    $('#setTajuk').value = settings.tajuk_majlis || '';
    $('#setSubtajuk').value = settings.subtajuk || '';
    $('#setSekolah').value = settings.nama_sekolah || '';
    $('#setCap').value = settings.cap_penjuru || '';
    $('#setTempoh').value = settings.tempoh_paparan || '6';
    $('#setLogoSaiz').value = settings.logo_saiz || 'penuh';
    $('#setBunyi').checked = settings.bunyi === '1';
    $('#setKehadiran').checked = settings.papar_kehadiran === '1';
    $('#setFormal').checked = settings.mod_formal !== '0';
    $('#setAnugerah').checked = settings.papar_anugerah !== '0';
    $('#setGanggu').checked = settings.ganggu_serta_merta !== '0';
    $('#setKekal').checked = settings.papar_kekal === '1';
    paparStatusKawalan();
    $('#setSheetsUrl').value = settings.sheets_url || '';
    $('#setSheetsKunci').value = settings.sheets_kunci || '';
    $('#setSheetsAuto').checked = settings.sheets_auto !== '0';
    applyBgPreview(settings.background || '');
    applyLogoPreview(settings.logo || '');
    applyCrestPreview(settings.logo_sekolah || '');
  }

  function applyBgPreview(path) {
    const el = $('#bgPreview');
    if (path) {
      el.style.backgroundImage = `url("${path.replace(/"/g, '\\"')}")`;
      el.classList.add('has-image');
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.classList.remove('has-image');
      el.textContent = 'Belum ada background';
    }
  }

  function applyLogoPreview(path) {
    const el = $('#logoPreview');
    const img = $('#logoPreviewImg');
    if (!el || !img) return;
    if (path) {
      img.src = path;
      el.classList.add('has-image');
    } else {
      img.removeAttribute('src');
      el.classList.remove('has-image');
    }
  }

  function applyCrestPreview(path) {
    const el = $('#crestPreview');
    const img = $('#crestPreviewImg');
    const text = $('#crestPreviewText');
    if (!el || !img) return;
    if (path) {
      img.src = path;
      el.classList.add('has-image');
      if (text) text.textContent = 'Logo sekolah pada penjuru atas kiri';
    } else {
      img.removeAttribute('src');
      el.classList.remove('has-image');
      if (text) text.textContent = 'Belum ada logo sekolah';
    }
  }

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      tajuk_majlis: $('#setTajuk').value.trim(),
      subtajuk: $('#setSubtajuk').value.trim(),
      nama_sekolah: $('#setSekolah').value.trim(),
      cap_penjuru: $('#setCap').value.trim(),
      sheets_url: $('#setSheetsUrl').value.trim(),
      sheets_kunci: $('#setSheetsKunci').value.trim(),
      sheets_auto: $('#setSheetsAuto').checked ? '1' : '0',
      tempoh_paparan: $('#setTempoh').value,
      logo_saiz: $('#setLogoSaiz').value,
      bunyi: $('#setBunyi').checked ? '1' : '0',
      mod_formal: $('#setFormal').checked ? '1' : '0',
      papar_anugerah: $('#setAnugerah').checked ? '1' : '0',
      ganggu_serta_merta: $('#setGanggu').checked ? '1' : '0',
      papar_kekal: $('#setKekal').checked ? '1' : '0',
      papar_kehadiran: $('#setKehadiran').checked ? '1' : '0',
    };

    const btn = $('#btnSaveSettings');
    btn.disabled = true;

    try {
      const result = await api('/api/settings', { method: 'POST', body: payload });
      state.settings = result.settings;
      toast('Tetapan disimpan dan dihantar ke paparan.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      btn.disabled = false;
    }
  });

  $('#bgUpload').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append('latar', file);
    toast('Memuat naik background…');

    try {
      const result = await api('/api/background', { method: 'POST', body: form });
      state.settings = result.settings;
      applyBgPreview(result.settings.background);
      toast('Background paparan dikemas kini.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      event.target.value = '';
    }
  });

  $('#bgReset').addEventListener('click', async () => {
    try {
      const result = await api('/api/background/reset', { method: 'POST' });
      state.settings = result.settings;
      applyBgPreview('');
      toast('Background dikembalikan kepada latar lalai.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  $('#logoUpload').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append('logo', file);
    toast('Memuat naik logo…');

    try {
      const result = await api('/api/logo', { method: 'POST', body: form });
      state.settings = result.settings;
      applyLogoPreview(result.settings.logo);
      toast('Logo dihantar ke skrin paparan.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      event.target.value = '';
    }
  });

  $('#logoReset').addEventListener('click', async () => {
    try {
      const result = await api('/api/logo/reset', { method: 'POST' });
      state.settings = result.settings;
      applyLogoPreview('');
      toast('Paparan kembali menggunakan emblem lalai.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  $('#crestUpload').addEventListener('change', async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append('sekolah', file);
    toast('Memuat naik logo sekolah…');

    try {
      const result = await api('/api/logo-sekolah', { method: 'POST', body: form });
      state.settings = result.settings;
      applyCrestPreview(result.settings.logo_sekolah);
      toast('Logo sekolah dihantar ke paparan.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      event.target.value = '';
    }
  });

  $('#crestReset').addEventListener('click', async () => {
    try {
      const result = await api('/api/logo-sekolah/reset', { method: 'POST' });
      state.settings = result.settings;
      applyCrestPreview('');
      toast('Penjuru atas kiri kembali ke emblem lalai.', 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  /* Dua suis kawalan paparan dihantar serta-merta supaya boleh ditukar
     di tengah majlis tanpa tekan "Simpan Tetapan". */
  function paparStatusKawalan() {
    const g = $('#statusGanggu');
    const k = $('#statusKekal');
    if (g) g.textContent = $('#setGanggu')?.checked ? 'HIDUP' : 'MATI';
    if (k) k.textContent = $('#setKekal')?.checked ? 'HIDUP' : 'MATI';
  }

  async function tetapkanKawalanPaparan(kunci, nilai, mesej) {
    try {
      const result = await api('/api/settings', { method: 'POST', body: { [kunci]: nilai } });
      state.settings = result.settings;
      paparStatusKawalan();
      toast(mesej, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  $('#setGanggu').addEventListener('change', (event) => {
    const nilai = event.target.checked ? '1' : '0';
    tetapkanKawalanPaparan(
      'ganggu_serta_merta',
      nilai,
      event.target.checked
        ? 'Hidup — imbasan baharu terus menggantikan nama di skrin.'
        : 'Mati — nama akan beratur ikut tempoh paparan.'
    );
  });

  $('#setKekal').addEventListener('change', (event) => {
    const nilai = event.target.checked ? '1' : '0';
    tetapkanKawalanPaparan(
      'papar_kekal',
      nilai,
      event.target.checked
        ? 'Hidup — nama kekal di skrin sampai imbasan seterusnya.'
        : 'Mati — nama hilang sendiri mengikut tempoh paparan.'
    );
  });

  $('#btnPaparLogo').addEventListener('click', async () => {
    try {
      const hasil = await api('/api/display/logo', { method: 'POST', body: {} });
      toast(`Sken projektor kembali ke logo (${hasil.clients} skrin bersambung).`, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  /* Mod formal boleh ditukar serta-merta supaya operator nampak kesannya. */
  $('#setFormal').addEventListener('change', async (event) => {
    try {
      const result = await api('/api/settings', {
        method: 'POST',
        body: { mod_formal: event.target.checked ? '1' : '0' },
      });
      state.settings = result.settings;
      toast(
        event.target.checked
          ? 'Mod formal aktif — unsur kawalan disembunyikan.'
          : 'Unsur kawalan dipaparkan pada skrin.',
        'ok'
      );
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  /* ================================================================ */
  /*  Cermin Google Sheets                                             */
  /* ================================================================ */

  function sheetsStatusText(teks, kelas = '') {
    const el = $('#sheetsStatus');
    if (!el) return;
    el.textContent = teks;
    el.className = `muted ${kelas}`.trim();
    el.style.fontSize = '0.78rem';
  }

  $('#sheetsUji').addEventListener('click', async () => {
    /* Simpan URL dahulu supaya pelayan tahu ke mana hendak menguji. */
    sheetsStatusText('Menguji sambungan…');
    try {
      await api('/api/settings', {
        method: 'POST',
        body: {
          sheets_url: $('#setSheetsUrl').value.trim(),
          sheets_kunci: $('#setSheetsKunci').value.trim(),
        },
      });
      const hasil = await api('/api/sheets/uji', { method: 'POST' });
      if (hasil.ok) {
        sheetsStatusText('Sambungan OK — Apps Script menjawab.', 'ok');
        toast('Google Sheets bersedia menerima rekod.', 'ok');
      } else {
        const sebab = hasil.error || (hasil.respons && hasil.respons.error) || `HTTP ${hasil.http}`;
        sheetsStatusText(`Gagal: ${sebab}`, 'bad');
        toast(`Ujian Sheets gagal: ${sebab}`, 'bad');
      }
    } catch (err) {
      sheetsStatusText(`Gagal: ${err.message}`, 'bad');
      toast(err.message, 'bad');
    }
  });

  async function sheetsHantar(semua) {
    sheetsStatusText(semua ? 'Menghantar semua rekod…' : 'Menghantar rekod tertunggak…');
    try {
      const hasil = await api('/api/sheets/hantar', {
        method: 'POST',
        body: semua ? { semua: true } : {},
      });
      if (hasil.ok) {
        sheetsStatusText(
          `Berjaya: ${hasil.dihantar || 0} rekod dihantar. Tertunggak: ${hasil.menunggu || 0}.`,
          'ok'
        );
        toast(`${hasil.dihantar || 0} rekod dihantar ke Google Sheets.`, 'ok');
      } else {
        sheetsStatusText(`Gagal: ${hasil.mesej}`, 'bad');
        toast(`Hantar ke Sheets gagal: ${hasil.mesej}`, 'bad');
      }
      await loadAttendance();
    } catch (err) {
      sheetsStatusText(`Gagal: ${err.message}`, 'bad');
      toast(err.message, 'bad');
    }
  }

  $('#sheetsHantar').addEventListener('click', () => sheetsHantar(true));
  $('#sheetsKehadiran').addEventListener('click', () => sheetsHantar(false));

  $('#sheetsKosong').addEventListener('click', async () => {
    if (
      !window.confirm(
        'Kosongkan SEMUA baris dalam Google Sheet (kecuali baris tajuk)?\n\n' +
          'Rekod dalam laptop TIDAK dipadam. Guna ini selepas latihan.'
      )
    )
      return;

    sheetsStatusText('Memadam baris dalam Google Sheets…');
    try {
      const hasil = await api('/api/sheets/kosongkan', { method: 'POST' });
      if (hasil.ok) {
        sheetsStatusText(`Sheet dikosongkan (${hasil.dipadam || 0} baris dipadam).`, 'ok');
        toast('Google Sheets sudah dikosongkan.', 'ok');
      } else {
        const sebab = hasil.error || 'Sheet menolak permintaan.';
        sheetsStatusText(`Gagal: ${sebab}`, 'bad');
        toast(`Gagal mengosongkan Sheets: ${sebab}`, 'bad');
      }
    } catch (err) {
      sheetsStatusText(`Gagal: ${err.message}`, 'bad');
      toast(err.message, 'bad');
    }
  });

  // Saiz logo dihantar serta-merta — tidak perlu tekan "Simpan Tetapan".
  $('#setLogoSaiz').addEventListener('change', async (event) => {
    try {
      const result = await api('/api/settings', { method: 'POST', body: { logo_saiz: event.target.value } });
      state.settings = result.settings;
      const label = event.target.selectedOptions[0]?.textContent || event.target.value;
      toast(`Saiz logo dikemas kini: ${label.toLowerCase()}.`, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  /* ================================================================ */
  /*  Demo                                                             */
  /* ================================================================ */

  function renderDemo() {
    const host = $('#demoList');
    if (!host) return;
    const q = state.searchDemo.toLowerCase();
    const list = state.students.filter((s) => !q || `${s.nama} ${s.kelas}`.toLowerCase().includes(q));

    if (!list.length) {
      host.innerHTML = '<p class="muted" style="grid-column:1/-1;font-size:.84rem">Tiada murid dijumpai.</p>';
      return;
    }

    host.innerHTML = list
      .map(
        (s) => `<div class="demo-item">
          <img src="${esc(s.foto)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='/api/avatar/${encodeURIComponent(s.id)}'">
          <div class="info"><b>${esc(s.nama)}</b><small>${esc(s.kelas)}</small></div>
          <button class="btn btn-sm" type="button" data-demo="${esc(s.id)}">Papar</button>
        </div>`
      )
      .join('');
  }

  $('#demoList').addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-demo]');
    if (!btn) return;
    const student = state.students.find((s) => s.id === btn.dataset.demo);
    if (!student) return;

    try {
      await api('/api/demo', { method: 'POST', body: { id: student.id } });
      toast(`Dipaparkan: ${student.nama}`, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  $('#btnRandomDemo').addEventListener('click', async () => {
    if (!state.students.length) return;
    const student = state.students[Math.floor(Math.random() * state.students.length)];
    try {
      await api('/api/demo', { method: 'POST', body: { id: student.id } });
      toast(`Dipaparkan: ${student.nama}`, 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    }
  });

  $('#searchDemo').addEventListener('input', (event) => {
    state.searchDemo = event.target.value.trim();
    renderDemo();
  });

  /* ================================================================ */
  /*  Sambungan langsung                                               */
  /* ================================================================ */

  function connectEvents() {
    const source = new EventSource('/api/events');
    let cubaSemula = null;

    const mulaTunggu = () => {
      clearTimeout(cubaSemula);
      cubaSemula = setTimeout(() => {
        if (source.readyState === EventSource.CLOSED) connectEvents();
      }, 3000);
    };

    source.addEventListener('open', () => clearTimeout(cubaSemula));
    source.addEventListener('error', mulaTunggu);

    source.addEventListener('stats', (event) => {
      try {
        const stats = JSON.parse(event.data);
        updateStats(stats);
        if (state.tab === 'kehadiran') loadAttendance();
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('students', (event) => {
      try {
        updateStats(JSON.parse(event.data));
        loadStudents();
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('reset', (event) => {
      try {
        updateStats(JSON.parse(event.data));
        loadAttendance();
        loadStudents();
      } catch {
        /* ignore */
      }
    });

    source.addEventListener('settings', (event) => {
      try {
        const settings = JSON.parse(event.data);
        state.settings = settings;
        if (state.tab !== 'tetapan') fillSettingsForm(settings);
      } catch {
        /* ignore */
      }
    });
  }

  /* ================================================================ */
  /*  Mula                                                             */
  /* ================================================================ */

  function paparPautanKaunter(info) {
    const u = info && info.urls;
    if (!u) return;
    const kunci = window.UI.kunciSaya ? window.UI.kunciSaya() : '';
    const tampalKunci = (pautan) =>
      info.perluKunci && kunci && !/kunci=/.test(pautan)
        ? `${pautan}${pautan.includes('?') ? '&' : '?'}kunci=${encodeURIComponent(kunci)}`
        : pautan;

    const fon = tampalKunci(u.kaunterFon || `${u.kamera}?mod=daftar`);
    const laptop = tampalKunci(u.kaunter);
    const tanpaProtokol = (t) => t.replace(/^https?:\/\//, '');
    /* Pada mod online, kedua-dua pautan sama (https sahaja) — papar satu kad saja. */
    const sama = fon === laptop;
    const kadLaptop = $('#kadLaptopKaunter');
    if (kadLaptop) kadLaptop.classList.toggle('hidden', sama);
    const tajukFon = $('#tajukFonKaunter');
    if (tajukFon) tajukFon.textContent = sama ? 'Telefon atau laptop' : 'Telefon — guna kamera';

    const qrFon = $('#kaunterQrFon');
    const qrLaptop = $('#kaunterQrLaptop');
    if (qrFon) qrFon.src = '/api/qr-link?size=264&url=' + encodeURIComponent(fon);
    if (qrLaptop) qrLaptop.src = '/api/qr-link?size=264&url=' + encodeURIComponent(laptop);

    const aFon = $('#pautanKaunterFon');
    const aLaptop = $('#pautanKaunterLaptop');
    if (aFon) {
      aFon.href = fon;
      aFon.textContent = tanpaProtokol(fon);
    }
    if (aLaptop) {
      aLaptop.href = laptop;
      aLaptop.textContent = tanpaProtokol(laptop);
    }
  }

  (async function boot() {
    const hash = (location.hash || '').replace('#', '');
    if (['murid', 'kehadiran', 'kad', 'mc', 'tetapan', 'demo'].includes(hash)) switchTab(hash);

    try {
      const info = await api('/api/bootstrap');
      state.info = info;
      state.settings = info.settings;
      fillSettingsForm(info.settings);
      updateStats(info);
      paparPautanKaunter(info);
    } catch (err) {
      toast('Pelayan tidak dapat dihubungi.', 'bad');
    }

    await loadStudents();
    connectEvents();
  })();
})();
