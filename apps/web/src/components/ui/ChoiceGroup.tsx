import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Box from '@mui/material/Box';
import { createContext, useId, useContext, type ReactNode } from 'react';

import { token } from './tokens';

const ChoiceGroupContext = createContext<{ name: string } | null>(null);

export interface ChoiceGroupProps<Value extends string> {
  /** Visible label for the whole group. */
  label: string;
  value: Value;
  onChange: (value: Value) => void;
  children: ReactNode;
}

/**
 * Pick one option from a short list (radio buttons).
 *
 * <ChoiceGroup label="Language" value={locale} onChange={setLocale}>
 *   <ChoiceGroup.Option value="en">English</ChoiceGroup.Option>
 * </ChoiceGroup>
 */
function ChoiceGroupRoot<Value extends string>({
  label,
  value,
  onChange,
  children,
}: ChoiceGroupProps<Value>) {
  const name = useId();
  const labelId = `${name}-label`;
  return (
    <ChoiceGroupContext.Provider value={{ name }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Box id={labelId} sx={{ fontWeight: 700 }}>
          {label}
        </Box>
        <RadioGroup
          aria-labelledby={labelId}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value as Value)}
        >
          {children}
        </RadioGroup>
      </Box>
    </ChoiceGroupContext.Provider>
  );
}

export interface ChoiceGroupOptionProps {
  value: string;
  children: ReactNode;
}

function Option({ value, children }: ChoiceGroupOptionProps) {
  if (!useContext(ChoiceGroupContext)) {
    throw new Error('<ChoiceGroup.Option> must be inside <ChoiceGroup>');
  }
  return (
    <FormControlLabel
      value={value}
      control={<Radio sx={{ color: token('mt'), '&.Mui-checked': { color: token('ac') } }} />}
      label={children}
    />
  );
}

export const ChoiceGroup = Object.assign(ChoiceGroupRoot, { Option });
