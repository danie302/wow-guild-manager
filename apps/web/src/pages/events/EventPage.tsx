import { CLASS_NAMES, RACE_NAMES, type SignUpResponse } from '@wgm/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { ApiRequestError } from '../../api/client';
import {
  useCancelEvent,
  useEvent,
  useEventSignUps,
  useRemoveParticipant,
  useReplaceParticipant,
} from '../../api/events';
import { guildPath, useGuildAccess, useGuildIdParam } from '../../app/guildSelection';
import {
  ActionList,
  Button,
  ConfirmDialog,
  DetailHeader,
  Dialog,
  Loading,
  Notice,
  Page,
} from '../../components/ui';
import { apiErrorText } from '../../i18n/api-errors';
import { useFormat } from '../../i18n/format';
import { AttendanceTab } from './AttendanceTab';
import { DiscordPostTab } from './DiscordPostTab';
import { everyWeekText, whenText } from './eventText';
import { SignUpSections } from './SignUpSections';

/**
 * One event: when it is, its description, how full each role is, its Discord post, and
 * editing or cancelling it while it's upcoming. Sign-ups fill the roles from story 023; the
 * gear check and attendance tabs come with their stories.
 */
export function EventPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const guildId = useGuildIdParam()!;
  const eventId = useParams().eventId!;
  const event = useEvent(guildId, eventId);
  const cancel = useCancelEvent(guildId, eventId);
  const signUps = useEventSignUps(guildId, eventId);
  const removeParticipant = useRemoveParticipant(guildId, eventId);
  const replaceParticipant = useReplaceParticipant(guildId, eventId);
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState<SignUpResponse | null>(null);
  const [replacing, setReplacing] = useState<SignUpResponse | null>(null);
  const readOnly = useGuildAccess() === 'member';

  if (event.isPending) return <Loading label={t('events.loading')} />;
  if (event.error instanceof ApiRequestError && event.error.status === 404) {
    return <Notice tone="warn" title={t('eventPage.notFound')} />;
  }
  if (event.isError) return <Notice tone="bad" title={t('events.loadFailed')} />;

  const { data } = event;
  const startsAt = new Date(data.startsAt);
  const started = startsAt <= new Date();
  // Read-only members see the event and its sign-ups, without any action.
  const changeable = !readOnly && !data.cancelled && !started;

  return (
    <Page>
      <DetailHeader
        back={{ to: guildPath(guildId, 'events'), label: t('events.title') }}
        badge={t(`events.types.${data.type}`)}
        facts={[
          t('events.players', { count: data.size }),
          ...(data.series ? [everyWeekText(t, format, data.startsAt)] : []),
        ].join(' · ')}
        title={data.name}
        when={whenText(format, startsAt)}
        details={
          data.cancelled
            ? undefined
            : [
                t('eventPage.tentativeCloses', {
                  date: whenText(format, new Date(data.tentativeDeadline.at)),
                  hours: data.tentativeDeadline.hours,
                }),
              ]
        }
        description={data.description}
        actions={
          changeable && (
            <>
              <Button size="medium" to={guildPath(guildId, `events/${data.id}/edit`)}>
                {t('eventPage.edit')}
              </Button>
              <Button
                size="medium"
                tone="danger"
                onClick={() => setConfirming(true)}
                disabled={cancel.isPending}
              >
                {t('eventPage.cancel')}
              </Button>
            </>
          )
        }
        banner={
          data.cancelled
            ? {
                label: t('events.cancelled'),
                text: t('eventPage.cancelledText', {
                  date: format.dateTime(new Date(data.cancelled.at)),
                  name: data.cancelled.by ?? t('member.unknownUser'),
                }),
              }
            : undefined
        }
      />

      {readOnly && !data.cancelled && (
        <Notice tone="ok" title={t('eventPage.signUpInDiscord')}>
          {t('eventPage.signUpInDiscordHelp')}{' '}
          {data.discordPost.url && (
            <Button variant="text" href={data.discordPost.url} newTab endIcon="external">
              {t('eventPage.openPost')}
            </Button>
          )}
        </Notice>
      )}
      {data.series && !readOnly && (
        <Button variant="text" to={guildPath(guildId, `events/series/${data.series.id}`)}>
          {t('eventPage.series', { name: data.series.name })}
        </Button>
      )}
      {!data.cancelled && started && <Notice tone="warn" title={t('eventPage.started')} />}
      {cancel.error && (
        <Notice tone="bad" title={t('eventPage.cancelFailed')}>
          {apiErrorText(t, cancel.error)}
        </Notice>
      )}
      {(removeParticipant.error ?? replaceParticipant.error) && (
        <Notice tone="bad" title={t('eventPage.participantFailed')}>
          {apiErrorText(t, (removeParticipant.error ?? replaceParticipant.error)!)}
        </Notice>
      )}

      <SignUpSections
        slots={data.slots}
        signUps={signUps.data}
        actions={
          changeable
            ? {
                onRemove: setRemoving,
                onReplace: setReplacing,
                busy: removeParticipant.isPending || replaceParticipant.isPending,
              }
            : undefined
        }
        tabs={
          readOnly
            ? []
            : [
                {
                  value: 'attendance',
                  label: t('attendance.tab'),
                  content: <AttendanceTab guildId={guildId} event={data} />,
                },
                {
                  value: 'post',
                  label: t('eventPage.post.tab'),
                  content: <DiscordPostTab guildId={guildId} event={data} />,
                },
              ]
        }
      />

      <ConfirmDialog
        open={confirming}
        title={t('eventPage.cancelTitle', { name: data.name })}
        confirmLabel={t('eventPage.cancel')}
        cancelLabel={t('eventPage.keep')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          cancel.mutate();
        }}
      >
        {t('eventPage.cancelBody')}
      </ConfirmDialog>

      <ConfirmDialog
        open={removing !== null}
        title={t('eventPage.removeTitle', { name: removing?.character.name })}
        confirmLabel={t('eventPage.remove')}
        cancelLabel={t('eventPage.keepParticipant')}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          removeParticipant.mutate(removing!.id);
          setRemoving(null);
        }}
      >
        {t('eventPage.removeBody', { name: removing?.character.name })}
      </ConfirmDialog>

      <Dialog
        open={replacing !== null}
        title={t('eventPage.replaceTitle', { name: replacing?.character.name })}
        description={t('eventPage.replaceBody', { name: replacing?.character.name })}
        onClose={() => setReplacing(null)}
        actions={
          <Button size="medium" onClick={() => setReplacing(null)}>
            {t('eventPage.keepParticipant')}
          </Button>
        }
      >
        <ActionList label={t('eventPage.waitlist')}>
          {(signUps.data ?? [])
            .filter((s) => s.placement === 'waitlist' && s.role === replacing?.role)
            .map((candidate, index) => (
              <ActionList.Item
                key={candidate.id}
                title={`#${index + 1} ${candidate.character.name}`}
                detail={`${CLASS_NAMES[candidate.character.class]} · ${RACE_NAMES[candidate.character.race]}`}
                actions={
                  <Button
                    onClick={() => {
                      replaceParticipant.mutate({
                        signUpId: replacing!.id,
                        replacementId: candidate.id,
                      });
                      setReplacing(null);
                    }}
                  >
                    {t('eventPage.pick')}
                  </Button>
                }
              />
            ))}
        </ActionList>
      </Dialog>
    </Page>
  );
}
