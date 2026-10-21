import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { token } from './tokens';

/**
 * A page's content: a header with the title, then sections.
 *
 * <Page>
 *   <Page.Header><Page.Title>…</Page.Title></Page.Header>
 *   <Page.Section title="…">…</Page.Section>
 * </Page>
 */
function PageRoot({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>{children}</Box>;
}

function Header({ children }: { children: ReactNode }) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
        pb: 2,
        borderBottom: `2px solid ${token('dv')}`,
      }}
    >
      {children}
    </Box>
  );
}

/** Controls on the right of a page header, e.g. a search box and the page's main button. */
function Actions({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-end' }}>{children}</Box>
  );
}

/** Filters under a page header, one row each. */
function Filters({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        '& > *': { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center' },
      }}
    >
      {children}
    </Box>
  );
}

/** The buttons at the end of a form, after a rule, with an optional hint beside them. */
function Footer({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
        pt: 2,
        borderTop: `2px solid ${token('dv')}`,
      }}
    >
      {children}
    </Box>
  );
}

/** Small muted text inside a line, e.g. "+1 alt" after a name. */
function Muted({ children }: { children: ReactNode }) {
  return (
    <Box component="span" sx={{ fontSize: 12, color: token('mt'), fontWeight: 400 }}>
      {children}
    </Box>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <Typography variant="h1">{children}</Typography>;
}

export interface PageSectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: PageSectionProps) {
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Typography variant="h2" sx={{ color: token('mt') }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export interface PageSettingProps {
  title: string;
  description?: string;
  /** The control that changes the setting. */
  children: ReactNode;
}

/** One row of a settings page: the setting's name and description, then its control. */
function Setting({ title, description, children }: PageSettingProps) {
  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
        gap: '12px 32px',
        '& + &': { pt: 3, borderTop: `2px solid ${token('dv')}` },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Typography variant="h2" sx={{ fontSize: 15, fontWeight: 800 }}>
          {title}
        </Typography>
        {description && <Box sx={{ fontSize: 13, color: token('mt') }}>{description}</Box>}
      </Box>
      <Box sx={{ minWidth: 0, justifySelf: 'start', width: '100%' }}>{children}</Box>
    </Box>
  );
}

/** A muted line of explanation. */
function Text({ children }: { children: ReactNode }) {
  return <Box sx={{ fontSize: 13, color: token('mt') }}>{children}</Box>;
}

export const Page = Object.assign(PageRoot, {
  Header,
  Actions,
  Filters,
  Title,
  Section,
  Setting,
  Text,
  Muted,
  Footer,
});
