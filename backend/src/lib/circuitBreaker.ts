export type CBState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CBState = "CLOSED";
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly threshold: number = 5,
    private readonly cooldownMs: number = 30_000,
  ) {}

  get isOpen(): boolean {
    if (this.state !== "OPEN") return false;
    if (Date.now() - this.openedAt >= this.cooldownMs) {
      this.state = "HALF_OPEN";
      return false;
    }
    return true;
  }

  success(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  fail(): void {
    this.failures++;
    this.openedAt = Date.now();
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
      console.error(`[circuit-breaker] OPEN after ${this.failures} failures`);
    }
  }

  getState(): CBState { return this.state; }
  getFailures(): number { return this.failures; }
}

// Singleton used by errorHandler and health check
export const dbBreaker = new CircuitBreaker(5, 30_000);
