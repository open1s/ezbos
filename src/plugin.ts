import { jsbos } from './tool.js';

export interface PluginHandlers {
  name?: string;
  on_llm_request?: (req: any) => any;
  on_llm_response?: (resp: any) => any;
  on_tool_call?: (call: any) => any;
  on_tool_result?: (result: any) => any;
}

const registeredPlugins = new WeakMap<object, PluginHandlers>();

export function plugin(name: string) {
  return function <T extends { new (...args: any[]): {} }>(target: T) {
    return class extends target {
      __pluginName = name;
      constructor(...args: any[]) {
        super(...args);
        const handlers: PluginHandlers = { name };
        const proto = target.prototype;
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (key === 'constructor') continue;
          const method = (proto as any)[key];
          if (typeof method === 'function') {
            if (key === 'on_llm_request') handlers.on_llm_request = method.bind(this);
            else if (key === 'on_llm_response') handlers.on_llm_response = method.bind(this);
            else if (key === 'on_tool_call') handlers.on_tool_call = method.bind(this);
            else if (key === 'on_tool_result') handlers.on_tool_result = method.bind(this);
          }
        }
        registeredPlugins.set(this, handlers);
      }
    };
  };
}

export function on_llm_request(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

export function on_llm_response(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

export function on_tool_call(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

export function on_tool_result(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
  return descriptor;
}

export function getPluginHandlers(instance: object): PluginHandlers {
  const registered = registeredPlugins.get(instance);
  if (registered) return registered;

  const name = instance?.constructor?.name;
  const handlers: PluginHandlers = { name };

  const proto = Object.getPrototypeOf(instance);
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor') continue;
    const method = (proto as any)[key];
    if (typeof method === 'function') {
      if (key === 'on_llm_request') handlers.on_llm_request = method.bind(instance);
      else if (key === 'on_llm_response') handlers.on_llm_response = method.bind(instance);
      else if (key === 'on_tool_call') handlers.on_tool_call = method.bind(instance);
      else if (key === 'on_tool_result') handlers.on_tool_result = method.bind(instance);
    }
  }

  return handlers;
}

export function mergePlugins(...sources: any[]): PluginHandlers[] {
  const result: PluginHandlers[] = [];
  for (const source of sources) {
    if (!source) continue;
    if (typeof source === 'object' && 'name' in source) {
      result.push(source as PluginHandlers);
    } else if (typeof source === 'function') {
      const instance = new (source as any)();
      result.push(getPluginHandlers(instance));
    } else if (typeof source === 'object') {
      result.push(getPluginHandlers(source));
    }
  }
  return result;
}

export function definePlugin(handlers: PluginHandlers): PluginHandlers {
  return handlers;
}