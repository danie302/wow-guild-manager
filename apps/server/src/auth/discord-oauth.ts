/** What the login needs from a Discord account. */
export interface DiscordProfile {
  id: string;
  /** Display name, falling back to the username. */
  name: string;
  /** Avatar hash, or null for the default avatar. */
  avatar: string | null;
}

/** The Discord OAuth2 calls behind the login, as an interface so tests can fake Discord. */
export interface DiscordOAuth {
  /** The Discord page that asks the user to authorize the app. */
  authorizeUrl(state: string): string;
  /**
   * Trades the code from the callback for the user's profile. The access token is used once
   * here and dropped: it's never stored or sent to the browser.
   */
  fetchProfile(code: string): Promise<DiscordProfile>;
}

export class DiscordOAuthError extends Error {
  override name = 'DiscordOAuthError';
}

export interface DiscordOAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const DISCORD_API = 'https://discord.com/api/v10';

/** Only `identify`: guild membership and roles are read by the bot, not with the user's token. */
const SCOPES = 'identify';

export function createDiscordOAuth({
  clientId,
  clientSecret,
  redirectUri,
}: DiscordOAuthOptions): DiscordOAuth {
  return {
    authorizeUrl(state) {
      const url = new URL('https://discord.com/oauth2/authorize');
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: SCOPES,
        redirect_uri: redirectUri,
        state,
        // Skips the consent screen when the user already authorized the app.
        prompt: 'none',
      }).toString();
      return url.toString();
    },

    async fetchProfile(code) {
      const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });
      if (!tokenResponse.ok) {
        throw new DiscordOAuthError(`Token exchange failed with status ${tokenResponse.status}`);
      }
      const { access_token: accessToken } = (await tokenResponse.json()) as {
        access_token: string;
      };

      const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userResponse.ok) {
        throw new DiscordOAuthError(`Fetching the user failed with status ${userResponse.status}`);
      }
      const user = (await userResponse.json()) as {
        id: string;
        username: string;
        global_name: string | null;
        avatar: string | null;
      };
      return { id: user.id, name: user.global_name ?? user.username, avatar: user.avatar };
    },
  };
}

/** The image URL for a Discord avatar hash, or Discord's default avatar for that user. */
export function discordAvatarUrl(discordId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`;
  }
  // Discord picks the default avatar from the user ID.
  const index = (BigInt(discordId) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}
