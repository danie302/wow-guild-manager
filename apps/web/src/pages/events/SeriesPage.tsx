import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useSeries, useStopSeries } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import { Button, ConfirmDialog, DetailHeader, Loading, Notice, Page } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';
import { everyWeekText, whenText } from './eventText';
import { SignUpSections } from './SignUpSections';

/** A weekly series: when it repeats, its next event, and editing or stopping it. */
export function SeriesPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const guildId = useGuildIdParam()!;
  const seriesId = useParams().seriesId!;
  const series = useSeries(guildId, seriesId);
  const stop = useStopSeries(guildId, seriesId);
  const [confirming, setConfirming] = useState(false);

  if (series.isPending) return <Loading label={t('events.loading')} />;
  if (series.error instanceof ApiRequestError && series.error.status === 404) {
    return <Notice tone="warn" title={t('series.notFound')} />;
  }
  if (series.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;
  const { data } = series;

  return (
    <Page>
      <DetailHeader
        back={{ to: guildPath(guildId, 'events'), label: t('events.title') }}
        badge={t(`events.types.${data.type}`)}
        facts={`${t('events.players', { count: data.size })} · ${t('series.recurring')}`}
        title={data.name}
        when={everyWeekText(t, format, data.startsAt)}
        details={[
          data.nextEventAt
            ? t('series.nextOn', { date: whenText(format, new Date(data.nextEventAt)) })
            : t('series.noNext'),
          ...(data.channel
            ? [t('series.postedIn', { channel: `#${data.channel.name ?? data.channel.id}` })]
            : []),
          t('series.dstHint'),
        ]}
        description={data.description}
        actions={
          !data.stopped && (
            <>
              <Button size="medium" to={guildPath(guildId, `events/series/${data.id}/edit`)}>
                {t('series.edit')}
              </Button>
              <Button
                size="medium"
                tone="danger"
                onClick={() => setConfirming(true)}
                disabled={stop.isPending}
              >
                {t('series.stop')}
              </Button>
            </>
          )
        }
        banner={
          data.stopped
            ? {
                label: t('series.stopped'),
                text: t('series.stoppedText', {
                  date: format.dateTime(new Date(data.stopped.at)),
                  name: data.stopped.by ?? t('member.unknownUser'),
                }),
              }
            : undefined
        }
      />

      {stop.error && (
        <Notice tone="bad" title={t('series.stopFailed')}>
          {apiErrorText(t, stop.error)}
        </Notice>
      )}

      <SignUpSections
        slots={data.slots}
        notice={
          <Page.Text>
            {t('series.signUpsPerEvent')}{' '}
            {data.nextEventId && (
              <Button variant="text" to={guildPath(guildId, `events/${data.nextEventId}`)}>
                {t('series.openNext')}
              </Button>
            )}
          </Page.Text>
        }
      />

      <ConfirmDialog
        open={confirming}
        title={t('series.stopTitle', { name: data.name })}
        confirmLabel={t('series.stop')}
        cancelLabel={t('series.keep')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          stop.mutate();
        }}
      >
        {t('series.stopBody')}
      </ConfirmDialog>
    </Page>
  );
}
