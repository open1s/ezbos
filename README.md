# @open1s/ezbos

Simple BrainOS - Easy wrapper for [@open1s/jsbos](https://www.npmjs.com/package/@open1s/jsbos). Build AI agents with tools, hooks, plugins, MCP, skills, and messaging.

## Install

```bash
npm install @open1s/ezbos
```

## Quick Start

```ts
import { BrainOS, tool } from '@open1s/ezbos';

const brain = new BrainOS();
await brain.start();

const addTool = tool('Add', 'Add two numbers', (args) => String(args.a + args.b));

const agent = brain.agent('assistant')
  .with_tools(addTool)
  .with_systemPrompt('You are a helpful assistant.');

const started = await agent.start();
const result = await started.ask('What is 5 + 3?');
console.log(result);

await started.close();
await brain.stop();
```

## Core API

### BrainOS

The main entry point. Manages the message bus and agent lifecycle.

```ts
const brain = new BrainOS({ model?: string, baseUrl?: string, apiKey?: string });
await brain.start();
await brain.stop();
```

### Agent Builder

Fluent builder for creating agents.

```ts
const agent = brain.agent('name')
  .with_systemPrompt('You are helpful.')
  .with_model('nvidia/meta/llama-3.1-8b-instruct')
  .with_baseUrl('https://integrate.api.nvidia.com/v1')
  .with_apiKey('your-key')
  .with_temperature(0.7)
  .with_timeout(120)
  .with_maxTokens(4096)
  .with_tools(tool1, tool2)
  .with_hooks(hook1, hook2)
  .with_plugins(plugin1)
  .with_mcp_process('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'])
  .with_mcp_http('math', 'http://127.0.0.1:8000/mcp')
  .with_skills_dir('./skills')
  .with_skills({ name: 'Code Review', content: '...' })
  .with_resilience({ circuitBreakerMaxFailures: 3, rateLimitCapacity: 5 });

const started = await agent.start();
```

### Agent (Started)

The running agent instance.

```ts
// LLM calls
const result = await started.ask('Hello');
const result2 = await started.react('Task');
const result3 = await started.runSimple('Simple task');

// Streaming
await started.stream('Task', (token) => {
  if (token.text) process.stdout.write(token.text);
});
const tokens = await started.streamCollect('Task');

// Session management
await started.compactSession();    // AI-powered session compaction
started.saveSession('./session.json');
started.restoreSession('./session.json');
started.clearSession();
const json = started.exportSession();
started.importSession(json);

// Metrics
const metrics = started.metrics;
started.resetMetrics();

// Info
console.log(started.tools);    // ['Tool1', 'Tool2']
console.log(started.config);   // { model, baseUrl, ... }

await started.close();
```

### Tools

Define tools the LLM can call.

```ts
import { tool, defineTool, ok, err } from '@open1s/ezbos';

// Simple tool
const add = tool('Add', 'Add two numbers', (args) => String(args.a + args.b));

// Builder API with schema
const greet = defineTool('Greet', 'Greet someone')
  .required('name', 'string', 'Name to greet')
  .optional('language', 'string', 'Language code', 'en')
  .handle((args) => `Hello, ${args.name}!`);

// Result helpers
const success = ok({ value: 42 }, { cached: true });
const failure = err('Not found', { code: 404 });
```

### Hooks

Intercept agent lifecycle events.

```ts
import { HookEvent, defineHook } from '@open1s/ezbos';

const hook = defineHook(HookEvent.BeforeToolCall, (ctx) => {
  console.log('About to call:', ctx.toolName);
  return 'continue';  // or 'abort'
});

agent.with_hooks(hook);
```

Events: `BeforeToolCall`, `AfterToolCall`, `BeforeLlmCall`, `AfterLlmCall`, `OnMessage`, `OnComplete`, `OnError`

### Plugins

Register plugins for LLM/tool lifecycle events.

```ts
const plugin = {
  name: 'logger',
  on_llm_request: (req) => console.log('LLM request:', req),
  on_llm_response: (res) => console.log('LLM response:', res),
  on_tool_call: (call) => console.log('Tool call:', call),
  on_tool_result: (result) => console.log('Tool result:', result),
};

agent.with_plugins(plugin);
```

### MCP

Connect to MCP servers.

```ts
// Process-based MCP
agent.with_mcp_process('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);

// HTTP-based MCP
agent.with_mcp_http('math', 'http://127.0.0.1:8000/mcp');
```

### Skills

Add domain-specific instructions to the system prompt.

```ts
// Directory-based (auto-discovers SKILL.md files)
agent.with_skills_dir('./skills');

// Inline skills
agent.with_skills({
  name: 'Code Review',
  content: 'When reviewing code, check for: security, performance, readability...'
});
```

### Messaging

Pub/sub, query, and RPC patterns via the message bus.

```ts
// Publisher / Subscriber
const pub = await brain.publisher('events');
await pub.text('Hello');
await pub.json({ event: 'click', x: 100 });

const sub = await brain.subscriber('events');
const msg = await sub.recv(3000);           // recv with timeout
await sub.run((msg) => console.log(msg));   // continuous processing
await sub.stop();

// Query / Queryable (request-response)
const server = await brain.queryable('math', (input) => String(parseInt(input) * 2));
await server.start();

const client = await brain.query('math');
const response = await client.ask('21');  // "42"

// Caller / Callable (RPC)
const rpcServer = await brain.callable('add', (input) => {
  const [a, b] = input.split(',').map(Number);
  return String(a + b);
});
await rpcServer.start();

const rpcClient = await brain.caller('add');
const result = await rpcClient.call('10,20');  // "30"
```

### Quick Agent

One-liner to create and start an agent.

```ts
const agent = await BrainOS.with('assistant', { model: '...', apiKey: '...' });
const result = await agent.ask('Hello');
await agent.close();
```

## Examples

```bash
npm run example:tools      # Tool definitions and execution
npm run example:hooks      # Lifecycle hooks
npm run example:plugins    # Plugin system
npm run example:mcp        # MCP server integration
npm run example:skills     # Skills and skill directories
npm run example:session    # Session management + AI compaction
npm run example:agent      # Streaming, metrics, resilience
npm run example:messaging  # Pub/sub, query, RPC patterns
```

## Configuration

Place a `brainos.json` in your project root:

```json
{
  "global_model": {
    "model": "nvidia/meta/llama-3.1-8b-instruct",
    "base_url": "https://integrate.api.nvidia.com/v1",
    "api_key": "your-key"
  }
}
```

BrainOS auto-discovers this config on `start()`.

## License

MIT
