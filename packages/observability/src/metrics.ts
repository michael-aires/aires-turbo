/**
 * Tiny in-process counter / histogram helpers that ride on top of
 * `console.log` when OTEL is off, or feed the OTel SDK when it's on.
 * Purposefully small — services compose these rather than reimplementing
 * timing boilerplate in every handler.
 */

export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  onDone?: (durationMs: number, error?: unknown) => void,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    onDone?.(Date.now() - start);
    return result;
  } catch (error) {
    onDone?.(Date.now() - start, error);
    throw error;
  }
}
