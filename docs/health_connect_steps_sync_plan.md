# Health Connect Steps Sync Plan

## Goal
Build a step-sync system that feels automatic for the user, works on the widest possible range of Android devices, and still falls back safely when Health Connect is unavailable.

## What this feature must do
- Pull step data from Health Connect whenever available.
- Sync steps reliably in the background without asking the user to open the app.
- Handle phones that do not support Health Connect or have not enabled it yet.
- Prevent duplicate steps and double counting.
- Keep the experience simple: the user should see a connected state, a last sync time, and a refresh button.

---

## 1. Product principle
The app should treat Health Connect as the **primary source** for steps, but not the **only source**.

That is the key to universal coverage.

If Health Connect is present and permission is granted, use it.
If it is not present, fall back to a device-local step source.
If both are available, prefer Health Connect and use the fallback only as a backup or short-gap filler.

---

## 2. Reality check on Android coverage
Health Connect is not literally guaranteed on every Android phone.

The official docs say:
- Health Connect is compatible with Android 9 (API 28) and higher.
- The Health Connect SDK supports Android 8 (API 26), but the Health Connect app itself is only compatible with Android 9+.
- Apps should check availability before trying to read or write data.

So the honest plan is not “Health Connect on every device.”
It is:
**Health Connect first, fallback second, graceful setup always.**

---

## 3. Source priority
Use the following order:

### Primary source
1. **Health Connect StepsRecord**

### Secondary source
2. **Device local step counter / sensor-based recording** when Health Connect is unavailable or denied.

### Tertiary source
3. **Manual step entry** if the device cannot provide automatic data.

This keeps the feature usable even on weak, old, or restricted devices.

---

## 4. User flow

### First launch
1. Detect whether Health Connect is available.
2. If available, ask for permissions with a short explanation.
3. If permission is granted, show “Connected”.
4. If unavailable, show a simple fallback message:
   - “Your phone does not have Health Connect yet.”
   - “We will still track steps using your phone sensors.”

### Normal daily use
1. App syncs steps in the background.
2. User sees today’s step total on the dashboard and widget.
3. A refresh button is available for manual sync.
4. If sync fails, the app shows a soft warning, not a hard error.

### Settings screen
Add a section called **Step Sync** with:
- Connection status
- Last sync time
- Source being used
- Reconnect Health Connect
- Switch to fallback source
- Sync now
- Permission help

---

## 5. Health Connect integration plan

### 5.1 Availability check
Before doing anything, check whether Health Connect is available on the device.

If it is not available:
- Do not show a broken permission screen.
- Do not crash.
- Immediately switch to the fallback path.

### 5.2 Permission request
Request only the permissions needed for steps.

Keep the permission message simple:
- “We use step data to calculate your daily movement score.”
- “You can change this anytime in Settings.”

### 5.3 Read steps using aggregation
For cumulative step data, read aggregated data for the time window instead of raw records whenever possible.

That reduces the chance of double counting if multiple apps write steps.

### 5.4 Background reads
Support background step refresh where possible.
If background read permission is not granted, the app should still sync when opened and when the widget refresh button is tapped.

---

## 6. Fallback plan for devices without Health Connect
This is the most important part of the universal strategy.

If Health Connect is unavailable or permission is denied:

### Fallback option A: Device step sensor
Use the phone’s built-in step sensor / sensor manager approach for live step detection.
This gives coverage on many phones even when Health Connect is missing.

### Fallback option B: Activity-based recording
If supported by the device, use a more power-efficient recording method.

### Fallback option C: Manual input
If neither automatic source works, allow the user to enter step count manually.

The user should never feel blocked.

---

## 7. Data model
Store step data with source awareness.

### Recommended fields
- `date`
- `steps`
- `source` (`health_connect`, `sensor`, `manual`)
- `last_synced_at`
- `sync_status`
- `permission_status`
- `source_confidence`
- `device_model`

