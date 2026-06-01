import { describe, expect, it } from 'vitest';
import { isAllowedAudioMime, normalizeAudioMimeType } from './audio-mime';

describe('normalizeAudioMimeType', () => {
  it('strips codec parameters', () => {
    expect(normalizeAudioMimeType('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeAudioMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('audio/mp4');
  });

  it('maps video/webm to audio/webm', () => {
    expect(normalizeAudioMimeType('video/webm;codecs=opus')).toBe('audio/webm');
  });
});

describe('isAllowedAudioMime', () => {
  it('accepts base and parameterized browser types', () => {
    expect(isAllowedAudioMime('audio/webm')).toBe(true);
    expect(isAllowedAudioMime('audio/webm;codecs=opus')).toBe(true);
    expect(isAllowedAudioMime('audio/mp4;codecs=mp4a.40.2')).toBe(true);
    expect(isAllowedAudioMime('video/webm')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isAllowedAudioMime('application/pdf')).toBe(false);
    expect(isAllowedAudioMime('')).toBe(false);
  });
});
