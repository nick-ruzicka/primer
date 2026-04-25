/**
 * Retry logic with exponential backoff and deduplication.
 * Handles transient failures and prevents duplicate concurrent requests.
 */

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

// Track in-flight requests to deduplicate concurrent calls
const inflightRequests = new Map<string, Promise<unknown>>();

/**
 * Execute function with exponential backoff retry logic.
 * Automatically deduplicates concurrent calls with the same key.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  dedupeKey?: string
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Return existing promise if this key is already in flight
  if (dedupeKey && inflightRequests.has(dedupeKey)) {
    return inflightRequests.get(dedupeKey) as Promise<T>;
  }

  const executeWithRetries = async (): Promise<T> => {
    let lastError: Error | null = null;
    let delay = finalConfig.initialDelayMs;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === finalConfig.maxAttempts) {
          break;
        }

        // Only retry on specific error types (network, timeout)
        if (!isRetryableError(error)) {
          throw lastError;
        }

        // Wait before retrying
        await sleep(delay);
        delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
      }
    }

    throw lastError || new Error("Unknown error");
  };

  const promise = executeWithRetries();

  // Track the request
  if (dedupeKey) {
    inflightRequests.set(dedupeKey, promise);
    promise.finally(() => {
      inflightRequests.delete(dedupeKey);
    });
  }

  return promise;
}

/**
 * Determine if an error is retryable (transient) or permanent.
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors are retryable
    if (error.name === "NetworkError" || error.name === "TypeError") {
      return true;
    }
    // Check for abort/timeout messages
    if (
      error.message.includes("aborted") ||
      error.message.includes("timeout") ||
      error.message.includes("connection")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cancel any pending retries for a deduplication key.
 */
export function cancelRetries(dedupeKey: string): void {
  inflightRequests.delete(dedupeKey);
}
