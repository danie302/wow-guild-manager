import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useCancelEvent, useEvent } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import { Button, ConfirmDialog, DetailHeader, Loading, Notice, Page } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';
import { everyWeekText, whenText } from './eventText';
import { SignUpSections } from './SignUpSections';

/**
 * One event: when it is, its description, how full each role is, and editing or cancelling
 * it while it's upcoming. Sign-ups fill the roles from story 023; the gear check, attendance,
 * and Discord post tabs come with their stories.
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
      <DetailHeader
        back={{ to: guildPath(guildId, 'events'), label: t('events.title') }}
        badge={t(`events.types.${data.type}`)}
        facts={[
          t('events.players', { count: data.size }),
          ...(data.series ? [everyWeekText(t, format, data.startsAt)] : []),
        ].join(' · ')}
        title={data.name}
        when={whenText(format, startsAt)}
        description={data.description}
        actions={
          changeable && (
            <>
              <Button size="medium" to={guildPath(guildId, `events/${data.id}/edit`)}>
                {t('eventPage.edit')}
              </Button>
              <Button
                size="medium"
                tone="danger"
                onClick={() => setConfirming(true)}
                disabled={cancel.isPending}
              >
                {t('eventPage.cancel')}
              </Button>
            </>
          )
        }
        banner={
          data.cancelled
            ? {
                label: t('events.cancelled'),
                text: t('eventPage.cancelledText', {
                  date: format.dateTime(new Date(data.cancelled.at)),
                  name: data.cancelled.by ?? t('member.unknownUser'),
                }),
              }
            : undefined
        }
      />

      {data.series && (
        <Button variant="text" to={guildPath(guildId, `events/series/${data.series.id}`)}>
          {t('eventPage.series', { name: data.series.name })}
        </Button>
      )}
      {!data.cancelled && started && <Notice tone="warn" title={t('eventPage.started')} />}
      {cancel.error && (
        <Notice tone="bad" title={t('eventPage.cancelFailed')}>
          {apiErrorText(t, cancel.error)}
        </Notice>
      )}

      <SignUpSections slots={data.slots} />

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
