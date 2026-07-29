# FakeDM (Kettu / Vendetta / Bunny / Revenge)

Inject **fake local messages and calls** into a DM or group DM so you can take screenshots.  
Everything is client-side only — nothing is sent to Discord’s servers.

Ported from the Vencord “FakeDM” plugin for mobile use.

## How to use

1. Install the plugin (see below).
2. Open a **DM** or **group DM**.
3. Go to **Settings → Plugins → FakeDM → Settings** (gear icon).
4. Choose **Message** or **Call**, pick the author / caller, set a date if you want, and tap **Inject**.
5. Take your screenshot.
6. Use **Clear fakes in this channel** when you’re done.

Fake entries persist across app restarts (stored in the plugin’s storage).

## Install

You need to host the built plugin (or the source if your loader supports it) and paste the URL into  
**Settings → Plugins → +**.

### Minimal build (if you have a Vendetta-style plugin repo)

1. Drop this folder into a plugin monorepo that uses the standard Vendetta `build.mjs` / Rollup setup.
2. Build so you get something like:
   ```
   dist/FakeDM/index.js
   dist/FakeDM/manifest.json
   ```
3. Serve `dist/` over HTTPS (GitHub Pages, etc.).
4. Install URL example:
   ```
   https://your-username.github.io/your-repo/FakeDM
   ```

### Quick local test

If you only need it on your own device for screenshots, you can point a local HTTP server at a built `dist/FakeDM` folder and install that URL while on the same network.

## Notes / limitations

- **Mobile only** (Kettu, Revenge, Bunny, ShiggyCord, etc.). The original floating chat-bar panel is desktop-only and was replaced by a Settings form.
- Works in **DM (type 1)** and **group DM (type 3)** only.
- Call appearance depends on how the mobile client renders system messages of type `CALL`; if something looks off, try a different Discord version.
- Metro finders (`findByProps`, `findByStoreName`) can break after Discord updates — if inject does nothing, the stores may need updating.
- This is for personal screenshots / roleplay. Don’t use it to harass or deceive people in a harmful way.

## Files

| File | Role |
|------|------|
| `manifest.json` | Plugin metadata |
| `src/index.tsx` | Injection logic + Settings UI |

## Credits

- Original Vencord plugin by Nightcord  
- Adapted for Vendetta-family clients
