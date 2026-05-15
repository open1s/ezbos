import { BrainOS, version } from '../src/index.js';

async function main() {
  console.log(`\n=== 08-brainos-messaging.ts - Messaging Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  console.log('--- Query/Queryable pattern ---');
  const queryServer = await brain.queryable('math-query', (input: string) => {
    console.log('[Queryable] Received:', input);
    const n = parseInt(input);
    if (isNaN(n)) return 'Error: invalid number';
    return String(n * n);
  });
  await queryServer.start();

  const queryClient = await brain.query('math-query');
  const response = await queryClient.ask('42', 5000);
  console.log('[QueryClient] Response for 42:', response);

  console.log('\n--- Caller/Callable pattern ---');
  const callableServer = await brain.callable('rpc-add', (input: string) => {
    console.log('[Callable] Received:', input);
    const parts = input.split(',');
    if (parts.length !== 2) return 'Error: need two numbers separated by comma';
    return String(parseInt(parts[0]) + parseInt(parts[1]));
  });
  await callableServer.start();

  const callerClient = await brain.caller('rpc-add');
  const callResult = await callerClient.call('10,20');
  console.log('[CallerClient] Result for 10,20:', callResult);

  console.log('\n--- Publisher/Subscriber pattern (recv) ---');
  const sub1 = await brain.subscriber('test-topic');
  console.log('Subscriber topic:', sub1.topic);

  const pub = await brain.publisher('test-topic');
  console.log('Publisher topic:', pub.topic);
  await pub.text('Hello from PublisherWrapper!');
  await pub.json({ msg: 'structured', value: 123 });
  console.log('Published via PublisherWrapper.text() and .json()');

  console.log('Waiting for messages...');
  const msg1 = await sub1.recv(3000);
  console.log('[Subscriber] Received 1:', msg1);
  const msg2 = await sub1.recv(3000);
  console.log('[Subscriber] Received 2:', msg2);
  await sub1.stop();

  console.log('\n--- Publisher/Subscriber pattern (run) ---');
  const sub2 = await brain.subscriber('run-topic');
  const pub2 = await brain.publisher('run-topic');

  console.log('Starting subscriber with run()...');
  const runPromise = sub2.run((msg) => {
    console.log('[Subscriber.run] Received:', msg);
  });

  await pub2.text('Message 1 via run');
  await pub2.text('Message 2 via run');
  await pub2.json({ action: 'test', id: 42 });

  await new Promise(r => setTimeout(r, 1000));
  await sub2.stop();
  await runPromise;

  console.log('\n--- Agent with messaging integration ---');
  const agent = brain.agent('messaging-demo')
    .with_systemPrompt('You are a helpful assistant. When asked about messaging, explain the patterns.');

  const started = await agent.start();
  const messagingResult = await started.ask('Explain the difference between Query and Publisher messaging patterns.');
  console.log('Agent response:', messagingResult);

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });