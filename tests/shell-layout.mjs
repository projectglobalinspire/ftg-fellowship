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

    await page.setContent(`
      <main style="padding:24px">
        <section class="ftg-mentee-announcement is-visible">
          <div class="ftg-mentee-announcement-copy">
            <div class="ftg-announcement-kicker"><small><i class="fa-solid fa-bullhorn"></i> INFORMASI FBF</small></div>
            <h2>Mentorship Session 5 - CFO Insight Bareng Mentor Dimas Alicsan</h2>
            <p>Topik mentoring: Mengelola Keuangan Strategis untuk Future Leaders. Hari, tanggal: Kamis, 3 September 2026.</p>
            <div class="ftg-announcement-copy-actions"></div>
            <div class="ftg-announcement-controls">
              <button type="button"><i class="fa-solid fa-arrow-left"></i></button>
              <span class="ftg-announcement-dots"><button type="button" data-announcement-slide="0" class="is-active"></button><button type="button" data-announcement-slide="1"></button></span>
              <span class="ftg-announcement-count">1 / 6</span>
              <button type="button"><span>Berikutnya</span><i class="fa-solid fa-arrow-right"></i></button>
            </div>
          </div>
          <button class="ftg-mentee-announcement-poster"><img alt="Poster informasi" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Crect width='240' height='240' fill='%23eff7f4'/%3E%3C/svg%3E"></button>
          <span class="ftg-announcement-progress"><i></i></span>
        </section>
      </main>`);
    await page.addStyleTag({ content: tailwind });
    await page.addStyleTag({ content: responsive });
    const announcement = await page.evaluate(() => {
      const board = document.querySelector('.ftg-mentee-announcement');
      const boardRect = board.getBoundingClientRect();
      const heading = board.querySelector('h2');
      const poster = board.querySelector('.ftg-mentee-announcement-poster');
      const controls = board.querySelector('.ftg-announcement-controls');
      const controlsRect = controls.getBoundingClientRect();
      const color = getComputedStyle(board).backgroundImage;
      return {
        height: boardRect.height,
        overflow: board.scrollWidth - board.clientWidth,
        greenSurface: color.includes('linear-gradient'),
        headingColor: getComputedStyle(heading).color,
        posterInside: poster.getBoundingClientRect().right <= boardRect.right + 1,
        controlsInside: controlsRect.bottom <= boardRect.bottom + 1
      };
    });
    assert.equal(announcement.greenSurface, true, `announcement/${viewport.width}: green surface was overridden`);
    assert.equal(announcement.headingColor, 'rgb(255, 255, 255)', `announcement/${viewport.width}: heading loses contrast`);
    assert.ok(announcement.overflow <= 2, `announcement/${viewport.width}: ${announcement.overflow}px horizontal overflow`);
    assert.equal(announcement.posterInside, true, `announcement/${viewport.width}: poster leaves the card`);
    assert.equal(announcement.controlsInside, true, `announcement/${viewport.width}: controls leave the card`);
    if (viewport.width > 780) assert.ok(announcement.height <= 250, `announcement/${viewport.width}: ${announcement.height}px card is too tall`);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`Header shell QA passed: ${pages.length} dashboards × ${viewports.length} viewports.`);
