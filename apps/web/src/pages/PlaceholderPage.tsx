import { Page } from '../components/ui';

export interface PlaceholderPageProps {
  title: string;
}

/** Stands in for pages that later stories build. */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Page>
      <Page.Header>
        <Page.Title>{title}</Page.Title>
      </Page.Header>
    </Page>
  );
}
