import type { HealthStatus } from '@wgm/shared';

import { useHealth } from '../api/health';
import { Loading, Notice, Page, StatusList } from '../components/ui';

// Placeholder English text. Story 035 moves it to translation files.
const label: Record<HealthStatus, string> = { up: 'Up', down: 'Down' };
const tone = { up: 'ok', down: 'bad' } as const;

export function StatusPage() {
  const health = useHealth();

  return (
    <Page>
      <Page.Header>
        <Page.Title>System status</Page.Title>
      </Page.Header>
      <Page.Section title="Services">
        {health.isPending && <Loading label="Checking the services" />}
        {health.isError && (
          <>
            <Notice tone="bad" title="Can't reach the API">
              The API isn't responding, so the database and Redis can't be checked.
            </Notice>
            <StatusList>
              <StatusList.Item label="API" tone="bad">
                {label.down}
              </StatusList.Item>
            </StatusList>
          </>
        )}
        {health.isSuccess && (
          <StatusList>
            <StatusList.Item label="API" tone="ok">
              {label.up}
            </StatusList.Item>
            <StatusList.Item label="Database" tone={tone[health.data.checks.database]}>
              {label[health.data.checks.database]}
            </StatusList.Item>
            <StatusList.Item label="Redis" tone={tone[health.data.checks.redis]}>
              {label[health.data.checks.redis]}
            </StatusList.Item>
          </StatusList>
        )}
      </Page.Section>
    </Page>
  );
}
