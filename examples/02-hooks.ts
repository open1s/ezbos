import { BrainOS, defineHook, hook, mergeHooks, createHookRegistry, HookEvent, version } from '../src/index.js';

const beforeHook = defineHook(HookEvent.BeforeToolCall, (ctx: any) => {
  console.log(`  [BeforeToolCall] ${ctx.data?.tool_name}`);
  return 'continue';
});

const afterHook = defineHook(HookEvent.AfterToolCall, (ctx: any) => {
  console.log(`  [AfterToolCall] completed`);
  return 'continue';
});

const beforeLlmHook = defineHook(HookEvent.BeforeLlmCall, (ctx: any) => {
  console.log(`  [BeforeLlmCall]`);
  return 'continue';
});

const afterLlmHook = defineHook(HookEvent.AfterLlmCall, (ctx: any) => {
  console.log(`  [AfterLlmCall]`);
  return 'continue';
});

const onMessageHook = defineHook(HookEvent.OnMessage, (ctx: any) => {
  console.log(`  [OnMessage] ${ctx.data?.message?.substring(0, 50)}`);
  return 'continue';
});

const onCompleteHook = defineHook(HookEvent.OnComplete, (ctx: any) => {
  console.log(`  [OnComplete]`);
  return 'continue';
});

const onErrorHook = defineHook(HookEvent.OnError, (ctx: any) => {
  console.log(`  [OnError] ${ctx.data?.error}`);
  return 'continue';
});

async function main() {
  console.log(`\n=== 02-hooks.ts - Hook API Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const addTool = { name: 'Add', description: 'Add', schema: { properties: { a: {}, b: {} } }, callback: () => '42' };

  console.log('--- All HookEvent values ---');
  console.log('HookEvent.BeforeToolCall:', HookEvent.BeforeToolCall);
  console.log('HookEvent.AfterToolCall:', HookEvent.AfterToolCall);
  console.log('HookEvent.BeforeLlmCall:', HookEvent.BeforeLlmCall);
  console.log('HookEvent.AfterLlmCall:', HookEvent.AfterLlmCall);
  console.log('HookEvent.OnMessage:', HookEvent.OnMessage);
  console.log('HookEvent.OnComplete:', HookEvent.OnComplete);
  console.log('HookEvent.OnError:', HookEvent.OnError);

  console.log('\n--- mergeHooks ---');
  const allHooks = mergeHooks(
    beforeHook, afterHook, beforeLlmHook, afterLlmHook,
    onMessageHook, onCompleteHook, onErrorHook
  );
  console.log(`Merged ${allHooks.length} hooks`);

  console.log('\n--- defineHook returns ---');
  console.log('beforeHook:', beforeHook);
  console.log('afterHook:', afterHook);

  const agent = brain.agent('hooks-demo')
    .with_tools(addTool)
    .with_hooks(beforeHook, afterHook, beforeLlmHook, afterLlmHook);

  const started = await agent.start();

  console.log('\n--- Running agent with hooks ---');
  const result = await started.ask('What is 10 + 20? Use the Add tool.');
  console.log(`Result: ${result}`);

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });