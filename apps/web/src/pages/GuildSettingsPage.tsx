import {
  GUILD_IMAGE_MAX_BYTES,
  GUILD_IMAGE_TYPES,
  GUILD_NAME_MAX_LENGTH,
  guildNameSchema,
  toValidationIssues,
  type GuildResponse,
} from '@wgm/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

import { ApiRequestError } from '../api/client';
import {
  useDiscordRoles,
  useDiscordServers,
  useGuild,
  useSaveGuildSettings,
  type GuildSettingsChanges,
} from '../api/guilds';
import { useGuildIdParam } from '../app/guildSelection';
import {
  Button,
  ComboBox,
  ConfirmDialog,
  ImagePicker,
  Loading,
  Notice,
  Page,
  RadioList,
  SaveBar,
  TextField,
} from '../components/ui';
import { apiErrorMessage, validationIssueMessage } from '../i18n/api-errors';

/** The form's values. `image` is kept, replaced by a chosen file, or removed. */
interface Form {
  name: string;
  image: { kind: 'keep' } | { kind: 'new'; file: File; previewUrl: string } | { kind: 'remove' };
  serverId: string;
  roleId: string | null;
}

function formFrom(guild: GuildResponse): Form {
  return {
    name: guild.name,
    image: { kind: 'keep' },
    serverId: guild.discordServer.id,
    roleId: guild.officerRole.id,
  };
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

  const nameResult = guildNameSchema.safeParse(form.name);
  const nameIssue = nameResult.success
    ? undefined
    : toValidationIssues(nameResult.error, form.name)[0];
  const serverChanged = form.serverId !== guild.discordServer.id;
  const roleChanged = form.roleId !== guild.officerRole.id;

  const changes: GuildSettingsChanges = {};
  if (nameResult.success && nameResult.data !== guild.name) changes.name = nameResult.data;
  if (form.image.kind === 'new') changes.image = form.image.file;
  if (form.image.kind === 'remove') changes.image = null;
  if ((serverChanged || roleChanged) && form.roleId) {
    changes.discord = { discordServerId: form.serverId, officerRoleId: form.roleId };
  }

  const dirty =
    form.name !== guild.name || form.image.kind !== 'keep' || serverChanged || roleChanged;
  const valid = nameResult.success && form.roleId !== null;

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
                onChange={(serverId) =>
                  update({
                    serverId,
                    roleId: serverId === guild.discordServer.id ? guild.officerRole.id : null,
                  })
                }
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
      </Page.Setting>

      {save.isError && <SaveError error={save.error} />}

      {isGuildMaster && (
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
