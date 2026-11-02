package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Quick log: the bottom row of Today on the home screen. Each one opens the app on its screen. */
public class QuickLogWidget extends BaseWidget {
    private static final Size[] SIZES = { new Size(R.layout.widget_quick, 180, 40) };

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        JSONObject quick = state.section("quick");
        boolean fresh = state.fresh;

        int meals = fresh ? quick.optInt("meals") : 0;
        String steps = fresh ? quick.optString("steps", "Not yet") : "Not yet";
        boolean moveDone = fresh && quick.optBoolean("moveDone");
        // A night stopped on the Sleep widget counts as logged before the app has saved it
        boolean sleepDone = (fresh && quick.optBoolean("sleepDone")) || state.pendingStop() != null;
        boolean weightDone = state.weighedToday();
        double kg = state.latestKg();

        // Narrow: icons and status only, so nothing is cut short
        boolean labels = width >= 280;
        for (int label : new int[] { R.id.q_meal_label, R.id.q_move_label, R.id.q_sleep_label, R.id.q_weight_label }) {
            WidgetKit.show(v, label, labels);
        }
        // Add Meal picks the meal that fits the time of day, as on Today
        cell(context, v, p, R.id.q_meal, R.id.q_meal_icon, R.id.q_meal_label, R.id.q_meal_tick, R.id.q_meal_status,
            "Meal", meals + " of 3", meals >= 3, "/?meal=now", labels);
        cell(context, v, p, R.id.q_move, R.id.q_move_icon, R.id.q_move_label, R.id.q_move_tick, R.id.q_move_status,
            "Move", steps, moveDone, "/log?tab=move", labels);
        cell(context, v, p, R.id.q_sleep, R.id.q_sleep_icon, R.id.q_sleep_label, R.id.q_sleep_tick, R.id.q_sleep_status,
            "Sleep", sleepDone ? "Logged" : "Not yet", sleepDone, "/log?tab=sleep", labels);
        cell(context, v, p, R.id.q_weight, R.id.q_weight_icon, R.id.q_weight_label, R.id.q_weight_tick, R.id.q_weight_status,
            "Weight", weightDone && !Double.isNaN(kg) ? WidgetKit.kg(kg) + " kg" : "Not yet", weightDone, "/weight", labels);
    }

    private static void cell(Context context, RemoteViews v, WidgetPalette p, int cell, int icon, int label, int tick,
                             int status, String name, String text, boolean done, String route, boolean roomy) {
        p.tint(v, icon, WidgetPalette.TEXT);
        p.text(v, label, WidgetPalette.TEXT);
        p.tint(v, tick, WidgetPalette.SUCCESS);
        p.text(v, status, done ? WidgetPalette.SUCCESS : WidgetPalette.MUTED);
        // A narrow cell drops the tick before a word that already says it, like "Logged"
        WidgetKit.show(v, tick, done && (roomy || text.length() <= 5));
        v.setTextViewText(status, text);
        v.setOnClickPendingIntent(cell, WidgetKit.open(context, route));
        v.setContentDescription(cell, "Log " + name.toLowerCase() + ". " + text);
    }
}
