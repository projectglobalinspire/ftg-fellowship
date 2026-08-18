# FTG × GI — Future Builders Fellowship 2026

Prototype platform pendampingan 3 bulan **FaithToGrow × Global Inspire** untuk 30 pemuda Bandung.

## Fitur yang berfungsi (prototype interaktif)

- **Login 2 peran** — masuk sebagai Mentee (Arya) atau Mentor (Pak Faris) dari halaman depan.
- **GI Design Thinking Canvas** — isi Niyyah, DEFINE, dan Values-Alignment Matrix; semua tersimpan otomatis (localStorage).
- **Submit Tugas** — penghitung kata refleksi live, lampiran link & file, simpan draft, dan pengumpulan tugas dengan validasi 200 kata.
- **Review Mentor** — tugas yang dikumpulkan mentee langsung muncul di antrian review mentor; mentor memberi skor + feedback lewat modal.
- **Feedback loop** — nilai & feedback dari mentor otomatis muncul di halaman Feedback Mentor, dashboard, dan progress tracker mentee.
- **KPI Leaderboard & Workshop Library** — filter Career / Entrepreneur berfungsi.
- **Countdown live** — hitung mundur Demo Day (31 Agustus 2026) dihitung dari tanggal hari ini.
- **PWA installable** — bisa "Add to Home Screen" di Android/iPhone, terbuka full-screen seperti aplikasi asli, plus offline support (service worker).
- **Confetti 🎉** — saat mentee mengumpulkan tugas dan saat mentor menyimpan penilaian.
- **Grafik tren KPI** — line chart SVG di Progress Tracker, ikut naik setelah tugas dinilai.
- **Sertifikat digital** — pratinjau & unduh PNG sertifikat kelulusan di halaman Closing Ceremony.
- **Responsive semua perangkat** — Android, iPhone, iPad (menu hamburger di layar kecil), dan preview link cantik saat dishare ke WhatsApp/Telegram (Open Graph).



> Akun mentee 2–5 & panitia perlu didaftarkan ke Supabase sekali dengan menjalankan `setup-v2.sql`
> di SQL Editor. Tanpa itu, login tetap berfungsi lewat fallback lokal.

Materi presentasi: `assets/qr-poster.png` (poster QR siap tempel di slide).

## Konten demo yang sudah terisi

Saat pertama dibuka, platform otomatis terisi data realistis milik Arya: niyyah, canvas DEFINE lengkap, Values Matrix 4 kuadran, refleksi 209 kata, lampiran link Google Docs + file PDF, materi pembelajaran W1 & W2 (klik tab minggu), dan leaderboard penuh **30 peserta** dengan mentor masing-masing.

## Alur demo yang disarankan (untuk presentasi)

1. Buka halaman depan → **Masuk sebagai Mentee** — dashboard sudah hidup dengan progres Arya.
2. Buka **Design Thinking** → klik tab **W2** untuk menunjukkan materi belajar → tunjukkan canvas & matrix yang tersimpan otomatis.
3. Buka **Submit Tugas** → refleksi 209 kata sudah siap → klik **Kumpulkan Tugas Minggu 2** 🎉.
4. Keluar → **Masuk sebagai Mentor** → tugas Arya W2 muncul di **Antrian Review** (lengkap dengan refleksinya) → geser skor + tulis feedback → simpan.
5. Keluar → masuk lagi sebagai Mentee → buka **Feedback Mentor**: nilai & komentar mentor sudah masuk, dashboard & progress tracker ikut berubah.

> Reset demo: jalankan `localStorage.clear()` di console browser lalu refresh — konten contoh akan terisi ulang otomatis, siap dipresentasikan lagi.

## Google Drive untuk lampiran tugas

Lampiran tidak disimpan sebagai blob/base64 di Supabase. Database hanya menyimpan metadata, status unggahan, folder tujuan, ID Drive, dan `webViewLink`.

1. Aktifkan **Google Drive API** di project Google Cloud.
2. Konfigurasikan OAuth consent screen. Jika app masih berstatus **Testing**, tambahkan akun Google yang akan dipakai mengunggah sebagai test user.
3. Buat OAuth Client ID bertipe **Web application**.
4. Tambahkan Authorized JavaScript origins berikut (tanpa slash di akhir):
   - `https://ftg-fellowship.vercel.app`
   - `http://localhost:4173`
5. Isi Client ID di `ftg-config.js` pada `driveClientId`.

Pada mode produksi `central`, peserta dan mentor tidak diminta memberikan izin Google Drive pribadi. Berkas diunggah oleh API server ke Drive pusat FTG; browser hanya mengirim berkas bersama sesi FTG yang sah. OAuth pengguna hanya dipakai untuk login identitas dasar. Mode lama `drive.file` tetap tersedia sebagai fallback pengembangan, dengan token berumur pendek yang hanya disimpan di memori tab.

Struktur folder otomatis:

```text
FTG Fellowship 2026/
└── Mentee/
    └── <Nama Mentee>/
        └── Minggu 2/
            └── <berkas>
```

Berkas sampai 20 MB didukung. Berkas di atas 5 MB memakai resumable upload. Jika OAuth belum dikonfigurasi atau izin dibatalkan, UI menandai lampiran sebagai **belum diunggah** dan tidak menyimpan isi berkas ke Supabase.

### Alur akun Google dan akses mentor

- Login FTG menentukan role aplikasi (mentee/mentor/admin).
- Mentee dan mentor menghubungkan akun Google pada awal sesi; token Drive berumur pendek hanya hidup di memori tab.
- Saat mentee mengunggah, aplikasi membuat permission `reader` khusus untuk email Google mentor yang tersimpan di `ftg_users`.
- File tidak dibuat publik. Mentor yang terhubung dapat membuka preview atau mengunduh file dari modal review tugas.
- Jalankan `setup-v3-google.sql` sekali untuk menambahkan kolom koneksi Google.

## Email transaksional Zoho Mail

Email tugas baru, pengingat H-3/H-1/deadline, feedback, dan permintaan revisi dikirim server-side melalui Zoho SMTP. Isi credential hanya pada environment Vercel, jangan di `ftg-config.js` atau browser.

```text
EMAIL_PROVIDER=zoho
ZOHO_SMTP_HOST=smtppro.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_USER=hope@faithtogrow.org
ZOHO_SMTP_APP_PASSWORD=<app password Zoho>
NOTIFICATION_FROM_EMAIL=FTG Fellowship <hope@faithtogrow.org>
NOTIFICATION_REPLY_TO=hope@faithtogrow.org
APP_URL=https://ftg-fellowship.vercel.app
```

Gunakan `smtp.zoho.com` jika Server Configuration pada akun Zoho menunjukkan akun organisasi gratis; gunakan nilai yang ditampilkan Zoho sebagai sumber kebenaran. App password dibuat dari Zoho Accounts → Security → App Passwords saat MFA aktif. Fasil dapat mengirim `{ "action": "email_test" }` ke endpoint `/api/notifications` untuk menguji pengiriman ke email akun Fasil yang sedang login. Semua percobaan tetap dicatat pada `email_outbox`.

## Teknologi

HTML + Tailwind CSS (CDN) + Vanilla JS, dengan Supabase untuk sinkronisasi state dan Google Drive untuk lampiran. `localStorage` dipakai sebagai cache/fallback tampilan, bukan tempat menyimpan isi berkas.

---
FaithToGrow × Global Inspire · Future Builders Fellowship 2026
