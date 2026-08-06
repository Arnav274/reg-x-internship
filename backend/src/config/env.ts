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
