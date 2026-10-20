import Box from '@mui/material/Box';
import { createContext, useContext, useId, type ReactNode } from 'react';

import { token } from './tokens';

interface ChoiceGroupContextValue {
  name: string;
  value: string;
  onChange: (value: string) => void;
}

const ChoiceGroupContext = createContext<ChoiceGroupContextValue | null>(null);

export interface ChoiceGroupProps<Value extends string> {
  /** Accessible name of the group. Shown above it unless `hideLabel` is set. */
  label: string;
  /** Hide the label when the page already shows it, e.g. in a settings row. */
  hideLabel?: boolean;
  value: Value;
  onChange: (value: Value) => void;
  children: ReactNode;
}

/**
 * Pick one of a few options, shown as joined buttons (a segmented control). It's a radio
 * group for keyboards and screen readers.
 *
 * <ChoiceGroup label="Theme" value={theme} onChange={setTheme}>
 *   <ChoiceGroup.Option value="dark">Dark</ChoiceGroup.Option>
 * </ChoiceGroup>
 */
function ChoiceGroupRoot<Value extends string>({
  label,
  hideLabel,
  value,
  onChange,
  children,
}: ChoiceGroupProps<Value>) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <ChoiceGroupContext.Provider
      value={{ name, value, onChange: (next) => onChange(next as Value) }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
        <Box id={labelId} sx={hideLabel ? visuallyHidden : { fontWeight: 700 }}>
          {label}
        </Box>
        <Box
          role="radiogroup"
          aria-labelledby={labelId}
          sx={{ display: 'flex', border: `1px solid ${token('dv')}` }}
        >
          {children}
        </Box>
      </Box>
    </ChoiceGroupContext.Provider>
  );
}

export interface ChoiceGroupOptionProps {
  value: string;
  children: ReactNode;
}

function Option({ value, children }: ChoiceGroupOptionProps) {
  const group = useContext(ChoiceGroupContext);
  if (!group) {
    throw new Error('<ChoiceGroup.Option> must be inside <ChoiceGroup>');
  }
  const checked = group.value === value;
  return (
    <Box
      component="label"
      sx={{
        position: 'relative',
        p: '8px 18px',
        fontWeight: 700,
        cursor: 'pointer',
        bgcolor: checked ? token('ac') : 'transparent',
        color: checked ? token('ac-on') : token('tx'),
        '&:hover': { bgcolor: checked ? token('ac') : token('sf2') },
        '&:has(input:focus-visible)': { outline: `2px solid ${token('ac')}`, outlineOffset: 2 },
      }}
    >
      <Box
        component="input"
        type="radio"
        name={group.name}
        value={value}
        checked={checked}
        onChange={() => group.onChange(value)}
        sx={visuallyHidden}
      />
      {children}
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export const ChoiceGroup = Object.assign(ChoiceGroupRoot, { Option });
