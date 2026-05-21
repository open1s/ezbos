import * as jsbos from '@open1s/jsbos';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export function ok(data: any, metadata?: Record<string, any>): ToolResult {
  return { success: true, data, metadata };
}

export function err(error: string, metadata?: Record<string, any>): ToolResult {
  return { success: false, error, metadata };
}

export function isErrorResult(result: any): result is ToolResult {
  return result && typeof result.success === 'boolean' && !result.success;
}

export interface ToolParam {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
}

export interface InternalToolDef {
  name: string;
  description: string;
  schema: Record<string, any>;
  callback: (args: Record<string, any>) => string | Promise<string>;
}

export { jsbos };

export class ToolBuilder {
  private _params: Record<string, ToolParam> = {};
  private _required: string[] = [];
  
  constructor(
    private _name: string, 
    private _description: string
  ) {}

  param(name: string, type: ToolParam['type'], description?: string, defaultValue?: any): this {
    this._params[name] = { type, description, default: defaultValue };
    return this;
  }

  required(name: string, type: ToolParam['type'], description?: string): this {
    this._params[name] = { type, description };
    this._required.push(name);
    return this;
  }

  handle(callback: (args: Record<string, any>) => any): InternalToolDef {
    const isAsync = callback.constructor.name === 'AsyncFunction' ||
      callback.toString().startsWith('async ');

    const properties: Record<string, any> = {};
    for (const [key, spec] of Object.entries(this._params)) {
      properties[key] = { type: spec.type };
      if (spec.description) properties[key].description = spec.description;
      if (spec.default !== undefined) properties[key].default = spec.default;
    }

    const schema = {
      type: 'object',
      properties,
      required: this._required.length > 0 ? this._required : Object.keys(this._params)
    };

    const wrappedCallback = async (rawArgs: any): Promise<string> => {
      try {
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
        const result = await callback(args);

        if (isErrorResult(result)) return 'Error: ' + (result.error || 'Unknown error');
        if (result === undefined) return '';
        if (typeof result === 'string') return result;
        return JSON.stringify(result);
      } catch (e: any) {
        return 'Error: ' + (e.message || String(e));
      }
    };

    return {
      name: this._name,
      description: this._description,
      schema,
      callback: wrappedCallback
    };
  }
}

export function defineTool(name: string, description: string): ToolBuilder {
  return new ToolBuilder(name, description);
}

export function tool(name: string, description: string, callback: (args: any) => any): InternalToolDef {
  return new ToolBuilder(name, description).handle(callback);
}