import {
  BASE_RANKS,
  CLASS_NAMES,
  PROFESSION_NAMES,
  RACE_NAMES,
  RANK_NAMES,
  type BaseRank,
  type GuildAccess,
  type MemberDetailResponse,
  type RankHistoryEntry,
  type RosterCharacter,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useGuild } from '../../api/guilds';
import {
  useAddCharacter,
  useAddOfficerNote,
  useChangeRank,
  useMember,
  useRemoveCharacter,
  useRemoveMember,
  useSetMainCharacter,
  useUpdateCharacter,
} from '../../api/roster';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  Button,
  CharacterName,
  ConfirmDialog,
  DetailList,
  Dialog,
  Loading,
  Notice,
  Page,
  Select,
  Tag,
  TextField,
} from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';
import {
  CharacterFields,
  characterIssues,
  emptyCharacter,
  toCharacterDraft,
  toCharacterInput,
  type CharacterDraft,
} from './CharacterFields';

/** One member: characters, rank, rank history, and officer notes. */
export function MemberPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const memberId = useParams().memberId!;
  const guild = useGuild(guildId);
  const member = useMember(guildId, memberId);

  if (member.isPending || guild.isPending) return <Loading label={t('member.loading')} />;
  if (member.error instanceof ApiRequestError && member.error.status === 404) {
    return <Notice tone="warn" title={t('member.notFound')} />;
  }
  if (member.isError || guild.isError) return <Notice tone="bad" title={t('roster.loadFailed')} />;

  return (
    <MemberDetail
      guildId={guildId}
      faction={guild.data.faction}
      access={guild.data.access}
      member={member.data}
    />
  );
}

interface MemberDetailProps {
  guildId: string;
  faction: 'alliance' | 'horde';
  access: GuildAccess;
  member: MemberDetailResponse;
}

