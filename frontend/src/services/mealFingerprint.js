// Deterministic meal identity: same category + same set of foods (order/portion
// ignored) always produces the same fingerprint, so recurring meals can be
// recognized regardless of how they were typed/selected each time.

export function normalizeMealItems(items) {
  return [...items]
    .map(i => (i.label || '').trim().toLowerCase())
    .filter(Boolean)
    .sort()
}

// Small non-cryptographic string hash (djb2) — good enough for identity
// matching within one user's local dataset, no dependency needed.
function hashString(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export function computeFingerprint(category, items) {
  const normalized = normalizeMealItems(items)
  return hashString(`${category}|${normalized.join('|')}`)
}
