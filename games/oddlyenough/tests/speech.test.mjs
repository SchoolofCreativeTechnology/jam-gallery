import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SPEECH_BYTES, parseSpeechRequest, makeSpeechRequest, parseSpeechReply } from '../speech.js';

test('speech text is bounded and voices are selected only from canonical personalities', () => {
  assert.deepEqual(makeSpeechRequest(parseSpeechRequest({ text: ' Hello. ', personalityId: 'guarded', voice: 'fake', model: 'fake' })), { text: 'Hello.', voice: 'onyx', outputFormat: 'mp3' });
  assert.equal(parseSpeechRequest({ text: 'Hello.' }).voice, 'alloy');
  for (const body of [null, [], {}, { text: '' }, { text: 'a'.repeat(501) }, { text: 'Hi', personalityId: null }, { text: 'Hi', personalityId: 'fake' }]) assert.equal(parseSpeechRequest(body), null);
});

test('speech returns only canonical base64 MPEG up to one megabyte', () => {
  assert.deepEqual(parseSpeechReply({ audio: 'YQ==', mimeType: 'text/html', metadata: 'ignored' }), { audio: 'YQ==', mimeType: 'audio/mpeg' });
  for (const audio of ['', '!', 'YQ', 'YR==', 'YQ==\n']) assert.equal(parseSpeechReply({ audio }), null);
  assert.ok(parseSpeechReply({ audio: Buffer.alloc(MAX_SPEECH_BYTES).toString('base64') }));
  assert.equal(parseSpeechReply({ audio: Buffer.alloc(MAX_SPEECH_BYTES + 1).toString('base64') }), null);
});
