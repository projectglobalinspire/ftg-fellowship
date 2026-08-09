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
  driveMode: 'central',
  driveOwnerEmail: 'projectglobalinspire@gmail.com',
  driveRootFolderId: '1n2zMb6_cCe3yRcPuLVLlvUrME5u1QOs7',
  driveRootFolder: 'FTG Fellowship 2026',
  driveMaxFileSizeMb: 20,

  /* Opsional. Jika kosong, email Google mentor diambil dari ftg_users setelah
     Pak Faris menghubungkan akun Google di dashboard mentor. */
  mentorGoogleEmail: ''
};
