import Box from '@mui/material/Box';
import { useId, useRef, type ChangeEvent } from 'react';

import { Button } from './Button';
import { token } from './tokens';

export interface ImagePickerProps {
  label: string;
  /** The image shown, or null for the initials. */
  imageUrl: string | null;
  /** Shown when there's no image. */
  initials: string;
  /** File types the file dialog offers, e.g. "image/png,image/jpeg". */
  accept: string;
  chooseLabel: string;
  removeLabel: string;
  onChoose: (file: File) => void;
  onRemove: () => void;
  /** Shown under the image in red. */
  error?: string;
  hint?: string;
  disabled?: boolean;
}

/** A square image with buttons to choose a new file or remove it. */
export function ImagePicker({
  label,
  imageUrl,
  initials,
  accept,
  chooseLabel,
  removeLabel,
  onChoose,
  onRemove,
  error,
  hint,
  disabled,
}: ImagePickerProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const message = error ?? hint;
  return (
    <Box
      role="group"
      aria-labelledby={`${id}-label`}
      sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
    >
      <Box id={`${id}-label`} sx={{ fontWeight: 700 }}>
        {label}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px' }}>
        {imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={label}
            sx={{ width: 72, height: 72, objectFit: 'cover', border: `1px solid ${token('ln')}` }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              width: 72,
              height: 72,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              fontWeight: 800,
              bgcolor: token('ac'),
              color: token('ac-on'),
            }}
          >
            {initials}
          </Box>
        )}
        {!disabled && (
          <>
            <Box
              component="input"
              ref={input}
              type="file"
              accept={accept}
              aria-label={chooseLabel}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                if (file) onChoose(file);
                // Choosing the same file again should fire again.
                event.target.value = '';
              }}
              sx={{ display: 'none' }}
            />
            <Button onClick={() => input.current?.click()}>{chooseLabel}</Button>
            {imageUrl && <Button onClick={onRemove}>{removeLabel}</Button>}
          </>
        )}
      </Box>
      {message && (
        <Box sx={{ fontSize: 13, color: error ? token('bad') : token('mt') }}>{message}</Box>
      )}
    </Box>
  );
}
