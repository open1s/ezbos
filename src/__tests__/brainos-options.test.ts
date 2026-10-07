import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrainOS } from '../brainos.js';
import { fetchImageAsDataUrl } from '../content.js';

test('per-agent options override BrainOS-level options', async () => {
  const brain = new BrainOS({ model: 'brain-model', apiMode: 'responses', reasoningEffort: 'high' });
  await brain.start();
  try {
    const perAgent = brain.agent('specific', { model: 'agent-model', apiMode: 'chat' }) as any;
    assert.equal(perAgent._config.model, 'agent-model');
    assert.equal(perAgent._config.apiMode, 'chat');

    // BrainOS-level values still act as defaults for agents without overrides.
    const fallback = brain.agent('fallback') as any;
    assert.equal(fallback._config.model, 'brain-model');
    assert.equal(fallback._config.apiMode, 'responses');
    assert.equal(fallback._config.reasoningEffort, 'high');
  } finally {
    await brain.stop();
  }
});

test('onMcpStatus reaches the agent builder', async () => {
  const brain = new BrainOS();
  await brain.start();
  try {
    const cb = () => {};
    const withCb = brain.agent('mcp', { onMcpStatus: cb }) as any;
    assert.equal(withCb._onMcpStatus, cb);

    const withoutCb = brain.agent('plain') as any;
    assert.equal(withoutCb._onMcpStatus, undefined);
  } finally {
    await brain.stop();
  }
});

test('camelCase builder aliases delegate to with_snake_case methods', async () => {
  const brain = new BrainOS({ model: 'brain-model' });
  await brain.start();
  try {
    const b = brain
      .agent('x')
      .withModel('camel-model')
      .withTemperature(0.2)
      .withMaxTokens(128)
      .withSystemPrompt('custom') as any;
    assert.equal(b._config.model, 'camel-model');
    assert.equal(b._config.temperature, 0.2);
    assert.equal(b._config.maxTokens, 128);
    assert.equal(b._config.systemPrompt, 'custom');
  } finally {
    await brain.stop();
  }
});

const TINY_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

test('fetchImageAsDataUrl converts a served image into a data URL', async () => {
  const bytes = Buffer.from(TINY_PNG_B64, 'base64');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'image/png' });
    res.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as { port: number };
    const url = await fetchImageAsDataUrl(`http://127.0.0.1:${port}/tiny.png`);
    assert.ok(url.startsWith('data:image/png;base64,'));
    const roundTrip = Buffer.from(url.split(',')[1], 'base64');
    assert.deepEqual(roundTrip, bytes);
  } finally {
    server.close();
  }
});

test('fetchImageAsDataUrl fails on HTTP errors', async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end('missing');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address() as { port: number };
    await assert.rejects(
      fetchImageAsDataUrl(`http://127.0.0.1:${port}/gone.png`),
      /HTTP 404/
    );
  } finally {
    server.close();
  }
});
