import { z } from 'zod';

/** Variables every process (api, bot, worker) needs. */
export const baseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
});

export const apiConfigSchema = baseConfigSchema.extend({
  PORT: z.coerce.number().int().positive().default(3000),
  /** Signs the session cookie. A long random string; changing it logs everyone out. */
  SESSION_SECRET: z.string().min(32),
  /** Where people open the web app. Discord sends them back to `<WEB_ORIGIN>/api/auth/discord/callback`. */
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** The Discord application's OAuth2 credentials. Without them the API runs, but login is off. */
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  /** Where uploaded files (guild images) are stored: a Docker volume in development. */
  UPLOADS_DIR: z.string().min(1).default('/uploads'),
  /** Reads servers and roles for the guild setup. Without it (or the client ID), setup is off. */
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
});

export const botConfigSchema = baseConfigSchema.extend({
  DISCORD_BOT_TOKEN: z.string().min(1),
});

export const workerConfigSchema = baseConfigSchema.extend({
  /** Sends direct messages (e.g. about registrations). Without it, they aren't sent. */
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;
export type WorkerConfig = z.infer<typeof workerConfigSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Reads and validates the configuration. Throws a ConfigError naming every invalid variable. */
export function loadConfig<Schema extends z.ZodType>(
  schema: Schema,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<Schema> {
  // An empty variable (e.g. `DISCORD_CLIENT_ID=` in .env) counts as not set.
  const setVariables = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = schema.safeParse(setVariables);
  if (result.success) {
    return result.data;
  }

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    return env[name] ? `${name}: ${issue.message}` : `${name} is required`;
  });
  throw new ConfigError(`Invalid environment variables:\n  ${problems.join('\n  ')}`);
}

/** Like loadConfig, but prints the problem and exits, for use at process startup. */
export function loadConfigOrExit<Schema extends z.ZodType>(schema: Schema): z.infer<Schema> {
  try {
    return loadConfig(schema);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
