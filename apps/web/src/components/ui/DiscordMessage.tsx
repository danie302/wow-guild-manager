import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/**
 * Discord's own dark-theme colors, so the preview looks like the real message. They aren't
 * design tokens: the preview shows Discord, not the app.
 */
const discord = {
  background: '#313338',
  embed: '#2b2d31',
  text: '#dbdee1',
  heading: '#f2f3f5',
  badge: '#5865f2',
  primary: '#5865f2',
  secondary: '#4e5058',
  code: '#1e1f22',
  codeBorder: '#3f4147',
};

export interface DiscordMessageProps {
  /** The bot's name, and the letters in its avatar. */
  author: { name: string; initials: string };
  /** The badge next to a bot's name ("APP"). */
  appLabel: string;
  embed: {
    /** The bar on the left, as a CSS color. */
    color: string;
    title: ReactNode;
    description?: ReactNode;
    /** Inline fields sit side by side; the others take a full row. */
    fields: { name: ReactNode; value: ReactNode; inline?: boolean }[];
  };
  /** The buttons under the message. */
  buttons?: { label: string; style: 'primary' | 'secondary' }[];
}

/** A preview of a message with an embed, as Discord shows it. */
export function DiscordMessage({ author, appLabel, embed, buttons = [] }: DiscordMessageProps) {
  return (
    <Box
      sx={{
        bgcolor: discord.background,
        color: discord.text,
        p: '20px 20px 24px',
        fontFamily: "'gg sans', 'Noto Sans', Archivo, system-ui, sans-serif",
        maxWidth: 640,
        borderRadius: '8px',
        display: 'flex',
        gap: '14px',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: embed.color,
          color: '#1a1408',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: 13,
          flex: 'none',
        }}
      >
        {author.initials}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Box component="span" sx={{ fontWeight: 600, color: discord.heading, fontSize: 15 }}>
            {author.name}
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: 10,
              fontWeight: 600,
              p: '1px 4px',
              bgcolor: discord.badge,
              color: '#fff',
              borderRadius: '3px',
            }}
          >
            {appLabel}
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            bgcolor: discord.embed,
            borderRadius: '4px',
            overflow: 'hidden',
            maxWidth: 520,
          }}
        >
          <Box sx={{ width: 4, bgcolor: embed.color, flex: 'none' }} />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              p: '10px 14px 14px',
              minWidth: 0,
              flex: 1,
            }}
          >
            <Box sx={{ fontWeight: 700, color: discord.heading, fontSize: 16 }}>{embed.title}</Box>
            {embed.description && (
              <Box sx={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                {embed.description}
              </Box>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '10px 16px',
              }}
            >
              {embed.fields.map((field, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    minWidth: 0,
                    gridColumn: field.inline ? undefined : '1 / -1',
                  }}
                >
                  <Box
                    component="span"
                    sx={{ fontSize: 13, fontWeight: 700, color: discord.heading }}
                  >
                    {field.name}
                  </Box>
                  <Box component="span" sx={{ fontSize: 13.5, lineHeight: 1.35 }}>
                    {field.value}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
        {buttons.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', pt: '4px' }}>
            {buttons.map((button) => (
              <Box
                key={button.label}
                component="span"
                sx={{
                  p: '7px 16px',
                  borderRadius: '3px',
                  bgcolor: discord[button.style],
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {button.label}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Inline code, e.g. a sign-up's number. */
DiscordMessage.Code = function DiscordMessageCode({ children }: { children: ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        fontFamily: 'ui-monospace, Consolas, monospace',
        fontSize: '0.85em',
        p: '1px 4px',
        bgcolor: discord.code,
        border: `1px solid ${discord.codeBorder}`,
        borderRadius: '4px',
      }}
    >
      {children}
    </Box>
  );
};

/** One of the bot application's emojis, from Discord's CDN. */
DiscordMessage.Emoji = function DiscordMessageEmoji({ id, name }: { id: string; name: string }) {
  return (
    <Box
      component="img"
      src={`https://cdn.discordapp.com/emojis/${id}.webp?size=44`}
      alt={`:${name}:`}
      sx={{ width: '1.375em', height: '1.375em', verticalAlign: 'bottom', objectFit: 'contain' }}
    />
  );
};
