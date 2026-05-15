import { BrainOS, defineTool, tool, ok, err, isErrorResult, version } from '../src/index.js';

import {initTracing} from "@open1s/jsbos";

// initTracing();

const addTool = defineTool('Add', 'Add two numbers')
  .required('a', 'number', 'First number')
  .required('b', 'number', 'Second number')
  .handle((args: any) => { console.error('Adding numbers:', args.a, args.b); return args.a + args.b; });

const multiplyTool = defineTool('Multiply', 'Multiply two numbers')
  .required('x', 'number', 'First number')
  .required('y', 'number', 'Second number')
  .handle((args: any) => { console.error('Multiplying numbers:', args.x, args.y); return args.x * args.y; });

const stringConcatTool = defineTool('Concat', 'Concatenate two strings')
  .param('str1', 'string', 'First string')
  .param('str2', 'string', 'Second string')
  .param('separator', 'string', 'Separator', ', ')
  .handle((args: any) => { console.error('Concatenating strings:', args.str1, args.str2, args.separator); return args.str1 + args.separator + args.str2; });

const divideTool = defineTool('Divide', 'Divide two numbers')
  .required('n', 'number', 'Numerator')
  .required('d', 'number', 'Denominator')
  .handle((args: any) => {
    console.error('Dividing numbers:', args.n, args.d);
    if (args.d === 0) return err('Division by zero');
    return ok(args.n / args.d);
  });

const asyncWeatherTool = defineTool('Weather', 'Get weather for a city')
  .required('city', 'string', 'City name')
  .handle((args: any) => {
    console.error('Fetching weather for city:', args.city);
    return ok({ city: args.city, temp: 22, condition: 'sunny', unit: 'celsius' });
  });

const errorTool = tool('Fail', 'Always returns an error', () => {
  throw new Error('Intentional failure from errorTool');
});

async function main() {
  console.log(`\n=== 01-tools.ts - Tool API Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const agent = brain.agent('tools-demo')
    .with_tools(addTool, multiplyTool, stringConcatTool, divideTool, asyncWeatherTool, errorTool);

  const started = await agent.start();

  const tests = [
    { q: 'What is 15 + 27?', expect: 42 },
    { q: 'What is 8 times 6?', expect: 48 },
    { q: 'Concatenate "Brain" and "OS" with separator "-"', expect: 'Brain-OS' },
    { q: 'Divide 100 by 4', expect: 25 },
    { q: 'Divide 10 by 0', expect: 'error' },
    { q: 'What is the weather in Tokyo?', expect: 'ok' },
  ];

  for (const t of tests) {
    console.log(`\nQ: ${t.q}`);
    console.log(`   Expected: ${t.expect}`);
    const result = await started.ask(t.q);
    console.log(`   A: ${result}`);
  }

  console.log('\n--- Tool definitions ---');
  console.log('addTool schema:', JSON.stringify((addTool as any).schema, null, 2));

  console.log('\n--- isErrorResult demo ---');
  const okResult = ok(42);
  const errResult = err('bad');
  console.log('ok(42):', okResult, 'isErrorResult:', isErrorResult(okResult));
  console.log('err("bad"):', errResult, 'isErrorResult:', isErrorResult(errResult));

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });