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
    pages: ['mentee-dashboard.html', 'assignment-submission.html', 'design-thinking-module.html', 'workshop-library.html']
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
    pages: ['admin-dashboard.html', 'admin-program.html', 'admin-akun.html']
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
        return { label: label(element), width: Math.round(rect.width), height: Math.round(rect.height) };
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
        return { label: label(element), ratio: +contrast(effective, bg).toFixed(2), minimum, html: element.outerHTML.slice(0, 180) };
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

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
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
      await login(page, role);
      for (const pageName of role.pages) {
        await page.goto(`${BASE_URL}/${pageName}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await injectLocalStyles(page, pageName);
        if (role.name === 'admin' && pageName === 'admin-program.html') await exerciseAdminDialog(page);
        await inspectPage(page, `${role.name}-${pageName.replace('.html', '')}`, viewport);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`Browser QA passed against ${BASE_URL}. Screenshots: ${ARTIFACTS}`);
