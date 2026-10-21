import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import { useId, type ReactNode } from 'react';

import { Button } from './Button';
import { token } from './tokens';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Asks before something that can't be undone, e.g. leaving with unsaved changes. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby={titleId}
      slotProps={{ paper: { sx: { bgcolor: token('sf'), borderRadius: 0, p: 3, gap: 2 } } }}
    >
      <Box id={titleId} component="h2" sx={{ m: 0, fontSize: 18, fontWeight: 800 }}>
        {title}
      </Box>
      {children && <Box sx={{ color: token('mt') }}>{children}</Box>}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant="primary" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Box>
    </Dialog>
  );
}
