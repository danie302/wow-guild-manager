import { COMBAT_ROLE_NAMES, COMBAT_ROLES } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useCancelEvent, useEvent } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import { Button, ConfirmDialog, DetailList, Loading, Notice, Page, Tag } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';

/**
 * One event: when it is, its description and slots, and editing or cancelling it while it's
 * upcoming. Sign-ups, the gear check, and the Discord post come with later stories.
 */
export function EventPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const guildId = useGuildIdParam()!;
  const eventId = useParams().eventId!;
  const event = useEvent(guildId, eventId);
  const cancel = useCancelEvent(guildId, eventId);
  const [confirming, setConfirming] = useState(false);

  if (event.isPending) return <Loading label={t('events.loading')} />;
  if (event.error instanceof ApiRequestError && event.error.status === 404) {
    return <Notice tone="warn" title={t('eventPage.notFound')} />;
  }
  if (event.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;

  const { data } = event;
  const startsAt = new Date(data.startsAt);
  const started = startsAt <= new Date();
  const changeable = !data.cancelled && !started;

  return (
    <Page>
      <Page.Header>
        <div>
          <Button to={guildPath(guildId, 'events')}>{t('eventPage.back')}</Button>
          <Page.Text>
            {t(`events.types.${data.type}`)} · {t('events.players', { count: data.size })}
          </Page.Text>
          <Page.Title>{data.name}</Page.Title>
          <Page.Text>{format.dateTime(startsAt, { dateStyle: 'full' })}</Page.Text>
          {data.series && (
            <Button to={guildPath(guildId, `events/series/${data.series.id}`)}>
              {t('eventPage.series', { name: data.series.name })}
            </Button>
          )}
        </div>
        {changeable && (
          <div>
            <Button to={guildPath(guildId, `events/${data.id}/edit`)}>{t('eventPage.edit')}</Button>{' '}
            <Button onClick={() => setConfirming(true)} disabled={cancel.isPending}>
              {t('eventPage.cancel')}
            </Button>
          </div>
        )}
      </Page.Header>

      {data.cancelled && (
        <Notice
          tone="bad"
          title={t('eventPage.cancelledTitle', {
            date: format.dateTime(new Date(data.cancelled.at)),
            name: data.cancelled.by ?? t('member.unknownUser'),
          })}
        >
          {t('eventPage.cancelledBody')}
        </Notice>
      )}
      {!data.cancelled && started && <Notice tone="warn" title={t('eventPage.started')} />}
      {cancel.error && (
        <Notice tone="bad" title={t('eventPage.cancelFailed')}>
          {apiErrorText(t, cancel.error)}
        </Notice>
      )}

      {data.description && (
        <Page.Section title={t('eventPage.description')}>
          <Page.Text>{data.description}</Page.Text>
        </Page.Section>
      )}

      <Page.Section title={t('eventPage.slots')}>
        <DetailList>
          {COMBAT_ROLES.map((role) => (
            <DetailList.Item key={role} label={COMBAT_ROLE_NAMES[role]}>
              {data.slots[role]}
            </DetailList.Item>
          ))}
        </DetailList>
        <Page.Text>
          {data.createdBy && t('eventPage.createdBy', { name: data.createdBy })}{' '}
          {data.cancelled && <Tag tone="bad">{t('events.cancelled')}</Tag>}
        </Page.Text>
      </Page.Section>

      <ConfirmDialog
        open={confirming}
        title={t('eventPage.cancelTitle', { name: data.name })}
        confirmLabel={t('eventPage.cancel')}
        cancelLabel={t('eventPage.keep')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          cancel.mutate();
        }}
      >
        {t('eventPage.cancelBody')}
      </ConfirmDialog>
    </Page>
  );
}
