import * as jsbos from '@open1s/jsbos';
import { jsbos as jsbosDefault, InternalToolDef } from './tool.js';
import { HookEvent, HookCallback, mergeHooks } from './hook.js';
import { PluginHandlers, mergePlugins } from './plugin.js';

const DEFAULT_MODEL = 'nvidia/meta/llama-3.1-8b-instruct';
const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export class AgentBuilder {
  private _inner: jsbos.Agent | null = null;
  private _tools: InternalToolDef[] = [];
  private _hooks: Array<{ event: HookEvent, callback: HookCallback }> = [];
  private _plugins: PluginHandlers[] = [];
  private _mcp: Array<{ type: 'process' | 'http', namespace: string, command?: string, args?: string[], url?: string }> = [];
  private _skillsDirs: string[] = [];
  private _config: {
    name: string;
    model: string;
    baseUrl: string;
    apiKey?: string;
    systemPrompt: string;
    temperature: number;
    timeoutSecs: number;
    maxTokens?: number;
    circuitBreakerMaxFailures?: number;
    circuitBreakerCooldownSecs?: number;
    rateLimitCapacity?: number;
    rateLimitWindowSecs?: number;
    rateLimitMaxRetries?: number;
  };

  constructor(name: string, options: {
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    systemPrompt?: string;
    temperature?: number;
    timeoutSecs?: number;
    maxTokens?: number;
    circuitBreakerMaxFailures?: number;
    circuitBreakerCooldownSecs?: number;
    rateLimitCapacity?: number;
    rateLimitWindowSecs?: number;
    rateLimitMaxRetries?: number;
  } = {}) {
    this._config = {
      name,
      model: options.model || DEFAULT_MODEL,
      baseUrl: options.baseUrl || DEFAULT_BASE_URL,
      apiKey: options.apiKey,
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      temperature: options.temperature ?? 0.7,
      timeoutSecs: options.timeoutSecs || 120,
      maxTokens: options.maxTokens ?? 4096,
      circuitBreakerMaxFailures: options.circuitBreakerMaxFailures,
      circuitBreakerCooldownSecs: options.circuitBreakerCooldownSecs,
      rateLimitCapacity: options.rateLimitCapacity,
      rateLimitWindowSecs: options.rateLimitWindowSecs,
      rateLimitMaxRetries: options.rateLimitMaxRetries,
    };
  }

  with_model(model: string): this {
    this._config.model = model;
    return this;
  }

  with_baseUrl(url: string): this {
    this._config.baseUrl = url;
    return this;
  }

  with_apiKey(key: string): this {
    this._config.apiKey = key;
    return this;
  }

  with_systemPrompt(prompt: string): this {
    this._config.systemPrompt = prompt;
    return this;
  }

  with_prompt(prompt: string): this {
    return this.with_systemPrompt(prompt);
  }

  with_temperature(temp: number): this {
    this._config.temperature = temp;
    return this;
  }

  with_timeout(secs: number): this {
    this._config.timeoutSecs = secs;
    return this;
  }

  with_maxTokens(tokens: number): this {
    this._config.maxTokens = tokens;
    return this;
  }

  with_tools(...tools: any[]): this {
    for (const t of tools) {
      if (t && typeof t === 'object' && 'name' in t && 'description' in t && 'callback' in t) {
        this._tools.push(t as InternalToolDef);
      } else if (typeof t === 'function' && (t as any).toolDef) {
        this._tools.push((t as any).toolDef);
      }
    }
    return this;
  }

  register(...tools: any[]): this {
    return this.with_tools(...tools);
  }

  with_hooks(...sources: any[]): this {
    const merged = mergeHooks(...sources);
    this._hooks.push(...merged);
    return this;
  }

  with_plugins(...sources: any[]): this {
    const merged = mergePlugins(...sources);
    this._plugins.push(...merged);
    return this;
  }

  with_mcp_process(namespace: string, command: string, args: string[]): this {
    this._mcp.push({ type: 'process', namespace, command, args });
    return this;
  }

  with_mcp_http(namespace: string, url: string): this {
    this._mcp.push({ type: 'http', namespace, url });
    return this;
  }

  with_skills_dir(dirPath: string): this {
    this._skillsDirs.push(dirPath);
    return this;
  }

  with_resilience(opts: {
    circuitBreakerMaxFailures?: number;
    circuitBreakerCooldownSecs?: number;
    rateLimitCapacity?: number;
    rateLimitWindowSecs?: number;
    rateLimitMaxRetries?: number;
  }): this {
    if (opts.circuitBreakerMaxFailures !== undefined) {
      this._config.circuitBreakerMaxFailures = opts.circuitBreakerMaxFailures;
    }
    if (opts.circuitBreakerCooldownSecs !== undefined) {
      this._config.circuitBreakerCooldownSecs = opts.circuitBreakerCooldownSecs;
    }
    if (opts.rateLimitCapacity !== undefined) {
      this._config.rateLimitCapacity = opts.rateLimitCapacity;
    }
    if (opts.rateLimitWindowSecs !== undefined) {
      this._config.rateLimitWindowSecs = opts.rateLimitWindowSecs;
    }
    if (opts.rateLimitMaxRetries !== undefined) {
      this._config.rateLimitMaxRetries = opts.rateLimitMaxRetries;
    }
    return this;
  }

  async start(): Promise<Agent> {
    this._inner = await jsbos.Agent.create(this._config as any);

    for (const tool of this._tools) {
      this._inner.addTool(
        tool.name,
        tool.description,
        JSON.stringify(tool.schema.properties || {}),
        JSON.stringify(tool.schema),
        (err: any, args: any) => {
          if (err) return String(err);
          try {
            return tool.callback(args);
          } catch (e: any) {
            return String(e);
          }
        }
      );
    }

    for (const { event, callback } of this._hooks) {
      this._inner.registerHook(event, async (e, ctx) => {
        if (e) return 'continue';
        return await callback(ctx);
      });
    }

    for (const plugin of this._plugins) {
      this._inner.registerPlugin(
        plugin.name || 'plugin',
        plugin.on_llm_request as any,
        plugin.on_llm_response as any,
        plugin.on_tool_call as any,
        plugin.on_tool_result as any
      );
    }

    for (const mcp of this._mcp) {
      if (mcp.type === 'process' && mcp.command && mcp.args) {
        await this._inner.addMcpServer(mcp.namespace, mcp.command, mcp.args);
      } else if (mcp.type === 'http' && mcp.url) {
        await this._inner.addMcpServerHttp(mcp.namespace, mcp.url);
      }
    }

    for (const dir of this._skillsDirs) {
      await this._inner.registerSkillsFromDir(dir);
    }

    return new Agent(this._inner);
  }

  async ask(prompt: string): Promise<string> {
    if (!this._inner) await this.start();
    return this._inner!.runSimple(prompt);
  }

  async react(task: string): Promise<string> {
    if (!this._inner) await this.start();
    return this._inner!.react(task);
  }
}

