package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/** Goals: the game part of the app. Level, streak, and what is left today. */
public class GoalsWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_goals_s, 110, 110),
        new Size(R.layout.widget_goals_m, 250, 110),
    };
    private static final int[][] ROWS = {
        { R.id.g_row0, R.id.g_row0_icon, R.id.g_row0_label, R.id.g_row0_xp },
        { R.id.g_row1, R.id.g_row1_icon, R.id.g_row1_label, R.id.g_row1_xp },
        { R.id.g_row2, R.id.g_row2_icon, R.id.g_row2_label, R.id.g_row2_xp },
    };

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.text(v, R.id.g_level, WidgetPalette.TEXT);
        p.text(v, R.id.g_xp_text, WidgetPalette.MUTED);
        p.text(v, R.id.g_streak, size.layout == R.layout.widget_goals_m ? WidgetPalette.TEXT2 : WidgetPalette.TEXT);
        p.tint(v, R.id.g_streak_icon, WidgetPalette.WARNING);
        p.text(v, R.id.g_count, WidgetPalette.TEXT2);
        p.text(v, R.id.g_msg, WidgetPalette.TEXT2);
        p.tint(v, R.id.g_xp_track, WidgetPalette.TILE);
        p.tint(v, R.id.g_xp_fill, WidgetPalette.BRAND);
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/profile"));

        JSONObject goals = state.section("goals");
        if (!state.hasData() || goals.isNull("level") || !goals.has("level")) {
            v.setTextViewText(R.id.g_level, "Goals");
            WidgetKit.bar(v, R.id.g_xp_fill, 0);
            WidgetKit.show(v, R.id.g_xp_text, false);
            WidgetKit.show(v, R.id.g_streak_box, false);
            WidgetKit.show(v, R.id.g_count, false);
            WidgetKit.show(v, R.id.g_rows, false);
            WidgetKit.show(v, R.id.g_msg, true);
            v.setTextViewText(R.id.g_msg, "Open Health Quest to start this widget");
            return;
        }

        int level = goals.optInt("level");
        v.setTextViewText(R.id.g_level, "Level " + level);
        WidgetKit.bar(v, R.id.g_xp_fill, goals.optDouble("xpShare", 0));
        v.setTextViewText(R.id.g_xp_text, goals.optString("xpText"));
        v.setContentDescription(R.id.g_level, "Level " + level + ", " + goals.optString("xpText"));

        int streak = state.data.optInt("streak");
        WidgetKit.show(v, R.id.g_streak_box, streak > 0);
        v.setTextViewText(R.id.g_streak, streak + (streak == 1 ? " day" : " days"));

        // Goals are for today only: after midnight or on a sick day they say so instead
        String message = state.sick() ? "Sick day. Goals can wait." : !state.fresh ? "Open the app to see today's goals" : null;
        WidgetKit.show(v, R.id.g_msg, message != null);
        WidgetKit.show(v, R.id.g_rows, message == null);
        WidgetKit.show(v, R.id.g_count, message == null);
        if (message != null) {
            v.setTextViewText(R.id.g_msg, message);
            return;
        }
        int done = goals.optInt("done"), total = goals.optInt("total");
        v.setTextViewText(R.id.g_count, done + " of " + total + " goals today");

        JSONArray today = goals.optJSONArray("today");
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject goal = today == null ? null : today.optJSONObject(i);
            int[] ids = ROWS[i];
            WidgetKit.show(v, ids[0], goal != null);
            if (goal == null) continue;
            boolean complete = goal.optBoolean("done");
            v.setImageViewResource(ids[1], complete ? R.drawable.w_ic_check : R.drawable.w_ic_circle);
            p.tint(v, ids[1], complete ? WidgetPalette.SUCCESS : WidgetPalette.MUTED);
            v.setTextViewText(ids[2], goal.optString("label"));
            p.text(v, ids[2], WidgetPalette.TEXT);
            v.setTextViewText(ids[3], "+" + goal.optInt("xp") + " XP");
            p.text(v, ids[3], complete ? WidgetPalette.SUCCESS : WidgetPalette.MUTED);
            v.setContentDescription(ids[0], goal.optString("label") + (complete ? ", done" : ", not done yet"));
        }
    }
}
