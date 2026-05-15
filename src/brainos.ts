import * as jsbos from '@open1s/jsbos';
import { AgentBuilder, Agent } from './agent.js';

interface BrainOSOptions {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

interface BusOptions {
  mode?: string;
  connect?: string[];
  listen?: string[];
  peer?: string;
}

export class BrainOS {
  private _bus: jsbos.Bus | null = null;
  private _started = false;
  private _config: any = null;
  private _options: BrainOSOptions & { bus?: BusOptions } = {};

  constructor(options: BrainOSOptions = {}) {
    this._options = options;
  }

  async start(): Promise<this> {
    const loader = new jsbos.ConfigLoader();
    loader.discover();
    try {
      this._config = JSON.parse(loader.loadSync());
    } catch {
      this._config = {};
    }

    const gm = this._config.global_model || {};
    const apiKey = this._options.apiKey || gm.api_key;
    const baseUrl = this._options.baseUrl || gm.base_url || 'https://integrate.api.nvidia.com/v1';
    const model = this._options.model || gm.model || 'nvidia/meta/llama-3.1-8b-instruct';

    this._options.apiKey = apiKey;
    this._options.baseUrl = baseUrl;
    this._options.model = model;

    const busConfig = this._options.bus || { mode: 'peer' };
    this._bus = await jsbos.Bus.create(busConfig as any);
    this._started = true;

    return this;
  }

  async stop(): Promise<void> {
    if (this._bus) {
      this._bus = null;
    }
    this._started = false;
  }

  get isStarted(): boolean {
    return this._started;
  }

  with_bus(config: BusOptions): this {
    this._options.bus = { ...this._options.bus, ...config };
    return this;
  }

  agent(name: string = 'assistant', options: {
    model?: string;
    baseUrl?: string;
    apiKey?: string;
    systemPrompt?: string;
    temperature?: number;
    timeoutSecs?: number;
    maxTokens?: number;
  } = {}): AgentBuilder {
    if (!this._started) {
      throw new Error('BrainOS not started. Call start() first.');
    }
    return new AgentBuilder(name, {
      ...this._options,
      ...options,
      apiKey: options.apiKey || this._options.apiKey,
      model: options.model || this._options.model,
      baseUrl: options.baseUrl || this._options.baseUrl,
    });
  }

  get bus(): jsbos.Bus {
    if (!this._started) throw new Error('BrainOS not started');
    return this._bus!;
  }

  async publish(topic: string, payload: any, isJson: boolean = false): Promise<void> {
    if (!this._started) throw new Error('BrainOS not started');
    if (isJson) {
      await this._bus!.publishJson(topic, payload);
    } else {
      await this._bus!.publishText(topic, String(payload));
    }
  }

  async publisher(topic: string): Promise<PublisherWrapper> {
    if (!this._started) throw new Error('BrainOS not started');
    const pub = await this._bus!.createPublisher(topic);
    return new PublisherWrapper(pub);
  }

  async subscriber(topic: string): Promise<SubscriberWrapper> {
    if (!this._started) throw new Error('BrainOS not started');
    const sub = await this._bus!.createSubscriber(topic);
    return new SubscriberWrapper(sub);
  }

  async query(topic: string): Promise<QueryClient> {
    if (!this._started) throw new Error('BrainOS not started');
    const q = await this._bus!.createQuery(topic);
    return new QueryClient(q);
  }

  async queryable(topic: string, handler?: (input: string) => any): Promise<QueryableServer> {
    if (!this._started) throw new Error('BrainOS not started');
    const q = await this._bus!.createQueryable(topic);
    if (handler) {
      (q as any)._handler = handler;
    }
    return new QueryableServer(q, handler);
  }

  async caller(name: string): Promise<CallerClient> {
    if (!this._started) throw new Error('BrainOS not started');
    const c = await this._bus!.createCaller(name);
    return new CallerClient(c);
  }

  async callable(uri: string, handler?: (input: string) => any): Promise<CallableServer> {
    if (!this._started) throw new Error('BrainOS not started');
    const c = await this._bus!.createCallable(uri);
    return new CallableServer(c, handler);
  }

  get config(): any {
    return this._config;
  }

  static async with(name: string = 'assistant', options: BrainOSOptions = {}): Promise<Agent> {
    const brain = new BrainOS(options);
    await brain.start();
    const builder = brain.agent(name);
    return await builder.start();
  }
}

export class PublisherWrapper {
  constructor(private _inner: jsbos.Publisher) {}

