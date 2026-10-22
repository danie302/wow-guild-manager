import {
  GUILD_IMAGE_MAX_BYTES,
  GUILD_IMAGE_TYPES,
  GUILD_NAME_MAX_LENGTH,
  guildNameSchema,
  REMINDER_HOURS,
  TENTATIVE_DEADLINE_HOURS,
  SUPPORTED_LOCALES,
  toValidationIssues,
  type GuildResponse,
  type Locale,
} from '@wgm/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

import { ApiRequestError } from '../api/client';
import {
  useDiscordChannels,
  useDiscordRoles,
  useDiscordServers,
  useGuild,
  useSaveGuildSettings,
  type GuildSettingsChanges,
} from '../api/guilds';
import { useGuildIdParam } from '../app/guildSelection';
import {
  Button,
  ChoiceGroup,
  ComboBox,
  ConfirmDialog,
  FormGrid,
  ImagePicker,
  Loading,
  Notice,
  Page,
  RadioList,
  SaveBar,
  TextField,
} from '../components/ui';
import { LOCALE_NAMES } from '../i18n';
import { GuildDangerZone } from './GuildDangerZone';
import { apiErrorMessage, validationIssueMessage } from '../i18n/api-errors';

/** The form's values. `image` is kept, replaced by a chosen file, or removed. */
interface Form {
  name: string;
  image: { kind: 'keep' } | { kind: 'new'; file: File; previewUrl: string } | { kind: 'remove' };
  serverId: string;
  roleId: string | null;
  /** Null until one is chosen; a new server starts without one. */
  channelId: string | null;
  discordLocale: Locale;
  /** As typed, so a half-typed number doesn't jump. */
  deadlineHours: string;
  reminderHours: string;
  goodThreshold: string;
  riskThreshold: string;
}

function formFrom(guild: GuildResponse): Form {
  return {
    name: guild.name,
    image: { kind: 'keep' },
    serverId: guild.discordServer.id,
    roleId: guild.officerRole.id,
    channelId: guild.eventsChannel?.id ?? null,
    discordLocale: guild.discordLocale,
    deadlineHours: String(guild.tentativeDeadlineHours),
    reminderHours: String(guild.reminderHours),
    goodThreshold: String(guild.attendanceThresholds.good),
    riskThreshold: String(guild.attendanceThresholds.atRisk),
  };
}

/** A whole number of hours within the range, or null. */
function hoursIn(value: string, { min, max }: { min: number; max: number }): number | null {
  const hours = Number(value);
  return /^\d+$/.test(value.trim()) && hours >= min && hours <= max ? hours : null;
}

/** The guild's settings. Changes apply only when saved, for the whole page at once. */
export function GuildSettingsPage() {
  const { t } = useTranslation();
  const guildId = useGuildIdParam()!;
  const guild = useGuild(guildId);
  // Kept out here because the form starts over after each save.
  const [justSaved, setJustSaved] = useState(false);

  if (guild.isPending) return <Loading label={t('guildSettings.loading')} />;
  if (guild.isError) return <Notice tone="bad" title={t('dashboard.loadFailed')} />;
  // A new key starts the form over from the saved values after each save.
  return (
    <GuildSettingsForm
      key={JSON.stringify(guild.data)}
      guild={guild.data}
      justSaved={justSaved}
      setJustSaved={setJustSaved}
    />
  );
}

interface GuildSettingsFormProps {
  guild: GuildResponse;
  justSaved: boolean;
  setJustSaved: (saved: boolean) => void;
}

