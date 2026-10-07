import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Agent, StreamEvent } from '../agent.js';
import { CancelledError } from '../errors.js';

function stubInner(opts: {
  tokens?: any[];
  cbError?: Error;
  reject?: Error;
  resolveWith?: string;
} = {}) {
  const stub: any = {
    stream(_task: any, cb: any) {
      for (const t of opts.tokens ?? []) cb(null, t);
      if (opts.cbError) cb(opts.cbError, null);
      if (opts.reject) return Promise.reject(opts.reject);
      return Promise.resolve(opts.resolveWith ?? 'FINAL_TEXT');
    },
    stop() {},
    runSimple: () => Promise.resolve('simple'),
    react: () => Promise.resolve('react'),
    listTools: () => [],
    config: () => ({}),
    getPerfMetrics: () => ({}),
    resetPerfMetrics: () => {},
    close() {},
  };
  return stub;
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe('Agent.streamCollect', () => {
  it('collects every token from a healthy stream', async () => {
    const agent = new Agent(stubInner({ tokens: [{ type: 'Text', text: 'hi' }, { type: 'Done' }] }));
    const tokens = await agent.streamCollect('x');
    assert.strictEqual(tokens.length, 2);
    assert.strictEqual(tokens[0].text, 'hi');
  });

  it('resolves on error streams (regression: used to hang waiting for Done)', async () => {
    const agent = new Agent(stubInner({ cbError: new Error('boom') }));
    const tokens = await agent.streamCollect('x');
    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0].type, 'Error');
    assert.strictEqual(tokens[0].error, 'boom');
  });
});

describe('Agent.streamEvents', () => {
  it('yields tokens and terminates with exactly one done carrying the result', async () => {
    const agent = new Agent(
      stubInner({ tokens: [{ type: 'Text', text: 'a' }, { type: 'Done' }], resolveWith: 'FINAL_TEXT' })
    );
    const events = await collect(agent.streamEvents('x'));
    // The internal Done token is filtered out; streamEvents synthesizes the
    // terminal event (with the final result) itself.
    assert.deepStrictEqual(
      events.map((e) => e.type),
      ['token', 'done']
    );
    const done = events[events.length - 1];
    assert.strictEqual(done.type, 'done');
    assert.strictEqual((done as any).result, 'FINAL_TEXT');
  });

  it('treats a callback error as the single terminal event', async () => {
    const agent = new Agent(stubInner({ cbError: new Error('llm down') }));
    const events = await collect(agent.streamEvents('x'));
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'error');
    assert.strictEqual((events[0] as any).error, 'llm down');
  });

  it('terminates with error when the underlying stream rejects', async () => {
    const agent = new Agent(stubInner({ reject: new Error('net down') }));
    const events = await collect(agent.streamEvents('x'));
    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].type, 'error');
    assert.strictEqual((events[0] as any).error, 'net down');
  });

  it('throws CancelledError when the signal is already aborted', async () => {
    const agent = new Agent(stubInner({ tokens: [] }));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => collect(agent.streamEvents('x', { signal: controller.signal })),
      CancelledError
    );
  });
});