export class Agent {
  constructor(private _inner: jsbos.Agent) {}

  async run(task: string): Promise<string> {
    return this._inner.runSimple(task);
  }

  async ask(prompt: string): Promise<string> {
    return this._inner.runSimple(prompt);
  }

  async react(task: string): Promise<string> {
    return this._inner.react(task);
  }

  stream(task: string, onToken: (token: any) => void): Promise<void> {
    return this._inner.stream(task, (err, token) => {
      if (err) {
        onToken({ type: 'Error', error: err.message });
      } else {
        onToken(token);
      }
    });
  }

  async streamCollect(task: string): Promise<any[]> {
    const tokens: any[] = [];
    await new Promise<void>((resolve, reject) => {
      this.stream(task, token => {
        tokens.push(token);
        if (token.type === 'Done' || token.type === 'Error') {
          token.type === 'Error' ? reject(new Error(token.error)) : resolve();
        }
      });
    });
    return tokens;
  }

  get session(): SessionManager {
    return new SessionManager(this._inner);
  }

  get tools(): string[] {
    return this._inner.listTools();
  }

  get config(): any {
    return this._inner.config();
  }

  get inner(): jsbos.Agent {
    return this._inner;
  }

  async listMcpTools(): Promise<any[]> {
    return this._inner.listMcpTools();
  }

  get metrics(): jsbos.PerfSnapshot {
    return this._inner.getPerfMetrics();
  }

  resetMetrics(): void {
    this._inner.resetPerfMetrics();
  }

  async close(): Promise<void> {
    this._inner.close();
  }
}

export class SessionManager {
  constructor(private _inner: jsbos.Agent) {}

  save(path: string): this {
    this._inner.saveSession(path);
    return this;
  }

  restore(path: string): this {
    this._inner.restoreSessionFromFile(path);
    return this;
  }

  compact(keepRecent: number = 10, maxSummaryChars: number = 2000): this {
    this._inner.compactSession(keepRecent, maxSummaryChars);
    return this;
  }

  clear(): this {
    this._inner.clearSession();
    return this;
  }

  export(): string {
    return this._inner.getSessionJson();
  }

  import(json: string): this {
    this._inner.restoreSessionJson(json);
    return this;
  }
}