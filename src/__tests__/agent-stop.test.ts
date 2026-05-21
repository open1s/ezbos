import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BrainOS } from '../index.js';

describe('AgentBuilder.stop()', () => {
  it('should call stop on inner agent without error', async () => {
    const brain = new BrainOS();
    await brain.start();

    const builder = brain.agent('test-stop');
    const agent = await builder.start();

    builder.stop();

    await agent.close();
    await brain.stop();
  });

  it('should handle stop when no inner agent', async () => {
    const brain = new BrainOS();
    await brain.start();

    const builder = brain.agent('test-stop-empty');
    builder.stop();
    builder.stop();

    await brain.stop();
  });

  it('should stop after start and allow close', async () => {
    const brain = new BrainOS();
    await brain.start();

    const builder = brain.agent('test-stop-stream');
    const agent = await builder.start();

    builder.stop();
    await agent.close();

    await brain.stop();
  });
});