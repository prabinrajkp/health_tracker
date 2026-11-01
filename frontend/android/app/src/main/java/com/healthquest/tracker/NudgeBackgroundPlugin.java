package com.healthquest.tracker;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONException;

/** The bridge between the notification planner and the background worker. */
@CapacitorPlugin(name = "NudgeBackground")
public class NudgeBackgroundPlugin extends Plugin {
    private static final String WORK_NAME = "hq_nudge_writer";
    private static final long EVERY_HOURS = 6;

    // The app has just booked everything afresh, so any reworded alarm is out of date
    @PluginMethod
    public void sync(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = NudgeWorker.prefs(context);
        cancelOwnAlarms(context, prefs);

        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        WorkManager work = WorkManager.getInstance(context);
        if (enabled) {
            prefs.edit().putString(NudgeWorker.KEY_BUNDLE, call.getString("bundle", "")).apply();
            Constraints constraints = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(NudgeWorker.class, EVERY_HOURS, TimeUnit.HOURS)
                .setConstraints(constraints).build();
            work.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request);
        } else {
            // Turning it off removes the stored copy of the key along with the work
            prefs.edit().remove(NudgeWorker.KEY_BUNDLE).apply();
            work.cancelUniqueWork(WORK_NAME);
        }
        call.resolve();
    }

    private void cancelOwnAlarms(Context context, SharedPreferences prefs) {
        try {
            JSONArray ids = new JSONArray(prefs.getString(NudgeWorker.KEY_ALARMS, "[]"));
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            for (int i = 0; i < ids.length(); i++) {
                PendingIntent pending = PendingIntent.getBroadcast(context, ids.getInt(i), new Intent(context, NudgeAlarmReceiver.class),
                    PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
                if (pending != null) alarms.cancel(pending);
            }
        } catch (JSONException e) {
            // A damaged list only means an old alarm might still fire once
        }
        prefs.edit().remove(NudgeWorker.KEY_ALARMS).apply();
    }

    @PluginMethod
    public void consumeCopies(PluginCall call) {
        SharedPreferences prefs = NudgeWorker.prefs(getContext());
        JSObject result = new JSObject();
        result.put("copies", prefs.getString(NudgeWorker.KEY_COPIES, "[]"));
        prefs.edit().remove(NudgeWorker.KEY_COPIES).apply();
        call.resolve(result);
    }

    @PluginMethod
    public void consumeTap(PluginCall call) {
        SharedPreferences prefs = NudgeWorker.prefs(getContext());
        JSObject result = new JSObject();
        result.put("route", prefs.getString(NudgeWorker.KEY_TAP_ROUTE, ""));
        result.put("key", prefs.getString(NudgeWorker.KEY_TAP_KEY, ""));
        prefs.edit().remove(NudgeWorker.KEY_TAP_ROUTE).remove(NudgeWorker.KEY_TAP_KEY).apply();
        call.resolve(result);
    }
}
