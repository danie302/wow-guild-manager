import {
  CLASS_NAMES,
  CLASSES,
  PROFESSION_NAMES,
  RACE_NAMES,
  RANK_NAMES,
  RANKS,
  type AddMemberResponse,
  type RosterMember,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe } from '../../api/me';
import { useRoster } from '../../api/roster';
import { useGuild } from '../../api/guilds';
import { guildPath, useGuildAccess, useGuildIdParam } from '../../app/guildSelection';
import {
  Button,
  CharacterName,
  Checkbox,
  FilterChips,
  ListTable,
  Loading,
  Notice,
  Page,
  Tag,
  TextField,
  RateBar,
} from '../../components/ui';
import { useFormat } from '../../i18n/format';
import { BAND_COLOR, rateText } from '../attendanceText';
import { AddMemberDialog } from './AddMemberDialog';

/** Lowercase without accents, so searching "jaina" finds "Jainá". */
function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

interface Filters {
  query: string;
  rank: string;
  characterClass: string;
  leftOnly: boolean;
}

function matches(member: RosterMember, { query, rank, characterClass, leftOnly }: Filters) {
  if (rank !== 'all' && member.rank !== rank) return false;
  if (leftOnly && !member.leftDiscordAt) return false;
  if (characterClass && !member.characters.some((c) => c.class === characterClass)) return false;
  const words = searchable(query).trim();
  return (
    !words ||
    [member.discordName, ...member.characters.map((c) => c.name)].some((name) =>
      searchable(name).includes(words),
    )
  );
}

/** The guild's members, searchable by name and filtered by rank and class. */
export function RosterPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const roster = useRoster(guildId);
  // Read-only members see the roster, but only open their own page, and can't add anyone.
  const readOnly = useGuildAccess() === 'member';
  // The guild's faction, for adding members; members can't read the guild's settings.
  const guild = useGuild(guildId, !readOnly);
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState('all');
  const [characterClass, setCharacterClass] = useState('');
  const [leftOnly, setLeftOnly] = useState(false);
  const format = useFormat();
  const me = useMe();
  const [adding, setAdding] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddMemberResponse>();

  if (roster.isPending) return <Loading label={t('roster.loading')} />;
  if (roster.isError) return <Notice tone="bad" title={t('roster.loadFailed')} />;

  const members = roster.data.filter((member) =>
    matches(member, { query, rank, characterClass, leftOnly }),
  );

  const classOptions = [
    { value: '', label: t('roster.allClasses') },
    ...CLASSES.map((option) => ({
      value: option,
      label: CLASS_NAMES[option],
      dot: `c-${option}` as const,
    })),
  ];

  return (
    <Page>
      <Page.Header>
        <div>
          <Page.Text>{t('roster.count', { count: roster.data.length })}</Page.Text>
          <Page.Title>{t('roster.title')}</Page.Title>
        </div>
        <Page.Actions>
          <TextField
            label={t('roster.search')}
            hideLabel
            type="search"
            width={300}
            placeholder={t('roster.search')}
            value={query}
            onChange={setQuery}
          />
          {!readOnly && (
            <Button
              variant="primary"
              size="medium"
              startIcon="plus"
              onClick={() => setAdding(true)}
            >
              {t('roster.addMember')}
            </Button>
          )}
        </Page.Actions>
      </Page.Header>

      {lastAdded && (
        <Notice
          tone={lastAdded.unrestoredCharacters.length > 0 ? 'warn' : 'ok'}
          title={t(lastAdded.restored ? 'addMember.restored' : 'addMember.added', {
            name: lastAdded.member.discordName,
          })}
        >
          {lastAdded.unrestoredCharacters.length > 0 &&
            t('addMember.unrestored', { names: lastAdded.unrestoredCharacters.join(', ') })}
        </Notice>
      )}

      <Page.Filters>
        <div>
          <FilterChips
            label={t('roster.rankFilter')}
            value={rank}
            onChange={setRank}
            options={[
              { value: 'all', label: t('roster.allRanks') },
              ...RANKS.map((option) => ({ value: option, label: RANK_NAMES[option] })),
            ]}
          />
        </div>
        <div>
          <FilterChips
            label={t('roster.classFilter')}
            value={characterClass}
            onChange={setCharacterClass}
            options={classOptions}
          />
          {!readOnly && (
            <Checkbox label={t('roster.leftOnly')} checked={leftOnly} onChange={setLeftOnly} />
          )}
        </div>
      </Page.Filters>

      <ListTable
        label={t('roster.title')}
        columns={[
          t('roster.discord'),
          t('roster.rank'),
          t('roster.characters'),
          t('roster.professions'),
          t('roster.attendance'),
        ]}
        widths={['1.3fr', '0.8fr', '1.6fr', '1.3fr', '1fr']}
        empty={t('roster.empty')}
      >
        {members.map((member) => {
          const [main, ...alts] = member.characters;
          return (
            <ListTable.Row
              key={member.id}
              to={
                !readOnly || member.discordUserId === me.data?.discordId
                  ? guildPath(guildId, `roster/${member.id}`)
                  : undefined
              }
            >
              <div>
                <strong>{member.discordName}</strong>{' '}
                {member.discordUserId === me.data?.discordId && (
                  <Tag tone="accent">{t('roster.you')}</Tag>
                )}{' '}
                {member.leftDiscordAt && (
                  <Tag tone="bad">
                    {t('roster.leftDiscord', {
                      date: format.date(new Date(member.leftDiscordAt)),
                    })}
                  </Tag>
                )}
              </div>
              <span>{RANK_NAMES[member.rank]}</span>
              {main ? (
                <div>
                  <CharacterName name={main.name} characterClass={main.class} />{' '}
                  {alts.length > 0 && (
                    <Page.Muted>{t('roster.alts', { count: alts.length })}</Page.Muted>
                  )}
                  <Page.Text>
                    {CLASS_NAMES[main.class]} · {RACE_NAMES[main.race]} · {main.level}
                  </Page.Text>
                </div>
              ) : (
                <Page.Text>{t('roster.noCharacters')}</Page.Text>
              )}
              <Page.Text>
                {main?.professions.map((profession) => PROFESSION_NAMES[profession]).join(', ')}
              </Page.Text>
              <RateBar
                value={member.attendanceRate}
                label={rateText(format, member.attendanceRate)}
                color={member.attendanceBand ? BAND_COLOR[member.attendanceBand] : 'mt'}
              />
            </ListTable.Row>
          );
        })}
      </ListTable>

      {guild.data && (
        <AddMemberDialog
          guildId={guildId}
          faction={guild.data.faction}
          open={adding}
          onClose={() => setAdding(false)}
          onAdded={(result) => {
            setAdding(false);
            setLastAdded(result);
          }}
        />
      )}
    </Page>
  );
}
