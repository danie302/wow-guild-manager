import {
  CLASS_NAMES,
  characterSchema,
  classesFor,
  MAX_LEVEL,
  PROFESSION_NAMES,
  PROFESSIONS,
  RACE_NAMES,
  racesFor,
  SECONDARY_PROFESSIONS,
  toValidationIssues,
  type CharacterInput,
  type Faction,
  type ValidationIssue,
} from '@wgm/shared';
import { useTranslation } from 'react-i18next';

import { CheckboxGroup, FormGrid, Select, TextField } from '../../components/ui';
import { validationIssueMessage } from '../../i18n/api-errors';

/** A character being entered: every field is text until it's checked. */
export interface CharacterDraft {
  name: string;
  race: string;
  class: string;
  level: string;
  professions: string[];
}

export const emptyCharacter: CharacterDraft = {
  name: '',
  race: '',
  class: '',
  level: String(MAX_LEVEL),
  professions: [],
};

export function toCharacterInput(draft: CharacterDraft, faction: Faction): CharacterInput {
  return {
    name: draft.name,
    faction,
    race: draft.race as CharacterInput['race'],
    class: draft.class as CharacterInput['class'],
    level: Number(draft.level),
    professions: draft.professions as CharacterInput['professions'],
  };
}

/** A draft with a saved character's details, to edit it. */
export function toCharacterDraft(character: {
  name: string;
  race: string;
  class: string;
  level: number;
  professions: readonly string[];
}): CharacterDraft {
  return {
    name: character.name,
    race: character.race,
    class: character.class,
    level: String(character.level),
    professions: [...character.professions],
  };
}

/** The draft's problems by field ("race", "professions"…), checked with the shared schema. */
export function characterIssues(draft: CharacterDraft, faction: Faction): ValidationIssue[] {
  const input = toCharacterInput(draft, faction);
  const result = characterSchema.safeParse(input);
  return result.success ? [] : toValidationIssues(result.error, input);
}

export interface CharacterFieldsProps {
  value: CharacterDraft;
  onChange: (value: CharacterDraft) => void;
  faction: Faction;
  /** Problems to show, by field name ("name", "class"…). */
  issues: readonly ValidationIssue[];
}

/** Name, race, class, level, and professions of one character, limited to the guild's faction. */
export function CharacterFields({ value, onChange, faction, issues }: CharacterFieldsProps) {
  const { t } = useTranslation();
  const errorFor = (field: string) => {
    const issue = issues.find((candidate) => candidate.field === field);
    return issue && validationIssueMessage(t, issue);
  };
  const races = racesFor(faction);
  const race = races.find((option) => option === value.race);
  const classes = race ? classesFor(faction, race) : [];
  const update = (change: Partial<CharacterDraft>) => onChange({ ...value, ...change });

  return (
    <FormGrid>
      <TextField
        label={t('character.name')}
        value={value.name}
        onChange={(name) => update({ name })}
        error={errorFor('name')}
      />
      <Select
        label={t('character.race')}
        value={value.race}
        placeholder={t('character.choose')}
        options={races.map((option) => ({ value: option, label: RACE_NAMES[option] }))}
        // A class the new race can't be is cleared.
        onChange={(next) => {
          const allowed = races.includes(next as never)
            ? classesFor(faction, next as (typeof races)[number])
            : [];
          update({ race: next, class: allowed.includes(value.class as never) ? value.class : '' });
        }}
        error={errorFor('race')}
      />
      <Select
        label={t('character.class')}
        value={value.class}
        placeholder={race ? t('character.choose') : t('character.pickRace')}
        options={classes.map((option) => ({ value: option, label: CLASS_NAMES[option] }))}
        onChange={(next) => update({ class: next })}
        error={errorFor('class')}
        disabled={!race}
      />
      <TextField
        label={t('character.level')}
        type="number"
        value={value.level}
        onChange={(level) => update({ level })}
        error={errorFor('level')}
      />
      <FormGrid.Wide>
        <CheckboxGroup
          label={t('character.professions')}
          values={value.professions}
          options={PROFESSIONS.map((option) => ({
            value: option,
            label: PROFESSION_NAMES[option],
          }))}
          onChange={(professions) => update({ professions })}
          error={errorFor('professions')}
          hint={t('character.professionsHint', {
            secondary: SECONDARY_PROFESSIONS.map((option) => PROFESSION_NAMES[option]).join(', '),
          })}
        />
      </FormGrid.Wide>
    </FormGrid>
  );
}
