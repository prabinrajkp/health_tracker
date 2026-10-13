# In-App Update — Feasibility and Plan

Can Health Quest check GitHub for a newer version, download it and update itself, all from inside the app?

**Status:** planning only. Nothing here is implemented.

---

## Verdict

**Yes, it is feasible, with one limit Android does not let us remove:** the app can find, download and launch the update by itself, but the user must tap **Install** on a system prompt. A sideloaded app cannot replace itself silently.

So the realistic experience is:

> "Version 4.34 is available" → tap **Update** → progress bar → Android's install prompt → tap **Install** → app reopens on the new version, data intact.

That is two taps instead of today's routine of opening the download page, downloading, finding the file and installing it.

Two things in the current project would break updates and must be fixed first. They are in section 3, and one of them needs a decision from you.

---

## 1. What "update" can mean

There are two different mechanisms. They are not alternatives so much as two layers.

| | A. Full APK update | B. Web-bundle update |
|---|---|---|
| What is replaced | The whole app | Only the web part (screens, logic, styles) |
| User sees | Android install prompt | Nothing; applied on next launch |
| Covers native changes (widget, plugins, permissions) | Yes | No |
| Needs new Android permission | Yes (install packages) | No |
| Complexity | Moderate, one small native plugin | Higher: bundle storage, switching, rollback |
| Risk if it goes wrong | Install fails, old version stays | A bad bundle can leave the app unable to start unless rollback is built |

**Recommendation: build A.** It covers every kind of release, including the native ones, and its failure mode is safe: if anything goes wrong the old version is still installed. B is a possible later addition for small fixes, and is out of scope for this plan.

---

## 2. How A works, end to end

1. **Check.** The app fetches a small version file from the GitHub Pages site and compares it with its own version.
2. **Offer.** If a newer version exists, the app shows the version number and its release notes.
3. **Download.** On tap, native code downloads the APK into the app's private cache, with progress.
4. **Verify.** The app checks the file's size and SHA-256 against the version file.
5. **Permission.** The first time, Android asks the user to allow Health Quest to install apps. This is a one-time system setting.
6. **Install.** The app hands the file to Android's installer. The user taps Install.
7. **Relaunch.** Android replaces the app and keeps all its data. On next open, the app clears the downloaded file.

Android checks at step 6 that the new APK is signed with the same key as the installed one and has an equal or higher version code. If either fails, it refuses, and the old app is untouched.

---

## 3. What has to be fixed first

### 3.1 The Android version number never changes

`frontend/android/app/build.gradle` has `versionCode 4` and `versionName "1.3"`. They have not moved while the app went from 4.0 to 4.33. Only `package.json` and the APK file name carry the real version.

Android compares `versionCode` to decide whether an install is an upgrade. With every build at 4, upgrades happen to work, but the app has no reliable native version, and Android would not block an accidental downgrade.

**Fix:** derive both values from the release version in the release protocol, for example 4.34 → `versionName "4.34"`, `versionCode 40034`. The code must only ever go up.

### 3.2 The app is signed with this laptop's debug key

Releases are debug builds, signed with `~/.android/debug.keystore` on the machine that built them. Android only accepts an update signed with the **same key** as the installed app.

What that means in practice:

- If that file is lost, or a release is ever built on another machine, the new APK will not install over the old one. Every user would have to uninstall first, which **deletes all their data**.
- An in-app updater makes this worse, not better: it would download a file that then fails at the last step with an unhelpful system error.

**Fix:** create a proper release keystore, back it up somewhere safe outside the repo, and sign every release with it.

**The catch:** the first build signed with the new key cannot install over existing debug-signed installs. Everyone already using the app must, once: export a JSON backup, uninstall, install the new build, import the backup. This is a one-time cost, and the sooner it is paid the fewer people it touches. See the decision in section 9.

### 3.3 There is no machine-readable "latest version"

The download page has the version in its HTML and the APK name changes each release. The repo has git tags but no GitHub Releases, so GitHub's "latest release" API has nothing to return.

**Fix:** publish a small `version.json` next to `index.html` on GitHub Pages, written by the release protocol:

```json
{
  "version": "4.34",
  "versionCode": 40034,
  "apk": "health-quest-v4.34-debug.apk",
  "size": 8164788,
  "sha256": "…",
  "released": "2026-10-20",
  "minAndroid": 26,
  "notes": ["Short line per change, from the changelog"]
}
```

A static file on Pages has no API rate limit and needs no token. The GitHub API alternative works too, but is limited to 60 unauthenticated requests an hour per network and would require creating Releases.

---

## 4. Technical pieces

| Piece | Where | Notes |
|---|---|---|
| `version.json` | repo root, served by Pages | Generated in the release protocol, including the SHA-256 of the APK |
| Version check | new `services/appUpdate.js` | Fetch, compare numerically (4.9 is older than 4.10), cache the result |
| Native plugin `AppUpdate` | new Java file beside the existing `UsageStatsPlugin.java` | Methods: current version, download with progress, can-install check, open the permission screen, start install |
| Install permission | `AndroidManifest.xml` | Add `REQUEST_INSTALL_PACKAGES` |
| File sharing | already present | The manifest already declares a `FileProvider`, which the installer needs. Its paths file needs one cache entry |
| UI | Settings → About, plus a quiet indicator | Section 6 |
| Release protocol | `.claude/commands/release.md` | Bump the Gradle version, write `version.json`, sign with the release key |

**Why the download must be native.** The APK is about 8 MB. Fetching it in the web layer would be subject to cross-origin rules and would have to pass the whole file across the web-to-native bridge as text. A native download streams straight to disk and reports progress.

