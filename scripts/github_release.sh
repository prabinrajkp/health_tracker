#!/usr/bin/env bash
# Publishes a GitHub Release for an existing tag and attaches the APK.
#
#   scripts/github_release.sh <tag> <apk-file> <notes-file>
#
# Safe to run twice: an existing release for the tag is reused, and an asset
# that is already attached is left alone. The token comes from git's own
# credential store for this repo and is never printed.
set -euo pipefail

TAG="${1:?tag, e.g. v4.34}"
APK="${2:?path to the APK}"
NOTES="${3:?path to a text file with the release notes}"

[ -f "$APK" ]   || { echo "APK not found: $APK" >&2; exit 1; }
[ -f "$NOTES" ] || { echo "Notes file not found: $NOTES" >&2; exit 1; }

REMOTE="$(git config --get remote.origin.url)"
REPO="$(printf '%s' "$REMOTE" | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')"
case "$REPO" in */*) ;; *) echo "Could not work out owner/repo from: $REMOTE" >&2; exit 1 ;; esac

TOKEN="$(printf 'protocol=https\nhost=github.com\npath=%s.git\n\n' "$REPO" \
  | GIT_TERMINAL_PROMPT=0 git credential fill 2>/dev/null | sed -n 's/^password=//p')"
[ -n "$TOKEN" ] || { echo "No GitHub token found in git's credential store for $REPO" >&2; exit 1; }

API="https://api.github.com/repos/$REPO"
api() {  # api METHOD URL [curl args…]  → prints body, then the HTTP status on the last line
  local method="$1" url="$2"; shift 2
  curl -sS -X "$method" "$url" -w '\n%{http_code}' \
    -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" "$@"
}
body()   { sed '$d'; }
status() { tail -n 1; }

# The tag must already be on GitHub — a release must never create one.
git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null \
  || { echo "Tag $TAG is not on GitHub yet. Push it first." >&2; exit 1; }

RESP="$(api GET "$API/releases/tags/$TAG")"
if [ "$(printf '%s' "$RESP" | status)" = "200" ]; then
  echo "Release for $TAG already exists — reusing it."
else
  PAYLOAD="$(jq -n --arg tag "$TAG" --arg name "Health Quest $TAG" --rawfile body "$NOTES" \
    '{tag_name: $tag, name: $name, body: $body, draft: false, prerelease: false}')"
  RESP="$(api POST "$API/releases" -d "$PAYLOAD")"
  CODE="$(printf '%s' "$RESP" | status)"
  if [ "$CODE" != "201" ]; then
    echo "Creating the release failed (HTTP $CODE): $(printf '%s' "$RESP" | body | jq -r '.message // .' 2>/dev/null)" >&2
    [ "$CODE" = "403" ] || [ "$CODE" = "404" ] && echo "The token needs 'Contents: Read and write' on this repository." >&2
    exit 1
  fi
  echo "Created release $TAG."
fi

RELEASE="$(printf '%s' "$RESP" | body)"
RELEASE_ID="$(printf '%s' "$RELEASE" | jq -r '.id')"
HTML_URL="$(printf '%s' "$RELEASE" | jq -r '.html_url')"
NAME="$(basename "$APK")"

if printf '%s' "$RELEASE" | jq -e --arg n "$NAME" '.assets[]? | select(.name == $n)' >/dev/null; then
  echo "$NAME is already attached."
else
  UP="$(api POST "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=$NAME" \
    -H "Content-Type: application/vnd.android.package-archive" --data-binary @"$APK")"
  CODE="$(printf '%s' "$UP" | status)"
  [ "$CODE" = "201" ] || { echo "Uploading $NAME failed (HTTP $CODE): $(printf '%s' "$UP" | body | jq -r '.message // .' 2>/dev/null)" >&2; exit 1; }
  echo "Attached $NAME ($(printf '%s' "$UP" | body | jq -r '.size') bytes)."
fi

echo "Release: $HTML_URL"
