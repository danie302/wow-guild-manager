import {
  CLASS_NAMES,
  COMBAT_ROLE_NAMES,
  RACE_NAMES,
  rolesFor,
  type CharacterClass,
  type CombatRole,
  type Race,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRoster } from '../../api/roster';
import {
  ActionList,
  Button,
  ChoiceGroup,
  ComboBox,
  FormRow,
  Notice,
  Page,
  Select,
  Tag,
} from '../../components/ui';

/** A pre-confirmed participant, with what the list shows about them. */
export interface PreConfirmed {
  characterId: string;
  role: CombatRole;
  memberId: string;
  name: string;
  class: CharacterClass;
  race: Race;
}

/** Ranks that can join raids (see "Who can join events" in requirements.md). */
const RAID_RANKS = ['guild_master', 'officer', 'raider'];

/**
 * The Guild Master pre-confirms participants of a new one-time raid: a member, one of their
 * characters, and a role it can fill, within each role's slots. They start as Confirmed.
 */
export function PreConfirmSection({
  guildId,
  slots,
  value,
  onChange,
  error,
}: {
  guildId: string;
  slots: Record<CombatRole, number>;
  value: PreConfirmed[];
  onChange: (value: PreConfirmed[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const roster = useRoster(guildId);
  const [memberId, setMemberId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [role, setRole] = useState<CombatRole | ''>('');

  const taken = new Set(value.map((entry) => entry.memberId));
  const members = (roster.data ?? []).filter(
    (member) =>
      RAID_RANKS.includes(member.rank) &&
      !member.leftDiscordAt &&
      member.characters.length > 0 &&
      !taken.has(member.id),
  );
  const member = members.find((candidate) => candidate.id === memberId);
  const character = member?.characters.find((candidate) => candidate.id === characterId);
  const full = (candidate: CombatRole) =>
    value.filter((entry) => entry.role === candidate).length >= slots[candidate];
  const roles = character ? rolesFor(character.class).filter((r) => slots[r] > 0) : [];

  const chooseMember = (id: string) => {
    const next = members.find((candidate) => candidate.id === id);
    const main = next?.characters[0];
    setMemberId(id);
    setCharacterId(main?.id ?? '');
    setRole(main && rolesFor(main.class).length === 1 ? rolesFor(main.class)[0]! : '');
  };
  const add = () => {
    if (!member || !character || !role) return;
    onChange([
      ...value,
      {
        characterId: character.id,
        role,
        memberId: member.id,
        name: character.name,
        class: character.class,
        race: character.race,
      },
    ]);
    setMemberId('');
    setCharacterId('');
    setRole('');
  };

  return (
    <Page.Block title={t('eventForm.preConfirmed')} description={t('eventForm.preConfirmedHelp')}>
      <FormRow>
        <ComboBox
          variant="field"
          label={t('eventForm.preConfirmedMember')}
          value={memberId}
          options={members.map((candidate) => ({
            value: candidate.id,
            label: candidate.discordName,
            detail: candidate.characters[0]?.name,
          }))}
          onChange={chooseMember}
          noOptionsText={t('eventForm.preConfirmedNoMember')}
          disabled={roster.isPending}
        />
        {member && (
          <Select
            label={t('eventForm.preConfirmedCharacter')}
            value={characterId}
            options={member.characters.map((candidate) => ({
              value: candidate.id,
              label: `${candidate.name} · ${CLASS_NAMES[candidate.class]}`,
            }))}
            onChange={(id) => {
              setCharacterId(id);
              setRole('');
            }}
          />
        )}
        {character && roles.length > 0 && (
          <FormRow.Fit>
            <ChoiceGroup
              label={t('eventForm.preConfirmedRole')}
              // No role picked yet shows none selected.
              value={role as CombatRole}
              onChange={(next: CombatRole) => setRole(next)}
            >
              {roles.map((candidate) => (
                <ChoiceGroup.Option key={candidate} value={candidate}>
                  {COMBAT_ROLE_NAMES[candidate]}
                </ChoiceGroup.Option>
              ))}
            </ChoiceGroup>
          </FormRow.Fit>
        )}
        <FormRow.Fit>
          <Button variant="primary" size="medium" onClick={add} disabled={!role || full(role)}>
            {t('eventForm.preConfirmedAdd')}
          </Button>
        </FormRow.Fit>
      </FormRow>
      {role && full(role) && (
        <Page.Text>
          {t('eventForm.preConfirmedRoleFull', { role: COMBAT_ROLE_NAMES[role] })}
        </Page.Text>
      )}
      {error && <Notice tone="bad" title={error} />}
      {value.length > 0 && (
        <ActionList label={t('eventForm.preConfirmed')}>
          {value.map((entry) => (
            <ActionList.Item
              key={entry.characterId}
              title={entry.name}
              detail={`${CLASS_NAMES[entry.class]} · ${RACE_NAMES[entry.race]}`}
              actions={
                <Button
                  variant="text"
                  tone="danger"
                  onClick={() => onChange(value.filter((other) => other !== entry))}
                >
                  {t('eventPage.remove')}
                </Button>
              }
            >
              <Tag>{COMBAT_ROLE_NAMES[entry.role]}</Tag>{' '}
              <Tag tone="ok">{t('eventPage.status.confirmed')}</Tag>
            </ActionList.Item>
          ))}
        </ActionList>
      )}
    </Page.Block>
  );
}
