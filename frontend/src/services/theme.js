// Colours for inline styles and charts, always taken from the CSS tokens in
// index.css so they follow the theme. col('success') is the solid colour,
// col('success', 0.15) the same colour as a tint.
export const col = (name, alpha) =>
  alpha == null ? `rgb(var(--c-${name}))` : `rgb(var(--c-${name}) / ${alpha})`

// Category colours identify data in bars and charts only — never buttons,
// headings or numbers.
export const CATEGORY_COLORS = {
  diet: col('cat-diet'), fasting: col('cat-fasting'), workout: col('cat-workout'), sleep: col('cat-sleep'),
}

// Score bands on the calendar and in charts: good / fine / caution / cost.
export function scoreTone(score) {
  if (score >= 80) return 'success'
  if (score >= 60) return 'brand'
  if (score >= 40) return 'warning'
  return 'danger'
}
export const scoreColor = (score) => col(scoreTone(score))

// ── Theme preference: 'system' (default), 'light' or 'dark' ────────────────
const KEY = 'hq-theme'
const systemDark = () => !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches

export function getThemePreference() {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}
export const resolveTheme = (pref) => (pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref)

export function applyTheme(pref) {
  const mode = resolveTheme(pref)
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(mode)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#0f1014' : '#f5f5f2')
  return mode
}
export function saveThemePreference(pref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {}
}
export function watchSystemTheme(onChange) {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  mq?.addEventListener?.('change', onChange)
}
