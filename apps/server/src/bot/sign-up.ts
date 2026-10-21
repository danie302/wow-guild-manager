import {
  CLASS_NAMES,
  COMBAT_ROLE_NAMES,
  COMBAT_ROLES,
  rolesFor,
  type CombatRole,
  type Locale,
} from '@wgm/shared';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type APIActionRowComponent,
  type APIComponentInMessageActionRow,
  type ButtonInteraction,
} from 'discord.js';

import { eventPostButtonLabels } from '../domain/event-post.js';
import {
  decline,
  signUp,
  signUpContext,
  type SignUpContext,
  type SignUpRefusal,
} from '../domain/sign-ups.js';
import type { Translate } from '../i18n/index.js';
import { scheduleEventPostUpdate } from '../jobs/event-posts.js';
import type { JobEnqueuer } from '../jobs/index.js';
import type { CommandContext, ComponentHandler } from './commands/types.js';

/**
 * Custom IDs, all starting with "signup:" (each fits Discord's 100 characters):
 * - on the post: "signup:open:<event>" and "signup:decline:<event>";
 * - on the form: "signup:character:<event>:<role or ->", "signup:role:<event>:<character>",
 *   and "signup:confirmed:<event>:<character>:<role>" (or "tentative").
 */
const NAME = 'signup';
const NO_ROLE = '-';
/** Discord shows at most 25 options in a select menu. */
const MAX_OPTIONS = 25;

type Row = APIActionRowComponent<APIComponentInMessageActionRow>;

