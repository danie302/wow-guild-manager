import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon, type IconName } from './Icon';
import { token } from './tokens';

export interface ButtonProps {
  children: ReactNode;
  /** `primary` for the main action of a screen, `secondary` for the rest. */
  variant?: 'primary' | 'secondary' | 'text';
  /** `medium` for a page's main action next to its title, e.g. "Add member". */
  size?: 'small' | 'medium' | 'large';
  /** Renders a link that looks like a button, for actions that leave the page. */
  href?: string;
  /** A page in the app to open, without reloading it. */
  to?: string;
  /** With `href`, opens the link in a new tab. */
  newTab?: boolean;
  /** `submit` makes the button send its form. */
  type?: 'button' | 'submit';
  onClick?: () => void;
  disabled?: boolean;
  /** `danger` for actions that can't be undone, e.g. "Cancel event". */
  tone?: 'danger';
  startIcon?: IconName;
  endIcon?: IconName;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'small',
  href,
  to,
  newTab,
  type = 'button',
  onClick,
  disabled,
  tone,
  startIcon,
  endIcon,
}: ButtonProps) {
  const primary = variant === 'primary';
  /** A plain link-like button, e.g. "‹ Back". */
  const text = variant === 'text';
  const large = size === 'large';
  const medium = size === 'medium';
  return (
    <Box
      component={to ? Link : href ? 'a' : 'button'}
      {...(to
        ? { to }
        : href
          ? { href, ...(newTab && { target: '_blank', rel: 'noopener noreferrer' }) }
          : { type, onClick, disabled })}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: medium ? '8px' : '10px',
        p: large ? '12px 18px' : medium ? '9px 16px' : '6px 10px',
        minWidth: large ? 260 : undefined,
        font: 'inherit',
        fontSize: large ? 15 : medium ? 14 : 12,
        fontWeight: large || medium ? 800 : 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        bgcolor: primary ? token('ac') : 'transparent',
        color: primary
          ? token('ac-on')
          : tone === 'danger'
            ? token('bad')
            : text
              ? token('mt')
              : token('tx'),
        border: primary || text ? 0 : `1px solid ${token('dv')}`,
        ...(text && { p: '2px 0', gap: '6px', fontSize: 12.5, alignSelf: 'flex-start' }),
        '&:hover': text
          ? { color: token('tx') }
          : {
              bgcolor: primary ? token('ac-h') : tone === 'danger' ? token('bad-bg') : token('sf2'),
            },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
        '&:disabled': { opacity: 0.6, cursor: 'default' },
      }}
    >
      {startIcon && <Icon name={startIcon} size={14} />}
      <Box component="span" sx={{ flex: large ? 1 : 'none' }}>
        {children}
      </Box>
      {endIcon && <Icon name={endIcon} />}
    </Box>
  );
}
