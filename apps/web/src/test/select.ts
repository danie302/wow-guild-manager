import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Opens a Select (a themed dropdown, not a native <select>) and picks the option `name`. */
export async function choose(user: UserEvent, select: HTMLElement, name: string): Promise<void> {
  await user.click(select);
  await user.click(await screen.findByRole('option', { name }));
}
