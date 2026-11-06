import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PITCH_LENGTH } from '../tuning.js';
import { MAX_AUDIO_BYTES, parseTranscriptionRequest, makeTranscriptionRequest, parseTranscriptionReply } from '../transcription.js';

test('audio accepts only supported containers and canonical bounded base64', () => {
  for (const mediaType of ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']) {
    const input = { audio: Buffer.from('audio').toString('base64'), mediaType, instructions: 'do not forward me' };
    assert.deepEqual(makeTranscriptionRequest(parseTranscriptionRequest(input)), { audio: input.audio, mediaType });
  }
  for (const audio of ['', '!', 'YQ', 'YR==', 'YQ==\n', 'data:audio/wav;base64,YQ==']) assert.equal(parseTranscriptionRequest({ audio, mediaType: 'audio/wav' }), null);
  for (const body of [null, [], {}, { audio: 123, mediaType: 'audio/wav' }, { audio: 'YQ==', mediaType: 'application/octet-stream' }]) assert.equal(parseTranscriptionRequest(body), null);
  assert.ok(parseTranscriptionRequest({ audio: Buffer.alloc(MAX_AUDIO_BYTES).toString('base64'), mediaType: 'audio/wav' }));
  assert.equal(parseTranscriptionRequest({ audio: Buffer.alloc(MAX_AUDIO_BYTES + 1).toString('base64'), mediaType: 'audio/wav' }), null);
});

test('transcript output preserves longer replies and rejects oversized text without truncating', () => {
  assert.deepEqual(parseTranscriptionReply({ text: '  A clear sentence.  ', hidden: 'provider metadata' }), { text: 'A clear sentence.' });
  const long='A detailed story. '.repeat(60)+'I offer eighty dollars.';
  assert.equal(parseTranscriptionReply({text:long}).text,long);
  assert.equal(parseTranscriptionReply({text:'a'.repeat(MAX_PITCH_LENGTH)}).text.length,MAX_PITCH_LENGTH);
  assert.equal(parseTranscriptionReply({text:'a'.repeat(MAX_PITCH_LENGTH+1)}),null);
  for (const value of [null, {}, { text: '' }, { text: '  ' }, { text: 3 }]) assert.equal(parseTranscriptionReply(value), null);
});
