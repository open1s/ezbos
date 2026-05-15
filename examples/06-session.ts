import { BrainOS, defineTool, version } from '../src/index.js';

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

  console.log('--- Session persistence (multi-turn conversation) ---');

  await started.ask('My name is Alice');
  console.log('After Q1, session chars:', started.session.export().length);

  await started.ask('What is 2 + 2?');
  console.log('After Q2, session chars:', started.session.export().length);

  await started.ask('What is my name?');
  console.log('After Q3, session chars:', started.session.export().length);

  console.log('\n--- Session compact ---');
  const beforeCompact = started.session.export().length;
  started.session.compact(2, 500);
  const afterCompact = started.session.export().length;
  console.log(`Before compact: ${beforeCompact} chars`);
  console.log(`After compact: ${afterCompact} chars`);

  console.log('\n--- Session export / import ---');
  const json = started.session.export();
  console.log('Export (first 200 chars):', json.substring(0, 200), '...');

  console.log('\n--- Session clear ---');
  started.session.clear();
  console.log('Session cleared, export length:', started.session.export().length);

  console.log('\n--- SessionManager methods (fluent API) ---');
  const agent2 = brain.agent('session-demo-2')
    .with_tools(greetingTool)
    .with_systemPrompt('You are a friendly assistant.');
  const started2 = await agent2.start();

  await started2.ask('Say hello to Bob');
  const sessionJson = started2.session.export();
  console.log('Session before import length:', sessionJson.length);

  started2.session.clear();
  console.log('After clear, length:', started2.session.export().length);

  started2.session.import(sessionJson);
  console.log('After import, length:', started2.session.export().length);

  await started.close();
  await started2.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });