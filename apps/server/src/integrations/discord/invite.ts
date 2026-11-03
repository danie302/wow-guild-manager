/**
 * What the bot needs: in the events channel, see it, post, embed, and read its own posts
 * (View Channels, Send Messages, Embed Links, Read Message History), and mention the Guild
 * Member role in missing-role alerts even when the role isn't mentionable (Mention Everyone).
 */
const BOT_PERMISSIONS = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 16n) | (1n << 17n);

/** Discord's page for adding the bot (and its slash commands) to a server. */
export function botInviteUrl(clientId: string): string {
  const query = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: String(BOT_PERMISSIONS),
  });
  return `https://discord.com/oauth2/authorize?${query.toString()}`;
}
