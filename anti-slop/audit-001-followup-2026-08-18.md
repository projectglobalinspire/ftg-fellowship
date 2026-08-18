# Anti-Slop UI/UX Audit 001 — Laporan Tindak Lanjut

Tanggal: 18 Agustus 2026  
Mode: AFTER (remediasi dan verifikasi produksi)  
Scope: Fasil/admin, mentor, mentee, portal investor/donor, login, dialog bersama, desktop, dan mobile.

## Ringkasan

Seluruh temuan 1–10 pada audit awal telah ditangani untuk release ini. Pemeriksaan source lulus 40/40, browser QA produksi lulus pada desktop 1440×900 dan mobile 390×844, dan dialog kritis diuji dengan interaksi keyboard nyata.

## Status Temuan 1–10

| No. | Temuan | Status | Remediasi dan bukti |
|---:|---|---|---|
| 1 | Dialog global belum aksesibel | **PASS** | Primitive modal bersama kini memiliki `role="dialog"`, `aria-modal`, nama aksesibel, fokus awal, focus trap, Escape-to-close, body lock/inert, dukungan stacked dialog, dan pengembalian fokus. Interaksi diuji pada modal metrik investor dan Tugas & Pengumpulan Fasil. |
| 2 | Target sentuh di bawah 44×44 px | **PASS** | Layer kontrol kanonis menetapkan target minimum 44 px pada button, form control, icon action, close, preset, profile action, dan Google Sign-In. Browser gate memeriksa semua kontrol yang terlihat. |
| 3 | Skala teks terlalu kecil | **PASS** | Typography remediation menaikkan teks operasional, label, metadata, onboarding, modal, dan portal publik ke ukuran terbaca. Browser gate menolak teks isi yang masih di bawah ambang 11.5 px. |
| 4 | Kontras gagal WCAG AA | **PASS** | Token muted, hijau, ungu, oranye, tombol putih, workshop card, donor badge, login, onboarding, dan Design Thinking diperbaiki. Gate menghitung computed foreground/background dan ambang 4.5:1 atau 3:1 untuk teks besar. |
| 5 | Judul/aksi dialog dapat tertutup | **PASS** | Modal memakai header/body/footer flow, close action tidak lagi mengandalkan float negatif, area konten dapat scroll, dan action bar tetap terlihat pada desktop/mobile. |
| 6 | Overflow global menyembunyikan cacat layout | **PASS** | Grid dan dialog melakukan reflow, child memakai `min-width:0`, data region yang memang lebar memiliki scroll lokal, dan browser gate menolak horizontal document overflow. Bug progress 200% akibat checklist usang juga diklem ke 0–100%. |
| 7 | Style bertumpuk memicu regresi | **PASS untuk release; refactor modular tersisa** | Satu remediation layer kanonis ditempatkan terakhir, cache version aset diseragamkan, duplikasi perilaku kritis dinetralkan, dan regression gate kini mencegah konflik visual lolos. Pemecahan penuh file CSS/markup lama menjadi modul kecil tetap menjadi pekerjaan maintainability lanjutan dan tidak memblokir rilis. |
| 8 | Toast tidak aksesibel | **PASS** | Notification primitive kini memakai live region `status`/`alert`, durasi sesuai tipe, close button, dan pesan tetap terlihat untuk error. |
| 9 | Motion terlalu luas | **PASS** | Motion global dikurangi ke perubahan state yang bermakna; hover-lift/stagger dekoratif dinonaktifkan dan `prefers-reduced-motion` dihormati. |
| 10 | Belum ada browser/visual regression gate | **PASS** | Ditambahkan `tests/browser.mjs` berbasis Playwright dengan viewport desktop/mobile, runtime/console check, overflow, typography, touch target, contrast, semantic dialog, focus round-trip, dan screenshot produksi. |

## Bukti Verifikasi

### Source dan smoke

- `npm run check`: **40/40 lulus**.
- JavaScript utama dan portal donor lolos syntax check.
- Seluruh halaman memuat aset remediation dengan cache version terbaru.
- `git diff --check`: lulus.

### Browser produksi

Target: `https://ftg-fellowship.vercel.app`

- Publik: login, daftar program, detail program, dashboard investor/donor — desktop dan mobile.
- Mentee: dashboard, tugas/pengumpulan, Design Thinking, Workshop Library — desktop dan mobile.
- Mentor: login dan rute mentor — desktop dan mobile. Akun QA mentor saat ini diarahkan ke onboarding wajib karena profilnya belum lengkap; gate login/onboarding tetap lulus.
- Fasil: monitoring, Pusat Program, Kelola Akun — desktop dan mobile.
- Dialog investor: open, accessible name, focus masuk, Escape, focus kembali.
- Dialog Tugas & Pengumpulan Fasil: open, accessible name, focus masuk, Escape, focus kembali.
- Tidak ada horizontal document overflow, kontrol aktif di bawah 44 px, teks isi terlalu kecil, kegagalan kontras terdeteksi, atau runtime error pada matriks tersebut.

Screenshot hasil browser QA tersimpan lokal di `artifacts/ui-qa/` dan sengaja tidak dimasukkan ke Git.

## Commit Remediasi

- `e93e437` — Harden UI accessibility and browser QA
- `f37de12` — Improve login contrast for production QA
- `fd73747` — Complete anti-slop accessibility remediation
- `f66080c` — Clamp task progress and preserve dialog focus
- `61daa0b` — Normalize profile action touch target
- `a7398ae` — Apply accessible typography to profile onboarding
- `5746152` — Finish Design Thinking contrast remediation
- `869a234` — Meet touch target standard on Google login

## Delivery Gate

- Desktop web: **PASS**
- Mobile 390 px: **PASS**
- Reflow dan horizontal overflow: **PASS**
- Touch target: **PASS**
- Typography dan contrast: **PASS**
- Keyboard, focus, dan dialog semantics: **PASS**
- Loading/error/status feedback: **PASS**
- Reduced motion: **PASS**
- Browser runtime dan console: **PASS**
- Static smoke suite: **PASS (40/40)**

Status keseluruhan: **PASS — temuan 1–10 selesai untuk release produksi ini.**
