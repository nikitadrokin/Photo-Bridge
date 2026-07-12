import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  parseHumanSizeToBytes,
  pushFitsInFreeSpace,
  pushSafetyMarginBytes,
} from './storage-size';

describe('parseHumanSizeToBytes', () => {
  it('parses common df-style labels', () => {
    expect(parseHumanSizeToBytes('17G')).toBe(17 * 1024 ** 3);
    expect(parseHumanSizeToBytes('17GB')).toBe(17 * 1024 ** 3);
    expect(parseHumanSizeToBytes('512M')).toBe(512 * 1024 ** 2);
    expect(parseHumanSizeToBytes('1.5K')).toBe(Math.floor(1.5 * 1024));
    expect(parseHumanSizeToBytes('1024')).toBe(1024);
  });

  it('rejects garbage', () => {
    expect(parseHumanSizeToBytes('')).toBeNull();
    expect(parseHumanSizeToBytes('lots')).toBeNull();
  });
});

describe('pushFitsInFreeSpace', () => {
  it('requires a safety margin', () => {
    const free = 1 * 1024 ** 3; // 1 GiB
    const margin = pushSafetyMarginBytes(free);
    expect(pushFitsInFreeSpace(free - margin, free)).toBe(true);
    expect(pushFitsInFreeSpace(free - margin + 1, free)).toBe(false);
  });
});

describe('formatBytes', () => {
  it('formats binary units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});
