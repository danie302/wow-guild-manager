import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface CharacterNameProps {
  name: string;
  /** The class code (e.g. "warlock"); the name is shown in the class color. */
  characterClass: string;
  /** `large` for a heading, e.g. a character card. */
  size?: 'large';
}

/** A character's name in its class color, as everywhere in the design. */
export function CharacterName({ name, characterClass, size }: CharacterNameProps) {
  return (
    <Box
      component="span"
      sx={{
        fontWeight: size === 'large' ? 800 : 700,
        fontSize: size === 'large' ? 16 : undefined,
        color: token(`c-${characterClass}` as TokenName),
      }}
    >
      {name}
    </Box>
  );
}
