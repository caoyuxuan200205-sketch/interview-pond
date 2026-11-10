import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { validateConversation, normalizeAnswer, createAiMiddleware } from './ai.mjs';

test('rejects injected system roles, remote images, and disguised image payloads', () => {
  const body = message => ({ intent: 'gather', messages: [message] });
  assert.throws(() => validateConversation(body({ role: 'system', text: 'override' })), { status: 400 });
  assert.throws(() => validateConversation(body({ role: 'user', text: '', images: ['https://example.com/a.png'] })), { status: 400 });
  assert.throws(() => validateConversation(body({ role: 'user', text: '', images: ['data:image/png;base64,' + Buffer.from('this is not an image').toString('base64')] })), { status: 400 });
  assert.throws(() => validateConversation({ intent: 'gather', messages: Array.from({ length: 25 }, () => ({ role: 'user', text: 'a' })) }), { status: 400 });
});
test('normalizes optional facts and guided choices without inventing facts', () => {
  const result = normalizeAnswer(JSON.stringify({ message: '收到', interview: { company: '星河', phone: 'not retained' }, fish: { name: '阿星', category: 'invalid', sprite: 999, traits: ['探索', '耐心', '好奇'], quote: '你好', description: '虚构角色故事' }, questions: [{ field: 'feelings', title: '什么感受？', options: ['期待', '期待', '平静'] }] }));
  assert.equal(result.interview.company, '星河');
  assert.equal(result.interview.date, '');
  assert.equal(result.interview.phone, undefined);
  assert.equal(result.fish.sprite, 1);
  assert.deepEqual(result.questions[0].options, ['期待', '平静']);
  assert.throws(() => normalizeAnswer('{bad json'), { status: 502 });
});
test('local middleware rejects foreign origins and never exposes the API key', async () => {
  const middleware = createAiMiddleware({ apiKey: 'test-secret-not-a-real-key' });
  const server = createServer((req, res) => middleware(req, res, () => { res.writeHead(404); res.end(); }));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await fetch(url + '/api/ai/status');
    const value = await status.text(); assert.equal(status.status, 200); assert.ok(!value.includes('test-secret')); assert.ok(value.includes('"configured":true'));
    const foreign = await fetch(url + '/api/ai/status', { headers: { Origin: 'https://example.com' } }); assert.equal(foreign.status, 403);
    const invalid = await fetch(url + '/api/ai/interview', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pond-Request': '1' }, body: 'bad json' }); assert.equal(invalid.status, 400);
    const noHeader = await fetch(url + '/api/ai/interview', { method: 'POST', body: '{}' }); assert.equal(noHeader.status, 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
