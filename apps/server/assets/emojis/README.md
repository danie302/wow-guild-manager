# Event post icons

The Discord event posts show a class icon next to each character, and an icon for each role. They're the bot application's own emojis, uploaded from this folder:

1. Put one image per class and role here, named after it: `druid.png`, `hunter.png`, `mage.png`, `paladin.png`, `priest.png`, `rogue.png`, `shaman.png`, `warlock.png`, `warrior.png`, and optionally `tank.png`, `healer.png`, `dps.png`. PNG, JPEG, or GIF, up to 256 KB; 128×128 looks sharp.
2. Run `docker compose exec api pnpm --filter @wgm/server discord:emojis`. It uploads the ones your Discord application doesn't have yet, as `wgm_<name>`.
3. Posts pick them up within the hour (or restart the worker and api). Until then, classes show no icon and roles show 🛡️ ➕ ⚔️.

The images aren't in the repository (the official class icons belong to Blizzard), so each developer adds their own. You can also see and delete the emojis on the **Emojis** page of your application in the Discord Developer Portal.
