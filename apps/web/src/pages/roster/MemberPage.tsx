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
  Card,
  CharacterName,
  ConfirmDialog,
  Dialog,
  Loading,
  MarkerList,
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
  const historyBy = (entry: RankHistoryEntry) =>
    entry.changedBy
      ? t('member.by', { name: entry.changedBy })
      : entry.source === 'discord'
        ? t('member.fromDiscord')
        : t('member.unknownUser');

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

  const joined = member.rankHistory.at(-1)?.at;

  return (
    <Page>
      <Page.Header back={{ to: guildPath(guildId, 'roster'), label: t('member.back') }}>
        <div>
          <Page.Title>{member.discordName}</Page.Title>
          <Page.Text>
            {RANK_NAMES[member.rank]}
            {joined &&
              ` · ${t('member.joinedOn', { date: format.parts(new Date(joined), { day: 'numeric', month: 'long', year: 'numeric' }) })}`}
          </Page.Text>
        </div>
        <Page.Actions>
          <Page.Field label={t('member.rank')}>
            {isGuildMaster || isOfficer ? (
              <>
                <strong>{RANK_NAMES[member.rank]}</strong>
                {rankNote && <Page.Muted>{rankNote}</Page.Muted>}
              </>
            ) : null}
            {canActOn && !isOfficer && (
              <Select
                label={t('member.rank')}
                hideLabel
                value={member.baseRank}
                options={BASE_RANKS.map((rank) => ({ value: rank, label: RANK_NAMES[rank] }))}
                onChange={(rank) => changeRank.mutate(rank as BaseRank)}
                disabled={changeRank.isPending}
              />
            )}
            {!canActOn && !isGuildMaster && !isOfficer && rankNote && (
              <Page.Muted>{rankNote}</Page.Muted>
            )}
          </Page.Field>
          <Page.Field label={'\u00a0'}>
            <Button
              size="medium"
              tone="danger"
              onClick={() => setConfirmRemove(true)}
              disabled={removeReason !== undefined}
            >
              {t('member.remove')}
            </Button>
            {removeReason && <Page.Muted>{removeReason}</Page.Muted>}
          </Page.Field>
        </Page.Actions>
      </Page.Header>

      {member.leftDiscordAt && (
        <Notice
          tone="bad"
          title={t('member.leftDiscord', {
            date: format.date(new Date(member.leftDiscordAt)),
          })}
        >
          {t('member.leftDiscordBody')}
        </Notice>
      )}

      {failed && (
        <Notice tone="bad" title={t('member.actionFailed')}>
          {apiErrorText(t, failed)}
        </Notice>
      )}

      <Page.Columns>
        <div>
          <Page.Block title={t('member.characters')}>
            {member.characters.length === 0 && <Page.Text>{t('member.noCharacters')}</Page.Text>}
            {member.characters.map((character) => (
              <Card key={character.id} label={character.name}>
                <Card.Column>
                  <span>
                    <CharacterName
                      name={character.name}
                      characterClass={character.class}
                      size="large"
                    />{' '}
                    {character.isMain && <Tag tone="accent">{t('member.main')}</Tag>}
                  </span>
                  <Page.Muted>
                    {CLASS_NAMES[character.class]} · {RACE_NAMES[character.race]} ·{' '}
                    {t('member.level', { level: character.level })}
                  </Page.Muted>
                </Card.Column>
                <Card.Column>
                  <Page.Muted>
                    {character.professions.map((p) => PROFESSION_NAMES[p]).join(', ') ||
                      t('member.noProfessions')}
                  </Page.Muted>
                  <Page.Inline>
                    {!character.isMain && (
                      <Button
                        variant="text"
                        onClick={() => setMain.mutate(character.id)}
                        disabled={setMain.isPending}
                      >
                        {t('member.makeMain')}
                      </Button>
                    )}
                    <Button
                      variant="text"
                      onClick={() => openForm(character.id, toCharacterDraft(character))}
                    >
                      {t('member.editCharacter')}
                    </Button>
                    <Button
                      variant="text"
                      onClick={() => setRemovingCharacter(character)}
                      disabled={removeCharacter.isPending}
                    >
                      {t('member.removeCharacter')}
                    </Button>
                  </Page.Inline>
                </Card.Column>
              </Card>
            ))}
            <span>
              <Button startIcon="plus" onClick={() => openForm(null, emptyCharacter)}>
                {t('member.addCharacter')}
              </Button>
            </span>
          </Page.Block>

          <Page.Block title={t('member.history')}>
            {isOfficer && canActOn && (
              <>
                <Select
                  label={t('member.baseRank')}
                  value={member.baseRank}
                  options={BASE_RANKS.map((rank) => ({ value: rank, label: RANK_NAMES[rank] }))}
                  onChange={(rank) => changeRank.mutate(rank as BaseRank)}
                  disabled={changeRank.isPending}
                />
                <Page.Muted>{t('member.baseRankHint')}</Page.Muted>
              </>
            )}
            <MarkerList
              label={t('member.history')}
              items={member.rankHistory.map((entry, index) => ({
                key: entry.id,
                label: RANK_NAMES[entry.toRank],
                detail: `${format.parts(new Date(entry.at), { day: 'numeric', month: 'long', year: 'numeric' })} · ${historyBy(entry)}`,
                highlight: index === 0,
              }))}
            />
          </Page.Block>

          <Page.Block title={t('member.notes')} description={t('member.notesPrivate')}>
            {member.officerNotes.map((entry) => (
              <Card key={entry.id}>
                <Card.Column>
                  <Page.Muted>
                    <strong>{entry.author ?? t('member.unknownUser')}</strong> ·{' '}
                    {format.dateTime(new Date(entry.at))}
                  </Page.Muted>
                  <span>{entry.text}</span>
                </Card.Column>
              </Card>
            ))}
            <TextField
              label={t('member.addNote')}
              hideLabel
              multiline
              wide
              placeholder={t('member.notePlaceholder')}
              value={note}
              onChange={setNote}
            />
            <span>
              <Button
                variant="primary"
                size="medium"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate(note, { onSuccess: () => setNote('') })}
              >
                {t('member.addNote')}
              </Button>
            </span>
          </Page.Block>
        </div>
      </Page.Columns>

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
