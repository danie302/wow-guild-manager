import Box from '@mui/material/Box';
import MuiDialog from '@mui/material/Dialog';
import { useId, type ReactNode } from 'react';

import { token } from './tokens';

export interface DialogProps {
  open: boolean;
  title: string;
  /** A line under the title. */
  description?: string;
  onClose: () => void;
  children: ReactNode;
  /** The buttons at the bottom. */
  actions: ReactNode;
}

/** A dialog with a form in it, e.g. adding a member. For a yes/no question, use ConfirmDialog. */
export function Dialog({ open, title, description, onClose, children, actions }: DialogProps) {
  const titleId = useId();
  return (
    <MuiDialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      fullWidth
      maxWidth="md"
      slotProps={{ paper: { sx: { bgcolor: token('sf'), borderRadius: 0, p: 3, gap: '20px' } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Box id={titleId} component="h2" sx={{ m: 0, fontSize: 20, fontWeight: 800 }}>
          {title}
        </Box>
        {description && <Box sx={{ color: token('mt') }}>{description}</Box>}
      </Box>
      {children}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          pt: 2,
          borderTop: `2px solid ${token('dv')}`,
        }}
      >
        {actions}
      </Box>
    </MuiDialog>
  );
}
