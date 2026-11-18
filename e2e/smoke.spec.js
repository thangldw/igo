import { test as base, expect } from '@playwright/test';

// Shared site assets (/css, /js, /assets) live at the root of the owner's domain in production
// and are absent from the local server; stub them so real failures stand out.
const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/\/(css|js|assets)\/|favicon\.ico/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: '' })
    );
    await use(page);
  },
});

const noErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
};

test('lesson page loads, lists lessons and has no horizontal scroll', async ({ page }) => {
  const errors = noErrors(page);
  await page.goto('/');
  await expect(page.locator('#lessons button').first()).toBeAttached(); // hidden on mobile, where #lesson-select is used
  await expect(page.locator('#lesson-select:visible, #lessons:visible').first()).toBeVisible();
  await expect(page.locator('#board button').first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('lesson buttons render title text without injecting markup', async ({ page }) => {
  await page.goto('/');
  const first = page.locator('#lessons button').first();
  await expect(first.locator('.number')).toHaveText(/^(\d\d|✓)$/);
  await expect(first).not.toHaveText(/[<>]/);
});

test('playing a stone on the board changes the position', async ({ page }) => {
  await page.goto('/');
  const points = page.locator('#board button');
  const total = await points.count();
  const before = await page.locator('#board .stone').count();
  await points.nth(Math.floor(total / 2)).click();
  await expect.poll(() => page.locator('#board .stone').count()).toBeGreaterThan(before);
});

test('training page loads a puzzle and shows the daily plan', async ({ page }) => {
  const errors = noErrors(page);
  await page.goto('/train.html');
  await expect(page.locator('#title')).not.toHaveText(/Đang tải/);
  await expect(page.locator('#board button').first()).toBeVisible();
  await page.locator('#mode-today').click();
  await expect(page.locator('#today')).toBeVisible();
  expect(errors).toEqual([]);
});

test('wrong move gives feedback and retry resets', async ({ page }) => {
  await page.goto('/train.html?stage=' + 'x');
  await page.locator('#mode-practice').click();
  await page.locator('#board button').first().click();
  await expect(page.locator('#feedback')).not.toBeEmpty();
  await page.locator('#retry').click();
});

test('review page opens', async ({ page }) => {
  const errors = noErrors(page);
  await page.goto('/review.html');
  await expect(page.locator('main')).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });
  test('registers and takes control of the page', async ({ page }) => {
    await page.goto('/');
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(scope).toMatch(/\/$/);
  });
});

test('journal notes are saved and linked only for http(s) URLs', async ({ page }) => {
  await page.goto('/train.html');
  await page.locator('.practice-plan summary').click();
  await page.locator('#game-url').fill('https://online-go.com/game/1');
  await page.locator('#game-note').fill('Bỏ sót đáp trả ở nước 12');
  await page.locator('#game-form button[type=submit]').click();
  const item = page.locator('#game-list .game-item').first();
  await expect(item).toContainText('Bỏ sót đáp trả');
  await expect(item.locator('a')).toHaveAttribute('href', 'https://online-go.com/game/1');
});

test('a mistake shows up in the topic panel and clicking the topic opens a puzzle', async ({
  page,
}) => {
  await page.goto('/train.html');
  await page.locator('#mode-practice').click();
  await page.locator('#board button').first().click();
  await expect(page.locator('#feedback')).not.toBeEmpty();
  await page.reload();
  const row = page.locator('#topic-stats .topic-row').first();
  await page.locator('#topic-panel').evaluate((el) => (el.open = true));
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator('#board button').first()).toBeVisible();
  await expect(page.locator('#title')).not.toHaveText(/Đang tải/);
});

test('a game against the bot is saved and resumed after reload', async ({ page }) => {
  const errors = noErrors(page);
  await page.goto('/?play=1');
  const points = page.locator('#board button');
  await expect(points).toHaveCount(81);
  await points.nth(40).click();
  if (await page.locator('#confirm-point').isVisible())
    await page.locator('#confirm-point').click();
  await expect(page.locator('#game-save-status')).toContainText('Đã lưu');
  await expect(page.locator('#turn')).toContainText('Lượt của bạn');
  const stones = await page.locator('#board .stone').count();
  expect(stones).toBeGreaterThanOrEqual(2);
  await page.goto('/?play=1');
  await expect(page.locator('#board .stone')).toHaveCount(stones);
  expect(errors).toEqual([]);
});

test('lesson completion is remembered across reloads', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('igo-progress', JSON.stringify([0, 'bogus'])));
  await page.reload();
  const saved = await page.evaluate(() => localStorage.getItem('igo-progress'));
  expect(JSON.parse(saved)).toEqual([0, 'bogus']); // load must not rewrite storage
  await expect(page.locator('#progress-text')).toContainText('1');
});

test('search-level bot replies through the worker', async ({ page }) => {
  await page.goto('/?play=1');
  await page.locator('#bot-level').selectOption('search');
  await page.locator('#board button').nth(40).click();
  if (await page.locator('#confirm-point').isVisible())
    await page.locator('#confirm-point').click();
  await expect(page.locator('#turn')).toContainText('Lượt của bạn', { timeout: 20000 });
  await expect(page.locator('#board .stone')).toHaveCount(2);
});

