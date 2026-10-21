import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useId } from 'react';

import { token } from './tokens';

export interface ComboBoxOption {
  value: string;
  label: string;
  /** Heading the option is listed under. Options must be sorted by group. */
  group?: string;
  /** Secondary text shown on the right, e.g. "UTC−05:00". */
  detail?: string;
  /** Extra words that should find this option when typed. */
  keywords?: string;
}

export interface ComboBoxProps {
  /** Accessible name. Shown above the field unless `hideLabel` is set. */
  label: string;
  hideLabel?: boolean;
  value: string;
  options: readonly ComboBoxOption[];
  onChange: (value: string) => void;
  /** Shown when the typed text matches nothing. */
  noOptionsText: string;
  /** Help text under the field. */
  hint?: string;
  disabled?: boolean;
  /**
   * For options searched on the server: called with the typed text, and the options are shown
   * as given instead of filtered here.
   */
  onInputChange?: (text: string) => void;
  /** Shown in the field while it's empty. */
  placeholder?: string;
}

/** Lowercase, without accents, and with "_" and "/" as spaces, so "sao paulo" finds "São_Paulo". */
function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_/]/g, ' ')
    .toLowerCase();
}

const filterOptions = createFilterOptions<ComboBoxOption>({
  stringify: (option) =>
    searchable([option.label, option.group, option.value, option.keywords].join(' ')),
});

/**
 * A searchable dropdown for long lists: type to filter, pick with the mouse or keyboard.
 *
 * <ComboBox label="Time zone" value={zone} options={zones} onChange={setZone} noOptionsText="…" />
 */
export function ComboBox({
  label,
  hideLabel,
  value,
  options,
  onChange,
  noOptionsText,
  hint,
  disabled,
  onInputChange,
  placeholder,
}: ComboBoxProps) {
  const id = useId();
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, maxWidth: 420 }}>
      {!hideLabel && (
        <Box component="label" htmlFor={id} sx={{ fontWeight: 700 }}>
          {label}
        </Box>
      )}
      <Autocomplete
        id={id}
        disabled={disabled}
        options={options}
        value={selected}
        onChange={(_event, option) => {
          if (option) onChange(option.value);
        }}
        disableClearable={selected !== null}
        autoHighlight
        filterOptions={(list, state) =>
          onInputChange
            ? list
            : filterOptions(list, { ...state, inputValue: searchable(state.inputValue) })
        }
        {...(onInputChange && {
          onInputChange: (_event: unknown, text: string, reason: string) => {
            if (reason === 'input') onInputChange(text);
          },
        })}
        groupBy={(option) => option.group ?? ''}
        getOptionLabel={(option) =>
          option.group ? `${option.label} · ${option.group}` : option.label
        }
        isOptionEqualToValue={(option, current) => option.value === current.value}
        noOptionsText={noOptionsText}
        renderOption={({ key, ...props }, option) => (
          <Box
            component="li"
            key={key}
            {...props}
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
          >
            <span>{option.label}</span>
            {option.detail && (
              <Box component="span" sx={{ color: token('mt'), fontSize: 12.5, flex: 'none' }}>
                {option.detail}
              </Box>
            )}
          </Box>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            size="small"
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps.htmlInput,
                ...(hideLabel && { 'aria-label': label }),
                ...(hint && { 'aria-describedby': `${id}-hint` }),
              },
            }}
          />
        )}
        slotProps={{
          paper: { sx: { bgcolor: token('sf'), border: `1px solid ${token('dv')}` } },
          listbox: {
            sx: {
              '& .MuiAutocomplete-groupLabel': {
                bgcolor: token('sf2'),
                color: token('mt'),
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: '28px',
              },
            },
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': { bgcolor: token('sf') },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: token('dv') },
        }}
      />
      {hint && (
        <Box id={`${id}-hint`} sx={{ fontSize: 13, color: token('mt') }}>
          {hint}
        </Box>
      )}
    </Box>
  );
}
