/**
 * Shared timeout utility for async operations
 * Prevents infinite loading states by wrapping promises with a timeout
 */

export class TimeoutError extends Error {
  constructor(message: string = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap an async function with a timeout
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds (default: 15000)
 * @param errorMessage - Custom error message for timeout
 * @returns Promise that rejects with TimeoutError if timeout exceeded
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 15000,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(errorMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || 
    (error instanceof Error && error.message.toLowerCase().includes('timeout'));
}
