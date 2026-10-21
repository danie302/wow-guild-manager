import Box from '@mui/material/Box';
import type { ReactNode } from 'react';

import { token } from './tokens';

export interface ActionListProps {
  /** Accessible name of the list. */
  label: string;
  children: ReactNode;
  /** Shown instead of the items when there are none. */
  empty?: string;
}

/**
 * A list of items that each have their own buttons, e.g. registrations to approve or reject.
 *
 * <ActionList label="Requests to join" empty="Nothing waiting.">
 *   <ActionList.Item actions={<Button>Approve</Button>}>…</ActionList.Item>
 * </ActionList>
 */
function ActionListRoot({ label, children, empty }: ActionListProps) {
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
    >
      {children}
      {empty && (
        <Box
          sx={{
            p: '20px 16px',
            bgcolor: token('sf'),
            color: token('mt'),
            '&:not(:last-child)': { display: 'none' },
          }}
        >
          {empty}
        </Box>
      )}
    </Box>
  );
}

export interface ActionListItemProps {
  /** Who or what the item is, e.g. a character name with a line of detail. */
  title: ReactNode;
  /** The item's state or extra fields, beside the title on wide screens. */
  children?: ReactNode;
  /** Buttons for the item. */
  actions: ReactNode;
}

function Item({ title, children, actions }: ActionListItemProps) {
  return (
    <Box
      role="listitem"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px 20px',
        p: '14px 16px',
        bgcolor: token('sf'),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          flex: '1 1 200px',
          minWidth: 0,
        }}
      >
        {title}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '6px',
          flex: '2 1 300px',
          minWidth: 0,
        }}
      >
        {children}
      </Box>
      <Box sx={{ display: 'flex', gap: '6px' }}>{actions}</Box>
    </Box>
  );
}

export const ActionList = Object.assign(ActionListRoot, { Item });
