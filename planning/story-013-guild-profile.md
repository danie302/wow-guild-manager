# Story 013: Guild settings page and profile

**Status:** Done with debt  
**Phase:** Access and guild  
**Depends on:** [Story 012](story-012-guild-creation.md)

## Goal

Build the guild settings page that later stories add sections to, with the guild's name and image as its first section.

## Scope

- The guild settings page (screen 12 in `docs/design/`): sections, and one Save bar for the whole page with "Unsaved changes", Discard, and "All changes saved" states.
- Editing the guild name.
- Uploading the guild image through a storage interface (save, read, delete) that writes to a Docker volume in development.
- Showing the name and image in the app header.
- The Discord section: the connected server and the Officer role, which the Guild Master can change (the API for it came with story 012).

## Acceptance criteria

- [x] Changes on the guild settings page apply only when Save is pressed. Discard restores the saved values. Save is disabled when nothing changed or a value is invalid.
- [x] Leaving the page with unsaved changes asks for confirmation.
- [x] Sections the current user can't edit are shown read-only.
- [x] The Guild Master can change the guild name, with the same rules as when creating the guild (1 to 50 characters, no offensive words).
- [x] The Guild Master can upload a PNG, JPEG, or WebP image up to the size limit. Other file types and larger files are rejected with a clear message.
- [x] Officers get 403 when trying to edit the profile.
- [x] The new name and image appear in the app header.
- [x] The image is stored through the storage interface, and nothing outside it knows where files are kept. A test uses an in-memory implementation.
- [x] Uploaded images survive restarts of the containers.


## Notes

- Images are cropped square, resized to 256×256, and re-encoded as WebP with sharp, which drops metadata. Uploads are PNG, JPEG, or WebP up to 5 MB.
- **The page saves everything in one request:** `PATCH /api/guilds/:guildId` as multipart/form-data (read with multer), with only the changed fields (`name`, `image`, `removeImage`, `discordServerId`, `officerRoleId`). Every change is checked first and then saved in one update, so either all of them apply or none does. Each change needs its own permission. This replaced separate requests for the name, image, and Discord connection.
- Images are served by `GET /api/guilds/:guildId/image` to people who can open the guild. Each upload gets a new storage key, which is part of the URL, so browsers can cache an image for good.
- Officers see the page read-only; there's no Save bar for them.
- The design's server row names the Discord server's owner. The page says instead that owning the server doesn't make someone the Guild Master, without reading the owner's name from Discord.

## Technical debt

- The new image file is stored before the database update and deleted if the update fails. If the process dies between the two, the file is left in storage unused.
