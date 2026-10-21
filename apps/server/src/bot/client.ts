import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  type Guild,
  type Interaction,
} from 'discord.js';

import { translator } from '../i18n/index.js';
import type { Logger } from '../logger.js';
import type { SlashCommand } from './commands/index.js';
import { replyLocale } from './locale.js';

export interface BotDependencies {
  logger: Logger;
  commands: readonly SlashCommand[];
}

export function createBotClient({ logger, commands }: BotDependencies): Client {
  const client = new Client({
    // GuildMembers is privileged: it must be enabled in the Discord Developer Portal (see README).
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  client.once(Events.ClientReady, (ready) => {
    logger.info({ user: ready.user.tag, servers: ready.guilds.cache.size }, 'Bot online');
    for (const guild of ready.guilds.cache.values()) {
      void registerCommands(guild, commands, logger);
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    logger.info({ guildId: guild.id }, 'Bot added to a server');
    void registerCommands(guild, commands, logger);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, commands, logger);
  });

  return client;
}

/**
 * Registers the commands on one server. Server commands appear right away, unlike global
 * commands, which can take up to an hour. `set` replaces the server's whole command list.
 */
export async function registerCommands(
  guild: Pick<Guild, 'id' | 'commands'>,
  commands: readonly SlashCommand[],
  logger: Logger,
): Promise<void> {
  try {
    await guild.commands.set(commands.map((command) => command.definition));
    logger.info({ guildId: guild.id, count: commands.length }, 'Registered slash commands');
  } catch (err) {
    logger.error({ err, guildId: guild.id }, 'Could not register slash commands');
  }
}

export async function handleInteraction(
  interaction: Interaction,
  commands: readonly SlashCommand[],
  logger: Logger,
): Promise<void> {
  if (interaction.isAutocomplete()) {
    const command = commands.find((c) => c.definition.name === interaction.commandName);
    // Discord drops suggestions that come late or fail, so errors are only logged.
    await command?.autocomplete?.(interaction).catch((err: unknown) => {
      logger.error({ err, command: interaction.commandName }, 'Autocomplete failed');
    });
    return;
  }
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.find(
    (candidate) => candidate.definition.name === interaction.commandName,
  );
  if (!command) {
    logger.warn({ command: interaction.commandName }, 'Unknown slash command');
    return;
  }

  // No guild language until story 022, so unsupported Discord languages get English.
  const locale = replyLocale({ interactionLocale: interaction.locale });
  const t = translator(locale);

  try {
    await command.execute(interaction, { locale, t });
  } catch (err) {
    logger.error({ err, command: interaction.commandName }, 'Slash command failed');
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: t('errors.generic'), flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
    }
  }
}

/** A clearer message for the login errors people hit while setting up the bot. */
export function describeLoginError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/token/i.test(message)) {
    return 'Discord rejected DISCORD_BOT_TOKEN. Copy the token again from the Bot page of your Discord application.';
  }
  if (/disallowed intents/i.test(message)) {
    return 'Discord refused the Server Members intent. Turn on "Server Members Intent" on the Bot page of your Discord application.';
  }
  return `Could not connect to Discord: ${message}`;
}