### Why this matters
If the app knows the source, it can:
- avoid duplicate merges
- show trust indicators
- debug sync issues later

---

## 8. Sync logic

### Daily sync
- Pull steps for today from the primary source.
- Compare with stored value.
- Save only the latest trusted total.

### Merge logic
If multiple sources exist:
- Health Connect wins over sensor fallback.
- Sensor fallback wins over manual entry.
- Manual entry is used only when automatic sources fail.

### Anti-double-counting rule
Never add steps from different sources blindly.
Always pick the best source for the date window.

---

## 9. Refresh button behavior
The refresh button should be simple and safe.

### On tap
1. Check connectivity to Health Connect.
2. If available, read today’s step total.
3. If not available, read local sensor cache.
4. Recompute workout score.
5. Update widget and dashboard.

### User feedback
- “Syncing steps…”
- “Steps updated”
- “No new data found”
- “Health Connect not available, using phone steps”

Keep the wording non-technical.

---

## 10. Permissions and trust
The app should never surprise the user.

### Show clear explanation
Before the Health Connect permission prompt, explain:
- why steps are needed
- how they affect the score
- that the user can revoke access any time

### Settings controls
The user must be able to:
- revoke permission
- reconnect
- switch source
- disable auto-sync

This builds trust and reduces drop-off.

---

## 11. Failure handling

### Case 1: Health Connect missing
- Show fallback path immediately
- Do not block the app

### Case 2: Permission denied
- Show a gentle reminder card
- Offer reconnect button

### Case 3: Sensor unavailable
- Allow manual entry
- Show that automatic syncing is limited on this device

### Case 4: Conflicting totals
- Prefer the higher-trust source
- Keep one value per date

### Case 5: Sync error
- Retry later
- Keep previous step value visible
- Never clear yesterday’s data

---

## 12. Device coverage strategy
To make the feature feel universal:

### Tier 1
Modern Android phones with Health Connect available and enabled.

### Tier 2
Android phones without Health Connect, but with usable step sensors.

### Tier 3
Very limited phones or restricted permissions.
Use manual entry as the last resort.

This is the only realistic way to cover the full Android ecosystem.

---

## 13. Background sync schedule

### Suggested schedule
- Morning sync after wake-up
- Midday sync
- Evening sync
- Manual refresh from widget

### Important rule
Do not sync too often.
Use a sensible cadence so battery drain stays low.

---

## 14. Widget integration
The home screen widget should show:
- today’s steps
- step progress bar
- last sync time
- refresh button
- source badge if needed

If Health Connect is unavailable, the widget should still work and quietly show the fallback source.

---

## 15. Testing checklist

### Device matrix
Test on:
- Android 9
- Android 10
- Android 11
- Android 12
- Android 13
- Android 14+
- Samsung devices
- Pixel devices
- Xiaomi / Oppo / Vivo devices
- Devices with and without Health Connect installed

### Scenario matrix
- Permission granted
- Permission denied
- Health Connect missing
- Sensor fallback only
- Multiple apps writing steps
- Rebooted phone
- No internet
- Manual override

---

## 16. Acceptance criteria
The feature is complete when:
- Step data appears on the dashboard without manual app opening.
- The refresh button updates steps reliably.
- Health Connect works when available.
- Fallback step tracking works when Health Connect is missing.
- The user can understand the source and status in one glance.
- No duplicate step inflation occurs.

---

## 17. Rollout plan

### Phase 1
- Health Connect integration
- Permission flow
- Aggregated step read
- Manual refresh

### Phase 2
- Sensor fallback
- Background sync
- Widget refresh

### Phase 3
- Source confidence logic
- Device compatibility refinements
- Failure analytics

---

## 18. Final recommendation
Do not build this as a “Health Connect only” feature.

Build it as a **universal step intelligence system** with:
- Health Connect as the best path
- Sensor fallback as the safety net
- Manual input as the final escape hatch

That is the only reliable way to make the feature work across the Android ecosystem.
