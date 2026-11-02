package com.healthquest.tracker;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The buttons on the widgets, handled with the app closed. Each tap goes into the inbox
 * for the app to write when it next opens, and the widgets redraw at once.
 */
public class WidgetActionReceiver extends BroadcastReceiver {
    static final String WATER = "com.healthquest.tracker.widget.WATER";
    static final String WATER_UNDO = "com.healthquest.tracker.widget.WATER_UNDO";
    static final String SLEEP = "com.healthquest.tracker.widget.SLEEP";
    static final String WEIGHT_STEP = "com.healthquest.tracker.widget.WEIGHT_STEP";
    static final String WEIGHT_SAVE = "com.healthquest.tracker.widget.WEIGHT_SAVE";
    static final String EXTRA_WIDGET = "hq_widget";
    static final String EXTRA_VALUE = "hq_value";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        int widgetId = intent.getIntExtra(EXTRA_WIDGET, 0);
        WidgetState state = WidgetState.load(context);
        try {
            switch (action) {
                case WATER: addWater(context, state); break;
                case WATER_UNDO: undoWater(context, state); break;
                case SLEEP: toggleTimer(context, state); break;
                case WEIGHT_STEP: stepWeight(context, state, widgetId, intent.getIntExtra(EXTRA_VALUE, 0)); break;
                case WEIGHT_SAVE: saveWeight(context, state, widgetId); break;
                default: return;
            }
        } catch (JSONException e) {
            return;
        }
        WidgetKit.updateAll(context);
    }

    private static void addWater(Context context, WidgetState state) throws JSONException {
        WidgetStore.addToInbox(context, WidgetStore.item("water", state.now, state.today).put("ml", state.glassMl()));
    }

    // A glass still in the inbox just leaves it; one the app already saved needs the app to remove it
    private static void undoWater(Context context, WidgetState state) throws JSONException {
        JSONObject target = state.undoTarget();
        if (target == null) return;
        if (target.has("type")) {
            WidgetStore.removeFromInbox(context, target.optString("id"));
            return;
        }
        WidgetStore.addToInbox(context, WidgetStore.item("water_undo", state.now, state.today)
            .put("target", target.optString("id")).put("ml", target.optInt("ml")));
    }

    private static void toggleTimer(Context context, WidgetState state) throws JSONException {
        long startedAt = state.timerStart();
        JSONObject notifications = state.section("notifications");
        if (startedAt > 0) {
            WidgetStore.addToInbox(context, WidgetStore.item("sleep_stop", state.now, state.today).put("startedAt", startedAt));
            cancelNotifications(context, notifications.optJSONArray("onTimerStop"));
        } else {
            WidgetStore.addToInbox(context, WidgetStore.item("sleep_start", state.now, state.today));
            // The app does not know yet, so tonight's bedtime reminder would still arrive
            cancelNotifications(context, notifications.optJSONArray("onTimerStart"));
        }
    }

    private static void stepWeight(Context context, WidgetState state, int widgetId, int tenths) {
        double current = WeightWidget.draft(context, widgetId, state.today);
        if (Double.isNaN(current)) current = state.latestKg();
        if (Double.isNaN(current)) current = WeightWidget.START_KG;
        double next = Math.round((current + tenths / 10.0) * 10) / 10.0;
        next = Math.max(WeightWidget.MIN_KG, Math.min(WeightWidget.MAX_KG, next));
        WidgetKit.prefs(context).edit()
            .putLong(WeightWidget.draftKey(widgetId), Double.doubleToLongBits(next))
            .putString(WeightWidget.draftDayKey(widgetId), state.today)
            .apply();
    }

    private static void saveWeight(Context context, WidgetState state, int widgetId) throws JSONException {
        double kg = WeightWidget.draft(context, widgetId, state.today);
        if (Double.isNaN(kg)) kg = state.latestKg();
        if (Double.isNaN(kg) || kg < WeightWidget.MIN_KG || kg > WeightWidget.MAX_KG) return;
        WidgetStore.addToInbox(context, WidgetStore.item("weight", state.now, state.today).put("kg", kg));
        WidgetKit.prefs(context).edit()
            .remove(WeightWidget.draftKey(widgetId)).remove(WeightWidget.draftDayKey(widgetId)).apply();
    }

    /**
     * Cancels notifications the app booked, by id: the plugin's own alarm, the background
     * writer's reworded copy of it, and anything already showing.
     */
    static void cancelNotifications(Context context, JSONArray ids) {
        if (ids == null) return;
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        NotificationManager shown = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        int pluginFlags = PendingIntent.FLAG_NO_CREATE
            | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
        for (int i = 0; i < ids.length(); i++) {
            int id = ids.optInt(i, -1);
            if (id < 0) continue;
            PendingIntent booked = PendingIntent.getBroadcast(context, id, new Intent(context, TimedNotificationPublisher.class), pluginFlags);
            if (booked != null) { alarms.cancel(booked); booked.cancel(); }
            PendingIntent reworded = PendingIntent.getBroadcast(context, id, new Intent(context, NudgeAlarmReceiver.class),
                PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
            if (reworded != null) { alarms.cancel(reworded); reworded.cancel(); }
            if (shown != null) shown.cancel(id);
        }
    }
}
