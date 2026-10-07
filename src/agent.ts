import * as jsbos from '@open1s/jsbos';
import { jsbos as jsbosDefault, InternalToolDef } from './tool.js';
import { HookEvent, HookCallback, mergeHooks } from './hook.js';
import { PluginHandlers, mergePlugins } from './plugin.js';
import { SkillDef } from './skills.js';
import { Content } from './content.js';
import { CancelledError } from './errors.js';

export interface JsContent {
  type: string;
  text?: string;
  contentType?: string;
  url?: string;
  base64?: string;
  name?: string;
}

/**
 * A single event from {@link Agent.streamEvents}.
 *
 * - `token` — an incremental token/chunk from the model.
 * - `done`  — terminal; `result` is the final accumulated text.
 * - `error` — terminal; the stream failed. Exactly one terminal event is
 *   emitted per iteration.
 */
export type StreamEvent =
  | { type: 'token'; token: any }
  | { type: 'done'; result: string }
  | { type: 'error'; error: string };

export const DEFAULT_MODEL = 'nvidia/meta/llama-3.1-8b-instruct';
export const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export type McpStatusCallback = (namespace: string,type: 'process' | 'http',comm: string, status: 'connected' | 'failed', error?: string) => void;

/** Native agent construction options (mirrors jsbos AgentConfig). */
export interface AgentCreateConfig {
  name: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  systemPrompt: string;
  temperature: number;
  timeoutSecs: number;
  maxTokens?: number;
  apiMode?: string;
  reasoningEffort?: string;
  circuitBreakerMaxFailures?: number;
  circuitBreakerCooldownSecs?: number;
  rateLimitCapacity?: number;
  rateLimitWindowSecs?: number;
  rateLimitMaxRetries?: number;
}

export class AgentBuilder {
  private _inner: jsbos.Agent | null = null;
  private _tools: InternalToolDef[] = [];
  private _hooks: Array<{ event: HookEvent, callback: HookCallback }> = [];
  private _plugins: PluginHandlers[] = [];
  private _mcp: Array<{ type: 'process' | 'http', namespace: string, command?: string, args?: string[], url?: string }> = [];
  private _skillsDirs: string[] = [];
  private _inlineSkills: SkillDef[] = [];
  private _onMcpStatus?: McpStatusCallback;
  private _session?: any;
  private _config: AgentCreateConfig;

  constructor(name: string, options: {
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    systemPrompt?: string;
    temperature?: number;
    timeoutSecs?: number;
    maxTokens?: number;
    apiMode?: string;
    reasoningEffort?: string;
    circuitBreakerMaxFailures?: number;
    circuitBreakerCooldownSecs?: number;
    rateLimitCapacity?: number;
    rateLimitWindowSecs?: number;
    rateLimitMaxRetries?: number;
    onMcp?: McpStatusCallback;
    onMcpStatus?: McpStatusCallback;
    session?: any;
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
      apiMode: options.apiMode,
      reasoningEffort: options.reasoningEffort,
      circuitBreakerMaxFailures: options.circuitBreakerMaxFailures,
      circuitBreakerCooldownSecs: options.circuitBreakerCooldownSecs,
      rateLimitCapacity: options.rateLimitCapacity,
      rateLimitWindowSecs: options.rateLimitWindowSecs,
      rateLimitMaxRetries: options.rateLimitMaxRetries,
    };
    this._onMcpStatus = options.onMcp ?? options.onMcpStatus;
    this._session = options.session;
  }

  /**
   * Create the underlying native agent. `start()` calls this exactly once —
   * the final system prompt (base + inline skills) is already composed in
   * `config`. Overriding this is the supported test seam for injecting a
   * fake inner agent.
   */
  protected async createInner(config: AgentCreateConfig): Promise<jsbos.Agent> {
    if (this._session) {
      return jsbos.Agent.createWithBus(config as any, this._session);
    }
    return jsbos.Agent.create(config as any);
  }

  /** @deprecated Use {@link withModel}. */
  with_model(model: string): this {
    this._config.model = model;
    return this;
  }

  /** @deprecated Use {@link withBaseUrl}. */
  with_baseUrl(url: string): this {
    this._config.baseUrl = url;
    return this;
  }

  /** @deprecated Use {@link withApiKey}. */
  with_apiKey(key: string): this {
    this._config.apiKey = key;
    return this;
  }

  /** @deprecated Use {@link withSystemPrompt}. */
  with_systemPrompt(prompt: string): this {
    this._config.systemPrompt = prompt;
    return this;
  }

