import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { Button } from './Button';
import { token } from './tokens';

/**
 * A page's content: a header with the title, then sections.
 *
 * <Page>
 *   <Page.Header><Page.Title>…</Page.Title></Page.Header>
 *   <Page.Section title="…">…</Page.Section>
 * </Page>
 */
/** `narrow` caps the width, for a page with a single list (e.g. requests to join). */
function PageRoot({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        ...(narrow && { maxWidth: 1000 }),
      }}
    >
      {children}
    </Box>
  );
}

/** `back` puts a "‹ Label" link on its own line above the title, as on detail pages. */
function Header({ children, back }: { children: ReactNode; back?: { to: string; label: string } }) {
  const row = (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      {children}
    </Box>
  );
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        pb: 2,
        borderBottom: `2px solid ${token('dv')}`,
      }}
    >
      {back && (
        <Button variant="text" startIcon="chevronLeft" to={back.to}>
          {back.label}
        </Button>
      )}
      {row}
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

/** A titled part of a page's content, e.g. "Characters", with an optional line under the title. */
function Block({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          pb: '10px',
          borderBottom: `2px solid ${token('dv')}`,
        }}
      >
        <Box component="h2" sx={{ m: 0, fontSize: 15, fontWeight: 800 }}>
          {title}
        </Box>
        {description && (
          <Box component="span" sx={{ fontSize: 12, color: token('mt') }}>
            {description}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

/**
 * Content in columns of at least 420px, side by side on wide screens. Each child is a column;
 * a column's children stack. A page with one column so far keeps it at its column's width.
 */
function Columns({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))',
        gap: '32px',
        alignItems: 'start',
        '& > *': { display: 'flex', flexDirection: 'column', gap: '32px', minWidth: 0 },
      }}
    >
      {children}
    </Box>
  );
}

/** Small things side by side on one line, e.g. a few text buttons. */
function Inline({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', mt: '4px' }}>{children}</Box>
  );
}

/** A small label over a value or control, e.g. "Rank" in a header. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '5px', maxWidth: 320 }}>
      <Box component="span" sx={{ fontSize: 12, color: token('mt') }}>
        {label}
      </Box>
      {children}
    </Box>
  );
}

/** The sentence under a page title that says what the page is for. */
function Lead({ children }: { children: ReactNode }) {
  return (
    <Box component="p" sx={{ m: 0, color: token('mt'), maxWidth: 640 }}>
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

/** Content kept closer together than the page's sections, e.g. a note over a preview. */
function Stack({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{children}</Box>;
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
  Stack,
  Muted,
  Footer,
  Lead,
  Block,
  Field,
  Columns,
  Inline,
});
