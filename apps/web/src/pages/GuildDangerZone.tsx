import type { GuildResponse } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useDisbandGuild, useTransferCandidates, useTransferLeadership } from '../api/guilds';
import {
  Button,
  ConfirmDialog,
  DangerZone,
  Dialog,
  Notice,
  Select,
  TextField,
} from '../components/ui';
import { apiErrorText } from '../i18n/api-errors';

/**
 * The Guild Master's actions that can't be undone: handing the guild to another member, and
 * disbanding it. Each applies right after its own confirmation, not with the page's Save.
 */
export function GuildDangerZone({ guild }: { guild: GuildResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const candidates = useTransferCandidates(guild.id, true);
  const transfer = useTransferLeadership(guild.id);
  const disband = useDisbandGuild(guild.id);
  const [newLeader, setNewLeader] = useState('');
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [disbanding, setDisbanding] = useState(false);
  const [typedName, setTypedName] = useState('');

  const chosen = candidates.data?.find((candidate) => candidate.memberId === newLeader);
  // Both leave the user without the Guild Master's pages, so they start over from home.
  const home = () => void navigate('/');

  return (
    <DangerZone title={t('danger.title')} description={t('danger.description')}>
      <DangerZone.Action title={t('danger.transfer')} description={t('danger.transferHelp')}>
        <Select
          label={t('danger.newLeader')}
          value={newLeader}
          placeholder={t('danger.pickLeader')}
          options={(candidates.data ?? [])
            .filter((candidate) => !candidate.leads)
            .map((candidate) => ({ value: candidate.memberId, label: candidate.discordName }))}
          onChange={setNewLeader}
          disabled={candidates.isPending}
        />
        <Button
          size="medium"
          tone="danger"
          onClick={() => setConfirmingTransfer(true)}
          disabled={!chosen || transfer.isPending}
        >
          {t('danger.transfer')}
        </Button>
      </DangerZone.Action>
      {(candidates.data ?? []).some((candidate) => candidate.leads) && (
        <Notice tone="warn" title={t('danger.someLead')}>
          {(candidates.data ?? [])
            .filter((candidate) => candidate.leads)
            .map((candidate) =>
              t('danger.leads', { name: candidate.discordName, guild: candidate.leads }),
            )
            .join(' · ')}
        </Notice>
      )}

      <DangerZone.Action title={t('danger.disband')} description={t('danger.disbandHelp')}>
        <Button
          size="medium"
          variant="primary"
          tone="danger"
          onClick={() => {
            setTypedName('');
            setDisbanding(true);
          }}
        >
          {t('danger.disband')}
        </Button>
      </DangerZone.Action>

      {(transfer.error ?? disband.error) && (
        <Notice tone="bad" title={t('danger.failed')}>
          {apiErrorText(t, (transfer.error ?? disband.error)!)}
        </Notice>
      )}

      <ConfirmDialog
        open={confirmingTransfer}
        title={t('danger.transferTitle', { name: chosen?.discordName })}
        confirmLabel={t('danger.transfer')}
        cancelLabel={t('danger.keep')}
        onCancel={() => setConfirmingTransfer(false)}
        onConfirm={() => {
          setConfirmingTransfer(false);
          transfer.mutate(newLeader, { onSuccess: home });
        }}
      >
        {t('danger.transferBody', { name: chosen?.discordName, guild: guild.name })}
      </ConfirmDialog>

      <Dialog
        open={disbanding}
        title={t('danger.disbandTitle', { guild: guild.name })}
        description={t('danger.disbandBody')}
        onClose={() => setDisbanding(false)}
        actions={
          <>
            <Button size="medium" onClick={() => setDisbanding(false)}>
              {t('danger.keep')}
            </Button>
            <Button
              size="medium"
              variant="primary"
              tone="danger"
              disabled={typedName.trim() !== guild.name.trim() || disband.isPending}
              onClick={() => {
                setDisbanding(false);
                disband.mutate(typedName, { onSuccess: home });
              }}
            >
              {t('danger.disband')}
            </Button>
          </>
        }
      >
        <TextField
          label={t('danger.typeName', { guild: guild.name })}
          value={typedName}
          onChange={setTypedName}
          autoFocus
        />
      </Dialog>
    </DangerZone>
  );
}
