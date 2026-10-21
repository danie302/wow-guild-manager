import Box from '@mui/material/Box';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { createContext, useContext, useId, type ReactNode } from 'react';

import { token } from './tokens';

interface RadioListContextValue {
  name: string;
  value: string | null;
  onChange: (value: string) => void;
}

const RadioListContext = createContext<RadioListContextValue | null>(null);

export interface RadioListProps {
  /** Accessible name of the list. */
  label: string;
  /** The picked option, or null when none is picked yet. */
  value: string | null;
  onChange: (value: string) => void;
  children: ReactNode;
}

/**
 * Pick one item from a list of rows, each with an image and a detail line.
 *
 * <RadioList label="Discord server" value={id} onChange={setId}>
 *   <RadioList.Option value="1" imageUrl="…" detail="…">Ashen Vanguard</RadioList.Option>
 * </RadioList>
 */
function RadioListRoot({ label, value, onChange, children }: RadioListProps) {
  const name = useId();
  return (
    <RadioListContext.Provider value={{ name, value, onChange }}>
      <RadioGroup
        aria-label={label}
        name={name}
        value={value ?? ''}
        onChange={(_, next) => onChange(next)}
        sx={{ display: 'flex', flexDirection: 'column', border: `1px solid ${token('dv')}` }}
      >
        {children}
      </RadioGroup>
    </RadioListContext.Provider>
  );
}

export interface RadioListOptionProps {
  value: string;
  /** Square image on the left; without one, the first letter is shown. */
  imageUrl?: string | null;
  /** Secondary text under the name. */
  detail?: string;
  disabled?: boolean;
  /** The option's name. */
  children: string;
}

function Option({ value, imageUrl, detail, disabled, children }: RadioListOptionProps) {
  const list = useContext(RadioListContext);
  if (!list) {
    throw new Error('<RadioList.Option> must be inside <RadioList>');
  }
  const checked = list.value === value;
  return (
    <Box
      component="label"
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        p: '10px 12px',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        bgcolor: checked ? token('ac-bg') : 'transparent',
        boxShadow: checked ? `inset 2px 0 0 ${token('ac')}` : 'none',
        '& + &': { borderTop: `1px solid ${token('ln')}` },
        '&:hover': disabled || checked ? {} : { bgcolor: token('sf2') },
        '&:has(.Mui-focusVisible)': { outline: `2px solid ${token('ac')}`, outlineOffset: -2 },
      }}
    >
      {/* The row itself shows the choice, so the radio is only for keyboards and screen readers. */}
      <Radio value={value} disabled={disabled} disableRipple sx={visuallyHidden} />
      {imageUrl ? (
        <Box component="img" src={imageUrl} alt="" sx={{ width: 32, height: 32, flex: 'none' }} />
      ) : (
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            bgcolor: token('sf2'),
            color: token('mt'),
          }}
        >
          {children.charAt(0).toUpperCase()}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box component="span" sx={{ fontWeight: 700 }}>
          {children}
        </Box>
        {detail && (
          <Box component="span" sx={{ fontSize: 12.5, color: token('mt') }}>
            {detail}
          </Box>
        )}
      </Box>
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

export const RadioList = Object.assign(RadioListRoot, { Option });
