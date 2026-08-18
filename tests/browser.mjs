import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE_URL = (process.env.FTG_BASE_URL || 'https://ftg-fellowship.vercel.app').replace(/\/$/, '');
const CHROME = process.env.FTG_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS = path.resolve('artifacts', 'ui-qa');
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

const publicPages = process.env.FTG_PUBLIC_PAGES
  ? process.env.FTG_PUBLIC_PAGES.split(',').map(value => value.trim()).filter(Boolean)
  : ['login.html', 'donor-programs.html', 'donor-program.html', 'donor-dashboard.html'];
const roles = [
  {
    name: 'mentee',
    email: process.env.FTG_MENTEE_EMAIL,
    password: process.env.FTG_MENTEE_PASSWORD,
    pages: ['mentee-dashboard.html', 'assignment-submission.html', 'design-thinking-module.html', 'workshop-library.html', 'progress-tracker.html', 'jurnal.html', 'mentor-feedback.html', 'kpi-leaderboard.html']
  },
  {
    name: 'mentor',
    email: process.env.FTG_MENTOR_EMAIL,
    password: process.env.FTG_MENTOR_PASSWORD,
    pages: ['mentor-dashboard.html', 'mentor-mentee.html', 'mentor-review.html']
  },
  {
    name: 'admin',
    email: process.env.FTG_ADMIN_EMAIL,
    password: process.env.FTG_ADMIN_PASSWORD,
    pages: ['admin-dashboard.html', 'admin-program.html', 'admin-akun.html', 'kpi-leaderboard.html']
  }
];

await fs.mkdir(ARTIFACTS, { recursive: true });

function ignoreConsole(text) {
  return /favicon|ERR_BLOCKED_BY_CLIENT|google-analytics|fonts\.gstatic/i.test(text);
}

