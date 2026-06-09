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

BrainOS auto-discovers this config on `start()`. You can also pass options directly:

```ts
const brain = new BrainOS({
  model: 'nvidia/meta/llama-3.1-8b-instruct',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: 'nvapi-xxx',
});
await brain.start();
```

## Agent Builder

Fluent builder for creating agents:

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

## Multimodal Content

Send images, audio, and other binary content alongside text.

```ts
import { Content, ContentPart, Binary } from '@open1s/ezbos';

// Text only
const textContent = Content.text('What is 2 + 2?');

// Single image (URL)
const imageContent = Content.image('https://example.com/photo.jpg');

// Audio from base64 data
const audioContent = Content.audio(base64Data, 'mp3');

// Multi-part: text + image
const multiContent = Content.parts([
  ContentPart.text('Describe this image'),
  ContentPart.image('https://example.com/photo.jpg'),
]);

// Pass to any LLM method
const result = await agent.ask(multiContent);
await agent.stream(multiContent, (token) => {
  if (token.type === 'Text') process.stdout.write(token.text);
});
```

### Content API

| Method | Description |
|--------|-------------|
| `Content.text(text)` | Simple text content |
| `Content.image(url, name?)` | Single image (URL) |
| `Content.audio(data, format)` | Single audio (base64) |
| `Content.audioUrl(url, format)` | Single audio (URL) |
| `Content.parts([...])` | Multi-part content |

### ContentPart API

| Method | Description |
|--------|-------------|
| `ContentPart.text(text)` | Create text part |
| `ContentPart.image(url, name?)` | Create image part |
| `ContentPart.audio(data, format)` | Create audio part (base64) |
| `ContentPart.audioUrl(url, format)` | Create audio part (URL) |
| `ContentPart.binary(type, data, name?)` | Create binary part |

### Resilience

Configure circuit breaker and rate limiting:

```ts
agent.with_resilience({
  circuitBreakerMaxFailures: 3,    // trip after 3 failures
  circuitBreakerCooldownSecs: 10,  // wait 10s before retry
  rateLimitCapacity: 5,            // allow 5 requests
  rateLimitWindowSecs: 60,         // per 60 seconds
  rateLimitMaxRetries: 3,          // retry 3 times when limited
});
```

## Tools

Define tools the LLM can call.

### Simple Tool

```ts
import { tool } from '@open1s/ezbos';

const add = tool('Add', 'Add two numbers', (args) => String(args.a + args.b));
```

### Tool Builder

For tools with schema and optional parameters:

```ts
import { defineTool, ok, err } from '@open1s/ezbos';

const greet = defineTool('Greet', 'Greet someone')
  .required('name', 'string', 'Name to greet')
  .param('language', 'string', 'Language code', 'en')
  .handle((args) => `Hello, ${args.name}!`);

const divide = defineTool('Divide', 'Divide two numbers')
  .required('n', 'number', 'Numerator')
  .required('d', 'number', 'Denominator')
  .handle((args) => {
    if (args.d === 0) return err('Division by zero');
    return ok(args.n / args.d);
  });
```

### Result Helpers

```ts
const success = ok({ value: 42 }, { cached: true });
const failure = err('Not found', { code: 404 });
```

**Note:** Tool callbacks must be synchronous. The underlying jsbos native layer does not support async tool callbacks.

## Hooks

Intercept agent lifecycle events.

```ts
import { HookEvent, defineHook } from '@open1s/ezbos';

const logHook = defineHook(HookEvent.BeforeToolCall, (ctx) => {
  console.log('About to call:', ctx.data?.tool_name);
  return 'continue';  // or 'abort'
});

agent.with_hooks(logHook);
```

Available events:

| Event | Description |
|-------|-------------|
| `BeforeToolCall` | Before a tool is invoked |
| `AfterToolCall` | After a tool returns |
| `BeforeLlmCall` | Before sending to LLM |
| `AfterLlmCall` | After receiving from LLM |
| `OnMessage` | On each message |
| `OnComplete` | When task completes |
| `OnError` | On error |

### Merge Hooks

```ts
import { mergeHooks } from '@open1s/ezbos';

const allHooks = mergeHooks(beforeHook, afterHook, beforeLlmHook);
agent.with_hooks(allHooks);
```

## Plugins

Register plugins for LLM/tool lifecycle events.

### Plain Plugin

```ts
import { definePlugin } from '@open1s/ezbos';

const loggerPlugin = definePlugin({
  name: 'logger',
  on_llm_request: (req) => { console.log('LLM request:', req.model); return req; },
  on_llm_response: (resp) => { console.log('LLM response'); return resp; },
  on_tool_call: (call) => { console.log('Tool call:', call.name); return call; },
  on_tool_result: (result) => { console.log('Tool result'); return result; },
});

agent.with_plugins(loggerPlugin);
```

### Class-based Plugin

```ts
import { getPluginHandlers } from '@open1s/ezbos';

class MyPlugin {
  __pluginName = 'my-plugin';

  on_llm_request(req: any) { return req; }
  on_llm_response(resp: any) { return resp; }
  on_tool_call(call: any) { return call; }
  on_tool_result(result: any) { return result; }
}

const plugin = new MyPlugin();
const handlers = getPluginHandlers(plugin);
agent.with_plugins(plugin);
```

### Merge Plugins

```ts
import { mergePlugins } from '@open1s/ezbos';

const merged = mergePlugins(pluginA, pluginB);
agent.with_plugins(merged);
```

## MCP

Connect to MCP (Model Context Protocol) servers.

### Process-based

```ts
import { defineMcpProcess } from '@open1s/ezbos';

const config = defineMcpProcess('files', 'npx', [
  '-y', '@modelcontextprotocol/server-filesystem', '/tmp'
]);

agent.with_mcp_process('files', 'npx', [
  '-y', '@modelcontextprotocol/server-filesystem', '/tmp'
]);
```

### HTTP-based

```ts
import { defineMcpHttp } from '@open1s/ezbos';

const config = defineMcpHttp('hello-mcp', 'http://127.0.0.1:8000/mcp');

agent.with_mcp_http('hello-mcp', 'http://127.0.0.1:8000/mcp');
```

### MCP Builder

```ts
import { McpBuilder } from '@open1s/ezbos';

const configs = new McpBuilder()
  .process('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'])
  .http('hello-mcp', 'http://127.0.0.1:8000/mcp')
  .build();
```

### List MCP Tools

```ts
const mcpTools = await started.listMcpTools();
console.log(`MCP tools available: ${mcpTools.length}`);
```

## Skills

Add domain-specific instructions to the system prompt.

### Define Skill

```ts
import { defineSkill } from '@open1s/ezbos';

const skill = defineSkill('math-expert', 'You are a math expert. Always show your work step by step.');
```

### Directory-based

Auto-discovers `SKILL.md` files in a directory:

```ts
agent.with_skills_dir('./skills');
```

Directory structure:
```
skills/
  code-review/
    SKILL.md
```

### Skills Builder

```ts
import { SkillsBuilder } from '@open1s/ezbos';

const built = new SkillsBuilder()
  .from_dir('./skills')
  .add('code-review', 'You are a code reviewer. Be thorough.')
  .add('api-design', 'You are an API designer. Follow REST best practices.')
  .build();
```

## Agent (Started)

The running agent instance.

### LLM Calls

```ts
// ReAct loop (tools + reasoning)
const result = await started.ask('What is 5 + 3?');

// ReAct with explicit task
const result2 = await started.react('Calculate the sum');

// Simple LLM call (no tools)
const result3 = await started.runSimple('Say hello');
```

All methods accept multimodal content (text, images, audio):

```ts
import { Content, ContentPart } from '@open1s/ezbos';

// Text + image
const content = Content.parts([
  ContentPart.text('What do you see?'),
  ContentPart.image('https://example.com/photo.jpg'),
]);
const result = await started.ask(content);

// Image only
const imageOnly = Content.image('https://example.com/photo.jpg');
await started.stream(imageOnly, (token) => {
  if (token.type === 'Text') process.stdout.write(token.text);
});
```

