export interface CapturedEnvironment {
  userAgent: string;
  capturedAt: string;
}

/**
 * Client-side diagnostic context, per FR1.3. `capturedAt` is deliberately not
 * called `datetime`: the ticket's stored timestamp is server-stamped and never
 * client-supplied (architecture.md 3.1), so this one is only ever a diagnostic
 * reading of the user's clock, which may be wrong or deliberately skewed.
 *
 * Nothing persists either field, and the API rejects unknown body fields, so
 * this stays client-side and is never added to the submit payload.
 */
export function captureEnvironment(): CapturedEnvironment {
  return {
    userAgent: navigator.userAgent,
    capturedAt: new Date().toISOString(),
  };
}
