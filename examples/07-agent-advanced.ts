import { BrainOS, tool, version } from '../src/index.js';

async function main() {
  console.log(`\n=== 07-agent-advanced.ts - Agent Advanced Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const addTool = tool('Add', 'Add two numbers', (args: any) => String(args.a + args.b));

  console.log('--- BrainOS.with() static factory ---');
  const quickBuilder = brain.agent('quick');
  const quickAgent = await quickBuilder
    .with_systemPrompt('You are a calculator.')
    .with_temperature(0.5)
    .start();
  console.log('Quick agent created via BrainOS.with()');
  console.log('Quick agent tools:', quickAgent.tools);
  console.log('Quick agent config:', quickAgent.config);

  console.log('\n--- Agent stream() ---');
  let tokenCount = 0;
  const streamAgent = brain.agent('stream-demo')
    .with_tools(addTool)
    .with_maxTokens(50);

  const started = await streamAgent.start();

console.log('Streaming tokens:');
  let streamedTokens: any[] = [];
  await started.stream('What is 5 + 3?', (token) => {
    streamedTokens.push(token);
  });
  console.log('Streamed token count:', streamedTokens.length);
  console.log('First streamed token:', streamedTokens[0]);
  console.log('Last streamed token:', streamedTokens[streamedTokens.length - 1]);

  console.log('\n--- Agent streamCollect() ---');
  const tokens = await started.streamCollect('What is 10 + 20?');
  console.log('Collected', tokens.length, 'tokens');
  console.log('First token:', tokens[0]);
  console.log('Last token:', tokens[tokens.length - 1]);

  console.log('\n--- Agent metrics ---');
  const metrics = started.metrics;
  console.log('Metrics object keys:', Object.keys(metrics));
  console.log('Metrics:', JSON.stringify(metrics, null, 2));

  console.log('\n--- resetMetrics() ---');
  started.resetMetrics();
  console.log('Metrics after reset:', started.metrics);

  console.log('\n--- Agent config ---');
  console.log('Config:', started.config);
  console.log('Config model:', started.config.model);
  console.log('Config temperature:', started.config.temperature);

  console.log('\n--- Agent tools list ---');
  console.log('Tools:', started.tools);

  console.log('\n--- Resilience options ---');
  const resilientAgent = brain.agent('resilient')
    .with_tools(addTool)
    .with_resilience({
      circuitBreakerMaxFailures: 3,
      circuitBreakerCooldownSecs: 10,
      rateLimitCapacity: 5,
      rateLimitWindowSecs: 60,
      rateLimitMaxRetries: 3,
    });
  const resilientStarted = await resilientAgent.start();
  console.log('Resilient agent configured with circuit breaker + rate limiting');
  console.log('Resilient agent config:', resilientStarted.config);

  await resilientStarted.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });