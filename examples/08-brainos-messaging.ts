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

  console.log('\n--- PublisherWrapper ---');
  const pub = await brain.publisher('test-topic');
  console.log('Publisher topic:', pub.topic);
  await pub.text('Hello from PublisherWrapper!');
  await pub.json({ msg: 'structured', value: 123 });
  console.log('Published via PublisherWrapper.text() and .json()');

  console.log('\n--- SubscriberWrapper recv ---');
  const sub = await brain.subscriber('test-topic');
  console.log('Subscriber topic:', sub.topic);
  const msg = await sub.recv(3000);
  console.log('[Subscriber] Received:', msg);
  await sub.stop();

  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });