/** Local diagnostics only: durations contain no query text or customer data. */
export class ServerTiming {
  private readonly enabled = process.env.NODE_ENV === "development";
  private readonly startedAt = performance.now();
  private readonly entries: string[] = [];

  async measure<T>(name: string, read: () => PromiseLike<T>): Promise<T> {
    const start = performance.now();
    try {
      return await read();
    } finally {
      if (this.enabled) this.entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`);
    }
  }

  append(headers: Headers, totalName: string): void {
    if (!this.enabled) return;
    this.entries.push(`${totalName};dur=${(performance.now() - this.startedAt).toFixed(1)}`);
    headers.append("Server-Timing", this.entries.join(", "));
  }
}