async function inspectPage(page, label, viewport) {
  const errors = [];
  const onConsole = message => {
    if (message.type() === 'error' && !ignoreConsole(message.text())) errors.push(`console: ${message.text()}`);
  };
  const onPageError = error => errors.push(`pageerror: ${error.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const audit = await page.evaluate(() => {
    const rgba = value => {
      const match = String(value).match(/[\d.]+/g);
      if (!match || match.length < 3) return null;
      return { r: +match[0], g: +match[1], b: +match[2], a: match[3] === undefined ? 1 : +match[3] };
    };
    const blend = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1
    });
    const luminance = color => {
      const channel = value => {
        const unit = value / 255;
        return unit <= .03928 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4;
      };
      return .2126 * channel(color.r) + .7152 * channel(color.g) + .0722 * channel(color.b);
    };
    const contrast = (one, two) => {
      const a = luminance(one), b = luminance(two);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const background = element => {
      let node = element;
      let current = { r: 255, g: 255, b: 255, a: 1 };
      const layers = [];
      while (node && node.nodeType === 1) {
        const style = getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== 'none') return null;
        const layer = rgba(style.backgroundColor);
        if (layer && layer.a > 0) layers.push(layer);
        node = node.parentElement;
      }
      for (let index = layers.length - 1; index >= 0; index -= 1) current = blend(layers[index], current);
      return current;
    };
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    const label = element => String(element.getAttribute('aria-label') || element.textContent || element.id || element.getAttribute('class') || element.tagName).trim().slice(0, 90);
    const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const overflowElements = [...document.querySelectorAll('body *')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { label: label(element), tag: element.tagName, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), html: element.outerHTML.slice(0, 220) };
      })
      .filter(row => row.left < -3 || row.right > document.documentElement.clientWidth + 3)
      .sort((one, two) => two.right - one.right)
      .slice(0, 12);
    const smallText = [...document.querySelectorAll('main p,main small,main label,main time,main span,aside p,aside small,aside span,.donor-shell p,.donor-shell small,.donor-shell span,.investor-shell p,.investor-shell small,.investor-shell span,.public-impact-page p,.public-impact-page small,.public-impact-page span')]
      .filter(element => visible(element) && element.textContent.trim() && !element.closest('[aria-hidden="true"]'))
      .map(element => ({ label: label(element), size: parseFloat(getComputedStyle(element).fontSize) }))
      .filter(row => row.size < 11.5)
      .slice(0, 20);
    const undersized = [...document.querySelectorAll('button,[role="button"],input:not([type="hidden"]),select,textarea')]
      .filter(element => {
        if (!visible(element) || element.disabled) return false;
        if (element.matches('input[type="checkbox"],input[type="radio"]')) {
          const wrapper = element.closest('label');
          if (wrapper) {
            const rect = wrapper.getBoundingClientRect();
            if (rect.width >= 44 && rect.height >= 44) return false;
          }
        }
        return true;
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { label: label(element), width: Math.round(rect.width), height: Math.round(rect.height), html: element.outerHTML.slice(0, 240) };
      })
      .filter(row => row.width < 44 || row.height < 44)
      .slice(0, 20);
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(element => ({
      labelled: Boolean(element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')),
      modal: element.getAttribute('aria-modal') === 'true'
    }));
    const lowContrast = [...document.querySelectorAll('p,small,label,time,button,a,span')]
      .filter(element => visible(element) && !element.closest('[aria-hidden="true"]') && !(element.textContent.trim() === '×' && element.parentElement && element.parentElement.querySelectorAll('img').length >= 2) && [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
      .map(element => {
        const style = getComputedStyle(element), bg = background(element), color = rgba(style.color);
        if (!bg || !color) return null;
        const effective = blend(color, bg);
        const size = parseFloat(style.fontSize), weight = parseInt(style.fontWeight, 10) || 400;
        const minimum = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        return { label: label(element), ratio: +contrast(effective, bg).toFixed(2), minimum, foreground: style.color, background: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`, html: element.outerHTML.slice(0, 180) };
      })
      .filter(row => row && row.ratio + .05 < row.minimum)
      .slice(0, 20);
    return { overflow, overflowElements, smallText, undersized, dialogs, lowContrast };
  });

  await page.screenshot({ path: path.join(ARTIFACTS, `${label}-${viewport.name}.png`), fullPage: true });
  page.off('console', onConsole);
  page.off('pageerror', onPageError);

  assert.ok(audit.overflow <= 2, `${label}/${viewport.name}: horizontal overflow ${audit.overflow}px ${JSON.stringify(audit.overflowElements)}`);
  assert.deepEqual(audit.smallText, [], `${label}/${viewport.name}: unreadable text ${JSON.stringify(audit.smallText)}`);
  assert.deepEqual(audit.undersized, [], `${label}/${viewport.name}: undersized controls ${JSON.stringify(audit.undersized)}`);
  assert.deepEqual(audit.lowContrast, [], `${label}/${viewport.name}: contrast failures ${JSON.stringify(audit.lowContrast)}`);
  assert.ok(audit.dialogs.every(dialog => dialog.labelled && dialog.modal), `${label}/${viewport.name}: dialog semantics incomplete`);
  assert.deepEqual(errors, [], `${label}/${viewport.name}: runtime errors ${errors.join(' | ')}`);
}

async function injectLocalStyles(page, pageName) {
  if (process.env.FTG_LOCAL_STYLES !== '1') return;
  const stylesheet = pageName.startsWith('donor-') ? 'donor.css' : 'responsive.css';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded');
      await page.addStyleTag({ path: path.resolve(stylesheet) });
      return;
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') || attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }
}

async function installLocalAssets(page) {
  if (process.env.FTG_LOCAL_ASSETS !== '1') return;
  const app = await fs.readFile(path.resolve('app.js'), 'utf8');
  const responsive = await fs.readFile(path.resolve('responsive.css'), 'utf8');
  await page.route('**/app.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: app }));
  await page.route('**/responsive.css*', route => route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: responsive }));
}

