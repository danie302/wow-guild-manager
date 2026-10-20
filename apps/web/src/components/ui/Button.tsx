import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';
import { token } from './tokens';

export interface ButtonProps {
  children: ReactNode;
  /** `primary` for the main action of a screen, `secondary` for the rest. */
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'large';
  /** Renders a link that looks like a button, for actions that leave the page. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  endIcon?: IconName;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'small',
  href,
  onClick,
  disabled,
  endIcon,
}: ButtonProps) {
  const primary = variant === 'primary';
  const large = size === 'large';
  return (
    <Box
      component={href ? 'a' : 'button'}
      {...(href ? { href } : { type: 'button', onClick, disabled })}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        p: large ? '12px 18px' : '6px 10px',
        minWidth: large ? 260 : undefined,
        font: 'inherit',
        fontSize: large ? 15 : 12,
        fontWeight: large ? 800 : 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        bgcolor: primary ? token('ac') : 'transparent',
        color: primary ? token('ac-on') : token('tx'),
        border: primary ? 0 : `1px solid ${token('dv')}`,
        '&:hover': { bgcolor: primary ? token('ac-h') : token('sf2') },
        '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
        '&:disabled': { opacity: 0.6, cursor: 'default' },
      }}
    >
      <Box component="span" sx={{ flex: large ? 1 : 'none' }}>
        {children}
      </Box>
      {endIcon && <Icon name={endIcon} />}
    </Box>
  );
}
