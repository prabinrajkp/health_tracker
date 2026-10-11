# Health Quest — UI Critique and Rectification Plan (v4.29)

A designer's review of how the app looks: the colours in both modes, the UI elements, and the use of space. It responds to two pieces of feedback:

- "Some screens look AI-generated. The soul of a UI designer is missing."
- "Dark mode is very disturbing to the eye."

**How this was done.** I rendered all 12 screens in dark and light mode at phone size (390 × 844) with realistic data, measured the contrast of every piece of text against its real background, and counted the colours, sizes, radii and icons in the code. This was a headless browser, not a phone, so fonts and emoji will differ slightly on a real device.

The revamp in v4.29 fixed *what* is on each screen. This document is about *how it looks*, which the revamp did not touch.

---

## Verdict

Both complaints are correct, and they have the same root cause: **the app has a theme, but not a design system.** Colours, sizes and shapes were chosen screen by screen, so nothing carries a consistent meaning.

- **Dark mode is tiring because everything is purple.** The background, cards, borders and even the text are all the same saturated violet hue. There is no neutral anywhere for the eye to rest, and six bright accent colours sit on top of it.
- **It looks generated because it uses the default look of generated UIs:** violet-on-near-black, glowing gradient buttons, every block in an identical rounded bordered card, emoji as icons, tiny uppercase labels, and rainbow stat tiles.
- **Light mode is easier on the eye but is actually less readable.** More of its text fails contrast than in dark mode.

---

## 1. Colour

### 1.1 Dark mode: one hue, no neutrals

Every structural colour in dark mode sits at hue 246–255 with 51–59% saturation:

| Token | Value | Hue / saturation / lightness |
|---|---|---|
| Page background | `10 8 28` | 246° / 56% / 7% |
| Card | `20 13 50` | 251° / 59% / 12% |
| Raised tile | `32 20 72` | 254° / 57% / 18% |
| Border | `52 34 105` | 255° / 51% / 27% |
| Primary text | `240 237 255` | 250° / **100%** / 96% |
| Secondary text | `180 165 230` | 254° / 57% / 77% |
| Muted text | `110 92 165` | 255° / 29% / 50% |

What that does:

- **No resting place.** A dark UI normally uses near-neutral greys so that colour means something. Here the "grey" is purple, the borders are purple, and the body text is lavender.
- **Purple outlines everywhere.** Cards are almost the same brightness as the page, so the purple border does all the work of separating them. Every card, tile, pill and input is drawn with a purple line, which makes the screen look like a glowing wireframe.
- **Accents vibrate.** Saturated orange, green, cyan and amber on a saturated violet field is a known source of eye strain. The Today screen alone uses six hues: orange score, amber grade pill, green, orange, cyan and violet bars.
- **The muted text is too dim.** It measures **3.3 : 1** on a card and **3.0 : 1** on a raised tile. The accessibility minimum for body text is 4.5 : 1. This is the colour used for most labels, hints and units.

### 1.2 Light mode: calmer, but worse for reading

| Colour | On card | Needs | Result |
|---|---|---|---|
| Muted text | 3.4 : 1 | 4.5 | Fails |
| Success green | 3.3 : 1 | 4.5 | Fails |
| Warning amber | 3.2 : 1 | 4.5 | Fails |
| Info blue | 4.1 : 1 | 4.5 | Fails |
| Danger red | 4.8 : 1 | 4.5 | Passes |

The green and amber are used for small text such as "+3 pts", "7+ hour target met" and "Logged". On white they are hard to read outdoors.

Light mode is also still tinted violet (lavender page, lavender tiles, lavender borders), so it has the same "one hue" character, just paler.

### 1.3 Measured: share of text below the contrast minimum

| Screen | Dark | Light |
|---|---|---|
| Today | 23% | 42% |
| Log → Food | 33% | 59% |
| Log → Move | 65% | 77% |
| Log → Sleep | 50% | 67% |
| Progress → Week | 41% | 52% |
| Progress → Month | 33% | 36% |
| Progress → Trends | 35% | 37% |
| Profile | 30% | 52% |
| All badges | 66% | 69% |
| Settings | 60% | 60% |
| Scoring rules | 34% | 36% |
| Weight | 46% | 56% |

On half the screens, more than half the text in light mode is below the minimum.

### 1.4 Colour has no consistent meaning

- **Orange** is the Fasting category, the Snacks button, the step count, and "below target". So a perfectly normal step count is shown in a warning colour.
- **Green** is the Diet category, "success", the sleep duration, and positive points.
- **Violet** is the brand, the Sleep category, the Dinner button, and every link.
- **The score changes colour with its grade**, so a decent 60 is shown as a giant amber number that reads as a warning.
- **Each meal's Add button is a different colour** (amber, green, violet, orange). The colour carries no information.

### 1.5 Two palettes are mixed

The code has 116 hard-coded hex colours (18 distinct) that bypass the theme. They come from two different colour families used side by side:

