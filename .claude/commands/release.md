# Health Quest — Release

Perform a full versioned release: bump the version, update the changelog and every version reference, build the APK, commit, tag and push to GitHub, then publish a GitHub Release with the APK attached. Only the two newest APK files are kept on disk.

A release is not finished until the commit, the tag and the GitHub Release are all on GitHub. Building locally and stopping there is a failed release.

**User-provided changelog description (what changed in this release):**
$ARGUMENTS

---

## Instructions

Follow every step in order. Do not skip any step. Do not ask for confirmation between steps unless a step explicitly says to.

---

### Step 0 — Check GitHub is reachable

Before changing any file, run:

```bash
git ls-remote --exit-code origin HEAD
```

If it fails, stop here and tell the user GitHub cannot be reached. Do not bump the version or build: a release that cannot be pushed leaves the repo ahead of GitHub and the download page pointing at an APK that is not there.

Also confirm the working tree is on `main` and not behind it: `git status -sb`. If the branch is behind `origin/main`, stop and tell the user.

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

1. **Check the tag is free.** Run `git tag -l NEW_VERSION`, then `git ls-remote --tags origin NEW_VERSION`. If either prints anything, stop and tell the user the tag already exists. Never move or overwrite a release tag. If `git ls-remote` itself fails (exit code other than 0), that is a connection problem, not a free tag: stop.
2. **Stop tracking the previous APK.** It stays on disk but leaves the repo:
   ```bash
   git rm --cached --ignore-unmatch health-quest-CURRENT_VERSION-debug.apk
   ```
   Do this before the cleanup in Step 9, and never delete an APK that git still tracks.
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
7. **Verify both arrived.** The branch and the tag are checked separately, because one can be pushed without the other:
   ```bash
   git ls-remote origin refs/heads/main      # must print the hash from: git rev-parse HEAD
   git ls-remote --tags origin NEW_VERSION   # must print the tag
   ```
   If the branch is there but the tag is not, push the tag alone with `git push origin NEW_VERSION` and verify again.

**If the push fails:**

- **Network error** (cannot resolve host, timeout, connection reset): wait 20 seconds and try again, up to three attempts in total. These are transient and safe to retry.
- **Anything else** (rejected, authentication, permission): do not retry and do not change the remote. Show the error.

If it still has not gone through, the release is **not done**. Skip Steps 8 and 9, say clearly in the summary that the commit and tag exist only on this machine, and give the user the command to finish: `git push origin HEAD --follow-tags`. When the user says the connection is back, resume from this step — do not start a new release.

---

### Step 8 — Publish the GitHub Release

Run this only after Step 7 has verified the tag is on GitHub.

1. Write the release notes to a temporary file in the scratchpad directory (not in the repo): the changelog bullets from Step 3 as Markdown, with their `### Added` / `### Changed` / `### Fixed` headings.
2. Publish:
   ```bash
   scripts/github_release.sh NEW_VERSION health-quest-NEW_VERSION-debug.apk <notes-file>
   ```
   It creates the release for the tag, attaches the APK, and prints the release URL. It is safe to run again: an existing release or an already-attached APK is reused.
3. It must end with a line starting `Release:`. Keep that URL for the summary.

If it fails, show its error and continue to the summary without Step 9. The tag and the download page are already live, so users can still get the APK; only the Releases page is missing. A `403` or `404` means the stored token lacks "Contents: Read and write" on this repository.

The script reads the token from git's credential store for this repo. Never print the token, pass it on a command line, or write it to a file.

---

### Step 9 — Keep only the last two APKs

Run this only after the push in Step 7 has been verified and Step 8 has attached the APK to the release. If the build, the push or the release failed, skip it, so an older working APK is never removed while the new one is in doubt.

The project root keeps two APK files: the one just released (`NEW_VERSION`) and the one before it (`CURRENT_VERSION`), as a fallback to reinstall. Delete every older one. They are ignored by git, so this only frees local disk space and changes nothing on GitHub, where every release still has its tag.

1. List what would be deleted, sorted by version so that `v4.9` comes before `v4.10`:
   ```bash
   ls health-quest-v*-debug.apk | sort -V | head -n -2
   ```
2. Check the list. It must not contain `NEW_VERSION` or `CURRENT_VERSION`. If it does, stop and tell the user.
3. Delete exactly those files:
   ```bash
   ls health-quest-v*-debug.apk | sort -V | head -n -2 | xargs -r -d '\n' rm -v
   ```
4. Confirm with `ls health-quest-v*-debug.apk` that exactly two files remain (or one, on a first release), and that `git status --short` shows no deleted APK.

---

### Step 10 — Summary


Print a short release summary:

```
Released NEW_VERSION (CURRENT_VERSION → NEW_VERSION)
APK: health-quest-NEW_VERSION-debug.apk (SIZE)

Changelog:
[paste the bullet points written in Step 3]

Release: [the URL printed in Step 8]
Download page: https://prabinrajkp.github.io/health_tracker

Install:
  adb install health-quest-NEW_VERSION-debug.apk

Kept on disk: health-quest-NEW_VERSION-debug.apk, health-quest-CURRENT_VERSION-debug.apk
Removed: [the older APK files deleted in Step 9, or "none"]
```

If the push in Step 7 failed, replace the Release line with: `NOT on GitHub — commit and tag exist only on this machine`, followed by the command to finish. If only Step 8 failed, say the tag is pushed but the GitHub Release was not created, and why.
