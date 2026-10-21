import { COMBAT_ROLE_NAMES, COMBAT_ROLES } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import { useSeries, useStopSeries } from '../../api/events';
import { guildPath, useGuildIdParam } from '../../app/guildSelection';
import { Button, ConfirmDialog, DetailList, Loading, Notice, Page } from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';
import { everyWeekText } from './seriesText';

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
      <Page.Header>
        <div>
          <Button to={guildPath(guildId, 'events')}>{t('eventPage.back')}</Button>
          <Page.Text>
            {t(`events.types.${data.type}`)} · {t('events.players', { count: data.size })} ·{' '}
            {t('series.recurring')}
          </Page.Text>
          <Page.Title>{data.name}</Page.Title>
          <Page.Text>{everyWeekText(t, format, data.startsAt)}</Page.Text>
        </div>
        {!data.stopped && (
          <div>
            <Button to={guildPath(guildId, `events/series/${data.id}/edit`)}>
              {t('series.edit')}
            </Button>{' '}
            <Button onClick={() => setConfirming(true)} disabled={stop.isPending}>
              {t('series.stop')}
            </Button>
          </div>
        )}
      </Page.Header>

      {data.stopped && (
        <Notice
          tone="warn"
          title={t('series.stoppedTitle', {
            date: format.dateTime(new Date(data.stopped.at)),
            name: data.stopped.by ?? t('member.unknownUser'),
          })}
        />
      )}
      {stop.error && (
        <Notice tone="bad" title={t('series.stopFailed')}>
          {apiErrorText(t, stop.error)}
        </Notice>
      )}

      <Page.Section title={t('series.next')}>
        <Page.Text>
          {data.nextEventAt
            ? format.dateTime(new Date(data.nextEventAt), { dateStyle: 'full' })
            : t('series.noNext')}
        </Page.Text>
        <Page.Text>{t('series.dstHint')}</Page.Text>
      </Page.Section>

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
      </Page.Section>

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
