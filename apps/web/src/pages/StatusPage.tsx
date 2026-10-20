import type { HealthStatus } from '@wgm/shared';
import { useTranslation } from 'react-i18next';

import { useHealth } from '../api/health';
import { Loading, Notice, Page, StatusList } from '../components/ui';
import { useFormat } from '../i18n/format';

const tone = { up: 'ok', down: 'bad' } as const;

export function StatusPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const health = useHealth();
  const label = (status: HealthStatus) => t(status === 'up' ? 'status.up' : 'status.down');
  const checkedAt = health.dataUpdatedAt || health.errorUpdatedAt;

  return (
    <Page>
      <Page.Header>
        <Page.Title>{t('status.title')}</Page.Title>
      </Page.Header>
      <Page.Section title={t('status.services')}>
        {health.isPending && <Loading label={t('status.checking')} />}
        {health.isError && (
          <>
            <Notice tone="bad" title={t('status.apiUnreachableTitle')}>
              {t('status.apiUnreachableBody')}
            </Notice>
            <StatusList>
              <StatusList.Item label={t('status.api')} tone="bad">
                {label('down')}
              </StatusList.Item>
            </StatusList>
          </>
        )}
        {health.isSuccess && (
          <StatusList>
            <StatusList.Item label={t('status.api')} tone="ok">
              {label('up')}
            </StatusList.Item>
            <StatusList.Item label={t('status.database')} tone={tone[health.data.checks.database]}>
              {label(health.data.checks.database)}
            </StatusList.Item>
            <StatusList.Item label={t('status.redis')} tone={tone[health.data.checks.redis]}>
              {label(health.data.checks.redis)}
            </StatusList.Item>
          </StatusList>
        )}
        {checkedAt > 0 && <p>{t('status.lastChecked', { time: format.time(checkedAt) })}</p>}
      </Page.Section>
    </Page>
  );
}