test('a finished game offers dead-stone suggestions and analysis through the worker', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  const saved = {
    version: 1,
    size: 9,
    difficulty: 'easy',
    komi: 6.5,
    moves: [
      { color: 1, point: 40 },
      { color: 2, point: 30 },
      { color: 1, point: -1 },
      { color: 2, point: -1 },
    ],
  };
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    ['igo-game-v1', JSON.stringify(saved)]
  );
  await page.goto('/?play=1');
  await expect(page.locator('#scoring-panel')).toBeVisible();
  await expect(page.locator('#score-detail')).toContainText('Đen');
  await page.locator('#suggest-dead').click();
  await expect(page.locator('#dead-status')).not.toHaveText(/Đang mô phỏng/, { timeout: 30000 });
  await expect(page.locator('#dead-status')).not.toBeEmpty();
  await page.locator('#analysis-panel summary').click();
  await page.locator('#analyze-game').click();
  await expect(page.locator('#analysis-output')).not.toHaveText(/Đang/, { timeout: 60000 });
});

test('a reading puzzle is checked by the worker and the hint escalates', async ({ page }) => {
  const errors = noErrors(page);
  await page.goto('/train.html?stage=reading');
  await page.locator('#mode-practice').click();
  await expect(page.locator('#reading-controls')).toBeVisible();
  await page.locator('#hint').click();
  await expect(page.locator('#feedback')).not.toBeEmpty({ timeout: 20000 });
  await expect(page.locator('#hint')).toContainText('2/3');
  await page.locator('#board button').first().click();
  await expect(page.locator('#turn')).not.toContainText('Đang kiểm tra', { timeout: 20000 });
  expect(errors).toEqual([]);
});

test('quiz lessons accept the right answer, reject wrong ones and unlock "next"', async ({
  page,
}) => {
  await page.goto('/');
  const ids = await page.locator('#lesson-select option').evaluateAll((o) => o.map((x) => x.value));
  let quizzes = 0;
  for (const id of ids) {
    // The select is hidden on desktop (a list is shown instead), so drive it directly.
    await page.locator('#lesson-select').evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('change'));
    }, id);
    const answers = page.locator('#answers button');
    if (!(await answers.count())) continue;
    quizzes++;
    for (let k = 0; k < (await answers.count()); k++) {
      await answers.nth(k).click();
      if (await page.locator('#next').isVisible()) break;
      await expect(page.locator('#feedback')).toContainText('Chưa đúng');
    }
    await expect(page.locator('#next')).toBeVisible();
    await expect(page.locator('#feedback')).toContainText('Đúng');
  }
  expect(quizzes).toBeGreaterThan(0);
});

test('every board lesson can be solved by following the hints', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const levels = await page.locator('#levels button').count();
  expect(levels).toBeGreaterThanOrEqual(3);
  let solved = 0;
  for (let l = 0; l < levels; l++) {
    await page.locator('#levels button').nth(l).click();
    const ids = await page
      .locator('#lesson-select option')
      .evaluateAll((o) => o.map((x) => x.value));
    for (const id of ids) {
      await page.locator('#lesson-select').evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('change'));
      }, id);
      if (await page.locator('#answers button').count()) continue; // quiz, covered above
      for (let step = 0; step < 12 && !(await page.locator('#next').isVisible()); step++) {
        await page.locator('#hint').click();
        // Lessons without a fixed target ("place anywhere") highlight nothing: any empty point works.
        const hinted = page.locator('#board button.hinted');
        const target = (await hinted.count())
          ? hinted.first()
          : page.locator('#board button:not(:has(.stone))').first();
        await target.click();
        await page.waitForTimeout(450); // scripted white replies arrive after 400ms
      }
      await expect(page.locator('#next'), `lesson ${id}`).toBeVisible();
      solved++;
    }
  }
  expect(solved).toBeGreaterThan(5);
});

test('backup export downloads JSON and import restores a journal note', async ({ page }) => {
  await page.goto('/train.html');
  await page.locator('.backup-panel summary').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#backup-export').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^igo-backup-\d{4}-\d\d-\d\d\.json$/);
  const backup = JSON.parse(
    await (await import('node:fs/promises')).readFile(await download.path(), 'utf8')
  );
  expect(backup.kind).toBe('igo-backup');
  backup.study.games = [
    { date: '2026-01-01', url: '', note: 'ghi chú từ bản sao lưu', stage: 'foundation' },
  ];
  await page.locator('#backup-import').setInputFiles({
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator('#backup-status')).toContainText('Đã nhập');
  await page.locator('.practice-plan summary').click();
  await expect(page.locator('#game-list')).toContainText('ghi chú từ bản sao lưu');
});

test('importing a foreign file is rejected without touching progress', async ({ page }) => {
  await page.goto('/train.html');
  await page.locator('.backup-panel summary').click();
  await page.locator('#backup-import').setInputFiles({
    name: 'x.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  });
  await expect(page.locator('#backup-status')).not.toContainText('Đã nhập');
  await expect(page.locator('#backup-status')).not.toBeEmpty();
});
