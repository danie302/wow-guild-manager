import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

import { Icon } from './Icon';
import { token } from './tokens';

export interface WizardProps {
  title: string;
  lead?: string;
  /** e.g. "Step 2 of 3". */
  progress: string;
  /** The steps' names, in order. */
  steps: readonly string[];
  /** Index of the current step. */
  current: number;
  /** The current step's content, then `<Wizard.Actions>`. */
  children: ReactNode;
}

/**
 * A full-screen flow of a few steps, outside the app shell: the list of steps on the left and
 * the current step on the right.
 *
 * <Wizard title="…" progress="Step 1 of 3" steps={['…', '…']} current={0}>
 *   …fields…
 *   <Wizard.Actions>…buttons…</Wizard.Actions>
 * </Wizard>
 */
function WizardRoot({ title, lead, progress, steps, current, children }: WizardProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        p: '48px clamp(20px, 6vw, 96px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        bgcolor: token('bg'),
        color: token('tx'),
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          pb: '20px',
          borderBottom: `2px solid ${token('dv')}`,
        }}
      >
        <Box sx={{ fontSize: 12, color: token('mt') }}>{progress}</Box>
        <Typography variant="h1" sx={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.015em' }}>
          {title}
        </Typography>
        {lead && <Box sx={{ color: token('mt') }}>{lead}</Box>}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-start' }}>
        <Box
          component="ol"
          sx={{ listStyle: 'none', m: 0, p: 0, flex: '0 1 260px', minWidth: 220 }}
        >
          {steps.map((step, index) => {
            const reached = index <= current;
            return (
              <Box
                component="li"
                key={step}
                aria-current={index === current ? 'step' : undefined}
                sx={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  py: '12px',
                  borderBottom: `1px solid ${token('ln')}`,
                  color: index === current ? token('tx') : token('mt'),
                  fontWeight: index === current ? 800 : 500,
                }}
              >
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    width: 26,
                    height: 26,
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 800,
                    bgcolor: reached ? token('ac') : token('sf2'),
                    color: reached ? token('ac-on') : token('mt'),
                  }}
                >
                  {index < current ? <Icon name="check" size={14} /> : index + 1}
                </Box>
                {step}
              </Box>
            );
          })}
        </Box>
        <Box
          sx={{
            flex: '1 1 420px',
            maxWidth: 560,
            p: 3,
            bgcolor: token('sf'),
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        pt: 2,
        borderTop: `2px solid ${token('dv')}`,
      }}
    >
      {children}
    </Box>
  );
}

/** Muted explanatory text inside a step. */
function Text({ children }: { children: ReactNode }) {
  return <Box sx={{ color: token('mt'), fontSize: 14, textWrap: 'pretty' }}>{children}</Box>;
}

export const Wizard = Object.assign(WizardRoot, { Actions, Text });
