import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTime,
  parseTime,
  findActiveLineIndex,
  parseLrc,
  toLrc,
  cleanPersianPoetry,
  estimateTimestampsFromText,
  type LyricLine,
} from './syncUtils.ts';

test('formatTime formats seconds to mm:ss correctly', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(125.7, true), '02:05.7');
  assert.equal(formatTime(-10), '00:00');
});

test('parseTime parses minutes, seconds and decimals', () => {
  assert.equal(parseTime('01:30'), 90);
  assert.equal(parseTime('00:05.50'), 5.5);
  assert.equal(parseTime('[02:15.20]'), 135.2);
  assert.equal(parseTime(''), 0);
});

test('findActiveLineIndex locates correct verse given timestamp', () => {
  const lines: LyricLine[] = [
    { id: '1', startTime: 0, endTime: 5, text: 'بند اول مصراع یک' },
    { id: '2', startTime: 5, endTime: 12, text: 'بند اول مصراع دو' },
    { id: '3', startTime: 12, endTime: 20, text: 'ترجیع بند' },
  ];

  assert.equal(findActiveLineIndex(lines, 0), 0);
  assert.equal(findActiveLineIndex(lines, 3), 0);
  assert.equal(findActiveLineIndex(lines, 5), 1);
  assert.equal(findActiveLineIndex(lines, 10), 1);
  assert.equal(findActiveLineIndex(lines, 12), 2);
  assert.equal(findActiveLineIndex(lines, 25), 2);
});

test('parseLrc and toLrc roundtrip correctly', () => {
  const sampleLrc = `[ti:ای اهل حرم]
[ar:حاج محمود کریمی]
[00:04.00]ای اهل حرم میر و علمدار نیامد
[00:09.50]سقای حسین سید و سالار نیامد`;

  const parsed = parseLrc(sampleLrc);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'ای اهل حرم میر و علمدار نیامد');
  assert.equal(parsed[0].startTime, 4);
  assert.equal(parsed[1].startTime, 9.5);

  const serialized = toLrc(parsed, 'ای اهل حرم', 'حاج محمود کریمی');
  assert.ok(serialized.includes('[00:04.00]ای اهل حرم میر و علمدار نیامد'));
  assert.ok(serialized.includes('[00:09.50]سقای حسین سید و سالار نیامد'));
});

test('cleanPersianPoetry strips zero-width spaces and trims', () => {
  const input = `
    ای اهل حرم میر و علمدار نیامد\u200C
    
    سقای حسین سید و سالار نیامد
  `;
  const cleaned = cleanPersianPoetry(input);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0], 'ای اهل حرم میر و علمدار نیامد');
  assert.equal(cleaned[1], 'سقای حسین سید و سالار نیامد');
});

test('estimateTimestampsFromText allocates sequential valid timestamps', () => {
  const poem = `
    ای تشنه لب ای شهید بی سر
    سلام ما به تو یا اباعبدالله
    دلم پر از هوای کربلای توست
  `;
  const estimated = estimateTimestampsFromText(poem, 30);
  assert.equal(estimated.length, 3);
  assert.ok(estimated[0].startTime >= 0);
  assert.ok(estimated[1].startTime > estimated[0].startTime);
  assert.ok(estimated[2].startTime > estimated[1].startTime);
  assert.ok(estimated[2].endTime <= 32);
});
