# Story 046: Mention a Guild Member role in missing-role alerts

**Status:** Done with debt  
**Phase:** Events  
**Depends on:** [Story 027](story-027-missing-role-alerts.md), [Story 044](story-044-single-missing-role-alert.md)

## Goal

Make the missing-role alert mention one Discord role (the guild's Guild Member role) instead of tagging each member who could fill a role, which makes the alert long and noisy.

## Scope

- A Guild Member role in the guild settings, chosen by the Guild Master (optional).
- The alert lists each missing role and mentions the Guild Member role once, at the end.
- Without a Guild Member role, the alert mentions nobody.

## Out of scope

- Mentioning different roles per combat role (Discord can't mention a role for only the members who can fill a combat role).
- Using the Guild Member role for anything else, such as access to the web app.

## Acceptance criteria

- [x] The guild settings have an optional Guild Member role, in the Discord section, which only the Guild Master can change.
- [x] Only roles the bot can mention are listed: roles set as mentionable in Discord, or any role when the bot has the permission to mention all roles. `@everyone` and roles managed by integrations aren't listed. The API rejects any other role with a validation error code.
- [x] Changing the guild's Discord server clears the Guild Member role.
- [x] The alert lists each role that's missing players ("4 Tanks still needed") and ends with a mention of the Guild Member role, which is the only mention Discord delivers.
- [x] Without a Guild Member role, the alert is posted without mentions.
- [x] Every new string has English and Spanish translations.

## Notes

- Decided on 2026-11-02: one mention of the role, at the end of the alert. No role means no mentions (not the old per-member mentions). Only the Guild Master chooses it, and the picker lists only roles the bot can mention.
- Data: a nullable `member_role_id` column on `guilds`, with a migration.
- The bot can mention a role when the role is mentionable, or when its own server permissions include Mention Everyone (or Administrator). Channel overwrites can also take that permission away, but they aren't checked.
- The alert's message sets `allowed_mentions` to exactly that role, so nothing else is notified.
- New permission action `chooseMemberRole` (Guild Master only), with a test row.
- The bot's invite link (`src/integrations/discord/invite.ts`) also asks for **Mention @everyone, @here, and All Roles**, so any role can be the Guild Member role. `README.md` lists it in the bot setup, and `docs/deployment.md` says how to give it to a bot that was invited before.

## Technical debt

- Verified with tests only (server, web, and the worker against a fake Discord). The mention in a real Discord server and the picker in a browser haven't been tried yet.
- If someone later makes the role not mentionable, or takes the bot's permission away, the saved role stays and the alert's mention doesn't notify anyone. Guild settings doesn't warn about it.
- Channel overwrites that take away the bot's permission to mention all roles in the alert's channel aren't checked.
