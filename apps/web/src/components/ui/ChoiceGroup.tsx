import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { createContext, useContext, useId, type ReactNode } from 'react';

import { controlRadius, token } from './tokens';
import { visuallyHidden } from './visuallyHidden';

const SmallContext = createContext(false);

export interface ChoiceGroupProps<Value extends string> {
  /** Accessible name of the group, shown above it unless hidden. */
  label: string;
  /** Keeps the label for screen readers only. */
  hideLabel?: boolean;
  /** Smaller options, e.g. a secondary filter like Upcoming / Past. */
  size?: 'small';
  value: Value;
  onChange: (value: Value) => void;
  /** Shows the choice without letting it change, e.g. for someone who can't edit it. */
  disabled?: boolean;
  children: ReactNode;
}

/**
 * Pick one of a few options, shown as joined buttons (a segmented control). One is always
 * picked.
 *
 * <ChoiceGroup label="Theme" value={theme} onChange={setTheme}>
 *   <ChoiceGroup.Option value="dark">Dark</ChoiceGroup.Option>
 * </ChoiceGroup>
 */
function ChoiceGroupRoot<Value extends string>({
  label,
  hideLabel,
  size,
  value,
  onChange,
  disabled,
  children,
}: ChoiceGroupProps<Value>) {
  const labelId = useId();
  return (
    <SmallContext.Provider value={size === 'small'}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
        <Box id={labelId} sx={hideLabel ? visuallyHidden : { fontSize: 12, color: token('mt') }}>
          {label}
        </Box>
        <ToggleButtonGroup
          exclusive
          disabled={disabled}
          aria-labelledby={labelId}
          value={value}
          // Clicking the picked option again would unpick it; keep one picked.
          onChange={(_, next: Value | null) => next !== null && onChange(next)}
          sx={{
            border: `1px solid ${token('dv')}`,
            borderRadius: controlRadius,
            overflow: 'hidden',
          }}
        >
          {children}
        </ToggleButtonGroup>
      </Box>
    </SmallContext.Provider>
  );
}

export interface ChoiceGroupOptionProps {
  value: string;
  children: ReactNode;
}

function Option({ value, children, ...groupProps }: ChoiceGroupOptionProps) {
  const small = useContext(SmallContext);
  return (
    <ToggleButton
      // ToggleButtonGroup passes its props (selected, onChange…) through to each option.
      {...groupProps}
      value={value}
      disableRipple
      sx={{
        p: small ? '7px 14px' : '8px 18px',
        border: 0,
        borderRadius: 0,
        font: 'inherit',
        fontSize: small ? 13 : 14,
        fontWeight: 700,
        lineHeight: 1.45,
        textTransform: 'none',
        color: token('tx'),
        '&:hover': { bgcolor: token('sf2') },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: token('ac'), color: token('ac-on') },
        '&.Mui-focusVisible': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
        '&.Mui-disabled': { color: token('mt'), border: 0 },
        '&.Mui-selected.Mui-disabled': { bgcolor: token('sf2'), color: token('tx') },
      }}
    >
      {children}
    </ToggleButton>
  );
}

export const ChoiceGroup = Object.assign(ChoiceGroupRoot, { Option });
