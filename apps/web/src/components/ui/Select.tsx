import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect from '@mui/material/Select';
import { useId } from 'react';

import { controlRadius, token } from './tokens';
import { visuallyHidden } from './visuallyHidden';

export interface SelectProps {
  label: string;
  hideLabel?: boolean;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  /** Shown in the box while nothing is picked. */
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

/** A dropdown for short lists (for long ones, use ComboBox). Its menu follows the theme. */
export function Select({
  label,
  hideLabel,
  value,
  options,
  onChange,
  placeholder,
  error,
  disabled,
}: SelectProps) {
  const id = useId();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <Box
        component="span"
        id={`${id}-label`}
        sx={hideLabel ? visuallyHidden : { fontSize: 12, color: token('mt') }}
      >
        {label}
      </Box>
      <SelectMenu
        labelId={`${id}-label`}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        error={error ? `${id}-error` : undefined}
      />
      {error && (
        <Box id={`${id}-error`} sx={{ fontSize: 13, color: token('bad') }}>
          {error}
        </Box>
      )}
    </Box>
  );
}

export interface SelectMenuProps {
  /** The element that names it (its label). */
  labelId: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** The id of its error message, when it has one. */
  error?: string;
  /** `compact` for tight spots, e.g. the guild switcher in the sidebar. */
  size?: 'compact';
}

/** The box and its themed menu, shared by Select and the app shell's switcher. */
export function SelectMenu({
  labelId,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  error,
  size,
}: SelectMenuProps) {
  const compact = size === 'compact';
  return (
    <MuiSelect<string>
      // Our own box (InputBase); "outlined" would pass it props it doesn't know.
      variant="standard"
      value={value}
      displayEmpty
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      renderValue={(selected) =>
        options.find((option) => option.value === selected)?.label ?? (
          <Box component="span" sx={{ color: token('mt') }}>
            {placeholder}
          </Box>
        )
      }
      // Named by its label only, not by the label and the value as MUI does by default.
      SelectDisplayProps={{
        'aria-labelledby': labelId,
        ...(error && { 'aria-invalid': true, 'aria-describedby': error }),
      }}
      input={
        <InputBase
          sx={{
            minHeight: compact ? 32 : 38,
            font: 'inherit',
            fontSize: compact ? 12.5 : 14,
            color: token('tx'),
            bgcolor: token('bg'),
            border: `1px solid ${error ? token('bad') : token('dv')}`,
            borderRadius: controlRadius,
            '&.Mui-focused': { outline: `2px solid ${token('ac')}`, outlineOffset: 0 },
            '&.Mui-disabled': { bgcolor: token('sf') },
            '& .MuiSelect-select': { p: compact ? '4px 32px 4px 8px' : '7px 32px 7px 10px' },
            '& .MuiSelect-icon': { color: token('mt') },
          }}
        />
      }
      MenuProps={{
        slotProps: {
          paper: {
            sx: {
              mt: '2px',
              borderRadius: controlRadius,
              bgcolor: token('sf'),
              border: `1px solid ${token('dv')}`,
              boxShadow: '0 8px 24px rgb(0 0 0 / .35)',
            },
          },
          list: { sx: { py: '4px' } },
        },
      }}
    >
      {options.map((option) => (
        <MenuItem
          key={option.value}
          value={option.value}
          sx={{
            fontSize: compact ? 12.5 : 14,
            minHeight: 34,
            color: token('tx'),
            '&:hover': { bgcolor: token('sf2') },
            '&.Mui-selected': { bgcolor: token('ac-bg'), color: token('ac-ink'), fontWeight: 700 },
            '&.Mui-selected:hover, &.Mui-selected.Mui-focusVisible': { bgcolor: token('ac-bg') },
            '&.Mui-focusVisible': { bgcolor: token('sf2') },
          }}
        >
          {option.label}
        </MenuItem>
      ))}
    </MuiSelect>
  );
}
