/* ================================================================
   FTG x GI Future Builders Fellowship — Prototype Engine
   Semua interaksi & penyimpanan data (localStorage) ada di sini.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- State ---------- */
  var DEFAULT_STATE = {
    niyyah: '',
    define: ['', '', ''],
    matrix: ['', '', '', ''],
    reflection: '',
    links: [],
    files: [],
    submittedW2: null,   // { at: ISO, words: n }
    reviewW2: null,      // { score: n, text: '', at: ISO }
    reviews: {},         // key -> { score, text, at }
    replies: []          // balasan mentee di halaman feedback
  };

  function loadState() {
    try {
      var raw = localStorage.getItem('ftgState');
      var s = raw ? JSON.parse(raw) : {};
      return Object.assign({}, DEFAULT_STATE, s);
    } catch (e) { return Object.assign({}, DEFAULT_STATE); }
  }
  function saveState() { localStorage.setItem('ftgState', JSON.stringify(S)); }
  var S = loadState();

  var PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  /* ---------- Helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function byId(prefix) { return $('[data-design-id^="' + prefix + '"]'); }
  function wordCount(t) { return (t || '').trim() ? (t || '').trim().split(/\s+/).length : 0; }
  function esc(t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
  function todayStr() {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------- Toast ---------- */
  var toastWrap;
  function toast(msg, icon) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;';
      document.body.appendChild(toastWrap);
    }
    var el = document.createElement('div');
    el.style.cssText = 'background:#2c3e50;color:#fff;padding:12px 18px;border-radius:14px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;max-width:340px;opacity:0;transform:translateY(10px);transition:all .25s ease;';
    el.innerHTML = '<span style="font-size:16px">' + (icon || '✅') + '</span><span>' + esc(msg) + '</span>';
    toastWrap.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(function () {
      el.style.opacity = '0'; el.style.transform = 'translateY(10px)';
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  /* ---------- Modal ---------- */
  function modal(html, onMount) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:20px;max-width:480px;width:100%;padding:26px;box-shadow:0 24px 60px rgba(0,0,0,.3);max-height:88vh;overflow:auto;';
    box.innerHTML = html;
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    if (onMount) onMount(box, function () { ov.remove(); });
    return { close: function () { ov.remove(); }, box: box };
  }

  /* ---------- Sidebar navigation wiring ---------- */
  var MENTEE_ROUTES = {
    'Dashboard': 'mentee-dashboard.html',
    'Design Thinking': 'design-thinking-module.html',
    'Workshop Library': 'workshop-library.html',
    'Submit Tugas': 'assignment-submission.html',
    'Progress Saya': 'progress-tracker.html',
    'Feedback Mentor': 'mentor-feedback.html',
    'Leaderboard': 'kpi-leaderboard.html',
    'Opening Ceremony': 'opening-ceremony.html',
    'Closing Ceremony': 'closing-ceremony.html'
  };
  var IS_MENTOR_PAGE = PAGE.indexOf('mentor-dashboard') === 0;

  function wireNav() {
    $all('a').forEach(function (a) {
      var txt = a.textContent.replace(/\s+/g, ' ').trim();
      var href = a.getAttribute('href');
      if (href && href !== '#') return; // sudah punya tujuan
      if (IS_MENTOR_PAGE) {
        if (txt === 'Dashboard') { a.href = 'mentor-dashboard.html'; return; }
        if (txt === 'Leaderboard') { a.href = 'kpi-leaderboard.html'; return; }
        if (/^Mentee Saya/.test(txt)) { hookScroll(a, 'mentee-list'); return; }
        if (/^Review Tugas/.test(txt) || txt === 'Berikan Feedback') { hookScroll(a, 'pending-reviews'); return; }
        if (txt === 'Progress Grup') { hookScroll(a, 'group-progress'); return; }
        if (txt === 'Kirim Pesan Grup') { a.addEventListener('click', groupMessageModal); return; }
      }
      if (MENTEE_ROUTES[txt]) { a.href = MENTEE_ROUTES[txt]; return; }
      if (txt === 'Buka Canvas →' || txt === 'Lanjut Belajar') a.href = 'design-thinking-module.html';
      else if (txt === 'Lihat semua badge →') a.href = 'progress-tracker.html';
      else if (txt === 'Kumpulkan Sekarang') a.href = 'assignment-submission.html';
      else if (txt === 'Mulai') a.href = 'design-thinking-module.html';
    });

    // Tombol "Keluar" di sidebar
    var nav = $('aside nav');
    if (nav) {
      var out = document.createElement('a');
      out.href = 'index.html';
      out.className = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-sm font-medium mt-4';
      out.innerHTML = '<i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Keluar';
      nav.appendChild(out);
    }
  }
  function hookScroll(a, prefix) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = byId(prefix);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- Notification bell ---------- */
  function wireBell() {
    var btn = byId('btn-notif') || byId('btn-mentor-notif');
    if (!btn) return;
    var notifs = IS_MENTOR_PAGE
      ? [['📥', 'Tugas baru masuk dari mentee', 'Baru saja'],
         ['⏰', '2 tugas menunggu review > 24 jam', '2 jam lalu'],
         ['📊', 'Laporan KPI mingguan siap dilihat', 'Kemarin']]
      : [['💬', 'Pak Faris mengomentari tugas W1 kamu', '1 jam lalu'],
         ['🔥', 'Streak 5 hari! Pertahankan!', 'Hari ini'],
         ['🗓', 'Workshop Career Mapping — 5 Juli', 'Kemarin']];
    var dd;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dd) { dd.remove(); dd = null; return; }
      dd = document.createElement('div');
      dd.style.cssText = 'position:absolute;top:48px;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.15);width:300px;z-index:9990;overflow:hidden;';
      dd.innerHTML = '<p style="padding:12px 16px;font-weight:700;font-size:13px;color:#2c3e50;border-bottom:1px solid #f1f5f9">Notifikasi</p>' +
        notifs.map(function (n) {
          return '<div style="padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #f8fafc"><span>' + n[0] + '</span><div><p style="font-size:12px;color:#2c3e50;font-weight:600">' + n[1] + '</p><p style="font-size:10px;color:#94a3b8">' + n[2] + '</p></div></div>';
        }).join('');
      btn.parentElement.style.position = 'relative';
      btn.parentElement.appendChild(dd);
      document.addEventListener('click', function close() { if (dd) { dd.remove(); dd = null; } document.removeEventListener('click', close); });
    });
  }

  /* ---------- Kirim pesan modal (mentee -> mentor) ---------- */
  function messageModal(to) {
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">💬 Kirim Pesan ke ' + esc(to) + '</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Pesan akan dikirim melalui platform (demo)</p>' +
      '<textarea id="msgTxt" rows="4" placeholder="Tulis pesanmu..." style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="msgSend" style="margin-top:12px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Kirim Pesan</button>',
      function (box, close) {
        $('#msgSend', box).addEventListener('click', function () {
          var t = $('#msgTxt', box).value.trim();
          if (!t) { toast('Tulis pesan dulu ya', '✏️'); return; }
          close(); toast('Pesan terkirim ke ' + to, '📨');
        });
      }
    );
  }
  function groupMessageModal(e) {
    if (e) e.preventDefault();
    messageModal('Grup Mentee (5 orang)');
  }

  /* ================================================================
     PAGE: MENTEE DASHBOARD
     ================================================================ */
  function initMenteeDashboard() {
    // tanggal live di header
    var sub = $('header p');
    if (sub) sub.textContent = todayStr() + ' · Minggu 2 dari Bulan 1';

    var msgBtn = byId('btn-msg-mentor');
    if (msgBtn) msgBtn.addEventListener('click', function () { messageModal('Pak Faris'); });
    var fbBtn = byId('btn-view-feedback');
    if (fbBtn) fbBtn.addEventListener('click', function () { location.href = 'mentor-feedback.html'; });
    var prep = byId('btn-workshop-prep');
    if (prep) prep.addEventListener('click', function () { location.href = 'workshop-library.html'; });

    // progres tugas berdasarkan state
    var defineDone = S.define.every(function (v) { return v.trim(); });
    if (S.submittedW2) {
      // stat "Tugas Dikumpul" 2/3 -> 3/3
      $all('p').forEach(function (p) {
        if (p.textContent.trim() === '2/3') p.textContent = '3/3';
      });
      $all('span').forEach(function (sp) {
        if (sp.textContent.trim() === '1 pending') { sp.textContent = 'Semua beres ✓'; sp.className = 'text-[#22c55e] text-xs font-semibold bg-[#22c55e]/10 px-2 py-0.5 rounded-full'; }
        if (sp.textContent.trim() === '2 dari 4 selesai') sp.textContent = '4 dari 4 selesai 🎉';
      });
      // task 3 & 4 jadi selesai
      var tasks = byId('weekly-tasks');
      if (tasks) {
        var rows = $all('.space-y-3 > div', tasks);
        [2, 3].forEach(function (i) {
          var r = rows[i]; if (!r) return;
          r.className = 'flex items-start gap-3 p-3 rounded-xl bg-[#22c55e]/5 border border-[#22c55e]/20';
          var titles = ['Isi Bagian DEFINE di Canvas', 'Kumpulkan Tugas Minggu 2'];
          r.innerHTML =
            '<div class="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center flex-shrink-0 mt-0.5"><i class="fa-solid fa-check text-white text-[10px]"></i></div>' +
            '<div class="flex-1"><p class="text-[#2c3e50] text-sm font-semibold line-through opacity-60">' + titles[i - 2] + '</p>' +
            '<p class="text-slate-400 text-xs">Selesai · ' + new Date(S.submittedW2.at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) + '</p></div>' +
            '<span class="text-[#22c55e] text-xs font-semibold">✓ Selesai</span>';
        });
      }
      // progress banner 38% -> 55%
      $all('p').forEach(function (p) { if (p.textContent.trim() === '38%') p.textContent = '55%'; });
      $all('.progress-bar').forEach(function (b) { b.style.width = '55%'; });
      // fase DEFINE jadi selesai di kartu canvas
      $all('p').forEach(function (p) {
        if (p.textContent.trim() === 'Sedang dikerjakan' && p.previousElementSibling && p.previousElementSibling.textContent.trim() === 'DEFINE') {
          p.textContent = '✓ Selesai';
        }
      });
    } else if (defineDone) {
      var tasks2 = byId('weekly-tasks');
      if (tasks2) {
        var rows2 = $all('.space-y-3 > div', tasks2);
        var r3 = rows2[3];
        if (r3) { r3.classList.remove('opacity-60'); var lockP = $('p.text-slate-400', r3); if (lockP) lockP.textContent = 'Terbuka! Kumpulkan sekarang 🚀'; }
      }
    }

    // update pesan mentor terbaru jika sudah ada review W2
    if (S.reviewW2) {
      var quote = $('[data-design-id^="mentor-card"] .italic');
      if (quote) quote.textContent = '"' + S.reviewW2.text + '"';
    }
  }

  /* ================================================================
     PAGE: DESIGN THINKING MODULE
     ================================================================ */
  function initDesignThinking() {
    // NIYYAH
    var niyyah = $('header + div input[type=text]') || $('[data-design-id^="canvas-section"] input[type=text]');
    if (niyyah) {
      niyyah.value = S.niyyah;
      niyyah.addEventListener('input', function () { S.niyyah = niyyah.value; saveState(); });
    }
    // DEFINE (3 textarea di dalam kolom canvas)
    var canvas = byId('canvas-section');
    if (canvas) {
      var defTa = $all('textarea', canvas);
      defTa.forEach(function (ta, i) {
        ta.value = S.define[i] || '';
        ta.addEventListener('input', function () { S.define[i] = ta.value; saveState(); });
      });
    }
    // Values Matrix (4 textarea)
    var matrixSec = byId('values-matrix');
    if (matrixSec) {
      $all('textarea', matrixSec).forEach(function (ta, i) {
        ta.value = S.matrix[i] || '';
        ta.addEventListener('input', function () { S.matrix[i] = ta.value; saveState(); });
      });
    }
    // Refleksi singkat di kartu tugas
    var assignSec = byId('week-assignment');
    if (assignSec) {
      var refTa = $('textarea', assignSec);
      if (refTa) {
        refTa.value = S.reflection;
        refTa.addEventListener('input', function () { S.reflection = refTa.value; saveState(); });
      }
    }
    // Tombol simpan
    var saveC = byId('btn-save-canvas');
    if (saveC) saveC.addEventListener('click', function () { saveState(); toast('Progres canvas tersimpan', '💾'); });
    var saveM = byId('btn-save-matrix');
    if (saveM) saveM.addEventListener('click', function () {
      saveState();
      var filled = S.matrix.filter(function (v) { return v.trim(); }).length;
      toast('Matrix tersimpan (' + filled + '/4 kuadran terisi)', '💾');
    });
    // Kumpulkan W2 -> ke halaman submit
    var sub = byId('btn-submit-w2');
    if (sub) sub.addEventListener('click', function () { saveState(); location.href = 'assignment-submission.html'; });
    // Lampirkan file
    var up = byId('btn-upload-file');
    if (up) wireFilePicker(up);
    // Tab minggu
    [['btn-week1-tab', 'Minggu 1 sudah selesai — skor kamu 87/100 ⭐', '✅'],
     ['btn-week3-tab', 'Minggu 3 (IDEATE) terbuka setelah tugas W2 dinilai', '🔒'],
     ['btn-week4-tab', 'Minggu 4 (PROTOTYPE + TEST) masih terkunci', '🔒']]
      .forEach(function (cfg) {
        var b = byId(cfg[0]);
        if (b) b.addEventListener('click', function () { toast(cfg[1], cfg[2]); });
      });
    var w2b = byId('btn-week2-tab');
    if (w2b) w2b.addEventListener('click', function () { toast('Kamu sedang di Minggu 2 — DEFINE', '📍'); });
    // back chevron
    var back = $('header a');
    if (back && back.getAttribute('href') === '#') back.href = 'mentee-dashboard.html';
  }

  function wireFilePicker(btn) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.style.display = 'none';
    inp.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
    document.body.appendChild(inp);
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      if (inp.files.length) {
        var name = inp.files[0].name;
        if (S.files.indexOf(name) === -1) S.files.push(name);
        saveState();
        toast('File "' + name + '" dilampirkan', '📎');
      }
    });
  }

  /* ================================================================
     PAGE: ASSIGNMENT SUBMISSION
     ================================================================ */
  function initAssignment() {
    var form = byId('submission-form');
    if (!form) return;
    var ta = $('textarea', form);
    var counters = $all('.flex.justify-between p', form);
    var wordP = null;
    counters.forEach(function (p) { if (/kata ditulis/.test(p.textContent)) wordP = p; });

    // kartu status di brief
    function updateBrief() {
      var brief = byId('assignment-brief');
      if (!brief) return;
      var cards = $all('.grid.grid-cols-3 > div', brief);
      // matrix
      if (cards[1]) {
        var filled = S.matrix.filter(function (v) { return v.trim(); }).length;
        var st = $('p:last-child', cards[1]);
        if (filled === 4) {
          cards[1].className = 'bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-3';
          $('i', cards[1]).className = 'fa-solid fa-circle-check text-[#22c55e] mb-1';
          if (st) { st.textContent = 'Lengkap ✓'; st.className = 'text-[10px] text-[#22c55e]'; }
        } else if (st) st.textContent = filled + ' / 4 kuadran';
      }
      // refleksi
      if (cards[2]) {
        var wc = wordCount(ta ? ta.value : '');
        var st2 = $('p:last-child', cards[2]);
        if (st2) st2.textContent = wc + ' / 200 kata';
        if (wc >= 200) {
          cards[2].className = 'bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-3';
          $('i', cards[2]).className = 'fa-solid fa-circle-check text-[#22c55e] mb-1';
          st2.className = 'text-[10px] text-[#22c55e]';
        }
      }
    }

    if (ta) {
      ta.value = S.reflection;
      ta.addEventListener('input', function () {
        S.reflection = ta.value; saveState();
        if (wordP) wordP.textContent = wordCount(ta.value) + ' kata ditulis';
        updateBrief();
      });
      if (wordP) wordP.textContent = wordCount(ta.value) + ' kata ditulis';
    }
    updateBrief();

    // tambah link
    var addBtn = byId('btn-add-link');
    var linkInp = addBtn ? $('input[type=text]', addBtn.parentElement) : null;
    var chipWrap = document.createElement('div');
    chipWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
    if (addBtn) {
      addBtn.parentElement.parentElement.appendChild(chipWrap);
      function renderChips() {
        chipWrap.innerHTML = S.links.map(function (l, i) {
          return '<span style="background:#f1f5f9;border:1px solid #e2e8f0;color:#334155;font-size:11px;padding:4px 10px;border-radius:99px;display:inline-flex;align-items:center;gap:6px">🔗 ' + esc(l.length > 40 ? l.slice(0, 40) + '…' : l) +
            '<b data-del="' + i + '" style="cursor:pointer;color:#94a3b8">×</b></span>';
        }).join('');
        $all('[data-del]', chipWrap).forEach(function (x) {
          x.addEventListener('click', function () { S.links.splice(+x.getAttribute('data-del'), 1); saveState(); renderChips(); });
        });
      }
      renderChips();
      addBtn.addEventListener('click', function () {
        var v = (linkInp.value || '').trim();
        if (!v) { toast('Isi link dulu ya', '✏️'); return; }
        if (!/^https?:\/\//.test(v)) v = 'https://' + v;
        S.links.push(v); saveState(); linkInp.value = '';
        renderChips(); toast('Link ditambahkan', '🔗');
      });
    }

    // upload
    var browse = byId('btn-browse-files');
    if (browse) wireFilePicker(browse);

    // simpan draft
    var draft = byId('btn-save-draft');
    if (draft) draft.addEventListener('click', function () { saveState(); toast('Draft tersimpan — bisa dilanjut kapan saja', '💾'); });

    // kumpulkan
    var submitBtn = byId('btn-submit-assignment');
    function markSubmitted() {
      if (!submitBtn) return;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Sudah Dikumpulkan — Menunggu Review';
      submitBtn.className = submitBtn.className.replace('bg-[#f97316]', 'bg-[#22c55e]').replace('hover:bg-[#ea6c0a]', '');
      // riwayat W2
      var hist = byId('submission-history');
      if (hist) {
        $all('span', hist).forEach(function (sp) {
          if (sp.textContent.trim() === 'Draft') { sp.textContent = '📨 Menunggu Review'; sp.className = 'bg-[#8b5cf6] text-white text-[10px] font-bold px-2 py-0.5 rounded-full'; }
        });
        $all('p', hist).forEach(function (p) {
          if (/Belum dikumpulkan/.test(p.textContent)) p.textContent = 'Dikumpul: ' + new Date(S.submittedW2.at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) + ' · Menunggu penilaian mentor';
        });
      }
    }
    if (S.submittedW2) markSubmitted();
    if (submitBtn) submitBtn.addEventListener('click', function () {
      if (S.submittedW2) { toast('Tugas sudah dikumpulkan — menunggu review mentor', '📨'); return; }
      var wc = wordCount(S.reflection);
      if (wc === 0) { toast('Tulis refleksimu dulu sebelum mengumpulkan', '✏️'); return; }
      function doSubmit() {
        S.submittedW2 = { at: new Date().toISOString(), words: wc };
        saveState(); markSubmitted();
        modal(
          '<div style="text-align:center">' +
          '<div style="font-size:52px;margin-bottom:8px">🎉</div>' +
          '<h3 style="font-weight:800;color:#2c3e50;font-size:18px;margin-bottom:6px">Tugas Minggu 2 Terkirim!</h3>' +
          '<p style="font-size:13px;color:#64748b;margin-bottom:16px">Refleksi ' + wc + ' kata + Canvas DEFINE + Values Matrix sudah dikirim ke <b>Pak Faris</b>. Kamu mendapat <b style="color:#22c55e">+50 poin KPI</b>!</p>' +
          '<button id="okBtn" style="background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px 28px;border-radius:12px;border:0;cursor:pointer">Lihat Dashboard</button></div>',
          function (box, close) {
            $('#okBtn', box).addEventListener('click', function () { location.href = 'mentee-dashboard.html'; });
          }
        );
      }
      if (wc < 200) {
        modal(
          '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:6px">Refleksi baru ' + wc + ' dari 200 kata</h3>' +
          '<p style="font-size:13px;color:#64748b;margin-bottom:16px">Target minimal 200 kata. Tetap kumpulkan sekarang?</p>' +
          '<div style="display:flex;gap:10px"><button id="cancelB" style="flex:1;background:#f1f5f9;color:#475569;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Tulis Lagi</button>' +
          '<button id="goB" style="flex:1;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Tetap Kumpulkan</button></div>',
          function (box, close) {
            $('#cancelB', box).addEventListener('click', close);
            $('#goB', box).addEventListener('click', function () { close(); doSubmit(); });
          }
        );
      } else doSubmit();
    });
  }

  /* ================================================================
     PAGE: MENTOR DASHBOARD
     ================================================================ */
  var REVIEW_META = {
    'review-arya-w1': { name: 'Arya Ramadhan', task: 'Tugas Week 1 — EMPATHIZE' },
    'review-dina-w1': { name: 'Dina Fitriani', task: 'Tugas Week 1 — EMPATHIZE + Niyyah' },
    'review-bagas-w1': { name: 'Bagas Nugroho', task: 'Tugas Week 1 — Values Matrix' },
    'review-arya-w2': { name: 'Arya Ramadhan', task: 'Tugas Week 2 — DEFINE + Values Matrix' }
  };

  function pendingCount() {
    var keys = ['review-arya-w1', 'review-dina-w1', 'review-bagas-w1'];
    if (S.submittedW2) keys.push('review-arya-w2');
    return keys.filter(function (k) { return !S.reviews[k]; }).length;
  }

  function reviewModal(key, onDone) {
    var meta = REVIEW_META[key];
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:2px">📝 Review — ' + esc(meta.name) + '</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:14px">' + esc(meta.task) + '</p>' +
      (key === 'review-arya-w2' && S.reflection ?
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px;max-height:120px;overflow:auto"><p style="font-size:11px;font-weight:700;color:#8b5cf6;margin-bottom:4px">Refleksi mentee (' + wordCount(S.reflection) + ' kata):</p><p style="font-size:12px;color:#475569;font-style:italic">"' + esc(S.reflection.slice(0, 400)) + (S.reflection.length > 400 ? '…' : '') + '"</p></div>' : '') +
      '<label style="font-size:12px;font-weight:700;color:#334155">Skor: <span id="scoreVal" style="color:#1a5f4f;font-size:16px">85</span>/100</label>' +
      '<input id="scoreRange" type="range" min="50" max="100" value="85" style="width:100%;margin:8px 0 14px;accent-color:#1a5f4f">' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Feedback untuk mentee</label>' +
      '<textarea id="fbTxt" rows="3" placeholder="Contoh: DEFINE-mu tajam! Problem statement sudah spesifik..." style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="fbSave" style="margin-top:12px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Simpan Penilaian</button>',
      function (box, close) {
        var range = $('#scoreRange', box), val = $('#scoreVal', box);
        range.addEventListener('input', function () { val.textContent = range.value; });
        $('#fbSave', box).addEventListener('click', function () {
          var text = $('#fbTxt', box).value.trim() || 'Kerja bagus! Pertahankan konsistensinya.';
          S.reviews[key] = { score: +range.value, text: text, at: new Date().toISOString() };
          if (key === 'review-arya-w2') S.reviewW2 = S.reviews[key];
          saveState(); close();
          toast('Penilaian ' + meta.name + ' tersimpan — ' + range.value + '/100', '⭐');
          if (onDone) onDone();
        });
      }
    );
  }

  function initMentorDashboard() {
    var sub = $('header p');
    if (sub) sub.textContent = todayStr() + ' · Bulan 1, Minggu 2 · 5 Mentee Aktif';

    var queue = byId('pending-reviews');
    var staticKeys = ['review-arya-w1', 'review-dina-w1', 'review-bagas-w1'];

    // Tandai semua elemen penghitung "3" sekali di awal, supaya bisa
    // terus diperbarui berapapun nilainya sekarang.
    $all('span, p').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === '3' && (el.className.indexOf('ef4444') > -1 || el.className.indexOf('text-2xl') > -1)) {
        el.setAttribute('data-ftg-count', '1');
      }
      if (t === '3 Tugas Pending') el.setAttribute('data-ftg-count-label', '1');
    });
    function refreshCounts() {
      var n = pendingCount();
      $all('[data-ftg-count]').forEach(function (el) { el.textContent = n; });
      $all('[data-ftg-count-label]').forEach(function (el) { el.textContent = n + ' Tugas Pending'; });
      if (n === 0) {
        var alertBox = $('aside div.mx-4.mb-4');
        if (alertBox) alertBox.innerHTML = '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">🎉</span><span class="text-white text-sm font-semibold">Semua tugas sudah direview!</span></div>';
      }
    }

    function markCardDone(card, key) {
      var r = S.reviews[key];
      card.style.opacity = '1';
      card.className = 'bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-3';
      var nm = REVIEW_META[key].name.split(' ')[0];
      card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">' + nm + ' — ' + esc(REVIEW_META[key].task.split('—')[0].trim()) + '</p>' +
        '<span class="text-[#22c55e] text-[10px] font-bold">✓ Dinilai</span></div>' +
        '<p class="text-slate-500 text-xs">Skor <b class="text-[#1a5f4f]">' + r.score + '/100</b> · feedback terkirim ke mentee</p>';
    }

    if (queue) {
      var cards = $all('.space-y-2 > div', queue);
      // kartu W2 dinamis milik Arya
      if (S.submittedW2) {
        var w2card = document.createElement('div');
        w2card.className = 'bg-[#8b5cf6]/5 border-2 border-[#8b5cf6]/40 rounded-xl p-3';
        w2card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">🆕 Arya — Tugas Week 2</p>' +
          '<span class="text-[#8b5cf6] text-[10px] font-semibold">Baru masuk!</span></div>' +
          '<p class="text-slate-500 text-xs mb-2">DEFINE + Values Matrix + Refleksi ' + (S.submittedW2.words || 0) + ' kata</p>' +
          '<button type="button" class="w-full bg-[#8b5cf6] text-white text-xs font-semibold py-1.5 rounded-lg">Review & Nilai</button>';
        var container = $('.space-y-2', queue);
        container.insertBefore(w2card, container.firstChild);
        if (S.reviews['review-arya-w2']) markCardDone(w2card, 'review-arya-w2');
        else $('button', w2card).addEventListener('click', function () {
          reviewModal('review-arya-w2', function () { markCardDone(w2card, 'review-arya-w2'); refreshCounts(); });
        });
      }
      cards.forEach(function (card, i) {
        var key = staticKeys[i];
        if (!key) return;
        if (S.reviews[key]) { markCardDone(card, key); return; }
        var b = $('button', card);
        if (b) b.addEventListener('click', function () {
          reviewModal(key, function () { markCardDone(card, key); refreshCounts(); });
        });
      });
    }
    refreshCounts();

    // update baris Arya kalau W2 sudah dikumpul
    if (S.submittedW2) {
      var row1 = byId('mentee-row-1');
      if (row1) {
        $all('span', row1).forEach(function (sp) {
          if (/Tugas W2 belum dikumpul/.test(sp.textContent)) sp.textContent = '· Tugas W2 sudah dikumpul 🎉';
          if (sp.textContent.trim() === '38%') sp.textContent = '55%';
        });
        var bar = $('.h-1\\.5.bg-\\[\\#22c55e\\]', row1); if (bar) bar.style.width = '55%';
        if (S.reviews['review-arya-w2']) {
          $all('span', row1).forEach(function (sp) {
            if (sp.textContent.trim() === 'Review Needed') { sp.textContent = 'On Track'; sp.className = 'text-[#22c55e] text-xs font-semibold bg-[#22c55e]/10 px-2 py-1 rounded-lg'; }
          });
        }
      }
    }

    // tombol sidebar & quick actions
    var sr = byId('btn-sidebar-review');
    if (sr) sr.addEventListener('click', function () { var q = byId('pending-reviews'); if (q) q.scrollIntoView({ behavior: 'smooth' }); });
    var rem = byId('btn-send-reminder');
    if (rem) rem.addEventListener('click', function () { toast('Pengingat terkirim ke Muhammad Rizky', '📨'); });
    var sch = byId('btn-schedule-session');
    if (sch) sch.addEventListener('click', function () { toast('Sesi 1-on-1 dijadwalkan — undangan terkirim', '🗓'); });
    var ann = byId('btn-group-announce');
    if (ann) ann.addEventListener('click', function () { messageModal('Grup Mentee (5 orang)'); });
    var flt = byId('btn-filter-mentee');
    if (flt) flt.addEventListener('click', function () { toast('Filter mentee (demo)', '🔍'); });
    // chevron detail mentee
    var names = ['Arya Ramadhan', 'Siti Aisyah', 'Muhammad Rizky', 'Dina Fitriani', 'Bagas Nugroho'];
    names.forEach(function (nm, i) {
      var b = byId('btn-view-mentee-' + (i + 1));
      if (b) b.addEventListener('click', function () { toast('Membuka profil ' + nm + ' (demo)', '👤'); });
    });
  }

  /* ================================================================
     PAGE: MENTOR FEEDBACK (mentee melihat feedback)
     ================================================================ */
  function initMentorFeedback() {
    var msgBtn = byId('btn-msg-mentor-mf');
    if (msgBtn) msgBtn.addEventListener('click', function () { messageModal('Pak Faris'); });

    // balasan thread W1
    var reply = byId('btn-reply-feedback');
    if (reply) {
      var inp = reply.previousElementSibling;
      var thread = reply.closest('.border-t');
      // render balasan tersimpan
      S.replies.forEach(function (r) { appendReply(thread, reply, r); });
      reply.addEventListener('click', function () {
        var t = (inp.value || '').trim();
        if (!t) { toast('Tulis balasan dulu ya', '✏️'); return; }
        S.replies.push(t); saveState();
        appendReply(thread, reply, t);
        inp.value = '';
        toast('Balasan terkirim ke Pak Faris', '📨');
      });
    }

    // kartu feedback W2 dari review mentor
    if (S.reviewW2) {
      var pend = byId('feedback-pending');
      if (pend) {
        var d = new Date(S.reviewW2.at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
        var stars = Math.round(S.reviewW2.score / 20);
        var starHtml = '';
        for (var i = 1; i <= 5; i++) starHtml += '<i class="fa-' + (i <= stars ? 'solid' : 'regular') + ' fa-star text-' + (i <= stars ? '[#f97316]' : 'slate-300') + ' text-xs"></i>';
        pend.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
        pend.style.textAlign = 'left';
        pend.innerHTML =
          '<div class="flex items-start justify-between mb-3">' +
          '<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-[#1a5f4f] flex items-center justify-center text-white font-bold">BF</div>' +
          '<div><p class="text-[#2c3e50] text-sm font-semibold">Pak Faris</p><p class="text-slate-400 text-xs">' + d + ' · Tugas Minggu 2 <span class="bg-[#8b5cf6]/10 text-[#8b5cf6] font-bold px-2 py-0.5 rounded-full ml-1">BARU</span></p></div></div>' +
          '<div class="text-right"><p class="text-[#1a5f4f] text-xl font-bold">' + S.reviewW2.score + ' <span class="text-slate-400 text-sm font-normal">/ 100</span></p><div class="flex gap-0.5 justify-end">' + starHtml + '</div></div></div>' +
          '<div class="bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 rounded-xl p-4"><p class="text-[#2c3e50] text-sm">“' + esc(S.reviewW2.text) + '”</p></div>';
        // update tile rangkuman W2
        var summary = byId('score-summary');
        if (summary) {
          var tiles = $all('.grid > div', summary);
          if (tiles[1]) {
            tiles[1].innerHTML = '<p class="text-[#f97316] text-2xl font-bold">' + S.reviewW2.score + '</p><p class="text-slate-500 text-xs">W2 DEFINE</p><p class="text-[#22c55e] text-[10px] mt-1 font-bold">✓ Dinilai</p>';
          }
        }
      }
    } else if (S.submittedW2) {
      var pend2 = byId('feedback-pending');
      if (pend2) {
        $all('p', pend2).forEach(function (p) {
          if (/belum dikumpulkan/i.test(p.textContent)) p.textContent = 'Tugas Minggu 2 sudah dikumpulkan 🎉';
          if (/Kumpulkan tugasmu/.test(p.textContent)) p.textContent = 'Menunggu review dari Pak Faris (biasanya < 24 jam)';
        });
        var cta = $('a', pend2); if (cta) cta.remove();
      }
    }
  }
  function appendReply(thread, replyBtn, text) {
    if (!thread) return;
    var row = document.createElement('div');
    row.className = 'flex items-start gap-3 mb-2';
    row.innerHTML = '<div class="w-7 h-7 rounded-full bg-[#f97316] flex items-center justify-center text-white text-xs font-bold">AR</div>' +
      '<div class="flex-1 bg-slate-50 rounded-xl p-2.5"><p class="text-slate-600 text-xs">"' + esc(text) + '"</p>' +
      '<p class="text-slate-400 text-[10px] mt-1">' + todayStr() + ' · Arya</p></div>';
    thread.insertBefore(row, replyBtn.closest('.flex.items-center'));
  }

  /* ================================================================
     PAGE: KPI LEADERBOARD
     ================================================================ */
  function initLeaderboard() {
    var table = byId('leaderboard-table');
    if (!table) return;
    var rows = $all('article, div.px-6.py-2\\.5', table);
    function pathOf(row) {
      var t = row.textContent;
      if (/Entrep/.test(t)) return 'ent';
      if (/Career/.test(t)) return 'career';
      return '';
    }
    var btns = { all: byId('btn-filter-all-lb'), career: byId('btn-filter-career-lb'), ent: byId('btn-filter-ent-lb') };
    function setFilter(which) {
      rows.forEach(function (r) {
        var p = pathOf(r);
        r.style.display = (which === 'all' || !p || p === which) ? '' : 'none';
      });
      Object.keys(btns).forEach(function (k) {
        var b = btns[k]; if (!b) return;
        if (k === which) b.className = 'px-3 py-1.5 rounded-full bg-[#2c3e50] text-white text-xs font-semibold';
        else b.className = 'px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs';
      });
    }
    if (btns.all) btns.all.addEventListener('click', function () { setFilter('all'); });
    if (btns.career) btns.career.addEventListener('click', function () { setFilter('career'); });
    if (btns.ent) btns.ent.addEventListener('click', function () { setFilter('ent'); });
  }

  /* ================================================================
     PAGE: WORKSHOP LIBRARY
     ================================================================ */
  function initWorkshopLibrary() {
    var main = $('main');
    var sections = $all('main .px-8 > div.mb-6, main .px-8 > div:not(.mb-6)', main).filter(function (d) {
      return /Career Path — 4 Workshop|Entrepreneur Path — 4 Workshop/.test(d.textContent);
    });
    var careerSec = sections.filter(function (s) { return /Career Path — 4/.test(s.textContent); })[0];
    var entSec = sections.filter(function (s) { return /Entrepreneur Path — 4/.test(s.textContent); })[0];
    var btns = { all: byId('btn-path-all'), career: byId('btn-path-career'), ent: byId('btn-path-entrepreneur') };
    function setPath(which) {
      if (careerSec) careerSec.style.display = (which === 'ent') ? 'none' : '';
      if (entSec) entSec.style.display = (which === 'career') ? 'none' : '';
      Object.keys(btns).forEach(function (k) {
        var b = btns[k]; if (!b) return;
        if (k === which) b.className = 'px-3 py-1.5 rounded-full bg-[#2c3e50] text-white text-xs font-semibold';
        else b.className = 'px-3 py-1.5 rounded-full text-slate-500 text-xs font-medium';
      });
    }
    if (btns.all) btns.all.addEventListener('click', function () { setPath('all'); });
    if (btns.career) btns.career.addEventListener('click', function () { setPath('career'); });
    if (btns.ent) btns.ent.addEventListener('click', function () { setPath('ent'); });

    // Pre-work workshop pertama
    var pre = byId('btn-prework-c1');
    if (pre) pre.addEventListener('click', function () {
      modal(
        '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">🎯 Pre-Work — Career Mapping & Personal Branding</h3>' +
        '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Selesaikan sebelum Sabtu, 5 Juli 2026</p>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:14px">' +
        '<p style="font-size:12px;color:#334155;font-weight:700;margin-bottom:8px">Checklist:</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:6px">1️⃣ Buat / perbarui draft profil LinkedIn</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:6px">2️⃣ Susun CV satu halaman (template disediakan)</p>' +
        '<p style="font-size:12px;color:#475569">3️⃣ Tulis 3 kekuatan utama versi kamu</p></div>' +
        '<button id="startPre" style="width:100%;background:#8b5cf6;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Mulai Kerjakan</button>',
        function (box, close) {
          $('#startPre', box).addEventListener('click', function () { close(); toast('Pre-Work dimulai — semangat! 🚀', '🎯'); });
        }
      );
    });
    // tombol terkunci
    $all('[data-design-id^="btn-locked-"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var m = b.textContent.match(/Terbuka (.+)/);
        toast('Workshop ini terkunci — terbuka ' + (m ? m[1].trim() : 'nanti'), '🔒');
      });
    });
  }

  /* ================================================================
     PAGE: PROGRESS TRACKER
     ================================================================ */
  function initProgressTracker() {
    var check = byId('weekly-checklist');
    if (!check) return;
    var items = $all('.space-y-2 > div', check);
    var defineDone = S.define.every(function (v) { return v.trim(); });
    var matrixDone = S.matrix.every(function (v) { return v.trim(); });
    var done = 2; // dua item pertama memang selesai
    function mark(row, label) {
      if (!row) return;
      row.className = 'flex items-center gap-3 p-2 rounded-lg bg-[#22c55e]/5';
      row.innerHTML = '<div class="w-5 h-5 rounded bg-[#22c55e] flex items-center justify-center"><i class="fa-solid fa-check text-white text-[9px]"></i></div>' +
        '<span class="text-xs text-[#2c3e50]">' + label + '</span><span class="ml-auto text-[#22c55e] text-[10px] font-bold">✓</span>';
      done++;
    }
    if (defineDone || S.submittedW2) mark(items[2], 'Selesaikan DEFINE di canvas');
    if (matrixDone || S.submittedW2) mark(items[3], 'Isi Values-Alignment Matrix');
    if (S.submittedW2) mark(items[4], 'Kumpulkan tugas sebelum deadline');
    // bar & label
    var pct = Math.round(done / 5 * 100);
    var barWrap = $('.mt-3', check);
    if (barWrap) {
      var lbl = $('p', barWrap); if (lbl) lbl.textContent = 'Progres minggu ini: ' + done + ' dari 5 selesai';
      var bar = $('.h-1\\.5 .h-1\\.5, div > div', barWrap);
      var inner = barWrap.querySelector('div > div');
      if (inner) inner.style.width = pct + '%';
    }
    if (S.submittedW2) {
      $all('p').forEach(function (p) { if (p.textContent.trim() === '38%') p.textContent = '55%'; });
      $all('[style*="width:38%"]').forEach(function (b) { b.style.width = '55%'; });
    }
  }

  /* ================================================================
     PAGE: CLOSING CEREMONY (hitung mundur live)
     ================================================================ */
  function initClosing() {
    var target = new Date('2026-08-31T09:00:00+07:00');
    var days = Math.max(0, Math.ceil((target - new Date()) / 86400000));
    $all('p').forEach(function (p) {
      if (p.textContent.trim() === '75' && p.className.indexOf('text-2xl') > -1) p.textContent = days;
    });
    $all('p, span').forEach(function (p) {
      if (/75 hari lagi menuju Demo Day/.test(p.textContent)) p.textContent = p.textContent.replace('75', days);
    });
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    try { wireNav(); } catch (e) { console.warn(e); }
    try { wireBell(); } catch (e) { console.warn(e); }
    try {
      if (PAGE.indexOf('mentee-dashboard') === 0) initMenteeDashboard();
      else if (PAGE.indexOf('design-thinking') === 0) initDesignThinking();
      else if (PAGE.indexOf('assignment-submission') === 0) initAssignment();
      else if (PAGE.indexOf('mentor-dashboard') === 0) initMentorDashboard();
      else if (PAGE.indexOf('mentor-feedback') === 0) initMentorFeedback();
      else if (PAGE.indexOf('kpi-leaderboard') === 0) initLeaderboard();
      else if (PAGE.indexOf('workshop-library') === 0) initWorkshopLibrary();
      else if (PAGE.indexOf('progress-tracker') === 0) initProgressTracker();
      else if (PAGE.indexOf('closing-ceremony') === 0) initClosing();
    } catch (e) { console.error('FTG init error:', e); }
  });
})();
