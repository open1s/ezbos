import { BrainOS, defineMcpProcess, defineMcpHttp, McpBuilder, version } from '../src/index.js';

const HTTP_MCP_URL = 'http://127.0.0.1:8000/mcp';

async function main() {
  console.log(`\n=== 04-mcp.ts - MCP Server Demo (v${version()}) ===\n`);

  console.log('--- defineMcpProcess / defineMcpHttp ---');
  const processConfig = defineMcpProcess('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
  const httpConfig = defineMcpHttp('hello-mcp', HTTP_MCP_URL);
  console.log('processConfig:', processConfig);
  console.log('httpConfig:', httpConfig);

  console.log('\n--- McpBuilder ---');
  const mcpBuilder = new McpBuilder()
    .process('files', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'])
    .http('hello-mcp', HTTP_MCP_URL);
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
    mcpTools.slice(0, 3).forEach((t: any) => console.log(`  - ${t.name}: ${t.description?.substring(0, 80)}...`));
    if (mcpTools.length > 3) console.log(`  ... and ${mcpTools.length - 3} more`);
  } catch (e) {
    console.log('MCP tools listing result:', (e as Error).message);
  }

  console.log('\n--- LLM call using MCP process tool ---');
  try {
    const result = await started.ask('List the files in /tmp directory using the MCP filesystem tool');
    console.log('Result:', result.substring(0, 200));
  } catch (e) {
    console.log('LLM call error:', (e as Error).message);
  }

  console.log('\n--- Agent with MCP HTTP server ---');
  const httpAgent = brain.agent('mcp-http-demo')
    .with_mcp_http('hello-mcp', HTTP_MCP_URL);

  try {
    const httpStarted = await httpAgent.start();
    const httpTools = await httpStarted.listMcpTools();
    console.log(`HTTP MCP tools available: ${httpTools.length}`);
    httpTools.forEach((t: any) => console.log(`  - ${t.name}: ${t.description}`));

    if (httpTools.length > 0) {
      console.log('\n--- LLM call using HTTP MCP tool ---');
      const httpResult = await httpStarted.ask('Use the greet tool to say hello to World');
      console.log('HTTP MCP Result:', httpResult);
    }
    await httpStarted.close();
  } catch (e) {
    console.log('HTTP MCP failed:', (e as Error).message);
  }

  await started.close();
  await brain.stop();
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
