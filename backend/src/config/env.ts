import dotenv from "dotenv";

dotenv.config();

const REQUIRED_ENV_VARS = ["PORT", "DATABASE_URL", "JWT_SECRET"] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

function loadEnv(): Record<RequiredEnvVar, string> {
  const values = {} as Record<RequiredEnvVar, string>;
  const missing: RequiredEnvVar[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    const value = process.env[key];
    if (value) {
      values[key] = value;
    } else {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}. Check your .env file against .env.example.`
    );
    process.exit(1);
  }

  return values;
}

export const env = loadEnv();

const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173";

export const allowedOrigins: string[] = (process.env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const DEFAULT_RATE_LIMIT_MAX_PER_HOUR = 10;

function loadRateLimitMaxPerHour(): number {
  const raw = process.env.RATE_LIMIT_MAX_PER_HOUR;
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_RATE_LIMIT_MAX_PER_HOUR;
  }

  const parsed = Number(raw);
  // Validated rather than defaulted, because a silent fallback here disables a
  // security control without saying so: a NaN limit makes every "count >= limit"
  // comparison false, so the limiter would accept unlimited requests while
  // appearing to be configured.
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.error(
      `RATE_LIMIT_MAX_PER_HOUR must be a positive integer, received "${raw}". Check your .env file against .env.example.`
    );
    process.exit(1);
  }

  return parsed;
}

export const rateLimitMaxPerHour: number = loadRateLimitMaxPerHour();

// Strict equality to "true" rather than a truthy check: this switch mounts a
// route that hands out signed tokens, so anything unrecognised (unset, "1",
// "yes", a typo) must leave it off. Failing closed is the only safe default for
// a flag whose wrong value is an authentication bypass.
export const devAuthEnabled: boolean = process.env.DEV_AUTH_ENABLED === "true";
