import {
  FACTIONS,
  guildNameSchema,
  GUILD_NAME_MAX_LENGTH,
  toValidationIssues,
  type Faction,
} from '@wgm/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';

import { ApiRequestError } from '../api/client';
import { useCreateGuild, useDiscordRoles, useDiscordServers } from '../api/guilds';
import { useMe } from '../api/me';
import {
  Button,
  ChoiceGroup,
  ComboBox,
  Loading,
  Notice,
  RadioList,
  TextField,
  Wizard,
} from '../components/ui';
import { apiErrorMessage, validationIssueMessage } from '../i18n/api-errors';

interface SetupState {
  step: number;
  name: string;
  faction: Faction;
  serverId: string | null;
  roleId: string | null;
}

const initialState: SetupState = {
  step: 0,
  name: '',
  faction: 'alliance',
  serverId: null,
  roleId: null,
};

// Nothing is saved on the server until the last step, so the browser keeps the values while
// the user adds the bot in another tab or reloads.
const storageKey = 'wgm.guildSetup';

function loadState(): SetupState {
  try {
    const saved = sessionStorage.getItem(storageKey);
    return saved
      ? { ...initialState, ...(JSON.parse(saved) as Partial<SetupState>) }
      : initialState;
  } catch {
    return initialState;
  }
}

function saveState(state: SetupState | null): void {
  try {
    if (state) sessionStorage.setItem(storageKey, JSON.stringify(state));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // Without storage the setup still works; it just isn't remembered.
  }
}

