import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Icon, type IconName } from './Icon';
import { controlRadius, token } from './tokens';

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
  const linkProps = to
    ? { component: Link, to }
    : href
      ? { href, ...(newTab && { target: '_blank', rel: 'noopener noreferrer' }) }
      : { type, onClick };
  return (
    <MuiButton
      {...linkProps}
      disabled={disabled}
      disableRipple
      disableElevation
      startIcon={startIcon && <Icon name={startIcon} size={14} />}
      endIcon={endIcon && <Icon name={endIcon} />}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: text ? '6px' : medium ? '8px' : '10px',
        p: text ? '2px 0' : large ? '12px 18px' : medium ? '9px 16px' : '6px 10px',
        minWidth: large ? 260 : 0,
        // Rounded buttons, a change from the design's square ones (decided on 2026-10-21).
        borderRadius: controlRadius,
        font: 'inherit',
        fontSize: text ? 12.5 : large ? 15 : medium ? 14 : 12,
        fontWeight: large || medium ? 800 : 600,
        lineHeight: 1.45,
        textTransform: 'none',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        alignSelf: text ? 'flex-start' : undefined,
        // A primary danger button is filled red, e.g. "Disband guild".
        bgcolor: primary ? (tone === 'danger' ? token('bad') : token('ac')) : 'transparent',
        color: primary
          ? tone === 'danger'
            ? token('bg')
            : token('ac-on')
          : tone === 'danger'
            ? token('bad')
            : text
              ? token('mt')
              : token('tx'),
        border: primary || text ? 0 : `1px solid ${tone === 'danger' ? token('bad') : token('dv')}`,
        '& .MuiButton-startIcon, & .MuiButton-endIcon': { m: 0 },
        '&:hover': text
          ? { color: token('tx'), bgcolor: 'transparent' }
          : {
              bgcolor: primary
                ? tone === 'danger'
                  ? token('bad')
                  : token('ac-h')
                : tone === 'danger'
                  ? token('bad-bg')
                  : token('sf2'),
              ...(primary && tone === 'danger' && { filter: 'brightness(1.1)' }),
            },
        '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
        '&.Mui-disabled': {
          opacity: 0.6,
          color: primary
            ? tone === 'danger'
              ? token('bg')
              : token('ac-on')
            : tone === 'danger'
              ? token('bad')
              : token('mt'),
        },
      }}
    >
      <Box component="span" sx={{ flex: large ? 1 : 'none', textAlign: 'left' }}>
        {children}
      </Box>
    </MuiButton>
  );
}