function MemberDetail({ guildId, faction, access, member }: MemberDetailProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const changeRank = useChangeRank(guildId, member.id);
  const setMain = useSetMainCharacter(guildId, member.id);
  const addNote = useAddOfficerNote(guildId, member.id);
  const addCharacter = useAddCharacter(guildId, member.id);
  const updateCharacter = useUpdateCharacter(guildId, member.id);
  const removeCharacter = useRemoveCharacter(guildId, member.id);
  const removeMember = useRemoveMember(guildId, member.id);
  const [note, setNote] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  // The character being added (id null) or edited.
  const [form, setForm] = useState<{ id: string | null; draft: CharacterDraft } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [removingCharacter, setRemovingCharacter] = useState<RosterCharacter | null>(null);
  const saveCharacter = form?.id ? updateCharacter : addCharacter;

  // Officers can change the rank of, or remove, only Raiders and Members.
  const isGuildMaster = member.rank === 'guild_master';
  const isOfficer = member.rank === 'officer';
  const canActOn = !isGuildMaster && (access === 'guild_master' || !isOfficer);
  const rankNote = isGuildMaster
    ? t('member.rankGuildMaster')
    : !canActOn
      ? t('member.rankOfficerOnly')
      : isOfficer
        ? t('member.rankFromDiscord')
        : undefined;
  const removeReason = isGuildMaster
    ? t('member.cannotRemoveGm')
    : !canActOn
      ? t('member.cannotRemoveOfficer')
      : undefined;

  const failed = [changeRank, setMain, addNote, removeMember, removeCharacter].find(
    (action) => action.error,
  )?.error;
  const historyText = (entry: RankHistoryEntry) =>
    entry.fromRank
      ? t('member.changed', { from: RANK_NAMES[entry.fromRank], to: RANK_NAMES[entry.toRank] })
      : t('member.joined', { rank: RANK_NAMES[entry.toRank] });
  const historyBy = (entry: RankHistoryEntry) =>
    entry.changedBy ??
    (entry.source === 'discord' ? t('member.fromDiscord') : t('member.unknownUser'));

  const characterError =
    saveCharacter.error instanceof ApiRequestError &&
    saveCharacter.error.error.code === 'VALIDATION_ERROR'
      ? saveCharacter.error.error.issues
      : [];
  const openForm = (id: string | null, draft: CharacterDraft) => {
    setSubmitted(false);
    addCharacter.reset();
    updateCharacter.reset();
    setForm({ id, draft });
  };
  const submitForm = () => {
    setSubmitted(true);
    if (!form || characterIssues(form.draft, faction).length > 0) return;
    const character = toCharacterInput(form.draft, faction);
    const done = { onSuccess: () => setForm(null) };
    if (form.id) updateCharacter.mutate({ id: form.id, character }, done);
    else addCharacter.mutate(character, done);
  };

  return (
    <Page>
      <Page.Header>
        <div>
          <Button to={guildPath(guildId, 'roster')}>{t('member.back')}</Button>
          <Page.Title>{member.discordName}</Page.Title>
          <Page.Text>{RANK_NAMES[member.rank]}</Page.Text>
        </div>
        <div>
          {canActOn ? (
            <Select
              label={t('member.rank')}
              value={member.baseRank}
              options={BASE_RANKS.map((rank) => ({ value: rank, label: RANK_NAMES[rank] }))}
              onChange={(rank) => changeRank.mutate(rank as BaseRank)}
              disabled={changeRank.isPending}
            />
          ) : null}
          {rankNote && <Page.Text>{rankNote}</Page.Text>}
        </div>
        <div>
          <Button onClick={() => setConfirmRemove(true)} disabled={removeReason !== undefined}>
            {t('member.remove')}
          </Button>
          {removeReason && <Page.Text>{removeReason}</Page.Text>}
        </div>
      </Page.Header>

      {failed && (
        <Notice tone="bad" title={t('member.actionFailed')}>
          {apiErrorText(t, failed)}
        </Notice>
      )}

      <Page.Section title={t('member.characters')}>
        <DetailList>
          {member.characters.map((character) => (
            <DetailList.Item
              key={character.id}
              label={character.isMain ? t('member.main') : t('member.alt')}
            >
              <CharacterName name={character.name} characterClass={character.class} />{' '}
              {character.isMain && <Tag tone="accent">{t('member.main')}</Tag>}
              <Page.Text>
                {RACE_NAMES[character.race]} {CLASS_NAMES[character.class]} · {character.level}
                {character.professions.length > 0 &&
                  ` · ${character.professions.map((p) => PROFESSION_NAMES[p]).join(', ')}`}
              </Page.Text>
              {!character.isMain && (
                <Button onClick={() => setMain.mutate(character.id)} disabled={setMain.isPending}>
                  {t('member.makeMain')}
                </Button>
              )}{' '}
              <Button onClick={() => openForm(character.id, toCharacterDraft(character))}>
                {t('member.editCharacter')}
              </Button>{' '}
              <Button
                onClick={() => setRemovingCharacter(character)}
                disabled={removeCharacter.isPending}
              >
                {t('member.removeCharacter')}
              </Button>
            </DetailList.Item>
          ))}
        </DetailList>
        <Button onClick={() => openForm(null, emptyCharacter)}>{t('member.addCharacter')}</Button>
      </Page.Section>

      <Page.Section title={t('member.history')}>
        <DetailList>
          {member.rankHistory.map((entry) => (
            <DetailList.Item
              key={entry.id}
              label={`${format.dateTime(new Date(entry.at))} · ${historyBy(entry)}`}
            >
              {historyText(entry)}
            </DetailList.Item>
          ))}
        </DetailList>
      </Page.Section>

      <Page.Section title={t('member.notes')}>
        <Page.Text>{t('member.notesPrivate')}</Page.Text>
        {member.officerNotes.length === 0 ? (
          <Page.Text>{t('member.noNotes')}</Page.Text>
        ) : (
          <DetailList>
            {member.officerNotes.map((entry) => (
              <DetailList.Item
                key={entry.id}
                label={`${entry.author ?? t('member.unknownUser')} · ${format.dateTime(new Date(entry.at))}`}
              >
                {entry.text}
              </DetailList.Item>
            ))}
          </DetailList>
        )}
        <TextField
          label={t('member.addNote')}
          hideLabel
          multiline
          placeholder={t('member.notePlaceholder')}
          value={note}
          onChange={setNote}
        />
        <Button
          variant="primary"
          disabled={!note.trim() || addNote.isPending}
          onClick={() => addNote.mutate(note, { onSuccess: () => setNote('') })}
        >
          {t('member.addNote')}
        </Button>
      </Page.Section>

      <ConfirmDialog
        open={confirmRemove}
        title={t('member.removeTitle', { name: member.discordName })}
        confirmLabel={t('member.remove')}
        cancelLabel={t('member.keep')}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() =>
          removeMember.mutate(undefined, {
            onSuccess: () => void navigate(guildPath(guildId, 'roster')),
            onSettled: () => setConfirmRemove(false),
          })
        }
      >
        {t('member.removeBody')}
      </ConfirmDialog>

      <ConfirmDialog
        open={removingCharacter !== null}
        title={t('member.removeCharacterTitle', { name: removingCharacter?.name })}
        confirmLabel={t('member.removeCharacter')}
        cancelLabel={t('member.keep')}
        onCancel={() => setRemovingCharacter(null)}
        onConfirm={() => {
          removeCharacter.mutate(removingCharacter!.id);
          setRemovingCharacter(null);
        }}
      >
        {removingCharacter?.isMain ? t('member.removeMainBody') : t('member.removeCharacterBody')}
      </ConfirmDialog>

      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          form?.id
            ? t('member.editCharacterTitle', {
                name: member.characters.find((character) => character.id === form.id)?.name,
              })
            : t('member.addCharacterTitle', { name: member.discordName })
        }
        actions={
          <>
            <Button variant="primary" disabled={saveCharacter.isPending} onClick={submitForm}>
              {form?.id ? t('member.saveCharacter') : t('member.addCharacter')}
            </Button>
            <Button onClick={() => setForm(null)}>{t('addMember.cancel')}</Button>
          </>
        }
      >
        {form && (
          <CharacterFields
            value={form.draft}
            onChange={(draft) => setForm({ ...form, draft })}
            faction={faction}
            issues={[...(submitted ? characterIssues(form.draft, faction) : []), ...characterError]}
          />
        )}
        {saveCharacter.error && characterError.length === 0 && (
          <Notice tone="bad" title={t('member.actionFailed')}>
            {apiErrorText(t, saveCharacter.error)}
          </Notice>
        )}
      </Dialog>
    </Page>
  );
}
