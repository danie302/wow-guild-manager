import Box from '@mui/material/Box';

import { Button } from './Button';
import { token } from './tokens';

export interface SaveBarProps {
  /** `dirty`: there are unsaved changes. `saved`: the last save just finished. */
  status: 'clean' | 'dirty' | 'saved';
  /** The text for each status, e.g. "Unsaved changes". */
  statusText: string;
  saveLabel: string;
  discardLabel: string;
  onSave: () => void;
  onDiscard: () => void;
  /** E.g. while a value is invalid or a save is running. */
  saveDisabled?: boolean;
}

/** The bar at the bottom of a page whose changes apply only when saved. */
export function SaveBar({
  status,
  statusText,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saveDisabled,
}: SaveBarProps) {
  const dirty = status === 'dirty';
  return (
    <Box
      sx={{
        position: 'sticky',
        bottom: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px 16px',
        p: '12px 0',
        bgcolor: token('bg'),
        borderTop: `2px solid ${token('dv')}`,
      }}
    >
      <Box
        role="status"
        sx={{
          flex: 1,
          fontWeight: 700,
          color: dirty ? token('warn') : status === 'saved' ? token('ok') : token('mt'),
        }}
      >
        {status === 'clean' ? '' : statusText}
      </Box>
      <Button onClick={onDiscard} disabled={!dirty}>
        {discardLabel}
      </Button>
      <Button variant="primary" onClick={onSave} disabled={!dirty || saveDisabled}>
        {saveLabel}
      </Button>
    </Box>
  );
}
