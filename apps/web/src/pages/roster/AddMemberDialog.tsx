import {
  BASE_RANKS,
  RANK_NAMES,
  type AddMemberResponse,
  type BaseRank,
  type Faction,
  type ValidationIssue,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiRequestError } from '../../api/client';
import { useAddMember, useDiscordMemberSearch } from '../../api/roster';
import { Button, ChoiceGroup, ComboBox, Dialog, Notice, Page } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import {
  CharacterFields,
  characterIssues,
  emptyCharacter,
  toCharacterInput,
  type CharacterDraft,
} from './CharacterFields';

export interface AddMemberDialogProps {
  guildId: string;
  faction: Faction;
  open: boolean;
  onClose: () => void;
  onAdded: (result: AddMemberResponse) => void;
}

/** Adds someone from the Discord server to the roster, with characters or none yet. */
export function AddMemberDialog({
  guildId,
  faction,
  open,
  onClose,
  onAdded,
}: AddMemberDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [rank, setRank] = useState<BaseRank>('raider');
  const [characters, setCharacters] = useState<CharacterDraft[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const search = useDiscordMemberSearch(guildId, query);
  const addMember = useAddMember(guildId);

  const reset = () => {
    setQuery('');
    setUser(null);
    setRank('raider');
    setCharacters([]);
    setSubmitted(false);
    addMember.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  // Problems from the server (e.g. a taken name) point at "characters.0.name".
  const serverIssues =
    addMember.error instanceof ApiRequestError && addMember.error.error.code === 'VALIDATION_ERROR'
      ? addMember.error.error.issues
      : [];
  const issuesFor = (index: number): ValidationIssue[] => [
    ...(submitted ? characterIssues(characters[index]!, faction) : []),
    ...serverIssues
      .filter((issue) => issue.field.startsWith(`characters.${index}.`))
      .map((issue) => ({ ...issue, field: issue.field.slice(`characters.${index}.`.length) })),
  ];
  const valid =
    user !== null && characters.every((draft) => characterIssues(draft, faction).length === 0);
  // Errors not shown on a character field: someone already on the roster, not on the server…
  const otherError =
    addMember.error && !serverIssues.some((issue) => issue.field.startsWith('characters.'))
      ? addMember.error
      : null;

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    addMember.mutate(
      {
        discordUserId: user.id,
        rank,
        characters: characters.map((draft) => toCharacterInput(draft, faction)),
      },
      {
        onSuccess: (result) => {
          reset();
          onAdded(result);
        },
      },
    );
  };

  const options = (search.data ?? []).map((option) => ({
    value: option.id,
    label: option.name,
    ...(option.onRoster && { detail: t('addMember.onRoster') }),
  }));

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('addMember.title')}
      description={t('addMember.lead')}
      actions={
        <>
          <Button variant="primary" onClick={submit} disabled={addMember.isPending}>
            {t('addMember.save')}
          </Button>
          <Button onClick={close}>{t('addMember.cancel')}</Button>
        </>
      }
    >
      <ComboBox
        label={t('addMember.discordUser')}
        value={user?.id ?? ''}
        options={
          user && !options.some((o) => o.value === user.id)
            ? [{ value: user.id, label: user.name }, ...options]
            : options
        }
        onChange={(id) => {
          const picked = search.data?.find((option) => option.id === id);
          if (picked && !picked.onRoster) setUser({ id: picked.id, name: picked.name });
        }}
        onInputChange={setQuery}
        placeholder={t('addMember.searchUser')}
        noOptionsText={query.trim().length < 2 ? t('addMember.searchUser') : t('addMember.noUsers')}
        hint={submitted && !user ? t('addMember.pickUser') : undefined}
      />
      <ChoiceGroup
        label={t('addMember.rank')}
        value={rank}
        onChange={(next: BaseRank) => setRank(next)}
      >
        {BASE_RANKS.map((option) => (
          <ChoiceGroup.Option key={option} value={option}>
            {RANK_NAMES[option]}
          </ChoiceGroup.Option>
        ))}
      </ChoiceGroup>
      <Page.Section title={t('addMember.characters')}>
        <Page.Text>{t('addMember.factionHint', { faction: t(`factions.${faction}`) })}</Page.Text>
        {characters.map((draft, index) => (
          <Page.Section key={index} title={t('addMember.character', { number: index + 1 })}>
            <CharacterFields
              value={draft}
              faction={faction}
              issues={issuesFor(index)}
              onChange={(next) =>
                setCharacters((current) => current.map((c, i) => (i === index ? next : c)))
              }
            />
            <Button
              onClick={() => setCharacters((current) => current.filter((_, i) => i !== index))}
            >
              {t('addMember.removeCharacter')}
            </Button>
          </Page.Section>
        ))}
        {characters.length === 0 && <Page.Text>{t('addMember.noCharacters')}</Page.Text>}
        <Button onClick={() => setCharacters((current) => [...current, emptyCharacter])}>
          {characters.length === 0 ? t('member.addCharacter') : t('addMember.addCharacter')}
        </Button>
      </Page.Section>
      {otherError && (
        <Notice tone="bad" title={t('addMember.failed')}>
          {apiErrorText(t, otherError)}
        </Notice>
      )}
    </Dialog>
  );
}
