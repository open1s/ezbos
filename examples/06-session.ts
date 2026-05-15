import { initTracing } from '@open1s/jsbos';
import { BrainOS, defineTool, version } from '../src/index.js';

initTracing();

async function main() {
  console.log(`\n=== 06-session.ts - Session API Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const greetingTool = defineTool('Greet', 'Greet someone')
    .required('name', 'string', 'Name of the person to greet')
    .handle((args: any) => `Hello, ${args.name}!`);

  const agent = brain.agent('session-demo')
    .with_tools(greetingTool)
    .with_systemPrompt('You are a friendly assistant.');

  const started = await agent.start();

  console.log('--- Multi-turn conversation ---');

  await started.ask('My name is Alice');
  console.log('After Q1, session chars:', started.exportSession().length);

  await started.ask('What is 2 + 2?');
  console.log('After Q2, session chars:', started.exportSession().length);

  await started.ask('What is my name?');
  console.log('After Q3, session chars:', started.exportSession().length);

  console.log('\n--- Session compact (LLM summary) ---');
  const sessionBefore = started.exportSession().length;
  console.log('Session before compact:', sessionBefore, 'chars');

  await started.compactSession();
  const afterCompact = started.exportSession().length;
  console.log('After compactSession:', afterCompact, 'chars');

  console.log('\n--- Verify compact worked ---');
  const verifyResult = await started.ask('What is my name?');
  console.log('Verify:', verifyResult.trim());

  console.log('\n--- Session export / import ---');
  const json = started.exportSession();
  console.log('Export (first 150 chars):', json.substring(0, 150), '...');

  console.log('\n--- SessionManager fluent API ---');
  const agent2 = brain.agent('session-demo-2')
    .with_tools(greetingTool)
    .with_systemPrompt('You are a friendly assistant.');
  const started2 = await agent2.start();

  await started2.ask('Say hello to Bob');
  const sessionJson = started2.exportSession();
  console.log('Session before import length:', sessionJson.length);

  started2.clearSession();
  console.log('After clear, length:', started2.exportSession().length);

  started2.importSession(sessionJson);
  console.log('After import, length:', started2.exportSession().length);

  await started.close();
  await started2.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });