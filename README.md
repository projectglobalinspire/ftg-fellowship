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

## Alur demo yang disarankan (untuk presentasi)

1. Buka halaman depan → **Masuk sebagai Mentee**.
2. Buka **Design Thinking** → isi Niyyah + 3 kolom DEFINE + Values Matrix (tersimpan otomatis).
3. Buka **Submit Tugas** → tulis refleksi → **Kumpulkan Tugas Minggu 2** 🎉.
4. Keluar → **Masuk sebagai Mentor** → tugas Arya W2 muncul di **Antrian Review** → beri skor + feedback.
5. Keluar → masuk lagi sebagai Mentee → buka **Feedback Mentor**: nilai & komentar mentor sudah masuk.

> Reset demo: jalankan `localStorage.clear()` di console browser, atau gunakan mode incognito.

## Teknologi

HTML + Tailwind CSS (CDN) + Vanilla JS, data demo di `localStorage` — tanpa backend, siap dihosting statis (Vercel).

---
FaithToGrow × Global Inspire · Future Builders Fellowship 2026
