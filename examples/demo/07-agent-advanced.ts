import { BrainOS, tool, version } from '@open1s/ezbos';

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

  console.log('\n--- Agent stream() - Real-time chat ---');
  const streamAgent = brain.agent('stream-demo')
    .with_tools(addTool)
    .with_systemPrompt('You are a helpful assistant.');

  const started = await streamAgent.start();

  console.log('Streaming response:');
  let streamedText = '';
  await started.stream('What is 5 + 3? And what is the capital of France?', (token) => {
     if(token.type === 'Text') {
        process.stdout.write(token.text);
     }
     if(token.type === 'ReasoningContent') {
        process.stdout.write(token.text);
     }
  });
  console.log('\n\nStreamed text length:', streamedText.length);

  console.log('\n--- Agent streamCollect() ---');
  const tokens = await started.streamCollect('What is 10 + 20?');
  console.log('Collected', tokens.length, 'tokens');
  const textTokens = tokens.filter(t => t.text);
  console.log('Text tokens:', textTokens.length);
  if (textTokens.length > 0) {
    console.log('Collected text:', textTokens.map(t => t.text).join(''));
  }

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

  console.log('\n--- Agent.stop() - Stop running agent ---');
  const stopAgent = brain.agent('stop-demo')
    .with_systemPrompt('You are a helpful assistant that responds slowly.');
  
  const stoppable = await stopAgent.start();
  console.log('Agent started, calling stop()...');
  stopAgent.stop();
  console.log('Agent stopped successfully');
  console.log('Agent tools:', stoppable.tools);

  await stoppable.close();

  await resilientStarted.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