function GuildSettingsForm({ guild, justSaved, setJustSaved }: GuildSettingsFormProps) {
  const { t } = useTranslation();
  const isGuildMaster = guild.access === 'guild_master';
  const [form, setForm] = useState(() => formFrom(guild));
  const [imageError, setImageError] = useState<string>();
  const [changingServer, setChangingServer] = useState(false);
  const save = useSaveGuildSettings(guild.id);

  const update = (change: Partial<Form>) => {
    setJustSaved(false);
    setForm((current) => ({ ...current, ...change }));
  };

  // Free the preview of a chosen file when it's replaced or the page closes.
  const previewUrl = form.image.kind === 'new' ? form.image.previewUrl : null;
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const servers = useDiscordServers(isGuildMaster && changingServer);
  const roles = useDiscordRoles(isGuildMaster ? form.serverId : null);
  const channels = useDiscordChannels(isGuildMaster ? form.serverId : null);

  const nameResult = guildNameSchema.safeParse(form.name);
  const nameIssue = nameResult.success
    ? undefined
    : toValidationIssues(nameResult.error, form.name)[0];
  const serverChanged = form.serverId !== guild.discordServer.id;
  const roleChanged = form.roleId !== guild.officerRole.id;
  const channelChanged = form.channelId !== (guild.eventsChannel?.id ?? null);
  const localeChanged = form.discordLocale !== guild.discordLocale;
  const deadlineHours = hoursIn(form.deadlineHours, TENTATIVE_DEADLINE_HOURS);
  const reminderHours = hoursIn(form.reminderHours, REMINDER_HOURS);
  const deadlineChanged = form.deadlineHours !== String(guild.tentativeDeadlineHours);
  const reminderChanged = form.reminderHours !== String(guild.reminderHours);
  const goodThreshold = hoursIn(form.goodThreshold, { min: 0, max: 100 });
  const riskThreshold = hoursIn(form.riskThreshold, { min: 0, max: 100 });
  const bandsValid =
    goodThreshold !== null && riskThreshold !== null && goodThreshold > riskThreshold;
  const bandsChanged =
    form.goodThreshold !== String(guild.attendanceThresholds.good) ||
    form.riskThreshold !== String(guild.attendanceThresholds.atRisk);

  const changes: GuildSettingsChanges = {};
  if (nameResult.success && nameResult.data !== guild.name) changes.name = nameResult.data;
  if (form.image.kind === 'new') changes.image = form.image.file;
  if (form.image.kind === 'remove') changes.image = null;
  if ((serverChanged || roleChanged) && form.roleId) {
    changes.discord = { discordServerId: form.serverId, officerRoleId: form.roleId };
  }
  // A new server without a channel leaves the guild without one.
  if (channelChanged && form.channelId) changes.eventsChannelId = form.channelId;
  if (localeChanged) changes.discordLocale = form.discordLocale;
  if (deadlineChanged && deadlineHours !== null) changes.tentativeDeadlineHours = deadlineHours;
  if (reminderChanged && reminderHours !== null) changes.reminderHours = reminderHours;
  if (bandsChanged && bandsValid) {
    changes.attendanceGoodThreshold = goodThreshold;
    changes.attendanceRiskThreshold = riskThreshold;
  }

  const dirty =
    form.name !== guild.name ||
    form.image.kind !== 'keep' ||
    serverChanged ||
    roleChanged ||
    channelChanged ||
    localeChanged ||
    deadlineChanged ||
    reminderChanged ||
    bandsChanged;
  const valid =
    nameResult.success &&
    form.roleId !== null &&
    deadlineHours !== null &&
    reminderHours !== null &&
    bandsValid;

  const blocker = useBlocker(dirty && !save.isPending);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const chooseImage = (file: File) => {
    if (!(GUILD_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setImageError(t('guildSettings.imageWrongType'));
      return;
    }
    if (file.size > GUILD_IMAGE_MAX_BYTES) {
      setImageError(t('guildSettings.imageTooLarge'));
      return;
    }
    setImageError(undefined);
    update({ image: { kind: 'new', file, previewUrl: URL.createObjectURL(file) } });
  };

  const discard = () => {
    setForm(formFrom(guild));
    setImageError(undefined);
    setChangingServer(false);
  };

  const shownImage =
    form.image.kind === 'new'
      ? form.image.previewUrl
      : form.image.kind === 'remove'
        ? null
        : guild.imageUrl;
  const serverList = (servers.data?.servers ?? []).map((server) => ({
    ...server,
    // This guild's own server shows as connected, but it's still a valid choice.
    available: server.available || server.id === guild.discordServer.id,
  }));

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('guildSettings.title')}</Page.Title>
      </Page.Header>

      <Page.Setting
        title={t('guildSettings.identity')}
        description={isGuildMaster ? t('guildSettings.identityHelp') : t('guildSettings.gmOnly')}
      >
        <TextField
          label={t('guildSettings.name')}
          value={form.name}
          onChange={(name) => update({ name })}
          maxLength={GUILD_NAME_MAX_LENGTH}
          error={nameIssue && validationIssueMessage(t, nameIssue)}
          disabled={!isGuildMaster}
        />
        <ImagePicker
          label={t('guildSettings.image')}
          imageUrl={shownImage}
          initials={guild.name.slice(0, 2).toUpperCase()}
          accept={GUILD_IMAGE_TYPES.join(',')}
          chooseLabel={t('guildSettings.chooseImage')}
          removeLabel={t('guildSettings.removeImage')}
          onChoose={chooseImage}
          onRemove={() => update({ image: guild.imageUrl ? { kind: 'remove' } : { kind: 'keep' } })}
          error={imageError}
          hint={isGuildMaster ? t('guildSettings.imageHelp') : undefined}
          disabled={!isGuildMaster}
        />
      </Page.Setting>

      <Page.Setting
        title={t('guildSettings.discord')}
        description={isGuildMaster ? t('guildSettings.discordHelp') : t('guildSettings.gmOnly')}
      >
        <TextField
          label={t('guildSettings.server')}
          value={
            serverChanged
              ? (serverList.find((server) => server.id === form.serverId)?.name ?? '')
              : (guild.discordServer.name ?? t('guildSettings.serverUnavailable'))
          }
          onChange={() => undefined}
          hint={t('guildSettings.ownerNote')}
          disabled
        />
        {isGuildMaster && !changingServer && (
          <Button onClick={() => setChangingServer(true)}>{t('guildSettings.changeServer')}</Button>
        )}
        {changingServer &&
          (servers.isPending ? (
            <Loading label={t('setup.loadingServers')} />
          ) : servers.isError ? (
            <DiscordError error={servers.error} />
          ) : (
            <>
              <RadioList
                label={t('guildSettings.server')}
                value={form.serverId}
                onChange={(serverId) => {
                  const saved = serverId === guild.discordServer.id;
                  update({
                    serverId,
                    roleId: saved ? guild.officerRole.id : null,
                    channelId: saved ? (guild.eventsChannel?.id ?? null) : null,
                  });
                }}
              >
                {serverList.map((server) => (
                  <RadioList.Option
                    key={server.id}
                    value={server.id}
                    imageUrl={server.iconUrl}
                    disabled={!server.available}
                    detail={server.available ? undefined : t('setup.serverTaken')}
                  >
                    {server.name}
                  </RadioList.Option>
                ))}
              </RadioList>
              <Button href={servers.data.botInviteUrl} newTab endIcon="external">
                {t('setup.addBot')}
              </Button>
            </>
          ))}

        {isGuildMaster && roles.isError ? (
          <DiscordError error={roles.error} />
        ) : (
          <ComboBox
            label={t('guildSettings.officerRole')}
            value={form.roleId ?? ''}
            options={
              isGuildMaster
                ? (roles.data?.roles ?? []).map((role) => ({ value: role.id, label: role.name }))
                : [{ value: guild.officerRole.id, label: guild.officerRole.name ?? '' }]
            }
            onChange={(roleId) => update({ roleId })}
            noOptionsText={t('setup.noRoleMatch')}
            hint={form.roleId === null ? t('guildSettings.chooseRole') : t('setup.officerHelp')}
            disabled={!isGuildMaster || roles.isPending}
          />
        )}

        {isGuildMaster && channels.isError ? (
          <DiscordError error={channels.error} />
        ) : (
          <ComboBox
            label={t('guildSettings.eventsChannel')}
            value={form.channelId ?? ''}
            options={
              isGuildMaster
                ? (channels.data?.channels ?? []).map((channel) => ({
                    value: channel.id,
                    label: `#${channel.name}`,
                    ...(channel.category && { group: channel.category }),
                  }))
                : guild.eventsChannel
                  ? [
                      {
                        value: guild.eventsChannel.id,
                        label: `#${guild.eventsChannel.name ?? guild.eventsChannel.id}`,
                      },
                    ]
                  : []
            }
            onChange={(channelId) => update({ channelId })}
            noOptionsText={t('guildSettings.noChannelMatch')}
            placeholder={t('guildSettings.noChannel')}
            hint={
              form.channelId === null
                ? t('guildSettings.chooseChannel')
                : t('guildSettings.eventsChannelHelp')
            }
            disabled={!isGuildMaster || channels.isPending}
          />
        )}

        <ChoiceGroup
          label={t('guildSettings.discordLanguage')}
          value={form.discordLocale}
          onChange={(discordLocale: Locale) => update({ discordLocale })}
          disabled={!isGuildMaster}
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <ChoiceGroup.Option key={locale} value={locale}>
              <span lang={locale}>{LOCALE_NAMES[locale]}</span>
            </ChoiceGroup.Option>
          ))}
        </ChoiceGroup>
        <Page.Text>{t('guildSettings.discordLanguageHelp')}</Page.Text>
      </Page.Setting>

      <Page.Setting title={t('guildSettings.signUps')} description={t('guildSettings.signUpsHelp')}>
        <FormGrid>
          <TextField
            label={t('guildSettings.tentativeDeadline')}
            type="number"
            width={90}
            value={form.deadlineHours}
            onChange={(value) => update({ deadlineHours: value })}
            unit={t('guildSettings.tentativeDeadlineUnit')}
            error={deadlineHours === null ? t('guildSettings.tentativeDeadlineRange') : undefined}
          />
          <TextField
            label={t('guildSettings.reminder')}
            type="number"
            width={90}
            value={form.reminderHours}
            onChange={(value) => update({ reminderHours: value })}
            unit={t('guildSettings.reminderUnit')}
            error={reminderHours === null ? t('guildSettings.reminderRange') : undefined}
          />
        </FormGrid>
        {deadlineHours !== null && reminderHours !== null && (
          <Page.Text>
            {t('guildSettings.tentativeExample', {
              deadline: deadlineHours,
              reminder: deadlineHours + reminderHours,
            })}
          </Page.Text>
        )}
      </Page.Setting>

      <Page.Setting title={t('guildSettings.bands')} description={t('guildSettings.bandsHelp')}>
        <FormGrid>
          <TextField
            label={t('guildSettings.bandsGood')}
            type="number"
            width={90}
            value={form.goodThreshold}
            onChange={(value) => update({ goodThreshold: value })}
            unit="%"
            disabled={!isGuildMaster}
          />
          <TextField
            label={t('guildSettings.bandsRisk')}
            type="number"
            width={90}
            value={form.riskThreshold}
            onChange={(value) => update({ riskThreshold: value })}
            unit="%"
            disabled={!isGuildMaster}
            error={bandsValid ? undefined : t('guildSettings.bandsRange')}
          />
        </FormGrid>
      </Page.Setting>

      {save.isError && <SaveError error={save.error} />}

      {/* Officers can save the sign-up settings; the rest is the Guild Master's. */}
      {(isGuildMaster || guild.access === 'officer') && (
        <SaveBar
          status={dirty ? 'dirty' : justSaved ? 'saved' : 'clean'}
          statusText={dirty ? t('guildSettings.unsaved') : t('guildSettings.saved')}
          saveLabel={t('guildSettings.save')}
          discardLabel={t('guildSettings.discard')}
          onSave={() =>
            save.mutate(changes, {
              onSuccess: () => {
                setJustSaved(true);
                setChangingServer(false);
              },
            })
          }
          onDiscard={discard}
          saveDisabled={!valid || save.isPending}
        />
      )}

      {isGuildMaster && <GuildDangerZone guild={guild} />}

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title={t('guildSettings.leaveTitle')}
        confirmLabel={t('guildSettings.leave')}
        cancelLabel={t('guildSettings.stay')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        {t('guildSettings.leaveBody')}
      </ConfirmDialog>
    </Page>
  );
}

function DiscordError({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <Notice tone="bad" title={t('setup.discordFailed')}>
      {error instanceof ApiRequestError
        ? apiErrorMessage(t, error.error)
        : t('errors.API_UNAVAILABLE')}
    </Notice>
  );
}

function SaveError({ error }: { error: Error }) {
  const { t } = useTranslation();
  if (!(error instanceof ApiRequestError)) {
    return (
      <Notice tone="bad" title={t('guildSettings.saveFailed')}>
        {t('errors.API_UNAVAILABLE')}
      </Notice>
    );
  }
  const { error: apiError } = error;
  return (
    <Notice tone="bad" title={t('guildSettings.saveFailed')}>
      {apiError.code === 'VALIDATION_ERROR'
        ? apiError.issues.map((issue) => validationIssueMessage(t, issue)).join(' ')
        : apiErrorMessage(t, apiError)}
    </Notice>
  );
}