  /** @deprecated Use {@link withPrompt}. */
  with_prompt(prompt: string): this {
    return this.with_systemPrompt(prompt);
  }

  /** @deprecated Use {@link withTemperature}. */
  with_temperature(temp: number): this {
    this._config.temperature = temp;
    return this;
  }

  /** @deprecated Use {@link withTimeout}. */
  with_timeout(secs: number): this {
    this._config.timeoutSecs = secs;
    return this;
  }

  /** @deprecated Use {@link withMaxTokens}. */
  with_maxTokens(tokens: number): this {
    this._config.maxTokens = tokens;
    return this;
  }

  /** @deprecated Use {@link withApiMode}. */
  with_apiMode(mode: string): this {
    this._config.apiMode = mode;
    return this;
  }

  /** @deprecated Use {@link withReasoningEffort}. */
  with_reasoningEffort(effort: string): this {
    this._config.reasoningEffort = effort;
    return this;
  }

  /** @deprecated Use {@link withTools}. */
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

  // camelCase aliases (preferred). The with_snake_case names stay available
  // for backwards compatibility.
  withModel(model: string): this { return this.with_model(model); }
  withBaseUrl(url: string): this { return this.with_baseUrl(url); }
  withApiKey(key: string): this { return this.with_apiKey(key); }
  withSystemPrompt(prompt: string): this { return this.with_systemPrompt(prompt); }
  withPrompt(prompt: string): this { return this.with_prompt(prompt); }
  withTemperature(temp: number): this { return this.with_temperature(temp); }
  withTimeout(secs: number): this { return this.with_timeout(secs); }
  withMaxTokens(tokens: number): this { return this.with_maxTokens(tokens); }
  withApiMode(mode: string): this { return this.with_apiMode(mode); }
  withReasoningEffort(effort: string): this { return this.with_reasoningEffort(effort); }
  withTools(...tools: any[]): this { return this.with_tools(...tools); }
  withHooks(...sources: any[]): this { return this.with_hooks(...sources); }
  withPlugins(...sources: any[]): this { return this.with_plugins(...sources); }
  withMcpProcess(namespace: string, command: string, args: string[]): this {
    return this.with_mcp_process(namespace, command, args);
  }
  withMcpHttp(namespace: string, url: string): this { return this.with_mcp_http(namespace, url); }
  withSkillsDir(dirPath: string): this { return this.with_skills_dir(dirPath); }
  withSkills(...skills: SkillDef[]): this { return this.with_skills(...skills); }
  withResilience(opts: {
    circuitBreakerMaxFailures?: number;
    circuitBreakerCooldownSecs?: number;
    rateLimitCapacity?: number;
    rateLimitWindowSecs?: number;
    rateLimitMaxRetries?: number;
  }): this { return this.with_resilience(opts); }

  /** @deprecated Use {@link withHooks}. */
  with_hooks(...sources: any[]): this {
    const merged = mergeHooks(...sources);
    this._hooks.push(...merged);
    return this;
  }

  /** @deprecated Use {@link withPlugins}. */
  with_plugins(...sources: any[]): this {
    const merged = mergePlugins(...sources);
    this._plugins.push(...merged);
    return this;
  }

  /** @deprecated Use {@link withMcpProcess}. */
  with_mcp_process(namespace: string, command: string, args: string[]): this {
    this._mcp.push({ type: 'process', namespace, command, args });
    return this;
  }

  /** @deprecated Use {@link withMcpHttp}. */
  with_mcp_http(namespace: string, url: string): this {
    this._mcp.push({ type: 'http', namespace, url });
    return this;
  }

  /** @deprecated Use {@link withSkillsDir}. */
  with_skills_dir(dirPath: string): this {
    this._skillsDirs.push(dirPath);
    return this;
  }

  /** @deprecated Use {@link withSkills}. */
  with_skills(...skills: SkillDef[]): this {
    this._inlineSkills.push(...skills);
    return this;
  }

  /** @deprecated Use {@link withResilience}. */
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
    // Compose the final system prompt BEFORE creating the agent: inline skills
    // must be baked into the one and only agent instance, so the hooks,
    // plugins, MCP servers and skill dirs registered below can never be lost
    // to a prompt rebuild (the old rebuild path re-added tools only).
    let systemPrompt = this._config.systemPrompt || '';
    for (const skill of this._inlineSkills) {
      systemPrompt += `\n\n# Skill: ${skill.name}\n${skill.content}`;
    }
    this._config.systemPrompt = systemPrompt;

