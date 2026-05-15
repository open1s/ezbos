export interface McpProcessConfig {
  type: 'process';
  namespace: string;
  command: string;
  args: string[];
}

export interface McpHttpConfig {
  type: 'http';
  namespace: string;
  url: string;
}

export type McpConfig = McpProcessConfig | McpHttpConfig;

export function defineMcpProcess(namespace: string, command: string, args: string[]): McpProcessConfig {
  return { type: 'process', namespace, command, args };
}

export function defineMcpHttp(namespace: string, url: string): McpHttpConfig {
  return { type: 'http', namespace, url };
}

export class McpBuilder {
  private _configs: McpConfig[] = [];

  process(namespace: string, command: string, args: string[]): this {
    this._configs.push({ type: 'process', namespace, command, args });
    return this;
  }

  http(namespace: string, url: string): this {
    this._configs.push({ type: 'http', namespace, url });
    return this;
  }

  build(): McpConfig[] {
    return [...this._configs];
  }
}