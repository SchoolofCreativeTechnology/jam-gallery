// Server-only voice input. Audio stays in memory and credentials never reach the browser.
import { MAX_PITCH_LENGTH } from './tuning.js';
export const TRANSCRIPTION_URL = 'https://ai-gateway.vercel.sh/v4/ai/transcription-model';
export const TRANSCRIPTION_MODEL = 'openai/whisper-1';
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MEDIA_TYPES = new Set(['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']);
// A flat character scan stays safe for long recordings; round-trip comparison
// below verifies padding and canonical encoding without a recursive regex.
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function parseTranscriptionRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.audio !== 'string' || typeof body.mediaType !== 'string') return null;
  const mediaType = body.mediaType.toLowerCase().split(';')[0].trim();
  if (!MEDIA_TYPES.has(mediaType) || !body.audio.length || body.audio.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 || !BASE64.test(body.audio)) return null;
  const bytes = Buffer.from(body.audio, 'base64');
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES || bytes.toString('base64') !== body.audio) return null;
  return { audio: body.audio, mediaType };
}

export function makeTranscriptionRequest(context) {
  return { audio: context.audio, mediaType: context.mediaType };
}

export function parseTranscriptionReply(payload) {
  if (!payload || typeof payload.text !== 'string' || !payload.text.trim() || payload.text.trim().length > MAX_PITCH_LENGTH) return null;
  return { text: payload.text.trim() };
}