  get topic(): string {
    return this._inner.topic;
  }

  async publish(payload: any, isJson: boolean = false): Promise<void> {
    if (isJson) {
      await this._inner.publishJson(payload);
    } else {
      await this._inner.publishText(String(payload));
    }
  }

  async text(payload: string): Promise<void> {
    await this._inner.publishText(payload);
  }

  async json(data: any): Promise<void> {
    await this._inner.publishJson(data);
  }
}

export class SubscriberWrapper {
  constructor(private _inner: jsbos.Subscriber) {}

  get topic(): string {
    return this._inner.topic;
  }

  async recv(timeoutMs?: number): Promise<string | null> {
    if (timeoutMs) {
      return await this._inner.recvWithTimeoutMs(timeoutMs);
    }
    return await this._inner.recv();
  }

  async recvJson(timeoutMs?: number): Promise<any | null> {
    const msg = await this.recv(timeoutMs);
    if (!msg) return null;
    try {
      return JSON.parse(msg);
    } catch {
      return msg;
    }
  }

  async run(callback: (msg: string) => void): Promise<void> {
    await this._inner.run((e, msg) => {
      if (e) return;
      callback(msg as string);
    });
  }

  async runJson(callback: (data: any) => void): Promise<void> {
    await this._inner.runJson((e, data) => {
      if (e) return;
      callback(data);
    });
  }

  async stop(): Promise<void> {
    await this._inner.stop();
  }

  [Symbol.asyncIterator]() {
    return this;
  }

  async next(): Promise<{ done: boolean; value?: string }> {
    const msg = await this.recv();
    return msg === null ? { done: true } : { done: false, value: msg };
  }
}

export class QueryClient {
  constructor(private _inner: jsbos.Query) {}

  get topic(): string {
    return this._inner.topic;
  }

  async ask(payload: string, timeoutMs?: number): Promise<string> {
    if (timeoutMs) {
      return await this._inner.queryTextTimeoutMs(payload, timeoutMs);
    }
    return await this._inner.queryText(payload);
  }

  async askJson(payload: any, timeoutMs?: number): Promise<any> {
    const response = await this.ask(JSON.stringify(payload), timeoutMs);
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }
}

export class QueryableServer {
  private _handler?: (input: string) => any;

  constructor(private _inner: jsbos.Queryable, handler?: (input: string) => any) {
    this._handler = handler;
    if (handler) {
      this._inner.setHandler((e, input) => {
        if (e) throw e;
        return handler(input);
      });
    }
  }

  handle(handler: (input: string) => any): this {
    this._handler = handler;
    this._inner.setHandler((e, input) => {
      if (e) throw e;
      return handler(input);
    });
    return this;
  }

  async start(): Promise<this> {
    await this._inner.start();
    return this;
  }

  async run(handler: (input: string) => any): Promise<void> {
    this._inner.run((e, input) => {
      if (e) throw e;
      return handler(input);
    });
  }

  async runJson(handler: (input: any) => any): Promise<void> {
    this._inner.runJson((e, input) => {
      if (e) throw e;
      return handler(input);
    });
  }
}

export class CallerClient {
  constructor(private _inner: jsbos.Caller) {}

  async call(payload: string): Promise<string> {
    return await this._inner.callText(payload);
  }

  async callJson(payload: any): Promise<any> {
    const response = await this._inner.callText(JSON.stringify(payload));
    try {
      return JSON.parse(response);
    } catch {
      return response;
    }
  }
}

export class CallableServer {
  private _handler?: (input: string) => any;

  constructor(private _inner: jsbos.Callable, handler?: (input: string) => any) {
    this._handler = handler;
    if (handler) {
      this._inner.setHandler((e, input) => {
        if (e) throw e;
        return handler(input);
      });
    }
  }

  handle(handler: (input: string) => any): this {
    this._handler = handler;
    this._inner.setHandler((e, input) => {
      if (e) throw e;
      return handler(input);
    });
    return this;
  }

  get isStarted(): boolean {
    return this._inner.isStarted();
  }

  async start(): Promise<this> {
    await this._inner.start();
    return this;
  }

  async run(handler: (input: string) => any): Promise<void> {
    this._inner.run((e, input) => {
      if (e) throw e;
      return handler(input);
    });
  }

  async runJson(handler: (input: any) => any): Promise<void> {
    this._inner.runJson((e, input) => {
      if (e) throw e;
      return handler(input);
    });
  }
}