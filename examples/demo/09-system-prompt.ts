import { BrainOS, tool, version } from '@open1s/ezbos';

async function main() {
  console.log(`\n=== 09-system-prompt.ts - System Prompt Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  console.log('--- Default system prompt ---');
  const defaultAgent = await brain.agent('default-prompt').start();
  console.log('Default systemPrompt:', defaultAgent.config.systemPrompt);
  await defaultAgent.close();

  console.log('\n--- with_systemPrompt() - Custom persona ---');
  const poet = await brain.agent('poet')
    .with_systemPrompt('You are a poet who always responds in haiku (5-7-5 syllables).')
    .start();
  const haiku = await poet.ask('Describe the weather today.');
  console.log('Poet says:', haiku.trim());
  await poet.close();

  console.log('\n--- with_prompt() alias for with_systemPrompt() ---');
  const chef = await brain.agent('chef')
    .with_prompt('You are a chef. Always recommend a dish and briefly explain why.')
    .start();
  const dish = await chef.ask('I have chicken, rice, and tomatoes in my kitchen.');
  console.log('Chef says:', dish.trim());
  await chef.close();

  console.log('\n--- System prompt passed via AgentBuilder constructor ---');
  const tutor = await brain.agent('tutor', {
    systemPrompt: 'You are a math tutor. Explain your reasoning step by step.',
  }).start();
  const lesson = await tutor.ask('What is 12 multiplied by 9?');
  console.log('Tutor says:', lesson.trim());
  await tutor.close();

  console.log('\n--- System prompt constraining tool-using agent ---');
  const addTool = tool('Add', 'Add two numbers', (args: any) => String(args.a + args.b));
  const calculator = await brain.agent('calculator')
    .with_tools(addTool)
    .with_systemPrompt('You are a strict calculator. You MUST use the Add tool for every arithmetic question. Never compute in your head.')
    .start();
  const total = await calculator.ask('What is 17 + 25?');
  console.log('Calculator says:', total.trim());
  await calculator.close();

  console.log('\n--- stream() with system prompt ---');
  const streamAgent = await brain.agent('stream-prompt-demo')
    .with_systemPrompt('You are a concise assistant. Always answer in one or two short sentences.')
    .start();
  console.log('Streaming response:');
  await streamAgent.stream('What is the capital of Japan?', (token) => {
    if (token.type === 'Text') process.stdout.write(token.text);
    if (token.type === 'ReasoningContent') process.stdout.write(token.text);
  });
  console.log();
  await streamAgent.close();

  console.log('\n--- streamCollect() with system prompt ---');
  const collector = await brain.agent('stream-collect-demo')
    .with_prompt('You are a poet. Always answer in exactly one short sentence.')
    .start();
  const tokens = await collector.streamCollect('Describe the ocean in one sentence.');
  const textTokens = tokens.filter(t => t.text);
  console.log('Collected', tokens.length, 'tokens (', textTokens.length, 'with text)');
  console.log('Text:', textTokens.map(t => t.text).join(''));
  await collector.close();

  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
