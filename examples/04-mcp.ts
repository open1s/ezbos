import { BrainOS, defineMcpProcess, defineMcpHttp, McpBuilder, version } from '../src/index.js';

async function main() {
  console.log(`\n=== 04-mcp.ts - MCP Server Demo (v${version()}) ===\n`);

  console.log('--- defineMcpProcess / defineMcpHttp ---');
  const processConfig = defineMcpProcess('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
  const httpConfig = defineMcpHttp('http-server', 'http://localhost:3000');
  console.log('processConfig:', processConfig);
  console.log('httpConfig:', httpConfig);

  console.log('\n--- McpBuilder ---');
  const mcpBuilder = new McpBuilder()
    .process('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'])
    .http('http-server', 'http://localhost:3000');
  const builtConfigs = mcpBuilder.build();
  console.log('Built MCP configs:', builtConfigs);

  const brain = new BrainOS();
  await brain.start();

  console.log('\n--- Agent with MCP process (filesystem server) ---');
  const agent = brain.agent('mcp-demo')
    .with_mcp_process('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);

  const started = await agent.start();

  console.log('--- listMcpTools() ---');
  try {
    const mcpTools = await started.listMcpTools();
    console.log(`MCP tools available: ${mcpTools.length}`);
    mcpTools.slice(0, 5).forEach((t: any) => console.log(`  - ${t.name}: ${t.description}`));
    if (mcpTools.length > 5) console.log(`  ... and ${mcpTools.length - 5} more`);
  } catch (e) {
    console.log('MCP tools listing result:', (e as Error).message);
  }

  console.log('\n--- LLM call using MCP tool ---');
  try {
    const result = await started.ask('List the files in /tmp directory using the MCP filesystem tool');
    console.log('Result:', result);
  } catch (e) {
    console.log('LLM call error:', (e as Error).message);
  }

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });