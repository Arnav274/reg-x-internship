import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api/config";

export interface AuthContext {
  username: string;
  email: string;
  token: string;
}

// Stands in for the host application's auth state. The identity is mirrored by
// hand from the fixed identity M5-1's dev endpoint signs into the token, the
// same way PRODUCT_NAMES mirrors the backend's productPages.ts. Only the token
// is fetched, because it is the only part the backend actually verifies: a
// placeholder string is rejected by auth.middleware with 401, which is why this
// hook can no longer answer synchronously.
const DEV_IDENTITY = {
  username: "johndoe",
  email: "johndoe@example.com",
};

// Shared across every hook instance rather than held per component. Both
// consumers mount together when the modal opens, so a per-instance request
// would ask for two tokens every open and leave the two components holding
// different ones. Caching the promise means one request per page load, reused
// across close/reopen.
let tokenRequest: Promise<string> | null = null;

function requestDevToken(): Promise<string> {
  if (tokenRequest === null) {
    tokenRequest = fetch(`${API_BASE_URL}/api/v1/dev/token`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Token request failed with status ${response.status}`);
        }
        const body = (await response.json()) as { token: string };
        return body.token;
      })
      .catch((error) => {
        // Drop the cached promise so a later mount can try again. Without this
        // a single failure (backend not up yet, DEV_AUTH_ENABLED off) would be
        // remembered for the lifetime of the page.
        tokenRequest = null;
        throw error;
      });
  }

  return tokenRequest;
}

export function useAuthContext(): AuthContext | null {
  const [auth, setAuth] = useState<AuthContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    requestDevToken()
      .then((token) => {
        if (!cancelled) {
          setAuth({ ...DEV_IDENTITY, token });
        }
      })
      .catch(() => {
        // Stay null. Consumers degrade visibly (submit disabled, no classify
        // call) rather than sending a request the backend would reject anyway.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return auth;
}
