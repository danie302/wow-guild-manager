import { COMBAT_ROLE_PLURAL_NAMES, COMBAT_ROLES, type CombatRole } from '@wgm/shared';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { SlotGroup, StatStrip, Tabs } from '../../components/ui';
import { roleColor } from './eventText';

type Slots = Record<CombatRole, number>;

/**
 * How full each role is, and the Sign-ups tab with each role's slots. Nobody can sign up yet
 * (story 023), so every slot is open; `notice` goes under the tabs.
 */
export function SignUpSections({ slots, notice }: { slots: Slots; notice?: ReactNode }) {
  const { t } = useTranslation();
  const filled: Slots = { tank: 0, healer: 0, dps: 0 };
  const roles = COMBAT_ROLES.filter((role) => slots[role] > 0);
  const missing = (role: CombatRole) => slots[role] - filled[role];

  return (
    <>
      <StatStrip
        label={t('eventPage.slots')}
        items={roles.map((role) => ({
          key: role,
          label: COMBAT_ROLE_PLURAL_NAMES[role],
          value: `${filled[role]}/${slots[role]}`,
          note:
            missing(role) > 0
              ? t('eventPage.missing', { count: missing(role) })
              : t('eventPage.full'),
          noteTone: missing(role) > 0 ? 'warn' : 'ok',
          color: roleColor[role],
        }))}
      />
      <Tabs
        label={t('eventPage.sections')}
        value="signUps"
        onChange={() => undefined}
        tabs={[{ value: 'signUps', label: t('eventPage.signUps') }]}
      />
      {notice}
      {roles.map((role) => (
        <SlotGroup
          key={role}
          title={COMBAT_ROLE_PLURAL_NAMES[role]}
          count={t('eventPage.filled', { filled: filled[role], slots: slots[role] })}
          tag={
            missing(role) > 0
              ? { label: t('eventPage.missing', { count: missing(role) }), tone: 'warn' }
              : { label: t('eventPage.full'), tone: 'ok' }
          }
          color={roleColor[role]}
        >
          {Array.from({ length: missing(role) }, (_, index) => (
            <SlotGroup.OpenRow
              key={index}
              number={filled[role] + index + 1}
              label={t('eventPage.openSlot')}
              hint={t('eventPage.noWaitlist')}
            />
          ))}
        </SlotGroup>
      ))}
    </>
  );
}