| Role | Family A | Family B |
|---|---|---|
| Green | `#22c55e` | `#34a853` |
| Blue | `#38bdf8` | `#1a73e8` |
| Amber | `#f59e0b` | `#fbbc04`, `#f29900` |
| Red | `#ef4444` | `#ea4335` |

The Diet bar is one green on Today and a different green in the day-detail panel. Because these are hard-coded, they also cannot adapt between light and dark.

### 1.6 Things that ignore the theme entirely

- **Toast messages** are always dark slate (`#1e293b`), a colour from neither theme, even in light mode.
- **The shared day image** is exported on the same dark slate regardless of theme.
- **Card shadows** are black at 45% in dark mode, where a shadow is invisible against a near-black page. They add cost and no depth.

---

## 2. UI elements

### 2.1 Everything is the same card

There are 71 uses of the same card: 24 px corners, 1 px border, shadow, 20 px padding. A score, a list of meals, a single line of fasting text, a toggle and a settings row all get the identical container. When every block has equal weight, nothing is primary and the screen reads as a stack of boxes. This is the strongest "generated" signal.

It also nests. Log → Food is a card, containing a tinted row, containing bordered stepper buttons: three rounded rectangles deep for one food item.

### 2.2 Type has no hierarchy

- 12 px text is used **213 times** and 14 px **152 times**. Nearly everything is one of two small sizes.
- Semibold is **154 of 242** weight choices (64%). When most text is semibold, weight stops signalling importance.
- Small uppercase letter-spaced labels ("TODAY'S GOALS", "NEXT BADGE", "WHICH DAY?") are used as section headings throughout. They are a dashboard cliché and are harder to read than a normal heading.

### 2.3 The font does not ship with the app

The app is fully offline, but the Inter font is loaded from Google Fonts over the internet. On a phone with no connection the app silently falls back to the system font, so the design is not what users see. The link also requests weights 300–700 only, while the code uses 900 in places, which the browser fakes.

### 2.4 Two icon languages

The code uses 54 line icons and 55 emoji. Emoji act as icons for meals, log buttons, goals, badges and stat tiles. Problems:

- Emoji look different on every phone brand, so the app has no consistent look.
- They cannot be tinted. The plate emoji on the Meal button nearly disappears on the white card in light mode.
- Full-colour emoji next to thin monochrome line icons look like two different apps.

### 2.5 Decoration that carries no information

- Gradient fills and coloured glows on primary buttons, selected pills and the active tab.
- Four corner radii in use (8, 12, 16 px and full pill) with no rule for which goes where.
- Stat tiles on the Weight screen each have a differently coloured glow.
- The floating, blurred, pill-shaped tab bar with a glowing active tab. It costs 90 px of height and covers content while scrolling.

### 2.6 Leftovers

- The browser tab title is still "Health Dashboard".
- The palette is named "Purple Dream" in the stylesheet, which says how the theme was conceived: as a mood, not a system.

---

## 3. Space

### 3.1 Short screens leave the bottom empty

| Screen | Content ends at | Empty before the tab bar |
|---|---|---|
| Today | 493 px of 844 | about 260 px (31% of the screen) |
| Log → Sleep | 608 px | about 150 px |

On Today, the score sits at the top and the four log buttons, the things you actually tap, are in the middle of the screen. The easiest area to reach with a thumb, the bottom third, is blank.

### 3.2 Long screens are padded twice

Each card has 16 px of page margin plus 20 px of its own padding on each side. On a 390 px phone that leaves 318 px for content, so **18% of the width is gutter**. Nested tiles lose more. That is why the Log → Food rows feel cramped while the screen as a whole feels empty.

### 3.3 Rhythm is uneven

Gaps between cards are 12 px on some screens and 16 px on others. Card padding is 20 px, but tiles inside use 10, 12 or 16 px. Nothing lines up to a shared grid, which is what makes a layout feel assembled instead of designed.

### 3.4 Scrolling for little content

The all-badges page is 4,022 px tall, almost five screens, because each of the 104 badges gets a large tile in a four-column grid. Scoring rules is 2,194 px.

---

## 4. Rectification plan

Three phases. Phase 1 fixes the eye-strain complaint and is mostly a change to one file. Phases 2 and 3 fix the "generated" complaint.

### Phase 1 — Colour system (fixes dark mode)

**1. Neutral surfaces.** Replace the violet surfaces with near-neutral greys, in both modes. Proposed values, with contrast measured on the card colour:

| Token | Dark | Light |
|---|---|---|
| Page | `#0F1014` | `#F5F5F2` |
| Card | `#181A20` | `#FFFFFF` |
| Raised tile | `#22252D` | `#EDEDE9` |
| Border | `#30343E` | `#DCDCD6` |
| Primary text | `#ECEDF0` (14.9 : 1) | `#17181C` (17.7 : 1) |
| Secondary text | `#B6BAC4` (9.0 : 1) | `#474A52` (8.9 : 1) |
| Muted text | `#8E93A0` (5.7 : 1) | `#676B75` (5.3 : 1) |

