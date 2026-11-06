import { isPersonalityId } from './personalities.js';

export const SPEECH_URL = 'https://ai-gateway.vercel.sh/v4/ai/speech-model';
export const SPEECH_MODEL = 'openai/tts-1';
export const MAX_SPEECH_BYTES = 1024 * 1024;
const VOICES = Object.freeze({ guarded: 'onyx', enthusiastic: 'nova', nostalgic: 'shimmer', analytical: 'echo', theatrical: 'fable', easygoing: 'alloy', brisk: 'echo', contrarian: 'onyx' });
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export function parseSpeechRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500) return null;
  if (body.personalityId !== undefined && !isPersonalityId(body.personalityId)) return null;
  return { text: body.text.trim(), voice: body.personalityId ? VOICES[body.personalityId] : 'alloy' };
}

export function makeSpeechRequest(context) {
  return { text: context.text, voice: context.voice, outputFormat: 'mp3' };
}

export function parseSpeechReply(body) {
  if (!body || typeof body.audio !== 'string' || !body.audio.length || body.audio.length > Math.ceil(MAX_SPEECH_BYTES / 3) * 4 || !BASE64.test(body.audio)) return null;
  const bytes = Buffer.from(body.audio, 'base64');
  if (!bytes.length || bytes.length > MAX_SPEECH_BYTES || bytes.toString('base64') !== body.audio) return null;
  return { audio: body.audio, mimeType: 'audio/mpeg' };
}
