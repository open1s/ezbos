import { HookEvent, HookDecision, PluginToolCallInfo } from '@open1s/jsbos';

export { HookEvent, HookDecision };
export type { PluginToolCallInfo };

export interface ToolParamSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
  required?: boolean;
}

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