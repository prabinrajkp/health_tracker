package com.healthquest.tracker;

import android.content.Context;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * What every widget draws from: the last published data plus the taps still waiting in
 * the inbox. It holds no scoring rules. Grades, tones and targets arrive worked out.
 *
 * The date is checked at every draw, so yesterday's data is never shown as today's.
 */
final class WidgetState {
    static final long HOUR_MS = 3600000L;

    final JSONObject data;
    final List<JSONObject> pending;
    final long now;
    final String today;
    /** The data is for today. False before the app has published, or after midnight. */
    final boolean fresh;

    private WidgetState(JSONObject data, List<JSONObject> pending, long now) {
        this.data = data;
        this.pending = pending;
        this.now = now;
        this.today = day(now);
        this.fresh = today.equals(data.optString("date"));
    }

    /** For tests: a state from data and waiting items, at a given time. */
    static WidgetState of(JSONObject data, List<JSONObject> pending, long now) {
        return new WidgetState(data, pending, now);
    }

    static WidgetState load(Context context) {
        JSONObject data = WidgetStore.readData(context);
        Set<String> applied = new HashSet<>();
        JSONArray done = data.optJSONArray("applied");
        if (done != null) for (int i = 0; i < done.length(); i++) applied.add(done.optString(i));

        JSONArray inbox = WidgetStore.readInbox(context);
        List<JSONObject> pending = new ArrayList<>();
        for (int i = 0; i < inbox.length(); i++) {
            JSONObject item = inbox.optJSONObject(i);
            if (item != null && !applied.contains(item.optString("id"))) pending.add(item);
        }
        Collections.sort(pending, (a, b) -> Long.compare(a.optLong("at"), b.optLong("at")));
        return new WidgetState(data, pending, System.currentTimeMillis());
    }

    static String day(long ms) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(ms));
    }

    static String clock24(long ms) {
        return new SimpleDateFormat("HH:mm", Locale.US).format(new Date(ms));
    }

    boolean hasData() {
        return data.has("v");
    }

    String theme() {
        return data.optString("theme", "system");
    }

    JSONObject section(String name) {
        JSONObject s = data.optJSONObject(name);
        return s == null ? new JSONObject() : s;
    }

    boolean sick() {
        return fresh && data.optBoolean("sick");
    }

    // ── Next step ────────────────────────────────────────────────────────────
    /** The step for this time of day, from the list the app worked out for the rest of today. */
    JSONObject nextStep() {
        if (!fresh) return null;
        JSONArray list = data.optJSONArray(timerChangedHere() ? "nextNoSleep" : "next");
        if (list == null || list.length() == 0) list = data.optJSONArray("next");
        if (list == null) return null;
        String clock = clock24(now);
        JSONObject chosen = list.length() > 0 ? list.optJSONObject(0) : null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject step = list.optJSONObject(i);
            if (step != null && step.optString("from").compareTo(clock) <= 0) chosen = step;
        }
        return chosen;
    }

    /** The next time the step can change, for the redraw alarm. 0 when it will not today. */
    long nextStepChange() {
        if (!fresh) return 0;
        JSONArray list = data.optJSONArray(timerChangedHere() ? "nextNoSleep" : "next");
        if (list == null) return 0;
        String clock = clock24(now);
        for (int i = 0; i < list.length(); i++) {
            String from = list.optJSONObject(i) == null ? "" : list.optJSONObject(i).optString("from");
            if (from.compareTo(clock) > 0) return atToday(from);
        }
        return 0;
    }

    private long atToday(String hhmm) {
        try {
            Date d = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).parse(today + " " + hhmm);
            return d == null ? 0 : d.getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    // ── Drinks ───────────────────────────────────────────────────────────────
    int glassMl() {
        int ml = section("drinks").optInt("glassMl", 250);
        return ml >= 50 && ml <= 1000 ? ml : 250;
    }

    int waterGoalMl() {
        if (sick()) return 0;
        // After midnight the last goal is still the best guess, unless that was a sick day
        if (!fresh && data.optBoolean("sick")) return 0;
        return section("drinks").optInt("goalMl", 0);
    }

    /** Published total plus glasses tapped here since, less any undone. */
    int waterMl() {
        int ml = fresh ? section("drinks").optInt("ml", 0) : 0;
        for (JSONObject item : pending) {
            if (!today.equals(item.optString("date"))) continue;
            if ("water".equals(item.optString("type"))) ml += item.optInt("ml");
            else if ("water_undo".equals(item.optString("type"))) ml -= item.optInt("ml");
        }
        return Math.max(0, ml);
    }

    /**
     * What Undo would take back: a glass still in the inbox (just removed from it), or the
     * last one the app already saved (an undo item for the app to apply). Null for nothing.
     */
    JSONObject undoTarget() {
        for (int i = pending.size() - 1; i >= 0; i--) {
            JSONObject item = pending.get(i);
            if ("water".equals(item.optString("type")) && today.equals(item.optString("date"))) return item;
        }
        if (!fresh) return null;
        Set<String> undone = new HashSet<>();
        for (JSONObject item : pending) if ("water_undo".equals(item.optString("type"))) undone.add(item.optString("target"));
        JSONArray entries = section("drinks").optJSONArray("entries");
        if (entries == null) return null;
        for (int i = entries.length() - 1; i >= 0; i--) {
            JSONObject e = entries.optJSONObject(i);
            if (e != null && !undone.contains(e.optString("id"))) return e;
        }
        return null;
    }

    // ── Sleep timer ──────────────────────────────────────────────────────────
    /** When the timer started, counting starts and stops tapped here. 0 when it is not running. */
    long timerStart() {
        long start = section("sleep").optLong("startedAt", 0);
        for (JSONObject item : pending) {
            String type = item.optString("type");
            if ("sleep_start".equals(type) && start == 0) start = item.optLong("at");
            else if ("sleep_stop".equals(type)) start = 0;
        }
        return start;
    }

    /** The last stop tapped here, until the app has saved the night. */
    JSONObject pendingStop() {
        JSONObject stop = null;
        for (JSONObject item : pending) {
            String type = item.optString("type");
            if ("sleep_stop".equals(type)) stop = item;
            else if ("sleep_start".equals(type)) stop = null;
        }
        return stop;
    }

    boolean timerChangedHere() {
        for (JSONObject item : pending) {
            String type = item.optString("type");
            if ("sleep_start".equals(type) || "sleep_stop".equals(type)) return true;
        }
        return false;
    }

    // ── Weight ───────────────────────────────────────────────────────────────
    JSONObject pendingWeight() {
        JSONObject found = null;
        for (JSONObject item : pending) if ("weight".equals(item.optString("type"))) found = item;
        return found;
    }

    /** The newest weight known: one saved here, or the app's latest. NaN when there is none. */
    double latestKg() {
        JSONObject p = pendingWeight();
        if (p != null) return p.optDouble("kg", Double.NaN);
        JSONObject w = section("weight");
        return w.isNull("latest") ? Double.NaN : w.optDouble("latest", Double.NaN);
    }

    boolean weighedToday() {
        JSONObject p = pendingWeight();
        if (p != null && today.equals(p.optString("date"))) return true;
        return today.equals(section("weight").optString("latestDate"));
    }
}
