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
    assignmentSubmissions: {}, // taskId -> { text, link, files, submittedAt, review }
    replies: [],         // balasan mentee di halaman feedback
    messages: [],        // chat mentee <-> mentor: { from, fromName, text, at }
    events: [],          // notifikasi: { icon, text, forRole, at, read }
    session1on1: null,   // jadwal sesi: { date, time, note, by, at }
    loginDays: [],       // tanggal login (YYYY-MM-DD) utk streak sungguhan
    ideate: ['', '', ''],// kolom IDEATE (terbuka setelah W2 dinilai)
    w3Celebrated: false, // perayaan pembukaan W3 sudah ditampilkan?
    journal: [],         // jurnal pribadi: { date: 'YYYY-MM-DD', text, at }
    targets: [],         // target mingguan pribadi: { text, done }
    sessions: [],        // riwayat sesi 1-on-1
    portfolio: []        // taskId yang dipilih menjadi portfolio
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
    loginDays: (function () {
      var out = [];
      for (var i = 4; i >= 1; i--) out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
      return out;
    })(),
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
    return 0;
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
  var AUTH = { user: null, profile: null, accessToken: '', profilesByNumber: {}, profilesById: {} };
  var profileLiveChannel = null, profilePollTimer = null, profileLiveReady = false;

  function mySession() {
    try { return JSON.parse(localStorage.getItem('ftgSession') || 'null'); } catch (e) { return null; }
  }
  function googleProfile() {
    try {
      var p = JSON.parse(sessionStorage.getItem('ftgGoogleProfile') || 'null');
      var s = mySession();
      return p && s && p.ftgEmail === s.email ? p : null;
    } catch (e) { return null; }
  }
  function clearGoogleSession() {
    try {
      sessionStorage.removeItem('ftgDrive');
      sessionStorage.removeItem('ftgGoogleProfile');
    } catch (e) {}
  }
  function myRole() { var s = mySession(); return (s && s.role) || ''; }
  function myMenteeId() {
    var s = mySession();
    if (s && s.role === 'mentee') return Number(s.menteeId) || menteeIdByEmail(s.email);
    return 1;
  }
  function mentorNameForMentee(menteeNumber) {
    var mentee = AUTH.profilesByNumber[Number(menteeNumber)] || {};
    var mentor = mentee.mentor_id && AUTH.profilesById[mentee.mentor_id];
    return mentor && mentor.full_name ? mentor.full_name : '';
  }
  function currentMentorName() {
    var ses = mySession() || {};
    if (ses.role === 'mentor') return ses.name || 'Mentor';
    return mentorNameForMentee(myMenteeId()) || 'Mentor kamu';
  }
  function myTag() {
    var r = myRole();
    return r === 'mentee' ? 'mentee-' + myMenteeId() : (r || 'anon');
  }
  function initialsOf(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return words.map(function (word) { return word.charAt(0).toUpperCase(); }).join('') || 'FT';
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
    // daftarkan mentee tambahan (dibuat panitia) ke registry MENTEES
    registerExtraUsers(g);
    if (!Array.isArray(g.assignments)) g.assignments = [];
    if (!Array.isArray(g.assignmentTemplates)) g.assignmentTemplates = [];
    if (!Array.isArray(g.auditLog)) g.auditLog = [];
    if (!Array.isArray(g.cohorts)) g.cohorts = [{ id: 'cohort-2026', name: 'FTG Fellowship 2026', status: 'active', startDate: '2026-08-01', endDate: '2026-10-31' }];
    if (!g.pairings || typeof g.pairings !== 'object') g.pairings = {};
    if (!g.reminderLedger || typeof g.reminderLedger !== 'object') g.reminderLedger = {};
    g.programSettings = Object.assign({
      programName: 'Future Builders Fellowship', cohortName: 'FTG Fellowship 2026',
      currentMonth: 1, currentWeek: 2, passingScore: 75,
      reminderDays: [3, 1, 0], timezone: 'Asia/Makassar',
      kpiWeights: { completion: 30, quality: 40, engagement: 20, values: 10 }
    }, g.programSettings || {});
    for (var i = 1; i <= 5; i++) g.mentees[i] = Object.assign({}, DEFAULT_STATE, g.mentees[i] || lightSeed(i));
    // cerita program: Arya sudah aktif 4 hari terakhir (streak berjalan)
    if (!g.mentees[1].loginDays || !g.mentees[1].loginDays.length) {
      var ld = [];
      for (var d = 4; d >= 1; d--) ld.push(new Date(Date.now() - d * 86400000).toISOString().slice(0, 10));
      g.mentees[1].loginDays = ld;
    }
    Object.keys(g.mentees).forEach(function (k) {
      if (+k > 5) g.mentees[k] = Object.assign({}, DEFAULT_STATE, g.mentees[k]);
      g.mentees[k].assignmentSubmissions = Object.assign({}, g.mentees[k].assignmentSubmissions || {});
      g.mentees[k].sessions = Array.isArray(g.mentees[k].sessions) ? g.mentees[k].sessions : [];
      g.mentees[k].portfolio = Array.isArray(g.mentees[k].portfolio) ? g.mentees[k].portfolio : [];
    });
    return g;
  }
  var COLORS = ['#f97316', '#8b5cf6', '#1a5f4f', '#2c3e50', '#0ea5e9', '#db2777'];
  function registerExtraUsers(g) {
    var ex = g.extraUsers || {};
    Object.keys(ex).forEach(function (email) {
      var u = ex[email];
      if (u.role === 'mentee' && u.menteeId && !MENTEES[u.menteeId]) {
        MENTEES[u.menteeId] = {
          name: u.name, initials: u.initials, path: u.path || 'Career Path',
          email: email, color: COLORS[u.menteeId % COLORS.length], baseProgress: 5
        };
      }
    });
  }
  function menteeIds() {
    return Object.keys(MENTEES).map(Number).sort(function (a, b) { return a - b; });
  }
  function loadG() {
    try {
      var raw = localStorage.getItem('ftgStateV2');
      if (raw) return normalizeG(JSON.parse(raw));
    } catch (e) {}
    return normalizeG(seedAll());
  }

  var G = loadG();
  function configuredTracks(includeInactive) {
    var flags=G&&G.programSettings&&G.programSettings.featureFlags||{},source=Array.isArray(flags.program_tracks)&&flags.program_tracks.length?flags.program_tracks:[{label:'Career Path',active:true,color:'#7c3aed'},{label:'Entrepreneur Path',active:true,color:'#f97316'}];
    return source.map(function(item,index){return typeof item==='string'?{id:'track-'+index,label:item,active:true,color:'#1a5f4f'}:item;}).filter(function(item){return item&&item.label&&(includeInactive||item.active!==false);});
  }
  function trackOptions(selected,includeInactive) {
    var rows=configuredTracks(includeInactive),exists=rows.some(function(track){return track.label===selected;});
    if(selected&&!exists)rows=rows.concat([{label:selected,active:false}]);
    return rows.map(function(track){return '<option value="'+esc(track.label)+'" '+(track.label===selected?'selected':'')+'>'+esc(track.label)+(track.active===false?' (nonaktif)':'')+'</option>';}).join('');
  }
  var MID = 1; // di-set ulang saat boot sesuai sesi
  var S = G.mentees[1];
  function bindS() {
    MID = myMenteeId();
    if (!G.mentees[MID]) G.mentees[MID] = Object.assign({}, DEFAULT_STATE);
    S = G.mentees[MID];
  }
  function mstate(i) {
    if (!G.mentees[i]) G.mentees[i] = Object.assign({}, DEFAULT_STATE);
    return G.mentees[i];
  }

  function initSupabase() {
    try {
      if (window.supabase && window.FTG_CONF && window.FTG_CONF.anonKey) {
        sb = window.supabase.createClient(window.FTG_CONF.url, window.FTG_CONF.anonKey);
      }
    } catch (e) { sb = null; }
  }

  function persistLocal() { try { localStorage.setItem('ftgStateV2', JSON.stringify(G)); } catch (e) {} }

  function applyRemote(data) {
    var privateJournals = {};
    try { Object.keys(G.mentees || {}).forEach(function (k) { privateJournals[k] = G.mentees[k].journal || []; }); } catch (e) {}
    G = normalizeG(data);
    Object.keys(privateJournals).forEach(function (k) { if (G.mentees[k]) G.mentees[k].journal = privateJournals[k]; });
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
    var serverData = JSON.parse(JSON.stringify(G));
    Object.keys(serverData.mentees || {}).forEach(function (k) { serverData.mentees[k].journal = []; });
    sb.from('ftg_state').update({ data: serverData, updated_at: new Date().toISOString() }).eq('id', 1)
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
    var who = by === 'mentor' ? 'Mentor' : (by === 'admin' ? 'Fasil' : 'Mentee');
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
    // Leaderboard diperbarui di tempat. Hindari reload berkala yang sempat
    // menampilkan identitas statis Arya sebelum role mentor dipersonalisasi.
    if (PAGE.indexOf('kpi-leaderboard') === 0) {
      try { var liveTable=byId('leaderboard-table');if(liveTable)liveTable.removeAttribute('data-real-loading');initRealLeaderboard(); personalize(); } catch (e) { console.warn(e); }
      return;
    }
    // Jangan reload seluruh dashboard untuk setiap perubahan realtime. Pada
    // grup aktif hal ini membuat mentor/Fasil berkedip terus-menerus.
    try {
      if (/^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE)) refreshReviewNumbersUI();
      if (PAGE.indexOf('kpi-leaderboard') === 0) initRealLeaderboard();
      personalize();
    } catch (e) { console.warn(e); }
    toast('Data terbaru dari ' + who + ' sudah disinkronkan', '📨');
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
    menteeIds().forEach(function (i) { opts += '<option value="' + i + '">' + MENTEES[i].name + ' (' + MENTEES[i].path + ')</option>'; });
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
          var mentorActor = currentMentorName();
          st.session1on1 = { date: dt, time: tm, note: $('#ssNote', box).value.trim(), by: mentorActor, at: new Date().toISOString() };
          st.sessions = st.sessions || [];
          var scheduledSession = { id: 'session-' + Date.now(), date: dt, time: tm, note: $('#ssNote', box).value.trim(), status: 'scheduled', by: mentorActor, at: new Date().toISOString() };
          st.sessions.unshift(scheduledSession);
          structuredSessionSchedule(target, scheduledSession);
          var label = new Date(dt + 'T' + tm).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) + ' ' + tm + ' WIB';
          pushEventTo(target, '🗓', mentorActor + ' menjadwalkan sesi 1-on-1: ' + label, 'mentee');
          addAudit('session.schedule', label, target);
          saveState(); close();
          toast('Undangan terkirim ke ' + MENTEES[target].name.split(' ')[0] + ' — ' + label, '🗓');
        });
      }
    );
  }
  /* ---------- Streak sungguhan (hari login berturut-turut) ---------- */
  function computeStreak(days) {
    if (!days || !days.length) return 0;
    var set = {};
    days.forEach(function (d) { set[d] = true; });
    var streak = 0;
    var cur = new Date();
    for (;;) {
      var key = cur.toISOString().slice(0, 10);
      if (set[key]) { streak++; cur = new Date(cur.getTime() - 86400000); }
      else break;
    }
    return streak;
  }
  function trackLoginDay() {
    if (myRole() !== 'mentee') return 0;
    var today = new Date().toISOString().slice(0, 10);
    S.loginDays = S.loginDays || [];
    if (S.loginDays.indexOf(today) === -1) {
      S.loginDays.push(today);
      if (S.loginDays.length > 40) S.loginDays.splice(0, S.loginDays.length - 40);
      saveState();
    }
    return computeStreak(S.loginDays);
  }
  function updateStreakUI() {
    var streak = trackLoginDay();
    if (!streak) return;
    // widget sidebar "N Hari Berturut" + lingkaran ceklis
    $all('aside span, main span, main p').forEach(function (el) {
      if (/^\d+ Hari Berturut$/.test(el.textContent.trim())) el.textContent = streak + ' Hari Berturut';
    });
    var wrap = $all('aside .flex.gap-1').filter(function (d) { return d.children.length === 7; })[0];
    if (wrap) {
      $all('div', wrap).forEach(function (dot, i) {
        if (i < streak) {
          dot.className = 'w-5 h-5 rounded-full bg-[#f97316] flex items-center justify-center';
          dot.innerHTML = '<i class="fa-solid fa-check text-white text-[8px]"></i>';
        } else {
          dot.className = 'w-5 h-5 rounded-full bg-white/10 border border-white/20';
          dot.innerHTML = '';
        }
      });
    }
    // statistik "Streak hari" di progress tracker
    $all('span').forEach(function (sp) {
      if (/^\d+ 🔥$/.test(sp.textContent.trim())) sp.textContent = streak + ' 🔥';
    });
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

  /* ================================================================
     PAGE: JURNAL PRIBADI (mentee) — autosave, 100% privat
     ================================================================ */
  function initJournal() {
    var ta = $('#jrnToday');
    if (!ta) return;
    var today = new Date().toISOString().slice(0, 10);
    var dateEl = $('#jrnDate');
    if (dateEl) dateEl.textContent = todayStr();
    S.journal = S.journal || [];
    var entry = S.journal.filter(function (e) { return e.date === today; })[0];
    if (entry) ta.value = entry.text;
    var cnt = $('#jrnCount'), saved = $('#jrnSaved');
    function refreshCount() { if (cnt) cnt.textContent = wordCount(ta.value) + ' kata'; }
    refreshCount();
    var t;
    ta.addEventListener('input', function () {
      refreshCount();
      clearTimeout(t);
      t = setTimeout(function () {
        if (!entry) { entry = { date: today, text: '', at: new Date().toISOString() }; S.journal.push(entry); }
        entry.text = ta.value;
        entry.at = new Date().toISOString();
        saveState();
        if (saved) {
          saved.textContent = '✓ Tersimpan otomatis';
          setTimeout(function () { saved.textContent = ''; }, 2000);
        }
        renderStats();
      }, 800);
    });

    function renderList() {
      var list = $('#jrnList');
      if (!list) return;
      var prev = S.journal.filter(function (e) { return e.date !== today && e.text.trim(); })
        .sort(function (a, b) { return b.date < a.date ? -1 : 1; });
      list.innerHTML = prev.length ? prev.map(function (e, i) {
        var d = new Date(e.date + 'T12:00:00');
        return '<div class="bg-slate-50 rounded-xl p-4">' +
          '<div class="flex items-center justify-between mb-1">' +
          '<p class="text-[#1a5f4f] text-xs font-bold">' + d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
          '<button type="button" data-jdel="' + e.date + '" class="text-slate-300 hover:text-[#ef4444] text-xs" style="border:0;background:none;cursor:pointer">hapus</button></div>' +
          '<p class="text-slate-600 text-xs leading-relaxed" style="white-space:pre-wrap">' + esc(e.text) + '</p></div>';
      }).join('') : '<p class="text-slate-400 text-xs">Belum ada entri sebelumnya. Jurnal pertamamu dimulai hari ini! 🌱</p>';
      $all('[data-jdel]', list).forEach(function (b) {
        b.addEventListener('click', function () {
          var dd = b.getAttribute('data-jdel');
          S.journal = S.journal.filter(function (e) { return e.date !== dd; });
          saveState(); renderList(); renderStats();
          toast('Entri dihapus', '🗑');
        });
      });
    }
    function renderStats() {
      var el = $('#jrnStats');
      if (!el) return;
      var entries = S.journal.filter(function (e) { return e.text.trim(); });
      var words = entries.reduce(function (a, e) { return a + wordCount(e.text); }, 0);
      el.innerHTML =
        '<div class="flex justify-between text-xs"><span class="text-slate-600">Total entri</span><span class="font-bold text-[#1a5f4f]">' + entries.length + '</span></div>' +
        '<div class="flex justify-between text-xs"><span class="text-slate-600">Total kata ditulis</span><span class="font-bold text-[#8b5cf6]">' + words + '</span></div>' +
        '<div class="flex justify-between text-xs"><span class="text-slate-600">Streak login</span><span class="font-bold text-[#f97316]">' + computeStreak(S.loginDays || []) + ' hari 🔥</span></div>';
    }
    renderList();
    renderStats();
  }

  /* ---------- Target mingguan pribadi (mentee) ---------- */
  function insertTargetsCard() {
    var anchor = byId('weekly-checklist');
    if (!anchor) return;
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-6';
    anchor.parentElement.parentElement.appendChild(sec); // full-width di bawah grid badge+checklist
    function render() {
      var tgs = S.targets || [];
      var rows = tgs.map(function (t, i) {
        return '<div class="flex items-center gap-3 p-2.5 rounded-xl ' + (t.done ? 'bg-[#22c55e]/5' : 'bg-slate-50') + '">' +
          '<button type="button" data-tgl="' + i + '" style="width:22px;height:22px;border-radius:7px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;border:0;' + (t.done ? 'background:#22c55e' : 'background:#fff;border:2px solid #cbd5e1') + '">' + (t.done ? '<i class="fa-solid fa-check" style="color:#fff;font-size:10px"></i>' : '') + '</button>' +
          '<span class="flex-1 text-xs ' + (t.done ? 'text-[#16a34a] line-through opacity-75' : 'text-[#2c3e50]') + '">' + esc(t.text) + '</span>' +
          '<button type="button" data-tdel="' + i + '" class="text-slate-300 hover:text-[#ef4444] text-xs" style="border:0;background:none;cursor:pointer">✕</button></div>';
      }).join('');
      var done = tgs.filter(function (t) { return t.done; }).length;
      sec.innerHTML =
        '<div class="flex items-center justify-between mb-1 flex-wrap gap-2">' +
        '<h3 class="text-[#2c3e50] text-sm font-bold">🎯 Target Pribadi Minggu Ini</h3>' +
        '<span class="text-slate-400 text-xs">' + (tgs.length ? done + '/' + tgs.length + ' tercapai · terlihat oleh mentormu' : 'maks. 3 target · terlihat oleh mentormu') + '</span></div>' +
        '<p class="text-slate-500 text-xs mb-3">Tulis komitmen kecilmu sendiri — bahan obrolan sesi 1-on-1 dengan mentor.</p>' +
        '<div class="space-y-2 mb-3">' + (rows || '<p class="text-slate-400 text-xs py-1">Belum ada target. Tulis yang pertama! 💪</p>') + '</div>' +
        (tgs.length < 3
          ? '<div class="flex gap-2"><input id="tgInput" type="text" maxlength="90" placeholder="cth: Wawancara 2 narasumber sebelum Jumat" class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-[#2c3e50] outline-none">' +
            '<button type="button" id="tgAdd" class="bg-[#8b5cf6] text-white text-xs font-bold px-4 py-2.5 rounded-xl">Tambah</button></div>'
          : '<p class="text-slate-400 text-[10px]">Maksimal 3 target per minggu — fokus itu kunci. ✨</p>');
      $all('[data-tgl]', sec).forEach(function (b) {
        b.addEventListener('click', function () {
          var t = S.targets[+b.getAttribute('data-tgl')];
          t.done = !t.done;
          if (t.done) confetti();
          saveState(); render();
        });
      });
      $all('[data-tdel]', sec).forEach(function (b) {
        b.addEventListener('click', function () { S.targets.splice(+b.getAttribute('data-tdel'), 1); saveState(); render(); });
      });
      var add = $('#tgAdd', sec);
      if (add) {
        var inp = $('#tgInput', sec);
        var doAdd = function () {
          var v = inp.value.trim();
          if (!v) { toast('Tulis targetnya dulu ya', '✏️'); return; }
          S.targets.push({ text: v, done: false });
          saveState(); render();
          toast('Target ditambahkan — semangat!', '🎯');
        };
        add.addEventListener('click', doAdd);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); });
      }
    }
    render();
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

    // grafik monitoring: bar progres per mentee + donut status tugas
    var cb = $('#chartBars');
    if (cb) {
      var barsHtml = '';
      for (var bI = 1; bI <= 5; bI++) {
        var mb = MENTEES[bI], stb = mstate(bI);
        var pg = mb.baseProgress + (stb.submittedW2 ? 17 : 0);
        barsHtml += '<div><div class="flex justify-between mb-1"><span class="text-xs font-semibold text-[#2c3e50]">' + mb.name + '</span>' +
          '<span class="text-xs font-bold" style="color:' + mb.color + '">' + pg + '%</span></div>' +
          '<div class="h-2 bg-slate-100 rounded-full"><div class="h-2 rounded-full" style="width:' + pg + '%;background:' + mb.color + '"></div></div></div>';
      }
      cb.innerHTML = barsHtml;
    }
    var cd = $('#chartDonut');
    if (cd) {
      var segs = [
        [reviewed, '#22c55e', 'Sudah dinilai mentor'],
        [submitted - reviewed, '#8b5cf6', 'Menunggu review'],
        [5 - submitted, '#e2e8f0', 'Belum mengumpulkan']
      ];
      var off = 25, circles = '';
      segs.forEach(function (s) {
        if (!s[0]) return;
        var len = s[0] / 5 * 100;
        circles += '<circle cx="18" cy="18" r="15.9155" fill="none" stroke="' + s[1] + '" stroke-width="4.2" stroke-dasharray="' + len + ' ' + (100 - len) + '" stroke-dashoffset="' + off + '" stroke-linecap="round"/>';
        off -= len;
      });
      cd.innerHTML =
        '<div style="position:relative;width:132px;height:132px;flex-shrink:0">' +
        '<svg viewBox="0 0 36 36" style="width:132px;height:132px">' + circles + '</svg>' +
        '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<span style="font-size:24px;font-weight:800;color:#2c3e50">' + submitted + '/5</span>' +
        '<span style="font-size:10px;color:#94a3b8">terkumpul</span></div></div>' +
        '<div class="space-y-2.5">' + segs.map(function (s) {
          return '<p class="text-xs text-slate-600 flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:' + s[1] + ';display:inline-block;flex-shrink:0"></span>' + s[2] + ': <b class="text-[#2c3e50]">' + s[0] + '</b></p>';
        }).join('') + '</div>';
    }

    // feed aktivitas gabungan (ringkas)
    var feed = $('#adminFeed');
    if (feed) {
      var evs = allEvents(null).slice(0, 8);
      feed.innerHTML = evs.length ? evs.map(function (ev) {
        return '<div class="flex items-start gap-2.5 pb-2.5 border-b border-slate-50">' +
          '<span style="font-size:14px">' + ev.icon + '</span>' +
          '<div class="min-w-0"><p class="text-[#2c3e50] text-xs font-medium leading-snug">' + esc(ev.text) + '</p>' +
          '<p class="text-slate-400 text-[10px] mt-0.5">' + timeAgo(ev.at) + ' · ' + (MENTEES[ev.menteeId] ? MENTEES[ev.menteeId].name.split(' ')[0] : '') + '</p></div></div>';
      }).join('') : '<p class="text-slate-400 text-xs">Belum ada aktivitas.</p>';
    }

    /* ---- Kelola akun ---- */
    var BUILTIN_ACCOUNTS = [
      { email: 'arya@ftg.id', name: 'Arya Ramadhan', role: 'mentee', initials: 'AR', path: 'Career Path' },
      { email: 'siti@ftg.id', name: 'Siti Aisyah', role: 'mentee', initials: 'SA', path: 'Entrepreneur Path' },
      { email: 'rizky@ftg.id', name: 'Muhammad Rizky', role: 'mentee', initials: 'MR', path: 'Career Path' },
      { email: 'dina@ftg.id', name: 'Dina Fitriani', role: 'mentee', initials: 'DF', path: 'Entrepreneur Path' },
      { email: 'bagas@ftg.id', name: 'Bagas Nugroho', role: 'mentee', initials: 'BN', path: 'Career Path' },
      { email: 'faris@ftg.id', name: 'Bapak Faris', role: 'mentor', initials: 'BF', path: 'Senior Mentor' },
      { email: 'panitia@ftg.id', name: 'Fasil', role: 'admin', initials: 'FS', path: 'Program Facilitator' }
    ];
    function roleChip(r) {
      var map = { mentee: ['MENTEE', '#f97316'], mentor: ['MENTOR', '#1a5f4f'], admin: ['FASIL', '#8b5cf6'] };
      var m = map[r] || ['?', '#94a3b8'];
      return '<span style="background:' + m[1] + '1a;color:' + m[1] + ';font-size:9px;font-weight:800;padding:3px 9px;border-radius:99px;letter-spacing:.05em">' + m[0] + '</span>';
    }
    function renderAccounts() {
      var wrap = $('#accountRows');
      if (!wrap) return;
      var ex = G.extraUsers || {};
      var all = BUILTIN_ACCOUNTS.map(function (a) { return Object.assign({ builtin: true }, a); })
        .concat(Object.keys(ex).map(function (em) { return Object.assign({ email: em }, ex[em]); }));
      var cnt = $('#accountCount');
      if (cnt) cnt.textContent = all.length + ' akun terdaftar';
      // panel ringkasan peran + aksi terakhir (halaman Kelola Akun)
      var rs = $('#roleSummary');
      if (rs) {
        var counts = { mentee: 0, mentor: 0, admin: 0 };
        all.forEach(function (a) { if (counts[a.role] !== undefined) counts[a.role]++; });
        rs.innerHTML =
          '<div class="flex items-center justify-between"><span class="text-slate-600 text-xs flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:#f97316;display:inline-block"></span>Mentee</span><span class="text-[#2c3e50] text-sm font-bold">' + counts.mentee + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-slate-600 text-xs flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:#1a5f4f;display:inline-block"></span>Mentor</span><span class="text-[#2c3e50] text-sm font-bold">' + counts.mentor + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-slate-600 text-xs flex items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:#8b5cf6;display:inline-block"></span>Fasil</span><span class="text-[#2c3e50] text-sm font-bold">' + counts.admin + '</span></div>' +
          '<div class="flex items-center justify-between border-t border-slate-100 pt-2"><span class="text-slate-600 text-xs font-semibold">Total</span><span class="text-[#8b5cf6] text-sm font-bold">' + all.length + '</span></div>';
      }
      var alog = $('#accountLog');
      if (alog) {
        var logs = (G.adminLog || []).filter(function (l) { return /Akun/.test(l.text); }).slice(0, 4);
        alog.innerHTML = logs.length ? logs.map(function (l) {
          return '<p class="text-xs text-slate-600 py-1 border-b border-slate-50">' + esc(l.text) + ' <span class="text-slate-400 text-[10px]">· ' + timeAgo(l.at) + '</span></p>';
        }).join('') : '<p class="text-slate-400 text-xs">Belum ada perubahan akun.</p>';
      }
      wrap.innerHTML = all.map(function (a) {
        return '<div class="px-5 py-3 flex items-center gap-3 border-b border-slate-50">' +
          '<div class="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0" style="background:' + (a.role === 'mentor' ? '#1a5f4f' : a.role === 'admin' ? '#8b5cf6' : '#f97316') + '">' + esc(a.initials || '?') + '</div>' +
          '<div class="flex-1 min-w-0"><p class="text-[#2c3e50] text-xs font-semibold truncate">' + esc(a.name) + '</p>' +
          '<p class="text-slate-400 text-[10px] truncate">' + esc(a.email) + ' · ' + esc(a.path || '') + '</p></div>' +
          roleChip(a.role) +
          (a.builtin ? '<span class="text-slate-300 text-[9px] ml-2">bawaan</span>'
            : '<button type="button" data-rmacc="' + esc(a.email) + '" class="ml-2 text-[#ef4444] text-[10px] font-bold hover:underline">hapus</button>') +
          '</div>';
      }).join('');
      $all('[data-rmacc]', wrap).forEach(function (b) {
        b.addEventListener('click', function () {
          var em = b.getAttribute('data-rmacc');
          delete G.extraUsers[em];
          adminLog('Akun ' + em + ' dihapus oleh Fasil');
          saveState(); renderAccounts(); renderLog();
          toast('Akun ' + em + ' dihapus', '🗑');
        });
      });
    }
    function addAccountModal(role) {
      var isMentee = role === 'mentee';
      modal(
        '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">' + (isMentee ? '🎓 Tambah Mentee' : '🧑‍🏫 Tambah Mentor') + '</h3>' +
        '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Akun langsung aktif & bisa dipakai login di semua perangkat</p>' +
        '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:5px">Nama lengkap</label>' +
        '<input id="acName" type="text" placeholder="cth: Rani Puspita" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">' +
        '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:5px">Email</label>' +
        '<input id="acEmail" type="email" placeholder="cth: rani@ftg.id" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">' +
        '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:5px">Password</label>' +
        '<input id="acPw" type="text" placeholder="min. 6 karakter" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px">' +
        (isMentee ?
          '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:5px">Jalur</label>' +
          '<select id="acPath" style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;background:#fff;margin-bottom:4px">' +
          trackOptions('',false)+'</select>' : '') +
        '<button id="acSave" style="margin-top:12px;width:100%;background:' + (isMentee ? '#f97316' : '#1a5f4f') + ';color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Simpan Akun</button>',
        function (box, close) {
          $('#acSave', box).addEventListener('click', function () {
            var nm = $('#acName', box).value.trim();
            var em = $('#acEmail', box).value.trim().toLowerCase();
            var pw = $('#acPw', box).value;
            if (!nm || !/^\S+@\S+\.\S+$/.test(em) || pw.length < 6) { toast('Lengkapi nama, email valid, & password min. 6 karakter', '✏️'); return; }
            G.extraUsers = G.extraUsers || {};
            if (G.extraUsers[em] || BUILTIN_ACCOUNTS.some(function (a) { return a.email === em; })) { toast('Email sudah terdaftar', '⚠️'); return; }
            var entry = { pw: btoa(pw), name: nm, role: role, initials: initialsOf(nm), path: isMentee ? $('#acPath', box).value : 'Mentor', at: new Date().toISOString() };
            if (isMentee) {
              var nextId = Math.max.apply(null, menteeIds()) + 1;
              entry.menteeId = nextId;
            }
            G.extraUsers[em] = entry;
            registerExtraUsers(G);
            adminLog('Akun ' + role + ' baru: ' + nm + ' (' + em + ') ditambahkan oleh Fasil');
            saveState(); close();
            renderAccounts(); renderLog();
            toast(nm + ' ditambahkan — bisa langsung login', '✅');
          });
        }
      );
    }
    // Jalur lokal lama hanya untuk fallback tanpa Supabase. Produksi memakai
    // mountSecureAccountAdmin sebagai satu-satunya pemilik tombol akun.
    if (!sb) {
      var bAddMe = $('#btnAddMentee');
      if (bAddMe) bAddMe.addEventListener('click', function () { addAccountModal('mentee'); });
      var bAddMo = $('#btnAddMentor');
      if (bAddMo) bAddMo.addEventListener('click', function () { addAccountModal('mentor'); });
      renderAccounts();
    }

    /* ---- Log sistem (gabungan event + log admin) ---- */
    function renderLog() {
      var el = $('#adminLog');
      if (!el) return;
      var rows = (G.adminLog || []).map(function (l) { return { icon: '🛠', text: l.text, at: l.at, who: 'Fasil' }; })
        .concat(allEvents(null).map(function (ev) { return { icon: ev.icon, text: ev.text, at: ev.at, who: MENTEES[ev.menteeId] ? MENTEES[ev.menteeId].name.split(' ')[0] : '' }; }));
      rows.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      el.innerHTML = rows.length ? rows.slice(0, 30).map(function (r) {
        return '<div class="flex items-center gap-3 py-2 border-b border-slate-50">' +
          '<span style="font-size:13px;flex-shrink:0">' + r.icon + '</span>' +
          '<p class="flex-1 text-[#2c3e50] text-xs min-w-0">' + esc(r.text) + '</p>' +
          '<span class="text-slate-400 text-[10px] flex-shrink-0">' + (r.who ? r.who + ' · ' : '') + timeAgo(r.at) + '</span></div>';
      }).join('') : '<p class="text-slate-400 text-xs py-2">Belum ada log.</p>';
    }
    renderLog();
  }
  function adminLog(text) {
    G.adminLog = G.adminLog || [];
    G.adminLog.unshift({ text: text, at: new Date().toISOString() });
    if (G.adminLog.length > 30) G.adminLog.length = 30;
  }

  /* ---------- Kartu penyeimbang kolom (anti ruang kosong) ---------- */
  function miniEventList(evs) {
    return evs.map(function (ev) {
      return '<div class="flex items-start gap-2.5 py-2 border-b border-slate-50">' +
        '<span style="font-size:13px;flex-shrink:0">' + ev.icon + '</span>' +
        '<div class="min-w-0"><p class="text-[#2c3e50] text-xs font-medium leading-snug">' + esc(ev.text) + '</p>' +
        '<p class="text-slate-400 text-[10px] mt-0.5">' + timeAgo(ev.at) + '</p></div></div>';
    }).join('');
  }
  /* mentee-dashboard: feed "Aktivitas Kamu" di bawah kolom kiri */
  function insertMenteeActivity() {
    var anchor = byId('canvas-progress') || byId('weekly-tasks');
    if (!anchor) return;
    var evs = myEvents().slice(0, 2);
    if (!evs.length) return;
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
    sec.innerHTML = '<div class="flex items-center justify-between mb-1">' +
      '<h3 class="text-[#2c3e50] text-sm font-bold">🔔 Aktivitas Kamu</h3>' +
      '<span class="text-slate-400 text-xs">terbaru</span></div>' +
      '<div class="grid grid-cols-2 gap-x-6">' + miniEventList(evs) + '</div>';
    anchor.parentElement.appendChild(sec);
  }
  /* assignment: kartu kriteria penilaian + aktivitas di kolom kanan */
  function insertAssignmentSide() {
    var anchor = byId('kpi-impact');
    if (!anchor) return;
    var col = anchor.parentElement;
    var krit = document.createElement('section');
    krit.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
    krit.innerHTML = '<h3 class="text-[#2c3e50] text-sm font-bold mb-3">🎯 Kriteria Penilaian</h3>' +
      '<div class="space-y-2">' +
      '<div class="flex justify-between text-xs"><span class="text-slate-600">Kedalaman analisis</span><span class="font-bold text-[#1a5f4f]">40%</span></div>' +
      '<div class="flex justify-between text-xs"><span class="text-slate-600">Keselarasan nilai (niyyah)</span><span class="font-bold text-[#8b5cf6]">25%</span></div>' +
      '<div class="flex justify-between text-xs"><span class="text-slate-600">Kualitas refleksi</span><span class="font-bold text-[#f97316]">20%</span></div>' +
      '<div class="flex justify-between text-xs"><span class="text-slate-600">Ketepatan waktu</span><span class="font-bold text-[#22c55e]">15%</span></div></div>' +
      '<p class="text-slate-400 text-[10px] mt-3">Skor akhir diberikan mentor · masuk ke Quality Score KPI kamu</p>';
    col.appendChild(krit);
  }
  /* mentor-feedback: riwayat nilai + tips membalas di kolom kanan */
  function insertFeedbackSide() {
    var anchor = byId('score-breakdown');
    if (!anchor) return;
    var col = anchor.parentElement;
    var w2 = S.reviewW2
      ? '<span class="text-[#22c55e] text-xs font-bold">' + S.reviewW2.score + '/100 ✓</span>'
      : (S.submittedW2 ? '<span class="text-[#8b5cf6] text-xs font-bold">Menunggu review</span>'
        : '<span class="text-slate-400 text-xs">Belum dikumpul</span>');
    var avg = S.reviewW2 ? Math.round((87 + S.reviewW2.score) / 2) : 87;
    var hist = document.createElement('section');
    hist.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
    hist.innerHTML = '<h3 class="text-[#2c3e50] text-sm font-bold mb-3">📈 Riwayat Nilai</h3>' +
      '<div class="space-y-2.5">' +
      '<div class="flex items-center justify-between"><span class="text-slate-600 text-xs">W1 — EMPATHIZE</span><span class="text-[#1a5f4f] text-xs font-bold">87/100 ✓</span></div>' +
      '<div class="flex items-center justify-between"><span class="text-slate-600 text-xs">W2 — DEFINE</span>' + w2 + '</div>' +
      '<div class="flex items-center justify-between border-t border-slate-100 pt-2"><span class="text-slate-600 text-xs font-semibold">Rata-rata</span><span class="text-[#8b5cf6] text-sm font-bold">' + avg + '</span></div></div>';
    col.appendChild(hist);
    var tips = document.createElement('section');
    tips.className = 'bg-[#1a5f4f] rounded-2xl p-5';
    tips.innerHTML = '<h3 class="text-white text-sm font-bold mb-2">💡 Manfaatkan Feedback</h3>' +
      '<ul class="space-y-2">' +
      '<li class="flex items-start gap-2"><i class="fa-solid fa-check-circle text-[#f97316] mt-0.5 text-xs"></i><p class="text-white/80 text-xs">Balas komentar mentor — dialog membuat nilaimu naik lebih cepat</p></li>' +
      '<li class="flex items-start gap-2"><i class="fa-solid fa-check-circle text-[#f97316] mt-0.5 text-xs"></i><p class="text-white/80 text-xs">Terapkan sarannya di tugas minggu berikutnya</p></li></ul>';
    col.appendChild(tips);
  }

  /* ---------- Rekap Nilai PDF (halaman Review Tugas mentor) ---------- */
  function insertRekapButton() {
    var header = $('main header');
    if (!header) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-[#1a5f4f] text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-[#155242] flex-shrink-0';
    btn.innerHTML = '<i class="fa-solid fa-file-arrow-down mr-1.5"></i>Unduh Rekap Nilai';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.appendChild(btn);
    btn.addEventListener('click', function () {
      var old = $('#printRekap');
      if (old) old.remove();
      var rows = '';
      var scores = [];
      for (var i = 1; i <= 5; i++) {
        var m = MENTEES[i], st = mstate(i);
        var w1 = (st.reviews && st.reviews.w1) ? st.reviews.w1.score : (i === 1 ? 87 : '—');
        var w2 = st.reviewW2 ? st.reviewW2.score : (st.submittedW2 ? 'Menunggu' : 'Belum kumpul');
        if (typeof w1 === 'number') scores.push(w1);
        if (st.reviewW2) scores.push(st.reviewW2.score);
        var avg = [];
        if (typeof w1 === 'number') avg.push(w1);
        if (st.reviewW2) avg.push(st.reviewW2.score);
        rows += '<tr>' +
          '<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0"><b>' + m.name + '</b><br><span style="color:#64748b;font-size:11px">' + m.path + '</span></td>' +
          '<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center">' + w1 + '</td>' +
          '<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center">' + w2 + '</td>' +
          '<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;color:#1a5f4f">' + (avg.length ? Math.round(avg.reduce(function (a, b) { return a + b; }, 0) / avg.length) : '—') + '</td>' +
          '<td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px">' + (st.reviewW2 ? '✅ Lengkap' : (st.submittedW2 ? '🕐 Perlu review' : '⚠️ Menunggu tugas')) + '</td></tr>';
      }
      var avgAll = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : '—';
      var div = document.createElement('div');
      div.id = 'printRekap';
      div.innerHTML =
        '<div style="font-family:Inter,Arial,sans-serif;padding:24px">' +
        '<h1 style="font-size:20px;font-weight:800;color:#2c3e50;margin-bottom:2px">Rekap Nilai Mentee — Bulan 1, Minggu 2</h1>' +
        '<p style="font-size:12px;color:#64748b;margin-bottom:16px">FTG × GI Future Builders Fellowship 2026 · Mentor: Bapak Faris · Dicetak ' + todayStr() + '</p>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
        '<thead><tr style="background:#f8fafc">' +
        '<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #1a5f4f">Mentee</th>' +
        '<th style="padding:9px 12px;text-align:center;border-bottom:2px solid #1a5f4f">Nilai W1</th>' +
        '<th style="padding:9px 12px;text-align:center;border-bottom:2px solid #1a5f4f">Nilai W2</th>' +
        '<th style="padding:9px 12px;text-align:center;border-bottom:2px solid #1a5f4f">Rata-rata</th>' +
        '<th style="padding:9px 12px;text-align:center;border-bottom:2px solid #1a5f4f">Status</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
        '<p style="font-size:12px;color:#334155;margin-top:14px"><b>Rata-rata skor grup: ' + avgAll + '/100</b> · Tugas menunggu review: ' + pendingCount() + '</p>' +
        '<p style="font-size:10px;color:#94a3b8;margin-top:20px">Dokumen ini dibuat otomatis oleh platform FTG × GI Fellowship untuk pelaporan mentor kepada panitia.</p></div>';
      document.body.appendChild(div);
      document.body.classList.add('ftg-rekap');
      toast('Menyiapkan rekap — pilih "Save as PDF"', '🖨');
      var cleanup = function () {
        document.body.classList.remove('ftg-rekap');
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      setTimeout(function () { window.print(); }, 400);
    });
  }

  /* ---------- Feed aktivitas terbaru (dashboard mentor) ----------
     Ditaruh di KOLOM KIRI bawah daftar mentee (2 kolom item) supaya
     tinggi kolom kiri-kanan seimbang — tidak ada ruang kosong. */
  function insertActivityFeed() {
    var evs = allEvents(null).slice(0, 8);
    if (!evs.length) return;
    var itemsHtml = evs.map(function (ev) {
      return '<div class="flex items-start gap-2.5 py-2 border-b border-slate-50 min-w-0">' +
        '<span style="font-size:14px;flex-shrink:0">' + ev.icon + '</span>' +
        '<div class="min-w-0"><p class="text-[#2c3e50] text-xs font-medium leading-snug">' + esc(ev.text) + '</p>' +
        '<p class="text-slate-400 text-[10px] mt-0.5">' + timeAgo(ev.at) + ' · ' + (MENTEES[ev.menteeId] ? MENTEES[ev.menteeId].name.split(' ')[0] : '') + '</p></div></div>';
    }).join('');
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-5';
    sec.innerHTML = '<div class="flex items-center justify-between mb-2">' +
      '<h3 class="text-[#2c3e50] text-sm font-bold">🕒 Aktivitas Terbaru</h3>' +
      '<span class="text-slate-400 text-xs">' + evs.length + ' kejadian</span></div>' +
      '<div class="grid grid-cols-2 gap-x-6">' + itemsHtml + '</div>';
    var list = byId('mentee-list-section');
    if (list && list.parentElement) list.parentElement.appendChild(sec);
    else {
      var anchor = byId('group-progress');
      if (anchor) anchor.parentElement.insertBefore(sec, anchor.nextSibling);
    }
  }

  function hydrateProfileRecord(profile) {
    if (!profile) return profile;
    var preferences = profile.notification_preferences || {};
    profile.bio = profile.bio || preferences.profile_bio || '';
    profile.avatar_url = profile.avatar_url || preferences.avatar_url || '';
    return profile;
  }
  function patchVisibleProfileIdentity(previous, profile) {
    if (!profile) return;
    var oldName = previous && previous.full_name, oldPath = previous && previous.path, oldInitials = previous && previous.initials;
    if (oldName && oldName !== profile.full_name) {
      $all('main,aside').forEach(function(root){var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[],node;while((node=walker.nextNode()))nodes.push(node);nodes.forEach(function(textNode){if(!textNode.parentElement||/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(textNode.parentElement.tagName))return;if(textNode.nodeValue.indexOf(oldName)>-1)textNode.nodeValue=textNode.nodeValue.split(oldName).join(profile.full_name);});});
    }
    if (oldPath && oldPath !== profile.path) $all('main p,main small,aside p,aside small').forEach(function(node){if(node.textContent.trim()===oldPath)node.textContent=profile.path||'';});
    if (oldInitials && oldInitials !== profile.initials) $all('main .rounded-full,aside .rounded-full').forEach(function(node){if(node.textContent.trim()===oldInitials)node.textContent=profile.initials||initialsOf(profile.full_name);});
    $all('[data-profile-avatar="'+profile.id+'"]').forEach(function(node){node.innerHTML=profile.avatar_url?'<img src="'+esc(profile.avatar_url)+'" alt="Foto '+esc(profile.full_name)+'">':esc(profile.initials||initialsOf(profile.full_name));node.classList.toggle('ftg-profile-photo',Boolean(profile.avatar_url));});
  }
  function handleProfileRealtime(payload, quiet) {
    var eventType = payload.eventType || payload.event || 'UPDATE', next = payload['new'] || payload.new || null, old = payload.old || {};
    var id = (next && next.id) || old.id; if (!id) return;
    var previous = AUTH.profilesById[id] && Object.assign({},AUTH.profilesById[id]);
    if (eventType === 'DELETE') {
      delete AUTH.profilesById[id];
      Object.keys(AUTH.profilesByNumber).forEach(function(number){if(AUTH.profilesByNumber[number]&&AUTH.profilesByNumber[number].id===id){delete AUTH.profilesByNumber[number];delete MENTEES[number];}});
    } else {
      next = hydrateProfileRecord(Object.assign({},next));
      AUTH.profilesById[id] = Object.assign({},previous||{},next);
      var profile = AUTH.profilesById[id], number = Number(profile.mentee_number||0);
      if (number) { AUTH.profilesByNumber[number]=profile;MENTEES[number]=Object.assign({},MENTEES[number]||{},{name:profile.full_name,initials:profile.initials||initialsOf(profile.full_name),path:profile.path||'Career Path',email:profile.email});if(profile.mentor_id)G.pairings[number]=profile.mentor_id; }
      patchVisibleProfileIdentity(previous,profile);
      if (AUTH.user && id === AUTH.user.id) {
        AUTH.profile=Object.assign({},AUTH.profile,profile);
        var local=mySession()||{};local.name=profile.full_name;local.initials=profile.initials;local.path=profile.path;localStorage.setItem('ftgSession',JSON.stringify(local));
        personalize();applyOwnProfilePhoto();
      }
    }
    document.dispatchEvent(new CustomEvent('ftg:profiles-changed',{detail:{eventType:eventType,id:id,profile:next,previous:previous}}));
    if (!quiet && (!AUTH.user || id !== AUTH.user.id)) toast('Profil '+((next&&next.full_name)||(previous&&previous.full_name)||'pengguna')+' diperbarui','👤');
  }
  function startProfileRealtime() {
    if (!sb || profileLiveReady) return; profileLiveReady=true;
    try { profileLiveChannel=sb.channel('ftg-profiles-live').on('postgres_changes',{event:'*',schema:'public',table:'profiles'},function(payload){handleProfileRealtime(payload,false);}).subscribe(); } catch(e) { console.warn(e); }
    function pollProfiles(){if(document.hidden)return;sb.from('profiles').select('id,email,full_name,role,initials,path,cohort_id,mentee_number,mentor_id,status,warning_level,absence_count,last_active_at,graduation_eligible,notification_preferences,updated_at').then(function(result){if(result.error)return;var seen={};(result.data||[]).forEach(function(profile){seen[profile.id]=true;var known=AUTH.profilesById[profile.id];if(!known||String(known.updated_at||'')!==String(profile.updated_at||''))handleProfileRealtime({eventType:known?'UPDATE':'INSERT',new:profile,old:known||{}},true);});if(AUTH.profile&&AUTH.profile.role==='admin')Object.keys(AUTH.profilesById).forEach(function(id){if(!seen[id])handleProfileRealtime({eventType:'DELETE',old:{id:id}},true);});}).catch(function(){});}
    profilePollTimer=setInterval(pollProfiles,3000);document.addEventListener('visibilitychange',function(){if(!document.hidden)pollProfiles();});
  }

  function startRealtime() {
    if (!sb || !IS_APP_PAGE) return;
    try {
      sb.channel('ftg-state-live')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ftg_state' }, function (payload) {
          var d = payload['new'] && payload['new'].data;
          if (!d || !d.updatedAt || d.updatedAt === lastAppliedAt) return;
          if (d.updatedBy === myTag()) { applyRemote(d); lastAppliedAt = d.updatedAt; return; }
          onForeignUpdate(d);
        })
        .subscribe();
    } catch (e) { /* polling di bawah tetap jalan */ }
    startProfileRealtime();
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
        if (d && d.updatedAt && d.updatedAt !== lastAppliedAt && d.updatedBy !== myTag()) onForeignUpdate(d);
      });
    }, 7000);
  }

  /* Wajib login untuk halaman aplikasi + pemisahan peran. */
  function guardSession() {
    if (!IS_APP_PAGE || PAGE.indexOf('opening') === 0 || PAGE.indexOf('closing') === 0) return true;
    var ses = mySession();
    if (!ses || !ses.role) {
      var q = PAGE.indexOf('admin-') === 0 ? '#admin'
        : (/^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE) ? '#mentor' : '#mentee');
      location.replace('login.html' + q);
      return false;
    }
    function home(r) { return r === 'admin' ? 'admin-dashboard.html' : (r === 'mentor' ? 'mentor-dashboard.html' : 'mentee-dashboard.html'); }
    if (PAGE.indexOf('admin-') === 0 && ses.role !== 'admin') { location.replace(home(ses.role)); return false; }
    if (/^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE) && ses.role !== 'mentor') { location.replace(home(ses.role)); return false; }
    if (PAGE.indexOf('workshop-library') === 0 && !/^(mentee|mentor)$/.test(ses.role)) { location.replace(home(ses.role)); return false; }
    if (PAGE.indexOf('jurnal') === 0 && ses.role !== 'mentee') { location.replace(home(ses.role)); return false; }
    if (PAGE.indexOf('mentee-dashboard') === 0 && ses.role !== 'mentee') { location.replace(home(ses.role)); return false; }
    // panitia hanya memantau: halaman kerja mentee dialihkan ke dashboard panitia
    if (ses.role === 'admin' && /^(design-thinking|assignment|progress-tracker|mentor-feedback|workshop)/.test(PAGE)) {
      location.replace('admin-dashboard.html'); return false;
    }
    return true;
  }

  /* Personalisasi UI sesuai akun yang login (nama, inisial, path, menu) */
  var SHARED_PAGES = /^(kpi-leaderboard|opening-ceremony|closing-ceremony)/;
  function personalize() {
    var ses = mySession();
    if (!ses || !ses.name) return;
    var displayName = ses.name;
    var displayInitials = ses.initials || displayName.slice(0, 2).toUpperCase();
    var color = ses.role === 'mentor' ? '#1a5f4f' : (ses.role === 'admin' ? '#8b5cf6' : (MENTEES[myMenteeId()] || {}).color || '#f97316');

    // pill identitas di sidebar
    var pill = $('aside .mx-4.mt-4');
    if (pill) {
      var ps = $all('p', pill);
      var ava = $('div.rounded-full', pill);
      if (ps[0]) ps[0].textContent = displayName;
      if (ps[1]) ps[1].textContent = ses.path || (ses.role === 'admin' ? 'Monitoring Program' : '');
      if (ava) { ava.textContent = displayInitials; ava.style.background = color; }
    }

    // halaman bersama (leaderboard/ceremony) memakai menu milik peran yang login
    if ((SHARED_PAGES.test(PAGE) || PAGE.indexOf('workshop-library') === 0) && ses.role !== 'mentee') {
      var nav = $('aside nav');
      if (nav && !nav.getAttribute('data-ftg-personalized')) {
        nav.setAttribute('data-ftg-personalized', '1');
        var pending = pendingCount();
        // [ikon, label, href, badgeHTML] — identik dgn menu dashboard masing-masing peran
        var items = ses.role === 'mentor'
          ? [
              ['fa-house', 'Dashboard', 'mentor-dashboard.html', ''],
              ['fa-users', 'Mentee Saya', 'mentor-mentee.html', '<span class="ml-auto bg-[#f97316] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">5</span>'],
              ['fa-file-lines', 'Tugas & Review', 'mentor-review.html', pending ? '<span class="ml-auto bg-[#ef4444] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">' + pending + '</span>' : ''],
              ['fa-circle-play', 'LMS & Rekaman', 'workshop-library.html', ''],
              ['fa-comments', 'Berikan Feedback', 'mentor-dashboard.html#feedback', ''],
              ['fa-chart-bar', 'Progress Grup', 'mentor-dashboard.html#group-progress', ''],
              ['fa-trophy', 'Leaderboard', 'kpi-leaderboard.html', '']
            ]
          : [
              ['fa-gauge-high', 'Monitoring', 'admin-dashboard.html', ''],
              ['fa-building-columns', 'Pusat Program', 'admin-program.html', ''],
              ['fa-user-gear', 'Kelola Akun', 'admin-akun.html', ''],
              ['fa-trophy', 'Leaderboard', 'kpi-leaderboard.html', '']
            ];
        var html = items.map(function (it) {
          var base = it[2].split('#')[0];
          var active = (base === PAGE && it[2].indexOf('#') === -1) || (PAGE.indexOf('kpi-leaderboard') === 0 && it[1] === 'Leaderboard');
          return '<a href="' + it[2] + '" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ' +
            (active ? 'bg-[#1a5f4f] text-white' : 'text-white/60 hover:text-white hover:bg-white/10') + '">' +
            '<i class="fa-solid ' + it[0] + ' w-4 text-center"></i> ' + it[1] + it[3] + '</a>';
        }).join('');
        html += '<div class="pt-3 pb-1"><p class="text-white/25 text-[10px] font-semibold tracking-widest uppercase px-3">Events</p></div>';
        html += [['fa-star', 'Opening Ceremony', 'opening-ceremony.html'], ['fa-award', 'Closing Ceremony', 'closing-ceremony.html']].map(function (it) {
          var active = it[2] === PAGE;
          return '<a href="' + it[2] + '" class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ' +
            (active ? 'bg-[#f97316]/20 text-[#f97316]' : 'text-white/60 hover:text-white hover:bg-white/10') + '">' +
            '<i class="fa-solid ' + it[0] + ' w-4 text-center text-[#f97316]"></i> ' + it[1] + '</a>';
        }).join('');
        nav.innerHTML = html;
        var out = document.createElement('a');
        out.href = 'login.html';
        out.className = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-sm font-medium mt-4';
        out.innerHTML = '<i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Keluar';
        out.addEventListener('click', function (e) {
          e.preventDefault();
          secureLogout();
        });
        nav.appendChild(out);
      }
      // banner "posisi kamu" hanya relevan untuk mentee
      var pos = byId('my-position');
      if (pos) {
        pos.innerHTML = '<div class="flex items-center gap-4"><div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style="background:' + color + '">' + esc(ses.initials) + '</div>' +
          '<div><p class="text-white/60 text-xs">Masuk sebagai</p><p class="text-white text-lg font-bold">' + esc(ses.name) + '</p>' +
          '<p class="text-white/60 text-xs">' + (ses.role === 'mentor' ? 'Memantau 5 mentee bimbingan' : 'Memantau seluruh peserta program') + '</p></div></div>';
        pos.className = 'bg-[#2c3e50] rounded-2xl p-5 mb-5 flex items-center justify-between flex-wrap gap-4';
      }
      // Arya tetap tampil sebagai peserta, tetapi bukan lagi ditandai sebagai
      // "Kamu" ketika leaderboard dibuka oleh mentor atau panitia.
      var aryaParticipant = byId('lb-row-arya');
      if (aryaParticipant) {
        $all('span', aryaParticipant).forEach(function (sp) {
          if (/Kamu/.test(sp.textContent)) sp.remove();
        });
        aryaParticipant.className = 'px-6 py-3 grid grid-cols-12 gap-2 items-center border-b border-slate-100';
      }
    }

    if (ses.role === 'mentor') {
      var mentorFirstName = displayName.trim().split(/\s+/)[0] || 'Mentor';
      var mentorHeader = $('main header h1');
      if (mentorHeader && (/Halo,/.test(mentorHeader.textContent) || /Pak Faris|Bapak Faris/.test(mentorHeader.textContent))) mentorHeader.textContent = 'Halo, ' + mentorFirstName + '! 👋';
      $all('main header div.rounded-full').forEach(function (avatar) {
        if (/^[A-Z]{1,3}$/.test(avatar.textContent.trim())) { avatar.textContent = displayInitials; avatar.style.background = color; }
      });
      $all('aside p, main header p').forEach(function (node) {
        if (/^(Pak|Bapak) Faris$/.test(node.textContent.trim())) node.textContent = displayName;
      });
      document.title = 'Dashboard Mentor · ' + displayName + ' · FTG Fellowship';
      return;
    }
    if (ses.role !== 'mentee') return;
    // sapaan header + avatar header (halaman mentee)
    var h1 = $('main header h1');
    if (h1 && /Selamat datang kembali/.test(h1.textContent)) h1.textContent = 'Selamat datang kembali, ' + ses.name.split(' ')[0] + '! 👋';
    if (h1 && /Progress Journey/.test(h1.textContent)) h1.textContent = '📊 Progress Journey ' + ses.name.split(' ')[0];
    $all('main header div.rounded-full, aside div.rounded-full').forEach(function (d) {
      if (d.textContent.trim() === 'AR') { d.textContent = ses.initials; d.style.background = color; }
    });
    // Halaman rancangan awal memakai Arya/Pak Faris sebagai placeholder.
    // Pada akun nyata, semua salinan identitas itu mengikuti profil dan pairing.
    if (PAGE.indexOf('kpi-leaderboard') !== 0) {
      var firstName = displayName.trim().split(/\s+/)[0] || displayName;
      var mentorProfile = (AUTH.profilesByNumber[myMenteeId()] || {}).mentor_id;
      mentorProfile = mentorProfile && AUTH.profilesById[mentorProfile];
      var mentorName = mentorProfile && mentorProfile.full_name;
      $all('main, aside').forEach(function (root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var nodes = [], node;
        while ((node = walker.nextNode())) nodes.push(node);
        nodes.forEach(function (textNode) {
          if (!textNode.parentElement || /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(textNode.parentElement.tagName)) return;
          var value = textNode.nodeValue;
          value = value.replace(/Arya Ramadhan/g, displayName).replace(/\bArya\b/g, firstName);
          if (mentorName) value = value.replace(/Bapak Faris|Pak Faris/g, mentorName);
          textNode.nodeValue = value;
        });
      });
      $all('main .rounded-full, aside .rounded-full').forEach(function (avatar) {
        if (avatar.textContent.trim() === 'AR') { avatar.textContent = displayInitials; avatar.style.background = color; }
        if (mentorProfile && /^(BF|PF)$/.test(avatar.textContent.trim())) { avatar.textContent = mentorProfile.initials || initialsOf(mentorName); avatar.style.background = '#1a5f4f'; }
      });
      document.title = document.title.replace(/Arya Ramadhan|Arya/g, displayName);
    }
    // leaderboard: baris "(← Kamu)" mengikuti akun yang login
    var meRow = byId('lb-row-arya');
    if (meRow) {
      $all('p', meRow).forEach(function (p) {
        if (/Arya Ramadhan/.test(p.textContent)) p.innerHTML = esc(ses.name) + ' <span class="text-[#1a5f4f] text-[10px]">(← Kamu)</span>';
      });
      var av = $('div.rounded-full', meRow);
      if (av) { av.textContent = ses.initials; av.style.background = color; }
    }
    var posBanner = byId('my-position');
    if (posBanner) $all('p', posBanner).forEach(function (p) {
      if (/Arya Ramadhan/.test(p.textContent)) p.textContent = ses.name + ' — Ranking #8';
    });
  }

  function showConnBadge() {
    if (!IS_APP_PAGE) return;
    if (document.querySelector('.ftg-conn')) return;
    var b = document.createElement('div');
    b.className = 'ftg-conn';
    b.style.cssText =
      (sb ? 'background:rgba(34,197,94,.14);color:#22c55e;' : 'background:rgba(148,163,184,.14);color:#94a3b8;');
    b.textContent = sb ? '● Live — tersinkron server' : '○ Offline — data lokal';
    var aside = document.querySelector('aside[data-design-id]');
    if (aside) aside.appendChild(b);
    else { b.classList.add('ftg-conn-floating'); document.body.appendChild(b); }
  }

  /* ---------- Helpers ---------- */
  function $(sel, root) { try{return (root || document).querySelector(sel);}catch(error){console.warn('Selector UI tidak valid:',sel);return null;} }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function byId(prefix) { return $('[data-design-id^="' + prefix + '"]'); }
  function wordCount(t) { return (t || '').trim() ? (t || '').trim().split(/\s+/).length : 0; }
  function esc(t) { var d = document.createElement('div'); d.textContent = t || ''; return d.innerHTML; }
  function todayStr() {
    return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---------- Toast ---------- */
  var toastWrap, LAST_TOAST = { message:'', at:0 };
  function toast(msg, icon) {
    msg=String(msg||'');
    if(msg===LAST_TOAST.message&&Date.now()-LAST_TOAST.at<1200)return;
    LAST_TOAST={message:msg,at:Date.now()};
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'ftg-toast-wrap';
      toastWrap.setAttribute('aria-live', 'polite');
      toastWrap.setAttribute('aria-relevant', 'additions');
      toastWrap.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastWrap);
    }
    var el = document.createElement('div');
    var isError = /⚠|❌|error|gagal|tidak berhasil|terputus|berakhir/i.test(String(icon || '') + ' ' + msg);
    el.className = 'ftg-toast' + (isError ? ' is-error' : '');
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.innerHTML = '<span class="ftg-toast-icon" aria-hidden="true">' + (icon || '✅') + '</span><span class="ftg-toast-message">' + esc(msg) + '</span><button type="button" class="ftg-toast-close" aria-label="Tutup notifikasi"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';
    toastWrap.appendChild(el);
    var removeTimer;
    function removeToast() {
      clearTimeout(removeTimer);
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 260);
    }
    $('.ftg-toast-close', el).addEventListener('click', removeToast);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    removeTimer = setTimeout(removeToast, isError ? 8000 : 5000);
  }

  /* ---------- Modal ---------- */
  var MODAL_STACK = [];
  function syncModalLayers() {
    var top = MODAL_STACK.length ? MODAL_STACK[MODAL_STACK.length - 1] : null;
    $all('.ftg-modal-ov').forEach(function (overlay) {
      var active = top && top.overlay === overlay;
      overlay.toggleAttribute('inert', !active);
      overlay.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    $all('body > :not(.ftg-modal-ov):not(.ftg-toast-wrap):not(.ftg-operation-loading)').forEach(function (node) {
      node.toggleAttribute('inert', !!top);
    });
    document.body.classList.toggle('ftg-modal-open', !!top);
  }
  function modal(html, onMount) {
    var opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    var ov = document.createElement('div');
    ov.className = 'ftg-modal-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9998;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);';
    var box = document.createElement('div');
    box.className = 'ftg-modal-box';
    box.style.cssText = 'background:#fff;border-radius:20px;max-width:480px;width:100%;padding:26px;box-shadow:0 24px 60px rgba(0,0,0,.3);max-height:88vh;overflow:auto;';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('tabindex', '-1');
    var content = document.createElement('div');
    content.className = 'ftg-modal-content';
    content.innerHTML = html;
    var modalClose = document.createElement('button');
    modalClose.type = 'button';
    modalClose.className = 'ftg-modal-close';
    modalClose.setAttribute('aria-label', 'Tutup dialog');
    modalClose.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
    var toolbar = document.createElement('div');
    toolbar.className = 'ftg-modal-toolbar';
    toolbar.appendChild(modalClose);
    box.appendChild(toolbar);
    box.appendChild(content);
    var heading = $('h1,h2,h3,h4', content);
    if (heading) {
      if (!heading.id) heading.id = 'ftg-modal-title-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      box.setAttribute('aria-labelledby', heading.id);
    } else box.setAttribute('aria-label', 'Dialog FTG Fellowship');
    ov.appendChild(box);
    var closed = false, detached = false;
    var record = { overlay: ov, box: box, opener: opener };
    function focusables() {
      return $all('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', box).filter(function (el) {
        return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      });
    }
    function cleanupLayer(restoreFocus) {
      var index = MODAL_STACK.indexOf(record);
      if (index >= 0) MODAL_STACK.splice(index, 1);
      document.removeEventListener('keydown', onKeydown, true);
      syncModalLayers();
      if (restoreFocus && opener && document.contains(opener) && typeof opener.focus === 'function') setTimeout(function () { opener.focus(); }, 0);
    }
    function onKeydown(event) {
      if (!MODAL_STACK.length || MODAL_STACK[MODAL_STACK.length - 1] !== record) return;
      if (event.key === 'Escape') { event.preventDefault(); shut(); return; }
      if (event.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) { event.preventDefault(); box.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    function shut() {
      if (closed) return;
      closed = true;
      cleanupLayer(true);
      if (detached) { box.remove(); return; }
      ov.classList.add('is-closing');
      ov.classList.remove('is-visible');
      setTimeout(function () { box.remove(); ov.remove(); }, 210);
    }
    function detach() {
      if (detached || closed) return;
      detached = true;
      cleanupLayer(false);
      ov.remove();
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) shut(); });
    modalClose.addEventListener('click', shut);
    document.body.appendChild(ov);
    MODAL_STACK.push(record);
    document.addEventListener('keydown', onKeydown, true);
    syncModalLayers();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.classList.add('is-visible'); });
    });
    var eventStart=$('#eventStart',box),eventEnd=$('#eventEnd',box);
    if(eventStart&&!eventStart.value){var nextHour=new Date();nextHour.setMinutes(0,0,0);nextHour.setHours(nextHour.getHours()+1);eventStart.value=localDateTimeValue(nextHour);if(eventEnd&&!eventEnd.value)eventEnd.value=localDateTimeValue(new Date(nextHour.getTime()+3600000));eventStart.setAttribute('aria-label','Tanggal dan jam mulai');if(eventEnd)eventEnd.setAttribute('aria-label','Tanggal dan jam selesai');eventStart.addEventListener('change',function(){var selected=new Date(eventStart.value);if(eventEnd&&!isNaN(selected))eventEnd.value=localDateTimeValue(new Date(selected.getTime()+3600000));});}
    if (onMount) onMount(box, shut);
    if(typeof applyLanguage==='function')applyLanguage(box);
    requestAnimationFrame(function () {
      var initial = $('[autofocus]', box) || focusables().filter(function (el) { return !el.classList.contains('ftg-modal-close'); })[0] || modalClose;
      if (initial && typeof initial.focus === 'function') initial.focus(); else box.focus();
    });
    return { close: shut, detach: detach, box: box, content: content, overlay: ov };
  }

  /* ---------- Sidebar navigation wiring ---------- */
  var MENTEE_ROUTES = {
    'Dashboard': 'mentee-dashboard.html',
    'Design Thinking': 'design-thinking-module.html',
    'Workshop Library': 'workshop-library.html',
    'Tugas Saya': 'assignment-submission.html',
    'Progress Saya': 'progress-tracker.html',
    'Jurnal Saya': 'jurnal.html',
    'Feedback Mentor': 'mentor-feedback.html',
    'Leaderboard': 'kpi-leaderboard.html',
    'Opening Ceremony': 'opening-ceremony.html',
    'Closing Ceremony': 'closing-ceremony.html'
  };
  var IS_MENTOR_PAGE = /^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE);

  // Beri tautan navigasi tujuan nyata secepat DOM siap. Fungsi ini hanya
  // mengisi href, sehingga tidak menggandakan aksi modal di wireNav().
  function primeNavHrefs() {
    var ses = mySession();
    var role = ses && ses.role;
    $all('a[href="#"]').forEach(function (a) {
      var txt = a.textContent.replace(/\s+/g, ' ').trim();
      var target = '';
      if (txt === 'Dashboard') target = role === 'mentor' || IS_MENTOR_PAGE ? 'mentor-dashboard.html' : (role === 'admin' ? 'admin-dashboard.html' : 'mentee-dashboard.html');
      else if (MENTEE_ROUTES[txt]) target = MENTEE_ROUTES[txt];
      else if (/^Buka Canvas/.test(txt) || txt === 'Lanjut Belajar' || txt === 'Mulai') target = 'design-thinking-module.html';
      else if (/^Lihat semua badge/.test(txt)) target = 'progress-tracker.html';
      else if (txt === 'Kumpulkan Sekarang') target = 'assignment-submission.html';
      else if (txt === '' && PAGE.indexOf('design-thinking') === 0) target = 'mentee-dashboard.html';
      if (target) a.href = target;
    });
  }

  function wireNav() {
    if (!document.body.getAttribute('data-ftg-logout-wire')) {
      document.body.setAttribute('data-ftg-logout-wire', '1');
      document.addEventListener('click', function (e) {
        var logoutLink = e.target.closest && e.target.closest('[data-ftg-logout="1"]');
        if (!logoutLink) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        secureLogout();
      }, true);
    }
    $all('a').forEach(function (a) {
      var txt = a.textContent.replace(/\s+/g, ' ').trim();
      var href = a.getAttribute('href');
      if (/^Keluar$/.test(txt)) {
        a.href = 'login.html';
        if (!a.getAttribute('data-ftg-logout')) {
          a.setAttribute('data-ftg-logout', '1');
          a.addEventListener('click', function (e) {
            e.preventDefault();
            secureLogout();
          });
        }
        return;
      }
      if (href && href !== '#') return; // sudah punya tujuan
      if (IS_MENTOR_PAGE) {
        if (txt === 'Dashboard') { a.href = 'mentor-dashboard.html'; return; }
        if (txt === 'Leaderboard') { a.href = 'kpi-leaderboard.html'; return; }
        if (/^Mentee Saya/.test(txt)) { hookScroll(a, 'mentee-list'); return; }
        if (/^Tugas & Review/.test(txt)) { hookScroll(a, 'pending-reviews'); return; }
        if (txt === 'Berikan Feedback') {
          a.addEventListener('click', function (e) { e.preventDefault(); setActiveNav(a); pickMenteeModal('Berikan Feedback ke'); });
          return;
        }
        if (txt === 'Progress Grup') { hookScroll(a, 'group-progress'); return; }
        if (txt === 'Kirim Pesan Grup') { a.addEventListener('click', groupMessageModal); return; }
      }
      if (MENTEE_ROUTES[txt]) { a.href = MENTEE_ROUTES[txt]; return; }
      if (txt === 'Buka Canvas →' || txt === 'Lanjut Belajar') a.href = 'design-thinking-module.html';
      else if (txt === 'Lihat semua badge →') a.href = 'progress-tracker.html';
      else if (txt === 'Kumpulkan Sekarang') a.href = 'assignment-submission.html';
      else if (txt === 'Mulai') a.href = 'design-thinking-module.html';
    });

    // Menu "Jurnal Saya" ditambahkan otomatis di semua halaman mentee lama
    var ses0 = mySession();
    var nav0 = $('aside nav');
    if (nav0 && ses0 && ses0.role === 'mentee' && !$all('a', nav0).some(function (a) { return /Jurnal Saya/.test(a.textContent); })) {
      var fbLink = $all('a', nav0).filter(function (a) { return /Feedback Mentor/.test(a.textContent); })[0];
      if (fbLink) {
        var j = document.createElement('a');
        j.href = 'jurnal.html';
        j.className = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium';
        j.innerHTML = '<i class="fa-solid fa-book w-4 text-center"></i> Jurnal Saya';
        fbLink.parentElement.insertBefore(j, fbLink);
      }
    }

    // Tombol "Keluar" di sidebar (sekali saja — personalize() mungkin sudah menambahkannya)
    var nav = $('aside nav');
    if (nav && !$all('a', nav).some(function (a) { return /Keluar/.test(a.textContent); })) {
      var out = document.createElement('a');
      out.href = 'login.html';
      out.className = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-sm font-medium mt-4';
      out.innerHTML = '<i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Keluar';
      out.setAttribute('data-ftg-logout', '1');
      out.addEventListener('click', function (e) {
        e.preventDefault();
        secureLogout();
      });
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
      if (!t) return;
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      flash(t);
      setActiveNav(a);
    });
  }
  /* kedip sorot supaya klik terasa jelas */
  function flash(el) {
    el.style.transition = 'box-shadow .25s ease, transform .25s ease';
    el.style.boxShadow = '0 0 0 3px rgba(249,115,22,.55)';
    el.style.transform = 'scale(1.008)';
    setTimeout(function () { el.style.boxShadow = ''; el.style.transform = ''; }, 900);
  }
  function setActiveNav(a) {
    var nav = a.closest('nav');
    if (!nav) return;
    $all('a', nav).forEach(function (x) {
      x.className = x.className.replace('bg-[#1a5f4f] text-white', 'text-white/60 hover:text-white hover:bg-white/10');
    });
    a.className = a.className.replace('text-white/60 hover:text-white hover:bg-white/10', 'bg-[#1a5f4f] text-white');
  }

  /* ---------- Notifikasi nyata (dari kejadian di platform) ---------- */
  function pushEvent(icon, text, forRole, href) {
    S.events.unshift({ icon: icon, text: text, forRole: forRole, href: href || '', at: new Date().toISOString(), read: false });
    if (S.events.length > 25) S.events.length = 25;
  }
  /* event untuk mentee tertentu (dipakai mentor/panitia) */
  function pushEventTo(menteeId, icon, text, forRole, href) {
    var st = mstate(menteeId);
    st.events.unshift({ icon: icon, text: text, forRole: forRole, href: href || '', at: new Date().toISOString(), read: false });
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
  function secureLogout() {
    clearGoogleSession();
    try { sessionStorage.removeItem('ftgAuthWarm'); } catch (e) {}
    try { localStorage.removeItem('ftgSession'); } catch (e) {}
    var finished = false;
    function finishLogout() {
      if (finished) return;
      finished = true;
      try {
        Object.keys(localStorage).forEach(function (key) {
          if (/^sb-.*-auth-token$/.test(key)) localStorage.removeItem(key);
        });
      } catch (e) {}
      location.replace('login.html');
    }
    if (sb) {
      var fallback = setTimeout(finishLogout, 1200);
      sb.auth.signOut({ scope: 'local' }).then(function () { clearTimeout(fallback); finishLogout(); }).catch(function () { clearTimeout(fallback); finishLogout(); });
    } else finishLogout();
  }
  function ensureSecureSession() {
    if (!sb || !IS_APP_PAGE) return Promise.resolve(!IS_APP_PAGE);
    return sb.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session) throw new Error('Sesi login sudah berakhir');
      AUTH.user = session.user; AUTH.accessToken = session.access_token;
      return sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    }).then(function (result) {
      if (result.error || !result.data || result.data.status !== 'active') throw new Error('Profil tidak aktif');
      AUTH.profile = Object.assign({}, result.data, {
        bio:(AUTH.user.user_metadata && AUTH.user.user_metadata.bio) || '',
        avatar_url:(AUTH.user.user_metadata && AUTH.user.user_metadata.avatar_url) || ''
      });
      var mentorApplication = AUTH.user && AUTH.user.user_metadata && AUTH.user.user_metadata.mentor_application;
      var mentorComplete = mentorApplication && mentorApplication.commitment_confirmed && mentorApplication.phone && mentorApplication.job_title && mentorApplication.company_or_institution && mentorApplication.years_of_experience && Array.isArray(mentorApplication.expertise_tags) && mentorApplication.expertise_tags.length && String(mentorApplication.bio || '').length >= 40 && mentorApplication.availability_hours && mentorApplication.mentoring_format && String(mentorApplication.motivation || '').length >= 60;
      if (AUTH.profile.role === 'mentor' && !mentorComplete) {
        return apiRequest('/api/program', { method:'POST', body:JSON.stringify({ action:'prepare_incomplete_mentor' }) }).then(function () { location.replace('profile-setup.html'); return false; });
      }
      var expectedRole = PAGE.indexOf('admin-') === 0 ? 'admin' : (/^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE) ? 'mentor' : (/^(mentee-dashboard|design-thinking|assignment-submission|progress-tracker|mentor-feedback|jurnal)/.test(PAGE) ? 'mentee' : ''));
      if (PAGE.indexOf('workshop-library') === 0 && !/^(mentee|mentor)$/.test(AUTH.profile.role)) expectedRole = 'mentee';
      if (expectedRole && AUTH.profile.role !== expectedRole) {
        var safeHome = AUTH.profile.role === 'admin' ? 'admin-dashboard.html' : (AUTH.profile.role === 'mentor' ? 'mentor-dashboard.html' : 'mentee-dashboard.html');
        location.replace(safeHome); return false;
      }
      var local = mySession();
      if (!local || local.id !== AUTH.user.id || local.role !== AUTH.profile.role || local.name !== AUTH.profile.full_name || local.initials !== AUTH.profile.initials || local.path !== AUTH.profile.path || Number(local.menteeId || 0) !== Number(AUTH.profile.mentee_number || 0) || local.mentorId !== AUTH.profile.mentor_id || local.cohortId !== AUTH.profile.cohort_id) {
        localStorage.setItem('ftgSession', JSON.stringify({ id: AUTH.user.id, email: AUTH.user.email, name: AUTH.profile.full_name, role: AUTH.profile.role, initials: AUTH.profile.initials, path: AUTH.profile.path, menteeId: AUTH.profile.mentee_number, cohortId: AUTH.profile.cohort_id, mentorId: AUTH.profile.mentor_id, at: new Date().toISOString() }));
      }
      // Profil server adalah sumber kebenaran. Personalisasi ulang agar nama
      // mentor lama dari cache tidak tertinggal di header atau sidebar.
      personalize();
      try { sessionStorage.setItem('ftgAuthWarm', AUTH.profile.role + ':' + AUTH.user.id); } catch (e) {}
      if (AUTH.profile.role === 'admin') {
        // Setiap modul Fasil memuat API-nya sendiri. Data pendukung boleh
        // menyusul di latar agar perpindahan halaman tidak tertahan.
        loadStructuredData().then(function () {
          document.dispatchEvent(new CustomEvent('ftg:structured-ready'));
        }).catch(reportError);
        return true;
      }
      return loadStructuredData().then(function () { return true; });
    }).catch(function (error) {
      console.warn('FTG auth:', error.message); secureLogout(); return false;
    });
  }

  function loadStructuredData() {
    if (!sb || !AUTH.profile) return Promise.resolve(false);
    return Promise.all([
      sb.from('profiles').select('id,email,full_name,role,initials,path,cohort_id,mentee_number,mentor_id,status,warning_level,absence_count,last_active_at,graduation_eligible,notification_preferences,updated_at'),
      sb.from('program_settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('cohorts').select('*').order('created_at', { ascending: false }),
      apiRequest('/api/program', { method:'POST', body:JSON.stringify({ action:'profile_context' }) }).catch(function () { return null; })
    ]).then(function (results) {
      var p = results[0], settings = results[1] && results[1].data, cohorts = results[2] && results[2].data, context = results[3];
      if (settings) Object.assign(G.programSettings, {
        programName: settings.program_name, currentMonth: settings.current_month, currentWeek: settings.current_week,
        passingScore: settings.passing_score, activePhase: settings.active_phase || 'DEFINE',
        completionRequirement: settings.completion_requirement || 80, attendanceRequirement: settings.attendance_requirement || 80,
        qualityRequirement: settings.quality_requirement || settings.passing_score || 75,
        featureFlags: settings.feature_flags || {}, kpiWeights: settings.kpi_weights || {}, rubricTemplates: settings.rubric_templates || []
      });
      if (cohorts && cohorts.length) G.cohorts = cohorts.map(function (c) { return { id:c.id, name:c.name, status:c.status, startDate:c.start_date || '', endDate:c.end_date || '' }; });
      (p.data || []).forEach(function (x) {
        x = hydrateProfileRecord(x);
        AUTH.profilesById[x.id] = x;
        if (x.mentee_number) {
          var number = Number(x.mentee_number);
          AUTH.profilesByNumber[number] = x;
          MENTEES[number] = Object.assign({}, MENTEES[number] || {}, { name:x.full_name, initials:x.initials || initialsOf(x.full_name), path:x.path || 'Career Path', email:x.email, color:(MENTEES[number] || {}).color || COLORS[number % COLORS.length], baseProgress:(MENTEES[number] || {}).baseProgress || 5 });
          if (x.mentor_id) G.pairings[number] = x.mentor_id;
        }
      });
      if (context && context.profile) {
        AUTH.profilesById[context.profile.id] = context.profile;
        if (context.profile.mentee_number) AUTH.profilesByNumber[Number(context.profile.mentee_number)] = context.profile;
      }
      if (context && context.mentor) AUTH.profilesById[context.mentor.id] = context.mentor;
      if (AUTH.profile.mentee_number) AUTH.profilesByNumber[AUTH.profile.mentee_number] = AUTH.profile;
      personalize();
      var taskQuery = AUTH.profile.role === 'mentee'
        ? sb.from('assignment_targets').select('assignment_id,assignments(*)').eq('mentee_id', AUTH.user.id)
        : sb.from('assignments').select('*,assignment_targets(mentee_id)').eq('is_template', false);
      return taskQuery;
    }).then(function (tasksResult) {
      if (tasksResult.error) return false;
      var rows = AUTH.profile.role === 'mentee' ? (tasksResult.data || []).map(function (r) { var a = r.assignments; if (a) a.assignment_targets = [{ mentee_id: AUTH.user.id }]; return a; }).filter(Boolean) : (tasksResult.data || []);
      rows.forEach(function (a) {
        var targets = (a.assignment_targets || []).map(function (t) { var p = AUTH.profilesById[t.mentee_id]; return p && p.mentee_number; }).filter(Boolean);
        var task = assignmentFor(a.id);
        if (!task) { task = { id: a.id }; mentorAssignments().push(task); }
        Object.assign(task, { title: a.title, description: a.description, deadline: a.deadline || '', points: a.points, referenceLink: a.reference_link || '', checklist: a.checklist || [], rubric: a.rubric || [], targets: targets.length ? targets : (AUTH.profile.mentee_number ? [AUTH.profile.mentee_number] : []), active: a.status !== 'archived', createdAt: a.created_at, updatedAt: a.updated_at, structured: true });
      });
      return Promise.all([
        sb.from('submissions').select('*,reviews(*),task_discussions(*)'),
        sb.from('submission_versions').select('*').order('version_number', { ascending: true }),
        sb.from('review_history').select('*').order('created_at', { ascending: true })
      ]);
    }).then(function (subResults) {
      var subResult = subResults && subResults[0], versionResult = subResults && subResults[1], historyResult = subResults && subResults[2];
      if (!subResult || subResult.error) return false;
      var versionsBySubmission = {}, historyBySubmission = {};
      ((versionResult && versionResult.data) || []).forEach(function (v) {
        (versionsBySubmission[v.submission_id] = versionsBySubmission[v.submission_id] || []).push({ number:v.version_number, text:v.text_content || '', link:v.link_url || '', files:v.files || [], at:v.created_at });
      });
      ((historyResult && historyResult.data) || []).forEach(function (h) {
        (historyBySubmission[h.submission_id] = historyBySubmission[h.submission_id] || []).push({ version:h.submission_version, score:h.score, decision:h.decision, text:h.feedback, rubricScores:h.rubric_scores || [], at:h.created_at, by:(AUTH.profilesById[h.reviewer_id] || {}).full_name || 'Mentor' });
      });
      (subResult.data || []).forEach(function (row) {
        var p = AUTH.profilesById[row.mentee_id]; if (!p || !p.mentee_number) return;
        var review = row.status === 'submitted' ? null : (row.reviews && row.reviews[0]);
        var reviewer = review && AUTH.profilesById[review.reviewer_id];
        mstate(p.mentee_number).assignmentSubmissions[row.assignment_id] = { text: row.text_content || '', link: row.link_url || '', files: row.files || [], checks: row.checklist_state || {}, submittedAt: row.submitted_at, status: row.status, versions: versionsBySubmission[row.id] || [], reviewHistory: historyBySubmission[row.id] || [], discussion: (row.task_discussions || []).map(function (d) { var author = AUTH.profilesById[d.author_id]; return { from: author ? author.full_name : 'Pengguna', role: author ? author.role : '', text: d.message, at: d.created_at }; }), review: review ? { score: review.score, text: review.feedback, decision: review.decision, rubricScores: review.rubric_scores || [], at: review.updated_at, by: reviewer ? reviewer.full_name : 'Mentor' } : null };
      });
      persistLocal(); return true;
    });
  }

  function structuredAssignmentSave(task, rethrow) {
    if (!sb || !AUTH.user || !AUTH.profile || !['mentor', 'admin'].includes(AUTH.profile.role)) return Promise.resolve();
    return sb.from('assignments').upsert({ id: task.id, cohort_id: AUTH.profile.cohort_id || null, title: task.title, description: task.description, deadline: task.deadline ? deadlineDate(task.deadline).toISOString() : null, points: task.points || 0, reference_link: task.referenceLink || null, checklist: task.checklist || [], rubric: task.rubric || [], status: task.active === false ? 'archived' : 'published', is_template: false, created_by: AUTH.user.id, updated_at: new Date().toISOString() }).then(function (r) {
      if (r.error) throw r.error;
      var ids = (task.targets || []).map(function (n) { return AUTH.profilesByNumber[n] && AUTH.profilesByNumber[n].id; }).filter(Boolean);
      return sb.from('assignment_targets').delete().eq('assignment_id', task.id).then(function (targetDelete) {
        if (targetDelete.error) throw targetDelete.error;
        if (!ids.length) return null;
        return sb.from('assignment_targets').insert(ids.map(function (id) { return { assignment_id: task.id, mentee_id: id }; })).then(function (targetInsert) {
          if (targetInsert.error) throw targetInsert.error;
          return targetInsert;
        });
      });
    }).then(function () {
      var notices = (task.targets || []).map(function (n) { var p = AUTH.profilesByNumber[n]; return p && { user_id: p.id, type: 'assignment', title: 'Tugas baru', body: task.title + ' · ' + dueLabel(task.deadline), href: 'mentee-dashboard.html#tugas', delivery: { in_app: 'sent' } }; }).filter(Boolean);
      if (!notices.length) return { notificationSent: false };
      return apiRequest('/api/notifications', { method:'POST', body:JSON.stringify({ notifications:notices }) }).then(function () {
        return { notificationSent: true };
      }).catch(function (error) {
        reportError(error);
        return { notificationSent: false, notificationError: error };
      });
    }).catch(function (error) {
      reportError(error);
      if (rethrow) throw error;
      return null;
    });
  }
  function structuredSubmissionSave(task, sub, createVersion) {
    if (!sb || !AUTH.user || AUTH.profile.role !== 'mentee') return Promise.resolve();
    var id = task.id + ':' + AUTH.user.id;
    return sb.from('submissions').upsert({ id: id, assignment_id: task.id, mentee_id: AUTH.user.id, text_content: sub.text || '', link_url: sub.link || null, files: sub.files || [], checklist_state: sub.checks || {}, status: sub.submittedAt ? 'submitted' : 'draft', submitted_at: sub.submittedAt || null, updated_at: new Date().toISOString() }).then(function (r) {
      if (r.error) throw r.error;
      if (createVersion && sub.submittedAt) {
        var versionNumber = (sub.versions || []).reduce(function (max, v) { return Math.max(max, Number(v.number) || 0); }, 0) + 1;
        return sb.from('submission_versions').insert({ submission_id: id, version_number: versionNumber, text_content: sub.text || '', link_url: sub.link || null, files: sub.files || [] }).then(function (vr) {
          if (vr.error) throw vr.error;
          sub.versions.push({ number:versionNumber, text:sub.text || '', link:sub.link || '', files:JSON.parse(JSON.stringify(sub.files || [])), at:new Date().toISOString() });
        });
      }
    }).catch(reportError);
  }
  function structuredReviewSave(menteeId, task, sub) {
    if (!sb || !AUTH.user || !sub.review) return Promise.resolve();
    var p = AUTH.profilesByNumber[menteeId]; if (!p) return Promise.resolve();
    var sid = task.id + ':' + p.id;
    var versionNumber = (sub.versions || []).reduce(function (max, v) { return Math.max(max, Number(v.number) || 0); }, 0) || 1;
    var history = { submission_id:sid, submission_version:versionNumber, reviewer_id:AUTH.user.id, score:sub.review.score, decision:sub.review.decision || 'approved', feedback:sub.review.text, rubric_scores:sub.review.rubricScores || [] };
    return sb.from('review_history').insert(history).then(function (hr) {
      if (hr.error) throw hr.error;
      sub.reviewHistory = sub.reviewHistory || [];
      sub.reviewHistory.push({ version:versionNumber, score:history.score, decision:history.decision, text:history.feedback, rubricScores:history.rubric_scores, at:new Date().toISOString(), by:(mySession() || {}).name || 'Mentor' });
      return sb.from('reviews').upsert({ submission_id: sid, reviewer_id: AUTH.user.id, score: sub.review.score, decision: sub.review.decision || 'approved', feedback: sub.review.text, rubric_scores: sub.review.rubricScores || [], updated_at: new Date().toISOString() }, { onConflict: 'submission_id' });
    }).then(function (r) { if (r && r.error) throw r.error; return sb.from('submissions').update({ status: sub.review.decision === 'revision' ? 'revision' : 'approved' }).eq('id', sid); }).then(function () { return apiRequest('/api/notifications', { method:'POST', body:JSON.stringify({ user_id:p.id, type:'review', title:sub.review.decision === 'revision' ? 'Tugas perlu direvisi' : 'Tugas sudah dinilai', body:task.title, href:'mentee-dashboard.html#tugas' }) }); }).catch(reportError);
  }
  function structuredDiscussionSave(menteeId, task, text) {
    if (!sb || !AUTH.user) return Promise.resolve();
    var p = AUTH.profilesByNumber[menteeId]; if (!p) return Promise.resolve();
    return sb.from('task_discussions').insert({ submission_id: task.id + ':' + p.id, author_id: AUTH.user.id, message: text }).then(function (r) { if (r.error) throw r.error; }).catch(reportError);
  }
  function structuredSessionSchedule(menteeNumber, session) {
    if (!sb || !AUTH.user) return Promise.resolve(); var p=AUTH.profilesByNumber[menteeNumber]; if(!p)return Promise.resolve();
    return sb.from('mentor_sessions').insert({mentor_id:AUTH.user.id,mentee_id:p.id,scheduled_at:session.date+'T'+session.time+':00+08:00',topic:session.note||'',status:'scheduled'}).select('id').maybeSingle().then(function(r){if(r.error)throw r.error;if(r.data)session.dbId=r.data.id;return apiRequest('/api/notifications',{method:'POST',body:JSON.stringify({user_id:p.id,type:'session',title:'Undangan sesi 1-on-1',body:session.date+' '+session.time,href:'mentee-dashboard.html'})});}).catch(reportError);
  }
  function structuredSessionUpdate(menteeNumber, session) {
    if(!sb||!session||!session.dbId)return Promise.resolve();
    return sb.from('mentor_sessions').update({status:session.status,shared_summary:session.outcome||null,action_items:session.actionItems||[],attendance:session.attendance||{},completed_at:session.completedAt||null,updated_at:new Date().toISOString()}).eq('id',session.dbId).then(function(r){if(r.error)throw r.error;}).catch(reportError);
  }
  var LAST_VISIBLE_ERROR = { message:'', at:0 };
  function visibleActionError(error) {
    var message=error&&error.message?error.message:String(error||'Tindakan tidak berhasil. Silakan coba lagi.');
    if(/failed to fetch|networkerror|load failed/i.test(message))message='Koneksi ke server terputus. Periksa internet lalu coba kembali.';
    if(/abort|terlalu lama|timeout/i.test(message))message='Server terlalu lama merespons. Data belum diubah; silakan coba kembali.';
    if(message===LAST_VISIBLE_ERROR.message&&Date.now()-LAST_VISIBLE_ERROR.at<2500)return;
    LAST_VISIBLE_ERROR={message:message,at:Date.now()};
    toast(message,'⚠️');
  }
  function reportError(error) {
    console.error(error);
    visibleActionError(error);
    var payload = { level: 'error', source: PAGE, message: error && error.message || String(error), context: { role: myRole() } };
    fetch('/api/errors', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, AUTH.accessToken ? { Authorization: 'Bearer ' + AUTH.accessToken } : {}), body: JSON.stringify(payload) }).catch(function () {});
  }
  function addAudit(action, detail, target) {
    G.auditLog = Array.isArray(G.auditLog) ? G.auditLog : [];
    var me = mySession() || {};
    G.auditLog.unshift({
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      action: action, detail: detail || '', target: target || '',
      role: me.role || myRole() || 'system', actor: me.name || me.email || 'Sistem',
      at: new Date().toISOString()
    });
    if (G.auditLog.length > 250) G.auditLog.length = 250;
  }
  function assignmentStatus(task, sub) {
    if (task.active === false) return { key: 'archived', label: 'Diarsipkan', color: '#64748b' };
    if (sub && sub.review && sub.review.decision === 'revision') return { key: 'revision', label: 'Perlu Revisi', color: '#ef4444' };
    if (sub && sub.review) return { key: 'approved', label: 'Selesai · ' + sub.review.score + '/100', color: '#16a34a' };
    if (sub && sub.submittedAt) return { key: 'review', label: 'Menunggu Review', color: '#8b5cf6' };
    if (sub && (sub.text || sub.link || (sub.files || []).length)) return { key: 'draft', label: 'Draft Tersimpan', color: '#0ea5e9' };
    if (task.deadline && deadlineDate(task.deadline) < new Date()) return { key: 'late', label: 'Terlambat', color: '#ef4444' };
    return { key: 'todo', label: 'Belum Dikerjakan', color: '#f97316' };
  }
  function runAutomatedReminders() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var allowed = (G.programSettings && G.programSettings.reminderDays) || [3, 1, 0];
    var changed = false;
    mentorAssignments().forEach(function (task) {
      if (task.active === false || !task.deadline) return;
      var due = deadlineDate(task.deadline);
      due.setHours(0, 0, 0, 0);
      var days = Math.round((due - today) / 86400000);
      if (allowed.indexOf(days) === -1) return;
      (task.targets || []).forEach(function (id) {
        var sub = taskSubmission(id, task.id);
        if (sub && sub.submittedAt && !(sub.review && sub.review.decision === 'revision')) return;
        var key = task.id + ':' + id + ':' + task.deadline + ':' + days;
        if (G.reminderLedger[key]) return;
        var when = days === 0 ? 'hari ini' : (days + ' hari lagi');
        pushEventTo(id, '⏰', 'Pengingat: "' + task.title + '" deadline ' + when, 'mentee', 'mentee-dashboard.html#tugas');
        G.reminderLedger[key] = new Date().toISOString(); changed = true;
      });
    });
    if (changed) { addAudit('reminder.auto', 'Pengingat deadline otomatis dikirim'); saveState(); }
  }
  function myEvents() {
    var role = myRole() || (IS_MENTOR_PAGE ? 'mentor' : 'mentee');
    if (role === 'mentor' || role === 'admin') return allEvents(role === 'admin' ? null : 'mentor');
    return S.events.filter(function (e) { return e.forRole === role || e.forRole === 'all'; });
  }
  function openNotificationCenter() {
    var role = myRole(), source = myEvents();
    function show(items) {
      modal('<div style="display:flex;justify-content:space-between;align-items:center"><div><h3 style="font-weight:800;color:#1e293b">🔔 Pusat Notifikasi</h3><p style="font-size:10px;color:#64748b">Tugas, deadline, feedback, dan sesi dalam satu tempat.</p></div><select id="notifFilter" style="border:1px solid #cbd5e1;border-radius:9px;padding:7px;background:#fff;font-size:10px"><option value="">Semua</option><option value="assignment">Tugas</option><option value="deadline">Deadline</option><option value="review">Feedback</option><option value="session">Sesi</option></select></div><div id="notifCenterRows" style="max-height:430px;overflow:auto;margin-top:12px"></div><label style="display:flex;gap:7px;align-items:center;font-size:10px;color:#64748b;margin-top:10px"><input id="notifDeadlinePref" type="checkbox" ' + ((AUTH.profile && AUTH.profile.notification_preferences && AUTH.profile.notification_preferences.deadline !== false) ? 'checked' : '') + '> Ingatkan deadline tugas</label>', function (box) {
        function render(filter) { var rows = items.filter(function (n) { return !filter || String(n.type || '').indexOf(filter) > -1; }); $('#notifCenterRows', box).innerHTML = rows.length ? rows.map(function (n) { return '<a href="' + esc(n.href || '#') + '" style="display:flex;gap:10px;padding:10px;border-bottom:1px solid #f1f5f9;text-decoration:none"><span>' + esc(n.icon || '🔔') + '</span><div><p style="font-size:11px;font-weight:800;color:#334155">' + esc(n.title || n.text || 'Notifikasi') + '</p><p style="font-size:10px;color:#64748b">' + esc(n.body || n.text || '') + '</p><p style="font-size:9px;color:#94a3b8">' + timeAgo(n.created_at || n.at) + '</p></div></a>'; }).join('') : '<p style="padding:24px;text-align:center;color:#94a3b8;font-size:11px">Tidak ada notifikasi pada kategori ini.</p>'; }
        render(''); $('#notifFilter', box).addEventListener('change', function () { render(this.value); });
        $('#notifDeadlinePref', box).addEventListener('change', function () { if (!AUTH.profile) return; var prefs = Object.assign({}, AUTH.profile.notification_preferences || {}, { deadline: this.checked }); AUTH.profile.notification_preferences = prefs; sb.from('profiles').update({ notification_preferences: prefs, updated_at: new Date().toISOString() }).eq('id', AUTH.user.id); });
      });
    }
    if (sb && AUTH.user && role !== 'mentor') sb.from('notifications').select('*').eq('user_id', AUTH.user.id).order('created_at', { ascending: false }).limit(100).then(function (r) { show((r.data || []).length ? r.data : source); });
    else show(source);
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
      dd.className = 'ftg-dd';
      dd.style.cssText = 'position:absolute;top:48px;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.15);width:300px;z-index:9990;overflow:hidden;';
      dd.innerHTML = '<p style="padding:12px 16px;font-weight:700;font-size:13px;color:#2c3e50;border-bottom:1px solid #f1f5f9">Notifikasi</p>' +
        (evs.length ? evs.slice(0, 6).map(function (n) {
          return '<div data-notif-href="' + esc(n.href || '') + '" style="padding:10px 16px;display:flex;gap:10px;border-bottom:1px solid #f8fafc;' + (n.read ? 'opacity:.6;' : '') + (n.href ? 'cursor:pointer;' : '') + '"><span>' + n.icon + '</span><div><p style="font-size:12px;color:#2c3e50;font-weight:600">' + esc(n.text) + '</p><p style="font-size:10px;color:#94a3b8">' + timeAgo(n.at) + (n.href ? ' · buka' : '') + '</p></div></div>';
        }).join('') : '<p style="padding:16px;font-size:12px;color:#94a3b8;text-align:center">Belum ada notifikasi baru</p>') + '<button id="open-notification-center" style="width:100%;border:0;background:#f8fafc;color:#1a5f4f;padding:10px;font-size:10px;font-weight:800;cursor:pointer">Lihat semua & atur preferensi</button>';
      btn.parentElement.style.position = 'relative';
      btn.parentElement.appendChild(dd);
      $('#open-notification-center', dd).addEventListener('click', function (event) { event.stopPropagation(); dd.remove(); dd = null; openNotificationCenter(); });
      $all('[data-notif-href]', dd).forEach(function (row) {
        row.addEventListener('click', function () {
          var href = row.getAttribute('data-notif-href');
          if (href && !/^javascript:/i.test(href)) location.href = href;
        });
      });
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
    // panel khusus mentor: target pribadi mentee + catatan pribadi (privat)
    var mentorExtras = '';
    if (me === 'mentor' && MENTEES[tid]) {
      var tgs = (mstate(tid).targets || []).filter(function (t) { return t.text; });
      if (tgs.length) {
        mentorExtras += '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:10px">' +
          '<p style="font-size:10px;font-weight:800;color:#8b5cf6;letter-spacing:.05em;margin-bottom:5px">🎯 TARGET PRIBADI ' + esc(MENTEES[tid].name.split(' ')[0].toUpperCase()) + ' MINGGU INI</p>' +
          tgs.map(function (t) {
            return '<p style="font-size:12px;color:' + (t.done ? '#16a34a' : '#475569') + ';margin-bottom:2px">' + (t.done ? '✅' : '⬜') + ' ' + esc(t.text) + (t.done ? '' : '') + '</p>';
          }).join('') + '</div>';
      }
      G.mentorNotes = G.mentorNotes || {};
      mentorExtras += '<details style="margin-bottom:10px"><summary style="font-size:11px;font-weight:700;color:#64748b;cursor:pointer;user-select:none">📝 Catatan pribadimu tentang ' + esc(MENTEES[tid].name.split(' ')[0]) + ' <span style="font-weight:400;opacity:.7">(hanya kamu yang bisa lihat)</span></summary>' +
        '<textarea id="mentorNote" rows="2" placeholder="cth: kurang responsif minggu ini, follow up Kamis..." style="width:100%;margin-top:6px;border:1px dashed #cbd5e1;border-radius:10px;padding:9px;font-size:12px;font-family:inherit;outline:none;resize:none;background:#fffbeb">' + esc(G.mentorNotes[tid] || '') + '</textarea></details>';
    }
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:2px">💬 Pesan — ' + esc(to) + '</h3>' +
      '<p style="font-size:11px;color:#64748b;margin-bottom:10px">' + (sb ? '● Terkirim real-time lewat server' : '○ Mode offline — tersimpan lokal') + '</p>' +
      mentorExtras +
      '<div id="chatBox" style="max-height:260px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:14px;padding:12px;margin-bottom:10px;background:#fafbfc">' + chatBubbles(tid) + '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<textarea id="msgTxt" rows="2" placeholder="Tulis pesanmu..." style="flex:1;border:1px solid #e2e8f0;border-radius:12px;padding:10px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="msgSend" style="background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:0 18px;border-radius:12px;border:0;cursor:pointer"><i class="fa-solid fa-paper-plane"></i></button></div>',
      function (box, close) {
        var chatBox = $('#chatBox', box);
        chatBox.scrollTop = chatBox.scrollHeight;
        // catatan pribadi mentor: autosave
        var noteTa = $('#mentorNote', box);
        if (noteTa) {
          var noteTimer;
          noteTa.addEventListener('input', function () {
            clearTimeout(noteTimer);
            noteTimer = setTimeout(function () {
              G.mentorNotes[tid] = noteTa.value;
              saveState();
              toast('Catatan pribadi tersimpan', '📝');
            }, 900);
          });
        }
        var ta = $('#msgTxt', box);
        function send() {
          var t = ta.value.trim();
          if (!t) { toast('Tulis pesan dulu ya', '✏️'); return; }
          var st = mstate(tid);
          st.messages.push({ from: me, fromName: ses.name || (me === 'mentor' ? 'Mentor' : MENTEES[tid].name), text: t, at: new Date().toISOString() });
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
  /* pilih mentee lalu buka chat/feedback dengannya */
  function pickMenteeModal(title) {
    var rows = '';
    for (var i = 1; i <= 5; i++) {
      var m = MENTEES[i], st = mstate(i);
      var badge = st.reviewW2 ? '<span style="color:#22c55e;font-size:10px;font-weight:700">✓ Dinilai</span>'
        : (st.submittedW2 ? '<span style="color:#8b5cf6;font-size:10px;font-weight:700">Perlu review</span>'
        : '<span style="color:#94a3b8;font-size:10px">Belum kumpul W2</span>');
      rows += '<button type="button" data-mid="' + i + '" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;cursor:pointer;margin-bottom:8px;text-align:left">' +
        '<span style="width:32px;height:32px;border-radius:99px;background:' + m.color + ';color:#fff;font-weight:700;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + m.initials + '</span>' +
        '<span style="flex:1"><span style="display:block;font-size:13px;font-weight:700;color:#2c3e50">' + m.name + '</span>' +
        '<span style="display:block;font-size:10px;color:#94a3b8">' + m.path + '</span></span>' + badge + '</button>';
    }
    modal(
      '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">👥 ' + esc(title) + '</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px">Pilih mentee untuk membuka percakapan</p>' + rows,
      function (box, close) {
        $all('[data-mid]', box).forEach(function (b) {
          b.addEventListener('click', function () {
            var id = +b.getAttribute('data-mid');
            close();
            messageModal(MENTEES[id].name, id);
          });
        });
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

    // penghitung lessons nyata: materi W2 selesai dibaca -> 6 jadi 7
    if (S.lessons && S.lessons.w2) {
      $all('p').forEach(function (p) {
        if (p.textContent.trim() === '6' && p.className.indexOf('text-2xl') > -1 && p.nextElementSibling && /Lessons Selesai/.test(p.nextElementSibling.textContent)) p.textContent = '7';
      });
      $all('span').forEach(function (sp) { if (sp.textContent.trim() === '+2 hari ini') sp.textContent = '+3 hari ini'; });
    }

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

  function initRealLeaderboard() {
    var table=byId('leaderboard-table');if(!table||table.getAttribute('data-real-loading'))return;table.setAttribute('data-real-loading','1');
    var header=table.firstElementChild;table.innerHTML='';if(header)table.appendChild(header);var loading=document.createElement('div');loading.className='ftg-kpi-loading';loading.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Menghitung KPI dari tugas, review, presensi, dan canvas…';table.appendChild(loading);
    apiRequest('/api/operations?resource=leaderboard').then(function(data){var rows=data.leaderboard||[],myProfile=AUTH.profile||{},medals=['🥇','🥈','🥉'];table.innerHTML='';if(header)table.appendChild(header);rows.forEach(function(row,index){var mine=row.id===myProfile.id,item=document.createElement('div');item.setAttribute('data-lb-path',/entre/i.test(row.path)?'ent':'career');item.className='px-6 py-3 grid grid-cols-12 gap-2 items-center border-b border-slate-50 text-xs'+(mine?' bg-[#1a5f4f]/5':'');item.innerHTML='<div class="col-span-1 font-bold">'+(medals[index]||index+1)+'</div><div class="col-span-3 min-w-0"><p class="text-[#2c3e50] font-bold truncate">'+esc(row.name)+(mine?' <span class="text-[#1a5f4f]">(Kamu)</span>':'')+'</p><p class="text-slate-400 text-[10px]">Mentor: '+esc(row.mentor)+'</p></div><div class="col-span-1 text-center"><span class="ftg-track-chip">'+esc(row.path.replace(' Path',''))+'</span></div><div class="col-span-1 text-center font-bold text-[#1a5f4f]">'+row.completion+'</div><div class="col-span-1 text-center font-bold text-[#8b5cf6]">'+row.quality+'</div><div class="col-span-1 text-center font-bold text-[#f97316]">'+row.engagement+'</div><div class="col-span-1 text-center font-bold text-[#22c55e]">'+row.innovation+'</div><div class="col-span-2 text-center text-base font-bold">'+Number(row.total).toFixed(1)+'</div><div class="col-span-1 text-center text-slate-400">—</div>';table.appendChild(item);});var foot=document.createElement('div');foot.className='ftg-kpi-source';foot.innerHTML='<b>Alur data otomatis:</b> '+(data.flow||[]).map(esc).join(' → ')+'<small>Dihitung ulang dari database · '+new Date(data.generated_at).toLocaleString('id-ID')+'</small>';table.appendChild(foot);
      var subtitle=$('header p');if(subtitle&&/peserta/i.test(subtitle.textContent))subtitle.textContent=rows.length+' peserta · Data KPI realtime';
      var btns={all:byId('btn-filter-all-lb'),career:byId('btn-filter-career-lb'),ent:byId('btn-filter-ent-lb')};function filter(value){$all('[data-lb-path]',table).forEach(function(item){item.style.display=value==='all'||item.getAttribute('data-lb-path')===value?'':'none';});}if(btns.all)btns.all.onclick=function(){filter('all');};if(btns.career)btns.career.onclick=function(){filter('career');};if(btns.ent)btns.ent.onclick=function(){filter('ent');};
    }).catch(function(error){table.innerHTML='';if(header)table.appendChild(header);var failed=document.createElement('div');failed.className='ftg-kpi-error';failed.innerHTML='<b>Data KPI belum dapat dimuat.</b><span>'+esc(error.message)+'</span><button type="button">Coba lagi</button>';table.appendChild(failed);$('button',failed).onclick=function(){table.removeAttribute('data-real-loading');initRealLeaderboard();};});
  }

  /* ================================================================
     PAGE: DESIGN THINKING MODULE
     ================================================================ */
  function canvasCompletion(config, progress) {
    var total = 1, filled = progress && progress.niyyah && progress.niyyah.trim() ? 1 : 0;
    (config.weeks || []).forEach(function (week) {
      total += week.questions.length;
      var answers = progress && progress.weeks && progress.weeks[String(week.number)] && progress.weeks[String(week.number)].answers || [];
      filled += answers.filter(function (answer) { return String(answer || '').trim(); }).length;
    });
    return { filled:filled, total:total, percent:Math.round(filled / Math.max(1, total) * 100) };
  }
  function mountRealDesignThinking() {
    if (PAGE.indexOf('design-thinking') !== 0 || !AUTH.accessToken) return false;
    var host = $('main > div.px-8');
    if (!host) return false;
    var legacyWeekSwitch = $('main > header > div:last-child');
    if (legacyWeekSwitch && legacyWeekSwitch.querySelector('[data-design-id*="week1-tab"]')) legacyWeekSwitch.style.display = 'none';
    host.innerHTML = '<section class="ftg-canvas-loading"><i class="fa-solid fa-circle-notch fa-spin"></i><b>Menyiapkan ruang belajar...</b><span>Mengambil kurikulum dan progres terakhirmu.</span></section>';
    apiRequest('/api/operations?resource=learning').then(function (data) {
      if (!data.assignment) {
        host.innerHTML = '<section class="ftg-canvas-empty"><i class="fa-solid fa-calendar-check"></i><h2>Canvas sedang disiapkan Fasil</h2><p>Kurikulum belum dipublikasikan. Setelah Fasil membuka minggu aktif, halaman ini otomatis menampilkan materi resminya.</p></section>';
        return;
      }
      var config = data.config, row = data.progress || {}, progress = row.checklist_state || { niyyah:'', weeks:{} };
      progress.weeks = progress.weeks || {};
      var selected = Math.max(1, Math.min(4, Number(config.active_week) || 1));
      function render() {
        var complete = canvasCompletion(config, progress), week = config.weeks[selected - 1];
        var answers = progress.weeks[String(selected)] && progress.weeks[String(selected)].answers || [];
        host.innerHTML = '<section class="ftg-canvas-journey"><div><span>PROGRAM RESMI · BULAN 1</span><h2>' + esc(config.title) + '</h2><p>' + esc(config.instructions) + '</p></div><div class="ftg-canvas-meter"><b>' + complete.percent + '%</b><span><i style="width:' + complete.percent + '%"></i></span><small>' + complete.filled + ' dari ' + complete.total + ' bagian terisi</small></div></section>' +
          '<section class="ftg-canvas-weekbar">' + config.weeks.map(function (item) { var wanswers = progress.weeks[String(item.number)] && progress.weeks[String(item.number)].answers || [], done = wanswers.length && wanswers.every(function (answer) { return String(answer || '').trim(); }); return '<button type="button" data-canvas-week="' + item.number + '" class="' + (selected === item.number ? 'is-active ' : '') + (item.is_open ? 'is-open' : 'is-locked') + '"><span>W' + item.number + (done ? ' ✓' : '') + '</span><b>' + esc(item.phase) + '</b><small>' + (item.is_open ? esc(item.title) : 'Belum dibuka Fasil') + '</small><i class="fa-solid ' + (item.is_open ? 'fa-arrow-right' : 'fa-lock') + '"></i></button>'; }).join('') + '</section>' +
          '<section class="ftg-canvas-workspace"><div class="ftg-canvas-main"><div class="ftg-canvas-head"><div><span>MINGGU ' + week.number + ' · ' + esc(week.phase) + '</span><h2>' + esc(week.title) + '</h2><p>' + esc(week.description || 'Jawab berdasarkan proses dan temuanmu sendiri.') + '</p></div><div id="canvasSaveState" class="ftg-canvas-save"><i class="fa-solid fa-cloud"></i> Tersimpan</div></div>' +
          (selected === 1 ? '<label class="ftg-canvas-question"><b>Niyyah perjalananmu</b><small>Apa niat tulusmu dan siapa yang ingin kamu beri manfaat?</small><textarea id="canvasNiyyah" rows="3" ' + (!week.is_open ? 'disabled' : '') + ' placeholder="Tuliskan niyyahmu...">' + esc(progress.niyyah || '') + '</textarea></label>' : '') +
          (week.is_open ? week.questions.map(function (question, index) { return '<label class="ftg-canvas-question"><span>' + (index + 1) + '</span><b>' + esc(question) + '</b><textarea data-canvas-answer="' + index + '" rows="4" placeholder="Tulis jawabanmu dengan lengkap...">' + esc(answers[index] || '') + '</textarea></label>'; }).join('') : '<div class="ftg-canvas-locked"><i class="fa-solid fa-lock"></i><h3>Minggu ini belum dibuka</h3><p>Fasil mengatur pembukaan berdasarkan kalender program. Jawaban minggu sebelumnya tetap aman dan dapat dibaca.</p></div>') + '</div>' +
          '<aside class="ftg-canvas-side"><div><span>STATUS BELAJAR</span><h3>' + (row.status === 'approved' ? 'Sudah dinilai' : row.status === 'submitted' ? 'Menunggu review' : 'Draft aktif') + '</h3><p>Terakhir diperbarui ' + (row.updated_at ? new Date(row.updated_at).toLocaleString('id-ID') : 'belum pernah') + '</p></div><ul><li><i class="fa-solid fa-shield-halved"></i><span><b>Aman di server</b>Jawaban tidak bergantung pada browser ini.</span></li><li><i class="fa-solid fa-eye"></i><span><b>Dapat dipantau</b>Mentor dan Fasil melihat progres sesuai hak akses.</span></li><li><i class="fa-solid fa-clock-rotate-left"></i><span><b>Riwayat versi</b>Versi lama dipertahankan saat dikumpulkan ulang.</span></li></ul><button id="canvasSubmitOfficial" type="button" ' + (!week.is_open ? 'disabled' : '') + '><i class="fa-solid fa-paper-plane"></i> Lampiran & Kumpulkan</button><small>Pengumpulan memakai alur Tugas Saya: Drive pusat, revisi, rubrik, dan review mentor.</small></aside></section>';
        $all('[data-canvas-week]', host).forEach(function (button) { button.addEventListener('click', function () { selected = +button.getAttribute('data-canvas-week'); render(); }); });
        var timer;
        function saveDraft() {
          clearTimeout(timer);
          var state = document.getElementById('canvasSaveState'); if (state) state.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menyimpan...';
          timer = setTimeout(function () {
            apiRequest('/api/operations', { method:'POST', body:JSON.stringify({ action:'progress_save', progress:progress }) }).then(function (saved) {
              row.status = saved.status; row.updated_at = new Date().toISOString();
              var status = document.getElementById('canvasSaveState'); if (status) status.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Tersimpan';
            }).catch(function (error) { var status=document.getElementById('canvasSaveState'); if(status)status.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i> Gagal menyimpan'; toast(error.message, '⚠️'); });
          }, 650);
        }
        var niyyah = document.getElementById('canvasNiyyah'); if (niyyah) niyyah.addEventListener('input', function () { progress.niyyah = niyyah.value; saveDraft(); });
        $all('[data-canvas-answer]', host).forEach(function (field) { field.addEventListener('input', function () { progress.weeks[String(selected)] = progress.weeks[String(selected)] || { answers:[] }; progress.weeks[String(selected)].answers[+field.getAttribute('data-canvas-answer')] = field.value; saveDraft(); }); });
        var submit = document.getElementById('canvasSubmitOfficial'); if (submit) submit.addEventListener('click', function () {
          submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menyimpan progres...';
          apiRequest('/api/operations', { method:'POST', body:JSON.stringify({ action:'progress_save', progress:progress }) }).then(function () {
            var task = assignmentFor('dt-canvas-month-1');
            if (!task) { location.href = 'assignment-submission.html'; return; }
            submit.disabled = false; submit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Lampiran & Kumpulkan';
            openTaskSubmission(task, render);
          }).catch(function (error) { submit.disabled=false; submit.innerHTML='<i class="fa-solid fa-paper-plane"></i> Coba lagi'; toast(error.message, '⚠️'); });
        });
      }
      render();
    }).catch(function (error) { host.innerHTML='<section class="ftg-canvas-empty is-error"><i class="fa-solid fa-triangle-exclamation"></i><h2>Ruang belajar belum dapat dibuka</h2><p>'+esc(error.message)+'</p><button type="button" onclick="location.reload()">Coba Lagi</button></section>'; });
    return true;
  }
  function initDesignThinking() {
    if (mountRealDesignThinking()) return;
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
    // Tab minggu — W1/W2 membuka materi; W3 terbuka OTOMATIS setelah W2 dinilai
    var w3Open = !!S.reviewW2;
    var w1b = byId('btn-week1-tab');
    if (w1b) w1b.addEventListener('click', function () { lessonModal('w1'); });
    var w2b = byId('btn-week2-tab');
    if (w2b) w2b.addEventListener('click', function () { lessonModal('w2'); });
    var w3b = byId('btn-week3-tab');
    if (w3b) {
      if (w3Open) {
        w3b.className = 'px-3 py-1.5 rounded-lg bg-[#22c55e] text-white text-sm font-semibold';
        w3b.addEventListener('click', function () { lessonModal('w3'); });
      } else {
        w3b.addEventListener('click', function () { toast('Minggu 3 (IDEATE) terbuka setelah tugas W2 dinilai mentor', '🔒'); });
      }
    }
    var w4b = byId('btn-week4-tab');
    if (w4b) w4b.addEventListener('click', function () { toast('Minggu 4 (PROTOTYPE + TEST) terbuka setelah W3 selesai', '🔒'); });

    if (w3Open) {
      // kartu fase W3 di "Perjalanan 4 Minggu" ikut terbuka
      var w3card = $all('[data-design-id^="phase-nav"] .grid > div').filter(function (d) { return /IDEATE/.test(d.textContent); })[0];
      if (w3card) {
        w3card.className = 'bg-[#22c55e]/10 border-2 border-[#22c55e]/50 rounded-xl p-4 relative';
        var lockIco = $('i.fa-lock', w3card);
        if (lockIco) lockIco.className = 'fa-solid fa-unlock text-[#22c55e]';
        var wk = $('span', w3card);
        if (wk) wk.className = 'bg-[#22c55e] text-white text-[10px] font-bold px-2 py-0.5 rounded-full';
        var obadge = document.createElement('div');
        obadge.className = 'absolute -top-2 left-3 bg-[#22c55e] text-white text-[9px] font-bold px-2 py-0.5 rounded-full';
        obadge.textContent = '🔓 TERBUKA';
        w3card.appendChild(obadge);
      }
      // kolom IDEATE di canvas jadi bisa diisi
      var canvasSec2 = byId('canvas-section');
      if (canvasSec2) {
        var ideateCol = $all('.grid.grid-cols-5 > div', canvasSec2).filter(function (c) { return /IDEATE/.test(c.textContent); })[0];
        if (ideateCol) {
          ideateCol.classList.remove('opacity-50');
          $all('div.border-dashed', ideateCol).forEach(function (box, i) {
            var ta = document.createElement('textarea');
            ta.rows = 2;
            ta.placeholder = 'Tulis idemu...';
            ta.className = 'w-full bg-white border border-[#22c55e]/40 rounded-lg p-2 text-xs text-[#2c3e50] placeholder-slate-300';
            ta.value = (S.ideate && S.ideate[i]) || '';
            ta.addEventListener('input', function () { S.ideate[i] = ta.value; saveState(); });
            box.replaceWith(ta);
          });
          $all('p', ideateCol).forEach(function (p) {
            if (/Minggu 3/.test(p.textContent)) p.innerHTML = '<i class="fa-solid fa-unlock text-[#22c55e]"></i> Terbuka!';
            if (p.textContent.trim() === 'IDEATE') p.className = 'text-[#22c55e] text-xs font-bold';
          });
        }
      }
      // perayaan sekali saat pertama kali terbuka
      if (!S.w3Celebrated) {
        S.w3Celebrated = true;
        saveState();
        setTimeout(function () {
          confetti();
          toast('🔓 Minggu 3 (IDEATE) terbuka! Klik tab W3 untuk materi barunya', '🎉');
        }, 800);
      }
    }
    // back chevron
    var back = $('header a');
    if (back && back.getAttribute('href') === '#') back.href = 'mentee-dashboard.html';
  }

  /* ================================================================
     Google Drive — berkas tugas disimpan di Drive, database hanya
     menyimpan tautannya (ringan). Folder dibuat otomatis & rapi:
       FTG Fellowship 2026 / Mentee / <Nama> / Minggu <N>
     ================================================================ */
  var DRIVE = { token: null, expires: 0, tc: null, profile: null };
  function driveConfigured() { return !!(window.FTG_CONF && FTG_CONF.driveClientId); }
  function centralDriveEnabled() { return !!(window.FTG_CONF && FTG_CONF.driveMode === 'central' && FTG_CONF.driveRootFolderId); }
  function driveReady() { return DRIVE.token && Date.now() < DRIVE.expires; }

  function googleIdentity() {
    return fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + DRIVE.token }
    }).then(function (r) {
      if (!r.ok) throw new Error('Identitas akun Google tidak dapat dibaca');
      return r.json();
    }).then(function (p) {
      if (!p || !p.email) throw new Error('Email Google tidak ditemukan');
      var s = mySession() || {};
      DRIVE.profile = {
        email: p.email,
        name: p.name || p.email,
        picture: p.picture || '',
        ftgEmail: s.email || '',
        role: s.role || '',
        connectedAt: new Date().toISOString()
      };
      sessionStorage.setItem('ftgGoogleProfile', JSON.stringify(DRIVE.profile));
      if (AUTH.profile) {
        AUTH.profile.google_email = DRIVE.profile.email;
        AUTH.profile.google_connected_at = DRIVE.profile.connectedAt;
      }
      if (sb && s.email) {
        return sb.from('profiles').update({
          google_email: DRIVE.profile.email,
          google_connected_at: DRIVE.profile.connectedAt
        }).eq('id', AUTH.user.id).then(function (result) {
          if (result.error) throw result.error;
          return DRIVE.profile;
        });
      }
      return DRIVE.profile;
    });
  }

  function googleStatusBadge(profile) {
    if (!profile || document.getElementById('ftg-google-status')) return;
    var badge = document.createElement('div');
    badge.id = 'ftg-google-status';
    badge.title = 'Akun Google terhubung untuk sesi ini';
    badge.style.cssText = 'display:flex;align-items:center;gap:7px;width:calc(100% - 32px);box-sizing:border-box;margin:8px 16px 0;background:rgba(34,197,94,.12);border:1px solid rgba(134,239,172,.28);border-radius:10px;padding:7px 10px;color:#86efac;font-size:10px;font-weight:700;';
    badge.innerHTML = '<i class="fa-brands fa-google-drive"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(profile.email) + '</span>';
    var identity = $('aside .mx-4.mt-4');
    if (identity && identity.parentNode) identity.parentNode.insertBefore(badge, identity.nextSibling);
    else {
      badge.style.cssText += 'position:fixed;right:16px;bottom:16px;z-index:55;width:auto;max-width:260px;background:#166534;color:#fff;';
      document.body.appendChild(badge);
    }
  }

  function mountGoogleGate() {
    var role = myRole();
    // Drive pusat memakai kredensial layanan di server. Pengguna tidak perlu
    // memberikan izin OAuth Drive pribadi, sehingga tidak ada consent screen
    // sensitif atau peringatan aplikasi belum diverifikasi di dashboard.
    if (centralDriveEnabled() && role !== 'mentor') return;
    // Mentor dan mentee wajib menghubungkan Google pada alur utama. Dengan
    // begitu akses Drive sudah siap sebelum proses unggah/review dimulai.
    var needsGate = (role === 'mentor' && IS_MENTOR_PAGE) ||
      (role === 'mentee' && /^(mentee-dashboard|assignment-submission)/.test(PAGE)) ||
      (role === 'admin' && PAGE.indexOf('admin-dashboard') === 0);
    if (!needsGate || document.getElementById('ftg-google-gate')) return;
    // Pada login pertama, sambutan peran selalu tampil lebih dahulu. Gate
    // Google dibuka setelah pengguna menyelesaikan sambutan tersebut.
    if (AUTH.profile && /^(mentee|mentor)$/.test(role) && !AUTH.profile.onboarding_completed) return;
    var existing = googleProfile();
    if (existing) { googleStatusBadge(existing); return; }
    var mentor = role === 'mentor';
    var admin = role === 'admin';
    var gate = document.createElement('div');
    gate.id = 'ftg-google-gate';
    gate.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.72);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:20px;';
    gate.innerHTML = '<section role="dialog" aria-modal="true" aria-labelledby="ftg-google-title" style="width:min(440px,100%);background:#fff;border-radius:22px;padding:28px;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:center">' +
      '<div style="width:58px;height:58px;margin:0 auto 14px;border-radius:18px;background:#e8f5ef;color:#1a5f4f;display:grid;place-items:center;font-size:28px"><i class="fa-brands fa-google-drive"></i></div>' +
      '<h2 id="ftg-google-title" style="font-size:20px;font-weight:800;color:#1e293b;margin-bottom:8px">Hubungkan akun Google</h2>' +
      '<p style="font-size:13px;line-height:1.6;color:#64748b;margin-bottom:18px">' +
      (mentor ? 'Wajib untuk membuka dan mengunduh berkas tugas dari Drive pusat FTG. Pastikan memakai akun Google mentor.' : admin ? 'Hubungkan akun Google panitia agar berikutnya kamu dapat masuk dengan Google dan mengelola integrasi program.' : 'Akun Google diperlukan untuk identitas pengumpulan. Berkas disimpan di Drive pusat FTG, bukan Drive pribadimu.') +
      '</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:16px;font-size:11px;color:#475569">File tidak dibuat publik. Pemilik berkas: <b>' + esc((window.FTG_CONF && FTG_CONF.driveOwnerEmail) || 'projectglobalinspire@gmail.com') + '</b>; akses baca diberikan kepada mentee dan mentor terkait.</div>' +
      '<button id="btn-google-gate" type="button" style="width:100%;border:0;border-radius:12px;background:#1a5f4f;color:#fff;padding:12px 16px;font-size:13px;font-weight:800;cursor:pointer"><i class="fa-brands fa-google mr-2"></i> Lanjutkan dengan Google</button>' +
      '<button id="btn-google-logout" type="button" style="margin-top:9px;width:100%;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#64748b;padding:10px 16px;font-size:12px;font-weight:700;cursor:pointer">Keluar / ganti akun FTG</button>' +
      '<p id="ftg-google-error" style="display:none;color:#dc2626;font-size:11px;margin-top:10px"></p></section>';
    document.body.appendChild(gate);
    var connect = document.getElementById('btn-google-gate');
    document.getElementById('btn-google-logout').addEventListener('click', function () {
      secureLogout();
    });
    connect.addEventListener('click', function () {
      connect.disabled = true;
      connect.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menghubungkan...';
      driveAuth()
        .then(function () {
          googleStatusBadge(DRIVE.profile);
          gate.remove();
          mountMentorGooglePanel(true);
          backfillMentorDriveAccess().then(function (count) {
            toast('Google terhubung sebagai ' + DRIVE.profile.email + (count ? ' · ' + count + ' akses berkas diperbarui' : ''), '✅');
          });
        })
        .catch(function (err) {
          var msg = document.getElementById('ftg-google-error');
          msg.textContent = err.message;
          msg.style.display = 'block';
          connect.disabled = false;
          connect.innerHTML = '<i class="fa-brands fa-google mr-2"></i> Coba Hubungkan Lagi';
        });
    });
  }

  function driveAuth(force) {
    return new Promise(function (resolve, reject) {
      if (!driveConfigured()) { reject(new Error('Drive belum dikonfigurasi')); return; }
      if (force) { DRIVE.token = null; DRIVE.expires = 0; }
      if (driveReady() && DRIVE.profile) { resolve(DRIVE.token); return; }
      if (!window.google || !google.accounts || !google.accounts.oauth2) { reject(new Error('Google SDK belum siap')); return; }
      if (!DRIVE.tc) {
        var scopes = 'https://www.googleapis.com/auth/userinfo.email' +
          (myRole() === 'mentee' && !centralDriveEnabled() ? ' https://www.googleapis.com/auth/drive.file' : '');
        DRIVE.tc = google.accounts.oauth2.initTokenClient({
          client_id: FTG_CONF.driveClientId,
          scope: scopes,
          callback: function () {}
        });
      }
      DRIVE.tc.callback = function (resp) {
        if (resp && resp.access_token) {
          DRIVE.token = resp.access_token;
          DRIVE.expires = Date.now() + (resp.expires_in || 3600) * 1000 - 60000;
          googleIdentity().then(function () { resolve(DRIVE.token); }).catch(reject);
        } else reject(new Error((resp && resp.error) === 'access_denied' ? 'Izin Drive dibatalkan' : 'Izin Drive gagal'));
      };
      DRIVE.tc.error_callback = function (err) {
        var kind = err && err.type;
        if (kind === 'popup_closed') reject(new Error('Jendela izin Drive ditutup'));
        else if (kind === 'popup_failed_to_open') reject(new Error('Popup Drive diblokir browser. Izinkan popup lalu coba lagi'));
        else reject(new Error('Jendela izin Drive gagal dibuka'));
      };
      DRIVE.tc.requestAccessToken({ prompt: DRIVE.token ? '' : 'consent' });
    });
  }

  function mentorDriveFileIds() {
    var found = {};
    Object.keys(G.mentees || {}).forEach(function (key) {
      var state = G.mentees[key] || {};
      (state.files || []).forEach(function (file) { if (file && file.driveId) found[file.driveId] = true; });
      Object.keys(state.assignmentSubmissions || {}).forEach(function (taskId) {
        ((state.assignmentSubmissions[taskId] || {}).files || []).forEach(function (file) { if (file && file.driveId) found[file.driveId] = true; });
      });
    });
    return Object.keys(found);
  }

  function markMentorDriveShared(fileId) {
    Object.keys(G.mentees || {}).forEach(function (key) {
      var state = G.mentees[key] || {};
      (state.files || []).forEach(function (file) { if (file && file.driveId === fileId) { file.sharedWithMentor = true; file.shareReason = ''; } });
      Object.keys(state.assignmentSubmissions || {}).forEach(function (taskId) {
        ((state.assignmentSubmissions[taskId] || {}).files || []).forEach(function (file) { if (file && file.driveId === fileId) { file.sharedWithMentor = true; file.shareReason = ''; } });
      });
    });
  }

  function backfillMentorDriveAccess() {
    if (myRole() !== 'mentor' || !AUTH.accessToken) return Promise.resolve(0);
    var ids = mentorDriveFileIds();
    var updated = 0;
    return Promise.all(ids.map(function (id) {
      return apiRequest('/api/drive', { method: 'POST', body: JSON.stringify({ action: 'mentor-share', file_id: id }) })
        .then(function () { markMentorDriveShared(id); updated++; })
        .catch(function () { /* satu berkas lama tidak boleh menggagalkan koneksi */ });
    })).then(function () { if (updated) saveState(); return updated; });
  }

  function mountMentorGooglePanel(refresh) {
    if (myRole() !== 'mentor' || !IS_MENTOR_PAGE) return;
    var old = document.getElementById('mentor-google-access');
    if (old && !refresh) return;
    if (old) old.remove();
    var host = $('main > div.px-8');
    if (!host) return;
    var active = googleProfile();
    var savedEmail = (AUTH.profile && AUTH.profile.google_email) || '';
    var email = active ? active.email : savedEmail;
    var panel = document.createElement('section');
    panel.id = 'mentor-google-access';
    panel.className = 'ftg-mentor-google-access';
    panel.innerHTML = '<div class="ftg-mentor-google-icon"><i class="fa-brands fa-google-drive"></i></div><div class="ftg-mentor-google-copy"><h2>Akses Google Mentor</h2><p>' +
      (active ? 'Sesi aktif sebagai <b>' + esc(email) + '</b>. Berkas mentee dapat dibuka dan diunduh.' : savedEmail ? 'Akun <b>' + esc(savedEmail) + '</b> sudah tercatat. Aktifkan sesi Google pada browser ini untuk membuka berkas.' : 'Hubungkan akun Google mentor agar berkas pengumpulan dapat dibuka dan diunduh dengan aman.') +
      '</p></div><span class="ftg-mentor-google-status ' + (active ? 'is-connected' : 'is-pending') + '">' + (active ? 'Terhubung' : 'Belum aktif') + '</span><button type="button" id="mentorGoogleConnect">' + (active ? 'Ganti akun' : 'Hubungkan Google') + '</button>';
    host.insertBefore(panel, host.firstChild);
    $('#mentorGoogleConnect', panel).addEventListener('click', function () {
      var button = this;
      button.disabled = true;
      button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menghubungkan...';
      driveAuth(true).then(function () {
        googleStatusBadge(DRIVE.profile);
        return backfillMentorDriveAccess();
      }).then(function (count) {
        mountMentorGooglePanel(true);
        toast('Google mentor terhubung' + (count ? ' · ' + count + ' akses berkas diperbarui' : ''), '✅');
      }).catch(function (error) {
        button.disabled = false;
        button.textContent = 'Coba Lagi';
        toast(error.message, '⚠️');
      });
    });
  }

  /* Token akses hanya hidup di memori tab. Hapus token versi lama yang pernah
     disimpan di browser oleh prototype sebelumnya. */
  try { localStorage.removeItem('ftgDrive'); sessionStorage.removeItem('ftgDrive'); } catch (e) {}

  function driveFailure(r) {
    return r.json().catch(function () { return null; }).then(function (body) {
      var apiMessage = body && body.error && body.error.message;
      if (r.status === 403) throw new Error('Akses Drive ditolak. Pastikan Drive API aktif dan akun diizinkan');
      if (r.status === 413) throw new Error('Berkas terlalu besar untuk diunggah');
      throw new Error(apiMessage || ('Google Drive merespons ' + r.status));
    });
  }

  function driveRequest(url, opts, mayRetry) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + DRIVE.token });
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 && mayRetry !== false) {
        return driveAuth(true).then(function () { return driveRequest(url, opts, false); });
      }
      if (!r.ok) return driveFailure(r);
      return r.json();
    });
  }

  function driveApi(path, opts) {
    return driveRequest('https://www.googleapis.com/drive/v3/' + path, opts, true);
  }

  function mentorGoogleEmail() {
    var fixed = window.FTG_CONF && FTG_CONF.mentorGoogleEmail;
    if (fixed) return Promise.resolve(fixed);
    if (!sb) return Promise.resolve('');
    return sb.rpc('my_mentor_google_email')
      .then(function (res) { return res.data || ''; })
      .catch(function () { return ''; });
  }

  function shareDriveFileWithMentor(fileId) {
    return mentorGoogleEmail().then(function (email) {
      if (!email) return { shared: false, reason: 'Mentor belum menghubungkan akun Google' };
      if (DRIVE.profile && DRIVE.profile.email === email) return { shared: true, email: email };
      return driveApi('files/' + encodeURIComponent(fileId) + '/permissions?sendNotificationEmail=false&fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email })
      }).then(function () { return { shared: true, email: email }; })
        .catch(function (err) { return { shared: false, email: email, reason: err.message }; });
    });
  }
  /* cari folder bernama X di dalam parent; buat kalau belum ada */
  function driveFolder(name, parentId) {
    var q = "mimeType='application/vnd.google-apps.folder' and name='" + name.replace(/'/g, "\\'") + "' and trashed=false" +
      (parentId ? " and '" + parentId + "' in parents" : '');
    return driveApi('files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&spaces=drive')
      .then(function (res) {
        if (res.files && res.files.length) return res.files[0].id;
        var meta = { name: name, mimeType: 'application/vnd.google-apps.folder' };
        if (parentId) meta.parents = [parentId];
        return driveApi('files?fields=id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meta)
        }).then(function (f) { return f.id; });
      });
  }
  /* jalur folder rapi untuk mentee tertentu */
  function driveFolderPath(menteeName, weekLabel) {
    var root = (window.FTG_CONF && FTG_CONF.driveRootFolder) || 'FTG Fellowship 2026';
    return driveFolder(root, null)
      .then(function (rid) { return driveFolder('Mentee', rid); })
      .then(function (mid) { return driveFolder(menteeName, mid); })
      .then(function (pid) { return driveFolder(weekLabel, pid); });
  }
  function driveUpload(file, folderId) {
    var meta = { name: file.name, parents: [folderId] };
    if (file.size > 5 * 1024 * 1024) {
      return driveUploadResumable(file, meta, true);
    }
    var boundary = 'ftg_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    var body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(meta),
      '\r\n--' + boundary + '\r\nContent-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n',
      file,
      '\r\n--' + boundary + '--'
    ], { type: 'multipart/related; boundary=' + boundary });
    return driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size,mimeType', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: body
    }, true);
  }

  /* Drive merekomendasikan resumable upload untuk berkas di atas 5 MB. */
  function driveUploadResumable(file, meta, mayRetry) {
    return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink,size,mimeType', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + DRIVE.token,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(file.size)
      },
      body: JSON.stringify(meta)
    }).then(function (r) {
      if (r.status === 401 && mayRetry !== false) {
        return driveAuth(true).then(function () { return driveUploadResumable(file, meta, false); });
      }
      if (!r.ok) return driveFailure(r);
      var uploadUrl = r.headers.get('Location');
      if (!uploadUrl) throw new Error('Google Drive tidak mengirim sesi unggahan');
      return fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      }).then(function (uploadResponse) {
        if (!uploadResponse.ok) return driveFailure(uploadResponse);
        return uploadResponse.json();
      });
    });
  }

  /* Mode pusat: refresh token akun FTG hanya berada di server. Browser
     mengirim potongan kecil melalui endpoint satu origin. Respons final
     resumable Google tidak selalu menyertakan header CORS, sehingga unggahan
     sebenarnya dapat selesai tetapi browser melaporkannya sebagai gagal. */
  function putCentralDriveFile(uploadUrl, uploadToken, file, onProgress) {
    var chunkSize = 3 * 1024 * 1024; // kelipatan 256 KiB dan aman di bawah limit Vercel
    function sendChunk(start) {
      var end = Math.min(start + chunkSize, file.size);
      return fetch('/api/drive?chunk=1', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + AUTH.accessToken,
          'Content-Type': 'application/octet-stream',
          'X-FTG-Upload-URL': uploadUrl,
          'X-FTG-Upload-Token': uploadToken,
          'X-FTG-File-Type': file.type || 'application/octet-stream',
          'X-FTG-Content-Range': 'bytes ' + start + '-' + (end - 1) + '/' + file.size
        },
        body: file.slice(start, end)
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) throw new Error(data.error || ('Pengiriman berkas gagal (' + response.status + ')'));
          if (onProgress) onProgress(Math.max(1, Math.round(end / file.size * 100)));
          if (data.complete && data.file && data.file.id) return data.file;
          if (end >= file.size) throw new Error('Google Drive belum mengonfirmasi berkas selesai');
          return sendChunk(end);
        });
      });
    }
    return sendChunk(0);
  }
  function centralDriveUpload(file, folderLabel) {
    var lastReportedProgress = 0;
    return apiRequest('/api/drive', {
      method: 'POST',
      body: JSON.stringify({
        action: 'session', file_name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size, folder_label: folderLabel
      })
    }).then(function (session) {
      return putCentralDriveFile(session.upload_url, session.upload_token, file, function (percent) {
        if (percent === 100 || percent >= lastReportedProgress + 20) {
          lastReportedProgress = percent;
          toast('Mengunggah ke Drive pusat... ' + percent + '%', '☁️');
        }
      });
    }).then(function (uploaded) {
      return apiRequest('/api/drive', {
        method: 'POST',
        body: JSON.stringify({ action: 'finalize', file_id: uploaded.id })
      }).then(function (result) {
        return { file: result.file || uploaded, sharing: result.sharing || {}, owner: result.owner || 'projectglobalinspire@gmail.com' };
      });
    });
  }

  function uploadToConfiguredDrive(file, menteeName, folderLabel) {
    if (centralDriveEnabled()) return centralDriveUpload(file, folderLabel);
    return driveFolderPath(menteeName, folderLabel)
      .then(function (folderId) { return driveUpload(file, folderId); })
      .then(function (uploaded) {
        return shareDriveFileWithMentor(uploaded.id).then(function (sharing) {
          return { file: uploaded, sharing: sharing, owner: DRIVE.profile && DRIVE.profile.email };
        });
      });
  }

  /* Pilih berkas → unggah ke Drive (folder per mentee & per minggu). */
  function wireFilePicker(btn, onAdd) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.style.display = 'none';
    inp.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx';
    document.body.appendChild(inp);
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      if (!inp.files.length) return;
      var f = inp.files[0];
      var menteeName = (mySession() || {}).name || MENTEES[MID].name;
      var week = 'Minggu 2';
      var maxMb = +(window.FTG_CONF && FTG_CONF.driveMaxFileSizeMb) || 20;
      var allowed = /\.(pdf|png|jpe?g|docx?|pptx?)$/i.test(f.name);
      if (!allowed) {
        toast('Format tidak didukung. Gunakan PDF, gambar, Word, atau PowerPoint', '⚠️');
        inp.value = '';
        return;
      }
      if (f.size > maxMb * 1024 * 1024) {
        toast('Ukuran berkas maksimal ' + maxMb + ' MB', '⚠️');
        inp.value = '';
        return;
      }

      function record(extra) {
        S.files = (S.files || []).filter(function (x) { return (x.name || x) !== f.name; });
        S.files.push(Object.assign({
          name: f.name, size: f.size, at: new Date().toISOString(),
          folder: 'FTG Fellowship 2026 / Mentee / ' + menteeName + ' / ' + week
        }, extra || {}));
        saveState();
        if (onAdd) onAdd();
      }

      if (!driveConfigured()) {
        record({ pending: true, pendingReason: 'OAuth Client ID Google belum dikonfigurasi' });
        toast('Drive belum tersambung — berkas dicatat, hubungkan Drive untuk mengunggah', '⚠️');
        inp.value = '';
        return;
      }
      toast('Mengunggah "' + f.name + '" ke Google Drive...', '☁️');
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      (centralDriveEnabled() ? Promise.resolve() : driveAuth())
        .then(function () { return uploadToConfiguredDrive(f, menteeName, week); })
        .then(function (result) {
          var res = result.file, sharing = result.sharing;
          record({
            driveId: res.id,
            link: res.webViewLink,
            downloadLink: res.webContentLink || ('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(res.id)),
            mimeType: res.mimeType || f.type || '',
            googleOwnerEmail: result.owner || (DRIVE.profile && DRIVE.profile.email),
            sharedWithMentor: !!sharing.shared,
            sharePending: !sharing.shared,
            shareReason: sharing.reason || ''
          });
          toast(sharing.shared
            ? 'Tersimpan di Drive dan akses mentor sudah diberikan'
            : 'Tersimpan di Drive, tetapi akses mentor tertunda: ' + sharing.reason,
            sharing.shared ? '✅' : '⚠️');
        })
        .catch(function (err) {
          // Jangan mencatat lampiran semu: tanpa upload berhasil, mentor tidak
          // memiliki berkas yang bisa dibuka atau diunduh.
          toast('Berkas belum terunggah: ' + err.message, '⚠️');
        })
        .then(function () {
          inp.value = '';
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
        });
    });
  }

  /* ---------- Tugas mentor: assign -> notifikasi -> submit -> review ---------- */
  function mentorAssignments() {
    G.assignments = Array.isArray(G.assignments) ? G.assignments : [];
    return G.assignments;
  }
  function assignmentFor(id) {
    return mentorAssignments().filter(function (a) { return a.id === id; })[0] || null;
  }
  function assignmentsForMentee(menteeId) {
    return mentorAssignments().filter(function (a) {
      return a.active !== false && (a.targets || []).indexOf(+menteeId) > -1;
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }
  function taskSubmission(menteeId, taskId) {
    var st = mstate(menteeId);
    st.assignmentSubmissions = st.assignmentSubmissions || {};
    return st.assignmentSubmissions[taskId] || null;
  }
  function deadlineDate(value) {
    if (!value) return null;
    // Data lama hanya berisi tanggal; pertahankan artinya sebagai akhir hari.
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value + 'T23:59:59');
    return new Date(value);
  }
  function localDateTimeValue(value) {
    var d = value instanceof Date ? value : deadlineDate(value);
    if (!d || isNaN(d.getTime())) return '';
    function two(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + 'T' + two(d.getHours()) + ':' + two(d.getMinutes());
  }
  function defaultAssignmentDeadline(days) {
    var d = new Date();
    d.setDate(d.getDate() + (days || 7));
    d.setHours(23, 59, 0, 0);
    return d;
  }
  function dueLabel(iso) {
    if (!iso) return 'Tanpa deadline';
    var d = deadlineDate(iso);
    var diff = Math.ceil((d - new Date()) / 86400000);
    var exact = d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (diff < 0) return 'Terlambat · ' + exact;
    if (diff === 0) return 'Deadline hari ini, ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return 'Deadline ' + exact + ' · ' + diff + ' hari lagi';
  }
  function customAttachmentHtml(files) {
    return (files || []).map(function (f, i) {
      return '<span style="display:inline-flex;align-items:center;gap:6px;background:#e8f5ef;color:#166534;font-size:11px;font-weight:700;padding:6px 10px;border-radius:10px;margin:0 6px 6px 0">📄 ' + esc(f.name || 'Berkas') +
        '<button type="button" data-custom-file-remove="' + i + '" title="Hapus dari tugas dan Drive pusat" aria-label="Hapus ' + esc(f.name || 'berkas') + '" style="border:0;background:transparent;color:#64748b;cursor:pointer;font-weight:800">×</button></span>';
    }).join('');
  }
  function deleteUploadedDriveFile(file) {
    if (!file || !file.driveId) return Promise.resolve({ localOnly: true });
    if (!centralDriveEnabled()) return Promise.reject(new Error('Penghapusan otomatis hanya tersedia untuk Drive pusat'));
    return apiRequest('/api/drive', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', file_id: file.driveId })
    });
  }
  function wireCustomAssignmentFile(btn, task, sub, onChange) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.style.display = 'none';
    inp.accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx,.ppt,.pptx';
    document.body.appendChild(inp);
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      if (!inp.files.length) return;
      var f = inp.files[0];
      var maxMb = +(window.FTG_CONF && FTG_CONF.driveMaxFileSizeMb) || 20;
      if (!/\.(pdf|png|jpe?g|docx?|pptx?)$/i.test(f.name)) { toast('Format file tidak didukung', '⚠️'); inp.value = ''; return; }
      if (f.size > maxMb * 1024 * 1024) { toast('Ukuran file maksimal ' + maxMb + ' MB', '⚠️'); inp.value = ''; return; }
      btn.disabled = true;
      btn.textContent = 'Mengunggah...';
      var menteeName = (mySession() || {}).name || MENTEES[MID].name;
      (centralDriveEnabled() ? Promise.resolve() : driveAuth())
        .then(function () { return uploadToConfiguredDrive(f, menteeName, 'Tugas Mentor - ' + task.title); })
        .then(function (result) {
          var uploaded = result.file;
          sub.files = (sub.files || []).filter(function (x) { return x.name !== f.name; });
          sub.files.push({
            name: f.name, size: f.size, driveId: uploaded.id,
            link: uploaded.webViewLink,
            downloadLink: uploaded.webContentLink || ('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(uploaded.id)),
            mimeType: uploaded.mimeType || f.type || '',
            googleOwnerEmail: result.owner || 'projectglobalinspire@gmail.com',
            sharedWithMentor: !!result.sharing.shared,
            shareReason: result.sharing.reason || '',
            at: new Date().toISOString()
          });
          S.assignmentSubmissions[task.id] = sub;
          saveState();
          if (onChange) onChange();
          toast(result.sharing.shared ? 'File terunggah dan dibagikan ke mentor' : 'File terunggah, akses mentor tertunda', result.sharing.shared ? '✅' : '⚠️');
        })
        .catch(function (err) { toast('File belum terunggah: ' + err.message, '⚠️'); })
        .then(function () { btn.disabled = false; btn.textContent = 'Pilih File'; inp.value = ''; });
    });
  }
  function openTaskSubmission(task, onDone) {
    var sub = taskSubmission(MID, task.id) || { text: '', link: '', files: [] };
    sub.files = sub.files || []; sub.checks = sub.checks || {}; sub.discussion = sub.discussion || []; sub.versions = sub.versions || [];
    var historyHtml = assignmentHistoryHtml(sub);
    if (sub.review && sub.review.decision !== 'revision') {
      return modal('<h3 style="font-weight:800;color:#1e293b;font-size:17px;margin-bottom:4px">✅ ' + esc(task.title) + '</h3>' +
        '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Tugas sudah dinilai oleh mentor.</p>' +
        '<div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;padding:14px"><b style="color:#166534">Skor ' + sub.review.score + '/100</b><p style="font-size:12px;color:#475569;margin-top:6px">' + esc(sub.review.text) + '</p></div>' + historyHtml);
      return;
    }
    var visibleChecklist = (task.checklist || []).filter(function (item) { return typeof item === 'string'; });
    return modal(
      '<h3 style="font-weight:800;color:#1e293b;font-size:17px;margin-bottom:3px">📝 ' + esc(task.title) + '</h3>' +
      '<p style="font-size:11px;color:#f97316;font-weight:700;margin-bottom:10px">' + esc(dueLabel(task.deadline)) + ' · +' + (+task.points || 0) + ' poin</p>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px;margin-bottom:12px;font-size:12px;color:#475569;white-space:pre-line">' + esc(task.description || 'Ikuti arahan mentor.') + '</div>' +
      (task.referenceLink ? '<a href="' + esc(task.referenceLink) + '" target="_blank" rel="noopener" style="display:inline-block;color:#8b5cf6;font-size:11px;font-weight:700;margin-bottom:12px">🔗 Buka materi/referensi</a>' : '') +
      (visibleChecklist.length ? '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px;margin-bottom:12px"><p style="font-size:11px;font-weight:800;color:#1d4ed8;margin-bottom:6px">Checklist pengerjaan</p>' + visibleChecklist.map(function (item, i) { return '<label style="display:flex;gap:7px;align-items:center;font-size:11px;color:#334155;margin:5px 0"><input type="checkbox" data-task-check="' + i + '" ' + (sub.checks[i] ? 'checked' : '') + '> ' + esc(item) + '</label>'; }).join('') + '</div>' : '') +
      (sub.review && sub.review.decision === 'revision' ? '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px;margin-bottom:12px"><b style="font-size:11px;color:#b91c1c">Mentor meminta revisi</b><p style="font-size:11px;color:#475569;margin-top:4px">' + esc(sub.review.text || '') + '</p></div>' : '') +
      historyHtml + '<label style="display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:5px">Jawaban / catatan pengerjaan</label>' +
      '<textarea id="customTaskText" rows="5" style="width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:11px;font:inherit;font-size:12px;resize:vertical" placeholder="Tulis hasil pekerjaanmu...">' + esc(sub.text || '') + '</textarea>' +
      '<label style="display:block;font-size:12px;font-weight:700;color:#334155;margin:10px 0 5px">Link hasil (opsional)</label>' +
      '<input id="customTaskLink" type="url" value="' + esc(sub.link || '') + '" placeholder="https://..." style="width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px;font-size:12px">' +
      '<div id="customTaskFiles" style="margin-top:10px">' + customAttachmentHtml(sub.files) + '</div>' +
      '<button id="customTaskFile" type="button" style="border:1px solid #1a5f4f;background:#fff;color:#1a5f4f;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:700;cursor:pointer">📎 Pilih File</button>' +
      '<p id="customTaskSaved" style="display:inline-block;margin-left:8px;font-size:10px;color:#16a34a"></p>' +
      '<div style="border-top:1px solid #e2e8f0;margin-top:12px;padding-top:10px"><p style="font-size:11px;font-weight:800;color:#334155">Diskusi tugas</p><div style="max-height:90px;overflow:auto;margin:6px 0">' + (sub.discussion.length ? sub.discussion.map(function (m) { return '<p style="font-size:10px;color:#475569;margin:4px 0"><b>' + esc(m.from) + ':</b> ' + esc(m.text) + '</p>'; }).join('') : '<p style="font-size:10px;color:#94a3b8">Belum ada percakapan.</p>') + '</div><div style="display:flex;gap:6px"><input id="customTaskQuestion" placeholder="Tanya mentor..." style="flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:8px;font-size:11px"><button id="customTaskAsk" type="button" style="border:0;background:#8b5cf6;color:#fff;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:800">Kirim</button></div></div>' +
      '<button id="customTaskSubmit" type="button" style="margin-top:12px;width:100%;border:0;background:#f97316;color:#fff;border-radius:12px;padding:11px;font-size:13px;font-weight:800;cursor:pointer">' + (sub.submittedAt ? 'Perbarui Pengumpulan' : 'Kumpulkan Tugas') + '</button>',
      function (box, close) {
        function renderCustomFiles() {
          var wrap = $('#customTaskFiles', box);
          wrap.innerHTML = customAttachmentHtml(sub.files);
          $all('[data-custom-file-remove]', wrap).forEach(function (b) {
            b.addEventListener('click', function () {
              var file = sub.files[+b.getAttribute('data-custom-file-remove')];
              if (!file) return;
              if (!confirm('Hapus "' + (file.name || 'berkas') + '" dari tugas dan pindahkan ke Sampah Drive pusat?')) return;
              b.disabled = true; b.textContent = '…';
              deleteUploadedDriveFile(file).then(function () {
                sub.files = sub.files.filter(function (item) { return item !== file; });
                S.assignmentSubmissions[task.id] = sub; saveState();
                structuredSubmissionSave(task, sub);
                renderCustomFiles();
                toast('File dihapus dari tugas dan dipindahkan ke Sampah Drive pusat', '🗑️');
              }).catch(function (error) {
                b.disabled = false; b.textContent = '×';
                toast('File belum dihapus: ' + error.message, '⚠️');
              });
            });
          });
        }
        renderCustomFiles();
        $all('[data-task-check]', box).forEach(function (c) {
          c.addEventListener('change', function () { sub.checks[c.getAttribute('data-task-check')] = c.checked; S.assignmentSubmissions[task.id] = sub; saveState(); });
        });
        var draftTimer;
        function autoSaveDraft() {
          clearTimeout(draftTimer); draftTimer = setTimeout(function () {
            sub.text = $('#customTaskText', box).value; sub.link = $('#customTaskLink', box).value.trim(); sub.draftAt = new Date().toISOString();
            S.assignmentSubmissions[task.id] = sub; saveState();
            structuredSubmissionSave(task, sub);
            var saved = $('#customTaskSaved', box); if (saved) saved.textContent = '✓ Draft tersimpan otomatis';
          }, 650);
        }
        $('#customTaskText', box).addEventListener('input', autoSaveDraft);
        $('#customTaskLink', box).addEventListener('input', autoSaveDraft);
        $('#customTaskAsk', box).addEventListener('click', function () {
          var q = $('#customTaskQuestion', box).value.trim(); if (!q) return;
          sub.discussion.push({ from: (mySession() || {}).name || MENTEES[MID].name, role: 'mentee', text: q, at: new Date().toISOString() });
          S.assignmentSubmissions[task.id] = sub;
          pushEvent('💬', MENTEES[MID].name + ' bertanya tentang "' + task.title + '"', 'mentor', 'mentor-review.html');
          addAudit('assignment.question', task.title, task.id); saveState();
          structuredSubmissionSave(task, sub).then(function () { structuredDiscussionSave(MID, task, q); });
          close(); toast('Pertanyaan dikirim ke mentor', '💬');
          if (onDone) onDone();
        });
        wireCustomAssignmentFile($('#customTaskFile', box), task, sub, renderCustomFiles);
        $('#customTaskSubmit', box).addEventListener('click', function () {
          var text = $('#customTaskText', box).value.trim();
          var link = $('#customTaskLink', box).value.trim();
          if (!text && !link && !(sub.files || []).length) { toast('Isi jawaban, link, atau unggah file terlebih dahulu', '✏️'); return; }
          sub.text = text; sub.link = link;
          var now = new Date().toISOString();
          sub.submittedAt = now; sub.review = null; sub.status = 'review';
          S.assignmentSubmissions[task.id] = sub;
          S.portfolio = (S.portfolio || []).filter(function (p) { return p.taskId !== task.id; });
          S.portfolio.unshift({ taskId: task.id, title: task.title, link: link, files: (sub.files || []).slice(), submittedAt: now });
          addAudit('assignment.submit', task.title, task.id);
          pushEvent('📥', ((mySession() || {}).name || MENTEES[MID].name) + ' mengumpulkan tugas "' + task.title + '"', 'mentor');
          saveState(); structuredSubmissionSave(task, sub, true).then(saveState); close(); toast('Tugas berhasil dikumpulkan ke mentor', '✅'); confetti();
          if (onDone) onDone();
        });
      }
    );
  }
  function mountInlineTaskSubmission(view, task, onClose) {
    if (!view || PAGE.indexOf('assignment-submission') !== 0) return false;
    var left = $('main > div.px-8 > div.grid > div.col-span-2');
    if (!left) return false;
    var previous = document.getElementById('ftg-inline-task-workspace');
    if (previous) previous.remove();
    var builtIn = [byId('assignment-brief'), byId('submission-form')].filter(Boolean);
    builtIn.forEach(function (section) { section.style.display = 'none'; });
    var workspace = document.createElement('section');
    workspace.id = 'ftg-inline-task-workspace';
    workspace.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 overflow-hidden';
    var toolbar = document.createElement('div');
    toolbar.className = 'ftg-inline-task-toolbar';
    toolbar.innerHTML = '<div><span>TUGAS DARI MENTOR</span><p>' + esc(task.title) + '</p></div><button type="button" aria-label="Tutup tugas">×</button>';
    workspace.appendChild(toolbar);
    view.box.classList.remove('ftg-modal-box');
    view.box.classList.add('ftg-inline-task-box');
    view.box.removeAttribute('style');
    workspace.appendChild(view.box);
    if (view.detach) view.detach();
    else if (view.overlay) view.overlay.remove();
    left.insertBefore(workspace, left.firstChild);
    function restore() {
      builtIn.forEach(function (section) { section.style.display = ''; });
      workspace.remove();
      if (onClose) onClose();
    }
    toolbar.querySelector('button').addEventListener('click', function () { view.close(); restore(); });
    setTimeout(function () { workspace.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
    return true;
  }
  function mountMenteeAssignments() {
    if (!/^(mentee-dashboard|assignment-submission)/.test(PAGE)) return;
    var old = document.getElementById('ftg-assigned-tasks'); if (old) old.remove();
    var tasks = assignmentsForMentee(MID);
    if (!tasks.length) return;
    var panel = document.createElement('section');
    panel.id = 'ftg-assigned-tasks';
    panel.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">📚 Tugas dari Mentor</h2><p style="font-size:11px;color:#64748b">Kerjakan sesuai deadline dan kirim langsung dari sini.</p></div><span style="background:#fff7ed;color:#ea580c;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800">' + tasks.length + ' tugas</span></div>' +
      '<div style="display:grid;gap:10px">' + tasks.map(function (task) {
        var sub = taskSubmission(MID, task.id);
        var reviewed = sub && sub.review && sub.review.decision !== 'revision', sent = sub && sub.submittedAt;
        var life = assignmentStatus(task, sub), color = life.color, status = life.label;
        return '<article style="border:1px solid ' + color + ';border-radius:13px;padding:12px;display:flex;gap:12px;align-items:center;justify-content:space-between">' +
          '<div><p style="font-size:13px;font-weight:800;color:#1e293b">' + esc(task.title) + '</p><p style="font-size:11px;color:#64748b;margin-top:2px">' + esc(dueLabel(task.deadline)) + ' · +' + (+task.points || 0) + ' poin</p><p style="font-size:10px;color:' + color + ';font-weight:800;margin-top:4px">' + status + '</p></div>' +
          '<button type="button" data-open-mentor-task="' + esc(task.id) + '" style="border:0;background:' + color + ';color:#fff;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap">' + (reviewed ? 'Lihat Nilai' : (life.key === 'revision' ? 'Revisi' : (sent ? 'Edit' : 'Kerjakan'))) + '</button></article>';
      }).join('') + '</div>';
    var mainWrap = $('main > div.px-8');
    if (mainWrap) mainWrap.insertBefore(panel, mainWrap.firstChild);
    $all('[data-open-mentor-task]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var task = assignmentFor(b.getAttribute('data-open-mentor-task'));
        if (task) {
          var inlineWorkspace = null;
          function done() {
            if (inlineWorkspace) inlineWorkspace.remove();
            [byId('assignment-brief'), byId('submission-form')].filter(Boolean).forEach(function (section) { section.style.display = ''; });
            mountMenteeAssignments();
          }
          var view = openTaskSubmission(task, done);
          if (view && mountInlineTaskSubmission(view, task, mountMenteeAssignments)) inlineWorkspace = document.getElementById('ftg-inline-task-workspace');
        }
      });
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
  LESSONS.w3 = {
    title: '📖 Materi Minggu 3 — IDEATE',
    badge: '<span style="background:#22c55e;color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:99px">🔓 BARU TERBUKA</span>',
    body:
      '<p style="font-size:13px;color:#475569;margin-bottom:10px"><b>IDEATE = membuka semua kemungkinan solusi.</b> Setelah masalahmu tajam (DEFINE), sekarang saatnya bebas berimajinasi — kuantitas dulu, kualitas belakangan.</p>' +
      '<div style="background:#22c55e;border-radius:12px;padding:14px;margin-bottom:10px">' +
      '<p style="font-size:11px;font-weight:700;color:#fff;opacity:.85;margin-bottom:4px">ATURAN EMAS BRAINSTORM</p>' +
      '<p style="font-size:13px;font-weight:700;color:#fff">Tunda penilaian. Tulis 10+ ide dulu — ide "aneh" sering jadi benih terbaik.</p></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px">' +
      '<p style="font-size:12px;font-weight:700;color:#334155;margin-bottom:6px">Langkah minggu ini:</p>' +
      '<p style="font-size:12px;color:#475569;margin-bottom:4px">1️⃣ Brainstorm minimal 10 ide solusi untuk problem statement-mu</p>' +
      '<p style="font-size:12px;color:#475569;margin-bottom:4px">2️⃣ Saring dengan pertanyaan: mana yang menguntungkan komunitas?</p>' +
      '<p style="font-size:12px;color:#475569;margin-bottom:4px">3️⃣ Uji keselarasan nilai & etika setiap ide terpilih</p>' +
      '<p style="font-size:12px;color:#475569">4️⃣ Isi kolom IDEATE di canvas dengan 3 jawaban terbaikmu</p></div>' +
      '<p style="font-size:12px;color:#64748b">💡 <b>Prophetic lens:</b> ide terbaik bukan yang paling menguntungkanmu, tapi yang paling banyak manfaatnya bagi orang lain.</p>'
  };

  function lessonModal(key) {
    var L = LESSONS[key];
    if (!L) return;
    var alreadyDone = S.lessons && S.lessons[key];
    modal(
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><h3 style="font-weight:800;color:#2c3e50;font-size:16px">' + L.title + '</h3>' + L.badge + '</div>' +
      L.body +
      '<button id="lsClose" style="margin-top:14px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">' +
      (key === 'w2' && !alreadyDone ? '✓ Tandai Selesai Dibaca' : 'Mengerti — Lanjut Kerjakan') + '</button>',
      function (box, close) {
        $('#lsClose', box).addEventListener('click', function () {
          if (key === 'w2' && !(S.lessons && S.lessons[key])) {
            S.lessons = S.lessons || {};
            S.lessons[key] = true;
            pushEvent('📖', 'Materi DEFINE (W2) selesai dibaca — Lessons +1', 'mentee');
            saveState();
            toast('Materi W2 selesai — Lessons Selesai bertambah!', '📖');
          }
          close();
        });
      }
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
          var meta = f && typeof f === 'object' ? f : {};
          var nm = meta.name || f;
          var link = typeof meta.link === 'string' ? meta.link : '';
          var pendingTitle = meta.pendingReason ? (' — ' + meta.pendingReason) : '';
          var body = link
            ? '<a href="' + esc(link) + '" target="_blank" rel="noopener" style="color:#fff;text-decoration:none">📄 ' + esc(nm) + ' <span style="opacity:.75">↗ Drive</span></a>'
            : '📎 ' + esc(nm) + (meta.pending ? ' <span style="opacity:.75">(belum diunggah)</span>' : '');
          return '<span title="' + esc((meta.folder || '') + pendingTitle) + '" style="background:' + (link ? '#1a5f4f' : '#94a3b8') + ';color:#fff;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;display:inline-flex;align-items:center;gap:6px">' + body +
            '<button type="button" data-fdel="' + i + '" title="Hapus dari tugas dan Drive pusat" aria-label="Hapus ' + esc(nm) + '" style="border:0;background:transparent;color:#fff;cursor:pointer;opacity:.75;font-weight:800">×</button></span>';
        }).join('');
        $all('[data-fdel]', fileWrap).forEach(function (x) {
          x.addEventListener('click', function () {
            var file = S.files[+x.getAttribute('data-fdel')];
            var name = file && typeof file === 'object' ? file.name : file;
            if (!confirm('Hapus "' + (name || 'berkas') + '" dari tugas dan pindahkan ke Sampah Drive pusat?')) return;
            x.disabled = true; x.textContent = '…';
            deleteUploadedDriveFile(file).then(function () {
              S.files = S.files.filter(function (item) { return item !== file; });
              saveState(); renderFiles();
              toast('File dihapus dari tugas dan dipindahkan ke Sampah Drive pusat', '🗑️');
            }).catch(function (error) {
              x.disabled = false; x.textContent = '×';
              toast('File belum dihapus: ' + error.message, '⚠️');
            });
          });
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

  function openAssignmentEditor(task, onSaved) {
    task = task || null;
    var defaultDeadline = localDateTimeValue(defaultAssignmentDeadline(7));
    var minimumDeadline = localDateTimeValue(new Date(Date.now() + 5 * 60000));
    var selected = task ? (task.targets || []).slice() : menteeIds().slice();
    var defaultRubric = [{ label: 'Kedalaman analisis', weight: 40, max: 100 }, { label: 'Keselarasan nilai', weight: 25, max: 100 }, { label: 'Kualitas refleksi', weight: 20, max: 100 }, { label: 'Ketepatan waktu', weight: 15, max: 100 }];
    var rubric = task && task.rubric ? task.rubric : defaultRubric;
    var adminRubrics = (G.programSettings && G.programSettings.rubricTemplates) || [];
    modal(
      '<h3 style="font-weight:800;color:#1e293b;font-size:17px;margin-bottom:3px">' + (task ? '✏️ Edit Tugas' : '➕ Berikan Tugas Baru') + '</h3>' +
      '<p style="font-size:11px;color:#64748b;margin-bottom:14px">Tugas dan notifikasi langsung muncul pada akun mentee. Durasi standar otomatis <b>1 minggu</b> dan dapat diubah mentor.</p>' +
      (!task && G.assignmentTemplates.length ? '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin-bottom:4px">Gunakan template</label><select id="mentorTaskTemplatePick" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:11px;background:#fff;margin-bottom:9px"><option value="">Mulai dari kosong</option>' + G.assignmentTemplates.map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.title) + '</option>'; }).join('') + '</select>' : '') +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin-bottom:4px">Judul tugas *</label>' +
      '<input id="mentorTaskTitle" value="' + esc(task ? task.title : '') + '" placeholder="Contoh: Riset Masalah Pengguna" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px;margin-bottom:10px">' +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin-bottom:4px">Instruksi *</label>' +
      '<textarea id="mentorTaskDesc" rows="4" placeholder="Tuliskan tujuan, langkah pengerjaan, dan output yang diharapkan..." style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px;resize:vertical;margin-bottom:10px">' + esc(task ? task.description : '') + '</textarea>' +
      '<div style="display:grid;grid-template-columns:1fr 110px;gap:9px"><div><label style="font-size:11px;font-weight:800;color:#334155;display:block;margin-bottom:4px">Tanggal &amp; jam deadline *</label><input id="mentorTaskDeadline" type="datetime-local" min="' + esc(minimumDeadline) + '" value="' + esc(task ? localDateTimeValue(task.deadline) : defaultDeadline) + '" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:12px"></div>' +
      '<div><label style="font-size:11px;font-weight:800;color:#334155;display:block;margin-bottom:4px">Poin</label><input id="mentorTaskPoints" type="number" min="0" max="500" value="' + (task ? (+task.points || 0) : 50) + '" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px;font-size:12px"></div></div>' +
      '<div style="display:flex;align-items:center;gap:6px;margin-top:7px"><span style="font-size:10px;color:#64748b">Atur cepat:</span><button type="button" class="ftg-deadline-preset" data-deadline-days="3" aria-pressed="false">3 hari</button><button type="button" class="ftg-deadline-preset' + (task ? '' : ' is-active') + '" data-deadline-days="7" aria-pressed="' + (task ? 'false' : 'true') + '">1 minggu</button><button type="button" class="ftg-deadline-preset" data-deadline-days="14" aria-pressed="false">2 minggu</button></div>' +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin:10px 0 4px">Link materi/referensi (opsional)</label>' +
      '<input id="mentorTaskLink" type="url" value="' + esc(task ? (task.referenceLink || '') : '') + '" placeholder="https://..." style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px">' +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin:10px 0 4px">Checklist pengerjaan (satu langkah per baris)</label>' +
      '<textarea id="mentorTaskChecklist" rows="3" placeholder="Baca brief&#10;Kerjakan analisis&#10;Periksa kembali hasil" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px;resize:vertical">' + esc(task ? (task.checklist || []).join('\n') : '') + '</textarea>' +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin:10px 0 4px">Rubrik penilaian (kriteria | bobot | nilai maksimum)</label>' +
      (adminRubrics.length ? '<select id="mentorRubricTemplate" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:8px;background:#fff;margin-bottom:6px"><option value="">Pilih template rubrik panitia</option>' + adminRubrics.map(function(r,i){return '<option value="'+i+'">'+esc(r.name)+'</option>';}).join('') + '</select>' : '') +
      '<textarea id="mentorTaskRubric" rows="4" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:12px;resize:vertical">' + esc(rubric.map(function (r) { return r.label + ' | ' + r.weight + ' | ' + (r.max || 100); }).join('\n')) + '</textarea>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:11px 0 6px"><label style="font-size:11px;font-weight:800;color:#334155">Berikan kepada *</label><button id="mentorTaskAll" type="button" style="border:0;background:#e8f5ef;color:#166534;border-radius:8px;padding:5px 8px;font-size:10px;font-weight:800;cursor:pointer">Pilih Semua</button></div>' +
      '<div id="mentorTaskTargets" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:130px;overflow:auto">' + menteeIds().map(function (id) {
        var m = MENTEES[id];
        return '<label style="display:flex;align-items:center;gap:7px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;padding:7px;font-size:11px;color:#334155;cursor:pointer"><input type="checkbox" value="' + id + '" ' + (selected.indexOf(id) > -1 ? 'checked' : '') + '> ' + esc(m.name) + '</label>';
      }).join('') + '</div>' +
      '<label style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:11px;color:#475569"><input id="mentorTaskTemplate" type="checkbox"> Simpan juga sebagai template mentor</label>' +
      '<button id="mentorTaskSave" type="button" style="margin-top:12px;width:100%;border:0;background:#1a5f4f;color:#fff;border-radius:12px;padding:11px;font-size:13px;font-weight:800;cursor:pointer">' + (task ? 'Simpan Perubahan' : 'Berikan Tugas & Kirim Notifikasi') + '</button>',
      function (box, close) {
        var rubricTemplate = $('#mentorRubricTemplate', box);
        if (rubricTemplate) rubricTemplate.addEventListener('change', function () { var picked=adminRubrics[+this.value]; if(picked) $('#mentorTaskRubric',box).value=(picked.criteria||[]).map(function(r){return r.label+' | '+r.weight+' | '+(r.max||100);}).join('\n'); });
        var templatePick = $('#mentorTaskTemplatePick', box);
        if (templatePick) templatePick.addEventListener('change', function () {
          var t = G.assignmentTemplates.filter(function (x) { return x.id === templatePick.value; })[0]; if (!t) return;
          $('#mentorTaskTitle', box).value = t.title || ''; $('#mentorTaskDesc', box).value = t.description || ''; $('#mentorTaskPoints', box).value = t.points || 0; $('#mentorTaskLink', box).value = t.referenceLink || ''; $('#mentorTaskChecklist', box).value = (t.checklist || []).join('\n'); $('#mentorTaskRubric', box).value = (t.rubric || []).map(function (r) { return r.label + ' | ' + r.weight + ' | ' + (r.max || 100); }).join('\n');
        });
        $('#mentorTaskAll', box).addEventListener('click', function () {
          $all('#mentorTaskTargets input', box).forEach(function (c) { c.checked = true; });
        });
        $all('[data-deadline-days]', box).forEach(function (button) {
          button.addEventListener('click', function () {
            $('#mentorTaskDeadline', box).value = localDateTimeValue(defaultAssignmentDeadline(+button.getAttribute('data-deadline-days')));
            $all('[data-deadline-days]', box).forEach(function (item) {
              var active = item === button;
              item.classList.toggle('is-active', active);
              item.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
          });
        });
        $('#mentorTaskDeadline', box).addEventListener('input', function () {
          $all('[data-deadline-days]', box).forEach(function (item) {
            item.classList.remove('is-active'); item.setAttribute('aria-pressed', 'false');
          });
        });
        $('#mentorTaskSave', box).addEventListener('click', function () {
          var saveButton = this;
          if (saveButton.disabled || saveButton.getAttribute('aria-busy') === 'true') return;
          var title = $('#mentorTaskTitle', box).value.trim();
          var desc = $('#mentorTaskDesc', box).value.trim();
          var deadline = $('#mentorTaskDeadline', box).value;
          var targets = $all('#mentorTaskTargets input', box).filter(function (c) { return c.checked; }).map(function (c) { return +c.value; });
          if (!title || !desc || !deadline) { toast('Judul, instruksi, dan deadline wajib diisi', '⚠️'); return; }
          var deadlineAt = new Date(deadline);
          if (isNaN(deadlineAt.getTime()) || deadlineAt <= new Date()) { toast('Deadline harus berada setelah waktu sekarang', '⚠️'); return; }
          if (!targets.length) { toast('Pilih minimal satu mentee', '⚠️'); return; }
          var checklist = $('#mentorTaskChecklist', box).value.split(/\r?\n/).map(function (v) { return v.trim(); }).filter(Boolean);
          var rubricRows = $('#mentorTaskRubric', box).value.split(/\r?\n/).map(function (line) {
            var parts = line.split('|');
            return { label: (parts[0] || '').trim(), weight: Math.max(0, +(parts[1] || 0)), max: Math.max(1, +(parts[2] || 100)) };
          }).filter(function (r) { return r.label && r.weight; });
          var weightTotal = rubricRows.reduce(function (sum, r) { return sum + r.weight; }, 0);
          if (!rubricRows.length || weightTotal !== 100) { toast('Total bobot rubrik harus tepat 100%', '⚠️'); return; }
          var isNew = !task;
          var candidate = Object.assign({}, task || {
            id: 'task-' + Date.now(),
            createdAt: new Date().toISOString(),
            createdBy: (mySession() || {}).name || 'Mentor',
            active: true
          }, {
            title: title,
            description: desc,
            deadline: deadlineAt.toISOString(),
            points: Math.max(0, +$('#mentorTaskPoints', box).value || 0),
            referenceLink: $('#mentorTaskLink', box).value.trim(),
            targets: targets,
            checklist: checklist,
            rubric: rubricRows,
            updatedAt: new Date().toISOString()
          });
          var originalLabel = saveButton.innerHTML;
          saveButton.disabled = true;
          saveButton.setAttribute('aria-busy', 'true');
          saveButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan tugas…';
          structuredAssignmentSave(candidate, true).then(function (result) {
            if (isNew) {
              task = candidate;
              mentorAssignments().unshift(task);
            } else {
              Object.assign(task, candidate);
            }
            targets.forEach(function (id) {
              pushEventTo(id, isNew ? '📚' : '✏️', (isNew ? 'Tugas baru dari ' + currentMentorName() + ': ' : 'Tugas diperbarui: ') + title + ' · ' + dueLabel(task.deadline), 'mentee');
            });
            if ($('#mentorTaskTemplate', box).checked) {
              G.assignmentTemplates.unshift({ id: 'tpl-' + Date.now(), title: title, description: desc, points: task.points, referenceLink: task.referenceLink, checklist: checklist, rubric: rubricRows, at: new Date().toISOString() });
            }
            addAudit(isNew ? 'assignment.create' : 'assignment.update', title, targets.join(','));
            saveState();
            close();
            toast(result && result.notificationError ? 'Tugas tersimpan. Notifikasi otomatis tertunda dan dapat dikirim ulang dari panel Fasil.' : (isNew ? 'Tugas diberikan dan notifikasi terkirim' : 'Perubahan tugas tersimpan'), result && result.notificationError ? '⚠️' : '✅');
            if (onSaved) onSaved(task);
          }).catch(function (error) {
            saveButton.disabled = false;
            saveButton.removeAttribute('aria-busy');
            saveButton.innerHTML = originalLabel;
            toast((error && error.message) || 'Tugas gagal disimpan. Periksa koneksi lalu coba lagi.', '⚠️');
            console.error('Assignment save failed:', error);
          });
        });
      }
    );
  }

  function mountMentorAssignmentManager() {
    if (PAGE.indexOf('mentor-review') !== 0) return;
    var old = document.getElementById('mentor-assignment-manager'); if (old) old.remove();
    var wrap = $('main > div.px-8'); if (!wrap) return;
    var tasks = mentorAssignments().slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var panel = document.createElement('section');
    panel.id = 'mentor-assignment-manager';
    panel.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">📚 Tugas yang Diberikan</h2><p style="font-size:11px;color:#64748b">Buat tugas, tentukan penerima, dan pantau pengumpulan setiap mentee.</p></div><button id="btn-create-assignment" type="button" style="border:0;background:#f97316;color:#fff;border-radius:11px;padding:10px 14px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">+ Berikan Tugas</button></div>' +
      (tasks.length ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px">' + tasks.map(function (task) {
        var targets = task.targets || [], submitted = 0, reviewed = 0;
        targets.forEach(function (id) { var s = taskSubmission(id, task.id); if (s && s.submittedAt) submitted++; if (s && s.review) reviewed++; });
        return '<article style="border:1px solid #e2e8f0;border-radius:13px;padding:12px;opacity:' + (task.active === false ? '.58' : '1') + '"><div style="display:flex;justify-content:space-between;gap:8px"><p style="font-size:13px;font-weight:800;color:#1e293b">' + esc(task.title) + '</p><span style="font-size:9px;font-weight:800;color:' + (task.active === false ? '#64748b' : '#16a34a') + '">' + (task.active === false ? 'DIARSIPKAN' : 'AKTIF') + '</span></div><p style="font-size:10px;color:#64748b;margin:4px 0 8px">' + esc(dueLabel(task.deadline)) + ' · ' + targets.length + ' mentee · +' + (+task.points || 0) + ' poin</p>' +
          '<div style="display:flex;gap:6px;margin-bottom:9px"><span style="background:#f1f5f9;border-radius:8px;padding:4px 7px;font-size:10px;color:#475569">' + submitted + '/' + targets.length + ' dikumpulkan</span><span style="background:#ecfdf5;border-radius:8px;padding:4px 7px;font-size:10px;color:#166534">' + reviewed + ' dinilai</span></div>' +
          '<div style="display:flex;gap:7px"><button type="button" data-edit-assignment="' + esc(task.id) + '" style="flex:1;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:8px;padding:6px;font-size:10px;font-weight:800;cursor:pointer">Edit</button><button type="button" data-toggle-assignment="' + esc(task.id) + '" style="flex:1;border:0;background:#1a5f4f;color:#fff;border-radius:8px;padding:6px;font-size:10px;font-weight:800;cursor:pointer">' + (task.active === false ? 'Aktifkan' : 'Arsipkan') + '</button></div></article>';
      }).join('') + '</div>' : '<div style="border:1px dashed #cbd5e1;border-radius:13px;padding:18px;text-align:center;color:#94a3b8;font-size:12px">Belum ada tugas buatan mentor. Klik “Berikan Tugas” untuk memulai.</div>');
    wrap.insertBefore(panel, wrap.firstChild);
    $('#btn-create-assignment', panel).addEventListener('click', function () { openAssignmentEditor(null, mountMentorAssignmentManager); });
    $all('[data-edit-assignment]', panel).forEach(function (b) { b.addEventListener('click', function () { openAssignmentEditor(assignmentFor(b.getAttribute('data-edit-assignment')), mountMentorAssignmentManager); }); });
    $all('[data-toggle-assignment]', panel).forEach(function (b) {
      b.addEventListener('click', function () {
        var task = assignmentFor(b.getAttribute('data-toggle-assignment')); if (!task) return;
        task.active = task.active === false; task.updatedAt = new Date().toISOString();
        (task.targets || []).forEach(function (id) { pushEventTo(id, task.active ? '📚' : '📦', 'Tugas "' + task.title + '" ' + (task.active ? 'diaktifkan kembali' : 'diarsipkan') + ' oleh mentor', 'mentee'); });
        saveState(); structuredAssignmentSave(task); mountMentorAssignmentManager(); toast(task.active ? 'Tugas diaktifkan kembali' : 'Tugas diarsipkan', '✅');
      });
    });
  }

  function customPendingCount() {
    var n = 0;
    mentorAssignments().forEach(function (task) {
      (task.targets || []).forEach(function (id) { var s = taskSubmission(id, task.id); if (s && s.submittedAt && !s.review) n++; });
    });
    return n;
  }

  function pendingCount() {
    var n = STATIC_QUEUE.filter(function (q) { return !mstate(q.m).reviews[q.week]; }).length;
    for (var i = 1; i <= 5; i++) {
      var st = mstate(i);
      if (st.submittedW2 && !st.reviewW2) n++;
    }
    return n + customPendingCount();
  }

  function refreshReviewNumbersUI() {
    var pending = pendingCount(), done = 0, scores = [];
    menteeIds().forEach(function (id) {
      var st = mstate(id);
      Object.keys(st.reviews || {}).forEach(function (key) { done++; scores.push(st.reviews[key].score); });
      Object.keys(st.assignmentSubmissions || {}).forEach(function (key) {
        var sub = st.assignmentSubmissions[key];
        if (sub && sub.review) { done++; scores.push(sub.review.score); }
      });
    });
    $all('[data-ftg-count]').forEach(function (el) { el.textContent = pending; });
    var p = document.getElementById('revPending'), d = document.getElementById('revDone'), a = document.getElementById('revAvg');
    if (p) p.textContent = pending;
    if (d) d.textContent = done;
    if (a) a.textContent = scores.length ? Math.round(scores.reduce(function (x, y) { return x + y; }, 0) / scores.length) + ' / 100' : 'Belum ada';
  }

  function attachmentLinks(st) {
    var files = (st.files || []);
    var links = (st.links || []);
    if (!files.length && !links.length) return '';
    return '<div style="margin-bottom:12px">' +
      files.map(function (f) {
        var meta = f && typeof f === 'object' ? f : {};
        var nm = meta.name || f;
        var link = typeof meta.link === 'string' ? meta.link : '';
        var download = meta.downloadLink || (meta.driveId ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(meta.driveId) : '');
        if (link && meta.sharedWithMentor !== false) return '<span title="' + esc(meta.folder || '') + '" style="display:inline-flex;align-items:center;gap:6px;background:#e8f5ef;color:#166534;font-size:11px;font-weight:700;padding:5px 8px 5px 12px;border-radius:12px;margin:0 6px 6px 0">📄 ' + esc(nm) +
          '<button type="button" data-drive-preview="' + esc(link) + '" data-drive-name="' + esc(nm) + '" data-drive-download="' + esc(download) + '" style="border:0;background:#1a5f4f;color:#fff;border-radius:8px;padding:5px 8px">Preview</button>' +
          (download ? '<a href="' + esc(download) + '" target="_blank" rel="noopener" style="background:#fff;color:#1a5f4f;border:1px solid #86efac;border-radius:8px;padding:4px 8px;text-decoration:none">Unduh</a>' : '') + '</span>';
        if (link && meta.sharedWithMentor === false) return '<span title="' + esc(meta.shareReason || '') + '" style="display:inline-flex;align-items:center;gap:6px;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;padding:7px 11px;border-radius:10px;margin:0 6px 6px 0">📄 ' + esc(nm) + ' · akses mentor tertunda</span>';
        return '<span title="' + esc((meta.folder || '') + (meta.pendingReason ? ' — ' + meta.pendingReason : '')) + '" style="display:inline-flex;align-items:center;gap:6px;background:#94a3b8;color:#fff;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;margin:0 6px 6px 0">📎 ' + esc(nm) + ' · belum diunggah</span>';
      }).join('') +
      links.map(function (l) {
        return '<a href="' + esc(l) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:600;padding:5px 12px;border-radius:99px;text-decoration:none;margin:0 6px 6px 0">🔗 ' + esc(l.length > 34 ? l.slice(0, 34) + '…' : l) + '</a>';
      }).join('') + '</div>';
  }

  function customReviewModal(menteeId, task, onDone) {
    var st = mstate(menteeId);
    var sub = taskSubmission(menteeId, task.id);
    if (!sub || !sub.submittedAt) return;
    var name = MENTEES[menteeId].name;
    modal(
      '<h3 style="font-weight:800;color:#1e293b;font-size:17px;margin-bottom:3px">📝 Review — ' + esc(name) + '</h3>' +
      '<p style="font-size:12px;color:#64748b;margin-bottom:12px">' + esc(task.title) + '</p>' +
      (sub.text ? '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:11px;max-height:150px;overflow:auto"><p style="font-size:10px;font-weight:800;color:#8b5cf6;margin-bottom:4px">JAWABAN MENTEE</p><p style="font-size:12px;color:#475569;white-space:pre-line">' + esc(sub.text) + '</p></div>' : '') +
      attachmentLinks({ files: sub.files || [], links: sub.link ? [sub.link] : [] }) + assignmentHistoryHtml(sub) +
      ((task.rubric || []).length ? '<div style="background:#f8fafc;border-radius:12px;padding:10px;margin-bottom:10px"><p style="font-size:11px;font-weight:800;color:#334155;margin-bottom:6px">Nilai per rubrik</p>' + task.rubric.map(function (r, i) { var max=r.max || 100; return '<label style="display:grid;grid-template-columns:1fr 86px;gap:8px;align-items:center;font-size:10px;color:#475569;margin:5px 0"><span>' + esc(r.label) + ' (' + r.weight + '%)</span><span><input type="number" min="0" max="'+max+'" value="'+Math.round(max*.85)+'" data-rubric-score="' + i + '" style="border:1px solid #cbd5e1;border-radius:8px;padding:5px;width:55px"> / '+max+'</span></label>'; }).join('') + '</div>' : '') +
      '<label style="font-size:12px;font-weight:700;color:#334155">Skor: <span id="customScoreVal" style="color:#1a5f4f;font-size:16px">85</span>/100</label>' +
      '<input id="customScoreRange" type="range" min="50" max="100" value="85" style="width:100%;margin:8px 0 14px;accent-color:#1a5f4f">' +
      '<label style="font-size:12px;font-weight:700;color:#334155;display:block;margin-bottom:6px">Feedback untuk mentee</label>' +
      '<textarea id="customFeedback" rows="3" placeholder="Tuliskan apresiasi dan bagian yang perlu diperbaiki..." style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;font-family:inherit;resize:none"></textarea>' +
      '<label style="font-size:11px;font-weight:800;color:#334155;display:block;margin:9px 0 4px">Keputusan</label><select id="customDecision" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-size:12px;background:#fff"><option value="approved">Setujui & selesai</option><option value="revision">Minta revisi mentee</option></select>' +
      '<input id="customMentorReply" placeholder="Balas diskusi (opsional)" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-size:11px;margin-top:8px">' +
      '<button id="customReviewSave" type="button" style="margin-top:12px;width:100%;border:0;background:#1a5f4f;color:#fff;border-radius:12px;padding:11px;font-size:13px;font-weight:800;cursor:pointer">Simpan Penilaian & Kirim Feedback</button>',
      function (box, close) {
        var range = $('#customScoreRange', box), val = $('#customScoreVal', box);
        function recalcRubric() {
          var inputs = $all('[data-rubric-score]', box);
          if (!inputs.length) return;
          var total = inputs.reduce(function (sum, inp, i) { var max=task.rubric[i].max || 100; return sum + (Math.max(0, Math.min(max, +inp.value || 0)) / max * 100) * task.rubric[i].weight / 100; }, 0);
          range.value = Math.round(total); val.textContent = Math.round(total);
        }
        range.addEventListener('input', function () { val.textContent = range.value; });
        $all('[data-rubric-score]', box).forEach(function (inp) { inp.addEventListener('input', recalcRubric); });
        $('#customReviewSave', box).addEventListener('click', function () {
          var text = $('#customFeedback', box).value.trim() || 'Kerja bagus! Pertahankan dan terus tingkatkan kualitasnya.';
          var decision = $('#customDecision', box).value;
          var rubricScores = $all('[data-rubric-score]', box).map(function (inp, i) { return { label: task.rubric[i].label, weight: task.rubric[i].weight, max:task.rubric[i].max || 100, score: +inp.value || 0 }; });
          sub.review = { score: +range.value, text: text, decision: decision, rubricScores: rubricScores, at: new Date().toISOString(), by: (mySession() || {}).name || 'Mentor' };
          var reply = $('#customMentorReply', box).value.trim();
          if (reply) { sub.discussion = sub.discussion || []; sub.discussion.push({ from: (mySession() || {}).name || 'Mentor', role: 'mentor', text: reply, at: new Date().toISOString() }); }
          sub.status = decision === 'revision' ? 'revision' : 'approved';
          st.assignmentSubmissions[task.id] = sub;
          addAudit(decision === 'revision' ? 'assignment.revision_requested' : 'assignment.approved', task.title, menteeId);
          pushEventTo(menteeId, '⭐', 'Tugas "' + task.title + '" dinilai ' + range.value + '/100 oleh ' + currentMentorName(), 'mentee');
          saveState(); structuredReviewSave(menteeId, task, sub); close(); toast('Penilaian ' + name + ' tersimpan', '⭐'); confetti();
          if (onDone) onDone();
        });
      }
    );
  }

  function paintCustomReviewCard(card, menteeId, task) {
    var sub = taskSubmission(menteeId, task.id);
    var name = MENTEES[menteeId].name.split(' ')[0];
    if (sub && sub.review && sub.review.decision !== 'revision') {
      card.className = 'bg-[#22c55e]/5 border border-[#22c55e]/20 rounded-xl p-3';
      card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">' + esc(name) + ' — ' + esc(task.title) + '</p><span class="text-[#22c55e] text-[10px] font-bold">✓ Dinilai</span></div><p class="text-slate-500 text-xs">Skor <b class="text-[#1a5f4f]">' + sub.review.score + '/100</b> · feedback terkirim ke mentee</p>';
      return;
    }
    card.className = 'bg-[#8b5cf6]/5 border-2 border-[#8b5cf6]/40 rounded-xl p-3';
    card.innerHTML = '<div class="flex items-center justify-between mb-1"><p class="text-[#2c3e50] text-xs font-semibold">🆕 ' + esc(name) + ' — ' + esc(task.title) + '</p><span class="text-[#8b5cf6] text-[10px] font-semibold">' + esc(timeAgo(sub.submittedAt)) + '</span></div><p class="text-slate-500 text-xs mb-2">Tugas buatan mentor · ' + ((sub.files || []).length ? (sub.files.length + ' lampiran') : 'tanpa lampiran') + '</p><button type="button" class="w-full bg-[#8b5cf6] text-white text-xs font-semibold py-1.5 rounded-lg">Review & Nilai</button>';
    $('button', card).addEventListener('click', function () {
      customReviewModal(menteeId, task, function () { paintCustomReviewCard(card, menteeId, task); refreshReviewNumbersUI(); });
    });
  }

  function renderCustomReviewCards(container) {
    if (!container) return;
    mentorAssignments().forEach(function (task) {
      (task.targets || []).forEach(function (menteeId) {
        var sub = taskSubmission(menteeId, task.id);
        if (!sub || !sub.submittedAt) return;
        var card = document.createElement('div');
        card.setAttribute('data-custom-review', task.id + '-' + menteeId);
        paintCustomReviewCard(card, menteeId, task);
        container.insertBefore(card, container.firstChild);
      });
    });
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
      '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">' +
      '<button type="button" class="ftg-tpl" data-tpl="0" style="background:#22c55e1a;color:#16a34a;border:1px solid #22c55e44;font-size:11px;font-weight:700;padding:5px 11px;border-radius:99px;cursor:pointer">🌟 Sangat baik</button>' +
      '<button type="button" class="ftg-tpl" data-tpl="1" style="background:#f973161a;color:#ea580c;border:1px solid #f9731644;font-size:11px;font-weight:700;padding:5px 11px;border-radius:99px;cursor:pointer">👍 Cukup, perlu dipertajam</button>' +
      '<button type="button" class="ftg-tpl" data-tpl="2" style="background:#8b5cf61a;color:#7c3aed;border:1px solid #8b5cf644;font-size:11px;font-weight:700;padding:5px 11px;border-radius:99px;cursor:pointer">🤝 Perlu bimbingan</button></div>' +
      '<textarea id="fbTxt" rows="3" placeholder="Klik template di atas lalu sesuaikan, atau tulis sendiri..." style="width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;font-family:inherit;outline:none;resize:none"></textarea>' +
      '<button id="fbSave" style="margin-top:12px;width:100%;background:#1a5f4f;color:#fff;font-weight:700;font-size:13px;padding:11px;border-radius:12px;border:0;cursor:pointer">Simpan Penilaian</button>',
      function (box, close) {
        var range = $('#scoreRange', box), val = $('#scoreVal', box);
        range.addEventListener('input', function () { val.textContent = range.value; });
        // template feedback sekali klik — tinggal diedit
        var first = name.split(' ')[0];
        var TPL = [
          'Kerja yang sangat baik, ' + first + '! Analisismu tajam dan refleksinya dalam. Pertahankan kualitas ini di minggu berikutnya. 🌟',
          'Sudah cukup baik, ' + first + '. Ada beberapa bagian yang bisa dipertajam — terutama kaitkan temuanmu dengan kebutuhan user yang paling mendesak. Coba perdalam lagi ya.',
          'Terima kasih sudah mengumpulkan, ' + first + '. Masih ada bagian yang perlu kita bahas bersama — yuk jadwalkan sesi 1-on-1 supaya bisa kubantu langsung. 🤝'
        ];
        var TPL_SCORE = [92, 78, 62];
        $all('.ftg-tpl', box).forEach(function (b) {
          b.addEventListener('click', function () {
            var i = +b.getAttribute('data-tpl');
            $('#fbTxt', box).value = TPL[i];
            range.value = TPL_SCORE[i];
            val.textContent = TPL_SCORE[i];
            $('#fbTxt', box).focus();
          });
        });
        $('#fbSave', box).addEventListener('click', function () {
          var text = $('#fbTxt', box).value.trim() || 'Kerja bagus! Pertahankan konsistensinya.';
          st.reviews[week] = { score: +range.value, text: text, at: new Date().toISOString() };
          if (week === 'w2') {
            st.reviewW2 = st.reviews[week];
            pushEventTo(menteeId, '⭐', 'Tugas W2 kamu dinilai ' + range.value + '/100 oleh ' + currentMentorName(), 'mentee');
            pushEventTo(menteeId, '🔓', 'Minggu 3 (IDEATE) terbuka! Materi & canvas baru menantimu', 'mentee');
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

    // deep-link dari halaman lain: langsung menuju bagian yang diminta
    if (location.hash) {
      var hash = location.hash;
      setTimeout(function () {
        if (hash === '#feedback') { pickMenteeModal('Berikan Feedback ke'); return; }
        var map = { '#mentee-list': 'mentee-list', '#pending-reviews': 'pending-reviews', '#group-progress': 'group-progress' };
        if (!map[hash]) return;
        var target = byId(map[hash]);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          flash(target);
        }
        // sorot item nav yang sesuai
        var label = { '#mentee-list': 'Mentee Saya', '#pending-reviews': 'Tugas & Review', '#group-progress': 'Progress Grup' }[hash];
        var navA = $all('aside nav a').filter(function (a) { return a.textContent.indexOf(label) > -1; })[0];
        if (navA) setActiveNav(navA);
      }, 450);
    }

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
      renderCustomReviewCards(container);
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

    // ringkasan review (halaman Tugas & Review)
    (function reviewSummary() {
      var pend = $('#revPending'), done = $('#revDone'), avg = $('#revAvg');
      if (!pend) return;
      var doneN = 0, scores = [];
      for (var i = 1; i <= 5; i++) {
        var st = mstate(i);
        Object.keys(st.reviews || {}).forEach(function (k) { doneN++; scores.push(st.reviews[k].score); });
        Object.keys(st.assignmentSubmissions || {}).forEach(function (taskId) {
          var subm = st.assignmentSubmissions[taskId];
          if (subm && subm.review) { doneN++; scores.push(subm.review.score); }
        });
      }
      pend.textContent = pendingCount();
      done.textContent = doneN;
      avg.textContent = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) + ' / 100' : 'Belum ada';
    })();

    // statistik grup dihitung dari data mentee sungguhan
    (function liveGroupStats() {
      var progs = [], scores = [], submitted = 0;
      for (var i = 1; i <= 5; i++) {
        var st = mstate(i);
        progs.push(MENTEES[i].baseProgress + (st.submittedW2 ? 17 : 0));
        if (st.submittedW2) submitted++;
        if (st.reviewW2) scores.push(st.reviewW2.score);
        if (st.reviews && st.reviews.w1) scores.push(st.reviews.w1.score);
      }
      if (!scores.length) scores = [87, 82, 84]; // basis W1 dari cerita program
      var avgProg = Math.round(progs.reduce(function (a, b) { return a + b; }, 0) / progs.length);
      var avgQ = Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length);
      var subRate = Math.round((3 + submitted) / 5 * 100); // 3 tugas W1 sudah masuk (cerita) + W2 live
      // kartu stat atas
      $all('main p').forEach(function (p) {
        var t = p.textContent.trim();
        if (t === '72%' && p.className.indexOf('text-2xl') > -1) p.textContent = avgProg + '%';
        if (t === '8.4' && p.className.indexOf('text-2xl') > -1) p.textContent = (avgQ / 10).toFixed(1);
      });
      // panel Progress Grup
      var panel = byId('group-progress');
      if (panel) {
        var pairs = [['Completion Rate', avgProg + '%', avgProg], ['Submission Rate', Math.min(subRate, 100) + '%', Math.min(subRate, 100)], ['Avg Quality Score', avgQ + ' / 100', avgQ]];
        pairs.forEach(function (pr) {
          var lbl = $all('span, p', panel).filter(function (el) { return el.textContent.trim() === pr[0]; })[0];
          if (!lbl) return;
          var rowWrap = lbl.parentElement;
          var val = $all('span, p', rowWrap).filter(function (el) { return el !== lbl; })[0];
          if (val) val.textContent = pr[1];
          var barOuter = rowWrap.nextElementSibling;
          var bar = barOuter && barOuter.querySelector('div');
          if (bar) bar.style.width = pr[2] + '%';
        });
      }
    })();

    // tombol sidebar & quick actions
    var sr = byId('btn-sidebar-review');
    if (sr) sr.addEventListener('click', function () { var q = byId('pending-reviews'); if (q) q.scrollIntoView({ behavior: 'smooth' }); });
    var rem = byId('btn-send-reminder');
    if (rem) rem.addEventListener('click', function () {
      pushEventTo(3, '⏰', 'Pengingat dari ' + currentMentorName() + ': segera selesaikan tugas mingguanmu!', 'mentee');
      saveState();
      toast('Pengingat terkirim ke Muhammad Rizky', '📨');
    });
    var sch = byId('btn-schedule-session');
    if (sch) sch.addEventListener('click', scheduleModal);
    var ann = byId('btn-group-announce');
    if (ann) ann.addEventListener('click', groupMessageModal);
    // filter mentee sungguhan: Semua -> Career -> Entrepreneur
    var flt = byId('btn-filter-mentee');
    if (flt) {
      var fltModes = [['Semua', ''], ['Career', 'Career'], ['Entrepreneur', 'Entrepreneur']];
      var fltIdx = 0;
      flt.addEventListener('click', function () {
        fltIdx = (fltIdx + 1) % fltModes.length;
        var mode = fltModes[fltIdx];
        var shown = 0;
        for (var i = 1; i <= 5; i++) {
          var row = byId('mentee-row-' + i);
          if (!row) continue;
          var match = !mode[1] || (MENTEES[i].path || '').indexOf(mode[1]) > -1;
          row.style.display = match ? '' : 'none';
          if (match) shown++;
        }
        flt.innerHTML = mode[1]
          ? '<i class="fa-solid fa-filter mr-1"></i>' + mode[0] + ' (' + shown + ')'
          : '<i class="fa-solid fa-filter mr-1"></i>Filter';
        var head = $all('h2, h3').filter(function (h) { return /Mentee Kamu/.test(h.textContent); })[0];
        if (head) head.textContent = '👥 Mentee Kamu (' + shown + ' orang)';
      });
    }
  }

  /* ================================================================
     PAGE: MENTOR FEEDBACK (mentee melihat feedback)
     ================================================================ */
  function initMentorFeedback() {
    var msgBtn = byId('btn-msg-mentor-mf');
    if (msgBtn) msgBtn.addEventListener('click', function () { messageModal(currentMentorName()); });

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
        toast('Balasan terkirim ke ' + currentMentorName(), '📨');
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
          if (/Kumpulkan tugasmu/.test(p.textContent)) p.textContent = 'Menunggu review dari ' + currentMentorName() + ' (biasanya < 24 jam)';
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
     PAGE: LEADERBOARD (LIVE) — 5 mentee dihitung dari data asli,
     digabung & diranking bersama peserta kohort lain
     ================================================================ */
  var LB_KPI_BASE = {
    1: [75, 87, 82, 78],
    2: [95, 94, 91, 88],
    3: [55, 68, 60, 62],
    4: [78, 80, 84, 76],
    5: [72, 78, 75, 74]
  };
  function liveKpi(i) {
    var st = mstate(i);
    var b = (LB_KPI_BASE[i] || [60, 70, 65, 65]).slice();
    if (st.submittedW2) { b[0] = Math.min(100, b[0] + 10); b[2] = Math.min(100, b[2] + 5); }
    if (st.reviewW2) { b[1] = Math.round((b[1] + st.reviewW2.score) / 2 + 3); b[3] = Math.min(100, b[3] + 4); }
    var streak = computeStreak(st.loginDays || []);
    if (streak >= 5) b[2] = Math.min(100, b[2] + 3);
    var total = Math.round((0.3 * b[0] + 0.4 * b[1] + 0.2 * b[2] + 0.1 * b[3]) * 10) / 10;
    var baseTotal = Math.round((0.3 * LB_KPI_BASE[i][0] + 0.4 * LB_KPI_BASE[i][1] + 0.2 * LB_KPI_BASE[i][2] + 0.1 * LB_KPI_BASE[i][3]) * 10) / 10;
    return { c: b[0], q: b[1], e: b[2], n: b[3], total: total, delta: Math.round((total - baseTotal) * 10) / 10 };
  }
  var LB_OTHERS = [
    ['Riana Pratiwi', 'Career', 'Bu Dewi', 88, 91, 89, 85, 89.4, '↑ +1.8'],
    ['Farhan Aditya', 'Entrep.', 'Pak Rizal', 86, 88, 87, 84, 87.1, '↑ +0.5'],
    ['Dewi Kartika', 'Career', 'Bu Dewi', 85, 84, 83, 80, 83.8, '↑'],
    ['Hendra Putra', 'Entrep.', 'Pak Rizal', 82, 86, 81, 82, 83.4, '−'],
    ['Ninda Safitri', 'Career', 'Bu Sinta', 80, 85, 84, 79, 83.2, '↓'],
    ['Yoga Pratama', 'Entrep.', 'Pak Hadi', 79, 83, 85, 77, 83.0, '↑']
  ];
  function initLeaderboardLive() {
    var table = byId('leaderboard-table');
    if (!table) return;
    var ses = mySession() || {};
    var myId = ses.role === 'mentee' ? myMenteeId() : 0;

    // susun 30 baris: 5 mentee live + kohort lain
    var rowsData = [];
    menteeIds().forEach(function (i) {
      if (i > 5 && !G.mentees[i]) return;
      var k = liveKpi(i <= 5 ? i : 1);
      if (i > 5) k = liveKpi(i); // mentee tambahan pakai basis default
      var m = MENTEES[i];
      rowsData.push({ live: true, id: i, name: m.name, path: /Entrep/.test(m.path) ? 'Entrep.' : 'Career', mentor: mentorNameForMentee(i) || 'Belum ditentukan',
        c: k.c, q: k.q, e: k.e, n: k.n, total: k.total, trend: (k.delta >= 0 ? '↑ +' : '↓ ') + Math.abs(k.delta).toFixed(1), color: m.color, initials: m.initials });
    });
    LB_OTHERS.concat(LB_EXTRA.map(function (p) { return [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8]]; })).forEach(function (p) {
      rowsData.push({ live: false, name: p[0], path: p[1], mentor: p[2], c: p[3], q: p[4], e: p[5], n: p[6], total: p[7], trend: typeof p[8] === 'string' ? p[8] : '−' });
    });
    // mentee live SELALU tampil; pengisi kohort dipangkas agar total 30
    var liveRows = rowsData.filter(function (r) { return r.live; });
    var fillRows = rowsData.filter(function (r) { return !r.live; })
      .sort(function (a, b) { return b.total - a.total; })
      .slice(0, Math.max(0, 30 - liveRows.length));
    rowsData = liveRows.concat(fillRows);
    rowsData.sort(function (a, b) { return b.total - a.total; });

    // render ulang isi tabel (sisakan baris judul kolom)
    var header = table.firstElementChild;
    table.innerHTML = '';
    table.appendChild(header);
    var medals = ['🥇', '🥈', '🥉'];
    rowsData.forEach(function (r, idx) {
      var isMe = r.live && r.id === myId;
      var row = document.createElement('div');
      row.setAttribute('data-lb-path', /Entrep/.test(r.path) ? 'ent' : 'career');
      row.className = 'px-6 py-3 grid grid-cols-12 gap-2 items-center border-b border-slate-50 text-xs' +
        (isMe ? ' bg-[#1a5f4f]/5' : (idx === 0 ? ' bg-[#f97316]/5' : ''));
      if (isMe) row.style.cssText = 'border-left:none;box-shadow:inset 0 0 0 1.5px rgba(26,95,79,.35);border-radius:4px;';
      var rank = idx < 3
        ? '<div class="w-7 h-7 rounded-full flex items-center justify-center text-sm" style="background:' + ['#f9731622', '#94a3b822', '#f59e0b22'][idx] + '">' + medals[idx] + '</div>'
        : '<span class="text-slate-400 font-bold">' + (idx + 1) + '</span>';
      var who = r.live
        ? '<div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style="background:' + r.color + '">' + r.initials + '</div>' +
          '<div class="min-w-0"><p class="text-[#2c3e50] font-bold truncate">' + esc(r.name) + (isMe ? ' <span class="text-[#1a5f4f] text-[10px]">(← Kamu)</span>' : '') + '</p>' +
          '<p class="text-slate-400 text-[10px]">Mentor: ' + esc(r.mentor) + '</p></div></div>'
        : '<div><p class="text-[#2c3e50] font-medium">' + esc(r.name) + '</p><p class="text-slate-400 text-[10px]">Mentor: ' + esc(r.mentor) + '</p></div>';
      var pathColor = /Entrep/.test(r.path) ? '#f97316' : '#8b5cf6';
      row.innerHTML =
        '<div class="col-span-1">' + rank + '</div>' +
        '<div class="col-span-3 min-w-0">' + who + '</div>' +
        '<div class="col-span-1 text-center"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="color:' + pathColor + ';background:' + pathColor + '1a">' + r.path + '</span></div>' +
        '<div class="col-span-1 text-center' + (r.live ? ' font-bold text-[#1a5f4f]' : '') + '">' + r.c + '</div>' +
        '<div class="col-span-1 text-center' + (r.live ? ' font-bold text-[#8b5cf6]' : '') + '">' + r.q + '</div>' +
        '<div class="col-span-1 text-center' + (r.live ? ' font-bold text-[#f97316]' : '') + '">' + r.e + '</div>' +
        '<div class="col-span-1 text-center' + (r.live ? ' font-bold text-[#22c55e]' : '') + '">' + r.n + '</div>' +
        '<div class="col-span-2 text-center"><span class="' + (isMe ? 'text-[#1a5f4f]' : 'text-[#2c3e50]') + ' text-base font-bold">' + r.total.toFixed(1) + '</span></div>' +
        '<div class="col-span-1 text-center" style="color:' + (r.trend.indexOf('↑') > -1 ? '#22c55e' : r.trend.indexOf('↓') > -1 ? '#ef4444' : '#94a3b8') + '">' + r.trend + '</div>';
      table.appendChild(row);
    });
    var foot = document.createElement('div');
    foot.className = 'px-6 py-2.5 text-center text-slate-400 text-xs';
    foot.textContent = 'Menampilkan ' + rowsData.length + ' peserta · 5 skor teratas dihitung live dari aktivitas platform';
    table.appendChild(foot);

    // banner posisi milik mentee yang login
    if (myId) {
      var me = rowsData.filter(function (r) { return r.live && r.id === myId; })[0];
      var myRank = rowsData.indexOf(me) + 1;
      var banner = byId('my-position');
      if (banner && me) {
        banner.innerHTML =
          '<div class="flex items-center gap-4"><div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style="background:' + me.color + '">#' + myRank + '</div>' +
          '<div><p class="text-white/60 text-xs">Posisi kamu saat ini</p><p class="text-white text-lg font-bold">' + esc(me.name) + ' — Ranking #' + myRank + '</p>' +
          '<p class="text-white/60 text-xs">dari 30 peserta · Top ' + Math.round(myRank / 30 * 100) + '%</p></div></div>' +
          '<div class="grid grid-cols-4 gap-4 text-center">' +
          '<div><p class="text-white text-xl font-bold">' + me.c + '</p><p class="text-white/50 text-xs">Completion</p></div>' +
          '<div><p class="text-[#8b5cf6] text-xl font-bold">' + me.q + '</p><p class="text-white/50 text-xs">Quality</p></div>' +
          '<div><p class="text-[#f97316] text-xl font-bold">' + me.e + '</p><p class="text-white/50 text-xs">Engagement</p></div>' +
          '<div><p class="text-[#22c55e] text-xl font-bold">' + me.n + '</p><p class="text-white/50 text-xs">Innovation</p></div></div>' +
          '<div class="text-right"><p class="text-white/60 text-xs mb-1">Total KPI Score</p><p class="text-white text-3xl font-bold">' + me.total.toFixed(1) + '</p>' +
          '<p class="text-[#f97316] text-xs">' + me.trend + ' dari basis minggu lalu</p></div>';
      }
    }

    // filter path
    var btns = { all: byId('btn-filter-all-lb'), career: byId('btn-filter-career-lb'), ent: byId('btn-filter-ent-lb') };
    function setFilter(which) {
      $all('[data-lb-path]', table).forEach(function (r) {
        r.style.display = (which === 'all' || r.getAttribute('data-lb-path') === which) ? '' : 'none';
      });
      Object.keys(btns).forEach(function (k) {
        var b = btns[k]; if (!b) return;
        b.className = k === which
          ? 'px-3 py-1.5 rounded-full bg-[#2c3e50] text-white text-xs font-semibold'
          : 'px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs';
      });
    }
    if (btns.all) btns.all.addEventListener('click', function () { setFilter('all'); });
    if (btns.career) btns.career.addEventListener('click', function () { setFilter('career'); });
    if (btns.ent) btns.ent.addEventListener('click', function () { setFilter('ent'); });
  }

  /* ================================================================
     PAGE: WORKSHOP LIBRARY
     ================================================================ */
  function workshopLocale(){return UI_LANGUAGE==='en'?'en-US':'id-ID';}
  function workshopDetails(session){modal('<div class="ftg-workshop-detail"><small>'+esc(session.track==='career'?'CAREER PATH':'ENTREPRENEUR PATH')+' · SESSION '+session.week+'</small><h3>'+esc(session.title)+'</h3><p><i class="fa-solid fa-calendar"></i> '+new Date(session.starts_at).toLocaleString(workshopLocale(),{weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})+' – '+new Date(session.ends_at).toLocaleTimeString(workshopLocale(),{hour:'2-digit',minute:'2-digit'})+'</p><article><b>Pre-Work</b><span>'+esc(session.pre_work||'Belum ada materi persiapan.')+'</span></article><article><b>Live Session</b><span>'+esc(session.live_work||'Workshop interaktif.')+'</span></article><article><b>Post-Work</b><span>'+esc(session.post_work||'Belum ada tugas lanjutan.')+'</span></article></div>');}
  function renderWorkshopSchedule(schedule){['career','entrepreneur'].forEach(function(track){var sessions=schedule.filter(function(item){return item.track===track;}),cards=$all('[data-design-id^="workshop-'+(track==='career'?'career':'ent')+'-"]');cards.forEach(function(card,index){var session=sessions[index];if(!session)return;card.hidden=session.published===false;var title=$('h3',card),date=$('h3 + p',card),button=$('button',card),open=session.access_mode==='open'||(session.access_mode==='automatic'&&Date.now()>=new Date(session.starts_at).getTime()),headerSpans=$all('div:first-child span',card);if(title)title.textContent=session.title;if(date)date.textContent=new Date(session.starts_at).toLocaleString(workshopLocale(),{weekday:'long',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' – '+new Date(session.ends_at).toLocaleTimeString(workshopLocale(),{hour:'2-digit',minute:'2-digit'});if(headerSpans[1])headerSpans[1].textContent=open?(UI_LANGUAGE==='en'?'Open':'Terbuka'):new Date(session.starts_at).toLocaleDateString(workshopLocale(),{day:'numeric',month:'short'});card.classList.toggle('opacity-70',!open);if(button){var fresh=button.cloneNode(true);button.parentNode.replaceChild(fresh,button);fresh.innerHTML=open?'<i class="fa-solid fa-book-open"></i> '+(UI_LANGUAGE==='en'?'Open Materials':'Buka Materi'):'<i class="fa-solid fa-lock"></i> '+(UI_LANGUAGE==='en'?'Opens ':'Terbuka ')+new Date(session.starts_at).toLocaleDateString(workshopLocale(),{day:'numeric',month:'short'});fresh.disabled=!open;fresh.className=open?'w-full text-white text-xs font-semibold py-2 rounded-xl':'w-full bg-slate-100 text-slate-400 text-xs font-semibold py-2 rounded-xl';if(open){fresh.style.background=track==='career'?'#8b5cf6':'#f97316';fresh.addEventListener('click',function(){workshopDetails(session);});}}});});var scheduleBar=$all('main section').map(function(section){return section.querySelector('.flex.flex-wrap');}).find(function(row){return row&&((row.textContent||'').indexOf('W1:')>=0||(row.textContent||'').indexOf('Career (')>=0);});if(scheduleBar)scheduleBar.innerHTML=schedule.map(function(session){return '<span class="ftg-workshop-date-chip is-'+esc(session.track)+'">W'+session.week+': '+esc(session.track==='career'?'Career':'Entrepreneur')+' ('+new Date(session.starts_at).toLocaleDateString(workshopLocale(),{day:'numeric',month:'short'})+')</span>';}).join('');}
  function loadWorkshopSchedule(force){return cachedApiRequest('workshop-schedule','/api/program',{method:'POST',body:JSON.stringify({action:'workshop_schedule_get'})},60000,force===true).then(function(data){renderWorkshopSchedule(data.schedule||[]);return data;}).catch(function(error){toast('Jadwal workshop belum dapat dimuat: '+error.message,'⚠️');throw error;});}
  function openWorkshopScheduleManager(){return cachedApiRequest('workshop-schedule','/api/program',{method:'POST',body:JSON.stringify({action:'workshop_schedule_get'}),loading:false},60000).then(function(data){var schedule=data.schedule||[];modal('<div class="ftg-workshop-manager"><div class="ftg-workshop-manager-head"><div><small>JADWAL LMS TERPUSAT</small><h3>Workshop & Tanggal Program</h3><p>Perubahan langsung tampil di LMS mentee dan mentor.</p></div><span>'+schedule.length+' sesi</span></div><div class="ftg-workshop-manager-list">'+schedule.map(function(item,index){return '<article data-workshop-edit="'+index+'"><div class="ftg-workshop-number">W'+item.week+'</div><div class="ftg-workshop-fields"><label>Track<select data-workshop-track><option value="career" '+(item.track==='career'?'selected':'')+'>Career Path</option><option value="entrepreneur" '+(item.track==='entrepreneur'?'selected':'')+'>Entrepreneur Path</option></select></label><label>Judul<input data-workshop-title maxlength="160" value="'+esc(item.title)+'"></label><label>Mulai<input data-workshop-start type="datetime-local" value="'+localDateTimeValue(item.starts_at)+'"></label><label>Selesai<input data-workshop-end type="datetime-local" value="'+localDateTimeValue(item.ends_at)+'"></label><label>Pre-Work<textarea data-workshop-pre rows="2">'+esc(item.pre_work||'')+'</textarea></label><label>Live Session<textarea data-workshop-live rows="2">'+esc(item.live_work||'')+'</textarea></label><label>Post-Work<textarea data-workshop-post rows="2">'+esc(item.post_work||'')+'</textarea></label><label>Status akses<select data-workshop-mode><option value="automatic" '+(item.access_mode==='automatic'?'selected':'')+'>Otomatis sesuai tanggal</option><option value="open" '+(item.access_mode==='open'?'selected':'')+'>Buka sekarang</option><option value="closed" '+(item.access_mode==='closed'?'selected':'')+'>Kunci</option></select></label><label class="ftg-workshop-published"><input data-workshop-published type="checkbox" '+(item.published===false?'':'checked')+'> Tampilkan di LMS</label></div></article>';}).join('')+'</div><div class="ftg-workshop-savebar"><span id="workshopManagerStatus" role="status">Tanggal memakai zona waktu perangkat Fasil.</span><button id="workshopManagerSave" class="ftg-suite-primary"><i class="fa-solid fa-floppy-disk"></i> Simpan & Publikasikan</button></div></div>',function(box,close){box.style.maxWidth='1000px';$('#workshopManagerSave',box).addEventListener('click',function(){var button=this,status=$('#workshopManagerStatus',box),payload=$all('[data-workshop-edit]',box).map(function(card,index){return {id:schedule[index].id,week:index+1,track:$('[data-workshop-track]',card).value,title:$('[data-workshop-title]',card).value,starts_at:$('[data-workshop-start]',card).value,ends_at:$('[data-workshop-end]',card).value,pre_work:$('[data-workshop-pre]',card).value,live_work:$('[data-workshop-live]',card).value,post_work:$('[data-workshop-post]',card).value,access_mode:$('[data-workshop-mode]',card).value,published:$('[data-workshop-published]',card).checked};});var invalid=payload.find(function(item){return !item.title||!item.starts_at||!item.ends_at||new Date(item.ends_at)<=new Date(item.starts_at);});if(invalid){status.textContent='Periksa judul dan rentang waktu sesi W'+invalid.week+'.';status.className='is-error';return;}button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan jadwal…';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'workshop_schedule_save',schedule:payload})}).then(function(){invalidateApiCache('workshop-schedule');close();toast('Jadwal workshop tersimpan dan tersinkron ke LMS','✅');}).catch(function(error){button.disabled=false;button.textContent='Coba simpan lagi';status.textContent=error.message;status.className='is-error';toast(error.message,'⚠️');});});});});}
  function initWorkshopLibrary() {
    var main = $('main');
    mountRecordingLibrary();
    loadWorkshopSchedule(false).catch(function(){});
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
    if (pre) {
      var PRE_ITEMS = ['Buat / perbarui draft profil LinkedIn', 'Susun CV satu halaman (template disediakan)', 'Tulis 3 kekuatan utama versi kamu'];
      var refreshPreBtn = function () {
        var done = (S.prework || []).filter(Boolean).length;
        if (done > 0) pre.innerHTML = 'Pre-Work ' + done + '/' + PRE_ITEMS.length + (done === PRE_ITEMS.length ? ' ✓' : '');
      };
      refreshPreBtn();
      pre.addEventListener('click', function () {
        S.prework = S.prework || [false, false, false];
        var rowsHtml = PRE_ITEMS.map(function (t, i) {
          var on = S.prework[i];
          return '<button type="button" data-pre="' + i + '" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ' + (on ? '#22c55e55' : '#e2e8f0') + ';background:' + (on ? '#f0fdf4' : '#fff') + ';border-radius:12px;margin-bottom:8px;cursor:pointer;text-align:left">' +
            '<span style="width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#22c55e' : 'border:2px solid #cbd5e1') + '">' + (on ? '<i class="fa-solid fa-check" style="color:#fff;font-size:9px"></i>' : '') + '</span>' +
            '<span style="font-size:12.5px;color:' + (on ? '#166534' : '#334155') + ';' + (on ? 'text-decoration:line-through;opacity:.75' : '') + '">' + t + '</span></button>';
        }).join('');
        modal(
          '<h3 style="font-weight:800;color:#2c3e50;font-size:16px;margin-bottom:4px">🎯 Pre-Work — Career Mapping & Personal Branding</h3>' +
          '<p style="font-size:12px;color:#64748b;margin-bottom:14px">Selesaikan sebelum Sabtu, 5 Juli 2026 · centang tersimpan otomatis</p>' +
          '<div id="preList">' + rowsHtml + '</div>' +
          '<div id="preDone" style="display:none;background:#f0fdf4;border:1px solid #22c55e44;border-radius:12px;padding:10px;text-align:center;margin-top:4px"><p style="font-size:12px;font-weight:700;color:#166534">🎉 Pre-Work selesai! Kamu siap ikut workshop.</p></div>',
          function (box, close) {
            function bind() {
              $all('[data-pre]', box).forEach(function (b) {
                b.addEventListener('click', function () {
                  var i = +b.getAttribute('data-pre');
                  S.prework[i] = !S.prework[i];
                  saveState(); refreshPreBtn();
                  var allDone = S.prework.filter(Boolean).length === PRE_ITEMS.length;
                  $('#preDone', box).style.display = allDone ? '' : 'none';
                  if (allDone) confetti();
                  // render ulang daftar
                  $('#preList', box).innerHTML = PRE_ITEMS.map(function (t, j) {
                    var on = S.prework[j];
                    return '<button type="button" data-pre="' + j + '" style="width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid ' + (on ? '#22c55e55' : '#e2e8f0') + ';background:' + (on ? '#f0fdf4' : '#fff') + ';border-radius:12px;margin-bottom:8px;cursor:pointer;text-align:left">' +
                      '<span style="width:20px;height:20px;border-radius:6px;flex-shrink:0;display:flex;align-items:center;justify-content:center;' + (on ? 'background:#22c55e' : 'border:2px solid #cbd5e1') + '">' + (on ? '<i class="fa-solid fa-check" style="color:#fff;font-size:9px"></i>' : '') + '</span>' +
                      '<span style="font-size:12.5px;color:' + (on ? '#166534' : '#334155') + ';' + (on ? 'text-decoration:line-through;opacity:.75' : '') + '">' + t + '</span></button>';
                  }).join('');
                  bind();
                });
              });
            }
            bind();
          }
        );
      });
    }
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
    var tipData = [
      { w: 'W1', v: 81.5, note: 'Skor awal minggu pertama' },
      { w: 'W2', v: w2, note: (w2 - 81.5 >= 0 ? 'Naik +' : 'Turun ') + Math.abs(w2 - 81.5).toFixed(1) + ' dari W1' + (S.reviewW2 ? ' · setelah dinilai mentor' : (S.submittedW2 ? ' · tugas terkumpul' : '')) }
    ];
    var dots = pts.map(function (p, i) {
      return '<circle class="ftg-pt" data-i="' + i + '" cx="' + X(i) + '" cy="' + Y(p[1]) + '" r="5" fill="#1a5f4f" style="transition:r .15s ease"/>' +
        '<circle class="ftg-hit" data-i="' + i + '" cx="' + X(i) + '" cy="' + Y(p[1]) + '" r="18" fill="transparent" style="cursor:pointer"/>' +
        '<text x="' + X(i) + '" y="' + (Y(p[1]) - 12) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#1a5f4f">' + p[1] + '</text>';
    }).join('');
    var labels = xs.map(function (l, i) {
      return '<text x="' + X(i) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" fill="#94a3b8">' + l + '</text>';
    }).join('');
    var grid = [78, 82, 86, 90].map(function (v) {
      return '<line x1="' + padL + '" y1="' + Y(v) + '" x2="' + (W - padR) + '" y2="' + Y(v) + '" stroke="#f1f5f9"/>' +
        '<text x="' + (padL - 8) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="10" fill="#cbd5e1">' + v + '</text>';
    }).join('');
    // proyeksi: garis putus halus, TANPA label menumpuk di pojok
    var proj = '<line x1="' + X(1) + '" y1="' + Y(w2) + '" x2="' + X(3) + '" y2="' + Y(90.5) + '" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="5 5" opacity=".45"/>';
    // label target ditaruh di KIRI garis, sejajar, tidak menabrak proyeksi
    var tgt = '<line x1="' + padL + '" y1="' + Y(target) + '" x2="' + (W - padR) + '" y2="' + Y(target) + '" stroke="#f97316" stroke-width="1.5" stroke-dasharray="3 4" opacity=".8"/>' +
      '<rect x="' + (padL + 4) + '" y="' + (Y(target) - 9) + '" rx="7" width="66" height="15" fill="#fff7ed"/>' +
      '<text x="' + (padL + 10) + '" y="' + (Y(target) + 2.5) + '" font-size="9.5" font-weight="700" fill="#f97316">TARGET 90</text>';
    var delta = (w2 - 81.5).toFixed(1);
    var sec = document.createElement('section');
    sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6';
    sec.innerHTML =
      '<div class="flex items-center justify-between mb-3 flex-wrap gap-2">' +
      '<h2 class="text-[#2c3e50] text-sm font-bold">📈 Tren KPI Mingguan</h2>' +
      '<span class="text-[#22c55e] text-xs font-semibold bg-[#22c55e]/10 px-2.5 py-1 rounded-full">↑ +' + delta + ' poin sejak W1</span></div>' +
      '<div style="max-width:640px;margin:0 auto;position:relative">' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">' +
      grid + tgt +
      proj.replace('<line ', '<line class="ftg-chart-proj" pathLength="1" ') +
      '<polyline class="ftg-chart-line" pathLength="1" points="' + line + '" fill="none" stroke="#1a5f4f" stroke-width="3" stroke-linecap="round"/>' +
      dots + labels + '</svg>' +
      '<div class="ftg-chart-tip" style="position:absolute;display:none;background:#2c3e50;color:#fff;font-size:11px;font-weight:600;padding:7px 11px;border-radius:10px;pointer-events:none;white-space:nowrap;box-shadow:0 8px 20px rgba(0,0,0,.25);z-index:20;transform:translate(-50%,-115%)"></div></div>' +
      '<div class="flex items-center justify-center gap-5 mt-2 flex-wrap">' +
      '<span class="text-[10px] text-slate-500 flex items-center gap-1.5"><span style="display:inline-block;width:16px;height:3px;background:#1a5f4f;border-radius:2px"></span>Skor mingguan</span>' +
      '<span class="text-[10px] text-slate-500 flex items-center gap-1.5"><span style="display:inline-block;width:16px;height:0;border-top:2px dashed #8b5cf6;opacity:.6"></span>Proyeksi jika konsisten</span>' +
      '<span class="text-[10px] text-slate-500 flex items-center gap-1.5"><span style="display:inline-block;width:16px;height:0;border-top:2px dashed #f97316"></span>Target program</span></div>';
    after.parentElement.insertBefore(sec, after.nextSibling);

    // interaksi: hover/tap titik -> tooltip detail, titik membesar
    var svg = sec.querySelector('svg');
    var tip = sec.querySelector('.ftg-chart-tip');
    function showTip(i) {
      var d = tipData[i];
      if (!d) return;
      var pt = sec.querySelector('.ftg-pt[data-i="' + i + '"]');
      pt.setAttribute('r', '7');
      var svgR = svg.getBoundingClientRect();
      var scale = svgR.width / W;
      tip.innerHTML = '<b>' + d.w + ' · Skor ' + d.v + '</b><br><span style="opacity:.75;font-weight:400">' + d.note + '</span>';
      tip.style.left = (X(i) * scale) + 'px';
      tip.style.top = (Y(pts[i][1]) * (svgR.height / H)) + 'px';
      tip.style.display = 'block';
    }
    function hideTip() {
      tip.style.display = 'none';
      $all('.ftg-pt', sec).forEach(function (p) { p.setAttribute('r', '5'); });
    }
    $all('.ftg-hit', sec).forEach(function (hit) {
      var i = +hit.getAttribute('data-i');
      hit.addEventListener('mouseenter', function () { showTip(i); });
      hit.addEventListener('mouseleave', hideTip);
      hit.addEventListener('click', function (e) { e.stopPropagation(); showTip(i); });
    });
    document.addEventListener('click', hideTip);
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
          a.download = 'Sertifikat-FTGxGI-' + ((mySession() || {}).name || 'Peserta').replace(/[^a-z0-9]+/gi, '-') + '.png';
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
    ctx.fillText((mySession() || {}).name || 'Peserta FTG Fellowship', W / 2, 435);
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

  /* ================================================================
     OPERATIONS SUITE: pusat kerja mentee, mentor, dan panitia
     ================================================================ */
  function taskProgress(task, sub) {
    var total = (task.checklist || []).length;
    if (!total) return sub && sub.submittedAt ? 100 : 0;
    var done = Object.keys((sub && sub.checks) || {}).filter(function (k) { return sub.checks[k]; }).length;
    return Math.min(100, Math.max(0, Math.round(done / total * 100)));
  }

  function recordingDate(value) {
    if (!value) return 'Rekaman program';
    try { return new Date(value).toLocaleDateString('id-ID', { day:'numeric',month:'long',year:'numeric' }); } catch (_) { return 'Rekaman program'; }
  }
  function mountRecordingLibrary() {
    var host = $('main > div.px-8');
    if (!host || document.getElementById('ftg-recording-library')) return;
    var pageTitle=$('main header h1'),pageSubtitle=$('main header p');
    if(pageTitle)pageTitle.textContent='LMS & Rekaman Program';
    if(pageSubtitle)pageSubtitle.textContent='Pusat rekaman mentoring, workshop, dan materi pembelajaran fellowship.';
    $all('aside nav a').forEach(function(link){if(link.textContent.indexOf('Workshop Library')>-1)link.childNodes[link.childNodes.length-1].textContent=' LMS & Rekaman';});
    var section = document.createElement('section');
    section.id = 'ftg-recording-library'; section.className = 'ftg-lms-shell';
    section.innerHTML = '<div class="ftg-lms-heading"><div><span class="ftg-lms-kicker"><i class="fa-solid fa-circle-play"></i> LMS REKAMAN</span><h2>Belajar ulang kapan saja</h2><p>Rekaman mentoring dan workshop resmi dari Fasil tersedia untuk mentee dan mentor.</p></div><span class="ftg-lms-role">' + (myRole() === 'mentor' ? 'Akses Mentor' : 'Akses Mentee') + '</span></div><div id="ftgLmsBody" class="ftg-lms-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Menyiapkan video pembelajaran…</span></div>';
    host.insertBefore(section, host.firstChild);
    var body = document.getElementById('ftgLmsBody');
    function showError(message) { body.className='ftg-lms-empty'; body.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i><b>Rekaman belum dapat dimuat</b><span>'+esc(message || 'Coba muat ulang halaman.')+'</span><button id="retryRecordings" type="button">Coba lagi</button>'; $('#retryRecordings',body).addEventListener('click',load); }
    function render(rows) {
      if (!rows.length) { body.className='ftg-lms-empty'; body.innerHTML='<i class="fa-solid fa-video-slash"></i><b>Belum ada rekaman</b><span>Fasil akan menambahkan video setelah sesi selesai.</span>'; return; }
      body.className='ftg-lms-layout';
      body.innerHTML='<div class="ftg-lms-player"><div class="ftg-lms-frame"><iframe id="ftgLmsIframe" title="Pemutar rekaman LMS" loading="eager" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="ftg-lms-now"><div class="ftg-lms-meta"><span id="ftgLmsSession"></span><small id="ftgLmsDate"></small></div><h3 id="ftgLmsTitle"></h3><p id="ftgLmsDescription"></p></div></div><aside class="ftg-lms-playlist"><div class="ftg-lms-playlist-head"><div><small>VIDEO PEMBELAJARAN</small><b>Daftar Rekaman</b></div><span>'+rows.length+' video</span></div><label class="ftg-lms-search"><i class="fa-solid fa-magnifying-glass"></i><input id="ftgLmsSearch" type="search" placeholder="Cari judul atau sesi…" aria-label="Cari rekaman"></label><div id="ftgLmsItems"></div></aside>';
      var list=document.getElementById('ftgLmsItems'), frame=document.getElementById('ftgLmsIframe');
      function select(row, button) {
        frame.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(row.youtube_id)+'?rel=0&modestbranding=1';
        document.getElementById('ftgLmsSession').textContent=row.location || 'Rekaman Program'; document.getElementById('ftgLmsTitle').textContent=row.title;
        document.getElementById('ftgLmsDescription').textContent=row.description || 'Tonton kembali materi dan catat poin penting dari sesi ini.'; document.getElementById('ftgLmsDate').textContent=recordingDate(row.starts_at);
        $all('.ftg-lms-item',list).forEach(function(b){b.classList.toggle('is-active',b===button);b.setAttribute('aria-pressed',b===button?'true':'false');});
      }
      rows.forEach(function(row,index){var b=document.createElement('button');b.type='button';b.className='ftg-lms-item';b.innerHTML='<span class="ftg-lms-thumb"><img src="https://i.ytimg.com/vi/'+encodeURIComponent(row.youtube_id)+'/mqdefault.jpg" alt="" loading="lazy"><i class="fa-solid fa-play"></i></span><span><b>'+esc(row.title)+'</b><small>'+esc(row.location||'Rekaman Program')+' · '+esc(recordingDate(row.starts_at))+'</small></span>';b.addEventListener('click',function(){select(row,b);});list.appendChild(b);if(index===0)select(row,b);});
    }
    function load(){body.className='ftg-lms-loading';body.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Menyiapkan video pembelajaran…</span>';apiRequest('/api/operations?resource=recordings').then(function(data){render(data.recordings||[]);}).catch(function(e){showError(e.message);});}
    function fastLoad(){
      var fallback=[{id:'featured-mentoring-1',title:'Mentoring Sesi 1 FBF',youtube_id:'fmu6RKmoXAc',location:'Mentoring',starts_at:'2026-08-13T19:00:00+08:00',description:'Rekaman Mentoring Sesi 1 Future Builders Fellowship. Tonton ulang pembahasan sesi dan catat poin penting untuk tindak lanjut.'}],cached=null;
      function bindSearch(){var search=document.getElementById('ftgLmsSearch'),list=document.getElementById('ftgLmsItems');if(!search||!list)return;search.addEventListener('input',function(){var q=search.value.trim().toLowerCase();$all('.ftg-lms-item',list).forEach(function(item){item.style.display=!q||item.textContent.toLowerCase().indexOf(q)>-1?'':'none';});});}
      try{cached=JSON.parse(localStorage.getItem('ftgRecordingsCache')||'null');}catch(_){cached=null;}
      render(Array.isArray(cached)&&cached.length?cached:fallback);bindSearch();
      var controller=typeof AbortController!=='undefined'?new AbortController():null,timer=controller?setTimeout(function(){controller.abort();},8000):null;
      apiRequest('/api/operations?resource=recordings',controller?{signal:controller.signal}:{}).then(function(data){var rows=data.recordings||[];if(timer)clearTimeout(timer);try{localStorage.setItem('ftgRecordingsCache',JSON.stringify(rows));}catch(_){}render(rows);bindSearch();}).catch(function(){if(timer)clearTimeout(timer);});
    }
    fastLoad();
    [50,500,1500,3000].forEach(function(delay){setTimeout(function(){if(body.classList.contains('ftg-lms-loading'))fastLoad();},delay);});
  }
  function assignmentHistoryHtml(sub) {
    var versions = sub.versions || [], reviews = sub.reviewHistory || [];
    if (!versions.length && !reviews.length) return '';
    return '<details style="margin:10px 0;border:1px solid #e2e8f0;border-radius:12px;padding:9px;background:#fff"><summary style="cursor:pointer;font-size:11px;font-weight:800;color:#334155">Riwayat versi & feedback (' + versions.length + ' versi)</summary><div style="max-height:180px;overflow:auto;margin-top:7px">' + versions.slice().reverse().map(function (v) {
      var related = reviews.filter(function (r) { return Number(r.version) === Number(v.number); });
      return '<div style="border:1px solid #ddd6fe;border-radius:8px;padding:6px 9px;margin:6px 0;background:#f8fafc"><b style="font-size:10px;color:#6d28d9">Versi ' + v.number + '</b><small style="float:right;color:#64748b">' + esc(v.at ? new Date(v.at).toLocaleString('id-ID') : '') + '</small><p style="font-size:10px;color:#475569;margin-top:4px">' + esc((v.text || 'Lampiran/link').slice(0, 180)) + '</p>' + related.map(function (r) { return '<p style="font-size:10px;color:' + (r.decision === 'revision' ? '#b91c1c' : '#166534') + ';margin-top:5px"><b>' + (r.decision === 'revision' ? 'Revisi diminta' : 'Disetujui') + ' · ' + r.score + '/100:</b> ' + esc(r.text) + '</p>'; }).join('') + '</div>';
    }).join('') + '</div></details>';
  }
  function mountMenteeWorkCenter() {
    if (PAGE.indexOf('mentee-dashboard') !== 0) return;
    var host = $('main > div.px-8'); if (!host || document.getElementById('mentee-work-center')) return;
    var tasks = assignmentsForMentee(MID).filter(function (t) { var s = taskSubmission(MID, t.id); return !(s && s.review && s.review.decision !== 'revision'); });
    tasks.sort(function (a, b) { return new Date(a.deadline || '2999-12-31') - new Date(b.deadline || '2999-12-31'); });
    var approved = assignmentsForMentee(MID).filter(function (t) { var s = taskSubmission(MID, t.id); return s && s.review && s.review.decision !== 'revision'; });
    var sec = document.createElement('section'); sec.id = 'mentee-work-center'; sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    sec.innerHTML = '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">🎯 Pusat Kerja Saya</h2><p style="font-size:11px;color:#64748b">Prioritas, deadline, progres checklist, dan portofolio dalam satu tempat.</p></div><button id="menteePortfolio" style="border:0;background:#1a5f4f;color:#fff;border-radius:10px;padding:8px 11px;font-size:10px;font-weight:800">Portofolio (' + (S.portfolio || []).length + ')</button></div>' +
      (tasks.length ? '<div style="display:grid;gap:8px">' + tasks.slice(0, 4).map(function (t, i) { var sub = taskSubmission(MID, t.id), life = assignmentStatus(t, sub), pg = taskProgress(t, sub); return '<article style="border:1px solid #e2e8f0;border-radius:12px;padding:10px"><div style="display:flex;justify-content:space-between;gap:8px"><p style="font-size:12px;font-weight:800;color:#1e293b">' + (i === 0 ? '🔥 ' : '') + esc(t.title) + '</p><span style="font-size:9px;font-weight:800;color:' + life.color + '">' + life.label + '</span></div><p style="font-size:10px;color:#64748b;margin:3px 0 7px">' + esc(dueLabel(t.deadline)) + '</p><div style="height:5px;background:#e2e8f0;border-radius:9px"><div style="height:5px;width:' + pg + '%;background:' + life.color + ';border-radius:9px"></div></div><p style="font-size:9px;color:#94a3b8;margin-top:3px">Checklist ' + pg + '%</p></article>'; }).join('') + '</div>' : '<p style="font-size:12px;color:#16a34a;background:#ecfdf5;border-radius:12px;padding:12px">✓ Tidak ada tugas aktif. Semua prioritasmu sudah selesai.</p>') +
      '<div style="margin-top:12px;border-top:1px solid #f1f5f9;padding-top:10px"><p style="font-size:11px;font-weight:800;color:#334155;margin-bottom:6px">📅 Kalender terdekat</p><div style="display:flex;gap:7px;overflow:auto">' + (tasks.length ? tasks.slice(0, 5).map(function (t) { return '<span style="min-width:145px;background:#f8fafc;border-radius:10px;padding:8px;font-size:10px;color:#475569"><b>' + esc(t.deadline || 'Fleksibel') + '</b><br>' + esc(t.title) + '</span>'; }).join('') : '<span style="font-size:10px;color:#94a3b8">Belum ada agenda.</span>') + '</div></div>' +
      (approved.length && approved.every(function (t) { return taskSubmission(MID, t.id).review.score >= +(G.programSettings.passingScore || 75); }) ? '<button id="menteeCertificate" style="margin-top:10px;border:1px solid #f59e0b;background:#fffbeb;color:#b45309;border-radius:10px;padding:8px 11px;font-size:10px;font-weight:800">🏅 Cetak Sertifikat Kelulusan</button>' : '');
    host.insertBefore(sec, host.firstChild);
    $('#menteePortfolio', sec).addEventListener('click', function () {
      var rows = (S.portfolio || []).map(function (p) { return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin:7px 0"><b style="font-size:12px;color:#1e293b">' + esc(p.title) + '</b><p style="font-size:10px;color:#64748b">' + new Date(p.submittedAt).toLocaleDateString('id-ID') + ' · ' + ((p.files || []).length) + ' berkas</p>' + (p.link ? '<a href="' + esc(p.link) + '" target="_blank" style="font-size:10px;color:#8b5cf6">Buka hasil ↗</a>' : '') + '</div>'; }).join('');
      modal('<h3 style="font-weight:800;color:#1e293b">🗂 Portofolio Saya</h3><p style="font-size:11px;color:#64748b;margin-bottom:10px">Kumpulan otomatis dari tugas yang pernah dikirim.</p>' + (rows || '<p style="font-size:12px;color:#94a3b8">Belum ada karya.</p>'));
    });
    var cert = $('#menteeCertificate', sec); if (cert) cert.addEventListener('click', function () { addAudit('certificate.print', MENTEES[MID].name, MID); saveState(); window.print(); });
  }

  function openBroadcastModal() {
    modal('<h3 style="font-weight:800;color:#1e293b">📣 Broadcast Terarah</h3><p style="font-size:11px;color:#64748b;margin-bottom:10px">Pilih penerima lalu kirim pengumuman ke pusat notifikasi mereka.</p><div id="bcTargets" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' + menteeIds().map(function (id) { return '<label style="font-size:11px;background:#f8fafc;padding:7px;border-radius:8px"><input type="checkbox" value="' + id + '" checked> ' + esc(MENTEES[id].name) + '</label>'; }).join('') + '</div><textarea id="bcText" rows="3" placeholder="Isi pengumuman..." style="width:100%;margin-top:9px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font-size:12px"></textarea><button id="bcSend" style="width:100%;margin-top:9px;border:0;background:#f97316;color:#fff;border-radius:10px;padding:10px;font-size:12px;font-weight:800">Kirim Broadcast</button>', function (box, close) {
      $('#bcSend', box).addEventListener('click', function () { var msg = $('#bcText', box).value.trim(); var ids = $all('#bcTargets input', box).filter(function (c) { return c.checked; }).map(function (c) { return +c.value; }); if (!msg || !ids.length) { toast('Isi pesan dan pilih penerima', '⚠️'); return; } ids.forEach(function (id) { pushEventTo(id, '📣', msg, 'mentee', 'mentee-dashboard.html'); }); addAudit('broadcast.send', msg, ids.join(',')); saveState(); close(); toast('Broadcast terkirim ke ' + ids.length + ' mentee', '📣'); });
    });
  }
  function openMenteeTimeline(id) {
    var st = mstate(id), items = [];
    (st.events || []).forEach(function (e) { items.push({ at: e.at, text: e.text, icon: e.icon }); });
    Object.keys(st.assignmentSubmissions || {}).forEach(function (tid) { var sub = st.assignmentSubmissions[tid], task = assignmentFor(tid); if (sub.submittedAt) items.push({ at: sub.submittedAt, icon: '📥', text: 'Mengumpulkan ' + (task ? task.title : tid) }); if (sub.review) items.push({ at: sub.review.at, icon: '⭐', text: (sub.review.decision === 'revision' ? 'Diminta revisi ' : 'Dinilai ') + (task ? task.title : tid) }); });
    (st.sessions || []).forEach(function (s) { items.push({ at: s.at || s.date, icon: '🗓', text: 'Sesi 1-on-1: ' + (s.outcome || s.note || s.status || 'terjadwal') }); });
    items.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    modal('<h3 style="font-weight:800;color:#1e293b">🕘 Timeline ' + esc(MENTEES[id].name) + '</h3><div style="max-height:430px;overflow:auto;margin-top:10px">' + (items.length ? items.slice(0, 30).map(function (x) { return '<div style="border-left:2px solid #8b5cf6;padding:0 0 12px 10px"><p style="font-size:11px;color:#334155"><b>' + x.icon + '</b> ' + esc(x.text) + '</p><p style="font-size:9px;color:#94a3b8">' + (x.at ? new Date(x.at).toLocaleString('id-ID') : '') + '</p></div>'; }).join('') : '<p style="font-size:12px;color:#94a3b8">Belum ada aktivitas.</p>') + '</div>');
  }
  function completeMentorSession(id) {
    modal('<h3 style="font-weight:800;color:#1e293b">✅ Catat Hasil 1-on-1</h3><p style="font-size:11px;color:#64748b;margin-bottom:8px">Ringkasan ini masuk ke timeline mentoring ' + esc(MENTEES[id].name) + '.</p><textarea id="sessionOutcome" rows="4" placeholder="Topik, insight, keputusan, dan tindak lanjut..." style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font-size:12px"></textarea><input id="sessionActions" placeholder="Action items (pisahkan dengan koma)" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-size:11px;margin-top:7px"><select id="sessionAttendance" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;font-size:11px;background:#fff;margin-top:7px"><option value="present">Mentor & mentee hadir</option><option value="mentee_no_show">Mentee tidak hadir</option><option value="mentor_no_show">Mentor tidak hadir</option></select><button id="sessionDone" style="width:100%;margin-top:9px;border:0;background:#16a34a;color:#fff;border-radius:10px;padding:10px;font-weight:800">Tandai Selesai</button>', function (box, close) { $('#sessionDone', box).addEventListener('click', function () { var text = $('#sessionOutcome', box).value.trim(); if (!text) { toast('Isi hasil sesi terlebih dahulu', '⚠️'); return; } var st = mstate(id), s = (st.sessions || [])[0]; if (s) { s.status = 'completed'; s.outcome = text; s.actionItems = $('#sessionActions',box).value.split(',').map(function(x){return x.trim();}).filter(Boolean); s.attendance = {status:$('#sessionAttendance',box).value}; s.completedAt = new Date().toISOString(); structuredSessionUpdate(id,s); } st.session1on1 = null; pushEventTo(id, '✅', 'Sesi 1-on-1 selesai. Tindak lanjut: ' + text, 'mentee', 'mentee-dashboard.html'); addAudit('session.complete', text, id); saveState(); close(); toast('Hasil sesi tersimpan di timeline', '✅'); }); });
  }
  function manageMentorSession(id) {
    var st=mstate(id),s=(st.sessions||[])[0];
    modal('<h3 style="font-weight:800;color:#1e293b">🗓 Kelola Sesi ' + esc(MENTEES[id].name) + '</h3><p style="font-size:11px;color:#64748b;margin:5px 0 12px">' + esc(st.session1on1 ? st.session1on1.date+' · '+st.session1on1.time : 'Agenda aktif') + '</p><div style="display:grid;gap:7px"><button id="msComplete" class="ftg-action-primary" style="padding:10px">Selesaikan & catat hasil</button><button id="msReschedule" class="ftg-action-secondary" style="padding:10px">Jadwalkan ulang</button><button id="msCancel" style="border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;border-radius:9px;padding:10px;font-size:10px;font-weight:800">Batalkan sesi</button></div>',function(box,close){$('#msComplete',box).addEventListener('click',function(){close();completeMentorSession(id);});$('#msReschedule',box).addEventListener('click',function(){if(s){s.status='cancelled';structuredSessionUpdate(id,s);}st.session1on1=null;saveState();close();scheduleModal();});$('#msCancel',box).addEventListener('click',function(){if(s){s.status='cancelled';structuredSessionUpdate(id,s);}st.session1on1=null;pushEventTo(id,'🗓','Sesi 1-on-1 dibatalkan oleh mentor','mentee','mentee-dashboard.html');addAudit('session.cancel','Sesi dibatalkan',id);saveState();close();toast('Sesi dibatalkan','✅');});});
  }
  function mountMentorOperations() {
    if (!/^(mentor-dashboard|mentor-review|mentor-mentee)/.test(PAGE)) return;
    var host = $('main > div.px-8'); if (!host || document.getElementById('mentor-operations')) return;
    var attention = menteeIds().map(function (id) { var pending = assignmentsForMentee(id).filter(function (t) { var s = taskSubmission(id, t.id), life = assignmentStatus(t, s); return life.key === 'late' || life.key === 'revision'; }).length; return { id: id, count: pending }; }).filter(function (x) { return x.count; });
    var sessions = []; menteeIds().forEach(function (id) { var st = mstate(id); if (st.session1on1) sessions.push({ id: id, data: st.session1on1 }); });
    var sec = document.createElement('section'); sec.id = 'mentor-operations'; sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    sec.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">🧭 Pusat Kendali Mentor</h2><p style="font-size:11px;color:#64748b">Mentee perlu perhatian, agenda, broadcast, dan timeline lengkap.</p></div><div style="display:flex;gap:6px"><button id="mentorSchedule" style="border:0;background:#8b5cf6;color:#fff;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800">+ Agenda</button><button id="mentorBroadcast" style="border:0;background:#f97316;color:#fff;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:800">Broadcast</button></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><div style="background:#fef2f2;border-radius:12px;padding:10px"><p style="font-size:11px;font-weight:800;color:#b91c1c">Perlu perhatian (' + attention.length + ')</p>' + (attention.length ? attention.map(function (x) { return '<button data-mentor-timeline="' + x.id + '" style="display:block;width:100%;text-align:left;border:0;background:#fff;border-radius:8px;padding:7px;margin-top:6px;font-size:10px;color:#475569">' + esc(MENTEES[x.id].name) + ' · ' + x.count + ' isu →</button>'; }).join('') : '<p style="font-size:10px;color:#64748b;margin-top:6px">Semua mentee dalam jalur.</p>') + '</div><div style="background:#eff6ff;border-radius:12px;padding:10px"><p style="font-size:11px;font-weight:800;color:#1d4ed8">Agenda 1-on-1 (' + sessions.length + ')</p>' + (sessions.length ? sessions.map(function (s) { return '<button data-mentor-timeline="' + s.id + '" style="display:block;width:100%;text-align:left;border:0;background:#fff;border-radius:8px;padding:7px;margin-top:6px;font-size:10px;color:#475569">' + esc(MENTEES[s.id].name) + ' · ' + esc(s.data.date) + ' ' + esc(s.data.time) + '</button>'; }).join('') : '<p style="font-size:10px;color:#64748b;margin-top:6px">Belum ada agenda.</p>') + '</div></div>';
    host.insertBefore(sec, host.firstChild); $('#mentorSchedule', sec).addEventListener('click', scheduleModal); $('#mentorBroadcast', sec).addEventListener('click', openBroadcastModal); $all('[data-mentor-timeline]', sec).forEach(function (b) { b.addEventListener('click', function () { var id = +b.getAttribute('data-mentor-timeline'); if ((b.parentElement.getAttribute('style') || '').indexOf('#eff6ff') > -1) manageMentorSession(id); else openMenteeTimeline(id); }); });
  }

  function exportProgramCsv() {
    var rows = [['Mentee', 'Email', 'Tugas', 'Dikumpulkan', 'Dinilai', 'Rata-rata']];
    menteeIds().forEach(function (id) { var tasks = assignmentsForMentee(id), submitted = 0, scores = []; tasks.forEach(function (t) { var s = taskSubmission(id, t.id); if (s && s.submittedAt) submitted++; if (s && s.review && s.review.decision !== 'revision') scores.push(s.review.score); }); rows.push([MENTEES[id].name, MENTEES[id].email, tasks.length, submitted, scores.length, scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : '']); });
    var csv = rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'rekap-ftg-fellowship.csv'; a.click(); URL.revokeObjectURL(a.href); addAudit('report.export', 'Rekap program CSV'); saveState();
  }
  var USER_ACTION_CONTEXT = { at:0, label:'', button:null };
  function apiRequest(path, options) {
    options = options || {};
    var requestMethod=String(options.method||'GET').toUpperCase(),showActionLoader=options.loading!==false&&Date.now()-USER_ACTION_CONTEXT.at<2200,hideActionLoader=null,actionButton=showActionLoader&&USER_ACTION_CONTEXT.button,buttonWasBusy=actionButton&&actionButton.getAttribute('aria-busy');
    delete options.loading;
    if(showActionLoader){var label=USER_ACTION_CONTEXT.label||'data',title=requestMethod==='GET'?'Memuat data…':/hapus|delete/i.test(label)?'Menghapus data…':/kirim|send/i.test(label)?'Mengirim data…':/unggah|upload/i.test(label)?'Mengunggah data…':'Menyimpan perubahan…';if(actionButton){actionButton.classList.add('ftg-action-pending');actionButton.setAttribute('aria-busy','true');}hideActionLoader=operationLoader(title,requestMethod==='GET'?'Mengambil informasi terbaru dari server…':'Mohon tunggu. Data sedang diproses dengan aman dan jangan klik ulang.');}
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}, AUTH.accessToken ? { Authorization: 'Bearer ' + AUTH.accessToken } : {});
    var timer=null,controller=null;
    if(!options.signal&&typeof AbortController!=='undefined'){controller=new AbortController();options.signal=controller.signal;timer=setTimeout(function(){controller.abort();},requestMethod==='GET'?35000:90000);}
    function execute(retried){
      return fetch(path,options).then(function(r){return r.json().catch(function(){return {};}).then(function(data){
        if(r.status===401&&!retried&&sb){return sb.auth.refreshSession().then(function(result){var session=result.data&&result.data.session;if(!session)throw new Error('Sesi login berakhir. Silakan masuk kembali.');AUTH.user=session.user;AUTH.accessToken=session.access_token;options.headers.Authorization='Bearer '+session.access_token;return execute(true);});}
        if(!r.ok)throw new Error(data.error||'Permintaan gagal');return data;
      });});
    }
    return execute(false).catch(function(error){if(error&&error.name==='AbortError')error=new Error('Server terlalu lama merespons. Data belum diubah; silakan coba lagi.');if(showActionLoader)visibleActionError(error);throw error;}).finally(function(){if(timer)clearTimeout(timer);if(hideActionLoader)hideActionLoader();if(actionButton){actionButton.classList.remove('ftg-action-pending');if(buttonWasBusy===null)actionButton.removeAttribute('aria-busy');else actionButton.setAttribute('aria-busy',buttonWasBusy);}});
  }
  var API_MEMORY_CACHE = {}, API_INFLIGHT = {};
  function cachedApiRequest(key, path, options, ttl, force) {
    ttl = ttl || 30000;
    var cached = API_MEMORY_CACHE[key];
    if (!force && cached && Date.now() - cached.at < ttl) return Promise.resolve(cached.data);
    if (!force && API_INFLIGHT[key]) return API_INFLIGHT[key];
    var request = apiRequest(path, options).then(function (data) {
      API_MEMORY_CACHE[key] = { at: Date.now(), data: data };
      return data;
    }).finally(function () { delete API_INFLIGHT[key]; });
    API_INFLIGHT[key] = request;
    return request;
  }
  function invalidateApiCache(key) { if (key) delete API_MEMORY_CACHE[key]; else API_MEMORY_CACHE = {}; }
  function readSessionCache(key, maxAge) { try { var value=JSON.parse(sessionStorage.getItem(key)||'null');return value&&Date.now()-value.at<(maxAge||120000)?value.data:null; } catch (_) { return null; } }
  function writeSessionCache(key, data) { try { sessionStorage.setItem(key,JSON.stringify({at:Date.now(),data:data})); } catch (_) {} }
  function warmApiOnIntent(element, key, path, options) { if(!element)return;var warm=function(){cachedApiRequest(key,path,options,30000).catch(function(){});element.removeEventListener('pointerenter',warm);element.removeEventListener('focus',warm);};element.addEventListener('pointerenter',warm,{passive:true});element.addEventListener('focus',warm); }
  var ADMIN_CONTROL_CENTER_WARMED = false;
  function warmAdminControlCenter() {
    if (ADMIN_CONTROL_CENTER_WARMED || PAGE.indexOf('admin-program') !== 0 || !AUTH.profile || AUTH.profile.role !== 'admin') return;
    ADMIN_CONTROL_CENTER_WARMED = true;
    function warm(jobs) {
      jobs.forEach(function (job) { cachedApiRequest(job[0],job[1],job[2]||null,job[3]||45000).catch(function(){}); });
    }
    setTimeout(function () {
      warm([
        ['admin-operations','/api/operations',null,30000],
        ['program-pairings','/api/program',{method:'POST',body:JSON.stringify({action:'pairings_data'}),loading:false},30000],
        ['program-tracks','/api/program',{method:'POST',body:JSON.stringify({action:'tracks_list',admin:true}),loading:false},45000],
        ['workshop-schedule','/api/program',{method:'POST',body:JSON.stringify({action:'workshop_schedule_get'}),loading:false},60000]
      ]);
    }, 900);
    setTimeout(function () {
      warm([
        ['operations-events','/api/operations?resource=events',null,45000],
        ['operations-recordings','/api/operations?resource=recordings',null,45000],
        ['operations-learning','/api/operations?resource=learning',null,45000],
        ['operations-audit','/api/operations?resource=audit',null,30000],
        ['admin-notifications','/api/notifications',null,30000],
        ['donor-admin','/api/donor?admin=1',null,45000],
        ['program-announcements','/api/program',{method:'POST',body:JSON.stringify({action:'announcements_list',admin:true}),loading:false},45000]
      ]);
    }, 2600);
  }
  function operationLoader(title, detail) {
    var previous = document.querySelector('.ftg-operation-loading');
    if (previous) previous.remove();
    var busyTarget = $('main') || document.body;
    var previousBusy = busyTarget.getAttribute('aria-busy');
    var overlay = document.createElement('div');
    overlay.className = 'ftg-operation-loading';
    overlay.setAttribute('role', 'status'); overlay.setAttribute('aria-live', 'polite'); overlay.setAttribute('aria-atomic', 'true');
    overlay.innerHTML = '<div class="ftg-operation-loading-card"><span class="ftg-operation-spinner"><i></i><i></i><i></i></span><b>' + esc(title || 'Menyiapkan data') + '</b><small>' + esc(detail || 'Mengambil data terbaru dengan aman…') + '</small><span class="ftg-operation-progress"><i></i></span></div>';
    busyTarget.setAttribute('aria-busy', 'true');
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('is-visible'); });
    return function () {
      overlay.classList.remove('is-visible');
      if (previousBusy === null) busyTarget.removeAttribute('aria-busy'); else busyTarget.setAttribute('aria-busy', previousBusy);
      setTimeout(function () { overlay.remove(); }, 180);
    };
  }
  // Shared by participant and Fasil actions. Keep this outside page-specific
  // mounts so a calendar button can never lose its busy/error state handler.
  function openBusy(button, opener) {
    if (!button || button.disabled || button.getAttribute('aria-busy') === 'true') return;
    var original = button.innerHTML;
    var label = (button.textContent || 'modul').trim();
    var hideLoader = operationLoader('Membuka ' + label, 'Menyiapkan modul dan data terbaru…');
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><b>Membuka…</b>';
    var result;
    try { result = opener(); } catch (error) { result = Promise.reject(error); }
    return Promise.resolve(result).catch(function (error) {
      toast((error && error.message) || ('Modul ' + label + ' gagal dibuka. Silakan coba lagi.'), '⚠️');
      console.error('Action failed:', label, error);
      return null;
    }).finally(function () {
      hideLoader();
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
      button.innerHTML = original;
    });
  }
  function accountLoadingSkeleton() {
    return '<div class="ftg-account-skeleton" aria-label="Memuat daftar akun">' + [1,2,3,4,5,6].map(function () { return '<div><i></i><span><b></b><small></small></span><em></em><em></em></div>'; }).join('') + '</div>';
  }
  function profileAvatarMarkup(profile, size) {
    size = size || 48;
    var url = profile && profile.avatar_url;
    return '<span class="ftg-profile-photo" style="width:'+size+'px;height:'+size+'px">' + (url ? '<img src="'+esc(url)+'" alt="Foto profil">' : esc((profile && profile.initials) || initialsOf(profile && profile.full_name || 'FTG'))) + '</span>';
  }
  function applyOwnProfilePhoto() {
    if (!AUTH.profile) return;
    var targets = [], pill = $('aside .mx-4.mt-4');
    if (pill) { var side = $('div.rounded-full', pill); if (side) targets.push(side); }
    var header = $('main header'), actions = header && $('.ftg-header-actions', header), control = actions && $('.ftg-profile-control', actions);
    if (control) targets.push(control);
    targets.forEach(function (target) {
      target.classList.add('ftg-profile-photo');
      target.style.background = AUTH.profile.avatar_url ? 'transparent' : (AUTH.profile.role === 'mentor' ? '#1a5f4f' : AUTH.profile.role === 'admin' ? '#8b5cf6' : '#f97316');
      target.innerHTML = AUTH.profile.avatar_url ? '<img src="'+esc(AUTH.profile.avatar_url)+'" alt="Foto '+esc(AUTH.profile.full_name)+'">' : esc(AUTH.profile.initials || initialsOf(AUTH.profile.full_name));
    });
  }
  function resizeProfilePhoto(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Pilih foto JPG, PNG, atau WebP'));
      if (file.size > 8 * 1024 * 1024) return reject(new Error('File foto maksimal 8MB'));
      var reader = new FileReader();
      reader.onerror = function(){reject(new Error('Foto tidak dapat dibaca'));};
      reader.onload = function(){var image=new Image();image.onerror=function(){reject(new Error('Foto tidak valid'));};image.onload=function(){var max=512,scale=Math.min(1,max/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.84));};image.src=reader.result;};
      reader.readAsDataURL(file);
    });
  }
  function resizeAnnouncementImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Pilih poster JPG, PNG, atau WebP'));
      if (file.size > 12 * 1024 * 1024) return reject(new Error('Ukuran poster maksimal 12MB'));
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Poster tidak dapat dibaca')); };
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () { reject(new Error('Poster tidak valid')); };
        image.onload = function () {
          var max = 1600, scale = Math.min(1, max / Math.max(image.width, image.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', .88));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  function openProfileEditor() {
    if (!AUTH.profile || !AUTH.user) return;
    var profile = AUTH.profile, prefs = profile.notification_preferences || {};
    var roleLabel = profile.role === 'admin' ? 'Fasil' : profile.role === 'mentor' ? 'Mentor' : 'Mentee';
    modal('<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><div style="width:48px;height:48px;border-radius:15px;background:#1a5f4f;color:#fff;display:grid;place-items:center;font-weight:900">' + esc(profile.initials || initialsOf(profile.full_name)) + '</div><div><small style="font-size:9px;color:#64748b;font-weight:800">PROFIL ' + roleLabel.toUpperCase() + '</small><h3 style="font-weight:850;color:#1e293b;font-size:17px">Edit profil saya</h3></div></div><label style="display:block;font-size:10px;font-weight:800;color:#334155;margin-bottom:4px">Nama lengkap</label><input id="profileEditName" maxlength="120" value="' + esc(profile.full_name || '') + '" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;margin-bottom:9px"><label style="display:block;font-size:10px;font-weight:800;color:#334155;margin-bottom:4px">Email login & notifikasi</label><input value="' + esc(profile.email || AUTH.user.email || '') + '" disabled style="width:100%;border:1px solid #e2e8f0;background:#f8fafc;color:#64748b;border-radius:10px;padding:9px;margin-bottom:9px">' + ((profile.role === 'mentee' || profile.role === 'mentor') ? '<label style="display:block;font-size:10px;font-weight:800;color:#334155;margin-bottom:4px">Jalur program</label><select id="profileEditPath" style="width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;background:#fff;margin-bottom:10px">'+trackOptions(profile.path,true)+'</select>' : '<div style="background:#f1f5f9;color:#475569;border-radius:10px;padding:9px;font-size:10px;margin-bottom:10px">Role: <b>' + roleLabel + '</b> · ' + esc(profile.path || '') + '</div>') + '<div style="background:#f8fafc;border-radius:11px;padding:10px"><b style="font-size:10px;color:#334155">Notifikasi email</b><label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#475569;margin-top:7px"><input id="profileEmailNotif" type="checkbox" ' + (prefs.email === false ? '' : 'checked') + '> Aktifkan email program</label><label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#475569;margin-top:6px"><input id="profileDeadlineNotif" type="checkbox" ' + (prefs.deadline === false ? '' : 'checked') + '> Pengingat deadline</label><label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#475569;margin-top:6px"><input id="profileReviewNotif" type="checkbox" ' + (prefs.review === false ? '' : 'checked') + '> Feedback dan revisi</label><label style="display:flex;align-items:center;gap:7px;font-size:10px;color:#475569;margin-top:6px"><input id="profileSessionNotif" type="checkbox" ' + (prefs.session === false ? '' : 'checked') + '> Agenda mentoring</label></div><button id="profileEditSave" class="ftg-suite-primary" style="width:100%;margin-top:12px"><i class="fa-solid fa-floppy-disk"></i> Simpan Profil</button>', function (box, close) {
      var path = $('#profileEditPath', box), avatarData = '', removeAvatar = false;
      var firstLabel = $('label',box), photoRow=document.createElement('div');
      photoRow.className='ftg-profile-photo-row';photoRow.innerHTML='<div id="profilePhotoPreview">'+profileAvatarMarkup(profile,64)+'</div><div><label class="ftg-photo-button"><i class="fa-solid fa-camera"></i> Ganti foto<input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button id="profilePhotoRemove" type="button" '+(profile.avatar_url?'':'hidden')+'>Hapus foto</button><small>JPG, PNG, atau WebP · otomatis diperkecil</small></div>';
      box.insertBefore(photoRow,firstLabel);
      var nameInput=$('#profileEditName',box),bioWrap=document.createElement('div');bioWrap.className='ftg-profile-bio';bioWrap.innerHTML='<label>Bio singkat <span id="profileBioCount">'+String(profile.bio||'').length+'/500</span></label><textarea id="profileEditBio" maxlength="500" rows="3" placeholder="Ceritakan singkat tentang dirimu, minat, atau peranmu di program...">'+esc(profile.bio||'')+'</textarea>';nameInput.parentNode.insertBefore(bioWrap,nameInput.nextSibling);
      $('#profileEditBio',box).addEventListener('input',function(){$('#profileBioCount',box).textContent=this.value.length+'/500';});
      $('#profilePhotoInput',box).addEventListener('change',function(){var input=this;if(!input.files[0])return;resizeProfilePhoto(input.files[0]).then(function(data){avatarData=data;removeAvatar=false;$('#profilePhotoPreview',box).innerHTML='<span class="ftg-profile-photo" style="width:64px;height:64px"><img src="'+data+'" alt="Pratinjau foto"></span>';$('#profilePhotoRemove',box).hidden=false;}).catch(function(error){toast(error.message,'⚠️');input.value='';});});
      $('#profilePhotoRemove',box).addEventListener('click',function(){avatarData='';removeAvatar=true;$('#profilePhotoPreview',box).innerHTML='<span class="ftg-profile-photo" style="width:64px;height:64px">'+esc(profile.initials||initialsOf(profile.full_name))+'</span>';this.hidden=true;});
      var passwordPanel=document.createElement('details');passwordPanel.className='ftg-password-panel';passwordPanel.innerHTML='<summary><i class="fa-solid fa-key"></i> '+((((AUTH.user.app_metadata||{}).providers||[]).indexOf('email')===-1)?'Tambahkan password login':'Ganti password')+'</summary><p>Gunakan minimal 10 karakter dengan huruf besar, huruf kecil, dan angka.</p><label>Password baru</label><input id="profileNewPassword" type="password" minlength="10" autocomplete="new-password" placeholder="Minimal 10 karakter"><label>Ulangi password</label><input id="profileConfirmPassword" type="password" minlength="10" autocomplete="new-password"><button id="profilePasswordSave" type="button"><i class="fa-solid fa-shield-halved"></i> Simpan Password</button>';box.appendChild(passwordPanel);
      $('#profileEditSave', box).addEventListener('click', function () {
        var button = this; button.disabled = true; button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        apiRequest('/api/program', { method:'POST', body:JSON.stringify({ action:'profile_update', full_name:$('#profileEditName',box).value.trim(), bio:$('#profileEditBio',box).value.trim(), avatar_data:avatarData, remove_avatar:removeAvatar, path:path ? path.value : profile.path, notification_preferences:{ email:$('#profileEmailNotif',box).checked, deadline:$('#profileDeadlineNotif',box).checked, review:$('#profileReviewNotif',box).checked, session:$('#profileSessionNotif',box).checked } }) }).then(function (data) {
          handleProfileRealtime({eventType:'UPDATE',new:data.profile||{},old:AUTH.profile},true);
          close(); toast('Profil berhasil diperbarui dan tersinkron real-time','✅');
        }).catch(function (error) { button.disabled=false;button.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Simpan Profil';toast(error.message,'⚠️'); });
      });
      $('#profilePasswordSave',box).addEventListener('click',function(){var button=this,password=$('#profileNewPassword',box).value,confirm=$('#profileConfirmPassword',box).value;if(password!==confirm){toast('Konfirmasi password tidak sama','⚠️');return;}button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'profile_password',password:password})}).then(function(){button.innerHTML='<i class="fa-solid fa-check"></i> Password tersimpan';$('#profileNewPassword',box).value='';$('#profileConfirmPassword',box).value='';toast('Password login berhasil disimpan','✅');}).catch(function(error){button.disabled=false;button.innerHTML='<i class="fa-solid fa-shield-halved"></i> Simpan Password';toast(error.message,'⚠️');});});
    });
  }
  function mountProfileControl() {
    if (!AUTH.profile) return;
    var header = $('main header'), actions = header && $('.ftg-header-actions', header); if (!actions) return;
    var control = $('.ftg-profile-control', actions);
    if (!control) {
      var candidate = $all('.rounded-full', actions).filter(function (item) { return /^[A-Z]{1,3}$/.test(item.textContent.trim()); })[0];
      if (candidate) { control=candidate;control.classList.add('ftg-profile-control');control.setAttribute('role','button');control.setAttribute('tabindex','0'); }
      else { control=document.createElement('button');control.type='button';control.className='ftg-profile-control';control.textContent=AUTH.profile.initials||initialsOf(AUTH.profile.full_name);actions.appendChild(control); }
      control.setAttribute('aria-label','Edit profil saya'); control.title='Edit profil saya';
      control.addEventListener('click',openProfileEditor);
      control.addEventListener('keydown',function(event){if(event.key==='Enter'||event.key===' '){event.preventDefault();openProfileEditor();}});
    }
    applyOwnProfilePhoto();
  }
  function mountSecureAccountAdmin() {
    if (PAGE.indexOf('admin-akun') !== 0 || !AUTH.profile || AUTH.profile.role !== 'admin') return;
    var wrap = $('#accountRows'); if (!wrap) return;
    function accountRoleChip(role) {
      var style = role === 'mentor' ? 'background:#dcfce7;color:#166534' : role === 'admin' ? 'background:#ede9fe;color:#6d28d9' : 'background:#ffedd5;color:#c2410c';
      var label = role === 'admin' ? 'Fasil' : role === 'mentor' ? 'Mentor' : 'Mentee';
      return '<span style="' + style + ';font-size:9px;font-weight:800;padding:4px 7px;border-radius:999px">' + label + '</span>';
    }
    var oldMentee = $('#btnAddMentee'), oldMentor = $('#btnAddMentor');
    function refreshAccounts() { invalidateApiCache('admin-users');try{sessionStorage.removeItem('ftg-admin-users');}catch(_){}load(true); }
    function replaceButton(old, role) { if (!old) return; var fresh = old.cloneNode(true); old.parentNode.replaceChild(fresh, old); fresh.addEventListener('click', function () { secureAccountModal(role, refreshAccounts); }); }
    replaceButton(oldMentee, 'mentee'); replaceButton(oldMentor, 'mentor');
    var toolbar = document.createElement('div'); toolbar.className = 'px-5 py-3 border-b border-slate-100'; toolbar.innerHTML = '<div style="display:flex;gap:8px"><input id="accountSearch" placeholder="Cari nama atau email..." style="flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:8px 11px;font-size:11px"><select id="accountRoleFilter" style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-size:11px;background:#fff"><option value="">Semua role</option><option value="mentee">Mentee</option><option value="mentor">Mentor</option><option value="admin">Fasil</option></select></div><p id="accountSecureStatus" style="font-size:9px;color:#16a34a;margin-top:5px">🔒 Dikelola melalui Supabase Auth · password tidak dapat dilihat Fasil</p>';
    wrap.parentElement.insertBefore(toolbar, wrap);
    var profiles = [];
    function render() {
      var q = ($('#accountSearch').value || '').toLowerCase(), role = $('#accountRoleFilter').value;
      var rows = profiles.filter(function (p) { return (!q || (p.full_name + ' ' + p.email).toLowerCase().indexOf(q) > -1) && (!role || p.role === role); });
      var count = $('#accountCount'); if (count) count.textContent = rows.length + ' akun ditemukan';
      wrap.innerHTML = rows.length ? rows.map(function (p) { var active = p.status === 'active', statusLabel = p.status === 'invited' ? 'MENUNGGU' : p.status === 'suspended' ? 'TERKUNCI' : p.status === 'dropped' ? 'GUGUR' : p.status === 'graduated' ? 'LULUS' : 'AKTIF'; var provider = p.login_provider === 'google' ? 'Google' : 'Email', avatar=p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="Foto '+esc(p.full_name)+'" style="width:100%;height:100%;object-fit:cover">':esc(p.initials||initialsOf(p.full_name)); return '<div class="px-5 py-3 flex items-center gap-3 border-b border-slate-50"><div data-profile-avatar="'+p.id+'" class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-[10px] '+(p.avatar_url?'ftg-profile-photo':'')+'" style="background:' + (p.role === 'mentor' ? '#1a5f4f' : p.role === 'admin' ? '#8b5cf6' : '#f97316') + '">' + avatar + '</div><div class="flex-1 min-w-0"><p class="text-[#2c3e50] text-xs font-semibold truncate">' + esc(p.full_name) + '</p><p class="text-slate-400 text-[10px] truncate">' + esc(p.email) + ' · ' + esc(p.path || '') + '</p>'+(p.bio?'<p class="text-slate-500 text-[9px] truncate">'+esc(p.bio)+'</p>':'')+'</div><span style="background:' + (provider === 'Google' ? '#eff6ff;color:#1d4ed8' : '#f1f5f9;color:#475569') + ';font-size:9px;font-weight:800;padding:4px 7px;border-radius:999px">' + (provider === 'Google' ? 'G Google' : '✉ Email') + '</span>' + accountRoleChip(p.role) + '<span style="font-size:9px;font-weight:800;color:' + (active ? '#16a34a' : p.status === 'invited' ? '#d97706' : '#ef4444') + '">' + statusLabel + '</span><button data-account-edit="' + p.id + '" style="border:0;background:#f1f5f9;color:#475569;border-radius:8px;padding:6px 8px;font-size:9px;font-weight:800">Kelola</button></div>'; }).join('') : '<p style="padding:24px;text-align:center;color:#94a3b8;font-size:12px">Tidak ada akun yang cocok.</p>';
      $all('[data-account-edit]', wrap).forEach(function (b) { b.addEventListener('click', function () { secureAccountManage(profiles.filter(function (p) { return p.id === b.getAttribute('data-account-edit'); })[0], refreshAccounts); }); });
      $all('[data-account-edit]', wrap).forEach(function (editButton) {
        var profile=profiles.filter(function(p){return p.id===editButton.getAttribute('data-account-edit');})[0];
        if(!profile||profile.role==='admin')return;
        var remove=document.createElement('button');remove.type='button';remove.className='ftg-account-delete';remove.setAttribute('aria-label','Hapus '+profile.full_name);remove.title='Hapus user permanen';remove.innerHTML='<i class="fa-solid fa-trash"></i>';
        editButton.parentNode.insertBefore(remove,editButton);
        remove.addEventListener('click',function(){if(!confirm('Hapus permanen akun '+profile.full_name+' beserta akses loginnya?'))return;var phrase=prompt('Ketik email akun untuk mengonfirmasi:\n'+profile.email);if(phrase!==profile.email){if(phrase!==null)toast('Email konfirmasi tidak sesuai','⚠️');return;}remove.disabled=true;remove.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';apiRequest('/api/admin-users?id='+encodeURIComponent(profile.id),{method:'DELETE'}).then(function(){toast('User '+profile.full_name+' berhasil dihapus','✅');refreshAccounts();}).catch(function(error){remove.disabled=false;remove.innerHTML='<i class="fa-solid fa-trash"></i>';toast(error.message,'⚠️');});});
      });
    }
    function hydrate(data) { var users=data.users||[],userMap={};users.forEach(function(user){userMap[user.id]=user;});profiles=(data.profiles||[]).map(function(p){var u=userMap[p.id]||{},meta=u.user_metadata||{};p.login_provider=(meta.signup_provider||((u.app_metadata||{}).provider)||'email');p.requested_role=meta.requested_role||p.role;p.mentor_application=meta.mentor_application||null;return p;});render(); }
    function load(force) { if(!profiles.length){var warm=force?null:readSessionCache('ftg-admin-users',120000);if(warm)hydrate(warm);else wrap.innerHTML=accountLoadingSkeleton();}cachedApiRequest('admin-users','/api/admin-users',null,45000,force===true).then(function (data) { writeSessionCache('ftg-admin-users',data);hydrate(data); }).catch(function (e) { if(!profiles.length)wrap.innerHTML = '<p style="padding:18px;color:#dc2626;font-size:11px">' + esc(e.message) + '</p>'; }); }
    $('#accountSearch').addEventListener('input', render); $('#accountRoleFilter').addEventListener('change', render); load(false);
    if(!wrap.getAttribute('data-profile-live')){wrap.setAttribute('data-profile-live','1');var accountRefreshTimer;document.addEventListener('ftg:profiles-changed',function(){clearTimeout(accountRefreshTimer);accountRefreshTimer=setTimeout(refreshAccounts,180);});}
  }
  function secureAccountModal(role, done) {
    var isMentee = role === 'mentee';
    var expertise=['Career Development','CV & LinkedIn','Interview Skills','Salary Negotiation','Personal Branding','Entrepreneurship','Business Model','Marketing','Product Development','Finance & Fundraising','Leadership','Mental Health','Tech & Digital','Creative Industry','Social Impact'];
    var mentorForm='<div class="ftg-admin-mentor-form"><div class="ftg-admin-mentor-note"><i class="fa-solid fa-circle-check"></i><span><b>Dibuat oleh Fasil = langsung approved.</b><small>Profil profesional tersimpan dan tidak perlu menunggu persetujuan lagi.</small></span></div><div class="ftg-admin-mentor-grid"><label>Track mentoring *<select id="suPath">'+trackOptions('',false)+'</select></label><label>WhatsApp *<input id="suMentorPhone" type="tel" placeholder="08xxxxxxxxxx"></label><label>Jabatan *<input id="suMentorJob" placeholder="Product Manager, Founder, dll."></label><label>Perusahaan / institusi *<input id="suMentorCompany"></label><label>Pengalaman *<select id="suMentorExperience"><option value="">Pilih</option><option value="1-3">1–3 tahun</option><option value="4-6">4–6 tahun</option><option value="7-10">7–10 tahun</option><option value="10+">10+ tahun</option></select></label><label>Waktu per bulan *<select id="suMentorAvailability"><option value="">Pilih</option><option value="2-4">2–4 jam</option><option value="4-6">4–6 jam</option><option value="6+">6+ jam</option></select></label><label>Format *<select id="suMentorFormat"><option value="">Pilih</option><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></label><label>LinkedIn<input id="suMentorLinkedin" type="url" placeholder="https://linkedin.com/in/..."></label></div><label>Keahlian * <small>pilih 1–5</small></label><div class="ftg-admin-mentor-expertise">'+expertise.map(function(item){return '<label><input type="checkbox" data-su-expertise value="'+esc(item)+'"> '+esc(item)+'</label>';}).join('')+'</div><label>Bio profesional * <small>minimal 40 karakter</small><textarea id="suMentorBio" rows="3"></textarea></label><label>Motivasi mendampingi * <small>minimal 60 karakter</small><textarea id="suMentorMotivation" rows="3"></textarea></label><label class="ftg-admin-mentor-consent"><input id="suMentorCommitment" type="checkbox"> Profil telah diverifikasi Fasil dan Mentor menyetujui komitmen serta kode etik.</label><label class="ftg-admin-mentor-consent"><input id="suAutoPair" type="checkbox" checked> Pasangkan otomatis mentee yang belum memiliki mentor pada track ini.</label><div id="suTrackPreview" class="ftg-admin-track-preview"></div></div>';
    modal('<h3 style="font-weight:800;color:#1e293b">' + (isMentee ? '🎓 Tambah Mentee' : '🧑‍🏫 Tambah & Lengkapi Mentor') + '</h3>' +
      '<p style="font-size:11px;color:#64748b;margin:4px 0 12px">Akun dibuat langsung di Supabase Auth. Password sementara hanya ditampilkan satu kali.</p><div class="ftg-admin-account-grid">' +
      '<label class="ftg-secure-label" for="suName">Nama lengkap<input id="suName" autocomplete="name" placeholder="Contoh: Aisyah Alfiana Dewi"></label>' +
      '<label class="ftg-secure-label" for="suEmail">Email aktif<input id="suEmail" type="email" autocomplete="email" placeholder="nama@gmail.com"></label>' +
      '<label class="ftg-secure-label" for="suPassword">Password sementara<input id="suPassword" type="password" autocomplete="new-password" placeholder="Min. 8 karakter, atau kosongkan"></label>' +
      (isMentee ? '<label class="ftg-secure-label">Jalur mentee<select id="suPath" aria-label="Jalur mentee">'+trackOptions('',false)+'</select></label>' : '') + '</div>' +
      (isMentee?'':mentorForm) +
      '<p id="suStatus" role="status" aria-live="polite" style="min-height:16px;font-size:10px;color:#64748b;margin-top:8px"></p>' +
      '<button type="button" id="suSave" style="width:100%;margin-top:4px;border:0;background:#1a5f4f;color:#fff;border-radius:10px;padding:11px;font-weight:800;cursor:pointer">Buat Akun Aman</button>', function (box, close) {
        var button=$('#suSave',box),status=$('#suStatus',box);
        function trackPreview(){if(isMentee)return;var track=$('#suPath',box).value,eligible=Object.keys(AUTH.profilesById).map(function(id){return AUTH.profilesById[id];}).filter(function(p){return p.role==='mentee'&&p.status==='active'&&p.path===track&&!p.mentor_id;});$('#suTrackPreview',box).innerHTML='<b>'+eligible.length+' mentee belum punya mentor di '+esc(track)+'</b>'+(eligible.length?'<span>'+eligible.slice(0,8).map(function(p){return esc(p.full_name);}).join(' · ')+'</span>':'<span>Pairing lama tetap dipertahankan.</span>');}
        if(!isMentee){
          $('#suPath',box).addEventListener('change',trackPreview);trackPreview();
          var expertiseInputs=$all('[data-su-expertise]',box),expertiseHint=document.createElement('div');
          expertiseHint.className='ftg-choice-count';expertiseHint.setAttribute('aria-live','polite');
          var expertiseGrid=expertiseInputs[0]&&expertiseInputs[0].closest('.ftg-admin-mentor-expertise');if(expertiseGrid)expertiseGrid.parentNode.insertBefore(expertiseHint,expertiseGrid);
          function updateExpertise(changed){var selected=expertiseInputs.filter(function(input){return input.checked;});if(selected.length>5&&changed){changed.checked=false;selected=expertiseInputs.filter(function(input){return input.checked;});status.style.color='#dc2626';status.textContent='Maksimal 5 keahlian. Hapus satu pilihan sebelum memilih yang lain.';}expertiseHint.textContent=selected.length+'/5 keahlian dipilih';expertiseHint.classList.toggle('is-complete',selected.length>0);}
          expertiseInputs.forEach(function(input){input.addEventListener('change',function(){updateExpertise(input);});});updateExpertise();
        }
        button.addEventListener('click', function () {
          var name=$('#suName',box).value.trim(),email=$('#suEmail',box).value.trim().toLowerCase(),password=$('#suPassword',box).value;
          if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){status.style.color='#dc2626';status.textContent='Nama lengkap dan email valid wajib diisi.';return;}
          if(password&&(password.length<10||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/\d/.test(password))){status.style.color='#dc2626';status.textContent='Password minimal 10 karakter dengan huruf besar, huruf kecil, dan angka.';return;}
          var payload={full_name:name,email:email,role:role,initials:initialsOf(name),path:$('#suPath',box).value};if(password)payload.password=password;
          if(!isMentee){var tags=$all('[data-su-expertise]',box).filter(function(input){return input.checked;}).map(function(input){return input.value;});payload.auto_pair=$('#suAutoPair',box).checked;payload.mentor_application={phone:$('#suMentorPhone',box).value,linkedin_url:$('#suMentorLinkedin',box).value,job_title:$('#suMentorJob',box).value,company_or_institution:$('#suMentorCompany',box).value,years_of_experience:$('#suMentorExperience',box).value,expertise_tags:tags,bio:$('#suMentorBio',box).value,availability_hours:$('#suMentorAvailability',box).value,mentoring_format:$('#suMentorFormat',box).value,motivation:$('#suMentorMotivation',box).value,commitment_confirmed:$('#suMentorCommitment',box).checked};if(tags.length<1||tags.length>5||payload.mentor_application.bio.trim().length<40||payload.mentor_application.motivation.trim().length<60||!payload.mentor_application.commitment_confirmed){status.style.color='#dc2626';status.textContent='Lengkapi profil Mentor, pilih 1–5 keahlian, bio, motivasi, dan komitmen.';return;}}
          button.disabled=true;button.style.cursor='wait';button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun…';status.style.color='#64748b';status.textContent='Menghubungkan ke Supabase dan menyiapkan profil…';
          apiRequest('/api/admin-users',{method:'POST',body:JSON.stringify(payload)}).then(function(data){close();var paired=data.paired?'<p style="font-size:11px;color:#166534;margin:8px 0">'+data.paired+' mentee otomatis dipasangkan berdasarkan track.</p>':'';if(data.temporary_password)modal('<h3 style="font-weight:800;color:#1e293b">Akun berhasil dibuat & approved</h3>'+paired+'<p style="font-size:11px;color:#64748b;margin:8px 0">Salin password sementara ini dan kirim melalui kanal pribadi.</p><code style="display:block;background:#0f172a;color:#fff;padding:12px;border-radius:10px;font-size:14px">'+esc(data.temporary_password)+'</code>');toast(name+' berhasil ditambahkan dan aktif','✅');done();}).catch(function(e){button.disabled=false;button.style.cursor='pointer';button.textContent='Buat Akun Aman';status.style.color='#dc2626';status.textContent=e.message||'Akun gagal dibuat. Silakan coba lagi.';toast(status.textContent,'⚠️');});
        });
        $('#suName',box).focus();
      });
  }
  function secureAccountManage(profile, done) {
    if (!profile) return;
    var isMentor=(profile.status==='invited'?(profile.requested_role||profile.role):profile.role)==='mentor';
    var html='<h3 style="font-weight:800;color:#1e293b">Kelola '+esc(profile.full_name)+'</h3><p style="font-size:10px;color:#64748b;margin:4px 0 10px">'+esc(profile.email)+'</p><div style="background:#f8fafc;border-radius:9px;padding:8px;margin-bottom:9px;font-size:10px;color:#475569">Login: <b>'+esc(profile.login_provider==='google'?'Google':'Email & password')+'</b>'+(profile.status==='invited'?' · Meminta akses sebagai <b>'+esc(profile.requested_role||'mentee')+'</b>':'')+'</div>'+(isMentor?'<button id="smMentorProfile" class="ftg-admin-mentor-edit"><i class="fa-solid fa-id-card"></i><span><b>Lengkapi / Edit Profil Mentor</b><small>Track, pengalaman, bio, keahlian, dan pairing</small></span><i class="fa-solid fa-chevron-right"></i></button>':'')+'<label style="font-size:10px;font-weight:800">Role</label><select id="smRole" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px;background:#fff;margin:4px 0 8px"><option value="mentee">Mentee</option><option value="mentor">Mentor</option><option value="admin">Fasil</option></select><div id="smMentorNotice" hidden style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:9px;padding:9px;margin-bottom:9px;font-size:10px"><b>Profil Mentor wajib lengkap.</b><br>Fasil dapat melengkapinya melalui tombol Profil Mentor di atas.</div><label style="font-size:10px;font-weight:800">Status</label><select id="smStatus" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px;background:#fff;margin:4px 0 8px"><option value="invited">Menunggu Verifikasi</option><option value="active">Aktif</option><option value="suspended">Terkunci</option><option value="dropped">Gugur</option><option value="graduated">Lulus</option></select><label style="font-size:10px;font-weight:800">Reset password sementara</label><input id="smPassword" type="password" placeholder="Kosongkan bila tidak diubah" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px;margin-top:4px"><button id="smSave" style="width:100%;margin-top:10px;border:0;background:#1a5f4f;color:#fff;border-radius:10px;padding:10px;font-weight:800">Simpan Perubahan</button><div style="border-top:1px solid #fee2e2;margin-top:14px;padding-top:12px"><p style="font-size:9px;color:#991b1b;margin-bottom:7px"><b>Zona berbahaya:</b> penghapusan akun bersifat permanen dan tercatat di audit log.</p><button id="smDelete" style="width:100%;border:1px solid #fecaca;background:#fff;color:#dc2626;border-radius:10px;padding:9px;font-size:10px;font-weight:850"><i class="fa-solid fa-user-xmark"></i> Hapus User Permanen</button></div>';
    modal(html,function(box,close){
      var role=$('#smRole',box),status=$('#smStatus',box),notice=$('#smMentorNotice',box);role.value=profile.status==='invited'?(profile.requested_role||'mentee'):profile.role;status.value=profile.status;
      function syncMentorRequirement(){var incomplete=role.value==='mentor'&&!profile.mentor_application;notice.hidden=!incomplete;$all('option',status).forEach(function(option){option.disabled=incomplete&&option.value==='active';});if(incomplete)status.value='invited';}
      role.addEventListener('change',syncMentorRequirement);syncMentorRequirement();
      var mentorProfileButton=$('#smMentorProfile',box);if(mentorProfileButton)mentorProfileButton.addEventListener('click',function(){close();adminMentorProfileModal(profile,done);});
      $('#smSave',box).addEventListener('click',function(){var payload={id:profile.id,role:role.value,status:status.value},pw=$('#smPassword',box).value,currentRole=profile.status==='invited'?(profile.requested_role||profile.role):profile.role;if(!pw&&payload.role===currentRole&&payload.status===profile.status){close();toast('Tidak ada perubahan yang perlu disimpan','✅');return;}if(pw)payload.password=pw;apiRequest('/api/admin-users',{method:'PATCH',body:JSON.stringify(payload)}).then(function(data){close();toast(data.mentor_profile_required?'Role Mentor disimpan · profil wajib dilengkapi':'Akun diperbarui','✅');done();}).catch(function(e){toast(e.message,'⚠️');});});
      $('#smDelete',box).addEventListener('click',function(){if(!confirm('Hapus permanen akun '+profile.full_name+' beserta akses loginnya?'))return;var phrase=prompt('Ketik email akun untuk mengonfirmasi:\n'+profile.email);if(phrase!==profile.email){if(phrase!==null)toast('Email konfirmasi tidak sesuai','⚠️');return;}var button=this;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...';apiRequest('/api/admin-users?id='+encodeURIComponent(profile.id),{method:'DELETE'}).then(function(){close();toast('User '+profile.full_name+' berhasil dihapus','✅');done();}).catch(function(error){button.disabled=false;button.innerHTML='<i class="fa-solid fa-user-xmark"></i> Hapus User Permanen';toast(error.message,'⚠️');});});
    });
  }
  function adminMentorProfileModal(profile,done){
    var a=profile.mentor_application||{},expertise=['Career Development','CV & LinkedIn','Interview Skills','Salary Negotiation','Personal Branding','Entrepreneurship','Business Model','Marketing','Product Development','Finance & Fundraising','Leadership','Mental Health','Tech & Digital','Creative Industry','Social Impact'];
    modal('<div class="ftg-admin-mentor-form"><div class="ftg-admin-mentor-note"><i class="fa-solid fa-user-shield"></i><span><b>Profil dilengkapi oleh Fasil</b><small>Setelah disimpan, akun langsung approved dan pairing track dijalankan.</small></span></div><div class="ftg-admin-mentor-grid"><label>Nama lengkap *<input id="amName" value="'+esc(profile.full_name||'')+'"></label><label>Email *<input id="amEmail" type="email" value="'+esc(profile.email||'')+'"></label><label>Track *<select id="amPath">'+trackOptions(profile.path,true)+'</select></label><label>WhatsApp *<input id="amPhone" value="'+esc(a.phone||'')+'"></label><label>Jabatan *<input id="amJob" value="'+esc(a.job_title||'')+'"></label><label>Perusahaan *<input id="amCompany" value="'+esc(a.company_or_institution||'')+'"></label><label>Pengalaman *<select id="amExperience"><option value="">Pilih</option><option value="1-3">1–3 tahun</option><option value="4-6">4–6 tahun</option><option value="7-10">7–10 tahun</option><option value="10+">10+ tahun</option></select></label><label>Waktu / bulan *<select id="amAvailability"><option value="">Pilih</option><option value="2-4">2–4 jam</option><option value="4-6">4–6 jam</option><option value="6+">6+ jam</option></select></label><label>Format *<select id="amFormat"><option value="">Pilih</option><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></label><label>LinkedIn<input id="amLinkedin" type="url" value="'+esc(a.linkedin_url||'')+'"></label></div><label>Keahlian *</label><div class="ftg-admin-mentor-expertise">'+expertise.map(function(item){return '<label><input type="checkbox" data-am-expertise value="'+esc(item)+'" '+((a.expertise_tags||[]).indexOf(item)>-1?'checked':'')+'> '+esc(item)+'</label>';}).join('')+'</div><label>Bio profesional *<textarea id="amBio" rows="3">'+esc(a.bio||profile.bio||'')+'</textarea></label><label>Motivasi *<textarea id="amMotivation" rows="3">'+esc(a.motivation||'')+'</textarea></label><label class="ftg-admin-mentor-consent"><input id="amCommitment" type="checkbox" '+(a.commitment_confirmed?'checked':'')+'> Komitmen dan kode etik telah dikonfirmasi.</label><label class="ftg-admin-mentor-consent"><input id="amAutoPair" type="checkbox" checked> Pairing otomatis mentee yang belum memiliki mentor.</label><p id="amStatus" class="ftg-admin-form-status"></p><button id="amSave" class="ftg-suite-primary">Simpan, Approve & Sinkronkan Pairing</button></div>',function(box,close){
      $('#amExperience',box).value=a.years_of_experience||'';$('#amAvailability',box).value=a.availability_hours||'';$('#amFormat',box).value=a.mentoring_format||'';
      $('#amSave',box).addEventListener('click',function(){var button=this,tags=$all('[data-am-expertise]',box).filter(function(input){return input.checked;}).map(function(input){return input.value;}),payload={action:'admin_mentor_profile',id:profile.id,full_name:$('#amName',box).value,email:$('#amEmail',box).value,path:$('#amPath',box).value,auto_pair:$('#amAutoPair',box).checked,mentor_application:{phone:$('#amPhone',box).value,linkedin_url:$('#amLinkedin',box).value,job_title:$('#amJob',box).value,company_or_institution:$('#amCompany',box).value,years_of_experience:$('#amExperience',box).value,expertise_tags:tags,bio:$('#amBio',box).value,availability_hours:$('#amAvailability',box).value,mentoring_format:$('#amFormat',box).value,motivation:$('#amMotivation',box).value,commitment_confirmed:$('#amCommitment',box).checked}};button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';apiRequest('/api/admin-users',{method:'PATCH',body:JSON.stringify(payload)}).then(function(data){close();toast('Profil Mentor approved · '+(data.paired||0)+' pairing baru'+(data.unpaired?' · '+data.unpaired+' pairing lama dilepas':''),'✅');done();}).catch(function(error){button.disabled=false;button.textContent='Coba Lagi';$('#amStatus',box).textContent=error.message;toast(error.message,'⚠️');});});
    });
  }
  function openProgramSettings() {
    var p = G.programSettings;
    modal('<h3 style="font-weight:800;color:#1e293b">⚙️ Pengaturan Program</h3><label style="display:block;font-size:11px;font-weight:800;margin:10px 0 4px">Nama program</label><input id="psName" value="' + esc(p.programName) + '" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><label style="display:block;font-size:11px;font-weight:800;margin:9px 0 4px">Bulan aktif</label><input id="psMonth" type="number" min="1" value="' + p.currentMonth + '" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px"></div><div><label style="display:block;font-size:11px;font-weight:800;margin:9px 0 4px">Minggu aktif</label><input id="psWeek" type="number" min="1" value="' + p.currentWeek + '" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px"></div></div><label style="display:block;font-size:11px;font-weight:800;margin:9px 0 4px">Nilai kelulusan</label><input id="psPass" type="number" min="0" max="100" value="' + p.passingScore + '" style="width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px"><button id="psSave" style="width:100%;margin-top:12px;border:0;background:#1a5f4f;color:#fff;border-radius:10px;padding:10px;font-weight:800">Simpan Pengaturan</button>', function (box, close) { $('#psSave', box).addEventListener('click', function () { p.programName = $('#psName', box).value.trim() || p.programName; p.currentMonth = +$('#psMonth', box).value || 1; p.currentWeek = +$('#psWeek', box).value || 1; p.passingScore = +$('#psPass', box).value || 75; addAudit('settings.update', p.programName); saveState(); if (sb) sb.from('program_settings').upsert({ id:1, program_name:p.programName, current_month:p.currentMonth, current_week:p.currentWeek, passing_score:p.passingScore, updated_at:new Date().toISOString() }).then(function(r){if(r.error)reportError(r.error);}); close(); toast('Pengaturan program tersimpan', '⚙️'); }); });
  }
  function openTrackManager() {
    return cachedApiRequest('program-tracks','/api/program',{method:'POST',body:JSON.stringify({action:'tracks_list',admin:true})},45000).then(function(data){
      var rows=(data.tracks||[]).map(function(track){return Object.assign({},track);});
      modal('<div id="trackManagerRoot"></div>',function(box,close){
        box.classList.add('ftg-modal-box-wide','ftg-track-manager-dialog');
        function collect(){return $all('[data-track-row]',box).map(function(row,index){return {id:row.getAttribute('data-track-id')||'',label:$('[data-track-label]',row).value.trim(),description:$('[data-track-description]',row).value.trim(),color:$('[data-track-color]',row).value,active:$('[data-track-active]',row).checked,order:index,created_at:row.getAttribute('data-track-created')||new Date().toISOString(),mentee_count:Number(row.getAttribute('data-track-mentees'))||0,mentor_count:Number(row.getAttribute('data-track-mentors'))||0};});}
        function render(){
          var root=$('#trackManagerRoot',box);root.innerHTML='<div class="ftg-track-manager"><div class="ftg-pairing-head"><div><small>KONFIGURASI PROGRAM · REALTIME</small><h3>Track / Path Program</h3><p>Track aktif otomatis tersedia di formulir Mentee, Mentor, profil, dan sistem pairing.</p></div><button type="button" id="trackAdd" class="ftg-suite-secondary"><i class="fa-solid fa-plus"></i> Track Baru</button></div><div class="ftg-track-list">'+rows.map(function(track,index){var used=(track.mentee_count||0)+(track.mentor_count||0);return '<article data-track-row data-track-id="'+esc(track.id||'')+'" data-track-created="'+esc(track.created_at||'')+'" data-track-mentees="'+(track.mentee_count||0)+'" data-track-mentors="'+(track.mentor_count||0)+'"><div class="ftg-track-color"><input data-track-color type="color" aria-label="Warna '+esc(track.label||'track')+'" value="'+esc(track.color||'#1a5f4f')+'"></div><div class="ftg-track-fields"><label>Nama track<input data-track-label maxlength="60" value="'+esc(track.label||'')+'" '+(used?'readonly title="Nama track yang sudah digunakan dijaga agar data pairing tetap aman"':'')+'></label><label>Deskripsi<input data-track-description maxlength="180" value="'+esc(track.description||'')+'" placeholder="Tujuan dan fokus track"></label><small><b>'+(track.mentee_count||0)+'</b> mentee · <b>'+(track.mentor_count||0)+'</b> mentor'+(used?' · Nama dikunci karena sudah digunakan':'')+'</small></div><div class="ftg-track-actions"><label class="ftg-track-switch"><input data-track-active type="checkbox" '+(track.active===false?'':'checked')+'><span>Aktif</span></label><button type="button" aria-label="Hapus '+esc(track.label||'track')+'" data-track-delete="'+index+'" class="ftg-suite-danger" '+(used?'disabled title="Track masih digunakan"':'')+'><i class="fa-solid fa-trash"></i></button></div></article>';}).join('')+'</div><div class="ftg-track-manager-note"><i class="fa-solid fa-circle-info"></i><span>Menonaktifkan track menyembunyikannya dari pendaftaran baru tanpa merusak peserta, mentor, atau riwayat pairing lama.</span></div><button type="button" id="trackSave" class="ftg-suite-primary"><i class="fa-solid fa-floppy-disk"></i> Simpan & Sinkronkan Semua Form</button></div>';
          $('#trackAdd',root).addEventListener('click',function(){rows=collect();rows.push({id:'',label:'',description:'',color:'#1a5f4f',active:true,mentee_count:0,mentor_count:0});render();var inputs=$all('[data-track-label]',root);if(inputs.length)inputs[inputs.length-1].focus();});
          $all('[data-track-delete]',root).forEach(function(button){button.addEventListener('click',function(){rows=collect();rows.splice(Number(button.getAttribute('data-track-delete')),1);render();});});
          $('#trackSave',root).addEventListener('click',function(){rows=collect();if(!rows.length||rows.some(function(track){return track.label.length<2;})||!rows.some(function(track){return track.active;})){toast('Isi nama track minimal 2 karakter dan sisakan satu track aktif','⚠️');return;}var button=this;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyinkronkan…';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'tracks_save',tracks:rows})}).then(function(result){invalidateApiCache('program-tracks');invalidateApiCache('program-pairings');G.programSettings=G.programSettings||{};G.programSettings.featureFlags=G.programSettings.featureFlags||{};G.programSettings.featureFlags.program_tracks=result.tracks;close();toast('Track tersimpan dan seluruh form tersinkron','✅');return loadStructuredData();}).catch(function(error){button.disabled=false;button.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Simpan & Sinkronkan Semua Form';toast(error.message,'⚠️');});});
        }
        render();
      });
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function openCohortManager() {
    return cachedApiRequest('program-pairings','/api/program',{method:'POST',body:JSON.stringify({action:'pairings_data'})},30000).then(function(data){var mentees=data.mentees||[],mentors=data.mentors||[],tracks=data.tracks||configuredTracks(true),unpaired=mentees.filter(function(row){return !row.mentor_id;}).length;
      function mentorOptions(mentee){var eligible=mentors.filter(function(mentor){return mentor.path===mentee.path;});return '<option value="">Belum ditentukan</option>'+eligible.map(function(mentor){return '<option value="'+esc(mentor.id)+'" '+(mentee.mentor_id===mentor.id?'selected':'')+'>'+esc(mentor.full_name)+'</option>';}).join('');}
      function trackSummary(track){var ownMentees=mentees.filter(function(row){return row.path===track;}),ownMentors=mentors.filter(function(row){return row.path===track;});return '<article><span>'+esc(track.replace(' Path',''))+'</span><b>'+ownMentees.length+' mentee</b><small>'+ownMentors.length+' mentor aktif</small></article>';}
      modal('<div class="ftg-pairing-manager"><div class="ftg-pairing-head"><div><small>PAIRING SERVER · REALTIME</small><h3>Mentor & Mentee berdasarkan Track</h3><p>Mentor hanya dapat dipasangkan dengan mentee pada track yang sama. Dashboard mentor langsung mengikuti data ini.</p></div><button id="pairingAuto" class="ftg-suite-secondary"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto-pair '+unpaired+' mentee</button></div><div class="ftg-pairing-summary">'+tracks.map(function(track){return trackSummary(track.label);}).join('')+'<article class="is-alert"><span>Belum dipasangkan</span><b>'+unpaired+' mentee</b><small>Perlu mentor sesuai track</small></article></div><div class="ftg-pairing-table"><div class="ftg-pairing-row is-head"><span>No</span><span>Nama Fellows</span><span>Track</span><span>Nama Mentor</span></div>'+mentees.map(function(mentee,index){return '<label class="ftg-pairing-row"><span>'+(index+1)+'</span><span><b>'+esc(mentee.full_name)+'</b><small>'+esc(mentee.email)+'</small></span><span class="ftg-track-chip '+(mentee.path==='Entrepreneur Path'?'is-entrepreneur':'')+'">'+esc(mentee.path||'Belum diatur')+'</span><select data-pairing-mentee="'+esc(mentee.id)+'">'+mentorOptions(mentee)+'</select></label>';}).join('')+'</div><div class="ftg-pairing-footer"><span><i class="fa-solid fa-shield-halved"></i> Perubahan tercatat di audit log dan tersinkron realtime.</span><button id="pairingSave" class="ftg-suite-primary">Simpan Pairing</button></div></div>',function(box,close){
        $('#pairingAuto',box).addEventListener('click',function(){var button=this;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Memasangkan…';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'pairings_auto'})}).then(function(result){invalidateApiCache('program-pairings');close();toast(result.paired+' mentee otomatis dipasangkan','✅');openCohortManager();}).catch(function(error){button.disabled=false;button.textContent='Coba Lagi';toast(error.message,'⚠️');});});
        $('#pairingSave',box).addEventListener('click',function(){var button=this,pairings=$all('[data-pairing-mentee]',box).map(function(select){return {mentee_id:select.getAttribute('data-pairing-mentee'),mentor_id:select.value||null};});button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'pairings_save',pairings:pairings})}).then(function(result){invalidateApiCache('program-pairings');close();toast(result.changed+' pairing diperbarui','✅');loadStructuredData();}).catch(function(error){button.disabled=false;button.textContent='Simpan Pairing';toast(error.message,'⚠️');});});
      });
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function downloadProtected(url, filename) {
    return fetch(url, { headers:{ Authorization:'Bearer ' + AUTH.accessToken } }).then(function(r){ if(!r.ok) return r.json().then(function(x){throw new Error(x.error || 'Unduhan gagal');}); return r.blob(); }).then(function(blob){ var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){URL.revokeObjectURL(a.href);},1000); }).catch(function(e){toast(e.message,'⚠️');throw e;});
  }
  function openProtectedReport(url) { var win=window.open('about:blank','_blank');return fetch(url,{headers:{Authorization:'Bearer '+AUTH.accessToken}}).then(function(r){if(!r.ok)throw new Error('Laporan gagal dibuka');return r.blob();}).then(function(blob){if(win)win.location.href=URL.createObjectURL(blob);}).catch(function(e){if(win)win.close();toast(e.message,'⚠️');throw e;}); }
  function openProgramSettingsSuite() {
    var p=G.programSettings || {}, rawFlags=p.featureFlags||{}, flags=Object.assign({assignments:true,workshops:true,journal:true,leaderboard:true,certificates:true},Object.keys(rawFlags).reduce(function(out,key){if(typeof rawFlags[key]==='boolean')out[key]=rawFlags[key];return out;},{}));
    modal('<h3 style="font-weight:800;color:#1e293b">⚙️ Pengaturan Program Lengkap</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><label>Nama program<input id="suiteName" value="'+esc(p.programName||'')+'"></label><label>Tahap aktif<select id="suitePhase"><option>EMPATHIZE</option><option>DEFINE</option><option>IDEATE</option><option>PROTOTYPE</option><option>TEST</option></select></label><label>Bulan aktif<input id="suiteMonth" type="number" min="1" value="'+(p.currentMonth||1)+'"></label><label>Minggu aktif<input id="suiteWeek" type="number" min="1" value="'+(p.currentWeek||1)+'"></label><label>Minimal tugas selesai (%)<input id="suiteCompletion" type="number" min="0" max="100" value="'+(p.completionRequirement||80)+'"></label><label>Minimal kehadiran (%)<input id="suiteAttendance" type="number" min="0" max="100" value="'+(p.attendanceRequirement||80)+'"></label><label>Minimal nilai<input id="suiteQuality" type="number" min="0" max="100" value="'+(p.qualityRequirement||75)+'"></label><label>Nilai kelulusan<input id="suitePass" type="number" min="0" max="100" value="'+(p.passingScore||75)+'"></label></div><p style="font-size:11px;font-weight:800;margin:10px 0 5px">Akses fitur</p><div id="suiteFlags" style="display:grid;grid-template-columns:1fr 1fr;gap:5px">'+Object.keys(flags).map(function(k){return '<label><input type="checkbox" data-flag="'+esc(k)+'" '+(flags[k]?'checked':'')+'> '+esc(k)+'</label>';}).join('')+'</div><button id="suiteSettingsSave" class="ftg-suite-primary">Simpan semua pengaturan</button>',function(box,close){ $('#suitePhase',box).value=p.activePhase||'DEFINE'; $('#suiteSettingsSave',box).addEventListener('click',function(){var button=this,featureFlags={};$all('[data-flag]',box).forEach(function(x){featureFlags[x.getAttribute('data-flag')]=x.checked;});var payload={action:'settings',program_name:$('#suiteName',box).value,current_month:+$('#suiteMonth',box).value,current_week:+$('#suiteWeek',box).value,passing_score:+$('#suitePass',box).value,active_phase:$('#suitePhase',box).value,completion_requirement:+$('#suiteCompletion',box).value,attendance_requirement:+$('#suiteAttendance',box).value,quality_requirement:+$('#suiteQuality',box).value,feature_flags:featureFlags,kpi_weights:p.kpiWeights||{completion:40,quality:35,engagement:25},rubric_templates:p.rubricTemplates||[]};button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan pengaturan…';apiRequest('/api/program',{method:'POST',body:JSON.stringify(payload)}).then(function(){G.programSettings=Object.assign({},p,{programName:payload.program_name,currentMonth:payload.current_month,currentWeek:payload.current_week,passingScore:payload.passing_score,activePhase:payload.active_phase,completionRequirement:payload.completion_requirement,attendanceRequirement:payload.attendance_requirement,qualityRequirement:payload.quality_requirement,featureFlags:Object.assign({},rawFlags,featureFlags)});invalidateApiCache('admin-operations');invalidateApiCache('operations-learning');close();toast('Pengaturan program tersimpan dan langsung aktif','✅');document.dispatchEvent(new CustomEvent('ftg:program-settings-changed'));}).catch(function(e){button.disabled=false;button.textContent='Simpan semua pengaturan';toast(e.message,'⚠️');}); });});
  }
  function openRubricSuite() {
    var rows=JSON.parse(JSON.stringify((G.programSettings&&G.programSettings.rubricTemplates)||[]));
    function html(){return '<h3 style="font-weight:800;color:#1e293b">🎯 Template Rubrik Panitia</h3><p style="font-size:11px;color:#64748b">Format setiap kriteria: nama | bobot | nilai maksimum. Total bobot harus 100%.</p><div id="suiteRubricRows">'+rows.map(function(r,i){return '<div style="border:1px solid #e2e8f0;border-radius:11px;padding:9px;margin-top:8px"><input data-rname="'+i+'" value="'+esc(r.name)+'"><textarea data-rcriteria="'+i+'" rows="4">'+esc((r.criteria||[]).map(function(c){return c.label+' | '+c.weight+' | '+(c.max||100);}).join('\n'))+'</textarea><button data-rremove="'+i+'" class="ftg-suite-danger">Hapus</button></div>';}).join('')+'</div><div style="display:flex;gap:7px"><button id="suiteRubricAdd" class="ftg-suite-secondary">+ Rubrik</button><button id="suiteRubricSave" class="ftg-suite-primary">Simpan rubrik</button></div>';}
    modal(html(),function(box,close){ function collect(){return $all('[data-rname]',box).map(function(n){var i=n.getAttribute('data-rname');return {name:n.value.trim(),criteria:($('[data-rcriteria="'+i+'"]',box).value||'').split(/\r?\n/).map(function(line){var x=line.split('|');return {label:(x[0]||'').trim(),weight:+x[1]||0,max:+x[2]||100};}).filter(function(x){return x.label;})};});} $all('[data-rremove]',box).forEach(function(b){b.addEventListener('click',function(){rows=collect();rows.splice(+b.getAttribute('data-rremove'),1);close();openRubricSuite();});});$('#suiteRubricAdd',box).addEventListener('click',function(){rows=collect();rows.push({name:'Rubrik Baru',criteria:[{label:'Kualitas hasil',weight:100,max:100}]});G.programSettings.rubricTemplates=rows;close();openRubricSuite();});$('#suiteRubricSave',box).addEventListener('click',function(){var button=this;rows=collect();if(rows.some(function(r){return !r.name||!r.criteria.length||r.criteria.reduce(function(s,c){return s+c.weight;},0)!==100;})){toast('Nama, kriteria, dan total bobot 100% wajib valid','⚠️');return;}button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan rubrik…';apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'settings',program_name:G.programSettings.programName,current_month:G.programSettings.currentMonth,current_week:G.programSettings.currentWeek,passing_score:G.programSettings.passingScore,active_phase:G.programSettings.activePhase||'DEFINE',completion_requirement:G.programSettings.completionRequirement||80,attendance_requirement:G.programSettings.attendanceRequirement||80,quality_requirement:G.programSettings.qualityRequirement||75,feature_flags:G.programSettings.featureFlags||{},kpi_weights:G.programSettings.kpiWeights||{},rubric_templates:rows})}).then(function(){G.programSettings.rubricTemplates=rows;invalidateApiCache('admin-operations');close();toast('Template rubrik tersimpan','✅');}).catch(function(e){button.disabled=false;button.textContent='Simpan rubrik';toast(e.message,'⚠️');});});});
  }
  function openEventSuite() {
    return cachedApiRequest('operations-events','/api/operations?resource=events',null,45000).then(function(data){modal('<h3 style="font-weight:800;color:#1e293b">🗓️ Kalender Program</h3><div style="max-height:180px;overflow:auto">'+((data.events||[]).map(function(e){return '<p style="border-bottom:1px solid #f1f5f9;padding:6px;font-size:11px"><b>'+esc(e.title)+'</b><br><span style="color:#64748b">'+new Date(e.starts_at).toLocaleString('id-ID')+' · '+esc(e.event_type)+'</span></p>';}).join('')||'<p>Belum ada agenda.</p>')+'</div><hr style="margin:10px 0"><div style="display:grid;grid-template-columns:1fr 1fr;gap:7px"><input id="eventTitle" placeholder="Nama kegiatan"><select id="eventType"><option value="workshop">Workshop</option><option value="mentoring">Mentoring</option><option value="opening">Opening</option><option value="closing">Closing</option><option value="other">Lainnya</option></select><input id="eventStart" type="datetime-local"><input id="eventEnd" type="datetime-local"><input id="eventLocation" placeholder="Lokasi / ruang"><input id="eventLink" type="url" placeholder="Link meeting"></div><textarea id="eventDesc" rows="2" placeholder="Keterangan"></textarea><button id="eventSave" class="ftg-suite-primary">Tambahkan ke kalender</button><a href="/api/calendar?public=1" target="_blank" style="display:block;text-align:center;font-size:11px;margin-top:8px">Unduh / sinkronkan kalender (.ics)</a>',function(box,close){var eventStart=$('#eventStart',box),eventEnd=$('#eventEnd',box),base=new Date(Date.now()+3600000);base.setMinutes(0,0,0);eventStart.value=localDateTimeValue(base);eventEnd.value=localDateTimeValue(new Date(base.getTime()+2*3600000));$('#eventSave',box).addEventListener('click',function(){var button=this;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan agenda…';apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'event_save',title:$('#eventTitle',box).value,event_type:$('#eventType',box).value,starts_at:$('#eventStart',box).value,ends_at:$('#eventEnd',box).value||null,location:$('#eventLocation',box).value,meeting_link:$('#eventLink',box).value,description:$('#eventDesc',box).value,visibility:'all'})}).then(function(){invalidateApiCache('operations-events');close();toast('Agenda ditambahkan','✅');document.dispatchEvent(new CustomEvent('ftg:events-changed'));}).catch(function(e){button.disabled=false;button.textContent='Tambahkan ke kalender';toast(e.message,'⚠️');});});});}).catch(function(e){toast(e.message,'⚠️');});
  }
  function eventIsRecording(event) {
    return event && event.event_type === 'other' && String(event.location || '').indexOf('LMS · ') === 0;
  }
  function eventCalendarStamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }
  function googleCalendarUrl(event) {
    var start = new Date(event.starts_at), end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 3600000);
    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title || 'Agenda FTG Fellowship',
      dates: eventCalendarStamp(start) + '/' + eventCalendarStamp(end),
      details: [event.description || '', event.meeting_link || ''].filter(Boolean).join('\n\n'),
      location: event.location || event.meeting_link || ''
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }
  function openMenteeCalendar() {
    var view = modal('<div class="ftg-calendar-view"><div class="ftg-calendar-view-head"><div><small>AGENDA PESERTA</small><h3><i class="fa-regular fa-calendar-check"></i> Kalender Program</h3><p>Lihat jadwal di sini. Tambahkan agenda yang kamu pilih langsung ke Google Calendar.</p></div><a class="ftg-suite-secondary" href="/api/calendar?public=1" target="_blank" rel="noopener"><i class="fa-solid fa-calendar-plus"></i> Sinkronkan semua (.ics)</a></div><div class="ftg-calendar-view-note"><i class="fa-solid fa-circle-info"></i><span>Tombol Google Calendar adalah pilihan utama. File .ics hanya tersedia untuk Apple Calendar, Outlook, atau aplikasi kalender lain.</span></div><div class="ftg-calendar-view-list"><div class="ftg-calendar-loading" role="status"><i class="fa-solid fa-circle-notch fa-spin"></i><b>Memuat agenda terbaru</b><span>Mohon tunggu sebentar.</span></div></div></div>');
    var list = $('.ftg-calendar-view-list', view.box);
    return apiRequest('/api/operations?resource=events').then(function (data) {
      var events = (data.events || []).filter(function (event) { return !eventIsRecording(event); }).sort(function (a, b) { return new Date(a.starts_at) - new Date(b.starts_at); });
      var now = Date.now(), upcoming = events.filter(function (event) { return new Date(event.starts_at).getTime() >= now; });
      var visible = (upcoming.length ? upcoming : events.slice(-6)).slice(0, 12);
      if (!document.contains(list)) return;
      list.innerHTML = visible.length ? visible.map(function (event) {
        var starts = new Date(event.starts_at), ended = event.ends_at ? new Date(event.ends_at) : null;
        return '<article><time datetime="' + esc(event.starts_at) + '"><b>' + starts.toLocaleDateString(UI_LANGUAGE === 'en' ? 'en-US' : 'id-ID', { day:'2-digit', month:'short' }) + '</b><span>' + starts.toLocaleTimeString(UI_LANGUAGE === 'en' ? 'en-US' : 'id-ID', { hour:'2-digit', minute:'2-digit' }) + '</span></time><div><h4>' + esc(event.title) + '</h4><p>' + esc([event.location, event.event_type].filter(Boolean).join(' · ')) + '</p>' + (ended ? '<small>Selesai ' + ended.toLocaleString(UI_LANGUAGE === 'en' ? 'en-US' : 'id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) + '</small>' : '') + '</div><div class="ftg-calendar-view-actions">' + (event.meeting_link ? '<a href="' + esc(event.meeting_link) + '" target="_blank" rel="noopener" class="ftg-suite-secondary">Buka link</a>' : '') + '<a href="' + esc(googleCalendarUrl(event)) + '" target="_blank" rel="noopener" class="ftg-suite-primary"><i class="fa-brands fa-google"></i> Tambah ke Google Calendar</a></div></article>';
      }).join('') : '<div class="ftg-calendar-empty"><i class="fa-regular fa-calendar"></i><b>Belum ada agenda mendatang</b><span>Jadwal baru dari Fasil akan otomatis muncul di sini.</span></div>';
    }).catch(function (error) {
      if (document.contains(list)) list.innerHTML = '<div class="ftg-calendar-error"><i class="fa-solid fa-triangle-exclamation"></i><b>Agenda belum dapat dimuat</b><span>' + esc(error.message || 'Silakan coba lagi.') + '</span><button type="button" class="ftg-suite-secondary" data-calendar-retry>Coba lagi</button></div>';
      var retry = $('[data-calendar-retry]', view.box);
      if (retry) retry.addEventListener('click', function () { view.close(); openMenteeCalendar(); });
      toast('Kalender belum dapat dimuat: ' + error.message, '⚠️');
      throw error;
    });
  }
  function upgradeMenteeCalendar() {
    var suite = byId('mentee-program-suite');
    var mainLink = suite && $('a[href^="/api/calendar"]', suite);
    if (mainLink) { mainLink.href = '#'; mainLink.dataset.menteeCalendar = '1'; mainLink.textContent = UI_LANGUAGE === 'en' ? 'Open Calendar' : 'Buka Kalender'; }
    if (document.body.dataset.menteeCalendarReady === '1') return;
    document.body.dataset.menteeCalendarReady = '1';
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[data-mentee-calendar],#menteeUpcomingEvents a[href^="/api/calendar"]');
      if (!link) return;
      event.preventDefault();
      openBusy(link, openMenteeCalendar);
    });
  }
  function openEventManager() {
    return cachedApiRequest('operations-events', '/api/operations?resource=events', null, 45000).then(function (data) {
      var events = (data.events || []).filter(function (event) { return !eventIsRecording(event); });
      modal('<div class="ftg-event-manager"><div class="ftg-event-manager-head"><div><small>KALENDER TERPUSAT</small><h3><i class="fa-regular fa-calendar-days"></i> Kelola Agenda Program</h3><p>Pilih agenda untuk mengubahnya, atau buat agenda baru. Perubahan langsung tampil di dashboard peserta.</p></div><button id="eventNew" type="button" class="ftg-suite-secondary"><i class="fa-solid fa-plus"></i> Agenda Baru</button></div><div class="ftg-event-manager-layout"><aside><b>Agenda tersimpan</b><span>' + events.length + ' agenda</span><div id="eventManagerList">' + (events.length ? events.map(function (event, index) { return '<button type="button" data-event-edit="' + index + '"><time>' + new Date(event.starts_at).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' }) + '</time><span><b>' + esc(event.title) + '</b><small>' + new Date(event.starts_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' }) + ' · ' + esc(event.event_type || 'other') + '</small></span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>'; }).join('') : '<div class="ftg-event-manager-empty">Belum ada agenda. Buat agenda pertama dari formulir.</div>') + '</div></aside><form id="eventManagerForm"><input id="eventId" type="hidden"><div class="ftg-event-form-title"><div><small id="eventModeLabel">AGENDA BARU</small><h4 id="eventFormHeading">Tambah kegiatan program</h4></div><span id="eventStatus" role="status">Belum disimpan</span></div><div class="ftg-event-fields"><label>Nama kegiatan *<input id="eventTitle" maxlength="160" required placeholder="Contoh: Mentoring Sesi 2"></label><label>Jenis kegiatan<select id="eventType"><option value="workshop">Workshop</option><option value="mentoring">Mentoring</option><option value="opening">Opening</option><option value="closing">Closing</option><option value="other">Lainnya</option></select></label><label>Mulai *<input id="eventStart" type="datetime-local" required></label><label>Selesai<input id="eventEnd" type="datetime-local"></label><label>Lokasi / ruang<input id="eventLocation" maxlength="180" placeholder="Contoh: Zoom atau Ruang Utama"></label><label>Link meeting<input id="eventLink" type="url" maxlength="500" placeholder="https://..."></label><label class="is-wide">Keterangan<textarea id="eventDesc" maxlength="1500" rows="3" placeholder="Informasi yang perlu diketahui peserta"></textarea></label></div><div class="ftg-event-actions"><button id="eventDelete" type="button" class="ftg-suite-danger" hidden><i class="fa-regular fa-trash-can"></i> Hapus Agenda</button><button id="eventSave" type="submit" class="ftg-suite-primary"><i class="fa-regular fa-floppy-disk"></i> Simpan Agenda</button></div></form></div><div class="ftg-event-manager-foot"><i class="fa-solid fa-circle-info"></i><span>Peserta dapat membuka kalender di dashboard dan menambahkan agenda tertentu ke Google Calendar tanpa mengunduh file.</span><a href="/api/calendar?public=1" target="_blank" rel="noopener">Ekspor semua (.ics)</a></div></div>', function (box, close) {
        var form = $('#eventManagerForm', box), status = $('#eventStatus', box), save = $('#eventSave', box), remove = $('#eventDelete', box);
        function defaults() { var start = new Date(Date.now() + 3600000); start.setMinutes(0,0,0); return { starts_at:start, ends_at:new Date(start.getTime() + 2 * 3600000) }; }
        function setMode(row) {
          var fresh = !row, base = defaults();
          $('#eventId', box).value = fresh ? '' : row.id;
          $('#eventTitle', box).value = fresh ? '' : row.title || '';
          $('#eventType', box).value = fresh ? 'workshop' : row.event_type || 'other';
          $('#eventStart', box).value = localDateTimeValue(fresh ? base.starts_at : row.starts_at);
          $('#eventEnd', box).value = localDateTimeValue(fresh ? base.ends_at : (row.ends_at || new Date(new Date(row.starts_at).getTime() + 3600000)));
          $('#eventLocation', box).value = fresh ? '' : row.location || '';
          $('#eventLink', box).value = fresh ? '' : row.meeting_link || '';
          $('#eventDesc', box).value = fresh ? '' : row.description || '';
          $('#eventModeLabel', box).textContent = fresh ? 'AGENDA BARU' : 'EDIT AGENDA';
          $('#eventFormHeading', box).textContent = fresh ? 'Tambah kegiatan program' : 'Perbarui ' + row.title;
          status.textContent = fresh ? 'Belum disimpan' : 'Data tersimpan';
          status.className = fresh ? '' : 'is-saved';
          save.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> ' + (fresh ? 'Simpan Agenda' : 'Simpan Perubahan');
          remove.hidden = fresh;
          $all('[data-event-edit]', box).forEach(function (button) { button.classList.toggle('is-active', !fresh && Number(button.dataset.eventEdit) === events.indexOf(row)); });
        }
        $('#eventNew', box).addEventListener('click', function () { setMode(null); $('#eventTitle', box).focus(); });
        $all('[data-event-edit]', box).forEach(function (button) { button.addEventListener('click', function () { setMode(events[Number(button.dataset.eventEdit)]); $('#eventTitle', box).focus(); }); });
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var start = $('#eventStart', box).value, end = $('#eventEnd', box).value, title = $('#eventTitle', box).value.trim();
          if (!title || !start) { status.textContent = 'Nama dan waktu mulai wajib diisi.'; status.className = 'is-error'; return; }
          if (end && new Date(end) <= new Date(start)) { status.textContent = 'Waktu selesai harus setelah waktu mulai.'; status.className = 'is-error'; return; }
          var payload = { action:'event_save', id:$('#eventId', box).value || null, title:title, event_type:$('#eventType', box).value, starts_at:start, ends_at:end || null, location:$('#eventLocation', box).value, meeting_link:$('#eventLink', box).value, description:$('#eventDesc', box).value, visibility:'all' };
          save.disabled = true; save.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan agenda'; status.textContent = 'Mengirim perubahan ke server...'; status.className = 'is-loading';
          apiRequest('/api/operations', { method:'POST', body:JSON.stringify(payload) }).then(function () { invalidateApiCache('operations-events'); close(); toast(payload.id ? 'Perubahan agenda tersimpan' : 'Agenda baru ditambahkan', '✅'); document.dispatchEvent(new CustomEvent('ftg:events-changed')); }).catch(function (error) { save.disabled = false; save.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Coba Simpan Lagi'; status.textContent = error.message; status.className = 'is-error'; });
        });
        remove.addEventListener('click', function () {
          var id = $('#eventId', box).value, title = $('#eventTitle', box).value.trim();
          if (!id || !window.confirm('Hapus agenda "' + title + '"? Tindakan ini tidak dapat dibatalkan.')) return;
          remove.disabled = true; remove.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghapus agenda'; status.textContent = 'Menghapus agenda dari server...'; status.className = 'is-loading';
          apiRequest('/api/operations', { method:'POST', body:JSON.stringify({ action:'event_delete', id:id }) }).then(function () { invalidateApiCache('operations-events'); close(); toast('Agenda dihapus', '✅'); document.dispatchEvent(new CustomEvent('ftg:events-changed')); }).catch(function (error) { remove.disabled = false; remove.innerHTML = '<i class="fa-regular fa-trash-can"></i> Coba Hapus Lagi'; status.textContent = error.message; status.className = 'is-error'; });
        });
        setMode(null);
      });
    }).catch(function (error) { toast('Kalender belum dapat dimuat: ' + error.message, '⚠️'); throw error; });
  }
  function openAttendanceSuite() {
    modal('<h3 style="font-weight:800;color:#1e293b">📷 Buat Presensi QR</h3><input id="attTitle" placeholder="Nama kegiatan"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Dibuka<input id="attOpen" type="datetime-local"></label><label>Ditutup<input id="attClose" type="datetime-local"></label></div><button id="attCreate" class="ftg-suite-primary">Buat QR presensi</button>',function(box,close){var opened=$('#attOpen',box),closed=$('#attClose',box),base=new Date(Date.now()+3600000);base.setMinutes(0,0,0);opened.value=localDateTimeValue(base);closed.value=localDateTimeValue(new Date(base.getTime()+2*3600000));$('#attCreate',box).addEventListener('click',function(){var button=this;button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Membuat QR…';apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'attendance_create',title:$('#attTitle',box).value,opens_at:opened.value,closes_at:closed.value})}).then(function(data){invalidateApiCache('operations-attendance');close();var qr='https://api.qrserver.com/v1/create-qr-code/?size=260x260&data='+encodeURIComponent(data.check_in_url);modal('<div style="text-align:center"><h3 style="font-weight:800">QR Presensi Siap</h3><img src="'+qr+'" alt="QR presensi" style="width:260px;max-width:100%;margin:12px auto"><p style="font-size:10px;word-break:break-all">'+esc(data.check_in_url)+'</p><button id="copyAttendance" class="ftg-suite-primary">Salin link presensi</button></div>',function(qbox){$('#copyAttendance',qbox).addEventListener('click',function(){navigator.clipboard.writeText(data.check_in_url);toast('Link disalin','✅');});});}).catch(function(e){button.disabled=false;button.textContent='Buat QR presensi';toast(e.message,'⚠️');});});});
  }
  function openCertificateSuite() {
    return cachedApiRequest('admin-operations','/api/operations',null,30000).then(function(data){var mentees=(data.profiles||[]).filter(function(p){return p.role==='mentee';});modal('<h3 style="font-weight:800;color:#1e293b">🎓 Sertifikat Otomatis</h3><p style="font-size:11px;color:#64748b">Sistem memeriksa tugas, kehadiran, nilai, dan status peserta sebelum menerbitkan.</p><div style="max-height:380px;overflow:auto">'+mentees.map(function(p){return '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding:8px"><span><b style="font-size:11px">'+esc(p.full_name)+'</b><small style="display:block;color:#64748b">'+esc(p.status)+'</small></span><button data-cert="'+p.id+'" class="ftg-suite-secondary">Periksa & Terbitkan</button></div>';}).join('')+'</div>',function(box){$all('[data-cert]',box).forEach(function(b){b.addEventListener('click',function(){b.disabled=true;apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'certificate_issue',mentee_id:b.getAttribute('data-cert')})}).then(function(x){toast('Sertifikat '+x.certificate.certificate_number+' diterbitkan','🎓');b.textContent='Terbit';}).catch(function(e){toast(e.message,'⚠️');b.disabled=false;});});});});}).catch(function(e){toast(e.message,'⚠️');});
  }
  function openHealthSuite() {
    return cachedApiRequest('admin-operations','/api/operations',null,30000).then(function(d){var mentees=(d.profiles||[]).filter(function(p){return p.role==='mentee';}),subs=d.submissions||[],assignments=(d.assignments||[]).filter(function(a){return a.status==='published';}),history=d.review_history||[],now=Date.now();var rows=mentees.map(function(p){var own=subs.filter(function(s){return s.mentee_id===p.id;}),risk=[];if((p.warning_level||0)>0)risk.push('Peringatan '+p.warning_level);if(!p.google_email)risk.push('Drive belum terhubung');if(!p.last_active_at||now-new Date(p.last_active_at).getTime()>7*86400000)risk.push('Tidak aktif >7 hari');var late=assignments.filter(function(a){return a.deadline&&new Date(a.deadline).getTime()<now&&!own.some(function(s){return s.assignment_id===a.id&&s.submitted_at;});}).length;if(late)risk.push(late+' tugas terlambat');if(own.some(function(s){return s.status==='submitted'&&!(s.reviews||[]).length;}))risk.push('Belum direview');var ownIds=new Set(own.map(function(s){return s.id;})),scores=history.filter(function(h){return ownIds.has(h.submission_id)&&h.decision==='approved';}).map(function(h){return +h.score;});if(scores.length>=2&&scores[scores.length-1]<scores[scores.length-2])risk.push('Nilai menurun');return {p:p,risk:risk};});modal('<h3 style="font-weight:800;color:#1e293b">❤️ Kesehatan Program</h3><p style="font-size:10px;color:#64748b">Deteksi otomatis aktivitas, keterlambatan, review, nilai, kehadiran, dan Drive.</p><div style="max-height:420px;overflow:auto">'+rows.map(function(x){return '<div style="border-left:4px solid '+(x.risk.length?'#ef4444':'#22c55e')+';padding:8px;margin:6px 0;background:#f8fafc"><b style="font-size:11px">'+esc(x.p.full_name)+'</b><p style="font-size:10px;color:'+(x.risk.length?'#b91c1c':'#166534')+'">'+(x.risk.join(' · ')||'Kondisi sehat')+'</p></div>';}).join('')+'</div>');}).catch(function(e){toast(e.message,'⚠️');});
  }
  function openAuditSuite(){return cachedApiRequest('operations-audit','/api/operations?resource=audit',null,30000).then(function(d){modal('<h3 style="font-weight:800;color:#1e293b">🛡️ Audit Log</h3><div style="max-height:450px;overflow:auto">'+(d.logs||[]).map(function(a){return '<p style="font-size:10px;border-bottom:1px solid #f1f5f9;padding:7px"><b>'+esc(a.action)+'</b> · '+esc((a.profiles&&a.profiles.full_name)||'Sistem')+'<br><span style="color:#94a3b8">'+new Date(a.created_at).toLocaleString('id-ID')+' · '+esc(a.entity_type||'')+'</span></p>';}).join('')+'</div>');}).catch(function(e){toast(e.message,'⚠️');});}
  function mountMenteeProgramSuite(){if(PAGE.indexOf('mentee-dashboard')!==0||!AUTH.profile)return;var host=$('main > div.px-8'),old=byId('mentee-program-suite');if(!host||old)return;var sec=document.createElement('section');sec.id='mentee-program-suite';sec.className='bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';sec.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><div><h2 style="font-size:15px;font-weight:800">🗓️ Agenda, Presensi & Sertifikat</h2><p style="font-size:11px;color:#64748b">Satu tempat untuk kegiatan program dan kelulusanmu.</p></div><div style="display:flex;gap:6px"><a href="#" data-mentee-calendar class="ftg-suite-secondary">Kalender</a><button id="myAttendance" class="ftg-suite-secondary">Presensi</button><button id="myCertificate" class="ftg-suite-primary">Sertifikat</button></div></div>';host.insertBefore(sec,host.firstChild);$('#myAttendance',sec).addEventListener('click',function(){apiRequest('/api/operations?resource=attendance').then(function(d){modal('<h3 style="font-weight:800">Riwayat Kehadiran</h3>'+((d.records||[]).map(function(r){return '<p style="padding:7px;border-bottom:1px solid #f1f5f9;font-size:11px"><b>'+esc((r.attendance_sessions||{}).title||'Kegiatan')+'</b><span style="float:right">'+esc(r.status)+'</span></p>';}).join('')||'<p style="color:#64748b">Belum ada data presensi.</p>'));});});$('#myCertificate',sec).addEventListener('click',function(){apiRequest('/api/operations?resource=certificate').then(function(d){if(d.certificate){var u='certificate.html?code='+encodeURIComponent(d.certificate.verification_code);modal('<div style="text-align:center"><h3 style="font-weight:800">🎓 Sertifikat '+esc(d.certificate.certificate_number)+'</h3><p style="margin:8px">'+esc(d.certificate.recipient_name)+'</p><a href="'+u+'" target="_blank" class="ftg-suite-primary">Lihat & cetak sertifikat</a></div>');}else{var e=d.eligibility||{};modal('<h3 style="font-weight:800">Syarat Sertifikat</h3><p>Tugas: '+(e.completion||0)+'% / '+((e.requirements||{}).completion||80)+'%</p><p>Kehadiran: '+(e.attendance||0)+'% / '+((e.requirements||{}).attendance||80)+'%</p><p>Nilai: '+(e.quality||0)+' / '+((e.requirements||{}).quality||75)+'</p><p style="margin-top:8px;color:#b45309">Sertifikat diterbitkan panitia setelah seluruh syarat terpenuhi.</p>');}});});}
  function mountUpcomingEvents(){if(PAGE.indexOf('mentee-dashboard')!==0)return;var suite=byId('mentee-program-suite');if(!suite||byId('menteeUpcomingEvents'))return;var host=document.createElement('div');host.id='menteeUpcomingEvents';host.className='ftg-upcoming-events';host.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Memuat jadwal terdekat…';suite.appendChild(host);function load(){apiRequest('/api/operations?resource=events').then(function(data){var upcoming=(data.events||[]).filter(function(item){return new Date(item.starts_at).getTime()>=Date.now();}).slice(0,3);host.innerHTML=upcoming.length?'<b>Jadwal terdekat</b>'+upcoming.map(function(item){return '<a href="/api/calendar?public=1"><time>'+new Date(item.starts_at).toLocaleDateString(UI_LANGUAGE==='en'?'en-US':'id-ID',{day:'2-digit',month:'short'})+'</time><span><strong>'+esc(item.title)+'</strong><small>'+new Date(item.starts_at).toLocaleString(UI_LANGUAGE==='en'?'en-US':'id-ID')+(item.location?' · '+esc(item.location):'')+'</small></span></a>';}).join(''):'<span>Belum ada agenda mendatang.</span>';applyLanguage(host);}).catch(function(error){host.innerHTML='<span>Jadwal belum dapat dimuat. <button type="button">Coba lagi</button></span>';$('button',host).onclick=load;});}load();document.addEventListener('ftg:events-changed',load,{once:true});}

  function openRecordingManager() {
    return cachedApiRequest('operations-recordings','/api/operations?resource=recordings',null,45000).then(function(data){
      var rows=data.recordings||[];
      modal('<div class="ftg-recording-admin-head"><div><small>KONTEN LMS</small><h3><i class="fa-brands fa-youtube"></i> Kelola Rekaman Program</h3><p>Tambahkan link YouTube. Video otomatis muncul untuk mentee dan mentor.</p></div></div><div class="ftg-recording-admin-grid"><form id="recordingForm"><input id="recordingId" type="hidden"><label>Judul rekaman *</label><input id="recordingTitle" maxlength="160" required placeholder="Contoh: Mentoring Sesi 1 FBF"><label>Link YouTube *</label><input id="recordingUrl" type="url" required placeholder="https://youtu.be/..."><label>Nama sesi / kategori</label><input id="recordingSession" maxlength="120" placeholder="Mentoring, Workshop, atau kelas"><label>Tanggal rekaman</label><input id="recordingDate" type="datetime-local"><label>Deskripsi</label><textarea id="recordingDescription" maxlength="1500" rows="3" placeholder="Ringkasan materi untuk peserta"></textarea><div class="ftg-recording-form-actions"><button id="recordingReset" type="button" class="ftg-suite-secondary">Bersihkan</button><button id="recordingSave" type="submit" class="ftg-suite-primary"><i class="fa-solid fa-cloud-arrow-up"></i> Publikasikan</button></div></form><div class="ftg-recording-admin-list"><div><b>Rekaman terbit</b><span>'+rows.length+' video</span></div><div id="recordingAdminItems">'+(rows.map(function(r){return '<article data-recording-row="'+esc(r.id)+'"><img src="https://i.ytimg.com/vi/'+esc(r.youtube_id)+'/mqdefault.jpg" alt=""><div><b>'+esc(r.title)+'</b><small>'+esc(r.location||'Rekaman Program')+' · '+esc(recordingDate(r.starts_at))+'</small><div><button type="button" data-recording-edit="'+esc(r.id)+'">Edit</button><button type="button" data-recording-delete="'+esc(r.id)+'">Hapus</button></div></div></article>';}).join('')||'<div class="ftg-recording-none">Belum ada rekaman. Tambahkan video pertama dari formulir.</div>')+'</div></div></div>',function(box,close){
        var form=document.getElementById('recordingForm'),save=document.getElementById('recordingSave');
        function reset(){form.reset();document.getElementById('recordingId').value='';save.innerHTML='<i class="fa-solid fa-cloud-arrow-up"></i> Publikasikan';}
        document.getElementById('recordingReset').addEventListener('click',reset);
        $all('[data-recording-edit]',box).forEach(function(b){b.addEventListener('click',function(){var row=rows.filter(function(r){return String(r.id)===b.getAttribute('data-recording-edit');})[0];if(!row)return;document.getElementById('recordingId').value=row.id;document.getElementById('recordingTitle').value=row.title||'';document.getElementById('recordingUrl').value=row.meeting_link||'';document.getElementById('recordingSession').value=row.location||'';document.getElementById('recordingDescription').value=row.description||'';document.getElementById('recordingDate').value=row.starts_at?new Date(row.starts_at).toISOString().slice(0,16):'';save.textContent='Simpan Perubahan';form.scrollIntoView({behavior:'smooth',block:'start'});});});
        $all('[data-recording-delete]',box).forEach(function(b){b.addEventListener('click',function(){if(!confirm('Hapus rekaman ini dari LMS? Video asli di YouTube tidak ikut terhapus.'))return;b.disabled=true;apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'recording_delete',id:b.getAttribute('data-recording-delete')})}).then(function(){invalidateApiCache('operations-recordings');toast('Rekaman dihapus dari LMS','✅');close();openRecordingManager();}).catch(function(e){toast(e.message,'⚠️');b.disabled=false;});});});
        form.addEventListener('submit',function(e){e.preventDefault();var url=document.getElementById('recordingUrl').value.trim();if(!/(youtu\.be\/|youtube\.com\/(watch|embed|shorts))/.test(url)){toast('Masukkan link video YouTube yang valid','⚠️');return;}save.disabled=true;save.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'recording_save',id:document.getElementById('recordingId').value||null,title:document.getElementById('recordingTitle').value,youtube_url:url,session_name:document.getElementById('recordingSession').value,recorded_at:document.getElementById('recordingDate').value||null,description:document.getElementById('recordingDescription').value})}).then(function(){invalidateApiCache('operations-recordings');toast('Rekaman dipublikasikan ke LMS','✅');close();openRecordingManager();}).catch(function(e){toast(e.message,'⚠️');save.disabled=false;save.textContent='Coba Lagi';});});
      });
    }).catch(function(e){toast(e.message,'⚠️');});
  }
  function learningProgressMeta(config, row) {
    var progress = row && row.checklist_state || { weeks:{} }, complete = canvasCompletion(config, progress), lastWeek = 0;
    (config.weeks || []).forEach(function (week) { var answers=progress.weeks && progress.weeks[String(week.number)] && progress.weeks[String(week.number)].answers || []; if (answers.some(function(a){return String(a||'').trim();})) lastWeek=week.number; });
    return { percent:complete.percent, filled:complete.filled, total:complete.total, lastWeek:lastWeek, updated:row && row.updated_at, status:row && row.status || 'not_started' };
  }
  function learningDetail(profile, progress, config) {
    var state = progress && progress.checklist_state || { weeks:{} };
    modal('<div class="ftg-learning-detail"><span>PROGRES CANVAS</span><h3>' + esc(profile.full_name) + '</h3><p>' + esc(profile.email) + ' · ' + esc(profile.path || 'Mentee') + '</p><div class="ftg-learning-answer"><b>Niyyah</b><p>' + esc(state.niyyah || 'Belum diisi') + '</p></div>' + config.weeks.map(function(week){var answers=state.weeks&&state.weeks[String(week.number)]&&state.weeks[String(week.number)].answers||[];return '<section><h4>W'+week.number+' · '+esc(week.phase)+'</h4>'+week.questions.map(function(q,i){return '<div class="ftg-learning-answer"><b>'+esc(q)+'</b><p>'+esc(answers[i]||'Belum diisi')+'</p></div>';}).join('')+'</section>';}).join('') + '</div>');
  }
  function openLearningManager() {
    var isAdmin = myRole() === 'admin';
    return cachedApiRequest('operations-learning','/api/operations?resource=learning',null,45000).then(function(data){
      var config=data.config, learners=data.learners||[];
      var configHtml = isAdmin ? '<div class="ftg-learning-config"><div class="ftg-learning-config-head"><div><small>KURIKULUM TERPUSAT</small><h3>Atur Canvas & Pembukaan Minggu</h3><p>Mode otomatis mengikuti minggu aktif. Buka/Kunci Paksa mengesampingkan jadwal.</p></div><label>Minggu aktif<select id="learningActiveWeek">'+[1,2,3,4].map(function(n){return '<option value="'+n+'" '+(config.active_week===n?'selected':'')+'>Minggu '+n+'</option>';}).join('')+'</select></label></div><label>Judul Canvas<input id="learningTitle" value="'+esc(config.title)+'"></label><label>Petunjuk<textarea id="learningInstructions" rows="2">'+esc(config.instructions)+'</textarea></label><div class="ftg-learning-week-config">'+config.weeks.map(function(week){return '<article data-learning-config-week="'+week.number+'"><div><span>W'+week.number+'</span><div><b>'+esc(week.phase)+'</b><small>'+esc(week.title)+'</small></div></div><label>Mode<select data-learning-mode><option value="automatic" '+(week.mode==='automatic'?'selected':'')+'>Otomatis</option><option value="open" '+(week.mode==='open'?'selected':'')+'>Buka Paksa</option><option value="closed" '+(week.mode==='closed'?'selected':'')+'>Kunci Paksa</option></select></label><label>Judul<input data-learning-title value="'+esc(week.title)+'"></label><div class="ftg-learning-dates"><label>Dibuka<input data-learning-open type="datetime-local" value="'+localDateTimeValue(week.open_at)+'"></label><label>Ditutup<input data-learning-close type="datetime-local" value="'+localDateTimeValue(week.close_at)+'"></label></div><label>Pertanyaan (satu per baris)<textarea data-learning-questions rows="4">'+esc(week.questions.join('\n'))+'</textarea></label></article>';}).join('')+'</div><button id="learningConfigSave" class="ftg-suite-primary"><i class="fa-solid fa-floppy-disk"></i> Simpan & Publikasikan</button></div>' : '';
      var monitorHtml='<div class="ftg-learning-monitor"><div><div><small>MONITOR TANPA IMPERSONASI</small><h3>Progres Belajar Mentee</h3></div><span>'+learners.length+' mentee</span></div><div class="ftg-learning-table"><div class="ftg-learning-row is-head"><span>Mentee</span><span>Minggu</span><span>Progres</span><span>Status</span><span>Aktivitas</span></div>'+learners.map(function(item){var meta=learningProgressMeta(config,item.progress);return '<button type="button" class="ftg-learning-row" data-learning-person="'+item.profile.id+'"><span><b>'+esc(item.profile.full_name)+'</b><small>'+esc(item.profile.path||'Mentee')+'</small></span><span>W'+(meta.lastWeek||'—')+'</span><span><i><em style="width:'+meta.percent+'%"></em></i><b>'+meta.percent+'%</b></span><span class="is-'+meta.status+'">'+esc(meta.status==='submitted'?'Menunggu review':meta.status==='approved'?'Dinilai':meta.status==='revision'?'Perlu revisi':meta.status==='draft'?'Draft':'Belum mulai')+'</span><span>'+(meta.updated?new Date(meta.updated).toLocaleDateString('id-ID'):'—')+' <i class="fa-solid fa-chevron-right"></i></span></button>';}).join('')+'</div></div>';
      modal('<div class="ftg-learning-manager">'+configHtml+monitorHtml+'</div>',function(box,close){
        box.style.maxWidth='980px';
        $all('[data-learning-person]',box).forEach(function(button){button.addEventListener('click',function(){var item=learners.filter(function(x){return x.profile.id===button.getAttribute('data-learning-person');})[0];if(item)learningDetail(item.profile,item.progress,config);});});
        var save=document.getElementById('learningConfigSave'); if(save)save.addEventListener('click',function(){
          config.title=document.getElementById('learningTitle').value;config.instructions=document.getElementById('learningInstructions').value;config.active_week=+document.getElementById('learningActiveWeek').value;
          $all('[data-learning-config-week]',box).forEach(function(card){var n=+card.getAttribute('data-learning-config-week'),week=config.weeks[n-1];week.mode=$('[data-learning-mode]',card).value;week.title=$('[data-learning-title]',card).value;week.open_at=$('[data-learning-open]',card).value||null;week.close_at=$('[data-learning-close]',card).value||null;week.questions=$('[data-learning-questions]',card).value.split(/\r?\n/).map(function(q){return q.trim();}).filter(Boolean);});
          save.disabled=true;save.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Mempublikasikan...';
          apiRequest('/api/operations',{method:'POST',body:JSON.stringify({action:'config_save',config:config})}).then(function(){invalidateApiCache('operations-learning');close();toast('Kurikulum dan akses minggu berhasil diperbarui','✅');openLearningManager();}).catch(function(error){save.disabled=false;save.textContent='Coba Lagi';toast(error.message,'⚠️');});
        });
      });
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function openAssignmentMonitor() {
    return cachedApiRequest('admin-operations','/api/operations',null,30000).then(function(data){
      var profiles={};(data.profiles||[]).forEach(function(p){profiles[p.id]=p;});
      var submissions=data.submissions||[];
      var rows=(data.assignments||[]).map(function(task){var related=submissions.filter(function(s){return s.assignment_id===task.id;}),sent=related.filter(function(s){return !!s.submitted_at;}),reviewed=related.filter(function(s){return s.status==='approved';});return {task:task,related:related,sent:sent,reviewed:reviewed};});
      modal('<div class="ftg-assignment-monitor"><div class="ftg-assignment-monitor-head"><div><span>MONITORING TERPUSAT</span><h3>Tugas & Pengumpulan Program</h3><p>Fasil melihat status lintas mentor tanpa membuka dashboard mentee.</p></div><button id="assignmentMonitorCreate" type="button" class="ftg-suite-primary"><i class="fa-solid fa-plus"></i><span>Tugas Baru</span></button></div><div class="ftg-assignment-monitor-list">'+rows.map(function(item){return '<article><div><b>'+esc(item.task.title)+'</b><small>'+(item.task.deadline?'Deadline '+new Date(item.task.deadline).toLocaleString('id-ID'):'Tanpa deadline')+' · '+esc(item.task.status)+'</small></div><div><span><b>'+item.sent.length+'</b> terkumpul</span><span><b>'+item.reviewed.length+'</b> dinilai</span><button type="button" data-monitor-task="'+esc(item.task.id)+'">Lihat detail</button></div></article><div data-monitor-detail="'+esc(item.task.id)+'" hidden>'+item.related.map(function(sub){var p=profiles[sub.mentee_id]||{};return '<div><span><b>'+esc(p.full_name||'Mentee')+'</b><small>'+esc(p.email||'')+'</small></span><em>'+esc(sub.status)+'</em><time>'+(sub.updated_at?new Date(sub.updated_at).toLocaleString('id-ID'):'—')+'</time></div>';}).join('')+'</div>';}).join('')+'</div></div>',function(box,shut){
        box.style.maxWidth='850px';
        var create=$('#assignmentMonitorCreate',box);
        if(create)create.addEventListener('click',function(){
          if(create.disabled||create.getAttribute('aria-busy')==='true')return;
          var original=create.innerHTML;
          create.disabled=true;
          create.setAttribute('aria-busy','true');
          create.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i><span>Menyiapkan…</span>';
          try{
            openAssignmentEditor(null,function(){
              invalidateApiCache('admin-operations');
              shut();
              setTimeout(openAssignmentMonitor,230);
            });
            requestAnimationFrame(function(){create.disabled=false;create.removeAttribute('aria-busy');create.innerHTML=original;});
          }catch(error){
            create.disabled=false;
            create.removeAttribute('aria-busy');
            create.innerHTML=original;
            toast((error&&error.message)||'Form tugas gagal dibuka. Silakan coba lagi.','⚠️');
            console.error('Assignment editor failed:',error);
          }
        });
        $all('[data-monitor-task]',box).forEach(function(button){button.addEventListener('click',function(){var detail=$('[data-monitor-detail="'+button.getAttribute('data-monitor-task')+'"]',box);if(detail){detail.hidden=!detail.hidden;button.textContent=detail.hidden?'Lihat detail':'Tutup detail';}});});
      });
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function openAdminNotificationCenter() {
    modal('<div class="ftg-mail-admin"><div class="ftg-mail-admin-head"><div><small>KOMUNIKASI TERPUSAT</small><h3><i class="fa-solid fa-paper-plane"></i> Email & Notifikasi</h3><p>Kirim pengumuman dari data akun website dan pantau hasil pengiriman Zoho.</p></div><span id="mailProviderState"><i class="fa-solid fa-spinner fa-spin"></i> Memeriksa</span></div><div id="mailAdminLoading" class="ftg-mail-loading"><i class="fa-solid fa-spinner fa-spin"></i><b>Menyiapkan daftar penerima…</b></div><div id="mailAdminWorkspace" hidden></div></div>', function (box) {
      box.style.maxWidth = '940px';
      cachedApiRequest('admin-notifications','/api/notifications',null,30000).then(function (data) {
        var profiles = data.profiles || [], outbox = data.outbox || [];
        var providerReady=data.email_provider&&data.email_provider!=='not_configured';$('#mailProviderState', box).className = providerReady?'is-ready':'is-error'; $('#mailProviderState', box).innerHTML = providerReady?'<i class="fa-solid fa-circle-check"></i> '+esc(data.email_provider==='zoho'?'Zoho aktif':'Email aktif'):'<i class="fa-solid fa-circle-exclamation"></i> Email belum siap';
        $('#mailAdminLoading', box).hidden = true;
        var workspace = $('#mailAdminWorkspace', box); workspace.hidden = false;
        workspace.innerHTML = '<div class="ftg-mail-tabs"><button type="button" class="is-active" data-mail-tab="compose">Tulis & Kirim</button><button type="button" data-mail-tab="history">Riwayat <span>'+outbox.length+'</span></button></div><section data-mail-panel="compose"><div class="ftg-mail-compose"><form id="manualMailForm"><div class="ftg-mail-field"><label>Penerima</label><select id="manualMailTarget"><option value="mentee">Semua Mentee aktif</option><option value="mentor">Semua Mentor aktif</option><option value="all">Semua peserta & tim aktif</option><option value="admin">Semua Fasil aktif</option><option value="custom">Pilih akun tertentu</option></select><small id="manualMailCount"></small></div><div id="manualMailPeople" class="ftg-mail-people" hidden><div><i class="fa-solid fa-magnifying-glass"></i><input id="manualMailSearch" placeholder="Cari nama atau email…"></div><label class="ftg-mail-check-all"><input id="manualMailCheckAll" type="checkbox"> Pilih semua hasil</label><div id="manualMailPeopleRows"></div></div><div class="ftg-mail-two"><div class="ftg-mail-field"><label>Jenis pesan</label><select id="manualMailType"><option value="general">Pengumuman umum</option><option value="assignment">Tugas baru</option><option value="deadline:manual:3">Pengingat H-3</option><option value="deadline:manual:1">Pengingat H-1</option><option value="deadline:manual:0">Deadline hari ini</option><option value="late:manual">Tugas terlambat</option><option value="review">Feedback / revisi</option><option value="session">Agenda mentoring</option><option value="registration">Status pendaftaran</option><option value="account_restored">Status akun</option><option value="certificate">Sertifikat</option></select></div><div class="ftg-mail-field"><label>Kanal pengiriman</label><select id="manualMailChannel"><option value="both">Email + notifikasi dashboard</option><option value="email">Email saja</option><option value="in_app">Dashboard saja</option></select></div></div><div class="ftg-mail-field"><label>Subjek *</label><input id="manualMailTitle" maxlength="160" required placeholder="Contoh: Perubahan jadwal Mentoring Sesi 2"><small><span id="manualMailTitleCount">0</span>/160 karakter</small></div><div class="ftg-mail-field"><label>Isi pesan *</label><textarea id="manualMailBody" maxlength="1000" rows="6" required placeholder="Tulis informasi yang jelas, tanggal, waktu, dan tindakan yang perlu dilakukan penerima."></textarea><small><span id="manualMailBodyCount">0</span>/1000 karakter</small></div><div class="ftg-mail-field"><label>Tautan tombol di email</label><select id="manualMailHref"><option value="mentee-dashboard.html">Dashboard Mentee</option><option value="assignment-submission.html">Tugas Saya</option><option value="mentor-feedback.html">Feedback Mentor</option><option value="workshop-library.html">Workshop Library</option><option value="mentor-dashboard.html">Dashboard Mentor</option><option value="admin-dashboard.html">Dashboard Fasil</option></select></div><label class="ftg-mail-confirm"><input id="manualMailConfirm" type="checkbox" required> Saya sudah memeriksa penerima, subjek, isi, tanggal, dan tautan.</label><button id="manualMailSend" class="ftg-suite-primary" type="submit"><i class="fa-solid fa-paper-plane"></i> Kirim Sekarang</button></form><aside class="ftg-mail-preview"><span>PREVIEW EMAIL</span><div><small id="manualPreviewEyebrow">PEMBERITAHUAN</small><h4 id="manualPreviewTitle">Subjek pesan tampil di sini</h4><p id="manualPreviewBody">Isi pesan akan muncul sebagai kartu informasi pada email resmi FTG Fellowship.</p><button type="button" tabindex="-1">Buka Dashboard →</button></div><ul><li><i class="fa-solid fa-database"></i> Penerima tersinkron dari akun website</li><li><i class="fa-solid fa-bell"></i> Notifikasi dashboard tercatat otomatis</li><li><i class="fa-solid fa-shield-halved"></i> Aktivitas Fasil masuk audit log</li></ul></aside></div></section><section data-mail-panel="history" hidden><div class="ftg-mail-history-head"><div><h4>Riwayat Pengiriman Terbaru</h4><p>50 email terbaru dari sistem, termasuk otomatis dan manual.</p></div><button id="manualMailRefresh" class="ftg-suite-secondary"><i class="fa-solid fa-rotate"></i> Muat ulang</button></div><div id="manualMailHistory"></div></section>';
        var selected = {};
        var historyTab=$('[data-mail-tab="history"]',workspace),directoryTab=document.createElement('button');directoryTab.type='button';directoryTab.setAttribute('data-mail-tab','directory');directoryTab.innerHTML='Direktori Email <span>'+profiles.length+'</span>';historyTab.parentNode.insertBefore(directoryTab,historyTab);
        var directoryPanel=document.createElement('section');directoryPanel.setAttribute('data-mail-panel','directory');directoryPanel.hidden=true;directoryPanel.innerHTML='<div class="ftg-mail-directory-head"><div><h4>Semua Email Terdaftar</h4><p>Email akun menjadi tujuan otomatis notifikasi sesuai aktivitas masing-masing.</p></div><div><i class="fa-solid fa-magnifying-glass"></i><input id="mailDirectorySearch" placeholder="Cari nama, email, role, atau status…"></div></div><div id="mailDirectorySummary" class="ftg-mail-directory-summary"></div><div id="mailDirectoryRows" class="ftg-mail-directory"></div>';workspace.appendChild(directoryPanel);
        function activeFor(target) { return profiles.filter(function (profile) { return profile.status === 'active' && profile.email_valid && (target === 'all' || profile.role === target); }); }
        function updateCount() { var target=$('#manualMailTarget',workspace).value,count=target==='custom'?Object.keys(selected).length:activeFor(target).length;$('#manualMailCount',workspace).textContent=count+' akun aktif akan menerima pesan';$('#manualMailSend',workspace).disabled=!count; }
        function renderPeople() { var query=($('#manualMailSearch',workspace).value||'').toLowerCase(),rows=profiles.filter(function(profile){return profile.status==='active'&&profile.email_valid&&((profile.full_name||'').toLowerCase().indexOf(query)>-1||profile.email.toLowerCase().indexOf(query)>-1);});$('#manualMailPeopleRows',workspace).innerHTML=rows.map(function(profile){var label=profile.role==='admin'?'Fasil':profile.role==='mentor'?'Mentor':'Mentee';return '<label><input type="checkbox" data-mail-person="'+esc(profile.id)+'" '+(selected[profile.id]?'checked':'')+'><span><b>'+esc(profile.full_name||'Tanpa nama')+'</b><small>'+esc(profile.email)+'</small></span><em class="is-'+esc(profile.role)+'">'+label+'</em></label>';}).join('')||'<p class="ftg-mail-empty">Tidak ada akun yang cocok.</p>';$all('[data-mail-person]',workspace).forEach(function(input){input.addEventListener('change',function(){if(input.checked)selected[input.getAttribute('data-mail-person')]=true;else delete selected[input.getAttribute('data-mail-person')];updateCount();});}); }
        function renderHistory(rows) { $('#manualMailHistory',workspace).innerHTML=rows.length?rows.map(function(item){var date=new Date(item.sent_at||item.created_at).toLocaleString('id-ID');return '<article class="is-'+esc(item.status)+'"><i class="fa-solid '+(item.status==='sent'?'fa-circle-check':item.status==='failed'?'fa-circle-exclamation':'fa-clock')+'"></i><div><b>'+esc(item.subject.replace(/^\[FTG Fellowship\]\s*/,''))+'</b><small>'+esc(item.recipient)+' · '+esc(date)+'</small>'+(item.error?'<p>'+esc(item.error)+'</p>':'')+'</div><span>'+esc(item.status==='sent'?'Terkirim':item.status==='failed'?'Gagal':item.status)+'</span></article>';}).join(''):'<p class="ftg-mail-empty">Belum ada riwayat email.</p>'; }
        function renderDirectory(query){query=String(query||'').toLowerCase();var rows=profiles.filter(function(profile){return [profile.full_name,profile.email,profile.role,profile.status].join(' ').toLowerCase().indexOf(query)>-1;}),ready=profiles.filter(function(profile){return profile.email_valid&&(!profile.notification_preferences||profile.notification_preferences.email!==false);}).length;$('#mailDirectorySummary',workspace).innerHTML='<span><b>'+profiles.length+'</b> akun terdaftar</span><span class="is-ready"><b>'+ready+'</b> email siap</span><span><b>'+profiles.filter(function(p){return p.status==='active';}).length+'</b> akun aktif</span><span class="is-warning"><b>'+(profiles.length-ready)+'</b> perlu diperiksa</span>';$('#mailDirectoryRows',workspace).innerHTML=rows.map(function(profile){var prefs=profile.notification_preferences||{},emailReady=profile.email_valid&&prefs.email!==false,last=outbox.filter(function(item){return String(item.recipient).toLowerCase()===String(profile.email).toLowerCase();})[0],role=profile.role==='admin'?'Fasil':profile.role==='mentor'?'Mentor':'Mentee',status=profile.status==='active'?'Aktif':profile.status==='invited'?'Menunggu':profile.status==='suspended'?'Terkunci':profile.status==='dropped'?'Gugur':profile.status;return '<article><span class="ftg-mail-directory-avatar is-'+esc(profile.role)+'">'+esc(initialsOf(profile.full_name||profile.email))+'</span><span><b>'+esc(profile.full_name||'Tanpa nama')+'</b><small>'+esc(profile.email||'Email belum tersedia')+'</small></span><em class="is-'+esc(profile.role)+'">'+role+'</em><span class="ftg-mail-directory-state is-'+esc(profile.status)+'">'+esc(status)+'</span><span class="ftg-mail-directory-provider"><i class="fa-brands fa-google"></i> '+(profile.google_email?'Google':'Email')+'</span><span class="ftg-mail-directory-ready '+(emailReady?'is-ready':'is-error')+'"><i class="fa-solid '+(emailReady?'fa-circle-check':'fa-circle-exclamation')+'"></i> '+(emailReady?'Notifikasi aktif':'Perlu diperiksa')+(last?'<small>Terakhir: '+esc(last.status==='sent'?'terkirim':last.status)+'</small>':'<small>Belum ada kiriman</small>')+'</span></article>';}).join('')||'<p class="ftg-mail-empty">Tidak ada email yang cocok.</p>';}
        function updatePreview(){var type=$('#manualMailType',workspace);$('#manualPreviewEyebrow',workspace).textContent=type.options[type.selectedIndex].text.toUpperCase();$('#manualPreviewTitle',workspace).textContent=$('#manualMailTitle',workspace).value||'Subjek pesan tampil di sini';$('#manualPreviewBody',workspace).textContent=$('#manualMailBody',workspace).value||'Isi pesan akan muncul sebagai kartu informasi pada email resmi FTG Fellowship.';$('#manualMailTitleCount',workspace).textContent=$('#manualMailTitle',workspace).value.length;$('#manualMailBodyCount',workspace).textContent=$('#manualMailBody',workspace).value.length;}
        renderHistory(outbox); renderDirectory(''); updateCount(); updatePreview();
        $all('[data-mail-tab]',workspace).forEach(function(button){button.addEventListener('click',function(){$all('[data-mail-tab]',workspace).forEach(function(x){x.classList.toggle('is-active',x===button);});$all('[data-mail-panel]',workspace).forEach(function(panel){panel.hidden=panel.getAttribute('data-mail-panel')!==button.getAttribute('data-mail-tab');});});});
        $('#mailDirectorySearch',workspace).addEventListener('input',function(){renderDirectory(this.value);});$('#manualMailTarget',workspace).addEventListener('change',function(){var custom=this.value==='custom';$('#manualMailPeople',workspace).hidden=!custom;if(custom)renderPeople();updateCount();});$('#manualMailSearch',workspace).addEventListener('input',renderPeople);$('#manualMailCheckAll',workspace).addEventListener('change',function(){var checked=this.checked;$all('[data-mail-person]',workspace).forEach(function(input){input.checked=checked;if(checked)selected[input.getAttribute('data-mail-person')]=true;else delete selected[input.getAttribute('data-mail-person')];});updateCount();});['manualMailTitle','manualMailBody','manualMailType'].forEach(function(id){$('#'+id,workspace).addEventListener('input',updatePreview);});
        $('#manualMailRefresh',workspace).addEventListener('click',function(){var button=this;button.disabled=true;apiRequest('/api/notifications').then(function(fresh){renderHistory(fresh.outbox||[]);toast('Riwayat diperbarui','✅');}).catch(function(e){toast(e.message,'⚠️');}).finally(function(){button.disabled=false;});});
        $('#manualMailForm',workspace).addEventListener('submit',function(event){event.preventDefault();var target=$('#manualMailTarget',workspace).value,button=$('#manualMailSend',workspace);if(target==='custom'&&!Object.keys(selected).length){toast('Pilih minimal satu penerima','⚠️');return;}button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Mengirim, jangan tutup halaman…';var payload={action:'manual_send',target_role:target==='custom'?'':target,user_ids:target==='custom'?Object.keys(selected):[],type:$('#manualMailType',workspace).value,channel:$('#manualMailChannel',workspace).value,title:$('#manualMailTitle',workspace).value,body:$('#manualMailBody',workspace).value,href:$('#manualMailHref',workspace).value};apiRequest('/api/notifications',{method:'POST',body:JSON.stringify(payload)}).then(function(result){toast(result.sent+' berhasil'+(result.failed?' · '+result.failed+' gagal':''),result.failed?'⚠️':'✅');$('#manualMailConfirm',workspace).checked=false;invalidateApiCache('admin-notifications');return cachedApiRequest('admin-notifications','/api/notifications',null,30000,true);}).then(function(fresh){renderHistory(fresh.outbox||[]);}).catch(function(e){toast(e.message,'⚠️');}).finally(function(){button.disabled=false;button.innerHTML='<i class="fa-solid fa-paper-plane"></i> Kirim Sekarang';updateCount();});});
      }).catch(function(error){$('#mailAdminLoading',box).innerHTML='<i class="fa-solid fa-triangle-exclamation"></i><b>'+esc(error.message)+'</b>';});
    });
  }
  function openDonorPortalManager() {
    return cachedApiRequest('donor-admin','/api/donor?admin=1',null,45000).then(function(data){
      var portal=data.portal||{},programs=portal.programs||[],donors=portal.donors||[],active=programs[0]||null;
      function lineSources(rows){return(rows||[]).map(function(x){return[x.label||'',x.label_en||'',x.value||0].join(' | ');}).join('\n');}
      function linePeople(rows){return(rows||[]).map(function(x){return[x.name||'',x.path||'',x.progress||0,x.outcome||'',x.bio||'',x.public_consent?'yes':'no'].join(' | ');}).join('\n');}
      function lineReports(rows){return(rows||[]).map(function(x){return[x.title||'',x.title_en||'',x.type||'',x.period||'',x.url||'',x.verified?'yes':'no'].join(' | ');}).join('\n');}
      function parseLines(text,mapper){return String(text||'').split(/\r?\n/).map(function(line){return line.split('|').map(function(x){return x.trim();});}).filter(function(x){return x[0];}).map(mapper);}
      function renderProgramList(){return programs.map(function(p){return'<button type="button" data-donor-program="'+esc(p.id)+'" class="'+(active&&active.id===p.id?'is-active':'')+'"><b>'+esc(p.code||'PROGRAM')+'</b><span>'+esc(p.name)+'</span><small>'+esc(p.finance&&p.finance.status||p.data_status||'draft')+'</small></button>';}).join('')||'<p class="ftg-donor-empty">Belum ada program.</p>';}
      function programForm(p){p=p||{id:'',code:'',name:'',name_en:'',status:'draft',data_status:'draft',source:'manual',period:'',period_en:'',location:'',summary:'',summary_en:'',sdgs:[],beneficiary_target:0,finance:{currency:'IDR',status:'draft'},impact:{},sroi:{sources:[],trend:[]},csr:{pillars:[]},esg:{},beneficiaries:[],reports:[]};var finance=p.finance||{},impact=p.impact||{},sroi=p.sroi||{},esg=p.esg||{},pillars=p.csr&&p.csr.pillars||[];function score(key,fallback){var row=pillars.filter(function(x){return x.key===key;})[0];return row?row.score:(fallback||0);}return'<input id="dpId" type="hidden" value="'+esc(p.id||'')+'"><div class="ftg-donor-form-grid"><label>Kode program<input id="dpCode" value="'+esc(p.code||'')+'" placeholder="FBF"></label><label>Status<select id="dpStatus"><option value="draft">Draft</option><option value="active">Aktif</option><option value="completed">Selesai</option><option value="archived">Arsip</option></select></label><label>Status laporan finansial<select id="dpDataStatus"><option value="draft">Draft</option><option value="verified">Terverifikasi Fasil</option><option value="audited">Diaudit independen</option></select></label><label>Sumber peserta<select id="dpSource"><option value="manual">Input manual</option><option value="ftg">Sinkron FBF</option></select></label><label>Nama program (ID)<input id="dpName" value="'+esc(p.name||'')+'"></label><label>Program name (EN)<input id="dpNameEn" value="'+esc(p.name_en||'')+'"></label><label>Periode (ID)<input id="dpPeriod" value="'+esc(p.period||'')+'"></label><label>Period (EN)<input id="dpPeriodEn" value="'+esc(p.period_en||'')+'"></label><label>Lokasi<input id="dpLocation" value="'+esc(p.location||'')+'"></label><label>SDGs<input id="dpSdgs" value="'+esc((p.sdgs||[]).join(', '))+'"></label></div><div class="ftg-donor-form-grid"><label>Ringkasan (ID)<textarea id="dpSummary">'+esc(p.summary||'')+'</textarea></label><label>Summary (EN)<textarea id="dpSummaryEn">'+esc(p.summary_en||'')+'</textarea></label></div><h4>Transparansi dana & dampak</h4><div class="ftg-donor-form-grid is-four"><label>Dana donor<input id="dpContribution" type="number" value="'+(finance.contribution||0)+'"></label><label>Realisasi<input id="dpSpent" type="number" value="'+(finance.spent||0)+'"></label><label>Nilai sosial<input id="dpSocial" type="number" value="'+(finance.social_value||0)+'"></label><label>Mata uang<input id="dpCurrency" value="'+esc(finance.currency||'IDR')+'"></label><label>Penerima manfaat<input id="dpBeneficiaries" type="number" value="'+(impact.beneficiaries||0)+'"></label><label>Aktif (%)<input id="dpActive" type="number" max="100" value="'+(impact.active_rate||0)+'"></label><label>Progress (%)<input id="dpProgress" type="number" max="100" value="'+(impact.average_progress||0)+'"></label><label>Kelulusan (%)<input id="dpCompletion" type="number" max="100" value="'+(impact.completion_rate||0)+'"></label><label>Kerja / usaha<input id="dpOutcomeCount" type="number" value="'+(impact.employed_or_business||0)+'"></label><label>Pekerjaan<input id="dpJobs" type="number" value="'+(impact.jobs||0)+'"></label><label>Usaha baru<input id="dpBusinesses" type="number" value="'+(impact.businesses||0)+'"></label><label>Jam relawan<input id="dpVolunteer" type="number" value="'+(impact.volunteer_hours||0)+'"></label></div><label>Catatan transparansi (ID)<textarea id="dpFinanceNote">'+esc(finance.note||'')+'</textarea></label><label>Transparency note (EN)<textarea id="dpFinanceNoteEn">'+esc(finance.note_en||'')+'</textarea></label><h4>SROI, CSR & ESG</h4><div class="ftg-donor-form-grid is-four"><label>Rasio SROI<input id="dpSroi" type="number" step="0.1" value="'+(sroi.ratio||0)+'"></label><label>Environment<input id="dpE" type="number" max="100" value="'+(esg.environment||0)+'"></label><label>Social<input id="dpS" type="number" max="100" value="'+(esg.social||0)+'"></label><label>Governance<input id="dpG" type="number" max="100" value="'+(esg.governance||0)+'"></label><label>People<input id="dpPeople" type="number" max="100" value="'+score('people')+'"></label><label>Prosperity<input id="dpProsperity" type="number" max="100" value="'+score('prosperity')+'"></label><label>Planet<input id="dpPlanet" type="number" max="100" value="'+score('planet')+'"></label><label>Peace<input id="dpPeace" type="number" max="100" value="'+score('peace')+'"></label><label>Partnership<input id="dpPartnership" type="number" max="100" value="'+score('partnership')+'"></label><label>Framework ESG<input id="dpFramework" value="'+esc(esg.framework||'GRI Standards & ISO 26000')+'"></label></div><label>Sumber nilai SROI <small>satu baris: label ID | label EN | nilai</small><textarea id="dpSources" rows="4">'+esc(lineSources(sroi.sources))+'</textarea></label><label>Tren SROI <small>pisahkan koma</small><input id="dpTrend" value="'+esc((sroi.trend||[]).join(', '))+'"></label><h4>Penerima manfaat & laporan</h4><label>Penerima manual <small>satu baris: nama | path | progres | outcome | bio | izin publik yes/no. FBF otomatis tidak perlu diisi.</small><textarea id="dpPeopleRows" rows="5">'+esc(linePeople(p.beneficiaries))+'</textarea></label><label>Laporan ESG <small>satu baris: judul ID | judul EN | tipe | periode | URL | yes/no</small><textarea id="dpReportRows" rows="5">'+esc(lineReports(p.reports))+'</textarea></label><div class="ftg-donor-form-actions"><button type="button" id="dpDelete" class="ftg-suite-danger" '+(!p.id?'disabled':'')+'>Hapus Program</button><a href="donor-programs.html" target="_blank" class="ftg-action-secondary">Lihat Halaman Publik ↗</a><button type="button" id="dpSave" class="ftg-suite-primary">Simpan & Publikasikan</button></div>';}
      function fullHtml(){return'<div class="ftg-donor-admin"><div class="ftg-donor-admin-head"><div><small>TRANSPARANSI & IMPACT</small><h3><i class="fa-solid fa-hand-holding-heart"></i> Publikasi Program & Dampak</h3><p>Kelola program, dana, dampak, SROI, ESG, dan data publik bilingual. FBF tersinkron otomatis; program lain dapat diinput manual. Halaman dapat dibaca tanpa login.</p></div><button id="dpNew" class="ftg-suite-primary">+ Program</button></div><div class="ftg-donor-admin-layout"><aside><div id="dpProgramList">'+renderProgramList()+'</div><hr><h4>Akses Donor</h4><div id="dpDonorList">'+donors.map(function(d){return'<div class="ftg-donor-access"><span><b>'+esc(d.organization)+'</b><small>'+esc(d.email)+' · '+(d.program_ids||[]).length+' program</small></span><button data-donor-delete="'+esc(d.id)+'">×</button></div>';}).join('')+'</div><button id="dpDonorAdd" class="ftg-action-secondary" style="width:100%;margin-top:8px">+ Berikan Akses</button><div class="ftg-donor-admin-stats"><span><b>'+(portal.ratings||[]).length+'</b> rating</span><span><b>'+(portal.messages||[]).length+'</b> pesan</span></div></aside><section id="dpProgramForm">'+programForm(active)+'</section></div></div>';}
      modal(fullHtml(),function(box,close){box.style.maxWidth='1120px';function bind(){var form=$('#dpProgramForm',box);if(active){$('#dpStatus',form).value=active.status||'draft';$('#dpDataStatus',form).value=active.finance&&active.finance.status||active.data_status||'draft';$('#dpSource',form).value=active.source||'manual';}$all('[data-donor-program]',box).forEach(function(button){button.addEventListener('click',function(){active=programs.filter(function(p){return p.id===button.getAttribute('data-donor-program');})[0];$('#dpProgramList',box).innerHTML=renderProgramList();form.innerHTML=programForm(active);bind();});});$('#dpNew',box).onclick=function(){active=null;$('#dpProgramList',box).innerHTML=renderProgramList();form.innerHTML=programForm(null);bind();};$('#dpSave',form).onclick=function(){var button=this;function v(id){return $('#'+id,form).value;}function n(id){return +v(id)||0;}var p={id:v('dpId'),code:v('dpCode'),name:v('dpName'),name_en:v('dpNameEn'),status:v('dpStatus'),data_status:v('dpDataStatus'),source:v('dpSource'),period:v('dpPeriod'),period_en:v('dpPeriodEn'),location:v('dpLocation'),summary:v('dpSummary'),summary_en:v('dpSummaryEn'),sdgs:v('dpSdgs').split(',').map(function(x){return x.trim();}).filter(Boolean),beneficiary_target:n('dpBeneficiaries'),finance:{status:v('dpDataStatus'),currency:v('dpCurrency'),contribution:n('dpContribution'),spent:n('dpSpent'),social_value:n('dpSocial'),verified:v('dpDataStatus')!=='draft',note:v('dpFinanceNote'),note_en:v('dpFinanceNoteEn'),categories:(active&&active.finance&&active.finance.categories)||[],monthly:(active&&active.finance&&active.finance.monthly)||[]},impact:{beneficiaries:n('dpBeneficiaries'),active_rate:n('dpActive'),average_progress:n('dpProgress'),completion_rate:n('dpCompletion'),employed_or_business:n('dpOutcomeCount'),jobs:n('dpJobs'),businesses:n('dpBusinesses'),volunteer_hours:n('dpVolunteer')},sroi:{ratio:n('dpSroi'),methodology:'Social Value International / SROI Network Standard',verified:v('dpDataStatus')!=='draft',sources:parseLines(v('dpSources'),function(x){return{label:x[0],label_en:x[1],value:+x[2]||0};}),trend:v('dpTrend').split(',').map(Number).filter(function(x){return !isNaN(x);}),respondents:(active&&active.sroi&&active.sroi.respondents)||0,baseline:(active&&active.sroi&&active.sroi.baseline)||'',attribution:(active&&active.sroi&&active.sroi.attribution)||0,deadweight:(active&&active.sroi&&active.sroi.deadweight)||0,displacement:(active&&active.sroi&&active.sroi.displacement)||0,dropoff:(active&&active.sroi&&active.sroi.dropoff)||0,scenario_low:(active&&active.sroi&&active.sroi.scenario_low)||0,scenario_high:(active&&active.sroi&&active.sroi.scenario_high)||0,limitations:(active&&active.sroi&&active.sroi.limitations)||''},csr:{pillars:[['people','People Development'],['prosperity','Economic Empowerment'],['planet','Environmental Responsibility'],['peace','Good Governance'],['partnership','Partnership']].map(function(x){var field='dp'+x[0][0].toUpperCase()+x[0].slice(1);return{key:x[0],title:x[1],title_en:x[1],score:n(field)};})},esg:{environment:n('dpE'),social:n('dpS'),governance:n('dpG'),total:Math.round((n('dpE')+n('dpS')+n('dpG'))/3),framework:v('dpFramework'),verified:v('dpDataStatus')!=='draft'},organization:(active&&active.organization)||{},targets:(active&&active.targets)||[],timeline:(active&&active.timeline)||[],risks:(active&&active.risks)||[],stories:(active&&active.stories)||[],actions:(active&&active.actions)||{},beneficiaries:parseLines(v('dpPeopleRows'),function(x,i){return{id:(v('dpId')||v('dpCode'))+'-'+i,name:x[0],path:x[1],progress:+x[2]||0,outcome:x[3],bio:x[4],public_consent:/^(yes|ya|true|1)$/i.test(x[5]||'')};}),reports:parseLines(v('dpReportRows'),function(x,i){return{id:(v('dpId')||v('dpCode'))+'-report-'+i,title:x[0],title_en:x[1],type:x[2],period:x[3],url:x[4],verified:/^(yes|ya|true|1)$/i.test(x[5]||'')};})};button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';apiRequest('/api/donor?admin=1',{method:'POST',body:JSON.stringify({action:'admin_program_save',program:p})}).then(function(result){invalidateApiCache('donor-admin');var index=programs.findIndex(function(x){return x.id===result.program.id;});if(index>-1)programs[index]=result.program;else programs.push(result.program);active=result.program;$('#dpProgramList',box).innerHTML=renderProgramList();form.innerHTML=programForm(active);bind();toast('Data donor berhasil disimpan','✅');}).catch(function(error){button.disabled=false;button.textContent='Coba Lagi';toast(error.message,'⚠️');});};var del=$('#dpDelete',form);if(del)del.onclick=function(){if(!active||!confirm('Hapus program '+active.name+' dari portal donor?'))return;apiRequest('/api/donor?admin=1',{method:'POST',body:JSON.stringify({action:'admin_program_delete',id:active.id})}).then(function(){invalidateApiCache('donor-admin');programs=programs.filter(function(p){return p.id!==active.id;});active=programs[0]||null;$('#dpProgramList',box).innerHTML=renderProgramList();form.innerHTML=programForm(active);bind();toast('Program dihapus','🗑️');}).catch(function(e){toast(e.message,'⚠️');});};}
        bind();$('#dpDonorAdd',box).addEventListener('click',function(){if(!programs.length)return toast('Buat program terlebih dahulu','⚠️');modal('<h3 style="font-weight:850">Berikan Akses Donor</h3><label>Organisasi<input id="daOrg" class="donor-admin-input"></label><label>Nama kontak<input id="daName" class="donor-admin-input"></label><label>Email<input id="daEmail" type="email" class="donor-admin-input"></label><label>Kode akses <small>kosongkan untuk otomatis</small><input id="daCode" class="donor-admin-input"></label><p style="font-size:10px;font-weight:800;margin:10px 0 5px">Program yang dapat dilihat</p>'+programs.map(function(p){return'<label style="display:flex;gap:7px;margin:5px 0"><input type="checkbox" data-da-program="'+esc(p.id)+'" checked> '+esc(p.name)+'</label>';}).join('')+'<button id="daSave" class="ftg-suite-primary" style="width:100%;margin-top:10px">Buat Akses</button>',function(addBox,addClose){$('#daSave',addBox).addEventListener('click',function(){var button=this;button.disabled=true;apiRequest('/api/donor?admin=1',{method:'POST',body:JSON.stringify({action:'admin_donor_create',organization:$('#daOrg',addBox).value,contact_name:$('#daName',addBox).value,email:$('#daEmail',addBox).value,code:$('#daCode',addBox).value,program_ids:$all('[data-da-program]',addBox).filter(function(x){return x.checked;}).map(function(x){return x.getAttribute('data-da-program');})})}).then(function(result){invalidateApiCache('donor-admin');addClose();modal('<div style="text-align:center"><span style="font-size:28px">🔐</span><h3 style="font-weight:850">Akses donor siap</h3><p style="font-size:10px;color:#64748b">Kode hanya ditampilkan satu kali. Kirim melalui kanal pribadi.</p><b style="display:block;background:#0f172a;color:#fff;border-radius:10px;padding:12px;margin:10px 0;font-size:15px">'+esc(result.access_code)+'</b><p style="font-size:10px">'+esc(result.donor.email)+'</p></div>');toast('Akses donor dibuat','✅');}).catch(function(e){button.disabled=false;toast(e.message,'⚠️');});});});});$all('[data-donor-delete]',box).forEach(function(button){button.addEventListener('click',function(){if(!confirm('Cabut akses donor ini?'))return;apiRequest('/api/donor?admin=1',{method:'POST',body:JSON.stringify({action:'admin_donor_delete',id:button.getAttribute('data-donor-delete')})}).then(function(){invalidateApiCache('donor-admin');button.closest('.ftg-donor-access').remove();toast('Akses donor dicabut','🔒');});});});
      });
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function openInvestorTrustManager() {
    return cachedApiRequest('donor-admin','/api/donor?admin=1',null,45000).then(function(data){
      var programs=data.portal&&data.portal.programs||[],active=programs[0]||null;
      function lines(rows,fields){return(rows||[]).map(function(row){return fields.map(function(field){return row[field]==null?'':row[field];}).join(' | ');}).join('\n');}
      function parse(text,mapper){return String(text||'').split(/\r?\n/).map(function(line){return line.split('|').map(function(value){return value.trim();});}).filter(function(row){return row[0];}).map(mapper);}
      function yes(value){return /^(yes|ya|true|1)$/i.test(value||'');}
      function targetSeed(program){if((program.targets||[]).length)return program.targets;if(program.source!=='ftg')return[];return[{key:'beneficiaries',label:'Penerima manfaat',target:program.beneficiary_target||0,actual:0,unit:'orang',source:'Profil aktif LMS',formula:'Jumlah profil mentee berstatus aktif'},{key:'active_rate',label:'Peserta aktif 14 hari',target:80,actual:0,unit:'%',source:'Aktivitas LMS',formula:'Mentee aktif dalam 14 hari ÷ seluruh mentee aktif'},{key:'submission_rate',label:'Tingkat pengumpulan',target:90,actual:0,unit:'%',source:'Tugas dan pengumpulan LMS',formula:'Tugas terkumpul ÷ pasangan tugas-peserta yang ditargetkan'},{key:'attendance_rate',label:'Tingkat kehadiran',target:85,actual:0,unit:'%',source:'Presensi kegiatan',formula:'Hadir atau terlambat ÷ seluruh catatan presensi'},{key:'average_score',label:'Rata-rata nilai',target:75,actual:0,unit:'/100',source:'Review mentor',formula:'Jumlah skor review ÷ jumlah tugas yang telah dinilai'}];}
      function form(program){if(!program)return'<div class="trust-admin-empty">Belum ada program. Buat program melalui menu Program Publik terlebih dahulu.</div>';var finance=program.finance||{},sroi=program.sroi||{},org=program.organization||{},actions=program.actions||{};return'<div class="ftg-trust-admin-head"><div><span>INVESTOR TRUST CENTER</span><h3>'+esc(program.name)+'</h3><p>Kelola bukti, metodologi, legalitas, risiko, cerita dampak, dan dokumen yang ditampilkan kepada investor.</p></div><a href="donor-dashboard.html?program='+encodeURIComponent(program.id)+'" target="_blank" class="ftg-action-secondary">Lihat Publik ↗</a></div><div class="ftg-trust-admin-grid"><section><h4>💰 Anggaran & realisasi</h4><p>Satu baris: kategori | anggaran | realisasi | URL bukti</p><textarea id="itBudget" rows="6">'+esc(lines(finance.categories,['label','budget','actual','evidence_url']))+'</textarea><p>Grafik bulanan: bulan | anggaran | realisasi</p><textarea id="itMonthly" rows="5">'+esc(lines(finance.monthly,['label','budget','actual']))+'</textarea></section><section><h4>🎯 Target program</h4><p>Satu baris: key | label | target | aktual manual | unit | sumber | rumus | URL bukti</p><textarea id="itTargets" rows="8">'+esc(lines(targetSeed(program),['key','label','target','actual','unit','source','formula','evidence_url']))+'</textarea><small>Untuk FBF, aktual metrik standar akan ditimpa otomatis oleh data LMS; target tetap mengikuti input Fasil.</small></section><section><h4>📐 Metodologi SROI</h4><div class="ftg-trust-fields"><label>Responden<input id="itRespondents" type="number" value="'+(+sroi.respondents||0)+'"></label><label>Skenario rendah<input id="itSroiLow" type="number" step="0.1" value="'+(+sroi.scenario_low||0)+'"></label><label>Skenario tinggi<input id="itSroiHigh" type="number" step="0.1" value="'+(+sroi.scenario_high||0)+'"></label><label>Attribution (%)<input id="itAttribution" type="number" max="100" value="'+(+sroi.attribution||0)+'"></label><label>Deadweight (%)<input id="itDeadweight" type="number" max="100" value="'+(+sroi.deadweight||0)+'"></label><label>Displacement (%)<input id="itDisplacement" type="number" max="100" value="'+(+sroi.displacement||0)+'"></label><label>Drop-off (%)<input id="itDropoff" type="number" max="100" value="'+(+sroi.dropoff||0)+'"></label></div><label>Baseline<textarea id="itBaseline" rows="3">'+esc(sroi.baseline||'')+'</textarea></label><label>Batasan analisis<textarea id="itLimitations" rows="3">'+esc(sroi.limitations||'')+'</textarea></label></section><section><h4>🏛️ Profil & legalitas organisasi</h4><div class="ftg-trust-fields"><label>Nama legal<input id="itLegalName" value="'+esc(org.legal_name||'')+'"></label><label>Nomor legalitas<input id="itRegistration" value="'+esc(org.registration_number||'')+'"></label><label>Website<input id="itWebsite" type="url" value="'+esc(org.website||'')+'"></label><label>Email publik<input id="itContactEmail" type="email" value="'+esc(org.contact_email||'')+'"></label></div><label>Alamat<textarea id="itAddress" rows="3">'+esc(org.address||'')+'</textarea></label><p>Pimpinan: nama | jabatan</p><textarea id="itLeaders" rows="4">'+esc(lines(org.leaders,['name','role']))+'</textarea><label>Mitra program <small>pisahkan koma</small><input id="itPartners" value="'+esc((org.partners||[]).join(', '))+'"></label><p>Kebijakan: nama | URL dokumen</p><textarea id="itPolicies" rows="4">'+esc(lines(org.policies,['label','url']))+'</textarea></section><section><h4>🗓️ Timeline & bukti</h4><p>Tanggal | judul | status upcoming/progress/completed/delayed | deskripsi | URL bukti</p><textarea id="itTimeline" rows="8">'+esc(lines(program.timeline,['date','title','status','description','evidence_url']))+'</textarea></section><section><h4>⚠️ Risiko & mitigasi</h4><p>Risiko | level low/medium/high/critical | status open/monitored/mitigated | mitigasi | penanggung jawab | tanggal</p><textarea id="itRisks" rows="8">'+esc(lines(program.risks,['title','level','status','mitigation','owner','updated_at']))+'</textarea></section><section><h4>💬 Cerita dampak</h4><p>Alias | judul | kutipan | baseline | outcome | URL bukti | izin yes/no</p><textarea id="itStories" rows="8">'+esc(lines(program.stories,['alias','title','quote','baseline','outcome','evidence_url','consent']))+'</textarea><small>Hanya cerita dengan persetujuan “yes” yang dapat disimpan dan ditampilkan publik.</small></section><section><h4>📁 Investor Data Room</h4><p>Judul ID | judul EN | tipe | periode | URL | terverifikasi yes/no</p><textarea id="itReports" rows="8">'+esc(lines(program.reports,['title','title_en','type','period','url','verified']))+'</textarea><div class="ftg-trust-fields"><label>URL proposal<input id="itProposal" type="url" value="'+esc(actions.proposal_url||'')+'"></label><label>URL jadwal meeting<input id="itMeeting" type="url" value="'+esc(actions.meeting_url||'')+'"></label><label>URL kontak/WhatsApp<input id="itContact" type="url" value="'+esc(actions.contact_url||'')+'"></label></div></section></div><div class="ftg-trust-savebar"><span><i class="fa-solid fa-shield-halved"></i> Semua perubahan tercatat di audit log Fasil.</span><button id="itSave" class="ftg-suite-primary">Simpan Trust Center</button></div>';}
      var html='<div class="ftg-trust-admin"><div class="ftg-trust-program-picker"><label>Program yang dikelola<select id="itProgram">'+programs.map(function(program){return'<option value="'+esc(program.id)+'">'+esc(program.name)+'</option>';}).join('')+'</select></label></div><div id="itForm">'+form(active)+'</div></div>';
      modal(html,function(box){box.style.maxWidth='1180px';function bind(){var host=$('#itForm',box);var save=$('#itSave',host);if(!save)return;save.onclick=function(){function v(id){var el=$('#'+id,host);return el?el.value:'';}function n(id){return +v(id)||0;}var program=JSON.parse(JSON.stringify(active));program.finance=program.finance||{};program.finance.categories=parse(v('itBudget'),function(row){return{label:row[0],budget:+row[1]||0,actual:+row[2]||0,evidence_url:row[3]||''};});program.finance.monthly=parse(v('itMonthly'),function(row){return{label:row[0],budget:+row[1]||0,actual:+row[2]||0};});program.targets=parse(v('itTargets'),function(row){return{key:row[0],label:row[1],target:+row[2]||0,actual:+row[3]||0,unit:row[4],source:row[5],formula:row[6],evidence_url:row[7]||''};});program.sroi=program.sroi||{};Object.assign(program.sroi,{respondents:n('itRespondents'),scenario_low:n('itSroiLow'),scenario_high:n('itSroiHigh'),attribution:n('itAttribution'),deadweight:n('itDeadweight'),displacement:n('itDisplacement'),dropoff:n('itDropoff'),baseline:v('itBaseline'),limitations:v('itLimitations')});program.organization={legal_name:v('itLegalName'),registration_number:v('itRegistration'),website:v('itWebsite'),contact_email:v('itContactEmail'),address:v('itAddress'),leaders:parse(v('itLeaders'),function(row){return{name:row[0],role:row[1]};}),partners:v('itPartners').split(',').map(function(value){return value.trim();}).filter(Boolean),policies:parse(v('itPolicies'),function(row){return{label:row[0],url:row[1]||''};})};program.timeline=parse(v('itTimeline'),function(row,index){return{id:program.id+'-milestone-'+index,date:row[0],title:row[1],status:row[2],description:row[3],evidence_url:row[4]||''};});program.risks=parse(v('itRisks'),function(row,index){return{id:program.id+'-risk-'+index,title:row[0],level:row[1],status:row[2],mitigation:row[3],owner:row[4],updated_at:row[5]};});program.stories=parse(v('itStories'),function(row,index){return{id:program.id+'-story-'+index,alias:row[0],title:row[1],quote:row[2],baseline:row[3],outcome:row[4],evidence_url:row[5]||'',consent:yes(row[6])};});program.reports=parse(v('itReports'),function(row,index){return{id:program.id+'-report-'+index,title:row[0],title_en:row[1],type:row[2],period:row[3],url:row[4]||'',verified:yes(row[5])};});program.actions={proposal_url:v('itProposal'),meeting_url:v('itMeeting'),contact_url:v('itContact')};save.disabled=true;save.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';apiRequest('/api/donor?admin=1',{method:'POST',body:JSON.stringify({action:'admin_program_save',program:program})}).then(function(result){invalidateApiCache('donor-admin');var index=programs.findIndex(function(row){return row.id===result.program.id;});programs[index]=result.program;active=result.program;host.innerHTML=form(active);bind();toast('Investor Trust Center diperbarui','✅');}).catch(function(error){save.disabled=false;save.textContent='Coba Lagi';toast(error.message,'⚠️');});};}
        var select=$('#itProgram',box);if(select){select.value=active&&active.id||'';select.onchange=function(){active=programs.find(function(program){return program.id===select.value;})||programs[0]||null;$('#itForm',box).innerHTML=form(active);bind();};}bind();});
    }).catch(function(error){toast(error.message,'⚠️');});
  }
  function openAnnouncementManager() {
    function formatLocal(value) {
      if (!value) return '';
      var date = new Date(value); if (isNaN(date.getTime())) return '';
      var pad = function (n) { return String(n).padStart(2, '0'); };
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
    modal('<div class="ftg-announcement-admin"><div class="ftg-announcement-admin-head"><div><small>PAPAN INFORMASI MENTEE</small><h3><i class="fa-solid fa-bullhorn"></i> Kelola Informasi</h3><p>Poster aktif muncul paling depan saat mentee membuka dashboard.</p></div><button id="announcementNew" type="button" class="ftg-suite-primary"><i class="fa-solid fa-plus"></i> Informasi Baru</button></div><div id="announcementAdminBody" class="ftg-announcement-loading"><i class="fa-solid fa-spinner fa-spin"></i><b>Memuat informasi…</b></div></div>', function (box) {
      box.style.maxWidth='980px';
      var body = $('#announcementAdminBody', box), rows = [], imageData = '';
      function list() {
        body.className = 'ftg-announcement-admin-layout';
        body.innerHTML = '<aside><div><b>' + rows.length + '</b><span>informasi tersimpan</span></div><div id="announcementList">' + (rows.length ? rows.map(function (row) { var status=row.is_active===false?'Draft':row.display_mode==='scheduled'?'Terjadwal':'Permanen';return '<button type="button" data-announcement-edit="' + esc(row.id) + '" class="' + (row.is_active ? 'is-active' : '') + '"><span>' + (row.image_url ? '<img src="' + esc(row.image_url) + '" alt="">' : '<i class="fa-solid fa-image"></i>') + '</span><b>' + esc(row.title) + '</b><small>' + status + ' · prioritas ' + Number(row.priority || 0) + '</small></button>'; }).join('') : '<p class="ftg-announcement-empty">Belum ada informasi. Klik Informasi Baru.</p>') + '</div></aside><section id="announcementEditor"><div class="ftg-announcement-empty-state"><i class="fa-solid fa-bullhorn"></i><b>Pilih informasi untuk diedit</b><span>atau buat informasi baru.</span></div></section>';
        $all('[data-announcement-edit]', body).forEach(function (button) { button.addEventListener('click', function () { edit(rows.filter(function (row) { return row.id === button.getAttribute('data-announcement-edit'); })[0]); }); });
      }
      function edit(row) {
        row = row || { title:'', body:'', image_url:'', cta_label:'', cta_url:'', display_mode:'permanent', starts_at:'', ends_at:'', priority:0, is_active:true };
        imageData = '';
        var editor = $('#announcementEditor', body); if (!editor) { list(); editor = $('#announcementEditor', body); }
        editor.innerHTML = '<form id="announcementForm"><input id="announcementId" type="hidden" value="' + esc(row.id || '') + '"><div class="ftg-announcement-form-grid"><label class="is-wide">Judul informasi *<input id="announcementTitle" maxlength="120" value="' + esc(row.title || '') + '" placeholder="Contoh: Mentorship Session — Ng-Design Insight"></label><label class="is-wide">Deskripsi<textarea id="announcementBody" maxlength="1000" rows="4" placeholder="Ringkasan jadwal, pembicara, atau arahan untuk mentee…">' + esc(row.body || '') + '</textarea></label><div class="ftg-announcement-publish-options is-wide"><label class="ftg-announcement-toggle"><input id="announcementActive" type="checkbox" ' + (row.is_active ? 'checked' : '') + '> Dipublikasikan ke dashboard mentee</label><label class="ftg-announcement-toggle"><input id="announcementPermanent" type="checkbox" ' + (row.display_mode !== 'scheduled' ? 'checked' : '') + '> Tampil permanen (tanpa tanggal berakhir)</label></div><label data-announcement-schedule>Mulai tayang<input id="announcementStart" type="datetime-local" value="' + esc(formatLocal(row.starts_at)) + '"></label><label data-announcement-schedule>Selesai tayang<input id="announcementEnd" type="datetime-local" value="' + esc(formatLocal(row.ends_at)) + '"></label><label>Label tombol<input id="announcementCtaLabel" maxlength="40" value="' + esc(row.cta_label || '') + '" placeholder="Lihat detail"></label><label>Tautan tombol<input id="announcementCtaUrl" type="url" value="' + esc(row.cta_url || '') + '" placeholder="https://…"></label><label>Prioritas<input id="announcementPriority" type="number" min="0" max="999" value="' + Number(row.priority || 0) + '"></label></div><div class="ftg-announcement-poster"><div id="announcementPreview">' + (row.image_url ? '<img src="' + esc(row.image_url) + '" alt="Poster ' + esc(row.title) + '">' : '<i class="fa-regular fa-image"></i><span>Belum ada poster</span>') + '</div><label class="ftg-photo-button"><i class="fa-solid fa-upload"></i> Pilih poster<input id="announcementImage" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><small>JPG/PNG/WebP · maksimal 12MB · otomatis dioptimalkan.</small></div><p id="announcementStatus" role="status"></p><div class="ftg-announcement-actions">' + (row.id ? '<button id="announcementDelete" type="button" class="is-danger"><i class="fa-solid fa-trash"></i> Hapus</button>' : '') + '<button id="announcementSave" type="submit" class="ftg-suite-primary"><i class="fa-solid fa-floppy-disk"></i> Simpan & Tampilkan ke Mentee</button></div></form>';
        $('#announcementForm',editor).insertAdjacentHTML('afterbegin','<div class="ftg-announcement-editor-heading"><span><i class="fa-solid fa-pen-to-square"></i></span><div><small>KONTEN DASHBOARD MENTEE</small><h4>'+(row.id?'Edit informasi':'Buat informasi baru')+'</h4><p>Isi konten, atur masa tayang, lalu periksa posternya sebelum dipublikasikan.</p></div></div>');
        function syncAnnouncementSchedule(){var permanent=$('#announcementPermanent',editor).checked;$all('[data-announcement-schedule]',editor).forEach(function(label){label.classList.toggle('is-disabled',permanent);var input=$('input',label);input.disabled=permanent;});}
        $('#announcementPermanent',editor).addEventListener('change',syncAnnouncementSchedule);syncAnnouncementSchedule();
        $('#announcementImage', editor).addEventListener('change', function () { var input=this;if(!input.files[0])return;resizeAnnouncementImage(input.files[0]).then(function(data){imageData=data;$('#announcementPreview',editor).innerHTML='<img src="'+data+'" alt="Pratinjau poster">';}).catch(function(error){input.value='';toast(error.message,'⚠️');}); });
        $('#announcementForm', editor).addEventListener('submit', function (event) {
          event.preventDefault(); var button=$('#announcementSave',editor),status=$('#announcementStatus',editor),title=$('#announcementTitle',editor).value.trim();
          if (!title) { status.textContent='Judul informasi wajib diisi.';status.className='is-error';return; }
          var displayMode=$('#announcementPermanent',editor).checked?'permanent':'scheduled',start=$('#announcementStart',editor).value,end=$('#announcementEnd',editor).value;
          if(displayMode==='scheduled'&&(!start||!end)){status.textContent='Isi waktu mulai dan selesai, atau pilih Tampil permanen.';status.className='is-error';return;}
          if(displayMode==='scheduled'&&new Date(end)<=new Date(start)){status.textContent='Waktu selesai harus setelah waktu mulai.';status.className='is-error';return;}
          var item={id:$('#announcementId',editor).value,title:title,body:$('#announcementBody',editor).value.trim(),display_mode:displayMode,starts_at:displayMode==='scheduled'?new Date(start).toISOString():'',ends_at:displayMode==='scheduled'?new Date(end).toISOString():'',cta_label:$('#announcementCtaLabel',editor).value.trim(),cta_url:$('#announcementCtaUrl',editor).value.trim(),priority:Number($('#announcementPriority',editor).value||0),is_active:$('#announcementActive',editor).checked};
          button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan…';status.className='';status.textContent='Mengunggah poster dan menyinkronkan dashboard mentee…';
          apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'announcement_save',announcement:item,image_data:imageData})}).then(function(data){invalidateApiCache('program-announcements');rows=data.announcements||[];toast(displayMode==='permanent'?'Informasi permanen tampil di dashboard mentee':'Jadwal informasi tersimpan dan tersinkron','✅');list();}).catch(function(error){button.disabled=false;button.innerHTML='<i class="fa-solid fa-floppy-disk"></i> Simpan & Tampilkan ke Mentee';status.className='is-error';status.textContent=error.message;});
        });
        var remove=$('#announcementDelete',editor);if(remove)remove.addEventListener('click',function(){if(!confirm('Hapus informasi “'+row.title+'”?'))return;this.disabled=true;apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'announcement_delete',id:row.id})}).then(function(data){invalidateApiCache('program-announcements');rows=data.announcements||[];toast('Informasi dihapus','✅');list();}).catch(function(error){toast(error.message,'⚠️');remove.disabled=false;});});
      }
      function load() { cachedApiRequest('program-announcements','/api/program',{method:'POST',body:JSON.stringify({action:'announcements_list',admin:true}),loading:false},45000).then(function(data){rows=data.announcements||[];list();}).catch(function(error){body.className='ftg-announcement-empty-state';body.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i><b>Informasi gagal dimuat</b><span>'+esc(error.message)+'</span>';}); }
      $('#announcementNew',box).addEventListener('click',function(){if(!$('#announcementEditor',body))list();edit(null);}); load();
    });
  }
  function mountMenteeAnnouncementBoard() {
    if (PAGE.indexOf('mentee-dashboard') !== 0 || myRole() !== 'mentee') return;
    var host=$('main > div.px-8');if(!host||$('#mentee-announcement-board'))return;
    apiRequest('/api/program',{method:'POST',body:JSON.stringify({action:'announcements_list'})}).then(function(data){
      var rows=data.announcements||[];if(!rows.length||$('#mentee-announcement-board'))return;
      var current=0,timer=null,paused=false,section=document.createElement('section');section.id='mentee-announcement-board';section.className='ftg-mentee-announcement';section.setAttribute('aria-roledescription','carousel');section.setAttribute('aria-label','Informasi program');
      var reduceMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function stopTimer(){if(timer){clearTimeout(timer);timer=null;}section.classList.add('is-paused');}
      function startTimer(){stopTimer();section.classList.remove('is-paused');if(rows.length<2||paused||reduceMotion)return;timer=setTimeout(function(){go(1,true);},10000);}
      function go(step,automatic){if(rows.length<2)return;stopTimer();var next=(current+step+rows.length)%rows.length;if(next===current)return;section.classList.remove('is-visible');section.classList.toggle('is-going-back',step<0);setTimeout(function(){current=next;render();},reduceMotion?0:150);}
      function render(){var row=rows[current]||{},multiple=rows.length>1,cta=row.cta_url&&row.cta_label?'<a href="'+esc(row.cta_url)+'" target="_blank" rel="noopener">'+esc(row.cta_label)+' <i class="fa-solid fa-arrow-up-right-from-square"></i></a>':'';var controls=multiple?'<div class="ftg-announcement-controls"><button type="button" data-announcement-prev aria-label="Informasi sebelumnya"><i class="fa-solid fa-arrow-left"></i></button><span class="ftg-announcement-dots">'+rows.map(function(_,i){return '<button type="button" data-announcement-slide="'+i+'" class="'+(i===current?'is-active':'')+'" aria-label="Buka informasi '+(i+1)+' dari '+rows.length+'"></button>';}).join('')+'</span><span class="ftg-announcement-count">'+(current+1)+' / '+rows.length+'</span><button type="button" data-announcement-next aria-label="Informasi berikutnya"><span>Berikutnya</span><i class="fa-solid fa-arrow-right"></i></button></div>':'';section.innerHTML='<div class="ftg-mentee-announcement-copy"><div class="ftg-announcement-kicker"><small><i class="fa-solid fa-bullhorn"></i> INFORMASI FBF</small>'+(multiple?'<span>Berpindah otomatis setiap 10 detik</span>':'')+'</div><h2>'+esc(row.title)+'</h2>'+(row.body?'<p>'+esc(row.body)+'</p>':'')+'<div class="ftg-announcement-copy-actions">'+cta+'</div>'+controls+'</div>'+(row.image_url?'<button type="button" class="ftg-mentee-announcement-poster" aria-label="Perbesar poster '+esc(row.title)+'"><img src="'+esc(row.image_url)+'" alt="Poster '+esc(row.title)+'"></button>':'<div class="ftg-mentee-announcement-art"><i class="fa-solid fa-calendar-star"></i></div>')+(multiple?'<span class="ftg-announcement-progress" aria-hidden="true"><i></i></span>':'');section.setAttribute('aria-label','Informasi '+(current+1)+' dari '+rows.length+': '+row.title);$all('[data-announcement-slide]',section).forEach(function(button){button.addEventListener('click',function(){var target=Number(button.getAttribute('data-announcement-slide'));go(target-current,false);});});var prev=$('[data-announcement-prev]',section),next=$('[data-announcement-next]',section);if(prev)prev.addEventListener('click',function(){go(-1,false);});if(next)next.addEventListener('click',function(){go(1,false);});var poster=$('.ftg-mentee-announcement-poster',section);if(poster)poster.addEventListener('click',function(){stopTimer();modal('<div class="ftg-announcement-full"><img src="'+esc(row.image_url)+'" alt="Poster '+esc(row.title)+'"><h3>'+esc(row.title)+'</h3></div>');poster.blur();paused=section.matches(':hover');startTimer();});requestAnimationFrame(function(){section.classList.add('is-visible');paused=section.matches(':hover')||section.contains(document.activeElement);startTimer();});}
      section.tabIndex=-1;section.addEventListener('mouseenter',function(){paused=true;stopTimer();});section.addEventListener('mouseleave',function(){paused=false;startTimer();});section.addEventListener('focusin',function(){paused=true;stopTimer();});section.addEventListener('focusout',function(event){if(!section.contains(event.relatedTarget)){paused=false;startTimer();}});section.addEventListener('keydown',function(event){if(event.key==='ArrowRight'){event.preventDefault();go(1,false);}if(event.key==='ArrowLeft'){event.preventDefault();go(-1,false);}});
      render();host.insertBefore(section,host.firstChild);
    }).catch(function(error){console.warn('Papan informasi:',error.message);});
  }
  function mountAdminOperations() {
    if (PAGE.indexOf('admin-program') !== 0 || !AUTH.profile || AUTH.profile.role !== 'admin') return;
    var host = $('main > div.px-8'); if (!host || document.getElementById('admin-operations')) return;
    var total = 0, submitted = 0, reviewed = 0; mentorAssignments().forEach(function (t) { (t.targets || []).forEach(function (id) { total++; var s = taskSubmission(id, t.id); if (s && s.submittedAt) submitted++; if (s && s.review && s.review.decision !== 'revision') reviewed++; }); });
    var sec = document.createElement('section'); sec.id = 'admin-operations'; sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    sec.innerHTML = '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">🏛️ Pusat Operasi Program</h2><p style="font-size:11px;color:#64748b">Semua kendali program, peserta, pembelajaran, kehadiran, dan pelaporan.</p></div><button id="adminGlobalTask" class="ftg-suite-primary">+ Tugas Global</button></div><div class="ftg-suite-grid"><button id="adminCohort">👥<b>Cohort & Pairing</b></button><button id="adminSettings">⚙️<b>Pengaturan</b></button><button id="adminRubrics">🎯<b>Rubrik</b></button><button id="adminCalendar">🗓️<b>Kalender</b></button><button id="adminAttendance">📷<b>Presensi QR</b></button><button id="adminCertificates">🎓<b>Sertifikat</b></button><button id="adminHealth">❤️<b>Kesehatan Program</b></button><button id="adminAudit">🛡️<b>Audit Log</b></button><button id="adminExcel">📊<b>Unduh Excel</b></button><button id="adminPdf">📄<b>Laporan PDF</b></button></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px"><div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="font-size:18px;color:#1a5f4f">' + G.cohorts.length + '</b><p style="font-size:9px;color:#64748b">Cohort</p></div><div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="font-size:18px;color:#8b5cf6">' + Object.keys(G.pairings || {}).length + '</b><p style="font-size:9px;color:#64748b">Pairing</p></div><div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="font-size:18px;color:#f97316">' + submitted + '/' + total + '</b><p style="font-size:9px;color:#64748b">Terkumpul</p></div><div style="background:#f8fafc;border-radius:10px;padding:9px"><b style="font-size:18px;color:#16a34a">' + reviewed + '</b><p style="font-size:9px;color:#64748b">Dinilai</p></div></div>';
    host.insertBefore(sec, host.firstChild);
    $('#adminCohort', sec).addEventListener('click', function(){openBusy(this,openCohortManager);});
    $('#adminGlobalTask', sec).addEventListener('click', function () {
      openBusy(this,function(){
        return openAssignmentEditor(null,function(){
          invalidateApiCache('admin-operations');
          var current=$('#admin-operations');
          if(current)current.remove();
          mountAdminOperations();
        });
      });
    });
    $('#adminSettings', sec).addEventListener('click', function(){openBusy(this,openProgramSettingsSuite);});
    $('#adminRubrics',sec).addEventListener('click',function(){openBusy(this,openRubricSuite);});
    $('#adminCalendar',sec).addEventListener('click',function(){openBusy(this,openEventManager);});
    $('#adminAttendance',sec).addEventListener('click',function(){openBusy(this,openAttendanceSuite);});
    $('#adminCertificates',sec).addEventListener('click',function(){openBusy(this,openCertificateSuite);});
    $('#adminHealth',sec).addEventListener('click',function(){openBusy(this,openHealthSuite);});
    $('#adminAudit',sec).addEventListener('click',function(){openBusy(this,openAuditSuite);});
    $('#adminExcel',sec).addEventListener('click',function(){var button=this;openBusy(button,function(){return downloadProtected('/api/reports?format=xls','laporan-ftg-fellowship.xls');});});
    $('#adminPdf',sec).addEventListener('click',function(){var button=this;openBusy(button,function(){return openProtectedReport('/api/reports?format=html');});});
    var suiteGrid=$('.ftg-suite-grid',sec),recordingButton=document.createElement('button');
    var trackButton=document.createElement('button');trackButton.id='adminTracks';trackButton.innerHTML='<i class="fa-solid fa-route"></i><b>Track / Path</b>';
    if(suiteGrid)suiteGrid.insertBefore(trackButton,suiteGrid.children[1]||null);trackButton.addEventListener('click',function(){openBusy(this,openTrackManager);});
    warmApiOnIntent($('#adminCohort',sec),'program-pairings','/api/program',{method:'POST',body:JSON.stringify({action:'pairings_data'}),loading:false});
    warmApiOnIntent(trackButton,'program-tracks','/api/program',{method:'POST',body:JSON.stringify({action:'tracks_list',admin:true}),loading:false});
    recordingButton.id='adminRecordings';recordingButton.innerHTML='<i class="fa-solid fa-circle-play"></i><b>LMS & Rekaman</b>';
    if(suiteGrid)suiteGrid.insertBefore(recordingButton,suiteGrid.children[1]||null);
    recordingButton.addEventListener('click',function(){openBusy(this,openRecordingManager);});
    var learningButton=document.createElement('button');learningButton.id='adminLearning';learningButton.innerHTML='<i class="fa-solid fa-brain"></i><b>Kurikulum & Canvas</b>';
    if(suiteGrid)suiteGrid.insertBefore(learningButton,suiteGrid.children[1]||null);learningButton.addEventListener('click',function(){openBusy(this,openLearningManager);});
    var workshopButton=document.createElement('button');workshopButton.id='adminWorkshopSchedule';workshopButton.innerHTML='<i class="fa-solid fa-calendar-days"></i><b>Jadwal Workshop</b>';
    if(suiteGrid)suiteGrid.insertBefore(workshopButton,suiteGrid.children[2]||null);workshopButton.addEventListener('click',function(){openBusy(this,openWorkshopScheduleManager);});
    var assignmentMonitor=document.createElement('button');assignmentMonitor.id='adminAssignmentMonitor';assignmentMonitor.innerHTML='<i class="fa-solid fa-list-check"></i><b>Tugas & Pengumpulan</b>';
    if(suiteGrid)suiteGrid.insertBefore(assignmentMonitor,suiteGrid.children[2]||null);assignmentMonitor.addEventListener('click',function(){openBusy(this,openAssignmentMonitor);});
    var notificationButton=document.createElement('button');notificationButton.id='adminNotifications';notificationButton.innerHTML='<i class="fa-solid fa-envelope-open-text"></i><b>Email & Notifikasi</b>';
    if(suiteGrid)suiteGrid.insertBefore(notificationButton,suiteGrid.children[3]||null);notificationButton.addEventListener('click',function(){openBusy(this,openAdminNotificationCenter);});
    var announcementButton=document.createElement('button');announcementButton.id='adminAnnouncements';announcementButton.innerHTML='<i class="fa-solid fa-bullhorn"></i><b>Papan Informasi</b>';
    if(suiteGrid)suiteGrid.insertBefore(announcementButton,suiteGrid.children[4]||null);announcementButton.addEventListener('click',function(){openBusy(this,openAnnouncementManager);});
    var donorButton=document.createElement('button');donorButton.id='adminDonorPortal';donorButton.innerHTML='<i class="fa-solid fa-hand-holding-heart"></i><b>Program Publik</b>';
    if(suiteGrid)suiteGrid.insertBefore(donorButton,suiteGrid.children[4]||null);donorButton.addEventListener('click',function(){openBusy(this,openDonorPortalManager);});
    var trustButton=document.createElement('button');trustButton.id='adminInvestorTrust';trustButton.innerHTML='<i class="fa-solid fa-shield-halved"></i><b>Investor Trust Center</b>';
    if(suiteGrid)suiteGrid.insertBefore(trustButton,suiteGrid.children[5]||null);trustButton.addEventListener('click',function(){openBusy(this,openInvestorTrustManager);});
    $all('button',sec).forEach(function(button){button.type='button';if(button.id)button.setAttribute('data-admin-action',button.id);});
    warmAdminControlCenter();
    if(!document.documentElement.getAttribute('data-program-refresh')){
      document.documentElement.setAttribute('data-program-refresh','1');
      document.addEventListener('ftg:structured-ready',function(){var current=$('#admin-operations');if(current)current.remove();mountAdminOperations();});
    }
  }
  function mountMentorLearningMonitor() {
    if (!/^(mentor-dashboard|mentor-mentee)/.test(PAGE) || myRole() !== 'mentor') return;
    var host = document.getElementById('mentor-operations');
    if (!host || document.getElementById('mentorLearningMonitor')) return;
    var head = host.firstElementChild;
    if (!head) return;
    var actions = head.lastElementChild;
    if (!actions) return;
    var button = document.createElement('button'); button.id='mentorLearningMonitor'; button.type='button'; button.className='ftg-mentor-learning-button'; button.innerHTML='<i class="fa-solid fa-brain"></i> Progres Canvas';
    actions.insertBefore(button, actions.firstChild); button.addEventListener('click', openLearningManager);
  }

  function disciplineStatus(status) {
    if (status === 'suspended') return { label: 'TERKUNCI', color: '#dc2626', bg: '#fef2f2', icon: 'fa-lock' };
    if (status === 'dropped') return { label: 'GUGUR', color: '#991b1b', bg: '#fee2e2', icon: 'fa-user-xmark' };
    if (status === 'graduated') return { label: 'LULUS', color: '#6d28d9', bg: '#f5f3ff', icon: 'fa-graduation-cap' };
    return { label: 'AKTIF', color: '#15803d', bg: '#f0fdf4', icon: 'fa-circle-check' };
  }
  function openDisciplineParticipant(profile, done) {
    var absences = Math.max(0, Number(profile.absence_count || 0));
    var state = disciplineStatus(profile.status);
    var dots = [1, 2, 3].map(function (n) { return '<span class="' + (n <= absences ? 'is-absent' : '') + '"><i class="fa-solid ' + (n <= absences ? 'fa-xmark' : 'fa-check') + '"></i><small>' + n + '</small></span>'; }).join('');
    modal('<div class="ftg-discipline-modal"><div class="ftg-discipline-person"><div class="ftg-discipline-avatar">' + esc(profile.initials || initialsOf(profile.full_name)) + '</div><div><span style="background:' + state.bg + ';color:' + state.color + '"><i class="fa-solid ' + state.icon + '"></i> ' + state.label + '</span><h3>' + esc(profile.full_name) + '</h3><p>' + esc(profile.email) + ' · ' + esc(profile.path || 'Mentee') + '</p></div></div><div class="ftg-attendance-rule"><div><b>Ketidakhadiran ' + absences + '/3</b><p>Status gugur baru dapat ditetapkan setelah tiga kali tidak mengikuti kegiatan.</p></div><div class="ftg-attendance-dots">' + dots + '</div></div><label for="disciplineNote">Catatan panitia</label><textarea id="disciplineNote" rows="3" placeholder="Contoh: Tidak hadir workshop tanpa konfirmasi...">' + esc(profile.discipline_note || '') + '</textarea><div class="ftg-discipline-actions"><button id="disciplineAbsent" class="is-warning"><i class="fa-solid fa-calendar-xmark"></i> Catat Tidak Hadir</button><button id="disciplineCorrect" ' + (!absences ? 'disabled' : '') + '><i class="fa-solid fa-rotate-left"></i> Koreksi -1</button>' + (profile.status === 'suspended' ? '<button id="disciplineUnlock" class="is-success"><i class="fa-solid fa-lock-open"></i> Buka Kunci</button>' : profile.status === 'dropped' ? '<button id="disciplineRestore" class="is-success"><i class="fa-solid fa-user-check"></i> Aktifkan Kembali</button>' : '<button id="disciplineLock" class="is-danger"><i class="fa-solid fa-lock"></i> Kunci Akun</button>') + '<button id="disciplineDrop" class="is-drop" ' + (absences < 3 || profile.status === 'dropped' ? 'disabled' : '') + '><i class="fa-solid fa-user-xmark"></i> Tetapkan Gugur</button></div><p class="ftg-discipline-help"><i class="fa-solid fa-shield-halved"></i> Semua perubahan tersimpan di audit log dan hanya dapat dilakukan panitia.</p></div>', function (box, close) {
      function run(action, confirmation) {
        var note = $('#disciplineNote', box).value.trim();
        $all('button', box).forEach(function (button) { button.disabled = true; });
        apiRequest('/api/admin-users', { method: 'PATCH', body: JSON.stringify({ id: profile.id, action: action, note: note, confirmation: confirmation }) }).then(function () {
          close();
          var messages = { record_absence: 'Ketidakhadiran berhasil dicatat', correct_absence: 'Catatan kehadiran dikoreksi', lock: 'Akun mentee berhasil dikunci', unlock: 'Kunci akun berhasil dibuka', drop: 'Mentee ditetapkan gugur', restore: 'Status mentee kembali aktif' };
          toast(messages[action], action === 'drop' ? '⚠️' : '✅');
          done();
        }).catch(function (error) { toast(error.message, '⚠️'); $all('button', box).forEach(function (button) { button.disabled = false; }); if (absences < 3 && $('#disciplineDrop', box)) $('#disciplineDrop', box).disabled = true; });
      }
      $('#disciplineAbsent', box).addEventListener('click', function () { run('record_absence'); });
      $('#disciplineCorrect', box).addEventListener('click', function () { run('correct_absence'); });
      var lock = $('#disciplineLock', box); if (lock) lock.addEventListener('click', function () { if (confirm('Kunci akun ' + profile.full_name + '? Mentee tidak dapat login sampai kunci dibuka.')) run('lock'); });
      var unlock = $('#disciplineUnlock', box); if (unlock) unlock.addEventListener('click', function () { run('unlock'); });
      var restore = $('#disciplineRestore', box); if (restore) restore.addEventListener('click', function () { if (confirm('Aktifkan kembali kepesertaan ' + profile.full_name + '?')) run('restore'); });
      var drop = $('#disciplineDrop', box); if (drop) drop.addEventListener('click', function () { if (!confirm('Tetapkan ' + profile.full_name + ' sebagai GUGUR? Akun akan terkunci dan keputusan tercatat permanen di audit log.')) return; var phrase = prompt('Ketik GUGUR untuk mengonfirmasi'); if (phrase === 'GUGUR') run('drop', phrase); else if (phrase !== null) toast('Konfirmasi tidak sesuai', '⚠️'); });
    });
  }
  function openMentorApplicationReview(profile, approve, block) {
    var a = profile.mentor_application || {};
    var row = function (label, value) { return '<div class="ftg-mentor-review-row"><span>' + esc(label) + '</span><b>' + esc(value || '—') + '</b></div>'; };
    modal('<div class="ftg-mentor-review-head"><span><i class="fa-solid fa-user-tie"></i></span><div><small>PENGAJUAN MENTOR</small><h3>' + esc(profile.full_name) + '</h3><p>' + esc(profile.email) + '</p></div></div>' +
      '<div class="ftg-mentor-review-grid">' + row('Track', profile.path) + row('Mentee sesuai track',Object.keys(AUTH.profilesById).map(function(id){return AUTH.profilesById[id];}).filter(function(p){return p.role==='mentee'&&p.status==='active'&&p.path===profile.path&&!p.mentor_id;}).length+' belum dipasangkan') + row('WhatsApp', a.phone) + row('Jabatan', a.job_title) + row('Institusi', a.company_or_institution) + row('Pengalaman', a.years_of_experience ? a.years_of_experience + ' tahun' : '') + row('Waktu', a.availability_hours ? a.availability_hours + ' jam/bulan' : '') + row('Format', a.mentoring_format) + '</div>' +
      (a.linkedin_url ? '<a class="ftg-mentor-review-link" href="' + esc(a.linkedin_url) + '" target="_blank" rel="noopener"><i class="fa-brands fa-linkedin"></i> Buka profil LinkedIn</a>' : '') +
      '<div class="ftg-mentor-review-block"><small>BIDANG KEAHLIAN</small><div>' + (a.expertise_tags || []).map(function (tag) { return '<span>' + esc(tag) + '</span>'; }).join('') + '</div></div>' +
      '<div class="ftg-mentor-review-block"><small>BIO PROFESIONAL</small><p>' + esc(a.bio || 'Belum diisi') + '</p></div>' +
      '<div class="ftg-mentor-review-block"><small>MOTIVASI</small><p>' + esc(a.motivation || 'Belum diisi') + '</p></div>' +
      '<div class="ftg-mentor-review-commit ' + (a.commitment_confirmed ? 'is-ok' : 'is-missing') + '"><i class="fa-solid ' + (a.commitment_confirmed ? 'fa-circle-check' : 'fa-triangle-exclamation') + '"></i> ' + (a.commitment_confirmed ? 'Komitmen dan kode etik telah disetujui' : 'Komitmen belum disetujui') + '</div>' +
      '<div class="ftg-mentor-review-actions"><button id="mentorApplicationBlock" class="ftg-suite-danger">Tolak / Blokir</button><button id="mentorApplicationApprove" class="ftg-suite-primary" ' + (!a.commitment_confirmed ? 'disabled' : '') + '>Setujui sebagai Mentor</button></div>', function (box, close) {
        $('#mentorApplicationApprove', box).addEventListener('click', function () { close(); approve(); });
        $('#mentorApplicationBlock', box).addEventListener('click', function () { close(); block(); });
      });
  }
  function mountAdminDiscipline() {
    if (PAGE.indexOf('admin-dashboard') !== 0 || !AUTH.profile || AUTH.profile.role !== 'admin') return;
    var existing = $('#admin-discipline-center');
    if (existing) existing.remove();
    var host = $('main > div.px-8'); if (!host) return;
    var sec = document.createElement('section'); sec.id = 'admin-discipline-center'; sec.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';
    sec.innerHTML = '<div class="ftg-discipline-head"><div><span><i class="fa-solid fa-user-check"></i></span><div><h2>Verifikasi Pendaftaran Google</h2><p>Periksa nama, email, metode login, dan jenis akses yang diminta sebelum menyetujui akun baru.</p></div></div><a href="admin-akun.html">Kelola semua akun <i class="fa-solid fa-arrow-right"></i></a></div><div id="googleRegistrationQueue" style="margin:12px 0 18px"></div><div class="ftg-discipline-head" style="border-top:1px solid #f1f5f9;padding-top:16px"><div><span><i class="fa-solid fa-shield-halved"></i></span><div><h2>Disiplin & Status Peserta</h2><p>Catat ketidakhadiran, kunci akun, atau tetapkan gugur setelah 3 kali tidak mengikuti kegiatan.</p></div></div></div><div id="disciplineSummary" class="ftg-discipline-summary">Memuat status peserta...</div><div id="disciplineRows" class="ftg-discipline-grid"></div>';
    host.insertBefore(sec, host.firstChild);
    function load() {
      $('#disciplineRows', sec).innerHTML = '<p class="ftg-discipline-loading">Memuat data kehadiran...</p>';
      cachedApiRequest('admin-users','/api/admin-users',null,45000).then(function (data) {
        var users=data.users||[],userMap={},profiles;users.forEach(function(user){userMap[user.id]=user;});profiles=(data.profiles||[]).map(function(p){var u=userMap[p.id]||{},meta=u.user_metadata||{};p.login_provider=meta.signup_provider||((u.app_metadata||{}).provider)||'email';p.requested_role=meta.requested_role||p.role;p.mentor_application=meta.mentor_application||null;return p;});
        var pending=profiles.filter(function(p){return p.status==='invited';});
        $('#googleRegistrationQueue',sec).innerHTML=pending.length?pending.map(function(p){var mentor=p.requested_role==='mentor';return '<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border:1px solid '+(mentor?'#bbf7d0':'#fde68a')+';background:'+(mentor?'#f0fdf4':'#fffbeb')+';border-radius:12px;padding:11px;margin:7px 0"><div><b style="display:block;font-size:12px;color:#334155">'+esc(p.full_name)+'</b><small style="display:block;color:#64748b;margin-top:2px">'+esc(p.email)+' · Login '+esc(p.login_provider==='google'?'Google':'Email')+' · Minta akses '+esc(p.requested_role||'mentee')+'</small><small style="display:block;color:'+(mentor?'#15803d':'#b45309')+';margin-top:3px">'+esc(mentor?(p.mentor_application?p.mentor_application.job_title+' · '+p.mentor_application.company_or_institution:'Form mentor belum lengkap'):(p.path||'Profil belum dilengkapi'))+'</small></div><div style="display:flex;gap:6px">'+(mentor?'<button data-registration-detail="'+p.id+'" style="border:1px solid #16a34a;background:#fff;color:#15803d;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800">Lihat Data</button>':'<button data-registration-approve="'+p.id+'" style="border:0;background:#16a34a;color:#fff;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800">Setujui</button>')+'<button data-registration-block="'+p.id+'" style="border:0;background:#dc2626;color:#fff;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800">Blokir</button></div></div>';}).join(''):'<div style="background:#f0fdf4;color:#166534;border-radius:11px;padding:10px;font-size:10px;font-weight:700">✓ Tidak ada pendaftaran baru yang menunggu.</div>';
        function approveRegistration(p){if(!p||!confirm('Setujui '+p.full_name+' sebagai '+(p.requested_role||'mentee')+'?'))return;apiRequest('/api/admin-users',{method:'PATCH',body:JSON.stringify({id:p.id,status:'active',role:p.requested_role||'mentee',action:'approve_registration'})}).then(function(){toast('Pendaftaran disetujui','✅');load();}).catch(function(e){toast(e.message,'⚠️');});}
        function blockRegistration(p){if(!p)return;var reason=prompt('Alasan penolakan / pemblokiran '+p.full_name+':');if(reason===null)return;apiRequest('/api/admin-users',{method:'PATCH',body:JSON.stringify({id:p.id,status:'suspended',action:'reject_registration',note:reason})}).then(function(){toast('Pendaftaran ditolak','🔒');load();}).catch(function(e){toast(e.message,'⚠️');});}
        $all('[data-registration-approve]',sec).forEach(function(button){button.addEventListener('click',function(){approveRegistration(pending.filter(function(x){return x.id===button.getAttribute('data-registration-approve');})[0]);});});
        $all('[data-registration-detail]',sec).forEach(function(button){button.addEventListener('click',function(){var p=pending.filter(function(x){return x.id===button.getAttribute('data-registration-detail');})[0];openMentorApplicationReview(p,function(){approveRegistration(p);},function(){blockRegistration(p);});});});
        $all('[data-registration-block]',sec).forEach(function(button){button.addEventListener('click',function(){var p=pending.filter(function(x){return x.id===button.getAttribute('data-registration-block');})[0];if(!p||!confirm('Blokir pendaftaran '+p.full_name+'?'))return;apiRequest('/api/admin-users',{method:'PATCH',body:JSON.stringify({id:p.id,status:'suspended'})}).then(function(){toast('Pendaftaran diblokir','🔒');load();}).catch(function(e){toast(e.message,'⚠️');});});});
        var mentees = profiles.filter(function (p) { return p.role === 'mentee' && p.status !== 'invited'; }).sort(function (a, b) { return Number(a.mentee_number || 99) - Number(b.mentee_number || 99); });
        var locked = mentees.filter(function (p) { return p.status === 'suspended'; }).length;
        var dropped = mentees.filter(function (p) { return p.status === 'dropped'; }).length;
        var warnings = mentees.filter(function (p) { return Number(p.absence_count || 0) >= 2 && p.status === 'active'; }).length;
        $('#disciplineSummary', sec).innerHTML = '<span><b>' + mentees.length + '</b> Peserta</span><span class="is-warning"><b>' + warnings + '</b> Perlu perhatian</span><span class="is-locked"><b>' + locked + '</b> Terkunci</span><span class="is-dropped"><b>' + dropped + '</b> Gugur</span>';
        $('#disciplineRows', sec).innerHTML = mentees.map(function (p) {
          var absence = Math.max(0, Number(p.absence_count || 0)), status = disciplineStatus(p.status);
          return '<button type="button" data-discipline-user="' + p.id + '" class="ftg-discipline-card"><span data-profile-avatar="'+p.id+'" class="ftg-discipline-card-avatar '+(p.avatar_url?'ftg-profile-photo':'')+'">' + (p.avatar_url?'<img src="'+esc(p.avatar_url)+'" alt="Foto '+esc(p.full_name)+'">':esc(p.initials || initialsOf(p.full_name))) + '</span><span class="ftg-discipline-card-person"><b>' + esc(p.full_name) + '</b><small>' + esc(p.path || 'Mentee') + (p.bio?' · '+esc(p.bio):'') + '</small></span><span class="ftg-discipline-absence ' + (absence >= 3 ? 'is-critical' : absence >= 2 ? 'is-warning' : '') + '"><b>' + absence + '/3</b><small>Tidak hadir</small></span><span class="ftg-discipline-status" style="background:' + status.bg + ';color:' + status.color + '"><i class="fa-solid ' + status.icon + '"></i> ' + status.label + '</span><i class="fa-solid fa-chevron-right"></i></button>';
        }).join('') || '<p class="ftg-discipline-loading">Belum ada mentee.</p>';
        $all('[data-discipline-user]', sec).forEach(function (button) { button.addEventListener('click', function () { openDisciplineParticipant(mentees.filter(function (p) { return p.id === button.getAttribute('data-discipline-user'); })[0], load); }); });
      }).catch(function (error) { $('#disciplineRows', sec).innerHTML = '<p class="ftg-discipline-loading" style="color:#dc2626">' + esc(error.message) + '</p>'; });
    }
    load();
    var disciplineRefreshTimer;document.addEventListener('ftg:profiles-changed',function(){if(!document.body.contains(sec))return;clearTimeout(disciplineRefreshTimer);disciplineRefreshTimer=setTimeout(load,220);});
  }

  function openDrivePreview(link, name, download) {
    var preview = link;
    if (/drive\.google\.com\/file\/d\//.test(link)) preview = link.replace(/\/view.*$/, '/preview');
    modal('<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px"><div><h3 style="font-weight:800;color:#1e293b">📄 ' + esc(name || 'Preview berkas') + '</h3><p style="font-size:10px;color:#64748b">Akses tetap privat sesuai akun Google mentor.</p></div>' + (download ? '<a href="' + esc(download) + '" target="_blank" rel="noopener" style="background:#1a5f4f;color:#fff;border-radius:9px;padding:7px 10px;font-size:10px;font-weight:800;text-decoration:none">Unduh</a>' : '') + '</div><iframe src="' + esc(preview) + '" title="Preview ' + esc(name || 'berkas') + '" style="width:100%;height:58vh;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc"></iframe><a href="' + esc(link) + '" target="_blank" rel="noopener" style="display:block;text-align:center;font-size:10px;color:#8b5cf6;margin-top:8px">Buka langsung di Google Drive ↗</a>');
  }
  function globalSearchModal() {
    var pages = myRole() === 'mentee' ? [['Dashboard','mentee-dashboard.html'],['Tugas Saya','assignment-submission.html'],['Progress Saya','progress-tracker.html'],['Jurnal Pribadi','jurnal.html'],['Feedback Mentor','mentor-feedback.html'],['Workshop','workshop-library.html']] : myRole() === 'mentor' ? [['Dashboard Mentor','mentor-dashboard.html'],['Tugas & Review','mentor-review.html'],['Mentee Saya','mentor-mentee.html'],['Feedback','mentor-feedback.html'],['Leaderboard','kpi-leaderboard.html']] : [['Dashboard Fasil','admin-dashboard.html'],['Pusat Program','admin-program.html'],['Kelola Akun','admin-akun.html'],['Tugas Global','admin-program.html']];
    modal('<h3 style="font-weight:800;color:#1e293b">🔎 Cari di FTG Fellowship</h3><input id="globalSearchInput" autofocus placeholder="Cari halaman, tugas, atau mentee..." style="width:100%;border:1px solid #cbd5e1;border-radius:11px;padding:10px;margin:10px 0"><div id="globalSearchRows"></div>', function (box) {
      var items = pages.map(function (p) { return { title:p[0],meta:'Halaman',href:p[1] }; }).concat(mentorAssignments().map(function (t) { return { title:t.title,meta:'Tugas · '+dueLabel(t.deadline),href:myRole()==='mentee'?'mentee-dashboard.html#tugas':'mentor-review.html' }; })).concat(myRole() !== 'mentee' ? menteeIds().map(function (id) { return { title:MENTEES[id].name,meta:'Mentee · '+MENTEES[id].path,href:'mentor-mentee.html' }; }) : []);
      function render(q) { q=(q||'').toLowerCase(); var rows=items.filter(function(i){return !q||(i.title+' '+i.meta).toLowerCase().indexOf(q)>-1;}).slice(0,12); $('#globalSearchRows',box).innerHTML=rows.map(function(i){return '<a href="'+esc(i.href)+'" style="display:block;padding:9px;border-bottom:1px solid #f1f5f9;text-decoration:none"><b style="font-size:11px;color:#334155">'+esc(i.title)+'</b><p style="font-size:9px;color:#94a3b8">'+esc(i.meta)+'</p></a>';}).join('')||'<p style="padding:18px;text-align:center;color:#94a3b8;font-size:11px">Tidak ditemukan.</p>'; }
      render(''); $('#globalSearchInput',box).addEventListener('input',function(){render(this.value);});
    });
  }
  function mountOnboarding() {
    if (!AUTH.profile || !AUTH.user || !/^(mentee|mentor)$/.test(AUTH.profile.role) || AUTH.profile.onboarding_completed) return;
    if ((AUTH.profile.role === 'mentee' && PAGE.indexOf('mentee-dashboard') !== 0) || (AUTH.profile.role === 'mentor' && PAGE.indexOf('mentor-dashboard') !== 0)) return;
    var seenKey = 'ftgWelcomeSeen:' + AUTH.user.id;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, '1');
    var isMentee = AUTH.profile.role === 'mentee';
    var name = AUTH.profile.full_name || (isMentee ? 'Future Builder' : 'Mentor');
    var roleLabel = isMentee ? 'MENTEE · FUTURE BUILDER' : 'MENTOR · GROWTH PARTNER';
    var greeting = isMentee ? 'Perjalanan hebatmu dimulai dari sini.' : 'Terima kasih sudah hadir untuk menumbuhkan para Future Builder.';
    var intro = isMentee
      ? 'Dashboard ini adalah pusat perjalanan fellowship-mu—tempat melihat tugas, mengumpulkan karya, menerima feedback, dan memantau perkembanganmu.'
      : 'Dashboard mentor membantu Anda memberi arahan yang jelas, memantau perkembangan mentee, dan mengubah setiap tugas menjadi proses belajar yang bermakna.';
    var quote = isMentee
      ? 'Berani belajar, berani mencoba, dan bertumbuh satu langkah setiap hari.'
      : 'Satu feedback yang tepat dapat membuka langkah besar bagi seorang mentee.';
    var content = isMentee
      ? [['fa-list-check','Cek prioritasmu','Lihat tugas baru, deadline, dan agenda mentoring dari dashboard.'],['fa-cloud-arrow-up','Hubungkan Google Drive','Unggah karya dengan aman dan bagikan hanya kepada mentor.'],['fa-seedling','Tumbuh dari feedback','Pantau nilai, revisi, badge, dan progres perjalananmu.']]
      : [['fa-file-circle-plus','Berikan tugas yang jelas','Tentukan target mentee, deadline, checklist, dan rubrik penilaian.'],['fa-chart-line','Pantau perkembangan','Temukan mentee yang membutuhkan perhatian atau tindak lanjut.'],['fa-comments','Dampingi dengan bermakna','Review karya, berikan feedback, dan catat hasil sesi 1-on-1.']];
    modal('<div class="ftg-welcome-hero ' + (isMentee ? 'is-mentee' : 'is-mentor') + '"><div class="ftg-welcome-mark"><i class="fa-solid ' + (isMentee ? 'fa-rocket' : 'fa-hand-holding-heart') + '"></i></div><span class="ftg-welcome-role">' + roleLabel + '</span><h3>Selamat datang, ' + esc(name) + '! 👋</h3><p>' + greeting + '</p></div><div class="ftg-welcome-body"><p class="ftg-welcome-intro">' + intro + '</p><div class="ftg-welcome-steps">' + content.map(function (x) { return '<div class="ftg-welcome-step"><span><i class="fa-solid ' + x[0] + '"></i></span><div><b>' + x[1] + '</b><p>' + x[2] + '</p></div></div>'; }).join('') + '</div><blockquote>“' + quote + '”</blockquote><button id="onboardingDone" class="ftg-welcome-start">' + (isMentee ? 'Mulai Perjalanan Saya' : 'Mulai Mendampingi Mentee') + ' <i class="fa-solid fa-arrow-right"></i></button></div>', function (box, close) {
      var done = $('#onboardingDone', box);
      done.addEventListener('click', function () {
        done.disabled = true;
        done.innerHTML = 'Menyiapkan dashboard...';
        sb.from('profiles').update({ onboarding_completed: true, updated_at: new Date().toISOString() }).eq('id', AUTH.user.id).then(function (result) {
          if (result.error) throw result.error;
          AUTH.profile.onboarding_completed = true;
          close();
          toast(isMentee ? 'Selamat memulai perjalananmu!' : 'Selamat mendampingi para mentee!', '✨');
          setTimeout(mountGoogleGate, 220);
        }).catch(function (error) {
          sessionStorage.removeItem(seenKey);
          done.disabled = false;
          done.innerHTML = (isMentee ? 'Mulai Perjalanan Saya' : 'Mulai Mendampingi Mentee') + ' <i class="fa-solid fa-arrow-right"></i>';
          toast(error.message || 'Sambutan belum dapat disimpan', '⚠️');
        });
      });
    });
  }
  function mountAdminInsights() {
    if (PAGE.indexOf('admin-dashboard') !== 0 || document.getElementById('admin-production-insights')) return;
    var host=$('main > div.px-8');if(!host)return;var late=0,driveIssues=0,scores=[],submitted=0,reviewed=0;
    mentorAssignments().forEach(function(t){(t.targets||[]).forEach(function(id){var s=taskSubmission(id,t.id),life=assignmentStatus(t,s);if(life.key==='late'||life.key==='revision')late++;if(s&&s.submittedAt)submitted++;if(s&&s.review&&s.review.decision!=='revision'){reviewed++;scores.push(s.review.score);}(s&&s.files||[]).forEach(function(f){if(f.sharedWithMentor===false||!f.link)driveIssues++;});});});
    var sec=document.createElement('section');sec.id='admin-production-insights';sec.className='bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5';sec.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px"><div><h2 style="font-size:15px;font-weight:800;color:#1e293b">📈 Quality & Health Center</h2><p style="font-size:10px;color:#64748b">Risiko program, kualitas review, Drive, backup, dan status layanan.</p></div><div style="display:flex;gap:6px"><button id="adminHealthCheck" class="ftg-action-secondary">Cek Status</button><button id="adminBackupCreate" class="ftg-action-primary">Buat Backup</button></div></div><div class="ftg-insight-grid"><div><b>'+late+'</b><span>Perlu perhatian</span></div><div><b>'+submitted+'</b><span>Submission</span></div><div><b>'+reviewed+'</b><span>Review selesai</span></div><div><b>'+(scores.length?Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length):'—')+'</b><span>Rata-rata nilai</span></div><div><b style="color:'+(driveIssues?'#ef4444':'#16a34a')+'">'+driveIssues+'</b><span>Masalah Drive</span></div></div><div id="adminHealthResult" style="font-size:10px;color:#64748b;margin-top:9px"></div>';
    host.insertBefore(sec,host.firstChild);$('#adminHealthCheck',sec).addEventListener('click',function(){var out=$('#adminHealthResult',sec);out.textContent='Memeriksa layanan...';apiRequest('/api/health').then(function(d){var mail=d.email==='configured'?(d.email_provider==='zoho'?'Zoho aktif':'Aktif'):'Belum dikonfigurasi';out.innerHTML='Database: <b>'+esc(d.database)+'</b> · Reminder: <b>'+esc(d.reminders)+'</b> · Email: <b>'+esc(mail)+'</b> · Drive: <b>'+esc(d.central_drive)+'</b> · '+new Date(d.checked_at).toLocaleString('id-ID');}).catch(function(e){out.textContent=e.message;});});$('#adminBackupCreate',sec).addEventListener('click',function(){apiRequest('/api/backups',{method:'POST',body:JSON.stringify({action:'create',label:'Backup manual '+new Date().toLocaleString('id-ID')})}).then(function(){toast('Backup aman berhasil dibuat','✅');}).catch(function(e){toast(e.message,'⚠️');});});
    var backupManage=document.createElement('button');backupManage.id='adminBackupManage';backupManage.className='ftg-action-secondary';backupManage.textContent='Kelola Backup';$('#adminBackupCreate',sec).parentNode.appendChild(backupManage);backupManage.addEventListener('click',openBackupManager);
  }
  function openBackupManager() {
    apiRequest('/api/backups').then(function(data){var rows=data.backups||[];modal('<h3 style="font-weight:800;color:#1e293b">🛡️ Backup & Pemulihan</h3><p style="font-size:10px;color:#64748b;margin:4px 0 10px">Restore melakukan merge aman dan selalu membuat safety backup lebih dahulu.</p><div id="backupRows">'+(rows.length?rows.map(function(b){return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:9px;margin:6px 0"><div><b style="font-size:11px;color:#334155">'+esc(b.label)+'</b><p style="font-size:9px;color:#94a3b8">'+new Date(b.created_at).toLocaleString('id-ID')+'</p></div><button data-restore-backup="'+esc(b.id)+'" class="ftg-action-secondary">Preview</button></div>';}).join(''):'<p style="font-size:11px;color:#94a3b8">Belum ada backup.</p>')+'</div>',function(box,close){$all('[data-restore-backup]',box).forEach(function(btn){btn.addEventListener('click',function(){var id=btn.getAttribute('data-restore-backup');apiRequest('/api/backups',{method:'POST',body:JSON.stringify({action:'preview',id:id})}).then(function(preview){var total=Object.keys(preview.counts||{}).reduce(function(n,k){return n+preview.counts[k];},0);if(!confirm('Pulihkan '+total+' record dari "'+preview.backup.label+'"?\n\nSafety backup akan dibuat otomatis.'))return;var phrase=prompt('Ketik PULIHKAN untuk melanjutkan');if(phrase!=='PULIHKAN')return;return apiRequest('/api/backups',{method:'POST',body:JSON.stringify({action:'restore',id:id,confirmation:phrase})}).then(function(){close();toast('Data berhasil dipulihkan dengan safety backup','✅');location.reload();});}).catch(function(e){toast(e.message,'⚠️');});});});});}).catch(function(e){toast(e.message,'⚠️');});
  }
  var UI_LANGUAGE=localStorage.getItem('ftg-language')==='en'?'en':'id',LANGUAGE_ORIGINALS=new WeakMap(),LANGUAGE_BUSY=false;
  var LANGUAGE_EN={
    'Dashboard':'Dashboard','Design Thinking':'Design Thinking','Workshop Library':'Workshop Library','Tugas Saya':'My Assignments','Progress Saya':'My Progress','Jurnal Saya':'My Journal','Feedback Mentor':'Mentor Feedback','Leaderboard':'Leaderboard','Keluar':'Sign Out',
    'Mentee Saya':'My Mentees','Tugas & Review':'Assignments & Reviews','Berikan Feedback':'Give Feedback','Progress Grup':'Group Progress','Monitoring':'Monitoring','Pusat Program':'Program Center','Kelola Akun':'Manage Accounts',
    'Opening Ceremony':'Opening Ceremony','Closing Ceremony':'Closing Ceremony','Kalender':'Calendar','Presensi':'Attendance','Sertifikat':'Certificate','Cari':'Search','Simpan Perubahan':'Save Changes','Buat Akun Aman':'Create Secure Account',
    'Kalender Program':'Program Calendar','Buka Kalender':'Open Calendar','Tambah ke Google Calendar':'Add to Google Calendar','Sinkronkan semua (.ics)':'Sync all (.ics)','Agenda Baru':'New Event','Simpan Agenda':'Save Event','Hapus Agenda':'Delete Event','Tambahkan ke kalender':'Add to calendar','Tugas & Pengumpulan Program':'Program Assignments & Submissions','Tugas Baru':'New Assignment','Lihat detail':'View details','Tutup detail':'Close details',
    'Cohort & Pairing':'Cohort & Pairing','Kurikulum & Canvas':'Curriculum & Canvas','Tugas & Pengumpulan':'Assignments & Submissions','Email & Notifikasi':'Email & Notifications','Program Publik':'Public Program','Papan Informasi':'Information Board','LMS & Rekaman':'LMS & Recordings','Pengaturan':'Settings','Rubrik':'Rubric','Kesehatan Program':'Program Health','Audit Log':'Audit Log',
    'Tambah Mentee':'Add Mentee','Tambah Mentor':'Add Mentor','Semua Akun':'All Accounts','Semua role':'All roles','Nama lengkap':'Full name','Email aktif':'Active email','Password sementara':'Temporary password','Jalur mentee':'Mentee track',
    'Belum ada agenda.':'No schedule yet.','Menyimpan…':'Saving…','Coba Lagi':'Try Again','Simpan Pairing':'Save Pairing','Belum ditentukan':'Not assigned','Minggu aktif':'Active week','Bulan aktif':'Active month','Akses fitur':'Feature access'
  };
  Object.assign(LANGUAGE_EN,{
    'Kendali Fasil':'Fasil Control','Lihat Monitoring':'View Monitoring','Pusat Operasi Program':'Program Operations Center','Semua kendali program, peserta, pembelajaran, kehadiran, dan pelaporan.':'All program, participant, learning, attendance, and reporting controls.','Operasional program tanpa berpindah dashboard':'Run the program from one dashboard','Pilih modul di bawah. Setiap aksi membuka ruang kerja ringan dan data dimuat hanya saat diperlukan.':'Choose a module below. Each action opens a focused workspace and loads data only when needed.','Pembelajaran':'Learning','Kegiatan & peserta':'Activities & participants','Kontrol & laporan':'Controls & reports','Kurikulum, canvas, LMS, tugas, dan rubrik.':'Curriculum, canvas, LMS, assignments, and rubrics.','Cohort, pairing, kalender, presensi, dan sertifikat.':'Cohorts, pairing, calendar, attendance, and certificates.','Notifikasi, kesehatan program, audit, Excel, dan PDF.':'Notifications, program health, audit, Excel, and PDF.','Terkumpul':'Submitted','Dinilai':'Reviewed','Jadwal Workshop':'Workshop Schedule','Investor Trust Center':'Investor Trust Center','Presensi QR':'QR Attendance','Unduh Excel':'Download Excel','Laporan PDF':'PDF Report','Track / Path':'Track / Path','Pusat Program':'Program Center','Kelola pembelajaran, tugas, agenda, presensi, komunikasi, dan laporan dari satu tempat.':'Manage learning, assignments, schedules, attendance, communication, and reports in one place.',
    'Monitoring Program':'Program Monitoring','Diperbarui real-time':'Updated in real time','Mentee Online Sekarang':'Mentees Online Now','Rata-rata Skor':'Average Score','Sudah Dinilai Mentor':'Reviewed by Mentor','Tugas W2 Terkumpul':'Week 2 Submissions','Status Tugas Minggu 2':'Week 2 Assignment Status','Progres Mentee (5 orang)':'Mentee Progress (5 people)','Progres per Mentee':'Progress by Mentee','Log Sistem':'System Log','Aktivitas Program':'Program Activity','Semua kejadian platform, terbaru di atas':'All platform activity, newest first','Memuat...':'Loading...','Perlu perhatian':'Needs attention','Review selesai':'Reviews completed','Rata-rata nilai':'Average score','Masalah Drive':'Drive issues','Cek Status':'Check Status','Buat Backup':'Create Backup','Kelola Backup':'Manage Backups',
    'Tambah, lihat, dan kelola akun mentee, mentor, & fasil':'Add, view, and manage mentee, mentor, and Fasil accounts','Ringkasan Peran':'Role Summary','Cara Kerja Akun':'How Accounts Work','Aksi Terakhir':'Recent Actions','Akun baru langsung aktif & bisa login dari perangkat mana pun':'New accounts are active immediately and can sign in from any device','Mentee baru otomatis mendapat ruang data & canvas sendiri':'New mentees automatically receive their own data and canvas workspace','Setiap akun mentor/mentee dapat dihapus Fasil dengan konfirmasi email':'Fasil can delete any mentor or mentee account after email confirmation','Cari nama atau email...':'Search by name or email...','Dikelola melalui Supabase Auth · password tidak dapat dilihat Fasil':'Managed through Supabase Auth. Fasil cannot view passwords.','Memuat akun aman...':'Loading secure accounts...','Semua role':'All roles','Role':'Role','Status':'Status','Aktif':'Active','Terkunci':'Locked','Gugur':'Disqualified','Kelola':'Manage','Hapus User Permanen':'Permanently Delete User','Reset password sementara':'Reset temporary password','Kosongkan bila tidak diubah':'Leave blank to keep unchanged','Zona berbahaya: penghapusan akun bersifat permanen dan tercatat di audit log.':'Danger zone: deleting an account is permanent and recorded in the audit log.',
    'Agenda, Presensi & Sertifikat':'Schedule, Attendance & Certificate','Satu tempat untuk kegiatan program dan kelulusanmu.':'One place for program activities and graduation requirements.','Pusat Kerja Saya':'My Work Center','Prioritas, deadline, progres checklist, dan portofolio dalam satu tempat.':'Priorities, deadlines, checklist progress, and portfolio in one place.','Tidak ada tugas aktif. Semua prioritasmu sudah selesai.':'No active assignments. All your priorities are complete.','Kalender terdekat':'Upcoming Calendar','Belum ada agenda.':'No events scheduled.','Lanjut Belajar':'Continue Learning','Lessons Selesai':'Lessons Completed','Tugas Dikumpul':'Assignments Submitted','Badge Diraih':'Badges Earned','Tantangan Minggu Ini':'This Week’s Challenges','Mentor Kamu':'Your Mentor','Pesan Terbaru':'Latest Message','Kirim Pesan':'Send Message','Lihat Feedback':'View Feedback','Lihat semua badge':'View all badges','Online sekarang':'Online now','Sedang dikerjakan':'In progress','Selesai':'Completed','Terkunci':'Locked','Terbuka':'Open','Progress Bulan 1':'Month 1 Progress','Bulan 1 — Fondasi':'Month 1: Foundation','Selamat datang kembali':'Welcome back','Pertahankan semangatmu!':'Keep up the momentum!','Hari Berturut':'Day Streak','Top Performer':'Top Performer','Portfolio':'Portfolio',
    'Instruksi Tugas:':'Assignment Instructions:','Kumpulkan Tugas':'Submit Assignment','Kumpulkan Tugas Minggu 2':'Submit Week 2 Assignment','Form Pengiriman Tugas':'Assignment Submission Form','Riwayat Pengiriman':'Submission History','Tambahkan Link':'Add Link','Upload File':'Upload File','Pilih File':'Choose File','Seret & lepas file di sini':'Drag and drop a file here','Simpan Draft':'Save Draft','Tersimpan otomatis':'Saved automatically','Belum dikumpulkan':'Not submitted','Menunggu Review':'Awaiting Review','Sudah Dinilai':'Reviewed','Belum dinilai':'Not reviewed','Dikumpul':'Submitted','Refleksi Tugas':'Assignment Reflection','Refleksi':'Reflection','Target: 200+ kata':'Target: 200+ words','kata ditulis':'words written','Setelah dikumpulkan, kamu masih bisa mengedit sampai deadline':'After submitting, you can still edit until the deadline','Tips dari Mentor':'Tips from Your Mentor','Dampak ke KPI':'KPI Impact','Kriteria Penilaian':'Assessment Criteria','Tulis refleksi dengan bahasa kamu sendiri — tidak harus formal':'Write the reflection in your own words. It does not need to be formal.','Ceritakan proses berpikirmu, bukan hanya jawabannya':'Describe your thought process, not only the answer.','Kumpulkan lebih awal = lebih cepat dapat feedback!':'Submit earlier to receive feedback sooner!','Kumpulkan sebelum Kamis untuk bonus poin!':'Submit before Thursday for bonus points!','Opsional: lampirkan file pendukung (foto, dokumen, link)':'Optional: attach supporting files (photos, documents, or links)','minimum 200 kata tentang problem yang kamu pilih':'at least 200 words about your chosen problem','sebelum deadline':'before the deadline','berdasarkan nilai':'based on score','poin KPI':'KPI points',
    'Perjalanan 4 Minggu':'Four-Week Journey','Klik minggu untuk lihat tugas':'Select a week to view its assignment','Simpan Progres':'Save Progress','Simpan Matrix':'Save Matrix','Apa yang perlu dikumpulkan:':'What to submit:','Komentar Mentor (Tugas W1)':'Mentor Comment (Week 1 Assignment)','Refleksi Singkat (min. 200 kata)':'Short Reflection (min. 200 words)','Untuk siapa kita mendesain?':'Who are we designing for?','Apa kebutuhan terdalam mereka?':'What is their deepest need?','Apa yang mengejutkan kamu?':'What surprised you?','Apa masalah utamanya?':'What is the main problem?','Insight apa yang membuatnya penting?':'What insight makes it important?','Untuk siapa ini paling mendesak?':'Who needs this most urgently?','Apa semua solusi yang mungkin?':'What are all possible solutions?','Bagaimana ini menguntungkan komunitas?':'How does this benefit the community?','Ide mana yang sesuai nilai & etika?':'Which idea aligns with values and ethics?','Versi paling sederhana untuk dibangun?':'What is the simplest version to build?','Apakah kita membangun dengan itqan?':'Are we building with itqan?','Asumsi apa yang diuji?':'Which assumption is being tested?','Apa yang kita pelajari — jujur?':'What did we learn, honestly?','Apa yang berhasil, apa yang tidak?':'What worked and what did not?','Apa yang akan diperbaiki?':'What will be improved?','SEKARANG':'NOW','Week 2 Task':'Week 2 Assignment',
    'JADWAL WORKSHOP BULAN 2-3':'MONTH 2-3 WORKSHOP SCHEDULE','Semua':'All','Semua peserta hadir workshop yang sama':'All participants attend the same workshop','Setiap Sabtu · 09:00–12:00 WIB':'Every Saturday, 09:00–12:00 WITA','Mulai Pre-Work':'Start Pre-Work','Buka Materi':'Open Materials','Terbuka setelah DEFINE selesai':'Opens after DEFINE is completed','Bulan 2-3 dimulai dalam':'Month 2-3 starts in','Career Path — 4 Workshop':'Career Path: 4 Workshops','Entrepreneur Path — 4 Workshop':'Entrepreneur Path: 4 Workshops',
    'Keseluruhan Program (3 Bulan)':'Overall Program (3 Months)','Peta Perjalanan 3 Bulan':'Three-Month Journey','Progress Journey Arya':'Arya’s Progress Journey','Stats Minggu Ini':'This Week’s Stats','Checklist Minggu 2':'Week 2 Checklist','Semua Badge':'All Badges','Posisi Kamu':'Your Position','Posisi kamu saat ini':'Your current position','Skor rata-rata':'Average score','Streak hari':'Day streak','Tugas dikumpul':'Assignments submitted','Lessons selesai':'Lessons completed','Progres minggu ini':'Progress this week','dari 30 peserta':'out of 30 participants','Kamu luar biasa!':'You’re doing great!','Terus semangat!':'Keep going!',
    'Jurnal Saya':'My Journal','Refleksi Hari Ini':'Today’s Reflection','Entri Sebelumnya':'Previous Entries','Statistik Jurnal':'Journal Statistics','Kenapa Menulis Jurnal?':'Why Keep a Journal?','Ruang refleksi pribadimu — hanya kamu yang bisa membacanya':'Your private reflection space. Only you can read it.','Muhasabah harian — inti dari prophetic design thinking':'Daily self-reflection at the heart of prophetic design thinking','Apa yang kamu pelajari hari ini? Apa yang membuatmu bersyukur? Tersimpan otomatis.':'What did you learn today? What are you grateful for? Saved automatically.','100% privat — mentor & panitia tidak bisa membacanya':'100% private. Mentors and Fasil cannot read it.','Refleksi rutin membuat tugas mingguanmu jauh lebih dalam':'Regular reflection adds depth to your weekly assignments',
    'Halo, Pak Faris!':'Hello, Mr. Faris!','Total Mentee':'Total Mentees','Progress Grup':'Group Progress','Tugas Pending Review':'Assignments Pending Review','Antrian Review':'Review Queue','Mentee Kamu':'Your Mentees','Kirim Pesan Grup':'Send Group Message','Filter':'Filter','On Track':'On Track','Needs Help':'Needs Help','Review Needed':'Review Needed','Tugas W1 submitted':'Week 1 assignment submitted','Tugas W2 belum dikumpul':'Week 2 assignment not submitted','Semua on track':'Everyone is on track','Perlu review hari ini!':'Needs review today!','Review Sekarang':'Review Now','Aksi Cepat':'Quick Actions','Jadwalkan Sesi 1-on-1':'Schedule a 1-on-1 Session','Kirim Pengingat ke Rizky':'Send Rizky a Reminder','Umumkan ke Grup':'Announce to Group','Rata-rata':'Average','Hari ini':'Today','hari lalu':'days ago','jam lalu':'hours ago','Tugas Pending':'Pending Assignments','Pantau progres, chat, dan status kelima mentee bimbinganmu':'Monitor the progress, chats, and status of your mentees','Berikan tugas, pantau pengumpulan, lalu review dan kirim feedback ke mentee':'Assign work, monitor submissions, review results, and send feedback to mentees','Ringkasan Review':'Review Summary','Panduan Menilai':'Assessment Guide','Bobot Penilaian':'Assessment Weights','Baca refleksi mentee sampai selesai sebelum memberi skor':'Read the mentee’s full reflection before scoring','Sebutkan minimal 1 hal baik + 1 hal yang bisa diperbaiki':'Mention at least one strength and one area to improve','Feedback langsung terkirim & mentee mendapat notifikasi':'Feedback is sent immediately and the mentee receives a notification','Rata-rata skor diberikan':'Average score given','Kedalaman analisis':'Depth of analysis','Keselarasan nilai (niyyah)':'Values alignment (niyyah)','Kualitas refleksi':'Reflection quality','Ketepatan waktu':'Timeliness',
    'Semua catatan, penilaian, dan saran dari Pak Faris':'All notes, assessments, and advice from Mr. Faris','Mentor Kamu':'Your Mentor','Rangkuman Penilaian':'Assessment Summary','Yang Bagus:':'Strengths:','Yang Perlu Diperbaiki:':'Areas to Improve:','Saran Berikutnya:':'Next Steps:','Kirim Pesan':'Send Message','Kumpulkan Sekarang':'Submit Now','Tugas Minggu 2 belum dikumpulkan':'Week 2 assignment has not been submitted','Kumpulkan tugasmu untuk mendapatkan feedback dari Pak Faris!':'Submit your assignment to receive feedback from Mr. Faris!','Identifikasi Kebutuhan':'Needs Identification','Kedalaman Empati':'Depth of Empathy','Ketepatan Waktu':'Timeliness',
    'Bagaimana KPI Dihitung?':'How Is KPI Calculated?','Peserta':'Participant','Path':'Track','Total Score':'Total Score','Trend':'Trend','Posisi kamu saat ini':'Your current position','Rata-rata nilai dari mentor':'Average score from mentors','Kreativitas & orisinalitas solusi':'Creativity and originality of solutions','Streak, early submission, partisipasi':'Streak, early submission, and participation','tugas & lessons diselesaikan':'assignments and lessons completed','dari minggu lalu':'from last week','peserta lainnya':'other participants','Diperbarui setiap minggu':'Updated weekly',
    'AGENDA PESERTA':'PARTICIPANT SCHEDULE','Lihat jadwal di sini. Tambahkan agenda yang kamu pilih langsung ke Google Calendar.':'View your schedule here and add selected events directly to Google Calendar.','Tombol Google Calendar adalah pilihan utama. File .ics hanya tersedia untuk Apple Calendar, Outlook, atau aplikasi kalender lain.':'Google Calendar is the primary option. The .ics file is available for Apple Calendar, Outlook, and other calendar apps.','Buka link':'Open link','Belum ada agenda mendatang':'No upcoming events','Jadwal baru dari Fasil akan otomatis muncul di sini.':'New events from Fasil will appear here automatically.','KALENDER TERPUSAT':'CENTRAL CALENDAR','Kelola Agenda Program':'Manage Program Events','Pilih agenda untuk mengubahnya, atau buat agenda baru. Perubahan langsung tampil di dashboard peserta.':'Select an event to edit it or create a new one. Changes appear immediately on participant dashboards.','Agenda tersimpan':'Saved events','Belum ada agenda. Buat agenda pertama dari formulir.':'No events yet. Create the first event using the form.','AGENDA BARU':'NEW EVENT','EDIT AGENDA':'EDIT EVENT','Tambah kegiatan program':'Add a program event','Belum disimpan':'Not saved','Data tersimpan':'Saved','Nama kegiatan *':'Event name *','Jenis kegiatan':'Event type','Mulai *':'Starts *','Selesai':'Ends','Lokasi / ruang':'Location / room','Link meeting':'Meeting link','Keterangan':'Description','Peserta dapat membuka kalender di dashboard dan menambahkan agenda tertentu ke Google Calendar tanpa mengunduh file.':'Participants can open the calendar in their dashboard and add individual events to Google Calendar without downloading a file.','Ekspor semua (.ics)':'Export all (.ics)','Mengirim perubahan ke server...':'Sending changes to the server...','Menghapus agenda dari server...':'Deleting the event from the server...','Waktu selesai harus setelah waktu mulai.':'The end time must be after the start time.','Nama dan waktu mulai wajib diisi.':'Event name and start time are required.'
  });
  var LANGUAGE_RENDERED=new WeakMap();
  var LANGUAGE_PATTERNS=[
    [/^(\d+)\s+agenda$/i,'$1 events'],[/^(\d+)\s+tugas pending$/i,'$1 pending assignments'],[/^(\d+)\s+dari\s+(\d+)\s+selesai$/i,'$1 of $2 completed'],[/^(\d+)\s+hari lagi$/i,'$1 days remaining'],[/^(\d+)\s+hari lalu$/i,'$1 days ago'],[/^(\d+)\s+jam lalu$/i,'$1 hours ago'],[/^(\d+)\s+kata$/i,'$1 words'],[/^(\d+)\s+kata ditulis$/i,'$1 words written'],[/^(\d+)\s+peserta$/i,'$1 participants'],[/^(\d+)\s+orang$/i,'$1 people'],[/^Minggu\s+(\d+)\s+dari\s+Bulan\s+(\d+)$/i,'Week $1 of Month $2'],[/^Bulan\s+(\d+)(\s*[·,]\s*)Minggu\s+(\d+)(.*)$/i,'Month $1$2Week $3$4'],[/^Minggu\s+(\d+)(.*)$/i,'Week $1$2'],[/^Bulan\s+(\d+)(.*)$/i,'Month $1$2'],[/^Terbuka:\s*(.*)$/i,'Opens: $1'],[/^Terbuka\s+(.*)$/i,'Opens $1'],[/^Deadline:\s*(.*)$/i,'Deadline: $1'],[/^Dikumpul:\s*(.*)$/i,'Submitted: $1'],[/^Selesai\s+(.*)$/i,'Ends $1'],[/^Mentor:\s*(.*)$/i,'Mentor: $1'],[/^Progress\s+(.*)$/i,'Progress $1']
  ];
  var LANGUAGE_DATE_WORDS={Senin:'Monday',Selasa:'Tuesday',Rabu:'Wednesday',Kamis:'Thursday',Jumat:'Friday',"Jum'at":'Friday',Sabtu:'Saturday',Minggu:'Sunday',Januari:'January',Februari:'February',Maret:'March',April:'April',Mei:'May',Juni:'June',Juli:'July',Agustus:'August',September:'September',Oktober:'October',November:'November',Desember:'December',Jan:'Jan',Feb:'Feb',Mar:'Mar',Apr:'Apr',Jun:'Jun',Jul:'Jul',Ags:'Aug',Sep:'Sep',Okt:'Oct',Nov:'Nov',Des:'Dec'};
  var LANGUAGE_INLINE={'Monitoring Program':'Program Monitoring','Diperbarui real-time':'Updated in real time','Belum ditentukan':'Not assigned','Belum Dikerjakan':'Not started','Menunggu Review':'Awaiting Review','Sudah Dinilai':'Reviewed','Belum dinilai':'Not reviewed','Tidak hadir':'Absent','Tidak aktif':'Inactive','peserta aktif':'active participants','tugas terlambat':'late assignments','kata ditulis':'words written','hari lagi':'days remaining','hari lalu':'days ago','jam lalu':'hours ago'};
  function translateUiText(value){var text=String(value||''),trimmed=text.trim();if(!trimmed)return text;var translated=LANGUAGE_EN[trimmed],prefix='';if(!translated){var prefixed=trimmed.match(/^([^A-Za-zÀ-ÿ0-9"“(]+)(.+)$/u);if(prefixed&&LANGUAGE_EN[prefixed[2]]){prefix=prefixed[1];translated=prefix+LANGUAGE_EN[prefixed[2]];}}if(!translated){for(var i=0;i<LANGUAGE_PATTERNS.length;i++){if(LANGUAGE_PATTERNS[i][0].test(trimmed)){translated=trimmed.replace(LANGUAGE_PATTERNS[i][0],LANGUAGE_PATTERNS[i][1]);break;}}}if(!translated)translated=trimmed;translated=translated.replace(/\bMinggu\s+(\d+)\s+dari\s+Bulan\s+(\d+)\b/gi,'Week $1 of Month $2').replace(/\bBulan\s+(\d+)(\s*[·,]\s*)Minggu\s+(\d+)\b/gi,'Month $1$2Week $3').replace(/\bMinggu\s+(?=\d)/gi,'Week ').replace(/\bBulan\s+(?=\d)/gi,'Month ');Object.keys(LANGUAGE_DATE_WORDS).sort(function(a,b){return b.length-a.length;}).forEach(function(word){translated=translated.replace(new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','g'),LANGUAGE_DATE_WORDS[word]);});Object.keys(LANGUAGE_INLINE).sort(function(a,b){return b.length-a.length;}).forEach(function(phrase){translated=translated.split(phrase).join(LANGUAGE_INLINE[phrase]);});return text.replace(trimmed,translated);}
  function applyLanguage(root){if(LANGUAGE_BUSY)return;LANGUAGE_BUSY=true;try{var scope=root||document,walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT),nodes=[],node;while((node=walker.nextNode()))nodes.push(node);nodes.forEach(function(textNode){var parent=textNode.parentElement;if(!parent||/^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(parent.tagName)||parent.closest('[data-no-translate]'))return;var current=textNode.nodeValue,last=LANGUAGE_RENDERED.get(textNode);if(!LANGUAGE_ORIGINALS.has(textNode)||(last!==undefined&&current!==last)){LANGUAGE_ORIGINALS.set(textNode,current);}var original=LANGUAGE_ORIGINALS.get(textNode),rendered=UI_LANGUAGE==='en'?translateUiText(original):original;textNode.nodeValue=rendered;LANGUAGE_RENDERED.set(textNode,rendered);});$all('input,textarea,select,option,button,[aria-label],[title]',scope).forEach(function(element){['placeholder','aria-label','title'].forEach(function(attr){if(!element.hasAttribute(attr))return;var key='ftgId'+attr.replace(/-([a-z])/g,function(_,c){return c.toUpperCase();}).replace(/^./,function(c){return c.toUpperCase();}),renderedKey='ftgRendered'+key.slice(5),current=element.getAttribute(attr),last=element.dataset[renderedKey];if(!element.dataset[key]||(last!==undefined&&current!==last))element.dataset[key]=current;var original=element.dataset[key],rendered=UI_LANGUAGE==='en'?translateUiText(original):original;element.setAttribute(attr,rendered);element.dataset[renderedKey]=rendered;});if(element.tagName==='OPTION'){if(!element.dataset.ftgIdText)element.dataset.ftgIdText=element.textContent;element.textContent=UI_LANGUAGE==='en'?translateUiText(element.dataset.ftgIdText):element.dataset.ftgIdText;}if((element.tagName==='INPUT'||element.tagName==='BUTTON')&&/^(submit|button)$/.test(element.type||'')&&element.value){if(!element.dataset.ftgIdValue)element.dataset.ftgIdValue=element.value;element.value=UI_LANGUAGE==='en'?translateUiText(element.dataset.ftgIdValue):element.dataset.ftgIdValue;}});document.documentElement.lang=UI_LANGUAGE;}finally{LANGUAGE_BUSY=false;}}
  window.FTG_I18N={translate:translateUiText,apply:applyLanguage,setLanguage:function(language){UI_LANGUAGE=language==='en'?'en':'id';applyLanguage(document);return UI_LANGUAGE;},getLanguage:function(){return UI_LANGUAGE;}};
  function mountLanguageControl(){var header=$('main header')||$('header');if(!header||byId('ftgLanguageControl'))return;var label=document.createElement('label');label.className='ftg-language-control';label.innerHTML='<i class="fa-solid fa-language"></i><select id="ftgLanguageControl" aria-label="Bahasa / Language"><option value="id">ID</option><option value="en">EN</option></select>';var actions=$('.ftg-header-actions',header)||header.lastElementChild||header;actions.insertBefore(label,actions.firstChild);var select=$('#ftgLanguageControl',label);select.value=UI_LANGUAGE;select.addEventListener('change',function(){UI_LANGUAGE=select.value;localStorage.setItem('ftg-language',UI_LANGUAGE);applyLanguage(document);toast(UI_LANGUAGE==='en'?'Language changed to English':'Bahasa diubah ke Indonesia','🌐');});applyLanguage(document);if(!document.body.getAttribute('data-ftg-language-watch')){document.body.setAttribute('data-ftg-language-watch','1');new MutationObserver(function(records){if(LANGUAGE_BUSY)return;records.forEach(function(record){record.addedNodes.forEach(function(added){if(added.nodeType===1||added.nodeType===3)applyLanguage(added.nodeType===3?added.parentElement:added);});});}).observe(document.body,{childList:true,subtree:true});}}

  function wireGlobalUX() {
    if (document.body.getAttribute('data-ftg-global-ux')) return; document.body.setAttribute('data-ftg-global-ux','1');
    document.addEventListener('click',function(event){var button=event.target.closest&&event.target.closest('button,input[type="submit"]');if(!button||button.disabled)return;USER_ACTION_CONTEXT={at:Date.now(),label:(button.textContent||button.value||button.getAttribute('aria-label')||'perubahan').trim(),button:button};},true);
    document.addEventListener('submit',function(event){var form=event.target,button=event.submitter||(form&&form.querySelector('button[type="submit"],input[type="submit"]'));USER_ACTION_CONTEXT={at:Date.now(),label:(button&&(button.textContent||button.value))||(form&&form.getAttribute('aria-label'))||'mengirim formulir',button:button||null};},true);
    var skip=document.createElement('a');skip.href='#main-content';skip.className='ftg-skip-link';skip.textContent='Lewati ke konten utama';document.body.insertBefore(skip,document.body.firstChild);var main=$('main');if(main)main.id='main-content';
    document.addEventListener('click',function(e){var p=e.target.closest&&e.target.closest('[data-drive-preview]');if(p){e.preventDefault();openDrivePreview(p.getAttribute('data-drive-preview'),p.getAttribute('data-drive-name'),p.getAttribute('data-drive-download'));}});
    document.addEventListener('click',function(e){var link=e.target.closest&&e.target.closest('a[href]');if(!link||e.defaultPrevented||e.button>0||e.ctrlKey||e.metaKey||e.shiftKey||link.target==='_blank'||link.hasAttribute('download'))return;try{var url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname||!/\.html$/.test(url.pathname))return;operationLoader('Membuka halaman','Tampilan berikutnya sedang disiapkan…');}catch(_){}});
    var header=$('main header');if(header&&!$('#ftgGlobalSearch',header)){var b=document.createElement('button');b.id='ftgGlobalSearch';b.type='button';b.className='ftg-global-search';b.setAttribute('aria-label','Cari di platform');b.innerHTML='<i class="fa-solid fa-magnifying-glass"></i><span>Cari</span><kbd>Ctrl K</kbd>';b.addEventListener('click',globalSearchModal);var actions=$all(':scope > div',header).filter(function(group){return !!group.querySelector('[data-design-id*="notif"], .fa-bell');})[0];if(!actions){actions=document.createElement('div');actions.className='flex items-center gap-4';header.appendChild(actions);}actions.classList.add('ftg-header-actions');actions.insertBefore(b,actions.firstChild);}
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();globalSearchModal();}});
    window.addEventListener('unhandledrejection',function(event){if(Date.now()-USER_ACTION_CONTEXT.at>12000)return;var reason=event.reason instanceof Error?event.reason:new Error(String(event.reason||'Tindakan tidak berhasil'));reportError(reason);});
    window.addEventListener('error',function(event){if(Date.now()-USER_ACTION_CONTEXT.at>12000||!event.error)return;reportError(event.error);});
  }

  /* ---------- Boot ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.getRegistrations().then(function(registrations){registrations.forEach(function(registration){registration.unregister();});}).catch(function(){});
    if ('caches' in window) caches.keys().then(function(keys){keys.filter(function(key){return key.indexOf('ftg-v')===0;}).forEach(function(key){caches.delete(key);});}).catch(function(){});
  }
  /* Render halaman dari data yang ada sekarang — dipanggil segera, tanpa
     menunggu server, supaya semua tombol langsung bisa diklik. */
  function renderPage() {
    try { runAutomatedReminders(); } catch (e) { console.warn(e); }
    try { wireNav(); } catch (e) { console.warn(e); }
    try { initMobileNav(); } catch (e) { console.warn(e); }
    try { wireBell(); } catch (e) { console.warn(e); }
    try {
      if (PAGE.indexOf('mentee-dashboard') === 0) initMenteeDashboard();
      else if (PAGE.indexOf('design-thinking') === 0) initDesignThinking();
      else if (PAGE.indexOf('assignment-submission') === 0) initAssignment();
      else if (/^(mentor-dashboard|mentor-mentee|mentor-review)/.test(PAGE)) initMentorDashboard();
      else if (PAGE.indexOf('mentor-feedback') === 0) initMentorFeedback();
      else if (PAGE.indexOf('kpi-leaderboard') === 0) initRealLeaderboard();
      else if (PAGE.indexOf('workshop-library') === 0) initWorkshopLibrary();
      else if (PAGE.indexOf('progress-tracker') === 0) initProgressTracker();
      else if (PAGE.indexOf('closing-ceremony') === 0) initClosing();
      else if (PAGE.indexOf('jurnal') === 0) initJournal();
      else if (PAGE.indexOf('admin-dashboard') === 0) initAdminDashboard();
    } catch (e) { console.error('FTG init error:', e); }
    try { personalize(); } catch (e) { console.warn(e); }
    try { updateStreakUI(); } catch (e) { console.warn(e); }
    try { if (/^(mentor-dashboard|mentor-mentee)/.test(PAGE)) insertActivityFeed(); } catch (e) { console.warn(e); }
    try { if (PAGE.indexOf('mentee-dashboard') === 0) { insertSessionCard(); unlockDefinerBadges(); insertMenteeActivity(); } } catch (e) { console.warn(e); }
    try { mountMentorAssignmentManager(); } catch (e) { console.warn(e); }
    try { mountMenteeAssignments(); } catch (e) { console.warn(e); }
    try { mountMenteeWorkCenter(); } catch (e) { console.warn(e); }
    try { mountMentorOperations(); mountMentorLearningMonitor(); } catch (e) { console.warn(e); }
    try { mountMentorGooglePanel(); } catch (e) { console.warn(e); }
    try { mountAdminOperations(); } catch (e) { console.warn(e); }
    try { mountMenteeProgramSuite(); mountUpcomingEvents(); upgradeMenteeCalendar(); } catch (e) { console.warn(e); }
    try { mountMenteeAnnouncementBoard(); } catch (e) { console.warn(e); }
    try { mountAdminDiscipline(); } catch (e) { reportError(e); }
    try { mountSecureAccountAdmin(); } catch (e) { reportError(e); }
    try { mountAdminInsights(); } catch (e) { reportError(e); }
    try { wireGlobalUX(); mountProfileControl(); mountLanguageControl(); mountOnboarding(); } catch (e) { reportError(e); }
    try { if (PAGE.indexOf('assignment-submission') === 0) insertAssignmentSide(); } catch (e) { console.warn(e); }
    try { if (PAGE.indexOf('mentor-feedback') === 0) insertFeedbackSide(); } catch (e) { console.warn(e); }
    try { if (PAGE.indexOf('progress-tracker') === 0) { unlockDefinerBadges(); insertPrintButton(); insertTargetsCard(); } } catch (e) { console.warn(e); }
    try { if (PAGE.indexOf('mentor-review') === 0) insertRekapButton(); } catch (e) { console.warn(e); }
    try { mountGoogleGate(); } catch (e) { console.warn(e); }
  }

  /* ---------- Tanggal hidup: workshop & deadline mengikuti hari ini ---------- */
  function nextWeekday(dow) { // 5 = Jumat, 6 = Sabtu
    var d = new Date();
    var diff = (dow - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return new Date(d.getTime() + diff * 86400000);
  }
  function daysTo(d) { return Math.max(1, Math.ceil((d - new Date()) / 86400000)); }
  function fmtID(d, short) {
    return d.toLocaleDateString('id-ID', short
      ? { weekday: 'long', day: 'numeric', month: 'short' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function liveDates() {
    var sabtu = nextWeekday(6), jumat = nextWeekday(5);
    var repl = {
      'Sabtu, 5 Juli 2026': fmtID(sabtu),
      '5 Juli 2026': fmtID(sabtu),
      'Sabtu, 5 Juli': fmtID(sabtu, true),
      '18 hari lagi': daysTo(sabtu) + ' hari lagi',
      "Jum'at, 20 Juni 2026": fmtID(jumat),
      "Jum'at, 20 Jun": fmtID(jumat, true),
      '3 hari lagi': daysTo(jumat) + ' hari lagi',
      'Deadline: Jum’at': 'Deadline: ' + fmtID(jumat, true)
    };
    $all('main span, main p, main h3').forEach(function (el) {
      if (el.children.length > 1) return;
      var t = el.textContent;
      Object.keys(repl).forEach(function (k) {
        if (t.indexOf(k) > -1) { el.textContent = t.replace(k, repl[k]); t = el.textContent; }
      });
    });
  }

  /* ---------- Angka statistik menghitung naik saat muncul ---------- */
  function countUpStats() {
    if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    $all('main p.text-2xl, main p.text-3xl').forEach(function (p) {
      var m = /^(\d{1,3})(%?)$/.exec(p.textContent.trim());
      if (!m) return;
      var target = +m[1], suf = m[2];
      if (!target) return;
      var steps = 14, i = 0;
      var iv = setInterval(function () {
        i++;
        p.textContent = Math.round(target * (i / steps)) + suf;
        if (i >= steps) { p.textContent = target + suf; clearInterval(iv); }
      }, 38);
    });
  }

  /* bar progres mengalir dari 0 ke nilainya saat halaman terbuka */
  function animateBars() {
    if (!window.matchMedia || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    $all('main .h-2 > div, main .h-1\\.5 > div, main .progress-bar').forEach(function (bar) {
      var w = bar.style.width;
      if (!w || w === '0%') return;
      bar.style.transformOrigin = 'left center';
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
      setTimeout(function () {
        bar.style.transition = '';
        bar.style.transform = 'scaleX(1)';
      }, 80);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!guardSession()) return;
    initSupabase();
    var authReady = false;
    bindS();
    // identitas sidebar & menu peran diganti SEKETIKA — tidak ada kilasan "Arya"
    try { personalize(); } catch (e) { console.warn(e); }
    finally { document.documentElement.classList.add('ftg-role-ready'); }
    try { primeNavHrefs(); } catch (e) { console.warn(e); }

    /* Hybrid render: beri server maks. 900ms untuk data segar (tanpa kedip
       reload), lebih dari itu render data lokal — tombol tetap cepat aktif. */
    // loading bar tipis selama menunggu data server
    var loadbar = null;
    if (IS_APP_PAGE && sb) {
      loadbar = document.createElement('div');
      loadbar.className = 'ftg-loadbar';
      document.body.appendChild(loadbar);
    }

    var rendered = false;
    function renderOnce() {
      if (rendered || !authReady) return;
      rendered = true;
      if (loadbar) setTimeout(function () { loadbar.remove(); }, 250);
      bindS();
      renderPage();
      try { liveDates(); } catch (e) { console.warn(e); }
      try { showConnBadge(); } catch (e) { console.warn(e); }
      try { animateBars(); } catch (e) { console.warn(e); }
      try { countUpStats(); } catch (e) { console.warn(e); }
      try { startRealtime(); } catch (e) { console.warn(e); }
      try { startPresence(); } catch (e) { console.warn(e); }
    }
    var t = setTimeout(renderOnce, 900);
    remoteLoad().then(function () { clearTimeout(t); renderOnce(); });
    ensureSecureSession().then(function (allowed) {
      if (!allowed) return;
      document.documentElement.classList.add('ftg-auth-ready');
      authReady = true;
      renderOnce();
    });
  });
})();
