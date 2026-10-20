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

export const Page = Object.assign(PageRoot, { Header, Title, Section, Setting });
