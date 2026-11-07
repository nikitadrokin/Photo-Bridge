import { describe, expect, it } from 'bun:test';
import {
  AdbProgressParser,
  bytesFromAdbProgress,
  toPushBytesEvent,
} from './adb-progress-parse';

describe('AdbProgressParser', () => {
  it('decodes PTY ticks: CR, CSI EL, space-padded percent', () => {
    const parser = new AdbProgressParser();
    // A tick is `\r` + line + EL. The next `\r` (or flush) commits the line.
    parser.push(`\r[  4%] /sdcard/DCIM/Camera/IMG_2715.mp4\x1B[K`);
    expect(parser.flush()).toEqual([
      {
        kind: 'tick',
        overallPercent: 4,
        remotePath: '/sdcard/DCIM/Camera/IMG_2715.mp4',
        filePercent: null,
        copiedBytes: null,
      },
    ]);
  });

  it('commits the previous tick when the next CR arrives', () => {
    const parser = new AdbProgressParser();
    expect(
      parser.push('\r[  4%] /sdcard/a.mp4\x1B[K\r[  5%] /sdcard/a.mp4\x1B[K'),
    ).toEqual([
      {
        kind: 'tick',
        overallPercent: 4,
        remotePath: '/sdcard/a.mp4',
        filePercent: null,
        copiedBytes: null,
      },
    ]);
    expect(parser.flush()).toEqual([
      {
        kind: 'tick',
        overallPercent: 5,
        remotePath: '/sdcard/a.mp4',
        filePercent: null,
        copiedBytes: null,
      },
    ]);
  });

  it('decodes multi-file ticks with per-file percent', () => {
    const parser = new AdbProgressParser();
    parser.push('\r[ 42%] /sdcard/DCIM/Camera/a.mp4: 87%\x1B[K');
    expect(parser.flush()).toEqual([
      {
        kind: 'tick',
        overallPercent: 42,
        remotePath: '/sdcard/DCIM/Camera/a.mp4',
        filePercent: 87,
        copiedBytes: null,
      },
    ]);
  });

  it('decodes unknown overall percent and N/? copied bytes', () => {
    const parser = new AdbProgressParser();
    expect(parser.push('\r[   ?] /sdcard/foo: 12345/?\x1B[K\n')).toEqual([
      {
        kind: 'tick',
        overallPercent: null,
        remotePath: '/sdcard/foo',
        filePercent: null,
        copiedBytes: 12345,
      },
    ]);
  });

  it('stitches ticks split across chunks', () => {
    const parser = new AdbProgressParser();
    expect(parser.push('\r[ 10%] /sdcard/')).toEqual([]);
    expect(parser.push('DCIM/Camera/x.mp4\x1B[K\r')).toEqual([
      {
        kind: 'tick',
        overallPercent: 10,
        remotePath: '/sdcard/DCIM/Camera/x.mp4',
        filePercent: null,
        copiedBytes: null,
      },
    ]);
  });

  it('decodes the KeepInfoLine summary with exact byte count', () => {
    const parser = new AdbProgressParser();
    const line =
      'IMG_2715.mp4: 1 file pushed, 0 skipped. 35.2 MB/s (10737418240 bytes in 291.120s)\n';
    expect(parser.push(line)).toEqual([
      {
        kind: 'summary',
        displayName: 'IMG_2715.mp4',
        filesTransferred: 1,
        filesSkipped: 0,
        bytesTransferred: 10737418240,
        megabytesPerSecond: 35.2,
      },
    ]);
  });

  it('ignores blank CSI-only noise', () => {
    const parser = new AdbProgressParser();
    expect(parser.push('\r\x1B[K\n')).toEqual([]);
  });
});

describe('bytesFromAdbProgress / toPushBytesEvent', () => {
  it('uses overall percent against known size for a single-file push', () => {
    const size = 10 * 1024 ** 3;
    const bytes = bytesFromAdbProgress(
      {
        kind: 'tick',
        overallPercent: 25,
        remotePath: '/sdcard/DCIM/Camera/IMG_2715.mp4',
        filePercent: null,
        copiedBytes: null,
      },
      size,
    );
    expect(bytes).toBe(Math.floor(size * 0.25));
  });

  it('prefers per-file percent when both are present', () => {
    const bytes = bytesFromAdbProgress(
      {
        kind: 'tick',
        overallPercent: 10,
        remotePath: '/sdcard/a.mp4',
        filePercent: 50,
        copiedBytes: null,
      },
      1000,
    );
    expect(bytes).toBe(500);
  });

  it('emits a push_bytes event the transfer panel already understands', () => {
    const event = toPushBytesEvent(
      {
        kind: 'summary',
        displayName: 'IMG_2715.mp4',
        filesTransferred: 1,
        filesSkipped: 0,
        bytesTransferred: 10737418240,
        megabytesPerSecond: 35.2,
      },
      {
        file: 'IMG_2715.mp4',
        fileSizeBytes: 10737418240,
        completedFiles: 21,
        totalFiles: 31,
      },
    );
    expect(event).toEqual({
      v: 1,
      kind: 'push_bytes',
      file: 'IMG_2715.mp4',
      bytesTransferred: 10737418240,
      completedFiles: 21,
      totalFiles: 31,
      fileTotalBytes: 10737418240,
    });
  });
});
