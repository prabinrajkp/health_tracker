# Health Quest — Release

Perform a full versioned release: bump the version, update the changelog and every version reference, build the APK, then commit, tag the release and push it to GitHub.

**User-provided changelog description (what changed in this release):**
$ARGUMENTS

---

## Instructions

Follow every step in order. Do not skip any step. Do not ask for confirmation between steps unless a step explicitly says to.

---

### Step 1 — Read the current version

Read `CHANGELOG.md`. Find the **first** `## [vX.Y]` heading. Extract the version number (e.g. `2.15`). The new version is that number with the decimal part incremented by 1 (e.g. `2.15` → `2.16`). Store both as:
- `CURRENT_VERSION` = e.g. `v2.15`
- `NEW_VERSION` = e.g. `v2.16`

Also note `TODAY` in the format `YYYY-MM-DD` using the current date.

---

### Step 2 — Validate the changelog description

If `$ARGUMENTS` is empty or fewer than 5 words, stop and tell the user:

> Please re-run `/release` followed by a description of what changed. Example:
> `/release Fixed sleep card not showing after waking up`

Otherwise continue.

---

### Step 3 — Parse the description into changelog sections

Analyse the description in `$ARGUMENTS`. Categorise each item into one or more of these standard sections (only include sections that apply):

- **Added** — new features or UI
- **Changed** — behaviour changes, redesigns, refactors visible to the user
- **Fixed** — bug fixes

Write bullet points in the same style as existing CHANGELOG entries:
- Start with a **bold short label** (e.g. `**Sleep summary card**`)
- Follow with a concise description of what changed and why it matters to the user
- Keep technical detail brief; focus on the user-visible effect

If the description clearly separates multiple distinct fixes or features, write a bullet per item. If it is one coherent change, write one bullet.

---

### Step 4 — Update `CHANGELOG.md`

Insert a new version block immediately after the `# Changelog — Health Quest` header line and before the first `---` divider. Use this exact format (replace placeholders):

```
## [NEW_VERSION] — TODAY

### Added / Changed / Fixed
- **Label** — description

---
```

Only include section headings (`### Added`, `### Changed`, `### Fixed`) that actually have bullets. Do not add empty sections.

Read the file first, then use Edit to insert the new block at the correct location so no existing content is removed.

---

### Step 5 — Update every version reference

The version appears in five files. Update all of them, using Edit with exact old strings so nothing else changes. In each case replace `CURRENT_VERSION` with `NEW_VERSION`.

1. **`build_apk.sh`** — the line that starts with `APK_OUT=`. Example:
   ```
   APK_OUT="$ROOT/health-quest-v2.15-debug.apk"
   ```
   becomes:
   ```
   APK_OUT="$ROOT/health-quest-v2.16-debug.apk"
   ```
2. **`frontend/package.json`** — the `"version"` field, as `X.Y.0` without the `v` (e.g. `"version": "2.16.0"`). The app shows this number in Settings, so it must change before the build.
3. **`.gitignore`** — the line `!health-quest-CURRENT_VERSION-debug.apk`. Only the newest APK is tracked in git; this line is what un-ignores it.
4. **`index.html`** (the download page) — every `CURRENT_VERSION` (both download buttons, the install step and the `adb install` note), and the `Released D Mon YYYY` date in the header line, set to today.
5. **`README.md`** — every `health-quest-CURRENT_VERSION-debug.apk`.

Afterwards run `grep -rn "CURRENT_VERSION" build_apk.sh .gitignore index.html README.md` (with the real version). It must print nothing.

---

### Step 6 — Build the APK

Run:
```bash
bash build_apk.sh 2>&1
```

Stream the full output. After it completes:

- If `BUILD SUCCESSFUL` appears and the APK file exists → report success with the file path and size.
- If `BUILD FAILED` or the APK file is missing → show the last 60 lines of output and stop. Do **not** attempt to fix Gradle or Android SDK issues automatically; tell the user what failed.

---

### Step 7 — Commit, tag and push

Every release gets a git tag on GitHub named exactly `NEW_VERSION` (e.g. `v2.16`), pointing at the commit that contains that APK. Run these in order and stop at the first failure.

1. **Check the tag is free.** Run `git tag -l NEW_VERSION` and `git ls-remote --tags origin NEW_VERSION`. If either prints anything, stop and tell the user the tag already exists. Never move or overwrite a release tag.
2. **Stop tracking the previous APK.** It stays on disk but leaves the repo:
   ```bash
   git rm --cached --ignore-unmatch health-quest-CURRENT_VERSION-debug.apk
   ```
3. **Stage and review.** Run `git add -A`, then `git status --short`. The new APK must be listed. If anything unexpected is listed (secrets, `.env` files, local databases, personal documents), stop and ask the user.
4. **Commit**, with a conventional message and no co-author or attribution lines:
   ```bash
   git commit -m "release: NEW_VERSION" -m "<the changelog bullets from Step 3, as plain text>"
   ```
5. **Tag** the commit with an annotated tag carrying the same notes:
   ```bash
   git tag -a NEW_VERSION -m "Health Quest NEW_VERSION" -m "<the changelog bullets from Step 3, as plain text>"
   ```
6. **Push the commit and the tag together:**
   ```bash
   git push origin HEAD --follow-tags
   ```
7. **Verify** with `git ls-remote --tags origin NEW_VERSION`. It must print the tag.

If the push fails (for example, missing credentials), do not retry or change the remote. The commit and tag exist locally; show the error and tell the user to run `git push origin HEAD --follow-tags` themselves.

---

### Step 8 — Summary


Print a short release summary:

```
Released NEW_VERSION (CURRENT_VERSION → NEW_VERSION)
APK: health-quest-NEW_VERSION-debug.apk (SIZE)

Changelog:
[paste the bullet points written in Step 3]

Tag: NEW_VERSION — https://github.com/prabinrajkp/health_tracker/releases/tag/NEW_VERSION
Download page: https://prabinrajkp.github.io/health_tracker

Install:
  adb install health-quest-NEW_VERSION-debug.apk
```

If the push in Step 7 failed, say so in place of the Tag line.