/** The Sign up and Declined buttons under an event's post, in the guild's language. */
export function eventPostButtons(eventId: string, locale: Locale): Row {
  const [signUpLabel, declinedLabel] = eventPostButtonLabels(locale);
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`${NAME}:open:${eventId}`)
        .setLabel(signUpLabel!.label)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${NAME}:decline:${eventId}`)
        .setLabel(declinedLabel!.label)
        .setStyle(ButtonStyle.Secondary),
    )
    .toJSON();
}

/**
 * The buttons on event posts and the sign-up form they open, which only the member sees. Every
 * step checks again with the current data, since the form can be answered much later. After a
 * sign-up or decline, the post's update is scheduled through `jobs`, gathered with the others
 * of the same few seconds.
 */
export function signUpHandler(jobs: JobEnqueuer): ComponentHandler {
  return {
    name: NAME,

    async button(interaction, context) {
      const [, action, eventId = '', characterId = '', role = ''] = interaction.customId.split(':');
      if (!interaction.inGuild()) return;
      if (action === 'open') await openForm(interaction, eventId, context);
      else if (action === 'decline') await declineEvent(interaction, eventId, jobs, context);
      else if (action === 'confirmed' || action === 'tentative') {
        await submit(interaction, eventId, { characterId, role, status: action }, jobs, context);
      }
    },

    async select(interaction, context) {
      const [, action, eventId = '', other = ''] = interaction.customId.split(':');
      if (!interaction.inGuild()) return;
      const value = interaction.values[0] ?? '';
      const choice =
        action === 'character'
          ? { characterId: value, role: other === NO_ROLE ? null : other }
          : { characterId: other, role: value };
      const found = await signUpContext(interaction.guildId, interaction.user.id, eventId);
      if (found.result !== 'ok') {
        await interaction.update({ content: refusal(found, context.t), components: [] });
        return;
      }
      await interaction.update(form(found, choice, context));
    },
  };
}

async function openForm(
  interaction: ButtonInteraction<'cached' | 'raw'>,
  eventId: string,
  context: CommandContext,
) {
  const found = await signUpContext(interaction.guildId, interaction.user.id, eventId);
  if (found.result !== 'ok') {
    await interaction.reply({ content: refusal(found, context.t), flags: MessageFlags.Ephemeral });
    return;
  }
  // Start from their current sign-up, or their main.
  const { current } = found;
  await interaction.reply({
    ...form(
      found,
      current
        ? { characterId: current.characterId, role: current.role }
        : { characterId: found.characters[0]!.id, role: null },
      context,
    ),
    flags: MessageFlags.Ephemeral,
  });
}

async function declineEvent(
  interaction: ButtonInteraction<'cached' | 'raw'>,
  eventId: string,
  jobs: JobEnqueuer,
  { t }: CommandContext,
) {
  const outcome = await decline(interaction.guildId, interaction.user.id, eventId);
  if (outcome.result !== 'declined') {
    await interaction.reply({ content: refusal(outcome, t), flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.reply({
    content: outcome.wasSignedUp
      ? t('signUp.withdrawn', { event: outcome.event.name })
      : t('signUp.declined', { event: outcome.event.name }),
    flags: MessageFlags.Ephemeral,
  });
  await scheduleEventPostUpdate(jobs, outcome.event.id);
}

async function submit(
  interaction: ButtonInteraction<'cached' | 'raw'>,
  eventId: string,
  choice: { characterId: string; role: string; status: 'confirmed' | 'tentative' },
  jobs: JobEnqueuer,
  { t }: CommandContext,
) {
  const role = COMBAT_ROLES.find((candidate) => candidate === choice.role);
  const outcome = role
    ? await signUp(interaction.guildId, interaction.user.id, eventId, { ...choice, role })
    : ({ result: 'role_not_allowed' } as const);
  if (outcome.result !== 'signed_up') {
    await interaction.update({ content: refusal(outcome, t), components: [] });
    return;
  }
  const details = {
    character: outcome.character.name,
    role: COMBAT_ROLE_NAMES[role!],
    event: outcome.event.name,
    status: t(`signUp.status.${choice.status}`),
  };
  await interaction.update({
    content:
      outcome.placement === 'slot' ? t('signUp.inSlot', details) : t('signUp.onWaitlist', details),
    components: [],
  });
  await scheduleEventPostUpdate(jobs, outcome.event.id);
}

/**
 * The form: a select of the member's characters, a select of the roles the chosen one's class
 * can fill, and Confirmed and Tentative buttons once a role is chosen. A role the class can't
 * fill is dropped, and a class with one role has it picked.
 */
function form(
  { event, characters, current }: SignUpContext,
  choice: { characterId: string; role: string | null },
  { t }: CommandContext,
) {
  const character =
    characters.find((candidate) => candidate.id === choice.characterId) ?? characters[0]!;
  const roles = rolesFor(character.characterClass);
  const role: CombatRole | null =
    roles.find((candidate) => candidate === choice.role) ?? (roles.length === 1 ? roles[0]! : null);

  const characterSelect = new StringSelectMenuBuilder()
    .setCustomId(`${NAME}:character:${event.id}:${role ?? NO_ROLE}`)
    .setPlaceholder(t('signUp.form.character'))
    .addOptions(
      characters.slice(0, MAX_OPTIONS).map((candidate) => ({
        label: candidate.name,
        description: candidate.isMain
          ? t('signUp.form.main', { class: CLASS_NAMES[candidate.characterClass] })
          : CLASS_NAMES[candidate.characterClass],
        value: candidate.id,
        default: candidate.id === character.id,
      })),
    );
  const roleSelect = new StringSelectMenuBuilder()
    .setCustomId(`${NAME}:role:${event.id}:${character.id}`)
    .setPlaceholder(t('signUp.form.role'))
    .addOptions(
      roles.map((candidate) => ({
        label: COMBAT_ROLE_NAMES[candidate],
        value: candidate,
        default: candidate === role,
      })),
    );
  const submitId = (status: 'confirmed' | 'tentative') =>
    `${NAME}:${status}:${event.id}:${character.id}:${role ?? NO_ROLE}`;
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(submitId('confirmed'))
      .setLabel(t('signUp.status.confirmed'))
      .setStyle(ButtonStyle.Success)
      .setDisabled(role === null),
    new ButtonBuilder()
      .setCustomId(submitId('tentative'))
      .setLabel(t('signUp.status.tentative'))
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(role === null),
  );

  const start = `<t:${Math.floor(event.startsAt.getTime() / 1000)}:F>`;
  const lines = [t('signUp.form.title', { event: event.name, time: start })];
  if (current?.placement && current.role) {
    const signedUpWith = characters.find((candidate) => candidate.id === current.characterId);
    lines.push(
      t('signUp.form.current', {
        character: signedUpWith?.name ?? '?',
        role: COMBAT_ROLE_NAMES[current.role],
        status: t(`signUp.status.${current.status}`),
      }),
    );
  }
  return {
    content: lines.join('\n'),
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(characterSelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSelect),
      buttons,
    ],
  };
}

function refusal(outcome: SignUpRefusal, t: Translate): string {
  switch (outcome.result) {
    case 'no_guild':
      return t('signUp.noGuild');
    case 'not_on_roster':
      return t('signUp.notOnRoster', { guild: outcome.guild.name });
    case 'left_discord':
      return t('signUp.leftDiscord');
    case 'event_not_found':
      return t('signUp.eventNotFound');
    case 'closed':
      return outcome.event.cancelledAt
        ? t('signUp.cancelled', { event: outcome.event.name })
        : t('signUp.started', { event: outcome.event.name });
    case 'not_eligible':
      return t('signUp.notEligible', { event: outcome.event.name });
    case 'no_characters':
      return t('signUp.noCharacters');
    case 'not_your_character':
      return t('signUp.notYourCharacter');
    case 'role_not_allowed':
      return t('signUp.roleNotAllowed');
  }
}
