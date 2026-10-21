import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

/**
 * Form fields side by side, wrapping on narrow screens.
 *
 * <FormGrid>
 *   <TextField … />
 *   <FormGrid.Wide><CheckboxGroup … /></FormGrid.Wide>
 * </FormGrid>
 */
function FormGridRoot({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
        gap: '14px 16px',
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  );
}

/** A field that spans the whole row. */
function Wide({ children }: { children: ReactNode }) {
  return <Box sx={{ gridColumn: '1 / -1' }}>{children}</Box>;
}

export const FormGrid = Object.assign(FormGridRoot, { Wide });
