import { CLASSES, COMBAT_ROLES, type CombatRole } from '@wgm/shared';
import { REST, Routes, type APIApplication, type APIEmoji } from 'discord.js';

import { NO_EMOJIS, type PostEmojis } from '../../domain/event-post.js';
import type { Logger } from '../../logger.js';

/** The prefix of our emoji names, e.g. "wgm_mage", so other emojis of the app are left alone. */
export const EMOJI_PREFIX = 'wgm_';

/**
 * The bot application's own emojis (Discord lets an app keep up to 2000, usable only by its
 * bot), by name. The class and role icons of event posts are uploaded there by
 * `pnpm discord:emojis` (src/scripts/upload-emojis.ts). Tests use a fake.
 */
export interface AppEmojis {
  /** Emoji IDs by name. */
  list(): Promise<Map<string, string>>;
  /** Uploads an emoji (PNG, JPEG, or GIF up to 256 KB) and resolves its ID. */
  upload(name: string, image: Buffer, type: string): Promise<string>;
}

/** discord.js's REST client waits out rate limits. */
export function createRestAppEmojis(botToken: string): AppEmojis {
  const rest = new REST({ version: '10' }).setToken(botToken);
  let applicationId: string | undefined;
  const app = async () => {
    applicationId ??= ((await rest.get(Routes.currentApplication())) as APIApplication).id;
    return applicationId;
  };

  return {
    async list() {
      const { items } = (await rest.get(Routes.applicationEmojis(await app()))) as {
        items: APIEmoji[];
      };
      return new Map(
        items.flatMap((emoji) => (emoji.id && emoji.name ? [[emoji.name, emoji.id]] : [])),
      );
    },

    async upload(name, image, type) {
      const emoji = (await rest.post(Routes.applicationEmojis(await app()), {
        body: { name, image: `data:${type};base64,${image.toString('base64')}` },
      })) as APIEmoji;
      return emoji.id!;
    },
  };
}

/** The post's icons from the app's emojis, with the fallback role icons for missing ones. */
export function postEmojis(emojis: Map<string, string>): PostEmojis {
  const markup = (name: string) => {
    const id = emojis.get(EMOJI_PREFIX + name);
    return id ? `<:${EMOJI_PREFIX}${name}:${id}>` : undefined;
  };
  return {
    classes: Object.fromEntries(
      CLASSES.flatMap((characterClass) => {
        const emoji = markup(characterClass);
        return emoji ? [[characterClass, emoji]] : [];
      }),
    ),
    roles: Object.fromEntries(
      COMBAT_ROLES.map((role) => [role, markup(role) ?? NO_EMOJIS.roles[role]]),
    ) as Record<CombatRole, string>,
  };
}

/**
 * The post's icons, read from Discord at most once an hour per process (the emojis rarely
 * change, and a new one shows up within the hour). If Discord fails, posts use the fallback
 * icons instead of failing.
 */
export function postEmojiSource(
  emojis: AppEmojis | null,
  logger: Logger,
  ttlMs = 60 * 60 * 1000,
): () => Promise<PostEmojis> {
  let cached: { at: number; value: PostEmojis } | undefined;
  return async () => {
    if (!emojis) return NO_EMOJIS;
    if (cached && Date.now() - cached.at < ttlMs) return cached.value;
    try {
      cached = { at: Date.now(), value: postEmojis(await emojis.list()) };
    } catch (err) {
      logger.warn({ err }, 'Could not read the app emojis; posts use the fallback icons');
      cached = { at: Date.now(), value: NO_EMOJIS };
    }
    return cached.value;
  };
}
