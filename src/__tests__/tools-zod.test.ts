import { describe, it } from 'node:test';
import assert from 'node:assert';
import { z } from 'zod';
import { defineTool } from '../tool.js';
import { ConfigurationError } from '../errors.js';

describe('defineTool({ ... }) zod form', () => {
  const weather = defineTool({
    name: 'get_weather',
    description: 'Get the weather for a city',
    parameters: z.object({ city: z.string(), unit: z.enum(['c', 'f']).optional() }),
    execute: (args) => ({ echo: args.city }),
  });

  it('converts the zod schema to JSON Schema (no $schema, correct required)', () => {
    assert.strictEqual(weather.schema.type, 'object');
    assert.deepStrictEqual(weather.schema.required, ['city']);
    assert.strictEqual(weather.schema.properties.city.type, 'string');
    assert.strictEqual(weather.schema.properties.unit.type, 'string');
    assert.strictEqual(weather.schema.$schema, undefined);
  });

  it('accepts valid arguments and passes parsed data to execute', async () => {
    const out = await weather.callback({ city: 'Paris', unit: 'c' });
    assert.deepStrictEqual(JSON.parse(out), { echo: 'Paris' });
  });

  it('rejects invalid arguments with a structured message', async () => {
    const out = await weather.callback({ city: 42 });
    assert.match(out, /^Error: tool "get_weather" received invalid arguments/);
  });

  it('wraps thrown errors in a ToolExecutionError message', async () => {
    const boom = defineTool({
      name: 'boom',
      description: 'explodes',
      parameters: z.object({}),
      execute: () => {
        throw new Error('kaboom');
      },
    });
    const out = await boom.callback({});
    assert.match(out, /tool "boom" failed: kaboom/);
  });

  it('serializes { success: false } tool results as errors', async () => {
    const soft = defineTool({
      name: 'soft',
      description: 'soft failure',
      parameters: z.object({}),
      execute: () => ({ success: false, error: 'upstream down' }),
    });
    const out = await soft.callback({});
    assert.match(out, /tool "soft" failed: upstream down/);
  });

  it('fails fast on invalid definitions', () => {
    assert.throws(() => defineTool({ name: 'x' } as any), ConfigurationError);
    assert.throws(
      () =>
        defineTool({
          name: 'y',
          description: 'd',
          parameters: 'not-a-schema' as any,
          execute: () => '',
        }),
      ConfigurationError
    );
  });

  it('keeps the legacy builder form working', async () => {
    const legacy = defineTool('legacy', 'Legacy tool')
      .param('x', 'number', 'a number')
      .handle((args) => args.x * 2);
    const out = await legacy.callback({ x: 21 });
    assert.strictEqual(out, '42');
    assert.strictEqual(legacy.schema.type, 'object');
  });
});
