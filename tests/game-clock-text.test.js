import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameClock, clockLabel } from '../game-clock.js';
import { scoreSummary, analysisSummary } from '../game-text.js';

const fakeElement = () => ({ hidden: true, textContent: '', classList: { toggle() {} } });

test('clockLabel formats minutes and zero-padded seconds', () => {
  assert.equal(clockLabel(65), 'Đồng hồ 1:05');
  assert.equal(clockLabel(600), 'Đồng hồ 10:00');
});

test('the clock counts down while running, warns once, and hides outside play', () => {
  const element = fakeElement();
  let running = true,
    limit = 2,
    expired = 0;
  const clock = createGameClock({
    element: /** @type {any} */ (element),
    getLimit: () => limit,
    isRunning: () => running,
    isVisible: () => true,
    onExpire: () => expired++,
  });
  clock.reset();
  clock.tick(true, false);
  assert.equal(clock.left, 1);
  assert.equal(element.hidden, false);
  running = false;
  clock.tick(true, false);
  assert.equal(clock.left, 1, 'bot thinking time is not charged');
  running = true;
  clock.tick(true, false);
  clock.tick(true, false);
  clock.tick(true, false);
  assert.equal(expired, 1, 'expiry is reported once');
  assert.equal(element.textContent, 'Hết giờ (tự đặt)');
  clock.tick(false, false);
  assert.equal(element.hidden, true);
  limit = 0;
  clock.tick(true, false);
  assert.equal(element.hidden, true, 'no limit means no clock');
});

test('scoreSummary reports the leader and uses a decimal comma for komi', () => {
  const text = scoreSummary(
    {
      blackStones: 10,
      blackLand: 5,
      black: 15,
      whiteStones: 9,
      whiteLand: 4,
      white: 19.5,
      neutral: 2,
    },
    6.5
  );
  assert.match(text, /6,5 komi/);
  assert.match(text, /Trắng hơn 4\.5 điểm/);
});

test('analysisSummary lists findings or explains that none were found', () => {
  assert.match(analysisSummary([], String), /chưa tìm được/);
  const text = analysisSummary(
    [{ move: 3, played: -1, point: 7, reply: 8, gap: 2.25 }],
    (p) => `P${p}`
  );
  assert.equal(
    text,
    'Nước 3: bạn đi bỏ lượt. Cân nhắc P7; đối thủ có thể đáp P8. Chênh lệch đánh giá: 2.3 đơn vị nội bộ.'
  );
});