/** Creating a guild: its name and faction, the Discord server, and the Officer role. */
export function GuildSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useMe().data;
  const [state, setState] = useState(loadState);
  const [nameTouched, setNameTouched] = useState(false);
  const createGuild = useCreateGuild();

  useEffect(() => saveState(state), [state]);
  const update = (change: Partial<SetupState>) =>
    setState((current) => ({ ...current, ...change }));

  const servers = useDiscordServers(state.step >= 1);
  const roles = useDiscordRoles(state.step >= 2 ? state.serverId : null);

  // A user leads at most one guild.
  if (me && me.guilds.length > 0 && !createGuild.isSuccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const nameResult = guildNameSchema.safeParse(state.name);
  const nameIssue = nameResult.success
    ? undefined
    : toValidationIssues(nameResult.error, state.name)[0];
  const serverList = servers.data?.servers ?? [];
  const server = serverList.find((option) => option.id === state.serverId && option.available);
  const roleList = roles.data?.roles ?? [];
  const role = roleList.find((option) => option.id === state.roleId);

  const canContinue = [nameResult.success, server !== undefined, role !== undefined][state.step];

  const finish = () => {
    if (!nameResult.success || !server || !role) return;
    createGuild.mutate(
      {
        name: nameResult.data,
        faction: state.faction,
        discordServerId: server.id,
        officerRoleId: role.id,
      },
      {
        onSuccess: () => {
          saveState(null);
          void navigate('/dashboard', { replace: true });
        },
      },
    );
  };

  const steps = [t('setup.stepGuild'), t('setup.stepBot'), t('setup.stepRole')];

  return (
    <Wizard
      title={t('setup.title')}
      lead={t('setup.lead')}
      progress={t('setup.progress', { current: state.step + 1, total: steps.length })}
      steps={steps}
      current={state.step}
    >
      {state.step === 0 && (
        <>
          <TextField
            label={t('setup.name')}
            value={state.name}
            onChange={(name) => {
              setNameTouched(true);
              update({ name });
            }}
            maxLength={GUILD_NAME_MAX_LENGTH}
            error={nameTouched && nameIssue ? validationIssueMessage(t, nameIssue) : undefined}
            autoFocus
          />
          <ChoiceGroup
            label={t('setup.faction')}
            value={state.faction}
            onChange={(faction: Faction) => update({ faction })}
          >
            {FACTIONS.map((faction) => (
              <ChoiceGroup.Option key={faction} value={faction}>
                {t(`factions.${faction}`)}
              </ChoiceGroup.Option>
            ))}
          </ChoiceGroup>
          <Wizard.Text>{t('setup.factionHelp')}</Wizard.Text>
        </>
      )}

      {state.step === 1 && (
        <>
          <Wizard.Text>{t('setup.botHelp')}</Wizard.Text>
          {servers.isPending ? (
            <Loading label={t('setup.loadingServers')} />
          ) : servers.isError ? (
            <DiscordError error={servers.error} />
          ) : (
            <>
              <Button href={servers.data.botInviteUrl} newTab endIcon="external">
                {t('setup.addBot')}
              </Button>
              {serverList.length === 0 ? (
                <Wizard.Text>{t('setup.noServers')}</Wizard.Text>
              ) : (
                <>
                  <RadioList
                    label={t('setup.server')}
                    value={state.serverId}
                    onChange={(serverId) => update({ serverId, roleId: null })}
                  >
                    {serverList.map((option) => (
                      <RadioList.Option
                        key={option.id}
                        value={option.id}
                        imageUrl={option.iconUrl}
                        disabled={!option.available}
                        detail={option.available ? undefined : t('setup.serverTaken')}
                      >
                        {option.name}
                      </RadioList.Option>
                    ))}
                  </RadioList>
                  <Wizard.Text>{t('setup.serversHelp')}</Wizard.Text>
                </>
              )}
            </>
          )}
          <Button
            onClick={() => void servers.refetch()}
            disabled={servers.isFetching}
            endIcon="refresh"
          >
            {t('setup.reload')}
          </Button>
        </>
      )}

      {state.step === 2 && (
        <>
          {roles.isPending ? (
            <Loading label={t('setup.loadingRoles')} />
          ) : roles.isError ? (
            <DiscordError error={roles.error} />
          ) : roleList.length === 0 ? (
            <>
              <Wizard.Text>{t('setup.noRoles')}</Wizard.Text>
              <Button
                onClick={() => void roles.refetch()}
                disabled={roles.isFetching}
                endIcon="refresh"
              >
                {t('setup.reload')}
              </Button>
            </>
          ) : (
            <ComboBox
              label={t('setup.officerRole')}
              value={state.roleId ?? ''}
              options={roleList.map((option) => ({ value: option.id, label: option.name }))}
              onChange={(roleId) => update({ roleId })}
              noOptionsText={t('setup.noRoleMatch')}
            />
          )}
          <Wizard.Text>{t('setup.officerHelp')}</Wizard.Text>
          {createGuild.isError && <CreateError error={createGuild.error} />}
        </>
      )}

      <Wizard.Actions>
        {state.step < 2 ? (
          <Button
            variant="primary"
            onClick={() => update({ step: state.step + 1 })}
            disabled={!canContinue}
            endIcon="arrowRight"
          >
            {t('setup.continue')}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={finish}
            disabled={!canContinue || createGuild.isPending}
            endIcon="check"
          >
            {t('setup.finish')}
          </Button>
        )}
        {state.step > 0 && (
          <Button onClick={() => update({ step: state.step - 1 })}>{t('setup.back')}</Button>
        )}
      </Wizard.Actions>
    </Wizard>
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

function CreateError({ error }: { error: Error }) {
  const { t } = useTranslation();
  if (!(error instanceof ApiRequestError)) {
    return (
      <Notice tone="bad" title={t('setup.createFailed')}>
        {t('errors.API_UNAVAILABLE')}
      </Notice>
    );
  }
  const { error: apiError } = error;
  return (
    <Notice tone="bad" title={t('setup.createFailed')}>
      {apiError.code === 'VALIDATION_ERROR'
        ? apiError.issues.map((issue) => validationIssueMessage(t, issue)).join(' ')
        : apiErrorMessage(t, apiError)}
    </Notice>
  );
}
