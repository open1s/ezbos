import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AgentBuilder, AgentCreateConfig, McpStatusCallback } from '../agent.js';
import { defineTool } from '../tool.js';
import { defineHook, HookEvent } from '../hook.js';

/**
 * Regression tests for the prompt-rebuild bug: inline skills used to trigger
 * a SECOND Agent.create whose config only re-registered tools — hooks,
 * plugins, MCP servers, skill dirs and the session bus were silently lost.
 * start() now composes the prompt first and creates exactly one inner agent
 * via the createInner() seam, which this fake overrides.
 */
class FakeBuilder extends AgentBuilder {
  creates = 0;
  configs: AgentCreateConfig[] = [];
  toolsRegistered: string[] = [];
  hooksRegistered = 0;
  pluginsRegistered = 0;
  skillDirs: string[] = [];

  protected async createInner(config: AgentCreateConfig): Promise<any> {
    this.creates++;
    this.configs.push({ ...config });
    const self = this;
    return {
      addTool: (name: string) => { self.toolsRegistered.push(name); return Promise.resolve(''); },
      registerHook: () => { self.hooksRegistered++; },
      registerPlugin: () => { self.pluginsRegistered++; },
      registerSkillsFromDir: (dir: string) => { self.skillDirs.push(dir); return Promise.resolve(); },
      addMcpServer: async () => {},
      addMcpServerHttp: async () => {},
      listTools: () => [...self.toolsRegistered],
      config: () => ({}),
      stop: () => {},
      close: () => {},
    };
  }
}

describe('AgentBuilder.start() single-create invariant', () => {
  it('creates ONE inner agent with the composed prompt and keeps every registration', async () => {
    const mcpStatuses: string[] = [];
    const onMcpStatus: McpStatusCallback = (_ns, _type, _cmd, status) => mcpStatuses.push(status);

    const builder = new FakeBuilder('single-create', { onMcpStatus })
      .withTools(defineTool('ct_echo', 'Echoes back').handle(() => 'ok'))
      .withHooks(defineHook(HookEvent.BeforeLlmCall, () => 'continue'))
      .withPlugins({ name: 'p1' })
      .withSkillsDir('/tmp/skills-dir')
      .withSkills({ name: 'unit-skill', content: 'UNIT SKILL MARKER' })
      .withMcpProcess('demo', 'definitely-not-a-real-binary', []);

    const agent = await builder.start();
    await agent.close();

    // Exactly one native agent — no prompt rebuild.
    assert.strictEqual(builder.creates, 1);
    // The composed prompt (with inline skill) is present at CREATION time.
    assert.match(builder.configs[0].systemPrompt, /# Skill: unit-skill/);
    assert.match(builder.configs[0].systemPrompt, /UNIT SKILL MARKER/);
    // Everything registered on that same single instance.
    assert.deepStrictEqual(builder.toolsRegistered, ['ct_echo']);
    assert.strictEqual(builder.hooksRegistered, 1);
    assert.strictEqual(builder.pluginsRegistered, 1);
    assert.deepStrictEqual(builder.skillDirs, ['/tmp/skills-dir']);
    // MCP registered (fake addMcpServer resolves → status callback fired).
    assert.deepStrictEqual(mcpStatuses, ['connected']);
  });

  it('leaves the base prompt untouched when there are no inline skills', async () => {
    const builder = new FakeBuilder('no-skills', { systemPrompt: 'Base prompt.' });
    const agent = await builder.start();
    await agent.close();
    assert.strictEqual(builder.creates, 1);
    assert.strictEqual(builder.configs[0].systemPrompt, 'Base prompt.');
  });
});
