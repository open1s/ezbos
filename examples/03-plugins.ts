import { BrainOS, definePlugin, plugin, on_llm_request, on_llm_response, on_tool_call, on_tool_result, mergePlugins, getPluginHandlers, version } from '../src/index.js';

const plainPlugin = definePlugin({
  name: 'plain-plugin',
  on_llm_request(req: any) { console.log('  [Plain Plugin] LLM request:', req.model); return req; },
  on_llm_response(resp: any) { console.log('  [Plain Plugin] LLM response'); return resp; },
  on_tool_call(call: any) { console.log('  [Plain Plugin] Tool call:', call.name); return call; },
  on_tool_result(result: any) { console.log('  [Plain Plugin] Tool result:', String(result).slice(0, 30)); return result; },
});

const pluginA = definePlugin({
  name: 'plugin-a',
  on_llm_request(req: any) { console.log('  [Plugin A] LLM request'); return req; },
});

const pluginB = definePlugin({
  name: 'plugin-b',
  on_tool_result(result: any) { console.log('  [Plugin B] Tool result:', String(result).slice(0, 30)); return result; },
});

class DecoratedPlugin {
  __pluginName = 'decorated-plugin';

  on_llm_request(req: any) {
    console.log('  [Decorated] LLM request');
    return req;
  }

  on_llm_response(resp: any) {
    console.log('  [Decorated] LLM response');
    return resp;
  }

  on_tool_call(call: any) {
    console.log('  [Decorated] Tool call:', call.name);
    return call;
  }

  on_tool_result(result: any) {
    console.log('  [Decorated] Tool result');
    return result;
  }
}

async function main() {
  console.log(`\n=== 03-plugins.ts - Plugin API Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const addTool = { name: 'Add', description: 'Add', schema: { properties: { a: {}, b: {} } }, callback: () => '42' };

  console.log('--- definePlugin ---');
  console.log('plainPlugin name:', plainPlugin.name);
  console.log('pluginA name:', pluginA.name);
  console.log('pluginB name:', pluginB.name);

  console.log('\n--- mergePlugins ---');
  const merged = mergePlugins(pluginA, pluginB, plainPlugin);
  console.log(`Merged ${merged.length} plugins:`, merged.map(p => p.name));

  console.log('\n--- getPluginHandlers from class instance ---');
  const decorated = new DecoratedPlugin();
  const handlers = getPluginHandlers(decorated);
  console.log('DecoratedPlugin handlers extracted:', handlers);

  console.log('\n--- Agent with merged plugins ---');
  const agent = brain.agent('plugins-demo')
    .with_tools(addTool)
    .with_plugins(plainPlugin);

  const started = await agent.start();
  console.log('Running agent with plainPlugin...');
  await started.ask('What is 1 + 1?');

  console.log('\n--- Agent with decorated class plugin ---');
  const agent2 = brain.agent('plugins-demo-2')
    .with_tools(addTool)
    .with_plugins(decorated);

  const started2 = await agent2.start();
  await started2.ask('Hello');

  await started.close();
  await started2.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });