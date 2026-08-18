import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE_URL = (process.env.FTG_BASE_URL || 'https://ftg-fellowship.vercel.app').replace(/\/$/, '');
const CHROME = process.env.FTG_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EMAIL = process.env.FTG_ADMIN_EMAIL;
const PASSWORD = process.env.FTG_ADMIN_PASSWORD;
const ARTIFACTS = path.resolve('artifacts', 'admin-actions');
assert.ok(EMAIL && PASSWORD, 'Set FTG_ADMIN_EMAIL and FTG_ADMIN_PASSWORD');
await fs.mkdir(ARTIFACTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
if (process.env.FTG_LOCAL_ASSETS === '1') {
  const [app, responsive, tailwind] = await Promise.all([
    fs.readFile(path.resolve('app.js'), 'utf8'),
    fs.readFile(path.resolve('responsive.css'), 'utf8'),
    fs.readFile(path.resolve('tailwind-static.css'), 'utf8')
  ]);
  await context.route('**/*.html*', async route => {
    const file = path.basename(new URL(route.request().url()).pathname);
    try {
      const body = await fs.readFile(path.resolve(file), 'utf8');
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    } catch (_) {
      return route.fallback();
    }
  });
  await context.route('**/app.js*', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: app }));
  await context.route('**/responsive.css*', route => route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: responsive }));
  await context.route('**/tailwind-static.css*', route => route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: tailwind }));
}

async function gotoWithRetry(page, url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(500 * attempt);
    }
  }
  throw lastError;
}

async function login() {
  const page = await context.newPage();
  await gotoWithRetry(page, `${BASE_URL}/login.html#role=admin`);
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#btnLogin').click({ force: true });
  await page.waitForURL(url => !url.pathname.endsWith('/login.html'), { timeout: 30_000 });
  await page.close();
}

const moduleActions = [
  ['adminGlobalTask', '#mentorTaskTitle'],
  ['adminCohort', '[role="dialog"]'],
  ['adminLearning', '[role="dialog"]'],
  ['adminAssignmentMonitor', '#assignmentMonitorCreate'],
  ['adminNotifications', '[role="dialog"]'],
  ['adminDonorPortal', '[role="dialog"]'],
  ['adminInvestorTrust', '[role="dialog"]'],
  ['adminAnnouncements', '#announcementNew'],
  ['adminWorkshopSchedule', '#workshopManagerSave'],
  ['adminRecordings', '[role="dialog"]'],
  ['adminTracks', '[role="dialog"]'],
  ['adminSettings', '[role="dialog"]'],
  ['adminRubrics', '[role="dialog"]'],
  ['adminCalendar', '#eventNew'],
  ['adminAttendance', '#attCreate'],
  ['adminCertificates', '[role="dialog"]'],
  ['adminHealth', '[role="dialog"]'],
  ['adminAudit', '[role="dialog"]']
];

const nestedActions = [
  ['adminAssignmentMonitor', '#assignmentMonitorCreate', '#mentorTaskTitle'],
  ['adminAnnouncements', '#announcementNew', '#announcementEditor'],
  ['adminCalendar', '#eventNew', '#eventManagerForm']
];

async function freshPage(pageName) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !/favicon|ERR_BLOCKED_BY_CLIENT|google-analytics/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  let ready = false;
  let lastError;
  for (let attempt = 1; attempt <= 3 && !ready; attempt += 1) {
    await gotoWithRetry(page, `${BASE_URL}/${pageName}`);
    if (new URL(page.url()).pathname.endsWith('/login.html')) await login();
    try {
      await page.locator('#ftgLanguageControl').waitFor({ state: 'visible', timeout: 20_000 });
      ready = true;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(500 * attempt);
    }
  }
  if (!ready) throw lastError;
  return { page, errors };
}

async function heartbeat(page, label) {
  const started = Date.now();
  const result = await Promise.race([
    page.evaluate(() => ({ now: performance.now(), modalCount: document.querySelectorAll('.ftg-modal-ov.is-visible').length })),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: browser main thread did not answer within 2 seconds`)), 2_000))
  ]);
  assert.ok(Date.now() - started < 2_200, `${label}: main-thread heartbeat was too slow`);
  return result;
}

async function closeDialog(page) {
  const active = page.locator('.ftg-modal-ov.is-visible').last();
  if (await active.count()) await active.locator('.ftg-modal-close').click();
  await page.locator('.ftg-modal-ov.is-visible').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.locator('.ftg-operation-loading.is-visible').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(250);
}

async function testModule(id, expected) {
  const { page, errors } = await freshPage('admin-program.html');
  try {
    const trigger = page.locator(`#${id}`);
    await trigger.waitFor({ state: 'visible', timeout: 20_000 });
    await trigger.click({ timeout: 5_000 });
    await page.locator('.ftg-modal-ov.is-visible').last().waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator(expected).last().waitFor({ state: 'visible', timeout: 30_000 });
    const state = await heartbeat(page, id);
    assert.equal(state.modalCount, 1, `${id}: expected exactly one visible modal`);
    assert.deepEqual(errors, [], `${id}: ${errors.join(' | ')}`);
    console.log(`PASS module ${id}`);
  } catch (error) {
    await page.screenshot({ path: path.join(ARTIFACTS, `${id}-failed.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function testNested(parent, child, expected) {
  const { page, errors } = await freshPage('admin-program.html');
  try {
    await page.locator(`#${parent}`).click();
    await page.locator('.ftg-modal-ov.is-visible').last().waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator(child).waitFor({ state: 'visible', timeout: 30_000 });
    await page.locator(child).click({ timeout: 5_000 });
    await page.locator(expected).waitFor({ state: 'visible', timeout: 10_000 });
    const state = await heartbeat(page, `${parent} -> ${child}`);
    assert.equal(state.modalCount, 1, `${parent} -> ${child}: nested action must not stack modal layers`);
    assert.deepEqual(errors, [], `${parent} -> ${child}: ${errors.join(' | ')}`);
    console.log(`PASS nested ${parent} -> ${child}`);
  } catch (error) {
    await page.screenshot({ path: path.join(ARTIFACTS, `${parent}-nested-failed.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

async function testAccounts() {
  const { page, errors } = await freshPage('admin-akun.html');
  try {
    for (const id of ['btnAddMentee', 'btnAddMentor']) {
      await page.locator(`#${id}`).click();
      await page.locator('[role="dialog"]').last().waitFor({ state: 'visible', timeout: 10_000 });
      await heartbeat(page, id);
      await closeDialog(page);
    }
    const manage = page.locator('[data-secure-manage]').first();
    if (await manage.count()) {
      await manage.click();
      await page.locator('[role="dialog"]').last().waitFor({ state: 'visible', timeout: 10_000 });
      await heartbeat(page, 'manage account');
      await closeDialog(page);
    }
    assert.deepEqual(errors, [], `admin accounts: ${errors.join(' | ')}`);
    console.log('PASS admin accounts actions');
  } finally {
    await page.close();
  }
}

async function testProgramExports() {
  const { page, errors } = await freshPage('admin-program.html');
  try {
    await page.route('**/api/reports?format=*', async route => {
      const format = new URL(route.request().url()).searchParams.get('format');
      if (format === 'xls') return route.fulfill({ status: 200, contentType: 'application/vnd.ms-excel', body: 'qa-export' });
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>FTG QA Report</title><h1>Report ready</h1>' });
    });
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.locator('#adminExcel').click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /laporan-ftg-fellowship\.xls$/i, 'Excel export filename is incorrect');
    await page.locator('#adminExcel[aria-busy="true"]').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

    const popupPromise = context.waitForEvent('page', { timeout: 10_000 });
    await page.locator('#adminPdf').click();
    const report = await popupPromise;
    await report.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => {});
    assert.ok(!report.isClosed(), 'PDF report window closed unexpectedly');
    await report.close();
    await heartbeat(page, 'program exports');
    assert.deepEqual(errors, [], `program exports: ${errors.join(' | ')}`);
    console.log('PASS Excel and PDF report actions');
  } finally {
    await page.close().catch(() => {});
  }
}

async function testAdminHealthActions() {
  const { page, errors } = await freshPage('admin-dashboard.html');
  try {
    await page.route('**/api/backups', async route => {
      const request = route.request();
      if (request.method() === 'POST') {
        const payload = request.postDataJSON();
        assert.equal(payload.action, 'create', 'backup action must request a safe create operation');
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ backups: [] }) });
    });
    await page.locator('#adminHealthCheck').click();
    await page.waitForFunction(() => {
      const value = document.querySelector('#adminHealthResult')?.textContent || '';
      return value && !/Memeriksa layanan/i.test(value);
    }, null, { timeout: 30_000 });
    await page.locator('#adminBackupManage').click();
    await page.getByText('Backup & Pemulihan', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });
    await closeDialog(page);
    await page.locator('#adminBackupCreate').click();
    await page.getByText('Backup aman berhasil dibuat', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });
    await heartbeat(page, 'admin health actions');
    assert.deepEqual(errors, [], `admin health actions: ${errors.join(' | ')}`);
    console.log('PASS health, backup list, and backup button wiring');
  } finally {
    await page.close().catch(() => {});
  }
}

async function testSequentialModules() {
  const { page, errors } = await freshPage('admin-program.html');
  try {
    for (let pass = 1; pass <= 2; pass += 1) {
      for (const [id, expected] of moduleActions) {
        console.log(`CHECK sequential pass ${pass}: ${id}`);
        const trigger = page.locator(`#${id}`);
        await trigger.click({ timeout: 5_000 });
        await page.locator('.ftg-modal-ov.is-visible').last().waitFor({ state: 'visible', timeout: 30_000 });
        await page.locator(expected).last().waitFor({ state: 'visible', timeout: 30_000 });
        await heartbeat(page, `sequential pass ${pass}: ${id}`);
        await closeDialog(page);
        assert.equal(await page.locator('.ftg-modal-ov.is-visible').count(), 0, `${id}: modal layer leaked after close`);
      }
    }
    await heartbeat(page, 'sequential final');
    assert.deepEqual(errors, [], `sequential admin modules: ${errors.join(' | ')}`);
    console.log('PASS sequential admin modules twice in one tab');
  } catch (error) {
    await page.screenshot({ path: path.join(ARTIFACTS, 'sequential-failed.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await page.close().catch(() => {});
  }
}

try {
  await login();
  // Exercise the page-level actions first. Repeatedly creating and destroying
  // more than twenty Edge tabs can itself exhaust renderer resources and does
  // not represent a real Fasil session; module stress coverage is performed
  // below in one persistent tab, twice.
  await testProgramExports();
  await testAdminHealthActions();
  await testAccounts();
  for (const row of nestedActions) await testNested(...row);
  await testSequentialModules();
  console.log(`Admin production action QA passed against ${BASE_URL}.`);
} finally {
  await context.close();
  await browser.close();
}
