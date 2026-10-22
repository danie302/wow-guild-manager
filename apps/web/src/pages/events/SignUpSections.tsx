import {
  CLASS_NAMES,
  COMBAT_ROLE_PLURAL_NAMES,
  COMBAT_ROLES,
  RACE_NAMES,
  type CombatRole,
  type SignUpResponse,
} from '@wgm/shared';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  CharacterName,
  NameList,
  SlotGroup,
  StatStrip,
  Tabs,
  Tag,
} from '../../components/ui';
import { useFormat } from '../../i18n/format';
import { roleColor } from './eventText';

type Slots = Record<CombatRole, number>;

/** What the Guild Master and Officers can do to a participant. */
export interface ParticipantActions {
  onRemove: (signUp: SignUpResponse) => void;
  /** Only offered for Tentative participants while the role has a waitlist. */
  onReplace: (signUp: SignUpResponse) => void;
  /** While a change is being saved. */
  busy?: boolean;
}

export interface SignUpSectionsProps {
  slots: Slots;
  /** In sign-up order; none for a series, whose events each have their own. */
  signUps?: SignUpResponse[];
  /** Without them, the sign-ups are read-only. */
  actions?: ParticipantActions;
  /** Goes under the tabs, on the Sign-ups tab. */
  notice?: ReactNode;
  /** More tabs after Sign-ups, e.g. the event's Discord post. */
  tabs?: { value: string; label: string; content: ReactNode }[];
}

/**
 * How full each role is, and the Sign-ups tab: each role's participants with their status, its
 * open slots, its waitlist in order, and who declined.
 */
export function SignUpSections({
  slots,
  signUps = [],
  actions,
  notice,
  tabs = [],
}: SignUpSectionsProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('signUps');
  const other = tabs.find((candidate) => candidate.value === tab);
  const roles = COMBAT_ROLES.filter((role) => slots[role] > 0);
  const filled = (role: CombatRole) =>
    signUps.filter((signUp) => signUp.role === role && signUp.placement === 'slot').length;
  const missing = (role: CombatRole) => Math.max(0, slots[role] - filled(role));

  return (
    <>
      <StatStrip
        label={t('eventPage.slots')}
        items={roles.map((role) => ({
          key: role,
          label: COMBAT_ROLE_PLURAL_NAMES[role],
          value: `${filled(role)}/${slots[role]}`,
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
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'signUps', label: t('eventPage.signUps') },
          ...tabs.map(({ value, label }) => ({ value, label })),
        ]}
      />
      {other ? other.content : <SignUpTab {...{ slots, signUps, roles, actions, notice }} />}
    </>
  );
}

function SignUpTab({
  slots,
  signUps,
  roles,
  actions,
  notice,
}: {
  slots: Slots;
  signUps: SignUpResponse[];
  roles: CombatRole[];
  actions?: ParticipantActions;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const declined = signUps.filter((signUp) => signUp.status === 'declined');

  const who = (signUp: SignUpResponse) => (
    <>
      <SlotGroup.Name>
        <CharacterName name={signUp.character.name} characterClass={signUp.character.class} />
      </SlotGroup.Name>
      <SlotGroup.Detail>
        {CLASS_NAMES[signUp.character.class]} · {RACE_NAMES[signUp.character.race]}
      </SlotGroup.Detail>
    </>
  );
  const remove = (signUp: SignUpResponse) =>
    actions && (
      <Button
        variant="text"
        tone="danger"
        onClick={() => actions.onRemove(signUp)}
        disabled={actions.busy}
      >
        {t('eventPage.remove')}
      </Button>
    );

  return (
    <>
      {notice}
      {roles.map((role) => {
        const inSlots = signUps.filter((s) => s.role === role && s.placement === 'slot');
        const waitlist = signUps.filter((s) => s.role === role && s.placement === 'waitlist');
        const open = Math.max(0, slots[role] - inSlots.length);
        return (
          <SlotGroup
            key={role}
            title={COMBAT_ROLE_PLURAL_NAMES[role]}
            count={t('eventPage.filled', { filled: inSlots.length, slots: slots[role] })}
            tag={
              open > 0
                ? { label: t('eventPage.missing', { count: open }), tone: 'warn' }
                : { label: t('eventPage.full'), tone: 'ok' }
            }
            color={roleColor[role]}
          >
            {inSlots.map((signUp, index) => (
              <SlotGroup.Row key={signUp.id} number={index + 1}>
                {who(signUp)}
                <SlotGroup.Status>
                  <Tag tone={signUp.status === 'tentative' ? 'warn' : 'ok'}>
                    {t(`eventPage.status.${signUp.status}`)}
                  </Tag>
                </SlotGroup.Status>
                {actions && (
                  <SlotGroup.Actions>
                    {signUp.status === 'tentative' && waitlist.length > 0 && (
                      <Button
                        variant="secondary"
                        onClick={() => actions.onReplace(signUp)}
                        disabled={actions.busy}
                      >
                        {t('eventPage.replace')}
                      </Button>
                    )}
                    {remove(signUp)}
                  </SlotGroup.Actions>
                )}
              </SlotGroup.Row>
            ))}
            {Array.from({ length: open }, (_, index) => (
              <SlotGroup.OpenRow
                key={index}
                number={inSlots.length + index + 1}
                label={t('eventPage.openSlot')}
                hint={
                  waitlist[0]
                    ? t('eventPage.nextOnWaitlist', { name: waitlist[0].character.name })
                    : t('eventPage.noWaitlist')
                }
              />
            ))}
            {waitlist.length > 0 && (
              <SlotGroup.Waitlist label={t('eventPage.waitlist')} count={String(waitlist.length)}>
                {waitlist.map((signUp, index) => (
                  <SlotGroup.WaitlistRow key={signUp.id} position={index + 1}>
                    {who(signUp)}
                    <SlotGroup.Detail>
                      {format.relative(new Date(signUp.signedUpAt))}
                    </SlotGroup.Detail>
                    {actions && <SlotGroup.Actions>{remove(signUp)}</SlotGroup.Actions>}
                  </SlotGroup.WaitlistRow>
                ))}
              </SlotGroup.Waitlist>
            )}
          </SlotGroup>
        );
      })}
      {declined.length > 0 && (
        <NameList label={t('eventPage.declined', { count: declined.length })}>
          {declined.map((signUp) => (
            <CharacterName
              key={signUp.id}
              name={signUp.character.name}
              characterClass={signUp.character.class}
            />
          ))}
        </NameList>
      )}
    </>
  );
}
