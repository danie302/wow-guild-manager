import Box from '@mui/material/Box';

import { token, type TokenName } from './tokens';

export interface CharacterNameProps {
  name: string;
  /** The class code (e.g. "warlock"); the name is shown in the class color. */
  characterClass: string;
}

/** A character's name in its class color, as everywhere in the design. */
export function CharacterName({ name, characterClass }: CharacterNameProps) {
  return (
    <Box
      component="span"
      sx={{ fontWeight: 700, color: token(`c-${characterClass}` as TokenName) }}
    >
      {name}
    </Box>
  );
}
