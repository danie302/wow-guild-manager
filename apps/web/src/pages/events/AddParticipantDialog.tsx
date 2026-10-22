import {
  canJoinEvent,
  CLASS_NAMES,
  COMBAT_ROLE_NAMES,
  rolesFor,
  type CombatRole,
  type EventResponse,
  type SignUpResponse,
} from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAddParticipant } from '../../api/events';
import { useRoster } from '../../api/roster';
import {
  Button,
  ChoiceGroup,
  ComboBox,
  ConfirmDialog,
  Dialog,
  FormRow,
  Notice,
  Page,
  Select,
} from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';

type Status = 'confirmed' | 'tentative';

/**
 * The Guild Master or an Officer signs a member up for an upcoming event: a member who can
 * join it, one of their characters, a role it can fill, and Confirmed or Tentative. The same
 * rules as signing up in Discord apply, so a full role puts them on its waitlist, and a member
 * who was already signed up has their sign-up changed.
 */
export function AddParticipantDialog({
  guildId,
  event,
  signUps,
  open,
  onClose,
}: {
  guildId: string;
  event: EventResponse;
  signUps: SignUpResponse[];
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const roster = useRoster(guildId, open);
  const add = useAddParticipant(guildId, event.id);
  const [memberId, setMemberId] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [role, setRole] = useState<CombatRole | ''>('');
  const [status, setStatus] = useState<Status>('confirmed');
  const [confirmingRole, setConfirmingRole] = useState(false);
  const tentativeOpen = new Date(event.tentativeDeadline.at) > new Date();

  const members = (roster.data ?? []).filter(
    (member) =>
      canJoinEvent(member.rank, event.type) &&
      !member.leftDiscordAt &&
      member.characters.length > 0,
  );
  const member = members.find((candidate) => candidate.id === memberId);
  const character = member?.characters.find((candidate) => candidate.id === characterId);
  const roles = character
    ? rolesFor(character.class).filter((candidate) => event.slots[candidate] > 0)
    : [];
  const current = signUps.find((signUp) => signUp.memberId === memberId);
  // Moving someone to another role costs them their spot there, so it asks first.
  const changesRole = Boolean(current?.placement && current.role && role && current.role !== role);

  const pickRole = (next: CombatRole[]) => setRole(next.length === 1 ? next[0]! : '');
  const chooseMember = (id: string) => {
    const main = members.find((candidate) => candidate.id === id)?.characters[0];
    setMemberId(id);
    setCharacterId(main?.id ?? '');
    pickRole(main ? rolesFor(main.class).filter((r) => event.slots[r] > 0) : []);
  };
  const submit = () =>
    add.mutate(
      {
        characterId,
        role: role as CombatRole,
        status: tentativeOpen ? status : 'confirmed',
      },
      { onSuccess: close },
    );
  const close = () => {
    setMemberId('');
    setCharacterId('');
    setRole('');
    setStatus('confirmed');
    setConfirmingRole(false);
    add.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      title={t('addParticipant.title')}
      description={t('addParticipant.description')}
      onClose={close}
      actions={
        <>
          <Button size="medium" onClick={close}>
            {t('eventPage.keepParticipant')}
          </Button>
          <Button
            size="medium"
            variant="primary"
            disabled={!character || !role || add.isPending}
            onClick={() => (changesRole ? setConfirmingRole(true) : submit())}
          >
            {t('addParticipant.add')}
          </Button>
        </>
      }
    >
      <Page.Stack>
        <FormRow>
          <ComboBox
            variant="field"
            label={t('eventForm.preConfirmedMember')}
            value={memberId}
            options={members.map((candidate) => ({
              value: candidate.id,
              label: candidate.discordName,
              detail: candidate.characters[0]?.name,
            }))}
            onChange={chooseMember}
            noOptionsText={t(`addParticipant.noMember.${event.type}`)}
            disabled={roster.isPending}
          />
          {member && (
            <Select
              label={t('eventForm.preConfirmedCharacter')}
              value={characterId}
              options={member.characters.map((candidate) => ({
                value: candidate.id,
                label: `${candidate.name} · ${CLASS_NAMES[candidate.class]}`,
              }))}
              onChange={(id) => {
                const next = member.characters.find((candidate) => candidate.id === id);
                setCharacterId(id);
                pickRole(next ? rolesFor(next.class).filter((r) => event.slots[r] > 0) : []);
              }}
            />
          )}
        </FormRow>
        {character && roles.length === 0 && (
          <Page.Text>
            {t('addParticipant.noRole', { class: CLASS_NAMES[character.class] })}
          </Page.Text>
        )}
        {character && roles.length > 0 && (
          <FormRow>
            <FormRow.Fit>
              <ChoiceGroup
                label={t('eventForm.preConfirmedRole')}
                // No role picked yet shows none selected.
                value={role as CombatRole}
                onChange={(next: CombatRole) => setRole(next)}
              >
                {roles.map((candidate) => (
                  <ChoiceGroup.Option key={candidate} value={candidate}>
                    {COMBAT_ROLE_NAMES[candidate]}
                  </ChoiceGroup.Option>
                ))}
              </ChoiceGroup>
            </FormRow.Fit>
            {tentativeOpen && (
              <FormRow.Fit>
                <ChoiceGroup
                  label={t('addParticipant.status')}
                  value={status}
                  onChange={(next: Status) => setStatus(next)}
                >
                  <ChoiceGroup.Option value="confirmed">
                    {t('eventPage.status.confirmed')}
                  </ChoiceGroup.Option>
                  <ChoiceGroup.Option value="tentative">
                    {t('eventPage.status.tentative')}
                  </ChoiceGroup.Option>
                </ChoiceGroup>
              </FormRow.Fit>
            )}
          </FormRow>
        )}
        {character && role && (
          <Page.Text>
            {placementHint(t, signUps, event, memberId, role, current)}
            {!tentativeOpen && ` ${t('addParticipant.tentativeClosed')}`}
          </Page.Text>
        )}
        {add.error && (
          <Notice tone="bad" title={t('eventPage.participantFailed')}>
            {apiErrorText(t, add.error)}
          </Notice>
        )}
      </Page.Stack>

      {current?.role && role && (
        <ConfirmDialog
          open={confirmingRole}
          title={t('addParticipant.changeRoleTitle', {
            name: current.character.name,
            role: COMBAT_ROLE_NAMES[role],
          })}
          confirmLabel={t('addParticipant.changeRole')}
          cancelLabel={t('addParticipant.goBack')}
          onCancel={() => setConfirmingRole(false)}
          onConfirm={() => {
            setConfirmingRole(false);
            submit();
          }}
        >
          {t(
            current.placement === 'slot'
              ? 'addParticipant.changeRoleFromSlot'
              : 'addParticipant.changeRoleFromWaitlist',
            { name: current.character.name, current: COMBAT_ROLE_NAMES[current.role] },
          )}{' '}
          {placementHint(t, signUps, event, memberId, role, undefined)}
        </ConfirmDialog>
      )}
    </Dialog>
  );
}

/** Where they'll end up, as signing up in Discord would put them. */
function placementHint(
  t: ReturnType<typeof useTranslation>['t'],
  signUps: SignUpResponse[],
  event: EventResponse,
  memberId: string,
  role: CombatRole,
  current: SignUpResponse | undefined,
): string {
  const roleName = COMBAT_ROLE_NAMES[role];
  if (current?.placement && current.role === role) {
    return t(
      current.placement === 'slot' ? 'addParticipant.keepsSlot' : 'addParticipant.keepsWaitlist',
      {
        role: roleName,
      },
    );
  }
  const taken = signUps.filter(
    (signUp) => signUp.role === role && signUp.placement === 'slot' && signUp.memberId !== memberId,
  ).length;
  const where =
    taken < event.slots[role]
      ? t('addParticipant.getsSlot', { role: roleName })
      : t('addParticipant.goesToWaitlist', { role: roleName });
  return current ? `${t('addParticipant.replaces')} ${where}` : where;
}
