const ALLOWED_AUDIO_MIMES = new Set<string>([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
]);

/** Strip codec/profile parameters (`audio/webm;codecs=opus` → `audio/webm`).
 *  MediaRecorder reports parameterized types; the allowlist stores base types. */
export function normalizeAudioMimeType(mime: string): string {
  const base = mime.trim().toLowerCase().split(';', 1)[0]?.trim() ?? '';
  // Chromium sometimes labels audio-only webm as video/webm.
  if (base === 'video/webm') {
    return 'audio/webm';
  }
  return base;
}

export function isAllowedAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_MIMES.has(normalizeAudioMimeType(mime));
}
