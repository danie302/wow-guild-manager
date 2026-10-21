# Story 013: Guild settings page and profile

**Status:** Not started  
**Phase:** Access and guild  
**Depends on:** [Story 012](story-012-guild-creation.md)

## Goal

Build the guild settings page that later stories add sections to, with the guild's name and image as its first section.

## Scope

- The guild settings page (screen 12 in `docs/design/`): sections, and one Save bar for the whole page with "Unsaved changes", Discard, and "All changes saved" states.
- Editing the guild name.
- Uploading the guild image through a storage interface (save, read, delete) that writes to a Docker volume in development.
- Showing the name and image in the app header.

## Acceptance criteria

- [ ] Changes on the guild settings page apply only when Save is pressed. Discard restores the saved values. Save is disabled when nothing changed or a value is invalid.
- [ ] Leaving the page with unsaved changes asks for confirmation.
- [ ] Sections the current user can't edit are shown read-only.
- [ ] The Guild Master can change the guild name, with the same rules as when creating the guild (1 to 50 characters, no offensive words).
- [ ] The Guild Master can upload a PNG, JPEG, or WebP image up to the size limit. Other file types and larger files are rejected with a clear message.
- [ ] Officers get 403 when trying to edit the profile.
- [ ] The new name and image appear in the app header.
- [ ] The image is stored through the storage interface, and nothing outside it knows where files are kept. A test uses an in-memory implementation.
- [ ] Uploaded images survive restarts of the containers.


## Technical debt

None.
