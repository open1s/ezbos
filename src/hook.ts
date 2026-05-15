import { HookEvent as JSHookEvent, HookContextData } from '@open1s/jsbos';

export const HookEvent = {
  BeforeToolCall: 0,
  AfterToolCall: 1,
  BeforeLlmCall: 2,
  AfterLlmCall: 3,
  OnMessage: 4,
  OnComplete: 5,
  OnError: 6,
} as const;

export type HookEvent = typeof HookEvent[keyof typeof HookEvent];
export type { HookContextData } from '@open1s/jsbos';

export const HookDecision = {
  Continue: 'continue',
  Abort: 'abort',
} as const;

export type HookDecision = 'continue' | 'abort';

export type HookCallback = (ctx: HookContextData) => string | Promise<string>;

const registeredHooks = new WeakMap<object, Map<HookEvent, HookCallback[]>>();

export function hook(event: HookEvent) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    const hooks = registeredHooks.get(target) || new Map();
    if (!hooks.has(event)) hooks.set(event, []);
    hooks.get(event)!.push(async function(this: any, ctx: HookContextData) {
      return await original.call(this, ctx);
    });
    registeredHooks.set(target, hooks);
    return descriptor;
  };
}

export function createHookRegistry(instance: object): Array<{ event: HookEvent, callback: HookCallback }> {
  const hooks: Array<{ event: HookEvent, callback: HookCallback }> = [];
  const proto = Object.getPrototypeOf(instance);
  const map = registeredHooks.get(instance) || registeredHooks.get(proto);
  if (map) {
    for (const [event, callbacks] of map) {
      for (const cb of callbacks) {
        hooks.push({ event: event as HookEvent, callback: cb });
      }
    }
  }
  return hooks;
}

export function mergeHooks(...sources: any[]): Array<{ event: HookEvent, callback: HookCallback }> {
  const result: Array<{ event: HookEvent, callback: HookCallback }> = [];
  for (const source of sources) {
    if (!source) continue;
    if (typeof source === 'object' && 'callback' in source) {
      result.push(source as { event: HookEvent, callback: HookCallback });
    } else if (typeof source === 'object') {
      const hooks = createHookRegistry(source);
      result.push(...hooks);
    } else if (typeof source === 'function') {
      const hooks = createHookRegistry(source.prototype || source);
      result.push(...hooks);
    }
  }
  return result;
}

export function defineHook(event: HookEvent, callback: HookCallback): { event: HookEvent, callback: HookCallback } {
  return { event, callback };
}