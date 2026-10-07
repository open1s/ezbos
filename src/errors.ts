/**
 * Structured errors for the ezbos Agent SDK.
 *
 * Every failure surfaced by the SDK is an {@link EzbosError} carrying a
 * machine-readable `code` so callers can branch without string-matching
 * messages: ```ts
 * try {
 *   await agent.run(task);
 * } catch (e) {
 *   if (e instanceof EzbosError && e.code === 'CANCELLED') return;
 *   throw e;
 * }
 * ```
 */

export type EzbosErrorCode =
  | 'CONFIGURATION'
  | 'TOOL_EXECUTION'
  | 'INVALID_ARGUMENTS'
  | 'STREAM_ERROR'
  | 'CANCELLED'
  | 'TIMEOUT';

/** Base class for every error thrown by the ezbos Agent SDK. */
export class EzbosError extends Error {
  /** Machine-readable discriminator for branching without message matching. */
  readonly code: EzbosErrorCode;

  constructor(code: EzbosErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = 'EzbosError';
    this.code = code;
  }
}

/** Invalid SDK configuration (bad options, unconvertible schema, ...). */
export class ConfigurationError extends EzbosError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('CONFIGURATION', message, options);
    this.name = 'ConfigurationError';
  }
}

/** A tool callback threw or returned a failure result. */
export class ToolExecutionError extends EzbosError {
  readonly tool: string;

  constructor(tool: string, message: string, options?: { cause?: unknown }) {
    super('TOOL_EXECUTION', `tool "${tool}" failed: ${message}`, options);
    this.name = 'ToolExecutionError';
    this.tool = tool;
  }
}

/** Tool arguments did not match the declared schema. */
export class InvalidArgumentsError extends EzbosError {
  readonly tool: string;
  readonly issues: unknown;

  constructor(tool: string, issues: unknown) {
    super('INVALID_ARGUMENTS', `tool "${tool}" received invalid arguments: ${JSON.stringify(issues)}`);
    this.name = 'InvalidArgumentsError';
    this.tool = tool;
    this.issues = issues;
  }
}

/** The token stream failed (LLM/network error surfaced mid-stream). */
export class StreamError extends EzbosError {
  constructor(message: string, options?: { cause?: unknown }) {
    super('STREAM_ERROR', message, options);
    this.name = 'StreamError';
  }
}

/** The run was cancelled via AbortSignal or agent.stop(). */
export class CancelledError extends EzbosError {
  constructor(message = 'run cancelled') {
    super('CANCELLED', message);
    this.name = 'CancelledError';
  }
}

/** The run exceeded its configured timeout. */
export class TimeoutError extends EzbosError {
  constructor(message: string) {
    super('TIMEOUT', message);
    this.name = 'TimeoutError';
  }
}

/** Normalize an unknown thrown value into an {@link EzbosError}. */
export function toEzbosError(e: unknown): EzbosError {
  if (e instanceof EzbosError) return e;
  if (e instanceof Error) return new StreamError(e.message, { cause: e });
  return new StreamError(String(e));
}