async function login(page, role) {
  await page.goto(`${BASE_URL}/login.html#role=${role.name}`, { waitUntil: 'domcontentloaded' });
  if (role.name === 'mentor') await page.locator('#tabMentor').click();
  await page.locator('#email').fill(role.email);
  await page.locator('#password').fill(role.password);
  await page.locator('#btnLogin').click();
  await page.waitForURL(url => !url.pathname.endsWith('/login.html'), { timeout: 25_000 });
}

async function exerciseMetricDialog(page) {
  const trigger = page.locator('[data-metric]').first();
  if (!await trigger.count()) return;
  await trigger.focus();
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible' });
  assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'metric detail must be a modal dialog');
  assert.ok(await dialog.getAttribute('aria-label') || await dialog.getAttribute('aria-labelledby'), 'metric dialog needs an accessible name');
  assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'focus must move into the opened dialog');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate(node => node === document.activeElement), 'focus must return to the dialog trigger');
}

async function exerciseAdminDialog(page) {
  const trigger = page.locator('#adminAssignmentMonitor');
  await trigger.waitFor({ state: 'visible', timeout: 10_000 });
  await trigger.focus();
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  assert.equal(await dialog.getAttribute('aria-modal'), 'true', 'admin workspace must open as a modal dialog');
  assert.ok(await dialog.getAttribute('aria-label') || await dialog.getAttribute('aria-labelledby'), 'admin dialog needs an accessible name');
  assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'admin dialog must receive focus');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate(node => node === document.activeElement), 'focus must return to the admin action');
}

