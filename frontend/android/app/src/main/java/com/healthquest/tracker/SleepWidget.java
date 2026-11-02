package com.healthquest.tracker;

import android.content.Context;
import android.os.SystemClock;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * The sleep timer on the home screen. While it runs, Android's Chronometer view keeps the
 * clock ticking by itself, so it costs no updates and no battery.
 */
public class SleepWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_sleep_s, 110, 40),
        new Size(R.layout.widget_sleep_m, 250, 40),
    };
    private static final long MIN_NIGHT_MS = WidgetState.HOUR_MS;   // the app saves nothing under an hour

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        boolean wide = size.layout == R.layout.widget_sleep_m;
        long startedAt = state.timerStart();
        boolean running = startedAt > 0;
        v.setOnClickPendingIntent(R.id.s_btn, WidgetKit.action(context, WidgetActionReceiver.SLEEP, widgetId, 0));
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.action(context, WidgetActionReceiver.SLEEP, widgetId, 0));

        // The app's own buttons: start is the quiet one, stop the main action
        int fg = running ? WidgetPalette.ON_BRAND : WidgetPalette.TEXT;
        p.tint(v, R.id.s_btn_bg, running ? WidgetPalette.BRAND : WidgetPalette.TILE);
        p.tint(v, R.id.s_btn_icon, fg);
        p.text(v, R.id.s_btn_label, fg);
        p.text(v, R.id.s_chrono, fg);
        p.text(v, R.id.s_sub, running ? WidgetPalette.ON_BRAND : WidgetPalette.TEXT2);
        v.setImageViewResource(R.id.s_btn_icon, running ? R.drawable.w_ic_stop : R.drawable.w_ic_play);

        if (running) {
            v.setTextViewText(R.id.s_btn_label, wide ? "Wake up — stop timer" : "Wake up");
            long base = SystemClock.elapsedRealtime() - (System.currentTimeMillis() - startedAt);
            v.setChronometer(R.id.s_chrono, base, null, true);
            WidgetKit.show(v, R.id.s_chrono, true);
            String since = "since " + WidgetKit.clock(context, startedAt);
            v.setTextViewText(R.id.s_sub, since);
            WidgetKit.show(v, R.id.s_sub, wide);
            v.setContentDescription(R.id.s_btn, "Stop the sleep timer, running " + since);
            return;
        }

        v.setChronometer(R.id.s_chrono, SystemClock.elapsedRealtime(), null, false);
        WidgetKit.show(v, R.id.s_chrono, false);
        v.setTextViewText(R.id.s_btn_label, wide ? "Going to sleep — start timer" : "Going to sleep");
        v.setContentDescription(R.id.s_btn, "Start the sleep timer");

        // Just stopped here: the night is waiting for the app to save it
        JSONObject stop = state.pendingStop();
        String sub = null;
        if (stop != null) {
            long slept = stop.optLong("at") - stop.optLong("startedAt");
            sub = slept < MIN_NIGHT_MS ? "Under an hour, so nothing is saved"
                : "Saved " + WidgetKit.hours(slept / (double) WidgetState.HOUR_MS) + ". Score updates in the app";
        } else {
            JSONObject sleep = state.section("sleep");
            String last = sleep.isNull("lastText") ? "" : sleep.optString("lastText", "");
            if (state.today.equals(sleep.optString("lastDate")) && !last.isEmpty()) sub = "Last night " + last;
        }
        WidgetKit.show(v, R.id.s_sub, sub != null);
        if (sub != null) v.setTextViewText(R.id.s_sub, sub);
    }
}