### Streaming

```ts
// Stream tokens
await started.stream('Task', (token) => {
  if (token.type === 'Text') process.stdout.write(token.text);
  if (token.type === 'ReasoningContent') process.stdout.write(token.text);
});

// Collect all tokens
const tokens = await started.streamCollect('Task');
const text = tokens.filter(t => t.text).map(t => t.text).join('');
```

### Session Management

```ts
// AI-powered compaction (replaces old messages with LLM summary)
await started.compactSession();

// Save/restore
started.saveSession('./session.json');
started.restoreSession('./session.json');

// Clear
started.clearSession();

// Export/import as JSON
const json = started.exportSession();
started.importSession(json);
```

### Metrics

```ts
const metrics = started.metrics;
console.log(metrics.llmCallCount);
console.log(metrics.toolInvocationCount);
console.log(metrics.totalWallTimeUs);

started.resetMetrics();
```

### Info

```ts
console.log(started.tools);    // ['Add', 'Greet']
console.log(started.config);   // { model, baseUrl, temperature, ... }
```

## Messaging

Pub/sub, query, and RPC patterns via the message bus.

### Publisher / Subscriber

```ts
// Publisher
const pub = await brain.publisher('events');
await pub.text('Hello');
await pub.json({ event: 'click', x: 100 });

// Subscriber - recv with timeout
const sub = await brain.subscriber('events');
const msg = await sub.recv(3000);

// Subscriber - continuous processing
const sub2 = await brain.subscriber('events');
await sub2.run((msg) => console.log('Received:', msg));
await sub2.stop();
```

### Query / Queryable (request-response)

```ts
// Server
const server = await brain.queryable('math', (input) => {
  const n = parseInt(input);
  return String(n * n);
});
await server.start();

// Client
const client = await brain.query('math');
const response = await client.ask('21', 5000);  // "441"
```

### Caller / Callable (RPC)

```ts
// Server
const rpcServer = await brain.callable('add', (input) => {
  const [a, b] = input.split(',').map(Number);
  return String(a + b);
});
await rpcServer.start();

// Client
const rpcClient = await brain.caller('add');
const result = await rpcClient.call('10,20');  // "30"
```

## Quick Agent

One-liner to create and start an agent:

```ts
import { BrainOS } from '@open1s/ezbos';

const agent = await BrainOS.with('assistant', {
  model: 'nvidia/meta/llama-3.1-8b-instruct',
  apiKey: 'nvapi-xxx',
});
const result = await agent.ask('Hello');
await agent.close();
```

## Examples

| Example | Description |
|---------|-------------|
| `01-tools.ts` | Tool definitions (required/optional params), ok/err results, isErrorResult, error handling |
| `02-hooks.ts` | All 7 hook events, defineHook, mergeHooks, hook registry |
| `03-plugins.ts` | Plain plugins, class-based plugins, getPluginHandlers, mergePlugins |
| `04-mcp.ts` | Process-based MCP, HTTP MCP, McpBuilder, listMcpTools |
| `05-skills.ts` | defineSkill, SkillsBuilder, skill directories |
| `06-session.ts` | Multi-turn conversation, compactSession, save/restore, export/import |
| `07-agent-advanced.ts` | Streaming, streamCollect, metrics, resilience, config |
| `08-brainos-messaging.ts` | Query/Queryable, Caller/Callable, Publisher/Subscriber (recv + run) |
| `09-system-prompt.ts` | System prompt management and configuration |
| `10-multimodal.ts` | Multimodal content (images, audio), Content/ContentPart API |

```bash
npm run example:tools
npm run example:hooks
npm run example:plugins
npm run example:mcp
npm run example:skills
npm run example:session
npm run example:agent
npm run example:messaging
npm run example:system-prompt
npm run example:multimodal
```

## License

MIT