Muted text also passes on the raised tile in both modes (5.0 and 4.5).

**2. One accent.** Pick a single brand colour and use it only for the primary action, the active tab, links and selection. Proposed: `#7C8CF8` in dark (5.8 : 1) and `#4353D6` in light (6.1 : 1). In dark mode, put dark text on accent-filled buttons, since white on it is only 3.0 : 1.

**3. Status colours with one meaning each.** Green means good, amber means caution, red means a cost. Nothing else uses them.

| Role | Dark | Light |
|---|---|---|
| Good | `#4CC38A` (7.9 : 1) | `#177A45` (5.4 : 1) |
| Caution | `#E5B454` (9.1 : 1) | `#A8590A` (5.1 : 1) |
| Cost | `#F2766B` (6.3 : 1) | `#C0261F` (5.9 : 1) |

The light caution colour is 4.4 : 1 on a raised tile, so use it on cards only or darken it slightly.

**4. Category colours only in charts and bars.** Diet, Fasting, Workout and Sleep keep distinct colours, but only where they distinguish data. They stop being used for buttons, headings and numbers.

**5. Neutral numbers.** The score, step count and sleep duration are shown in the primary text colour. The grade pill next to them carries the judgement.

**6. Remove every hard-coded colour.** Replace the 116 hex values with tokens, which also removes the second colour family. Make toasts and the shared image follow the theme.

**7. Drop shadows in dark mode** and separate surfaces by brightness alone.

### Phase 2 — Elements (fixes the "generated" look)

**8. Three kinds of container, not one.**
- *Hero*: one per screen, for the thing the screen is about. No border; larger type.
- *Group*: a plain list with hairline dividers and no surrounding box, for meals, goals and settings rows.
- *Tile*: a small filled block for a single stat.

Most of the 71 cards become groups. Nothing is nested more than one level.

**9. A type scale with real steps.** Five sizes with clear jobs, for example 28 for a screen's main number, 20 for titles, 16 for body, 14 for secondary, 12 for captions only. Regular weight for body, semibold for titles, bold for the main number. Replace uppercase tracked labels with normal sentence-case headings.

**10. Ship the font.** Bundle Inter in the app (or deliberately use the system font) so the offline app looks the same everywhere, and load only the weights the scale uses.

**11. One icon set.** Replace emoji used as icons with line icons from the set already in the app. Keep emoji only where it is content, such as the badge artwork.

**12. Two radii.** For example 12 px for containers and inputs, and full pill for chips and toggles.

**13. Remove gradients and glows.** Flat accent fill for the primary button and selected state.

**14. A standard tab bar.** Full width, attached to the bottom edge, no blur or glow. It is shorter and stops covering content.

**15. Rename** the page title to "Health Quest".

### Phase 3 — Space

**16. A 4 px spacing scale** (4, 8, 12, 16, 24, 32) used for every gap and padding, with 16 px between groups and 24 px between sections.

**17. Stop double padding.** Groups run to the page margin. Only tiles and the hero have inner padding. This returns about 40 px of width to content.

**18. Use the bottom of Today.** Move the log buttons to the bottom of the screen, directly above the tab bar, where the thumb is. Let the score block take the space it frees up, and fill the remainder with something useful such as today's logged items or the week's seven-day strip.

**19. Denser lists.** Badges become a compact grid or list with smaller tiles, grouped under collapsible category headings, so the page is two screens instead of five.

**20. Design the empty states.** Log → Sleep with nothing logged, an empty meal, and a day with no data each get a deliberate layout instead of a card with one grey line.

### Order and effort

| Step | What | Size | Fixes |
|---|---|---|---|
| 1–7 | Colour tokens, remove hard-coded colours | Small to medium. Mostly `index.css`, plus replacing hex values in about 10 files | Dark-mode strain, contrast in both modes |
| 8–15 | Containers, type scale, font, icons | Medium to large. Touches every screen | The generated look |
| 16–20 | Spacing, Today layout, badges, empty states | Medium | Wasted and cramped space |

Phase 1 can ship on its own and should be judged on a real phone, in a dark room and outdoors, before Phase 2 starts.

### Decisions needed first

| Decision | Recommendation |
|---|---|
| Keep violet as the brand colour? | Move to a calmer indigo-blue, closer to the logo's blue. Violet-on-black is the single most recognisable "generated" signal. |
| Default theme | Follow the phone's system setting instead of always starting in dark. |
| Emoji on badges | Keep. They are the artwork there, not interface icons. |
| System font or bundled Inter | Bundle Inter. It adds a few hundred kilobytes and guarantees the look. |

### How to tell it worked

- No text below 4.5 : 1 in either mode, measured the same way as section 1.3.
- No hex colours outside the theme file.
- At most three hues on any screen, not counting charts.
- One container style is never nested inside itself.
- Today has no blank area larger than one tile above the tab bar.
- Someone shown the app cold cannot tell which screens were built first.
