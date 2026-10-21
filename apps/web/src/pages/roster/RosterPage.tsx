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

import { useGuild } from '../../api/guilds';
import { useRoster } from '../../api/roster';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import {
  Button,
  CharacterName,
  Checkbox,
  ChoiceGroup,
  ListTable,
  Loading,
  Notice,
  Page,
  Select,
  Tag,
  TextField,
} from '../../components/ui';
import { useFormat } from '../../i18n/format';
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
  const guild = useGuild(guildId);
  const roster = useRoster(guildId);
  const [query, setQuery] = useState('');
  const [rank, setRank] = useState('all');
  const [characterClass, setCharacterClass] = useState('');
  const [leftOnly, setLeftOnly] = useState(false);
  const format = useFormat();
  const [adding, setAdding] = useState(false);
  const [lastAdded, setLastAdded] = useState<AddMemberResponse>();

  if (roster.isPending || guild.isPending) return <Loading label={t('roster.loading')} />;
  if (roster.isError || guild.isError) return <Notice tone="bad" title={t('roster.loadFailed')} />;

  const members = roster.data.filter((member) =>
    matches(member, { query, rank, characterClass, leftOnly }),
  );

  return (
    <Page>
      <Page.Header>
        <div>
          <Page.Text>{t('roster.count', { count: roster.data.length })}</Page.Text>
          <Page.Title>{t('roster.title')}</Page.Title>
        </div>
        <TextField
          label={t('roster.search')}
          hideLabel
          type="search"
          placeholder={t('roster.search')}
          value={query}
          onChange={setQuery}
        />
        <Button variant="primary" onClick={() => setAdding(true)}>
          {t('roster.addMember')}
        </Button>
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

      <Page.Section title={t('roster.rankFilter')}>
        <ChoiceGroup label={t('roster.rankFilter')} hideLabel value={rank} onChange={setRank}>
          <ChoiceGroup.Option value="all">{t('roster.allRanks')}</ChoiceGroup.Option>
          {RANKS.map((option) => (
            <ChoiceGroup.Option key={option} value={option}>
              {RANK_NAMES[option]}
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
        <Select
          label={t('roster.classFilter')}
          hideLabel
          value={characterClass}
          placeholder={t('roster.allClasses')}
          options={CLASSES.map((option) => ({ value: option, label: CLASS_NAMES[option] }))}
          onChange={setCharacterClass}
        />
        <Checkbox label={t('roster.leftOnly')} checked={leftOnly} onChange={setLeftOnly} />
      </Page.Section>

      <ListTable
        label={t('roster.title')}
        columns={[
          t('roster.discord'),
          t('roster.rank'),
          t('roster.characters'),
          t('roster.professions'),
        ]}
        widths={['1.3fr', '0.8fr', '1.6fr', '1.3fr']}
        empty={t('roster.empty')}
      >
        {members.map((member) => {
          const [main, ...alts] = member.characters;
          return (
            <ListTable.Row key={member.id} to={guildPath(guildId, `roster/${member.id}`)}>
              <div>
                <strong>{member.discordName}</strong>{' '}
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
                  {alts.length > 0 && t('roster.alts', { count: alts.length })}
                  <Page.Text>
                    {RACE_NAMES[main.race]} {CLASS_NAMES[main.class]} · {main.level}
                  </Page.Text>
                </div>
              ) : (
                <Page.Text>{t('roster.noCharacters')}</Page.Text>
              )}
              <Page.Text>
                {main?.professions.map((profession) => PROFESSION_NAMES[profession]).join(', ')}
              </Page.Text>
            </ListTable.Row>
          );
        })}
      </ListTable>

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
    </Page>
  );
}
