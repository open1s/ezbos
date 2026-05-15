export interface SessionConfig {
  keepRecent?: number;
  maxSummaryChars?: number;
}

export class SessionBuilder {
  private _path: string | null = null;
  private _compact?: { keepRecent: number, maxSummaryChars: number };

  save(path: string): this {
    this._path = path;
    return this;
  }

  compact(keepRecent: number = 10, maxSummaryChars: number = 2000): this {
    this._compact = { keepRecent, maxSummaryChars };
    return this;
  }

  build(): { path: string | null, compact?: { keepRecent: number, maxSummaryChars: number } } {
    return { path: this._path, compact: this._compact };
  }
}