async function exerciseMenteeCalendar(page) {
  const trigger = page.locator('[data-mentee-calendar]');
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  assert.equal(await trigger.getAttribute('href'), '#', 'mentee calendar must open in the LMS instead of downloading a file');
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.ftg-calendar-view').waitFor({ state: 'visible' });
  const eventCount = await page.locator('.ftg-calendar-view-list article').count();
  if (eventCount) {
    const googleLink = page.locator('.ftg-calendar-view-actions a[href^="https://calendar.google.com/calendar/render"]').first();
    assert.ok(await googleLink.count(), 'calendar event must provide a Google Calendar action');
  } else {
    assert.ok(await page.locator('.ftg-calendar-empty').count(), 'empty calendar must explain that no event is scheduled');
  }
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

async function exerciseAdminCalendar(page) {
  const trigger = page.locator('#adminCalendar');
  await trigger.waitFor({ state: 'visible', timeout: 15_000 });
  await trigger.click();
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  await page.locator('.ftg-event-manager').waitFor({ state: 'visible' });
  const firstEvent = page.locator('[data-event-edit]').first();
  if (await firstEvent.count()) {
    await firstEvent.click();
    assert.ok(await page.locator('#eventId').inputValue(), 'selecting an event must enter edit mode');
    assert.match(await page.locator('#eventSave').textContent(), /Simpan Perubahan|Save Changes/);
    await page.locator('#eventDelete').waitFor({ state: 'visible' });
  }
  await page.locator('#eventNew').click();
  assert.equal(await page.locator('#eventId').inputValue(), '', 'new event action must reset edit mode');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

const languageExpectations = {
  'admin-dashboard.html': [['Monitoring Program','Program Monitoring'],['Mentee Online Sekarang','Mentees Online Now'],['Aktivitas Program','Program Activity']],
  'admin-program.html': [['Pusat Operasi Program','Program Operations Center'],['Operasional program tanpa berpindah dashboard','Run the program from one dashboard'],['Pembelajaran','Learning'],['Kegiatan & peserta','Activities & participants']],
  'admin-akun.html': [['Semua Akun','All Accounts'],['Ringkasan Peran','Role Summary'],['Cara Kerja Akun','How Accounts Work']],
  'mentee-dashboard.html': [['Tantangan Minggu Ini','This Week’s Challenges'],['Mentor Kamu','Your Mentor'],['Lanjut Belajar','Continue Learning']],
  'assignment-submission.html': [['Instruksi Tugas:','Assignment Instructions:'],['Riwayat Pengiriman','Submission History'],['Simpan Draft','Save Draft']],
  'design-thinking-module.html': [['Perjalanan 4 Minggu','Four-Week Journey'],['Simpan Progres','Save Progress'],['Apa yang perlu dikumpulkan:','What to submit:']],
  'workshop-library.html': [['Semua peserta hadir workshop yang sama','All participants attend the same workshop'],['Mulai Pre-Work','Start Pre-Work']],
  'progress-tracker.html': [['Keseluruhan Program (3 Bulan)','Overall Program (3 Months)'],['Stats Minggu Ini','This Week’s Stats']],
  'mentor-dashboard.html': [['Antrian Review','Review Queue'],['Aksi Cepat','Quick Actions'],['Kirim Pesan Grup','Send Group Message']],
  'mentor-mentee.html': [['Kirim Pesan Grup','Send Group Message'],['Perlu perhatian','Needs attention']],
  'mentor-review.html': [['Ringkasan Review','Review Summary'],['Panduan Menilai','Assessment Guide'],['Bobot Penilaian','Assessment Weights']],
  'mentor-feedback.html': [['Rangkuman Penilaian','Assessment Summary'],['Yang Perlu Diperbaiki:','Areas to Improve:']],
  'kpi-leaderboard.html': [['Bagaimana KPI Dihitung?','How Is KPI Calculated?'],['Posisi kamu saat ini','Your current position']]
};

async function auditLanguageRoundTrip(page, pageName) {
  const expected = languageExpectations[pageName];
  if (!expected) return;
  const control = page.locator('#ftgLanguageControl');
  await control.waitFor({ state: 'visible', timeout: 15_000 });
  await control.selectOption('en');
  await page.waitForTimeout(250);
  let bodyText = await page.locator('body').innerText();
  for (const [indonesian, english] of expected) {
    assert.ok(bodyText.includes(english), `${pageName}: English UI is missing "${english}"`);
    assert.ok(!bodyText.includes(indonesian), `${pageName}: Indonesian UI remained after switching to English: "${indonesian}"`);
  }
  await control.selectOption('id');
  await page.waitForTimeout(250);
  bodyText = await page.locator('body').innerText();
  for (const [indonesian] of expected) assert.ok(bodyText.includes(indonesian), `${pageName}: Indonesian UI did not restore "${indonesian}"`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await installLocalAssets(page);
    for (const pageName of publicPages) {
      await page.goto(`${BASE_URL}/${pageName}`, { waitUntil: 'domcontentloaded' });
      await injectLocalStyles(page, pageName);
      if (pageName === 'donor-dashboard.html') {
        await page.waitForTimeout(1500);
        await exerciseMetricDialog(page);
      }
      await inspectPage(page, pageName.replace('.html', ''), viewport);
    }
    await context.close();
  }

  for (const role of roles) {
    if (!role.email || !role.password) {
      console.log(`SKIP ${role.name}: set FTG_${role.name.toUpperCase()}_EMAIL and FTG_${role.name.toUpperCase()}_PASSWORD for authenticated QA.`);
      continue;
    }
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await installLocalAssets(page);
      await login(page, role);
      for (const pageName of role.pages) {
        await page.goto(`${BASE_URL}/${pageName}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await injectLocalStyles(page, pageName);
        if (role.name === 'mentee' && pageName === 'mentee-dashboard.html') await exerciseMenteeCalendar(page);
        if (role.name === 'admin' && pageName === 'admin-program.html') {
          await exerciseAdminDialog(page);
          await exerciseAdminCalendar(page);
        }
        await auditLanguageRoundTrip(page, pageName);
        await inspectPage(page, `${role.name}-${pageName.replace('.html', '')}`, viewport);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`Browser QA passed against ${BASE_URL}. Screenshots: ${ARTIFACTS}`);
