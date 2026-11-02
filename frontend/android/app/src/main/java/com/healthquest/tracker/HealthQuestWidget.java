package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Today: the score at a glance, and what to do next. Keeps the original widget's class
 * name, so a widget already on someone's home screen turns into this one in place.
 */
public class HealthQuestWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_today_s, 110, 40),
        new Size(R.layout.widget_today_s2, 110, 105),
        new Size(R.layout.widget_today_m, 110, 150),
        new Size(R.layout.widget_today_l, 250, 200),
    };
    private static final String[] BARS = { "diet", "fasting", "workout", "sleep" };
    private static final int[][] BAR_VIEWS = {
        { R.id.t_row_diet, R.id.t_bar_diet_fill, R.id.t_val_diet, R.id.t_max_diet, R.id.t_bar_diet_track, R.id.t_lbl_diet },
        { R.id.t_row_fasting, R.id.t_bar_fasting_fill, R.id.t_val_fasting, R.id.t_max_fasting, R.id.t_bar_fasting_track, R.id.t_lbl_fasting },
        { R.id.t_row_workout, R.id.t_bar_workout_fill, R.id.t_val_workout, R.id.t_max_workout, R.id.t_bar_workout_track, R.id.t_lbl_workout },
        { R.id.t_row_sleep, R.id.t_bar_sleep_fill, R.id.t_val_sleep, R.id.t_max_sleep, R.id.t_bar_sleep_track, R.id.t_lbl_sleep },
    };
    private static final int[] BAR_ROLES = { WidgetPalette.DIET, WidgetPalette.FASTING, WidgetPalette.WORKOUT, WidgetPalette.SLEEP };

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.text(v, R.id.t_score, WidgetPalette.TEXT);
        p.text(v, R.id.t_outof, WidgetPalette.MUTED);
        p.text(v, R.id.t_msg_title, WidgetPalette.TEXT);
        p.text(v, R.id.t_msg_body, WidgetPalette.TEXT2);
        p.tint(v, R.id.t_msg_icon, WidgetPalette.TEXT2);
        p.text(v, R.id.t_next_label, WidgetPalette.BRAND);
        p.text(v, R.id.t_next_title, WidgetPalette.TEXT);
        p.text(v, R.id.t_next_sub, WidgetPalette.TEXT2);
        p.tint(v, R.id.t_next_chev, WidgetPalette.MUTED);
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/"));

        if (noData(context, v, state, R.id.t_msg_box, R.id.t_msg_title, R.id.t_msg_body)) {
            message(v, 0, null, null);
            WidgetKit.show(v, R.id.t_next_box, false);
            return;
        }

        JSONObject score = state.section("score");
        if (state.sick()) {
            message(v, R.drawable.w_ic_sick, "Sick day", "Rest up. Nothing to log today.");
        } else if (!state.fresh) {
            // Yesterday's score is never shown as today's, at any size
            message(v, R.drawable.w_ic_meal, "Nothing logged yet", "Open the app to start today.");
        } else if (score.optBoolean("nothingYet")) {
            message(v, R.drawable.w_ic_meal, "Nothing logged yet", "Start with the step below.");
        } else {
            WidgetKit.show(v, R.id.t_msg_box, false);
            WidgetKit.show(v, R.id.t_scorebox, true);
            WidgetKit.show(v, R.id.t_chip_frame, true);
            WidgetKit.show(v, R.id.t_bars, true);
            v.setTextViewText(R.id.t_score, String.valueOf(score.optInt("total")));
            String tone = score.optString("tone");
            // On one row, a narrow widget keeps the grade letter and drops "/ 100" first
            boolean row = size.layout == R.layout.widget_today_s || size.layout == R.layout.widget_today_s2;
            float room = width - 28;
            WidgetKit.show(v, R.id.t_outof, !row || room >= 195);
            v.setTextViewText(R.id.t_chip, row && room < 160 ? score.optString("letter")
                : score.optString("letter") + " · " + score.optString("label"));
            v.setContentDescription(R.id.t_chip_frame, "Grade " + score.optString("letter") + ", " + score.optString("label"));
            p.text(v, R.id.t_chip, WidgetPalette.tone(tone));
            p.soft(v, R.id.t_chip_bg, WidgetPalette.tone(tone));
            v.setContentDescription(R.id.t_scorebox, "Today's score " + score.optInt("total") + " out of 100");
            bars(v, p, score.optJSONArray("bars"));
        }

        // The step for this time of day, opening that exact action
        JSONObject next = state.sick() ? null : state.nextStep();
        WidgetKit.show(v, R.id.t_next_box, next != null);
        if (next != null) {
            boolean done = next.optBoolean("done");
            v.setTextViewText(R.id.t_next_title, next.optString("label"));
            String sub = next.optString("sub");
            v.setTextViewText(R.id.t_next_sub, sub);
            WidgetKit.show(v, R.id.t_next_sub, !sub.isEmpty());
            WidgetKit.show(v, R.id.t_next_label, !done);
            WidgetKit.show(v, R.id.t_next_chev, !done);
            if (!done) v.setOnClickPendingIntent(R.id.t_next_box, WidgetKit.open(context, next.optString("route", "/")));
            v.setContentDescription(R.id.t_next_box, done ? next.optString("label") : "Next: " + next.optString("label") + ". " + sub);
        }
    }

    // Sick, stale or empty: a short message in place of the score and its bars
    private static void message(RemoteViews v, int icon, String title, String body) {
        WidgetKit.show(v, R.id.t_scorebox, false);
        WidgetKit.show(v, R.id.t_chip_frame, false);
        WidgetKit.show(v, R.id.t_bars, false);
        WidgetKit.show(v, R.id.t_msg_box, true);
        WidgetKit.show(v, R.id.t_msg_icon, icon != 0);
        if (icon != 0) v.setImageViewResource(R.id.t_msg_icon, icon);
        if (title != null) v.setTextViewText(R.id.t_msg_title, title);
        if (body != null) v.setTextViewText(R.id.t_msg_body, body);
    }

    private static void bars(RemoteViews v, WidgetPalette p, JSONArray bars) {
        for (int i = 0; i < BARS.length; i++) {
            JSONObject bar = find(bars, BARS[i]);
            int[] ids = BAR_VIEWS[i];
            // The fasting bar is left out for anyone with fasting points off
            WidgetKit.show(v, ids[0], bar != null);
            if (bar == null) continue;
            int value = bar.optInt("value"), max = Math.max(1, bar.optInt("max", 1));
            WidgetKit.bar(v, ids[1], value / (double) max);
            p.tint(v, ids[1], BAR_ROLES[i]);
            p.tint(v, ids[4], WidgetPalette.TILE);
            p.text(v, ids[5], WidgetPalette.TEXT2);
            v.setTextViewText(ids[2], String.valueOf(value));
            v.setTextViewText(ids[3], "/" + max);
            p.text(v, ids[2], WidgetPalette.TEXT);
            p.text(v, ids[3], WidgetPalette.MUTED);
            v.setContentDescription(ids[0], bar.optString("label") + " " + value + " of " + max);
        }
    }

    private static JSONObject find(JSONArray list, String key) {
        if (list == null) return null;
        for (int i = 0; i < list.length(); i++) {
            JSONObject o = list.optJSONObject(i);
            if (o != null && key.equals(o.optString("key"))) return o;
        }
        return null;
    }
}