    this._inner = await this.createInner(this._config);

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
        },
        !!tool.cancelable,
        tool.cancelCallback
          ? (_err: any, callId: string) => tool.cancelCallback!(callId)
          : undefined
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
        plugin.on_llm_request ? ((err: any, arg: any) => {
          if (err) return;
          return plugin.on_llm_request!(arg);
        }) : undefined,
        plugin.on_llm_response ? ((err: any, arg: any) => {
          if (err) return;
          return plugin.on_llm_response!(arg);
        }) : undefined,
        plugin.on_tool_call ? ((err: any, arg: any) => {
          if (err) return;
          return plugin.on_tool_call!(arg);
        }) : undefined,
        plugin.on_tool_result ? ((err: any, arg: any) => {
          if (err) return;
          return plugin.on_tool_result!(arg);
        }) : undefined
      );
    }

    for (const mcp of this._mcp) {
      let added = false;
      try {
        if (mcp.type === 'process' && mcp.command && mcp.args) {
          await this._inner.addMcpServer(mcp.namespace, mcp.command, mcp.args);
          added = true;
        } else if (mcp.type === 'http' && mcp.url) {
          await this._inner.addMcpServerHttp(mcp.namespace, mcp.url);
          added = true;
        }
        if (added) {
          this._onMcpStatus?.(mcp.namespace, mcp.type, mcp.type === 'process' ? mcp.command! : mcp.url!, 'connected');
        }
      } catch (err) {
        this._onMcpStatus?.(mcp.namespace, mcp.type, mcp.type === 'process' ? mcp.command! : mcp.url!, 'failed', String(err));
        console.warn(`[agent] MCP server "${mcp.namespace}" connection failed, skipping:`, err);
      }
    }

    for (const dir of this._skillsDirs) {
      await this._inner.registerSkillsFromDir(dir);
    }

    return new Agent(this._inner!);
  }

  async ask(prompt: string | Array<JsContent>): Promise<string> {
    if (!this._inner) await this.start();
    return this._inner!.react(prompt);
  }

  async runSimple(prompt: string | Array<JsContent>): Promise<string> {
    if (!this._inner) await this.start();
    return this._inner!.runSimple(prompt);
  }

  async react(task: string | Array<JsContent>): Promise<string> {
    if (!this._inner) await this.start();
    return this._inner!.react(task);
  }

  async stop() {
    if (!this._inner) return;
    this._inner!.stop();
  }
}

export class Agent {
  constructor(private _inner: jsbos.Agent) {}

  private _resolveContent(input: any): Array<JsContent> {
    if (input && typeof input === 'object' && input.constructor && input.constructor.name === 'Content') {
      if (input._text !== null && input._text !== undefined) {
        return [{ type: 'text', text: input._text }];
      }
      const parts = input.toJSON();
      if (!Array.isArray(parts)) return [{ type: 'text', text: typeof parts === 'string' ? parts : JSON.stringify(parts) }];
      return (parts as Array<any>).map((p: any) => {
        if (p.type === 'text') {
          return { type: 'text', text: p.text || '' };
        }
        const b = p.binary || {};
        const source = b.source || {};
        const result: JsContent = { type: 'binary', contentType: b.content_type || 'image/jpeg', name: b.name };
        if (source.url !== undefined) result.url = source.url;
        else if (source.base64 !== undefined) result.base64 = source.base64;
        else if (source.type === 'url') result.url = source.data;
        else if (source.type === 'base64') result.base64 = source.data;
        return result;
      });
    }
    if (typeof input === 'string') {
      return [{ type: 'text', text: input }];
    }
    if (Array.isArray(input)) {
      return input;
    }
    return [{ type: 'text', text: String(input) }];
  }

  /**
   * Single-shot completion — NO tool loop (jsbos `runSimple`).
   * Use {@link ask} when the model should call registered tools.
   */
  async run(task: string | Array<JsContent>): Promise<string> {
    if (typeof task === 'string') return this._inner.runSimple(task);
    return this._inner.runSimple(this._resolveContent(task) as any);
  }

  /**
   * ReAct loop WITH the registered tools — the main entry point (jsbos
   * `react`): the model may reason, call tools and iterate until done.
   */
  async ask(prompt: string | Array<JsContent>): Promise<string> {
    if (typeof prompt === 'string') return this._inner.react(prompt);
    return this._inner.react(this._resolveContent(prompt) as any);
  }

  async runSimple(prompt: string | Array<JsContent>): Promise<string> {
    if (typeof prompt === 'string') return this._inner.runSimple(prompt);
    return this._inner.runSimple(this._resolveContent(prompt) as any);
  }

