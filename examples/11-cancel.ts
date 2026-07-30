import { BrainOS, defineTool, tool, ok, version } from '../src/index.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const slowOp = defineTool('slowOp', 'A slow ~7s operation. Cancelable.')
  .required('key', 'string', 'A key to process')
  .cancelable()
  .onCancel((callId) => {
    console.error(`  [onCancel] invoked with call_id=${callId}`);
  })
  .handle(async (args: any) => {
    const key = args.key;
    console.error(`slowOp starting: key=${key} (sleeping 7s)`);
    await sleep(7000);
    return ok({ key, result: 'done' });
  });

const fastOp = tool('fastOp', 'Instant operation', (args: any) => {
  return ok({ key: args.key, result: 'instant' });
});

async function main() {
  console.log(`\n=== 11-cancel.ts — Cancellation Demo (v${version()}) ===\n`);

  const brain = new BrainOS();
  await brain.start();

  const agentName = 'cancel-demo';
  const cancelTopic = `agent/${agentName}/tool/cancel`;
  const eventsTopic = `agent/${agentName}/tool/events`;

  console.log(`  Agent name:    ${agentName}`);
  console.log(`  Cancel topic:  ${cancelTopic}`);
  console.log(`  Events topic:  ${eventsTopic}\n`);

  const agent = brain
    .agent(agentName)
    .with_tools(slowOp, fastOp)
    .with_systemPrompt(
      'You are a test assistant. Use slowOp exactly once ' +
      'with key "demo-key", then tell me the result.'
    );

  const started = await agent.start();

  const eventsSub = await brain.subscriber(eventsTopic);
  const activeCallIds: string[] = [];

  eventsSub.runJson((data: any) => {
    const { call_id, tool, status } = data;
    console.error(`[lifecycle] ${status}: ${tool} (call_id=${call_id})`);
    if (status === 'started') activeCallIds.push(call_id);
  });

  const askPromise = started
    .ask('Use slowOp with key "demo-key".')
    .catch((e: any) => e);

  let cancelCallId: string | null = null;
  for (let i = 0; i < 600 && !cancelCallId; i++) {
    await sleep(100);
    if (activeCallIds.length > 0) {
      cancelCallId = activeCallIds[0];
    }
  }

  if (cancelCallId) {
    console.error(`\n>>> Publishing cancel to topic: ${cancelTopic}`);
    console.error(`>>> Cancelling call_id=${cancelCallId}`);
    await brain.publish(cancelTopic, { call_id: cancelCallId }, true);
  } else {
    console.error(`\n>>> No running call_id found (waited 60s)`);
  }

  const result = await askPromise;
  console.log(`\n--- Agent response ---`);
  console.log(result?.text ?? result);

  await eventsSub.stop();
  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e: any) => { console.error(e); process.exit(1); });