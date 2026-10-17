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
});

export const botConfigSchema = baseConfigSchema.extend({
  DISCORD_BOT_TOKEN: z.string().min(1),
});

export type BaseConfig = z.infer<typeof baseConfigSchema>;
export type ApiConfig = z.infer<typeof apiConfigSchema>;
export type BotConfig = z.infer<typeof botConfigSchema>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Reads and validates the configuration. Throws a ConfigError naming every invalid variable. */
export function loadConfig<Schema extends z.ZodType>(
  schema: Schema,
  env: NodeJS.ProcessEnv = process.env,
): z.infer<Schema> {
  const result = schema.safeParse(env);
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
