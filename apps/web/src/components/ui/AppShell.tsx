import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createContext, useContext, type ChangeEvent, type ReactNode } from 'react';
import { NavLink } from 'react-router';

import { Icon, type IconName } from './Icon';
import { compactBreakpoint, token } from './tokens';

interface AppShellContextValue {
  /** Narrow screens: the sidebar becomes a top bar and the navigation a row. */
  compact: boolean;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function useAppShell(part: string): AppShellContextValue {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error(`<AppShell.${part}> must be used inside <AppShell>`);
  }
  return context;
}

export interface AppShellProps {
  children: ReactNode;
}

/**
 * The app frame: a sidebar (a top bar on narrow screens) and the main content.
 *
 * <AppShell>
 *   <AppShell.Sidebar>
 *     <AppShell.Brand title="…" subtitle="…" initials="…" />
 *     <AppShell.Nav label="…">
 *       <AppShell.NavItem to="/" icon="dashboard">…</AppShell.NavItem>
 *       <AppShell.NavSeparator />
 *     </AppShell.Nav>
 *   </AppShell.Sidebar>
 *   <AppShell.Main>…</AppShell.Main>
 * </AppShell>
 */
function AppShellRoot({ children }: AppShellProps) {
  const compact = useMediaQuery(`(max-width:${compactBreakpoint - 1}px)`);
  return (
    <AppShellContext.Provider value={{ compact }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          minHeight: '100vh',
          bgcolor: token('bg'),
          color: token('tx'),
        }}
      >
        {children}
      </Box>
    </AppShellContext.Provider>
  );
}

function Sidebar({ children }: { children: ReactNode }) {
  const { compact } = useAppShell('Sidebar');
  return (
    <Box
      component="aside"
      sx={{
        flex: 'none',
        width: compact ? '100%' : 240,
        height: compact ? 'auto' : '100vh',
        position: compact ? 'static' : 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: compact ? 'center' : 'stretch',
        bgcolor: token('sf'),
        borderRight: compact ? 0 : `2px solid ${token('dv')}`,
        borderBottom: compact ? `2px solid ${token('dv')}` : 0,
        zIndex: 5,
        overflow: 'auto',
      }}
    >
      {children}
    </Box>
  );
}

export interface AppShellBrandProps {
  title: string;
  subtitle?: string;
  /** One or two letters shown in the square badge. */
  initials: string;
  /** Shown instead of the initials when set. */
  imageUrl?: string | null;
}

function Brand({ title, subtitle, initials, imageUrl }: AppShellBrandProps) {
  useAppShell('Brand');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', p: '18px 16px', flex: 'none' }}>
      {imageUrl ? (
        <Box component="img" src={imageUrl} alt="" sx={{ width: 30, height: 30, flex: 'none' }} />
      ) : (
        <Box
          sx={{
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
            bgcolor: token('ac'),
            color: token('ac-on'),
            fontWeight: 800,
            fontSize: 12,
          }}
        >
          {initials}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
          {title}
        </Box>
        {subtitle && (
          <Box sx={{ fontSize: 11.5, color: token('mt'), whiteSpace: 'nowrap' }}>{subtitle}</Box>
        )}
      </Box>
    </Box>
  );
}

export interface AppShellSwitcherProps {
  /** Accessible name, e.g. "Switch guild". */
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** A compact dropdown under the brand, e.g. to switch between guilds. */
function Switcher({ label, value, options, onChange }: AppShellSwitcherProps) {
  useAppShell('Switcher');
  return (
    <Box sx={{ p: '0 16px 12px', flex: 'none' }}>
      <Box
        component="select"
        aria-label={label}
        title={label}
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
        sx={{
          width: '100%',
          minHeight: 32,
          p: '4px 8px',
          font: 'inherit',
          fontSize: 12.5,
          color: token('tx'),
          bgcolor: token('bg'),
          border: `1px solid ${token('dv')}`,
          '&:focus-visible': { outline: `2px solid ${token('ac')}`, outlineOffset: 0 },
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Box>
    </Box>
  );
}

export interface AppShellNavProps {
  /** Accessible name of the navigation landmark. */
  label: string;
  children: ReactNode;
}

function Nav({ label, children }: AppShellNavProps) {
  const { compact } = useAppShell('Nav');
  return (
    <Box
      component="nav"
      aria-label={label}
      sx={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: '1px',
        p: '4px 8px',
        flex: 1,
      }}
    >
      {children}
    </Box>
  );
}

export interface AppShellNavItemProps {
  to: string;
  icon: IconName;
  children: ReactNode;
  /** Only active on this exact path, not on its children (use for "/"). */
  end?: boolean;
  /** A count to show, e.g. requests waiting; hidden when 0 or left out. */
  badge?: number;
}

function NavItem({ to, icon, children, end, badge }: AppShellNavItemProps) {
  useAppShell('NavItem');
  return (
    <Box
      component={NavLink}
      to={to}
      end={end}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        p: '8px 10px',
        color: token('mt'),
        fontSize: 13.5,
        fontWeight: 500,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        '&:hover': { bgcolor: token('sf2'), color: token('tx') },
        '&.active': {
          bgcolor: token('sf2'),
          color: token('tx'),
          fontWeight: 700,
          boxShadow: `inset 2px 0 0 ${token('ac')}`,
        },
      }}
    >
      <Icon name={icon} />
      <Box component="span" sx={{ flex: 1 }}>
        {children}
      </Box>
      {badge ? (
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 800,
            p: '1px 6px',
            bgcolor: token('ac'),
            color: token('ac-on'),
          }}
        >
          {badge}
        </Box>
      ) : null}
    </Box>
  );
}

function NavSeparator() {
  const { compact } = useAppShell('NavSeparator');
  if (compact) {
    return null;
  }
  return <Box role="separator" sx={{ height: '1px', bgcolor: token('ln'), m: '10px 4px' }} />;
}

function Main({ children }: { children: ReactNode }) {
  const { compact } = useAppShell('Main');
  return (
    <Box
      component="main"
      sx={{ flex: 1, minWidth: 0, p: compact ? '20px 16px 64px' : '28px 32px 72px' }}
    >
      {children}
    </Box>
  );
}

export interface AppShellAccountProps {
  name: string;
  avatarUrl: string;
  /** Actions for the account, e.g. a sign-out button. */
  children?: ReactNode;
}

/** The logged-in user at the bottom of the sidebar (or the end of the top bar). */
function Account({ name, avatarUrl, children }: AppShellAccountProps) {
  const { compact } = useAppShell('Account');
  return (
    <Box
      sx={{
        mt: compact ? 0 : 'auto',
        ml: compact ? 'auto' : 0,
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: compact ? 'center' : 'stretch',
        gap: '10px',
        p: '14px 16px',
        borderTop: compact ? 0 : `2px solid ${token('dv')}`,
        flex: 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <Box
          component="img"
          src={avatarUrl}
          alt=""
          sx={{ width: 30, height: 30, flex: 'none', bgcolor: token('sf2') }}
        />
        {!compact && (
          <Box sx={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </Box>
        )}
      </Box>
      {children && <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{children}</Box>}
    </Box>
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  Switcher,
  Sidebar,
  Brand,
  Nav,
  NavItem,
  NavSeparator,
  Main,
  Account,
});
