import type { PendingRegistration } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useApproveRegistration,
  useRegistrations,
  useRejectRegistration,
} from '../../api/registrations';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import { ActionList, Button, ConfirmDialog, Loading, Notice, Page, Tag } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';

type Outcome =
  | { kind: 'approved'; name: string; memberId: string; restored: boolean }
  | { kind: 'rejected'; name: string };

/** Requests to join the roster, made with /register, for the Guild Master and Officers. */
export function RegistrationsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const guildId = useGuildIdParam()!;
  const registrations = useRegistrations(guildId);
  const approve = useApproveRegistration(guildId);
  const reject = useRejectRegistration(guildId);
  const [rejecting, setRejecting] = useState<PendingRegistration | null>(null);
  const [outcome, setOutcome] = useState<Outcome>();

  if (registrations.isPending) return <Loading label={t('registrations.loading')} />;
  if (registrations.isError) return <Notice tone="bad" title={t('registrations.loadFailed')} />;

  const busy = approve.isPending || reject.isPending;
  const failed = approve.error ?? reject.error;

  const approveRequest = (registration: PendingRegistration) => {
    reject.reset();
    approve.mutate(registration.id, {
      onSuccess: ({ memberId, restored }) =>
        setOutcome({ kind: 'approved', name: registration.discordName, memberId, restored }),
    });
  };
  const confirmReject = () => {
    const registration = rejecting!;
    setRejecting(null);
    approve.reset();
    reject.mutate(registration.id, {
      onSuccess: () => setOutcome({ kind: 'rejected', name: registration.discordName }),
    });
  };

  return (
    <Page>
      <Page.Header>
        <div>
          <Page.Title>{t('registrations.title')}</Page.Title>
          <Page.Text>{t('registrations.lead')}</Page.Text>
        </div>
      </Page.Header>

      {outcome?.kind === 'approved' && (
        <Notice
          tone="ok"
          title={t(outcome.restored ? 'registrations.restored' : 'registrations.approved', {
            name: outcome.name,
          })}
        >
          <Button to={guildPath(guildId, `roster/${outcome.memberId}`)}>
            {t('registrations.openMember')}
          </Button>
        </Notice>
      )}
      {outcome?.kind === 'rejected' && (
        <Notice tone="ok" title={t('registrations.rejected', { name: outcome.name })} />
      )}
      {failed && (
        <Notice tone="bad" title={t('registrations.reviewFailed')}>
          {apiErrorText(t, failed)}
        </Notice>
      )}

      <ActionList label={t('registrations.title')} empty={t('registrations.empty')}>
        {registrations.data.map((registration) => (
          <ActionList.Item
            key={registration.id}
            title={
              <>
                <strong>{registration.discordName}</strong>
                <Page.Text>
                  {t('registrations.requestedAt', {
                    date: format.dateTime(new Date(registration.requestedAt)),
                  })}
                </Page.Text>
              </>
            }
            actions={
              <>
                <Button
                  variant="primary"
                  onClick={() => approveRequest(registration)}
                  disabled={busy}
                >
                  {t('registrations.approve')}
                </Button>
                <Button onClick={() => setRejecting(registration)} disabled={busy}>
                  {t('registrations.reject')}
                </Button>
              </>
            }
          >
            {registration.leftDiscordAt && <Tag tone="bad">{t('registrations.leftDiscord')}</Tag>}
            {registration.returning && <Tag>{t('registrations.returning')}</Tag>}
            {registration.onRoster && <Tag>{t('registrations.onRoster')}</Tag>}
          </ActionList.Item>
        ))}
      </ActionList>

      <ConfirmDialog
        open={rejecting !== null}
        title={t('registrations.rejectTitle', { name: rejecting?.discordName })}
        confirmLabel={t('registrations.reject')}
        cancelLabel={t('registrations.cancel')}
        onConfirm={confirmReject}
        onCancel={() => setRejecting(null)}
      >
        {t('registrations.rejectBody', { name: rejecting?.discordName })}
      </ConfirmDialog>
    </Page>
  );
}
