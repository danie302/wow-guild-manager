import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

/**
 * A short form on one line, on a panel: fields that share the width, aligned at the bottom,
 * then a button, e.g. picking a member and adding them. It wraps on narrow screens.
 *
 * <FormRow>
 *   <ComboBox variant="field" … />
 *   <FormRow.Fit><Button …>Add</Button></FormRow.Fit>
 * </FormRow>
 */
function FormRowRoot({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 1.5,
        p: '14px',
        bgcolor: token('sf'),
        '& > *': { flex: '1 1 200px', minWidth: 0 },
      }}
    >
      {children}
    </Box>
  );
}

/** Takes only the width it needs, e.g. a button or a segmented control. */
function Fit({ children }: { children: ReactNode }) {
  return <Box sx={{ flex: '0 0 auto !important' }}>{children}</Box>;
}

export const FormRow = Object.assign(FormRowRoot, { Fit });
