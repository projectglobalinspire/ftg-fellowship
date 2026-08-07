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
    replies: [],         // balasan mentee di halaman feedback
    messages: [],        // chat mentee <-> mentor: { from, fromName, text, at }
    events: [],          // notifikasi: { icon, text, forRole, at, read }
    session1on1: null    // jadwal sesi: { date, time, note, by, at }
  };

  /* Konten demo — terisi otomatis saat pertama kali dibuka (atau setelah
     localStorage.clear()) supaya platform terlihat sudah hidup dipakai. */
  var SEED = {
    niyyah: 'Saya ingin membantu pemuda Bandung menemukan karir yang bermakna, agar ilmu yang mereka miliki menjadi manfaat bagi keluarga dan komunitasnya.',
    define: [
      'Lulusan baru di Bandung kesulitan menerjemahkan skill menjadi karir karena tidak tahu cara mempresentasikan kekuatan dirinya.',
      '3 dari 5 narasumber punya portofolio bagus tapi tidak percaya diri menceritakannya — masalahnya visibility, bukan kemampuan.',
      'Fresh graduate usia 21-25 tahun yang baru lulus tanpa jaringan profesional dan bimbingan karir.'
    ],
    matrix: [
      'Program mentoring karir 12 minggu berbasis komunitas — selaras niyyah, dibutuhkan banyak orang',
      'Kelas menulis CV & LinkedIn gratis tiap pekan di masjid kampus',
      'Jasa pembuatan CV instan berbayar — laku tapi tidak membangun kemampuan orangnya',
      'Event seminar besar tanpa tindak lanjut yang jelas'
    ],
    reflection: 'Minggu ini saya belajar bahwa mendefinisikan masalah ternyata jauh lebih sulit daripada menemukan masalah. Saat memulai fase DEFINE, saya mengira cukup menuliskan bahwa pemuda Bandung kesulitan mencari kerja. Namun setelah membaca kembali hasil wawancara di fase EMPATHIZE, saya sadar bahwa masalah sebenarnya bukan lapangan kerja yang kurang, melainkan banyak lulusan baru yang tidak tahu cara menerjemahkan kemampuan mereka menjadi sesuatu yang bernilai di mata perusahaan. Tiga dari lima narasumber saya punya portofolio bagus, tetapi tidak percaya diri saat menceritakannya. Dari situ saya menyusun problem statement: lulusan baru usia 21 sampai 25 tahun di Bandung membutuhkan cara yang terstruktur untuk mengenali dan mempresentasikan kekuatan diri, karena tanpa itu mereka kalah bersaing bukan karena kurang mampu, tetapi karena tidak terlihat. Insight yang paling mengejutkan adalah faktor kepercayaan diri ternyata lebih menentukan daripada faktor keterampilan teknis. Values-Alignment Matrix juga membantu saya menyaring ide. Program mentoring karir berbasis komunitas masuk kuadran sweet spot karena selaras dengan niyyah saya dan kebutuhannya nyata, sementara ide yang sekadar ramai tetapi tidak sesuai nilai saya letakkan di kuadran avoid. Minggu depan saya ingin menguji problem statement ini dengan mewawancarai dua narasumber tambahan, supaya fase IDEATE nanti berangkat dari masalah yang benar-benar tervalidasi, bukan asumsi saya sendiri. Semoga langkah kecil ini menjadi awal kontribusi nyata untuk kota saya.',
    links: ['https://docs.google.com/document/d/gi-canvas-arya-w2'],
    files: ['Values-Matrix-Arya.pdf'],
    messages: [
      { from: 'mentor', fromName: 'Bapak Faris', text: 'Arya, bagian Empathize-mu bagus! Coba tambahkan insight tentang user pain points ya. Semangat! 💪', at: new Date(Date.now() - 36e5).toISOString() },
      { from: 'mentee', fromName: 'Arya Ramadhan', text: 'Siap Pak! Sedang saya kerjakan bagian DEFINE-nya. 🙏', at: new Date(Date.now() - 30e5).toISOString() }
    ],
    events: [
      { icon: '💬', text: 'Pak Faris mengomentari tugas W1 kamu', forRole: 'mentee', at: new Date(Date.now() - 36e5).toISOString(), read: false },
      { icon: '🔥', text: 'Streak 5 hari! Pertahankan!', forRole: 'mentee', at: new Date(Date.now() - 7e6).toISOString(), read: false },
      { icon: '🗓', text: 'Workshop Career Mapping — Sabtu, 5 Juli', forRole: 'mentee', at: new Date(Date.now() - 9e7).toISOString(), read: false },
      { icon: '⏰', text: '3 tugas mentee menunggu review', forRole: 'mentor', at: new Date(Date.now() - 5e6).toISOString(), read: false },
      { icon: '📊', text: 'Laporan KPI mingguan siap dilihat', forRole: 'mentor', at: new Date(Date.now() - 9e7).toISOString(), read: false }
    ]
  };

  /* ================================================================
     Data 5 mentee — semua tersimpan di satu dokumen server (row 1)
     G = { mentees: {1..5}, updatedAt, updatedBy }
     S = state milik mentee yang sedang aktif (kompatibel dgn semua kode lama)
     ================================================================ */
  var MENTEES = {
    1: { name: 'Arya Ramadhan',  initials: 'AR', path: 'Career Path',       email: 'arya@ftg.id',  color: '#f97316', baseProgress: 38 },
    2: { name: 'Siti Aisyah',    initials: 'SA', path: 'Entrepreneur Path', email: 'siti@ftg.id',  color: '#8b5cf6', baseProgress: 62 },
    3: { name: 'Muhammad Rizky', initials: 'MR', path: 'Career Path',       email: 'rizky@ftg.id', color: '#2c3e50', baseProgress: 25 },
    4: { name: 'Dina Fitriani',  initials: 'DF', path: 'Entrepreneur Path', email: 'dina@ftg.id',  color: '#1a5f4f', baseProgress: 50 },
    5: { name: 'Bagas Nugroho',  initials: 'BN', path: 'Career Path',       email: 'bagas@ftg.id', color: '#8b5cf6', baseProgress: 44 }
  };
  function menteeIdByEmail(email) {
    for (var k in MENTEES) if (MENTEES[k].email === email) return +k;
    return 1;
  }

  function lightSeed(id) {
    var m = MENTEES[id];
    return Object.assign({}, DEFAULT_STATE, {
      events: [{ icon: '👋', text: 'Selamat datang di platform, ' + m.name.split(' ')[0] + '! Mulai dari GI Design Thinking ya.', forRole: 'mentee', at: new Date(Date.now() - 4e7).toISOString(), read: false }]
    });
  }
  function seedAll() {
    var g = { mentees: {} };
    g.mentees[1] = Object.assign({}, DEFAULT_STATE, SEED);
    for (var i = 2; i <= 5; i++) g.mentees[i] = lightSeed(i);
    return g;
  }

  var PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  var IS_APP_PAGE = PAGE.indexOf('index') !== 0 && PAGE.indexOf('login') !== 0 && PAGE !== '';

  var sb = null, lastAppliedAt = 0, pushTimer = null, pollStarted = false;

  function mySession() {
    try { return JSON.parse(localStorage.getItem('ftgSession') || 'null'); } catch (e) { return null; }
  }
  function myRole() { var s = mySession(); return (s && s.role) || ''; }
  function myMenteeId() {
    var s = mySession();
    if (s && s.role === 'mentee') return s.menteeId || menteeIdByEmail(s.email);
    return 1;
  }
  function myTag() {
    var r = myRole();
    return r === 'mentee' ? 'mentee-' + myMenteeId() : (r || 'anon');
  }

  /* migrasi dokumen lama (Arya tunggal) -> bentuk multi-mentee */
  function normalizeG(raw) {
    var g = raw && typeof raw === 'object' ? raw : {};
    if (!g.mentees) {
      var hadOld = g.niyyah !== undefined || g.define !== undefined;
      var old = hadOld ? g : null;
      g = { mentees: seedAll().mentees, updatedAt: g.updatedAt, updatedBy: g.updatedBy };
      if (old) g.mentees[1] = Object.assign({}, DEFAULT_STATE, old);
    }
    for (var i = 1; i <= 5; i++) g.mentees[i] = Object.assign({}, DEFAULT_STATE, g.mentees[i] || lightSeed(i));
    return g;
  }
  function loadG() {
    try {
      var raw = localStorage.getItem('ftgStateV2');
      if (raw) return normalizeG(JSON.parse(raw));
    } catch (e) {}
    return normalizeG(seedAll());
  }

  var G = loadG();
  var MID = 1; // di-set ulang saat boot sesuai sesi
  var S = G.mentees[1];
  function bindS() { MID = myMenteeId(); S = G.mentees[MID]; }
  function mstate(i) { return G.mentees[i]; }

  function initSupabase() {
    try {
      if (window.supabase && window.FTG_CONF && window.FTG_CONF.anonKey) {
        sb = window.supabase.createClient(window.FTG_CONF.url, window.FTG_CONF.anonKey);
      }
    } catch (e) { sb = null; }
  }

  function persistLocal() { try { localStorage.setItem('ftgStateV2', JSON.stringify(G)); } catch (e) {} }

  function applyRemote(data) {
    G = normalizeG(data);
    bindS();
    persistLocal();
  }

  function pushRemote() {
    if (!sb) return;
    pushTimer = null;
    G.mentees[MID] = S;
    G.updatedAt = Date.now();
    G.updatedBy = myTag();
    lastAppliedAt = G.updatedAt;
    persistLocal();
    sb.from('ftg_state').update({ data: G, updated_at: new Date().toISOString() }).eq('id', 1)
      .then(function (res) { if (res.error) console.warn('FTG sync:', res.error.message); });
  }

  function saveState() {
    G.mentees[MID] = S;
    persistLocal();
    if (sb) { clearTimeout(pushTimer); pushTimer = setTimeout(pushRemote, 700); }
  }

  /* Muat state dari server saat halaman dibuka (fallback: data lokal). */
  function remoteLoad() {
    return new Promise(function (resolve) {
      bindS();
      if (!sb || !IS_APP_PAGE) { resolve(false); return; }
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve(false); } }, 4500);
      sb.from('ftg_state').select('data').eq('id', 1).maybeSingle()
        .then(function (res) {
          if (done) return; done = true; clearTimeout(t);
          if (res.error || !res.data) { resolve(false); return; }
          var d = res.data.data;
          if (d && d.updatedAt) { applyRemote(d); lastAppliedAt = d.updatedAt; }
          else pushRemote(); // server masih kosong -> isi dengan konten awal
          resolve(true);
        })
        .catch(function () { if (!done) { done = true; clearTimeout(t); resolve(false); } });
    });
  }

  function onForeignUpdate(d) {
    var prevMsgCount = (S.messages || []).length;
    var prevOtherHash = JSON.stringify({ a: S, u: 0 });
    applyRemote(d);
    lastAppliedAt = d.updatedAt || 0;
    var by = d.updatedBy || '';
    var who = by === 'mentor' ? 'Mentor' : (by === 'admin' ? 'Panitia' : 'Mentee');
    // mentee: update mentee lain tidak relevan -> terapkan diam-diam
    if (myRole() === 'mentee' && by.indexOf('mentee-') === 0) return;
    // kalau jendela chat sedang terbuka, perbarui isinya langsung tanpa reload
    var chatBox = $('#chatBox');
    if (chatBox) {
      chatBox.innerHTML = chatBubbles(window.ftgChatTarget || MID);
      chatBox.scrollTop = chatBox.scrollHeight;
      if ((mstate(window.ftgChatTarget || MID).messages || []).length > prevMsgCount) { toast('Pesan baru diterima', '💬'); return; }
    }
    // mentee hanya perlu reload jika perubahan menyentuh datanya sendiri / dari mentor
    if (myRole() === 'mentee' && by !== 'mentor' && by !== 'admin') return;
    toast('Update baru dari ' + who + ' — memuat ulang...', '📨');
    setTimeout(function () { location.reload(); }, 1200);
  }

  /* ---------- Presence: status online sungguhan ---------- */
  var presCh = null;
  function startPresence() {
    if (!sb || !IS_APP_PAGE) return;
    var role = myRole();
    if (!role) return;
    try {
      presCh = sb.channel('ftg-presence', { config: { presence: { key: myTag() } } });
      presCh.on('presence', { event: 'sync' }, function () {
        updatePresenceUI(presCh.presenceState());
      });
      presCh.subscribe(function (status) {
        if (status === 'SUBSCRIBED') presCh.track({ at: Date.now() });
      });
    } catch (e) { /* presence opsional */ }
  }
  function updatePresenceUI(state) {
    var mentorOn = !!(state.mentor && state.mentor.length);
    // sisi mentee/admin: indikator "Online sekarang" milik mentor
    $all('span, p').forEach(function (el) {
      var t = el.textContent.trim();
      if (t === 'Online sekarang' || t === 'Online' || t === 'Offline') {
        var dot = el.previousElementSibling;
        if (mentorOn) {
          el.textContent = 'Online sekarang';
          el.className = el.className.replace(/text-slate-\d+/g, 'text-[#22c55e]');
          if (dot) dot.style.background = '#22c55e';
        } else {
          el.textContent = 'Offline';
          el.className = el.className.replace(/text-\[#22c55e\]/g, 'text-slate-400');
          if (dot) dot.style.background = '#94a3b8';
        }
      }
    });
    // sisi mentor/admin: badge ONLINE di baris setiap mentee yang aktif
    for (var i = 1; i <= 5; i++) {
      var row = byId('mentee-row-' + i);
      if (!row) continue;
      var old = $('.ftg-online-badge', row);
      if (old) old.remove();
      if (state['mentee-' + i] && state['mentee-' + i].length) {
        var nameP = $all('p', row).filter(function (p) { return p.className.indexOf('font-semibold') > -1; })[0];
        if (nameP) {
          var b = document.createElement('span');
          b.className = 'ftg-online-badge';
          b.style.cssText = 'display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,.12);color:#22c55e;font-size:9px;font-weight:700;padding:2px 8px;border-radius:99px;margin-left:6px;vertical-align:middle;';
          b.innerHTML = '<span style="width:5px;height:5px;border-radius:99px;background:#22c55e;display:inline-block"></span>ONLINE';
          nameP.appendChild(b);
        }
      }
    }
    // dashboard panitia: hitungan online
    var onlineCount = Object.keys(state).filter(function (k) { return k.indexOf('mentee-') === 0; }).length;
    var oc = $('#adminOnlineCount');
    if (oc) oc.textContent = onlineCount;
  }

  /* ---------- Jadwal sesi 1-on-1 sungguhan ---------- */
  function scheduleModal() {
    var today = new Date();
    var defDate = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    var opts = '';
    for (var i = 1; i <= 5; i++) opts += '<option value="' + i + '">' + MENTEES[i].name + ' (' + MENTEES[i].path + ')</option>';
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:2px">🗓 Jadwalkan Sesi 1-on-1</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Undangan otomatis terkirim ke mentee terpilih</p>' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Mentee</label>' +
      '<select id="ssMentee" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;background:#fff">' + opts + '</select>' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Tanggal</label>' +
      '<input id="ssDate" type="date" value="' + defDate + '" min="' + today.toISOString().slice(0, 10) + '" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px">' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Jam (WIB)</label>' +
      '<input id="ssTime" type="time" value="16:00" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px">' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Topik (opsional)</label>' +
      '<input id="ssNote" type="text" placeholder="Contoh: bahas progres DEFINE & persiapan IDEATE" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none">' +
      '<button id="ssSave" style="margin-top:14px;width:100%;background:#8b5cf6;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Kirim Undangan Sesi</button>',
      function (box, close) {
        $('#ssSave', box).addEventListener('click', function () {
          var dt = $('#ssDate', box).value, tm = $('#ssTime', box).value;
          var target = +($('#ssMentee', box).value || 1);
          if (!dt || !tm) { toast('Pilih tanggal & jam dulu ya', '✏️'); return; }
          var st = mstate(target);
          st.session1on1 = { date: dt, time: tm, note: $('#ssNote', box).value.trim(), by: 'Pak Faris', at: new Date().toISOString() };
          var label = new Date(dt + 'T' + tm).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) + ' ' + tm + ' WIB';
          pushEventTo(target, '🗓', 'Pak Faris menjadwalkan sesi 1-on-1: ' + label, 'mentee');
          saveState(); close();
          toast('Undangan terkirim ke ' + MENTEES[target].name.split(' ')[0] + ' — ' + label, '🗓');
        });
      }
    );
  }
  /* Kartu jadwal sesi di dashboard mentee */
  function insertSessionCard() {
    if (!S.session1on1) return;
    var anchor = byId('mentor-card');
    if (!anchor) return;
    var s = S.session1on1;
    var label = new Date(s.date + 'T' + s.time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    var sec = document.createElement('section');
    sec.className = 'bg-[#8b5cf6] rounded-2xl p-5';
    sec.innerHTML =
      '<p class="text-white/70 text-xs font-semibold mb-1">🗓 SESI 1-ON-1 TERJADWAL</p>' +
      '<h3 class="text-white text-sm font-bold mb-2">' + label + ' · ' + s.time + ' WIB</h3>' +
      '<p class="text-white/80 text-xs mb-1">Bersama <b>' + esc(s.by) + '</b>' + (s.note ? ' — ' + esc(s.note) : '') + '</p>' +
      '<span class="inline-block mt-2 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">✓ Undangan diterima</span>';
    anchor.parentElement.insertBefore(sec, anchor.nextSibling);
  }

  /* ---------- Badge dinamis: Definer terbuka saat tugas W2 dikumpul ---------- */
  function unlockDefinerBadges() {
    if (!S.submittedW2) return;
    // dashboard mentee: slot badge "Terkunci" -> Definer + hitungan 3->4
    var bsec = byId('badges-section');
    if (bsec) {
      var locked = $all('.flex.flex-col.items-center', bsec).filter(function (d) { return /Terkunci/.test(d.textContent); })[0];
      if (locked) locked.innerHTML =
        '<div class="w-12 h-12 rounded-xl bg-[#f97316]/10 border-2 border-[#f97316] badge-glow flex items-center justify-center"><i class="fa-solid fa-magnifying-glass text-[#f97316] text-xl"></i></div>' +
        '<p class="text-[#2c3e50] text-[10px] font-medium text-center">Definer</p>';
      $all('span', bsec).forEach(function (sp) { if (sp.textContent.trim() === '3 / 12') sp.textContent = '4 / 12'; });
    }
    $all('p').forEach(function (p) {
      if (p.textContent.trim() === '3' && p.className.indexOf('text-2xl') > -1 && p.nextElementSibling && /Badge Diraih/.test(p.nextElementSibling.textContent)) p.textContent = '4';
    });
    // progress tracker: badge Definer menyala + judul hitungan
    var bearned = byId('badges-earned');
    if (bearned) {
      var h = $('h3', bearned);
      if (h) h.textContent = '🏅 Semua Badge (4 dari 12)';
      var def = $all('.flex.flex-col.items-center', bearned).filter(function (d) { return /Definer/.test(d.textContent); })[0];
      if (def) {
        def.classList.remove('opacity-40');
        def.innerHTML =
          '<div class="w-12 h-12 rounded-xl bg-[#f97316]/10 border-2 border-[#f97316] flex items-center justify-center"><i class="fa-solid fa-magnifying-glass text-[#f97316] text-xl"></i></div>' +
          '<p class="text-[10px] font-semibold text-center text-[#2c3e50] mt-1">Definer</p><p class="text-[9px] text-[#22c55e] text-center">Earned!</p>';
      }
    }
  }

  /* ---------- Unduh laporan progres (cetak/PDF) ---------- */
  function insertPrintButton() {
    var header = $('main header');
    if (!header) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-[#1a5f4f] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#155242] flex-shrink-0';
    btn.innerHTML = '<i class="fa-solid fa-file-arrow-down mr-1.5"></i>Unduh Laporan';
    btn.addEventListener('click', function () {
      toast('Menyiapkan laporan — pilih "Save as PDF"', '🖨');
      setTimeout(function () { window.print(); }, 400);
    });
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.appendChild(btn);
  }

  /* ================================================================
     PAGE: DASHBOARD PANITIA (admin)
     ================================================================ */
  function initAdminDashboard() {
    var sub = $('header p');
    if (sub) sub.textContent = todayStr() + ' · Bulan 1, Minggu 2 · Monitoring Program';
    var submitted = 0, reviewed = 0, scores = [];
    for (var i = 1; i <= 5; i++) {
      var st = mstate(i);
      if (st.submittedW2) submitted++;
      if (st.reviewW2) { reviewed++; scores.push(st.reviewW2.score); }
      if (st.reviews && st.reviews.w1) scores.push(st.reviews.w1.score);
    }
    if (mstate(1).reviews && !mstate(1).reviews.w1) scores.push(87); // nilai W1 Arya dari cerita program
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var set = function (id, v) { var el = $('#' + id); if (el) el.textContent = v; };
    set('statSubmitted', submitted + '/5');
    set('statReviewed', reviewed);
    set('statAvg', avg || '—');

    // tabel progres per mentee
    var tbody = $('#menteeRows');
    if (tbody) {
      var html = '';
      for (var j = 1; j <= 5; j++) {
        var m = MENTEES[j], stj = mstate(j);
        var prog = m.baseProgress + (stj.submittedW2 ? 17 : 0);
        var status = stj.reviewW2 ? '<span class="text-[#22c55e] text-[10px] font-bold bg-[#22c55e]/10 px-2 py-0.5 rounded-full">✓ Dinilai ' + stj.reviewW2.score + '</span>'
          : (stj.submittedW2 ? '<span class="text-[#8b5cf6] text-[10px] font-bold bg-[#8b5cf6]/10 px-2 py-0.5 rounded-full">Menunggu review</span>'
          : '<span class="text-slate-400 text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded-full">Belum kumpul W2</span>');
        html += '<div class="px-5 py-3.5 flex items-center gap-3 border-b border-slate-50" data-design-id="mentee-row-' + j + '-admin">' +
          '<div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0" style="background:' + m.color + '">' + m.initials + '</div>' +
          '<div class="flex-1 min-w-0"><p class="text-[#2c3e50] text-xs font-semibold">' + m.name + '</p>' +
          '<div class="flex items-center gap-2 mt-1"><div class="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[140px]"><div class="h-1.5 rounded-full" style="width:' + prog + '%;background:' + m.color + '"></div></div>' +
          '<span class="text-slate-500 text-[10px]">' + prog + '%</span></div></div>' + status + '</div>';
      }
      tbody.innerHTML = html;
      // badge online panitia memakai data-design-id mentee-row-N (dipakai updatePresenceUI juga)
    }

    // feed aktivitas gabungan
    var feed = $('#adminFeed');
    if (feed) {
      var evs = allEvents(null).slice(0, 10);
      feed.innerHTML = evs.length ? evs.map(function (ev) {
        return '<div class="flex items-start gap-2.5 pb-2.5 border-b border-slate-50">' +
          '<span style="font-size:14px">' + ev.icon + '</span>' +
          '<div class="min-w-0"><p class="text-[#2c3e50] text-xs font-medium leading-snug">' + esc(ev.text) + '</p>' +
          '<p class="text-slate-400 text-[10px] mt-0.5">' + timeAgo(ev.at) + ' · ' + MENTEES[ev.menteeId].name.split(' ')[0] + '</p></div></div>';
      }).join('') : '<p class="text-slate-400 text-xs">Belum ada aktivitas.</p>';
    }
  }

  /* ---------- Feed aktivitas terbaru (dashboard mentor) ---------- */
  function insertActivityFeed() {
    var anchor = byId('group-progress');
    if (!anchor || !S.events.length) return;
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
    sec.innerHTML = '<h3 class="text-[#2c3e50] text-sm font-bold mb-3">🕒 Aktivitas Terbaru</h3>' +
      '<div class="space-y-2">' +
      S.events.slice(0, 6).map(function (ev) {
        return '<div class="flex items-start gap-2.5 pb-2 border-b border-slate-50">' +
          '<span style="font-size:14px;flex-shrink:0">' + ev.icon + '</span>' +
          '<div class="min-w-0"><p class="text-[#2c3e50] text-xs font-medium leading-snug">' + esc(ev.text) + '</p>' +
          '<p class="text-slate-400 text-[10px] mt-0.5">' + timeAgo(ev.at) + ' · untuk ' + (ev.forRole === 'mentor' ? 'kamu' : ev.forRole) + '</p></div></div>';
      }).join('') + '</div>';
    anchor.parentElement.insertBefore(sec, anchor.nextSibling);
  }

  function startRealtime() {
    if (!sb || !IS_APP_PAGE) return;
    try {
      sb.channel('ftg-state-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ftg_state' }, function (payload) {
          var d = payload['new'] && payload['new'].data;
          if (!d || !d.updatedAt || d.updatedAt === lastAppliedAt) return;
          if (d.updatedBy === myRole()) { applyRemote(d); lastAppliedAt = d.updatedAt; return; }
          onForeignUpdate(d);
        })
        .subscribe();
    } catch (e) { /* polling di bawah tetap jalan */ }
    startPolling();
  }

  /* Polling ringan sebagai jaring pengaman kalau websocket terblokir. */
  function startPolling() {
    if (pollStarted || !sb) return;
    pollStarted = true;
    setInterval(function () {
      if (pushTimer) return; // sedang mengetik, jangan ganggu
      sb.from('ftg_state').select('data').eq('id', 1).maybeSingle().then(function (res) {
        var d = res.data && res.data.data;
        if (d && d.updatedAt && d.updatedAt !== lastAppliedAt && d.updatedBy !== myRole()) onForeignUpdate(d);
      });
    }, 7000);
  }

  /* Wajib login untuk halaman aplikasi + pemisahan peran. */
  function guardSession() {
    if (!IS_APP_PAGE || PAGE.indexOf('opening') === 0 || PAGE.indexOf('closing') === 0) return true;
    var ses = mySession();
    if (!ses || !ses.role) {
      location.replace('login.html' + (PAGE.indexOf('mentor-dashboard') === 0 ? '?role=mentor' : '?role=mentee'));
      return false;
    }
    function home(r) { return r === 'admin' ? 'admin-dashboard.html' : (r === 'mentor' ? 'mentor-dashboard.html' : 'mentee-dashboard.html'); }
    if (PAGE.indexOf('admin-dashboard') === 0 && ses.role !== 'admin') { location.replace(home(ses.role)); return false; }
    if (PAGE.indexOf('mentor-dashboard') === 0 && ses.role !== 'mentor') { location.replace(home(ses.role)); return false; }
    if (PAGE.indexOf('mentee-dashboard') === 0 && ses.role !== 'mentee') { location.replace(home(ses.role)); return false; }
    // panitia hanya memantau: halaman kerja mentee dialihkan ke dashboard panitia
    if (ses.role === 'admin' && /^(design-thinking|assignment|progress-tracker|mentor-feedback|workshop)/.test(PAGE)) {
      location.replace('admin-dashboard.html'); return false;
    }
    return true;
  }

  /* Personalisasi UI sesuai akun yang login (nama, inisial, path) */
  function personalize() {
    var ses = mySession();
    if (!ses || !ses.name) return;
    // pill sidebar
    var pill = $('aside .mx-4.mt-4');
    if (pill) {
      var nameP = $('p.text-white', pill);
      var pathP = $('p.text-white\\/50, p.text-xs', pill);
      var ava = $('div.rounded-full', pill);
      if (nameP) nameP.textContent = ses.name;
      if (pathP && pathP !== nameP) pathP.textContent = ses.path || '';
      if (ava) ava.textContent = ses.initials || ses.name.slice(0, 2).toUpperCase();
    }
    if (ses.role !== 'mentee') return;
    // sapaan header + avatar header (halaman mentee)
    var h1 = $('main header h1');
    if (h1 && /Selamat datang kembali/.test(h1.textContent)) h1.textContent = 'Selamat datang kembali, ' + ses.name.split(' ')[0] + '! 👋';
    if (h1 && /Progress Journey/.test(h1.textContent)) h1.textContent = '📊 Progress Journey ' + ses.name.split(' ')[0];
    $all('main header div.rounded-full').forEach(function (d) {
      if (d.textContent.trim() === 'AR') d.textContent = ses.initials;
    });
  }

  function showConnBadge() {
    if (!IS_APP_PAGE) return;
    var b = document.createElement('div');
    b.className = 'ftg-conn';
    b.style.cssText = 'position:fixed;bottom:10px;left:12px;z-index:8990;font-size:10px;font-weight:700;padding:4px 10px;border-radius:99px;pointer-events:none;' +
      (sb ? 'background:rgba(34,197,94,.14);color:#22c55e;' : 'background:rgba(148,163,184,.14);color:#94a3b8;');
    b.textContent = sb ? '● Live — tersinkron server' : '○ Offline — data lokal';
    document.body.appendChild(b);
  }

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
    el.style.cssText = 'background:#2c3e50;color:#fff;padding:12px 18px;border-radius:14px;font-size:13px;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;max-width:min(340px,calc(100vw - 32px));opacity:0;transform:translateY(10px);transition:all .25s ease;';
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
      out.addEventListener('click', function () { localStorage.removeItem('ftgSession'); });
      nav.appendChild(out);
    }
  }
  /* ---------- Menu mobile (hamburger drawer) ---------- */
  function initMobileNav() {
    var aside = $('aside[data-design-id]');
    if (!aside) return;
    var burger = document.createElement('button');
    burger.type = 'button';
    burger.className = 'ftg-burger';
    burger.setAttribute('aria-label', 'Buka menu');
    burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    var overlay = document.createElement('div');
    overlay.className = 'ftg-overlay';
    document.body.appendChild(burger);
    document.body.appendChild(overlay);
    function closeMenu() {
      aside.classList.remove('ftg-open');
      overlay.classList.remove('ftg-show');
      burger.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
    burger.addEventListener('click', function () {
      var open = aside.classList.toggle('ftg-open');
      overlay.classList.toggle('ftg-show', open);
      burger.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
    overlay.addEventListener('click', closeMenu);
    $all('a', aside).forEach(function (a) { a.addEventListener('click', closeMenu); });
  }

  /* Skor kualitas gabungan setelah W2 dinilai (rata-rata W1 87 + skor W2) */
  function qualityAfterReview() {
    return S.reviewW2 ? Math.round((87 + S.reviewW2.score) / 2) : 87;
  }

  /* ---------- Confetti 🎉 ---------- */
  function confetti() {
    var c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10001;';
    c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var colors = ['#f97316', '#8b5cf6', '#22c55e', '#1a5f4f', '#facc15', '#ef4444'];
    var parts = [];
    for (var i = 0; i < 160; i++) {
      parts.push({
        x: Math.random() * c.width, y: -20 - Math.random() * c.height * 0.6,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
        vy: 2.2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3,
        rot: Math.random() * Math.PI, vr: -0.12 + Math.random() * 0.24,
        col: colors[i % colors.length]
      });
    }
    var t0 = Date.now();
    (function frame() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (Date.now() - t0 < 3000) requestAnimationFrame(frame); else c.remove();
    })();
  }

  function hookScroll(a, prefix) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = byId(prefix);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* ---------- Notifikasi nyata (dari kejadian di platform) ---------- */
  function pushEvent(icon, text, forRole) {
    S.events.unshift({ icon: icon, text: text, forRole: forRole, at: new Date().toISOString(), read: false });
    if (S.events.length > 25) S.events.length = 25;
  }
  /* event untuk mentee tertentu (dipakai mentor/panitia) */
  function pushEventTo(menteeId, icon, text, forRole) {
    var st = mstate(menteeId);
    st.events.unshift({ icon: icon, text: text, forRole: forRole, at: new Date().toISOString(), read: false });
    if (st.events.length > 25) st.events.length = 25;
  }
  /* gabungan event lintas mentee (untuk mentor & panitia) */
  function allEvents(forRole) {
    var out = [];
    for (var i = 1; i <= 5; i++) {
      (mstate(i).events || []).forEach(function (e) {
        if (!forRole || e.forRole === forRole || e.forRole === 'all') out.push(Object.assign({ menteeId: i }, e));
      });
    }
    out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    return out;
  }
  function timeAgo(iso) {
    var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'Baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    return Math.floor(s / 86400) + ' hari lalu';
  }
  function myEvents() {
    var role = myRole() || (IS_MENTOR_PAGE ? 'mentor' : 'mentee');
    if (role === 'mentor' || role === 'admin') return allEvents(role === 'admin' ? null : 'mentor');
    return S.events.filter(function (e) { return e.forRole === role || e.forRole === 'all'; });
  }
  function wireBell() {
    var btn = byId('btn-notif') || byId('btn-mentor-notif');
    if (!btn) return;
    var badge = btn.parentElement.querySelector('span');
    function refreshBadge() {
      var n = myEvents().filter(function (e) { return !e.read; }).length;
      if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
    }
    refreshBadge();
    var dd;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (dd) { dd.remove(); dd = null; return; }
      var evs = myEvents();
      dd = document.createElement('div');
      dd.style.cssText = 'position:absolute;top:48px;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.15);width:300px;z-index:9990;overflow:hidden;';
      dd.innerHTML = '<p style="padding:12px 16px;font-weight:700;font-size:13px;color:#2c3e50;border-bottom:1px solid #f1f5f9">Notifikasi</p>' +
        (evs.length ? evs.slice(0, 6).map(function (n) {
          return '<div style="padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #f8fafc;' + (n.read ? 'opacity:.6' : '') + '"><span>' + n.icon + '</span><div><p style="font-size:12px;color:#2c3e50;font-weight:600">' + esc(n.text) + '</p><p style="font-size:10px;color:#94a3b8">' + timeAgo(n.at) + '</p></div></div>';
        }).join('') : '<p style="padding:16px;font-size:12px;color:#94a3b8;text-align:center">Belum ada notifikasi baru</p>');
      btn.parentElement.style.position = 'relative';
      btn.parentElement.appendChild(dd);
      // tandai terbaca (mentor/panitia: lintas semua mentee; mentee: miliknya saja)
      var changed = false;
      var role = myRole();
      if (role === 'mentor') {
        for (var i = 1; i <= 5; i++) {
          mstate(i).events.forEach(function (ev) {
            if (!ev.read && (ev.forRole === 'mentor' || ev.forRole === 'all')) { ev.read = true; changed = true; }
          });
        }
      } else if (role === 'admin') {
        /* panitia hanya memantau — tidak mengubah status baca siapa pun */
      } else {
        S.events.forEach(function (ev) { if (!ev.read && (ev.forRole === 'mentee' || ev.forRole === 'all')) { ev.read = true; changed = true; } });
      }
      if (changed) saveState();
      refreshBadge();
      document.addEventListener('click', function close() { if (dd) { dd.remove(); dd = null; } document.removeEventListener('click', close); });
    });
  }

  /* ---------- Chat sungguhan mentee <-> mentor (thread per mentee) ---------- */
  function chatBubbles(targetId) {
    var me = myRole() || (IS_MENTOR_PAGE ? 'mentor' : 'mentee');
    var msgs = mstate(targetId || MID).messages || [];
    if (!msgs.length) return '<p style="text-align:center;font-size:12px;color:#94a3b8;padding:18px 0">Belum ada pesan. Mulai percakapan! 👋</p>';
    return msgs.map(function (m) {
      var mine = m.from === me;
      return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px">' +
        '<div style="max-width:80%;padding:8px 12px;border-radius:14px;font-size:12.5px;line-height:1.5;' +
        (mine ? 'background:#1a5f4f;color:#fff;border-bottom-right-radius:4px' : 'background:#f1f5f9;color:#2c3e50;border-bottom-left-radius:4px') + '">' +
        '<p style="font-size:10px;font-weight:700;opacity:.7;margin-bottom:2px">' + esc(m.fromName || m.from) + '</p>' +
        esc(m.text) +
        '<p style="font-size:9px;opacity:.55;margin-top:3px;text-align:right">' + timeAgo(m.at) + '</p></div></div>';
    }).join('');
  }
  function messageModal(to, targetId) {
    var me = myRole() || (IS_MENTOR_PAGE ? 'mentor' : 'mentee');
    var ses = mySession() || {};
    var tid = targetId || MID;
    window.ftgChatTarget = tid;
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:2px">💬 Pesan — ' + esc(to) + '</h3>' +
      '<p style="font-size:11px;color:#64748b;margin-bottom:10px">' + (sb ? '● Terkirim real-time lewat server' : '○ Mode offline — tersimpan lokal') + '</p>' +
      '<div id="chatBox" style="max-height:260px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:14px;padding:12px;margin-bottom:10px;background:#fafbfc">' + chatBubbles(tid) + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<textarea id="msgTxt" rows="2" placeholder="Tulis pesanmu..." style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:10px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="msgSend" style="background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:0 18px;border-radius:12px;border:0;cursor:pointer"><i class="fa-solid fa-paper-plane"></i></button></div>',
      function (box, close) {
        var chatBox = $('#chatBox', box);
        chatBox.scrollTop = chatBox.scrollHeight;
        var ta = $('#msgTxt', box);
        function send() {
          var t = ta.value.trim();
          if (!t) { toast('Tulis pesan dulu ya', '✏️'); return; }
          var st = mstate(tid);
          st.messages.push({ from: me, fromName: ses.name || (me === 'mentor' ? 'Bapak Faris' : MENTEES[tid].name), text: t, at: new Date().toISOString() });
          if (st.messages.length > 60) st.messages.splice(0, st.messages.length - 60);
          pushEventTo(tid, '💬', 'Pesan baru dari ' + (ses.name || me), me === 'mentor' ? 'mentee' : 'mentor');
          saveState();
          ta.value = '';
          chatBox.innerHTML = chatBubbles(tid);
          chatBox.scrollTop = chatBox.scrollHeight;
          toast('Pesan terkirim', '📨');
        }
        $('#msgSend', box).addEventListener('click', send);
        ta.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(); } });
      }
    );
  }
  /* pengumuman mentor ke semua mentee sekaligus */
  function groupMessageModal(e) {
    if (e) e.preventDefault();
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">📣 Umumkan ke Semua Mentee</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px">Pesan masuk ke chat & notifikasi kelima mentee sekaligus</p>' +
      '<textarea id="gaTxt" rows="3" placeholder="Tulis pengumuman..." style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="gaSend" style="margin-top:12px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Kirim ke 5 Mentee</button>',
      function (box, close) {
        $('#gaSend', box).addEventListener('click', function () {
          var t = $('#gaTxt', box).value.trim();
          if (!t) { toast('Tulis pengumuman dulu ya', '✏️'); return; }
          for (var i = 1; i <= 5; i++) {
            var st = mstate(i);
            st.messages.push({ from: 'mentor', fromName: 'Bapak Faris (Pengumuman)', text: t, at: new Date().toISOString() });
            pushEventTo(i, '📣', 'Pengumuman: ' + t.slice(0, 60), 'mentee');
          }
          saveState(); close();
          toast('Pengumuman terkirim ke 5 mentee', '📣');
        });
      }
    );
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

    // pesan terbaru dari mentor: chat terakhir > feedback review > statis
    var lastMentorMsg = S.messages.filter(function (m) { return m.from === 'mentor'; }).pop();
    var quote = $('[data-design-id^="mentor-card"] .italic');
    if (quote && (lastMentorMsg || S.reviewW2)) {
      quote.textContent = '"' + (lastMentorMsg ? lastMentorMsg.text : S.reviewW2.text) + '"';
    }
    // quality score naik jika sudah ada review W2
    if (S.reviewW2) {
      var q = qualityAfterReview();
      $all('p').forEach(function (p) {
        if (p.textContent.trim() === '87' && p.className.indexOf('text-2xl') > -1) p.textContent = q;
      });
      $all('span').forEach(function (sp) { if (sp.textContent.trim() === 'Top 8') sp.textContent = 'Top 4'; });
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
    // Tab minggu — W1/W2 membuka materi pembelajaran, W3/W4 terkunci
    var w1b = byId('btn-week1-tab');
    if (w1b) w1b.addEventListener('click', function () { lessonModal('w1'); });
    var w2b = byId('btn-week2-tab');
    if (w2b) w2b.addEventListener('click', function () { lessonModal('w2'); });
    var w3b = byId('btn-week3-tab');
    if (w3b) w3b.addEventListener('click', function () {
      if (S.reviewW2) toast('Tugas W2 sudah dinilai ' + S.reviewW2.score + '/100 — IDEATE terbuka Senin depan! 🎉', '🔓');
      else toast('Minggu 3 (IDEATE) terbuka setelah tugas W2 dinilai', '🔒');
    });
    var w4b = byId('btn-week4-tab');
    if (w4b) w4b.addEventListener('click', function () { toast('Minggu 4 (PROTOTYPE + TEST) masih terkunci', '🔒'); });
    // back chevron
    var back = $('header a');
    if (back && back.getAttribute('href') === '#') back.href = 'mentee-dashboard.html';
  }

  /* Upload sungguhan: isi file dibaca & ikut tersimpan ke server (maks 1.5 MB),
     sehingga mentor bisa mengunduhnya dari perangkat lain. */
  function wireFilePicker(btn, onAdd) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.style.display = 'none';
    inp.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx';
    document.body.appendChild(inp);
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      if (!inp.files.length) return;
      var f = inp.files[0];
      if (f.size > 1.5 * 1024 * 1024) {
        toast('File terlalu besar (maks 1.5 MB) — kompres dulu ya', '⚠️');
        inp.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        S.files = (S.files || []).filter(function (x) { return (x.name || x) !== f.name; });
        S.files.push({ name: f.name, size: f.size, data: reader.result, at: new Date().toISOString() });
        saveState();
        toast('File "' + f.name + '" terunggah (' + Math.round(f.size / 1024) + ' KB)', '📎');
        if (onAdd) onAdd();
      };
      reader.readAsDataURL(f);
      inp.value = '';
    });
  }

  /* ---------- Materi pembelajaran (LMS) ---------- */
  var LESSONS = {
    w1: {
      title: '📖 Materi Minggu 1 — EMPATHIZE',
      badge: '<span style="background:#22c55e;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px">✓ SELESAI · SKOR 87/100</span>',
      body:
        '<p style="font-size:13px;color:#475569;margin-bottom:10px"><b>Empati adalah fondasi.</b> Sebelum membuat solusi, kita harus memahami manusia yang akan kita bantu — bukan dari asumsi, tapi dari mendengar langsung.</p>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px">' +
        '<p style="font-size:12px;font-weight:700;color:#1a5f4f;margin-bottom:6px">Yang sudah kamu selesaikan:</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:4px">✅ Video: Apa itu Design Thinking? (45 menit)</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:4px">✅ Wawancara empati dengan 5 narasumber</p>' +
        '<p style="font-size:12px;color:#475569">✅ Kolom EMPATHIZE di GI Canvas + Niyyah Setting</p></div>' +
        '<p style="font-size:12px;color:#8b5cf6;font-style:italic">"EMPATHIZE-mu sangat insightful! Coba perdalam pain point user di W2." — Pak Faris</p>'
    },
    w2: {
      title: '📖 Materi Minggu 2 — DEFINE',
      badge: '<span style="background:#f97316;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px">📍 SEDANG BERLANGSUNG</span>',
      body:
        '<p style="font-size:13px;color:#475569;margin-bottom:10px"><b>DEFINE = mengubah temuan menjadi masalah yang tajam.</b> Fase ini menyaring semua hasil wawancara EMPATHIZE menjadi satu <i>problem statement</i> yang jelas dan bisa ditindaklanjuti.</p>' +
        '<div style="background:#f97316;border-radius:12px;padding:14px;margin-bottom:10px">' +
        '<p style="font-size:11px;font-weight:700;color:#fff;opacity:.8;margin-bottom:4px">RUMUS POINT-OF-VIEW (POV)</p>' +
        '<p style="font-size:13px;font-weight:700;color:#fff">[Siapa] membutuhkan [kebutuhan] karena [insight yang mengejutkan]</p></div>' +
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px">' +
        '<p style="font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">Langkah minggu ini:</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:4px">1️⃣ Baca ulang kolom EMPATHIZE kamu — cari pola yang berulang</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:4px">2️⃣ Tulis problem statement dengan rumus POV di kolom DEFINE</p>' +
        '<p style="font-size:12px;color:#475569;margin-bottom:4px">3️⃣ Uji dengan "5 Whys" — tanya "kenapa?" 5 kali sampai ke akar</p>' +
        '<p style="font-size:12px;color:#475569">4️⃣ Petakan ide di Values-Alignment Matrix, lalu kumpulkan tugas</p></div>' +
        '<p style="font-size:12px;color:#64748b">💡 <b>Prophetic lens:</b> masalah yang layak diselesaikan adalah yang manfaatnya kembali ke komunitas — bukan sekadar menarik secara bisnis.</p>'
    }
  };
  function lessonModal(key) {
    var L = LESSONS[key];
    if (!L) return;
    modal(
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h3 style="font-weight:800;color:#2c3e50;font-size:16px">' + L.title + '</h3>' + L.badge + '</div>' +
      L.body +
      '<button id="lsClose" style="margin-top:14px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Mengerti — Lanjut Kerjakan</button>',
      function (box, close) { $('#lsClose', box).addEventListener('click', close); }
    );
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

    // upload + chip file terlampir
    var browse = byId('btn-browse-files');
    if (browse) {
      var drop = browse.closest('.border-dashed');
      var fileWrap = document.createElement('div');
      fileWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;';
      if (drop) drop.parentElement.appendChild(fileWrap);
      var renderFiles = function () {
        fileWrap.innerHTML = S.files.map(function (f, i) {
          var nm = f.name || f;
          var dl = f.data ? '<a href="' + f.data + '" download="' + esc(nm) + '" style="color:#fff;text-decoration:none">📎 ' + esc(nm) + ' <span style="opacity:.7">↓</span></a>' : '📎 ' + esc(nm);
          return '<span style="background:#8b5cf6;color:#fff;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;display:inline-flex;align-items:center;gap:6px">' + dl +
            '<b data-fdel="' + i + '" style="cursor:pointer;opacity:.7">×</b></span>';
        }).join('');
        $all('[data-fdel]', fileWrap).forEach(function (x) {
          x.addEventListener('click', function () { S.files.splice(+x.getAttribute('data-fdel'), 1); saveState(); renderFiles(); });
        });
      };
      renderFiles();
      wireFilePicker(browse, renderFiles);
    }

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
        var who = (mySession() || {}).name || MENTEES[MID].name;
        pushEvent('📥', who + ' mengumpulkan Tugas Minggu 2 (' + wc + ' kata)', 'mentor');
        saveState(); markSubmitted();
        confetti();
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
  /* antrian statis W1 (baseline cerita) dipetakan ke mentee sungguhan */
  var STATIC_QUEUE = [
    { m: 1, week: 'w1', task: 'Tugas Week 1 — EMPATHIZE' },
    { m: 4, week: 'w1', task: 'Tugas Week 1 — EMPATHIZE + Niyyah' },
    { m: 5, week: 'w1', task: 'Tugas Week 1 — Values Matrix' }
  ];

  function pendingCount() {
    var n = STATIC_QUEUE.filter(function (q) { return !mstate(q.m).reviews[q.week]; }).length;
    for (var i = 1; i <= 5; i++) {
      var st = mstate(i);
      if (st.submittedW2 && !st.reviewW2) n++;
    }
    return n;
  }

  function attachmentLinks(st) {
    var files = (st.files || []).filter(function (f) { return f && f.data; });
    var links = (st.links || []);
    if (!files.length && !links.length) return '';
    return '<div style="margin-bottom:12px">' +
      files.map(function (f) {
        return '<a href="' + f.data + '" download="' + esc(f.name) + '" style="display:inline-flex;align-items:center;gap:6px;background:#8b5cf6;color:#fff;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;text-decoration:none;margin:0 6px 6px 0">📎 ' + esc(f.name) + ' ↓</a>';
      }).join('') +
      links.map(function (l) {
        return '<a href="' + esc(l) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;text-decoration:none;margin:0 6px 6px 0">🔗 ' + esc(l.length > 34 ? l.slice(0, 34) + '…' : l) + '</a>';
      }).join('') + '</div>';
  }

  function reviewModal(menteeId, week, taskLabel, onDone) {
    var st = mstate(menteeId);
    var name = MENTEES[menteeId].name;
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:2px">📝 Review — ' + esc(name) + '</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:14px">' + esc(taskLabel) + '</p>' +
      (week === 'w2' && st.reflection ?
        '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:14px;max-height:120px;overflow:auto"><p style="font-size:11px;font-weight:700;color:#8b5cf6;margin-bottom:4px">Refleksi mentee (' + wordCount(st.reflection) + ' kata):</p><p style="font-size:12px;color:#475569;font-style:italic">"' + esc(st.reflection.slice(0, 400)) + (st.reflection.length > 400 ? '…' : '') + '"</p></div>' : '') +
      (week === 'w2' ? attachmentLinks(st) : '') +
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
          st.reviews[week] = { score: +range.value, text: text, at: new Date().toISOString() };
          if (week === 'w2') {
            st.reviewW2 = st.reviews[week];
            pushEventTo(menteeId, '⭐', 'Tugas W2 kamu dinilai ' + range.value + '/100 oleh Pak Faris', 'mentee');
          }
          saveState(); close();
          confetti();
          toast('Penilaian ' + name + ' tersimpan — ' + range.value + '/100', '⭐');
          if (onDone) onDone();
        });
      }
    );
  }

  function initMentorDashboard() {
    var sub = $('header p');
    if (sub) sub.textContent = todayStr() + ' · Bulan 1, Minggu 2 · 5 Mentee Aktif';

    var queue = byId('pending-reviews');

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

    function markCardDone(card, menteeId, week, taskLabel) {
      var r = mstate(menteeId).reviews[week];
      card.style.opacity = '1';
      card.className = 'bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-3';
      var nm = MENTEES[menteeId].name.split(' ')[0];
      card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">' + nm + ' — ' + esc(taskLabel.split('—')[0].trim()) + '</p>' +
        '<span class="text-[#22c55e] text-[10px] font-bold">✓ Dinilai</span></div>' +
        '<p class="text-slate-500 text-xs">Skor <b class="text-[#1a5f4f]">' + r.score + '/100</b> · feedback terkirim ke mentee</p>';
    }

    if (queue) {
      var cards = $all('.space-y-2 > div', queue);
      var container = $('.space-y-2', queue);
      // kartu W2 dinamis: SEMUA mentee yang sudah kumpul & belum dinilai
      for (var mi = 5; mi >= 1; mi--) (function (i) {
        var st = mstate(i);
        if (!st.submittedW2) return;
        var nm = MENTEES[i].name.split(' ')[0];
        var w2card = document.createElement('div');
        w2card.className = 'bg-[#8b5cf6]/5 border-2 border-[#8b5cf6]/40 rounded-xl p-3';
        w2card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">🆕 ' + nm + ' — Tugas Week 2</p>' +
          '<span class="text-[#8b5cf6] text-[10px] font-semibold">Baru masuk!</span></div>' +
          '<p class="text-slate-500 text-xs mb-2">DEFINE + Values Matrix + Refleksi ' + (st.submittedW2.words || 0) + ' kata</p>' +
          '<button type="button" class="w-full bg-[#8b5cf6] text-white text-xs font-semibold py-1.5 rounded-lg">Review & Nilai</button>';
        container.insertBefore(w2card, container.firstChild);
        if (st.reviewW2) markCardDone(w2card, i, 'w2', 'Tugas Week 2');
        else $('button', w2card).addEventListener('click', function () {
          reviewModal(i, 'w2', 'Tugas Week 2 — DEFINE + Values Matrix', function () { markCardDone(w2card, i, 'w2', 'Tugas Week 2'); refreshCounts(); });
        });
      })(mi);
      // kartu statis W1 (Arya, Dina, Bagas)
      cards.forEach(function (card, i) {
        var q = STATIC_QUEUE[i];
        if (!q) return;
        if (mstate(q.m).reviews[q.week]) { markCardDone(card, q.m, q.week, q.task); return; }
        var b = $('button', card);
        if (b) b.addEventListener('click', function () {
          reviewModal(q.m, q.week, q.task, function () { markCardDone(card, q.m, q.week, q.task); refreshCounts(); });
        });
      });
    }
    refreshCounts();

    // baris mentee: status hidup dari data masing-masing
    for (var ri = 1; ri <= 5; ri++) (function (i) {
      var row = byId('mentee-row-' + i);
      if (!row) return;
      var st = mstate(i);
      var prog = MENTEES[i].baseProgress + (st.submittedW2 ? 17 : 0);
      if (st.submittedW2) {
        $all('span', row).forEach(function (sp) {
          var t = sp.textContent.trim();
          if (/belum dikumpul|Semua on track|Perlu perhatian|1 tugas pending|Tugas W1 submitted/.test(t)) sp.textContent = '· Tugas W2 sudah dikumpul 🎉';
          if (t === MENTEES[i].baseProgress + '%') sp.textContent = prog + '%';
        });
        var bar = $('div[style*="width"]', row);
        if (bar) bar.style.width = prog + '%';
        $all('span', row).forEach(function (sp) {
          var t = sp.textContent.trim();
          if (st.reviewW2 && (t === 'Review Needed' || t === 'Needs Help' || t === 'On Track')) {
            sp.textContent = 'On Track'; sp.className = 'text-[#22c55e] text-xs font-semibold bg-[#22c55e]/10 px-2 py-1 rounded-lg';
          } else if (!st.reviewW2 && (t === 'On Track' || t === 'Needs Help')) {
            sp.textContent = 'Review Needed'; sp.className = 'text-[#f97316] text-xs font-semibold bg-[#f97316]/10 px-2 py-1 rounded-lg';
          }
        });
      }
      // chevron -> chat langsung dengan mentee tsb
      var b = byId('btn-view-mentee-' + i);
      if (b) b.addEventListener('click', function () { messageModal(MENTEES[i].name, i); });
    })(ri);

    // tombol sidebar & quick actions
    var sr = byId('btn-sidebar-review');
    if (sr) sr.addEventListener('click', function () { var q = byId('pending-reviews'); if (q) q.scrollIntoView({ behavior: 'smooth' }); });
    var rem = byId('btn-send-reminder');
    if (rem) rem.addEventListener('click', function () {
      pushEventTo(3, '⏰', 'Pengingat dari Pak Faris: segera selesaikan tugas mingguanmu!', 'mentee');
      saveState();
      toast('Pengingat terkirim ke Muhammad Rizky', '📨');
    });
    var sch = byId('btn-schedule-session');
    if (sch) sch.addEventListener('click', scheduleModal);
    var ann = byId('btn-group-announce');
    if (ann) ann.addEventListener('click', groupMessageModal);
    var flt = byId('btn-filter-mentee');
    if (flt) flt.addEventListener('click', function () { toast('Filter mentee (demo)', '🔍'); });
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
        S.replies.push(t);
        pushEvent('💬', ((mySession() || {}).name || MENTEES[MID].name) + ' membalas feedback tugas W1', 'mentor');
        saveState();
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
  var LB_EXTRA = [
    ['Putri Maharani', 'Career', 'Bu Dewi', 80, 84, 81, 79, 81.9, '↑'],
    ['Andi Saputra', 'Entrep.', 'Pak Rizal', 81, 82, 79, 80, 81.1, '−'],
    ['Laila Rahmawati', 'Career', 'Bu Sinta', 78, 83, 80, 77, 80.3, '↑'],
    ['Fikri Hidayat', 'Entrep.', 'Pak Hadi', 79, 80, 81, 76, 79.5, '↓'],
    ['Nabila Zahra', 'Career', 'Bu Rina', 77, 81, 78, 78, 78.9, '↑'],
    ['Reza Firmansyah', 'Entrep.', 'Pak Faris', 76, 79, 80, 75, 78.0, '−'],
    ['Intan Permata', 'Career', 'Bu Dewi', 75, 79, 77, 76, 77.2, '↑'],
    ['Taufik Ramdani', 'Entrep.', 'Pak Rizal', 76, 77, 76, 74, 76.4, '↓'],
    ['Salsabila Putri', 'Career', 'Bu Sinta', 74, 78, 75, 73, 75.7, '↑'],
    ['Galih Prakoso', 'Entrep.', 'Pak Hadi', 73, 76, 76, 74, 75.0, '−'],
    ['Mega Lestari', 'Career', 'Bu Rina', 72, 76, 74, 72, 74.2, '↑'],
    ['Ilham Maulana', 'Entrep.', 'Pak Faris', 73, 74, 73, 71, 73.3, '↓'],
    ['Citra Ayu', 'Career', 'Bu Dewi', 71, 74, 72, 72, 72.6, '−'],
    ['Fajar Nugraha', 'Entrep.', 'Pak Rizal', 70, 73, 73, 70, 71.9, '↑'],
    ['Zahra Aulia', 'Career', 'Bu Sinta', 69, 73, 71, 69, 71.0, '↓'],
    ['Doni Kurniawan', 'Entrep.', 'Pak Hadi', 70, 71, 70, 68, 70.2, '−'],
    ['Rani Puspita', 'Career', 'Bu Rina', 68, 71, 69, 68, 69.4, '↑'],
    ['Aldi Wijaya', 'Entrep.', 'Pak Faris', 67, 70, 69, 67, 68.6, '↓'],
    ['Maya Anggraini', 'Career', 'Bu Dewi', 66, 69, 68, 66, 67.6, '−'],
    ['Rizal Fauzan', 'Entrep.', 'Pak Rizal', 66, 68, 66, 65, 66.7, '↑'],
    ['Sari Indah', 'Career', 'Bu Sinta', 64, 67, 66, 64, 65.6, '↓'],
    ['Bima Prasetya', 'Entrep.', 'Pak Hadi', 63, 66, 65, 63, 64.7, '−']
  ];

  function initLeaderboard() {
    var table = byId('leaderboard-table');
    if (!table) return;
    // ganti footer "... 22 peserta lainnya ..." dengan 22 baris peserta sungguhan
    var footer = $all('div', table).filter(function (d) { return /22 peserta lainnya/.test(d.textContent); })[0];
    if (footer) {
      LB_EXTRA.forEach(function (p, idx) {
        var row = document.createElement('div');
        row.className = 'px-6 py-2.5 grid grid-cols-12 gap-2 items-center border-b border-slate-50 text-xs';
        var pathColor = p[1] === 'Career' ? '#8b5cf6' : '#f97316';
        var trendColor = p[8] === '↑' ? '#22c55e' : (p[8] === '↓' ? '#ef4444' : '#94a3b8');
        row.innerHTML =
          '<div class="col-span-1 text-slate-400 font-bold">' + (idx + 9) + '</div>' +
          '<div class="col-span-3"><span class="text-[#2c3e50] font-medium">' + p[0] + '</span> <span class="text-slate-400 text-[10px] block">Mentor: ' + p[2] + '</span></div>' +
          '<div class="col-span-1 text-center"><span style="color:' + pathColor + '" class="text-[10px]">' + p[1] + '</span></div>' +
          '<div class="col-span-1 text-center">' + p[3] + '</div>' +
          '<div class="col-span-1 text-center">' + p[4] + '</div>' +
          '<div class="col-span-1 text-center">' + p[5] + '</div>' +
          '<div class="col-span-1 text-center">' + p[6] + '</div>' +
          '<div class="col-span-2 text-center font-bold">' + p[7].toFixed(1) + '</div>' +
          '<div class="col-span-1 text-center" style="color:' + trendColor + '">' + p[8] + '</div>';
        table.insertBefore(row, footer);
      });
      footer.textContent = 'Menampilkan 30 dari 30 peserta · Diperbarui otomatis setiap Senin 00:00 WIB';
    }

    // Setelah tugas W2 dinilai mentor: skor Arya naik dan peringkatnya
    // naik dari #8 ke #4 secara nyata di tabel.
    if (S.reviewW2) {
      var q = qualityAfterReview();
      var total = (0.3 * 85 + 0.4 * q + 0.2 * 85 + 0.1 * 78).toFixed(1);
      var diff = '+' + (total - 83.4).toFixed(1);
      var banner = byId('my-position');
      if (banner) {
        banner.innerHTML = banner.innerHTML
          .replace(/>#8</g, '>#4<')
          .replace('Ranking #8', 'Ranking #4')
          .replace('Top 27%', 'Top 13%')
          .replace('>75<', '>85<')
          .replace('>87<', '>' + q + '<')
          .replace('>82<', '>85<')
          .replace('>83.4<', '>' + total + '<')
          .replace('↑ +2.1 dari minggu lalu', '↑ ' + diff + ' — tugas W2 dinilai ' + S.reviewW2.score + '/100 🎉');
      }
      var aryaRow = byId('lb-row-arya');
      if (aryaRow) {
        var map = { '8': '4', '75': '85', '87': String(q), '82': '85', '83.4': total, '↑ +2.1': '↑ ' + diff };
        $all('div, span', aryaRow).forEach(function (el) {
          if (el.children.length) return;
          var t = el.textContent.trim();
          if (map[t] !== undefined) el.textContent = map[t];
        });
        // geser baris Arya ke atas baris peringkat 4 lama, lalu turunkan rank 4-7 jadi 5-8
        var condensed = $all('div.px-6.py-2\\.5', table).filter(function (d) {
          return /Dewi Kartika|Hendra Putra|Ninda Safitri|Yoga Pratama/.test(d.textContent);
        });
        condensed.forEach(function (d) {
          var num = $('div', d);
          if (num && /^[4-7]$/.test(num.textContent.trim())) num.textContent = (+num.textContent.trim() + 1);
        });
        if (condensed[0]) table.insertBefore(aryaRow, condensed[0]);
      }
    }
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
      // lingkaran progress keseluruhan 20% -> 25%
      $all('span').forEach(function (sp) { if (sp.textContent.trim() === '20%') sp.textContent = '25%'; });
      var circ = $('svg circle[stroke="#1a5f4f"]');
      if (circ) circ.setAttribute('stroke-dasharray', '25 75');
      var m1lbl = $all('span').filter(function (sp) { return sp.textContent.trim() === '38%'; })[0];
      if (m1lbl) m1lbl.textContent = '55%';
    }
    // posisi & skor ikut naik setelah W2 dinilai
    if (S.reviewW2) {
      var q2 = qualityAfterReview();
      $all('p').forEach(function (p) {
        if (p.textContent.trim() === '#8') p.textContent = '#4';
        if (/Top 30%/.test(p.textContent)) p.textContent = '🔥 Top 13% — Luar biasa!';
      });
      $all('span').forEach(function (sp) {
        if (sp.textContent.trim() === '87' && sp.className.indexOf('font-bold') > -1) sp.textContent = q2;
        if (sp.textContent.trim() === '2 / 3') sp.textContent = '3 / 3';
      });
    }
    insertKpiTrend();
  }

  /* Grafik tren KPI mingguan (SVG, tanpa library) */
  function insertKpiTrend() {
    var after = byId('journey-map');
    if (!after) return;
    var w2 = S.reviewW2 ? (0.3 * 85 + 0.4 * qualityAfterReview() + 0.2 * 85 + 0.1 * 78) : (S.submittedW2 ? 84.2 : 83.4);
    w2 = Math.round(w2 * 10) / 10;
    var pts = [['W1', 81.5], ['W2', w2]];
    var target = 90, lo = 74, hi = 94;
    var W = 640, H = 190, padL = 46, padR = 20, padT = 18, padB = 34;
    var xs = ['W1', 'W2', 'W3', 'W4'];
    function X(i) { return padL + i * ((W - padL - padR) / 3); }
    function Y(v) { return padT + (hi - v) / (hi - lo) * (H - padT - padB); }
    var line = pts.map(function (p, i) { return X(i) + ',' + Y(p[1]); }).join(' ');
    var dots = pts.map(function (p, i) {
      return '<circle cx="' + X(i) + '" cy="' + Y(p[1]) + '" r="5" fill="#1a5f4f"/>' +
        '<text x="' + X(i) + '" y="' + (Y(p[1]) - 12) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1a5f4f">' + p[1] + '</text>';
    }).join('');
    var labels = xs.map(function (l, i) {
      return '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#94a3b8">' + l + '</text>';
    }).join('');
    var grid = [78, 82, 86, 90].map(function (v) {
      return '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v) + '" stroke="#f1f5f9"/>' +
        '<text x="' + (padL - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="10" fill="#cbd5e1">' + v + '</text>';
    }).join('');
    var proj = '<line x1="' + X(1) + '" y1="' + Y(w2) + '" x2="' + X(3) + '" y2="' + Y(90.5) + '" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="5 5" opacity=".55"/>' +
      '<text x="' + X(3) + '" y="' + (Y(90.5) - 10) + '" text-anchor="middle" font-size="10" fill="#8b5cf6">proyeksi</text>';
    var tgt = '<line x1="' + padL + '" y1="' + Y(target) + '" x2="' + (W - padR) + '" y2="' + Y(target) + '" stroke="#f97316" stroke-width="1.5" stroke-dasharray="3 4"/>' +
      '<text x="' + (W - padR) + '" y="' + (Y(target) - 6) + '" text-anchor="end" font-size="10" font-weight="700" fill="#f97316">🎯 target 90</text>';
    var delta = (w2 - 81.5).toFixed(1);
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6';
    sec.innerHTML =
      '<div class="flex items-center justify-between mb-2">' +
      '<h2 class="text-[#2c3e50] text-sm font-bold">📈 Tren KPI Mingguan</h2>' +
      '<span class="text-[#22c55e] text-xs font-semibold bg-[#22c55e]/10 px-2.5 py-1 rounded-full">↑ +' + delta + ' poin sejak W1</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto" xmlns="http://www.w3.org/2000/svg">' +
      grid + tgt + proj +
      '<polyline points="' + line + '" fill="none" stroke="#1a5f4f" stroke-width="3" stroke-linecap="round"/>' +
      dots + labels + '</svg>' +
      '<p class="text-slate-400 text-xs mt-1">Skor KPI total per minggu · garis ungu = proyeksi jika konsisten · Diperbarui otomatis setiap penilaian mentor</p>';
    after.parentElement.insertBefore(sec, after.nextSibling);
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
    // tombol pratinjau sertifikat
    var prep = byId('prepare-closing');
    if (prep) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mt-3 w-full bg-white text-[#f97316] text-xs font-bold py-2.5 rounded-xl';
      btn.innerHTML = '🎓 Pratinjau Sertifikat Kelulusan';
      btn.addEventListener('click', certModal);
      prep.appendChild(btn);
    }
  }

  /* ---------- Sertifikat digital (canvas) ---------- */
  function certModal() {
    var m = modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">🎓 Sertifikat Kelulusan</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px">Diberikan otomatis setelah menyelesaikan program 3 bulan</p>' +
      '<canvas id="certCv" width="1200" height="850" style="width:100%;height:auto;border:1px solid #e2e8f0;border-radius:12px"></canvas>' +
      '<button id="certDl" style="margin-top:12px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer"><i class="fa-solid fa-download"></i> Unduh PNG</button>',
      function (box, close) {
        var cv = $('#certCv', box);
        drawCertificate(cv);
        $('#certDl', box).addEventListener('click', function () {
          var a = document.createElement('a');
          a.download = 'Sertifikat-FTGxGI-Arya-Ramadhan.png';
          a.href = cv.toDataURL('image/png');
          a.click();
          toast('Sertifikat diunduh', '🎓');
        });
      }
    );
    // modal sertifikat butuh lebih lebar
    m.box.style.maxWidth = '640px';
  }

  function drawCertificate(cv) {
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    // latar
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // bingkai luar navy + aksen oranye
    ctx.strokeStyle = '#2c3e50'; ctx.lineWidth = 14; ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5; ctx.strokeRect(50, 50, W - 100, H - 100);
    // hiasan sudut
    ctx.fillStyle = '#1a5f4f';
    [[28, 28], [W - 28, 28], [28, H - 28], [W - 28, H - 28]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 10, 0, Math.PI * 2); ctx.fill();
    });
    ctx.textAlign = 'center';
    // header
    ctx.fillStyle = '#94a3b8'; ctx.font = '600 20px Inter, Arial';
    ctx.fillText('FAITHTOGROW  ×  GLOBAL INSPIRE', W / 2, 150);
    ctx.fillStyle = '#2c3e50'; ctx.font = '800 54px Inter, Arial';
    ctx.fillText('SERTIFIKAT KELULUSAN', W / 2, 215);
    ctx.fillStyle = '#f97316'; ctx.font = '700 24px Inter, Arial';
    ctx.fillText('Future Builders Fellowship 2026', W / 2, 258);
    // garis pemisah
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 220, 290); ctx.lineTo(W / 2 + 220, 290); ctx.stroke();
    // nama
    ctx.fillStyle = '#64748b'; ctx.font = '400 22px Inter, Arial';
    ctx.fillText('Diberikan kepada', W / 2, 350);
    ctx.fillStyle = '#1a5f4f'; ctx.font = '800 68px Inter, Arial';
    ctx.fillText('Arya Ramadhan', W / 2, 435);
    ctx.strokeStyle = '#1a5f4f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(W / 2 - 280, 458); ctx.lineTo(W / 2 + 280, 458); ctx.stroke();
    // deskripsi
    ctx.fillStyle = '#475569'; ctx.font = '400 21px Inter, Arial';
    ctx.fillText('atas partisipasi dan kelulusannya dalam program pendampingan 3 bulan', W / 2, 510);
    ctx.fillText('GI Design Thinking · Workshop Career Path · Mentoring Terstruktur', W / 2, 542);
    // badge KPI
    var kpi = S.reviewW2 ? (0.3 * 85 + 0.4 * qualityAfterReview() + 0.2 * 85 + 0.1 * 78).toFixed(1) : '83.4';
    ctx.fillStyle = '#f97316';
    ctx.beginPath(); ctx.arc(W / 2, 625, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '800 30px Inter, Arial';
    ctx.fillText(kpi, W / 2, 632);
    ctx.font = '700 13px Inter, Arial';
    ctx.fillText('KPI SCORE', W / 2, 655);
    // tanggal & tanda tangan
    ctx.fillStyle = '#64748b'; ctx.font = '400 19px Inter, Arial';
    ctx.fillText('Bandung, 31 Agustus 2026', W / 2, 720);
    ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(180, 770); ctx.lineTo(430, 770); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - 430, 770); ctx.lineTo(W - 180, 770); ctx.stroke();
    ctx.fillStyle = '#2c3e50'; ctx.font = '700 17px Inter, Arial';
    ctx.fillText('Direktur FaithToGrow', 305, 795);
    ctx.fillText('Direktur Global Inspire', W - 305, 795);
    // logo di atas
    var logoY = 72;
    var img1 = new Image(), img2 = new Image();
    img1.onload = function () {
      var h = 46, w = img1.width * (h / img1.height);
      ctx.drawImage(img1, W / 2 - w - 16, logoY, w, h);
    };
    img2.onload = function () {
      var h = 46, w = img2.width * (h / img2.height);
      ctx.drawImage(img2, W / 2 + 16, logoY, w, h);
    };
    img1.src = 'assets/ftg-logo.png';
    img2.src = 'assets/gi-logo.png';
  }

  /* ---------- Boot ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support opsional */ });
  }
  document.addEventListener('DOMContentLoaded', function () {
    if (!guardSession()) return;
    initSupabase();
    remoteLoad().then(function () {
      try { wireNav(); } catch (e) { console.warn(e); }
      try { initMobileNav(); } catch (e) { console.warn(e); }
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
        else if (PAGE.indexOf('admin-dashboard') === 0) initAdminDashboard();
      } catch (e) { console.error('FTG init error:', e); }
      try { personalize(); } catch (e) { console.warn(e); }
      try { startRealtime(); } catch (e) { console.warn(e); }
      try { startPresence(); } catch (e) { console.warn(e); }
      try { if (PAGE.indexOf('mentor-dashboard') === 0) insertActivityFeed(); } catch (e) { console.warn(e); }
      try { if (PAGE.indexOf('mentee-dashboard') === 0) { insertSessionCard(); unlockDefinerBadges(); } } catch (e) { console.warn(e); }
      try { if (PAGE.indexOf('progress-tracker') === 0) { unlockDefinerBadges(); insertPrintButton(); } } catch (e) { console.warn(e); }
      try { showConnBadge(); } catch (e) { console.warn(e); }
    });
  });
})();
