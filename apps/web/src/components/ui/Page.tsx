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

export const Page = Object.assign(PageRoot, { Header, Title, Section });
