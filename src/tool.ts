import * as jsbos from '@open1s/jsbos';
import { z } from 'zod';
import { ConfigurationError, InvalidArgumentsError, ToolExecutionError } from './errors';

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
  cancelable?: boolean;
  cancelCallback?: (callId: string) => void;
}

export { jsbos };

export class ToolBuilder {
  private _params: Record<string, ToolParam> = {};
  private _required: string[] = [];
  private _cancelable = false;
  private _cancelCb?: (callId: string) => void;

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

  cancelable(): this {
    this._cancelable = true;
    return this;
  }

  onCancel(callback: (callId: string) => void): this {
    this._cancelCb = callback;
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
      cancelable: this._cancelable,
      cancelCallback: this._cancelCb,
      callback: wrappedCallback
    };
  }
}

export interface TypedToolDef<T = any> {
  name: string;
  description: string;
  /** zod schema describing the tool arguments; converted to JSON Schema for the LLM and enforced at runtime. */
  parameters: z.ZodType<T>;
  execute: (args: T) => any | Promise<any>;
  cancelable?: boolean;
  onCancel?: (callId: string) => void;
}

function serializeToolResult(result: any): string {
  if (result === undefined) return '';
  if (typeof result === 'string') return result;
  return JSON.stringify(result);
}

/**
 * Define a tool.
 *
 * Preferred form — a single definition object with a zod schema:
 * ```ts
 * const weather = defineTool({
 *   name: 'get_weather',
 *   description: 'Get the weather for a city',
 *   parameters: z.object({ city: z.string() }),
 *   execute: async ({ city }) => ok({ temp: 21 }),
 * });
 * ```
 * Arguments are validated at runtime; failures come back to the model as
 * `Error: tool "get_weather" received invalid arguments: ...`.
 *
 * Legacy builder form (still supported):
 * `defineTool('name', 'description').param(...).handle(fn)`
 */
export function defineTool(name: string, description: string): ToolBuilder;
export function defineTool<T>(definition: TypedToolDef<T>): InternalToolDef;
export function defineTool<T>(
  nameOrDefinition: string | TypedToolDef<T>,
  description?: string
): ToolBuilder | InternalToolDef {
  if (typeof nameOrDefinition === 'string') {
    return new ToolBuilder(nameOrDefinition, description ?? '');
  }

  const def = nameOrDefinition;
  if (!def.name || !def.description || typeof def.parameters !== 'object') {
    throw new ConfigurationError(
      'defineTool({ ... }) requires name, description and a zod parameters schema'
    );
  }

  let jsonSchema: Record<string, any>;
  try {
    jsonSchema = z.toJSONSchema(def.parameters as z.ZodType, { io: 'input' }) as Record<string, any>;
    delete jsonSchema.$schema;
  } catch (cause) {
    throw new ConfigurationError(
      `tool "${def.name}": zod schema cannot be converted to JSON Schema`,
      { cause }
    );
  }

  const callback = async (rawArgs: any): Promise<string> => {
    let args: any;
    try {
      args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    } catch (cause) {
      return 'Error: ' + new InvalidArgumentsError(def.name, 'arguments were not valid JSON').message;
    }

    const parsed = def.parameters.safeParse(args);
    if (!parsed.success) {
      return 'Error: ' + new InvalidArgumentsError(def.name, parsed.error.issues).message;
    }

    try {
      const result = await def.execute(parsed.data);
      if (isErrorResult(result)) {
        return 'Error: ' + new ToolExecutionError(def.name, result.error || 'Unknown error').message;
      }
      return serializeToolResult(result);
    } catch (e: any) {
      return 'Error: ' + new ToolExecutionError(def.name, e?.message || String(e), { cause: e }).message;
    }
  };

  return {
    name: def.name,
    description: def.description,
    schema: jsonSchema,
    callback,
    cancelable: def.cancelable,
    cancelCallback: def.onCancel
  };
}

export function tool(name: string, description: string, callback: (args: any) => any): InternalToolDef {
  return new ToolBuilder(name, description).handle(callback);
}