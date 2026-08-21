import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const chrome = process.env.FTG_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const pages = [
  'mentee-dashboard.html', 'assignment-submission.html', 'design-thinking-module.html',
  'workshop-library.html', 'progress-tracker.html', 'jurnal.html', 'mentor-feedback.html',
  'kpi-leaderboard.html', 'mentor-dashboard.html', 'mentor-mentee.html', 'mentor-review.html',
  'admin-dashboard.html', 'admin-program.html', 'admin-akun.html'
];
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844 }];
const [tailwind, responsive] = await Promise.all([
  fs.readFile(path.resolve('tailwind-static.css'), 'utf8'),
  fs.readFile(path.resolve('responsive.css'), 'utf8')
]);

const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    for (const pageName of pages) {
      let html = await fs.readFile(path.resolve(pageName), 'utf8');
      html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
      await page.setContent(html);
      await page.addStyleTag({ content: tailwind });
      await page.addStyleTag({ content: responsive });
      const result = await page.evaluate(() => {
        document.documentElement.classList.add('ftg-auth-ready');
        const header = document.querySelector('main[data-design-id] > header');
        if (!header) return { missing: true };
        let copy = [...header.children].find(node => node.classList.contains('ftg-header-copy'));
        if (!copy) {
          copy = [...header.children].find(node => node.matches('div') && node.querySelector('h1,h2'));
          if (copy) copy.classList.add('ftg-header-copy');
          else {
            copy = document.createElement('div');
            copy.className = 'ftg-header-copy';
            header.insertBefore(copy, header.firstChild);
            [...header.children].filter(node => node !== copy && node.matches('h1,h2,p,small')).forEach(node => copy.appendChild(node));
          }
        }
        const actions = document.createElement('div');
        actions.className = 'ftg-header-actions';
        [...header.children].filter(node => node !== copy).forEach(node => actions.appendChild(node));
        actions.insertAdjacentHTML('afterbegin', '<label class="ftg-language-control"><i class="fa-solid fa-language"></i><select><option>ID</option></select></label><button class="ftg-global-search"><i class="fa-solid fa-magnifying-glass"></i><span>Cari</span><kbd>Ctrl K</kbd></button>');
        actions.insertAdjacentHTML('beforeend', '<button class="ftg-profile-control">QA</button>');
        header.appendChild(actions);
        header.classList.add('ftg-dashboard-header');
        const visible = element => { const style=getComputedStyle(element),rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0; };
        const rect = element => { const value=element.getBoundingClientRect();return { left:value.left,right:value.right,top:value.top,bottom:value.bottom,width:value.width,height:value.height }; };
        const overlaps = (one,two) => one.right > two.left + .5 && two.right > one.left + .5 && one.bottom > two.top + .5 && two.bottom > one.top + .5;
        const copyRect=rect(copy),actionsRect=rect(actions),headerRect=rect(header);
        const iconSizes=[...header.querySelectorAll('i')].filter(visible).map(icon=>parseFloat(getComputedStyle(icon).fontSize));
        return {
          overlap: overlaps(copyRect,actionsRect),
          headerOverflow: copyRect.left < headerRect.left - 1 || actionsRect.right > headerRect.right + 1,
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          maxIcon: iconSizes.length ? Math.max(...iconSizes) : 0,
          children: [...header.children].map(node => node.className)
        };
      });
      assert.equal(result.missing, undefined, `${pageName} is missing its dashboard header`);
      assert.equal(result.overlap, false, `${pageName}/${viewport.width}: title and actions overlap`);
      assert.equal(result.headerOverflow, false, `${pageName}/${viewport.width}: header actions leave the header`);
      assert.ok(result.pageOverflow <= 2, `${pageName}/${viewport.width}: ${result.pageOverflow}px horizontal overflow`);
      assert.ok(result.maxIcon <= 18, `${pageName}/${viewport.width}: shell icon grew to ${result.maxIcon}px`);
      assert.equal(result.children.length, 2, `${pageName}/${viewport.width}: header must have copy + actions only`);
    }

    await page.setContent(`
      <div class="ftg-modal-ov" style="position:fixed;inset:0;display:grid;place-items:center;padding:16px">
        <section class="ftg-modal-box ftg-profile-dialog">
          <div class="ftg-modal-toolbar"><button class="ftg-modal-close" aria-label="Tutup">×</button></div>
          <div class="ftg-modal-content">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
              <div style="width:56px;height:56px">PF</div>
              <div><small>PROFIL FASIL</small><h2>Edit profil saya</h2></div>
            </div>
            <label>Nama lengkap<input id="profileEditName" value="Panitia FTG"></label>
          </div>
        </section>
      </div>`);
    await page.addStyleTag({ content: tailwind });
    await page.addStyleTag({ content: responsive });
    const modal = await page.evaluate(() => {
      const box = document.querySelector('.ftg-modal-box');
      const toolbar = document.querySelector('.ftg-modal-toolbar');
      const close = document.querySelector('.ftg-modal-close');
      const content = document.querySelector('.ftg-modal-content');
      const rect = node => node.getBoundingClientRect();
      const boxRect = rect(box), closeRect = rect(close), contentRect = rect(content);
      return {
        boxWidth: boxRect.width,
        boxHeight: boxRect.height,
        closeInside: closeRect.left >= boxRect.left && closeRect.right <= boxRect.right && closeRect.top >= boxRect.top,
        toolbarPosition: getComputedStyle(toolbar).position,
        contentStartsNearTop: contentRect.top - boxRect.top <= 26,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    assert.ok(modal.boxWidth <= Math.min(560, viewport.width - 16), `profile modal/${viewport.width}: width ${modal.boxWidth}px is oversized`);
    assert.ok(modal.boxHeight <= viewport.height - 20, `profile modal/${viewport.width}: modal leaves the viewport`);
    assert.equal(modal.closeInside, true, `profile modal/${viewport.width}: close button leaves the dialog`);
    assert.equal(modal.toolbarPosition, 'absolute', `profile modal/${viewport.width}: close control reserves a blank toolbar row`);
    assert.equal(modal.contentStartsNearTop, true, `profile modal/${viewport.width}: blank space remains above content`);
    assert.ok(modal.pageOverflow <= 2, `profile modal/${viewport.width}: ${modal.pageOverflow}px horizontal overflow`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`Header shell QA passed: ${pages.length} dashboards × ${viewports.length} viewports.`);
