/* Konfigurasi backend Supabase — publishable key memang aman di client
   (akses data dibatasi Row Level Security di sisi server). */
window.FTG_CONF = {
  url: 'https://sluozhitkhlhzrxwoaho.supabase.co',
  anonKey: 'sb_publishable_WYMTRQuoPsGFMIKsHLxBCA_HMczXkfr',

  /* Google Drive — tempat menyimpan berkas tugas (bukan di database, agar ringan).
     Isi dengan OAuth Client ID milik projectglobalinspire@gmail.com.
     Struktur folder dibuat otomatis:
       FTG Fellowship 2026 / Mentee / <Nama Mentee> / Minggu <N> / <berkas>
     Selama kosong, berkas hanya dicatat namanya (tidak diunggah). */
  driveClientId: '916717961665-f05tp163cvq5vf04iljr1b29dkumfohh.apps.googleusercontent.com',
  driveRootFolder: 'FTG Fellowship 2026',
  driveMaxFileSizeMb: 20
};
