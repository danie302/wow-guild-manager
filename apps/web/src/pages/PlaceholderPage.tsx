import { useTranslation } from 'react-i18next';

import { Page } from '../components/ui';
import type { TranslationKey } from '../i18n';

export interface PlaceholderPageProps {
  titleKey: TranslationKey;
}

/** Stands in for pages that later stories build. */
export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation();
  return (
    <Page>
      <Page.Header>
        <Page.Title>{t(titleKey)}</Page.Title>
      </Page.Header>
    </Page>
  );
}
