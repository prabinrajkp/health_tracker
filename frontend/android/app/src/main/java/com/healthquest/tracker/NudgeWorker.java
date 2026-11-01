package com.healthquest.tracker;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Finishes nudge wording the app could not write while it was open: offline, out of
 * quota, or a failed call. It is off unless the user turns it on. The rule-written
 * notification stays booked until a reworded one has passed every check, so a failure
 * here changes nothing.
 */
public class NudgeWorker extends Worker {
    static final String PREFS = "hq_nudges";
    static final String KEY_BUNDLE = "bundle";
    static final String KEY_COPIES = "copies";
    static final String KEY_ALARMS = "alarms";
    static final String KEY_TAP_ROUTE = "tap_route";
    static final String KEY_TAP_KEY = "tap_key";
    private static final String KEY_CALL_DAY = "call_day";
    private static final String KEY_CALLS = "calls";
    private static final int MAX_CALLS_A_DAY = 2;
    private static final int TIMEOUT_MS = 20000;
    private static final int MIN_OPENROUTER_REMAINING = 10;

    public NudgeWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            SharedPreferences prefs = prefs(getApplicationContext());
            String raw = prefs.getString(KEY_BUNDLE, "");
            if (raw == null || raw.isEmpty()) return Result.success();
            if (!claimCall(prefs)) return Result.success();

            JSONObject bundle = new JSONObject(raw);
            String reply = askProvider(bundle);
            if (reply == null) return Result.success();

            applyReply(reply, bundle, prefs);
            prefs.edit().remove(KEY_BUNDLE).apply();
        } catch (Exception e) {
            // Rule-written notifications are still booked, so there is nothing to recover
        }
        return Result.success();
    }

    private boolean claimCall(SharedPreferences prefs) {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        int calls = today.equals(prefs.getString(KEY_CALL_DAY, "")) ? prefs.getInt(KEY_CALLS, 0) : 0;
        if (calls >= MAX_CALLS_A_DAY) return false;
        prefs.edit().putString(KEY_CALL_DAY, today).putInt(KEY_CALLS, calls + 1).apply();
        return true;
    }

    private String askProvider(JSONObject bundle) {
        JSONObject keys = bundle.optJSONObject("keys");
        JSONArray requests = bundle.optJSONArray("requests");
        if (keys == null || requests == null) return null;
        for (int i = 0; i < requests.length(); i++) {
            JSONObject request = requests.optJSONObject(i);
            if (request == null) continue;
            String keyName = request.optString("keyName");
            String key = keys.optString(keyName);
            if (key.isEmpty()) continue;
            if ("openrouter".equals(keyName) && !openRouterHasQuota(key)) continue;
            try {
                String response = post(request.optString("url"), key, request.optString("body"));
                JSONArray choices = new JSONObject(response).optJSONArray("choices");
                JSONObject message = choices == null ? null : choices.getJSONObject(0).optJSONObject("message");
                String content = message == null ? null : message.optString("content");
                if (content != null && !content.isEmpty()) return content;
            } catch (Exception e) {
                // Try the next provider
            }
        }
        return null;
    }

    private boolean openRouterHasQuota(String key) {
        try {
            HttpURLConnection c = open("https://openrouter.ai/api/v1/key", key);
            if (c.getResponseCode() != 200) return true;
            JSONObject data = new JSONObject(read(c.getInputStream())).optJSONObject("data");
            JSONObject free = data == null ? null : data.optJSONObject("free_model_daily_requests");
            return free == null || !free.has("remaining") || free.optInt("remaining") >= MIN_OPENROUTER_REMAINING;
        } catch (Exception e) {
            return true;
        }
    }

    private void applyReply(String reply, JSONObject bundle, SharedPreferences prefs) throws Exception {
        int start = reply.indexOf('{'), end = reply.lastIndexOf('}');
        if (start < 0 || end <= start) return;
        JSONArray messages = new JSONObject(reply.substring(start, end + 1)).optJSONArray("messages");
        JSONArray slots = bundle.optJSONArray("slots");
        if (messages == null || slots == null) return;

        JSONArray copies = new JSONArray(prefs.getString(KEY_COPIES, "[]"));
        JSONArray alarms = new JSONArray(prefs.getString(KEY_ALARMS, "[]"));
        long now = System.currentTimeMillis();
        for (int i = 0; i < messages.length(); i++) {
            JSONObject msg = messages.optJSONObject(i);
            JSONObject slot = msg == null ? null : findSlot(slots, msg.optString("id"));
            if (slot == null || slot.optLong("at") <= now) continue;

            Set<String> allowed = new HashSet<>();
            JSONArray numbers = slot.optJSONArray("allowed");
            for (int n = 0; numbers != null && n < numbers.length(); n++) allowed.add(numbers.optString(n));

            String title = msg.optString("title", null), body = msg.optString("body", null);
            String reason = NudgeCopyCheck.check(title, body, allowed, bundle.optString("blocked"), bundle.optString("link"),
                bundle.optString("numberWords"), bundle.optInt("maxTitle"), bundle.optInt("maxBody"));
            if (reason != null) continue;

            replaceAlarm(slot, title.trim(), body.trim());
            alarms.put(slot.optInt("notifId"));
            copies.put(new JSONObject().put("key", slot.optString("key")).put("title", title.trim()).put("body", body.trim()));
        }
        prefs.edit().putString(KEY_COPIES, copies.toString()).putString(KEY_ALARMS, alarms.toString()).apply();
    }

    private static JSONObject findSlot(JSONArray slots, String ref) {
        for (int i = 0; i < slots.length(); i++) {
            JSONObject s = slots.optJSONObject(i);
            if (s != null && ref.equals(s.optString("ref"))) return s;
        }
        return null;
    }

    // Swaps the plugin's alarm for ours. The plugin keeps its stored copy, so after a
    // reboot it restores the rule-written text, which is the safe fallback.
    private void replaceAlarm(JSONObject slot, String title, String body) {
        Context context = getApplicationContext();
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        int id = slot.optInt("notifId");

        int cancelFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent old = PendingIntent.getBroadcast(context, id, new Intent(context, TimedNotificationPublisher.class), cancelFlags);
        if (old != null) alarms.cancel(old);

        Intent intent = new Intent(context, NudgeAlarmReceiver.class)
            .putExtra(NudgeAlarmReceiver.EXTRA_ID, id)
            .putExtra(NudgeAlarmReceiver.EXTRA_TITLE, title)
            .putExtra(NudgeAlarmReceiver.EXTRA_BODY, body)
            .putExtra(NudgeAlarmReceiver.EXTRA_CHANNEL, slot.optString("channel"))
            .putExtra(NudgeAlarmReceiver.EXTRA_ROUTE, slot.optString("route"))
            .putExtra(NudgeAlarmReceiver.EXTRA_KEY, slot.optString("key"));
        PendingIntent pending = PendingIntent.getBroadcast(context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, slot.optLong("at"), pending);
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static HttpURLConnection open(String url, String key) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(TIMEOUT_MS);
        c.setReadTimeout(TIMEOUT_MS);
        c.setRequestProperty("Authorization", "Bearer " + key);
        return c;
    }

    private static String post(String url, String key, String body) throws Exception {
        HttpURLConnection c = open(url, key);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        try (OutputStream out = c.getOutputStream()) {
            out.write(body.getBytes(StandardCharsets.UTF_8));
        }
        if (c.getResponseCode() != 200) throw new IllegalStateException("HTTP " + c.getResponseCode());
        return read(c.getInputStream());
    }

    private static String read(InputStream in) throws Exception {
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line);
        }
        return out.toString();
    }
}
