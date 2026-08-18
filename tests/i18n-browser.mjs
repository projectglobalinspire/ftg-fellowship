import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chrome = process.env.FTG_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const app = await fs.readFile(path.resolve('app.js'), 'utf8');
const fixture = `<!doctype html><html lang="id"><body>
  <main><header><h1>Pusat Program</h1></header>
    <section id="admin"><h2>🏛 Pusat Operasi Program</h2><p>Semua kendali program, peserta, pembelajaran, kehadiran, dan pelaporan.</p><h3>Operasional program tanpa berpindah dashboard</h3><p>Pilih modul di bawah. Setiap aksi membuka ruang kerja ringan dan data dimuat hanya saat diperlukan.</p><span>Pembelajaran</span><span>Kegiatan & peserta</span><span>1/10 Terkumpul</span></section>
    <section id="mentee"><h2>📋 Tantangan Minggu Ini</h2><button>Lanjut Belajar</button><p>3 dari 5 selesai</p><p>4 hari lagi</p></section>
    <section id="mentor"><h2>⏳ Antrian Review</h2><button>Kirim Pesan Grup</button><p>2 hari lalu</p></section>
    <section id="calendar"><h2>Kalender Program</h2><button title="Simpan Perubahan">Simpan Agenda</button><input placeholder="Cari nama atau email..." aria-label="Nama kegiatan *"><select><option>Semua role</option><option>Aktif</option></select></section>
    <p id="date">Selasa, 18 Agustus 2026 · Minggu 2 dari Bulan 1</p>
    <p id="composite">Selasa, 18 Agustus 2026 · Bulan 1, Minggu 2 · Monitoring Program</p>
    <p id="dynamic"></p>
  </main>
</body></html>`;

const server = http.createServer((request, response) => {
  if (request.url === '/app.js') {
    response.writeHead(200, { 'content-type':'application/javascript; charset=utf-8' });
    response.end(app);
    return;
  }
  response.writeHead(200, { 'content-type':'text/html; charset=utf-8' });
  response.end(fixture);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({ executablePath:chrome, headless:true });

try {
  const page = await browser.newPage({ viewport:{ width:390, height:844 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.addScriptTag({ url:`http://127.0.0.1:${port}/app.js` });
  assert.ok(await page.evaluate(() => Boolean(window.FTG_I18N)), 'i18n runtime must be available');

  await page.evaluate(() => window.FTG_I18N.setLanguage('en'));
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  const english = await page.locator('body').innerText();
  for (const expected of ['Program Center','Program Operations Center','All program, participant, learning, attendance, and reporting controls.','Run the program from one dashboard','Learning','Activities & participants','This Week’s Challenges','Continue Learning','3 of 5 completed','4 days remaining','Review Queue','Send Group Message','2 days ago','Program Calendar','Save Event','Tuesday, 18 August 2026 · Week 2 of Month 1']) {
    assert.ok(english.includes(expected), `missing English translation: ${expected}`);
  }
  assert.equal(await page.locator('input').getAttribute('placeholder'), 'Search by name or email...');
  assert.equal(await page.locator('input').getAttribute('aria-label'), 'Event name *');
  assert.equal(await page.locator('button[title]').getAttribute('title'), 'Save Changes');
  assert.equal(await page.locator('select option').first().textContent(), 'All roles');
  assert.equal(await page.locator('#composite').textContent(), 'Tuesday, 18 August 2026 · Month 1, Week 2 · Program Monitoring');

  await page.evaluate(() => {
    const node = document.querySelector('#dynamic');
    node.textContent = '7 hari lagi';
    window.FTG_I18N.apply(node.parentElement);
  });
  assert.equal(await page.locator('#dynamic').textContent(), '7 days remaining');

  await page.evaluate(() => window.FTG_I18N.setLanguage('id'));
  assert.equal(await page.locator('html').getAttribute('lang'), 'id');
  const indonesian = await page.locator('body').innerText();
  for (const expected of ['Pusat Program','Pusat Operasi Program','Pembelajaran','Kegiatan & peserta','Tantangan Minggu Ini','Lanjut Belajar','Antrian Review','Kirim Pesan Grup','Kalender Program','Simpan Agenda','Selasa, 18 Agustus 2026 · Minggu 2 dari Bulan 1','7 hari lagi']) {
    assert.ok(indonesian.includes(expected), `Indonesian text did not restore: ${expected}`);
  }
  assert.equal(await page.locator('input').getAttribute('placeholder'), 'Cari nama atau email...');
  assert.equal(await page.locator('input').getAttribute('aria-label'), 'Nama kegiatan *');
  assert.equal(await page.locator('select option').first().textContent(), 'Semua role');
  assert.equal(await page.locator('#composite').textContent(), 'Selasa, 18 Agustus 2026 · Bulan 1, Minggu 2 · Monitoring Program');

  const dashboardChecks = {
    'admin-dashboard.html':['Monitoring Program','Program Monitoring'],
    'admin-program.html':['Operasional program tanpa berpindah dashboard','Run the program from one dashboard'],
    'admin-akun.html':['Semua Akun','All Accounts'],
    'mentee-dashboard.html':['Tantangan Minggu Ini','This Week’s Challenges'],
    'assignment-submission.html':['Instruksi Tugas:','Assignment Instructions:'],
    'design-thinking-module.html':['Perjalanan 4 Minggu','Four-Week Journey'],
    'workshop-library.html':['Semua peserta hadir workshop yang sama','All participants attend the same workshop'],
    'progress-tracker.html':['Keseluruhan Program (3 Bulan)','Overall Program (3 Months)'],
    'jurnal.html':['Refleksi Hari Ini','Today’s Reflection'],
    'mentor-dashboard.html':['Antrian Review','Review Queue'],
    'mentor-mentee.html':['Kirim Pesan Grup','Send Group Message'],
    'mentor-review.html':['Ringkasan Review','Review Summary'],
    'mentor-feedback.html':['Rangkuman Penilaian','Assessment Summary'],
    'kpi-leaderboard.html':['Bagaimana KPI Dihitung?','How Is KPI Calculated?']
  };
  for (const [file, [indonesian, englishText]] of Object.entries(dashboardChecks)) {
    const html = (await fs.readFile(path.resolve(file), 'utf8'))
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script\b[^>]*\/?\s*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '');
    await page.setContent(html, { waitUntil:'domcontentloaded' });
    await page.addScriptTag({ url:`http://127.0.0.1:${port}/app.js` });
    await page.evaluate(() => window.FTG_I18N.setLanguage('en'));
    const translated = await page.locator('body').innerText();
    assert.ok(translated.includes(englishText), `${file}: missing English UI "${englishText}"`);
    const translatedLines = translated.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    assert.ok(!translatedLines.includes(indonesian), `${file}: Indonesian UI remained after EN switch: "${indonesian}"`);
    await page.evaluate(() => window.FTG_I18N.setLanguage('id'));
    assert.ok((await page.locator('body').innerText()).includes(indonesian), `${file}: Indonesian UI did not restore`);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('ID/EN runtime QA passed, including dynamic content, attributes, options, dates, and round-trip restore.');
