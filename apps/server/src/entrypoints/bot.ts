import { createBotClient, describeLoginError } from '../bot/client.js';
import { commands } from '../bot/commands/index.js';
import { botConfigSchema, loadConfigOrExit } from '../config.js';
import { createLogger } from '../logger.js';

const config = loadConfigOrExit(botConfigSchema);
const logger = createLogger(config);

const client = createBotClient({ logger, commands });

process.on('SIGTERM', () => {
  logger.info('Disconnecting from Discord');
  void client.destroy().then(() => process.exit(0));
});

try {
  await client.login(config.DISCORD_BOT_TOKEN);
} catch (err) {
  logger.fatal({ err }, describeLoginError(err));
  process.exit(1);
}