**To verify during implementation:** that GitHub Pages serves `version.json` with headers that let the app's web layer read it. If it does not, the check moves into the native plugin as well, which is a small change.

---

## 5. Limits that cannot be engineered away

- **The Install tap.** Required for any app installed outside a store. Newer Android versions allow prompt-free updates in narrow cases for the app that performed the original install; that may apply after the first in-app update, but it is not something to plan around. Treat it as a possible later improvement to investigate.
- **"Install unknown apps" permission.** A one-time system screen, per app. The app can open it but cannot grant it.
- **Play Protect.** May show its own warning for an app it does not recognise, as it does today.
- **It needs internet.** See section 7.
- **The app cannot update while it is not installed correctly.** If the signature does not match (section 3.2), nothing in the app can recover that.

---

## 6. Proposed experience

- **Where it lives:** Settings → About, next to the version number: "Check for updates", with the result shown inline ("You're on the latest version" or "4.34 available").
- **How the user finds out:** a small dot on the Profile gear icon when an update is known. No pop-up on launch, no notification by default. This keeps to the app's current rule of not interrupting.
- **The update sheet:** version, date, size, the release notes, and one **Update** button. While downloading: a progress bar and Cancel.
- **Skip:** "Not now" hides the dot for that version until the next one.
- **After updating:** a one-line "Updated to 4.34" with a link to what changed.

---

## 7. Privacy and the offline promise

The app's pitch is that it works offline and sends nothing anywhere. An update check is the first feature that contacts a server without the user adding an API key, so it should be handled deliberately:

- The check is a plain download of a public file. It sends no user data, no identifier and no version of the user's data. GitHub will see the phone's IP address, as any web request does.
- **Recommended default:** check automatically at most once a day when the app is opened and a connection exists, with a switch in Settings to turn automatic checks off. Manual checking always works.
- If offline, the check fails silently and the app behaves exactly as today.
- The download page's wording ("no internet needed") stays true, but should gain a line saying the app can check for updates and that this can be switched off.

---

## 8. Failure cases to design for

| Case | Behaviour |
|---|---|
| No connection, or GitHub unreachable | Silent on automatic checks; a plain message on manual checks |
| `version.json` malformed or missing fields | Treated as "no update"; never crash |
| Download interrupted | Delete the partial file; offer Retry |
| Size or SHA-256 mismatch | Delete the file, refuse to install, say the download was corrupted |
| Not enough storage | Detect before downloading, using the size from `version.json` |
| User denies the install permission | Explain once, and offer "Open download page" as the fallback |
| User cancels the system prompt | Keep the file so a second tap does not re-download |
| Signature mismatch at install | Android shows its own error. The app should then show the backup-and-reinstall steps |
| Phone's Android older than `minAndroid` | Do not offer the update |
| Update published but faulty | Republish with a higher version. The app never downgrades |
| Old downloaded APKs | Cleared on next launch after a successful update |

**On the SHA-256:** it guards against a corrupted or truncated download. It does not protect against someone who has taken over the GitHub account, since they could change the hash too. Android's signature check is what protects against a tampered APK, which is another reason section 3.2 matters.

---

## 9. Decisions needed before implementation

| Decision | Recommendation | Why |
|---|---|---|
| Move to a release signing key, accepting one manual reinstall for existing users? | **Yes, before building the updater** | Without it, one lost file or a new laptop ends all updates and costs every user their data |
| Where does the version come from? | `version.json` on GitHub Pages | No rate limit, no token, and the release protocol already writes to that folder |
| Automatic checks? | On, once a day, with an off switch | Most users will never think to check manually |
| Create GitHub Releases as well as tags? | Optional, not required for this | Useful for people browsing GitHub, but the app would not depend on it |
| Keep "debug" in the APK name? | Drop it once builds are release-signed | The name would no longer be accurate |

---

## 10. Phases

| Phase | Work | Outcome |
|---|---|---|
| 0. Foundations | Real `versionCode` and `versionName` from the release protocol; release keystore and signing; `version.json` generated on release; one-time migration notes for existing users | Releases become updatable in principle. Nothing visible in the app |
| 1. Check and notify | Version check, the dot on the gear, the About row, a button that opens the download page | Users learn about updates inside the app. No new permission yet |
| 2. Download and install | Native plugin, install permission, progress, verification, the update sheet | The full two-tap update |
| 3. Polish | Release notes in the sheet, "Updated to" message, auto-check switch, cleanup of old files | Finished feature |

Phase 1 is worth shipping by itself: it removes the "I didn't know there was a new version" problem with almost no risk.

**Rough size:** Phase 0 is mostly release-protocol and build changes. Phase 1 is small and web-only. Phase 2 is the bulk: one native plugin of a few hundred lines plus the sheet. Phase 3 is small.

---

## 11. Testing

This cannot be tested in a browser. It needs a real phone and at least two published versions.

- Install version N, publish N+1, update from inside the app, confirm all data is intact (logs, scores, badges, settings, sleep timer state).
- Repeat on the oldest supported Android (8.0) and a current one, since the install permission flow differs between versions.
- Deny the permission, cancel the prompt, cut the connection mid-download, and fill the storage, and confirm each case in section 8.
- Publish a `version.json` with a wrong hash and confirm the install is refused.
- Confirm an APK signed with a different key is rejected and the app shows the recovery steps.
- Confirm that with automatic checks off, the app makes no network request on launch.

---

## 12. Out of scope

- Silent or background updates.
- Web-bundle (over-the-air) updates.
- Publishing to the Play Store, which would replace all of this with the store's own updater but brings its own review and policy requirements.
- Forced updates. The app should never refuse to open because it is out of date.