  async react(task: string | Array<JsContent>): Promise<string> {
    if (typeof task === 'string') return this._inner.react(task);
    return this._inner.react(this._resolveContent(task) as any);
  }

  async compactSession(): Promise<void> {
    const sessionJson = this._inner.getSessionJson();

    const compactedJson = await this.ask(`Compact this session JSON. Preserve all important context, facts, and decisions while removing redundant messages. Return ONLY valid JSON. Use exact role names: "System", "User", "Assistant", "AssistantToolCall", "ToolResult".\n\nSession JSON:\n${sessionJson}`);

    let cleaned = compactedJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    cleaned = cleaned.replace(/"user"/g, '"User"')
                     .replace(/"assistant"/g, '"Assistant"')
                     .replace(/"system"/g, '"System"')
                     .replace(/"toolresult"/g, '"ToolResult"')
                     .replace(/"assistanttoolcall"/g, '"AssistantToolCall"');

    this._inner.restoreSessionJson(cleaned);
  }

  saveSession(path: string): void {
    this._inner.saveSession(path);
  }

  restoreSession(path: string): void {
    this._inner.restoreSessionFromFile(path);
  }

  clearSession(): void {
    this._inner.clearSession();
  }

  exportSession(): string {
    return this._inner.getSessionJson();
  }

  importSession(json: string): void {
    this._inner.restoreSessionJson(json);
  }

  stream(task: string | Array<JsContent>, onToken: (token: any) => void): Promise<string> {
    return this._inner.stream(this._resolveContent(task) as any, (err, token) => {
      if (err) {
        onToken({ type: 'Error', error: err.message });
      } else {
        onToken(token);
      }
    });
  }

  /**
   * Stream the task as an async iterable — the modern, backpressure-friendly
   * alternative to callback streaming:
   * ```ts
   * for await (const ev of agent.streamEvents('Write a haiku')) {
   *   if (ev.type === 'token') process.stdout.write(ev.token.text ?? '');
   *   if (ev.type === 'error') throw new Error(ev.error);
   * }
   * ```
   *
   * The iterator always terminates with exactly one `done` or `error` event.
   * Pass `signal` to cancel mid-stream (calls `stop()` and ends iteration).
   */
  async *streamEvents(
    task: string | Array<JsContent>,
    opts?: { signal?: AbortSignal }
  ): AsyncGenerator<StreamEvent, void, void> {
    const queue: StreamEvent[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    let sawError = false;
    const wake = () => { const n = notify; notify = null; n?.(); };
    const push = (ev: StreamEvent) => { queue.push(ev); wake(); };

    if (opts?.signal?.aborted) throw new CancelledError('stream aborted before it started');
    const onAbort = () => { try { this._inner.stop(); } catch { /* already stopped */ } };
    opts?.signal?.addEventListener('abort', onAbort, { once: true });

    const settled = this._inner
      .stream(this._resolveContent(task) as any, (err, token) => {
        if (err) {
          sawError = true;
          push({ type: 'error', error: err.message });
        } else if (token && token.type !== 'Done') {
          push({ type: 'token', token });
        }
      })
      .then(
        (result) => ({ ok: true, result } as const),
        (e) => ({ ok: false, error: e instanceof Error ? e.message : String(e) } as const)
      )
      .finally(() => { finished = true; wake(); });

    try {
      for (;;) {
        while (queue.length > 0) {
          const ev = queue.shift()!;
          yield ev;
          if (ev.type === 'error') return; // terminal: exactly one of done|error
        }
        if (finished) break;
        await new Promise<void>((r) => { notify = r; });
      }
      // Drain anything the callback pushed during the final wake, then emit
      // exactly one terminal event.
      while (queue.length > 0) {
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === 'error') return;
      }
      const terminal = await settled;
      if (terminal.ok) {
        yield { type: 'done', result: terminal.result };
      } else if (!sawError) {
        yield { type: 'error', error: terminal.error };
      }
    } finally {
      opts?.signal?.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Collect every stream token into an array. Terminates on stream
   * completion OR error (the underlying promise always settles).
   */
  async streamCollect(task: string | Array<JsContent>): Promise<any[]> {
    const tokens: any[] = [];
    await this.stream(task, (token) => {
      tokens.push(token);
    });
    return tokens;
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

  async stop(): Promise<void> {
    this._inner.stop();
  }

  async close(): Promise<void> {
    this._inner.stop();
    this._inner.close();
  }
}
