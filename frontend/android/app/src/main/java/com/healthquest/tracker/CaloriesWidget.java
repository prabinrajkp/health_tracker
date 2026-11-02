package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;
import org.json.JSONObject;

/** Calories: food against the day's target, in the words that suit the body goal. */
public class CaloriesWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_cal_s, 110, 40),
        new Size(R.layout.widget_cal_m, 110, 165),
    };

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.text(v, R.id.c_eaten, WidgetPalette.TEXT);
        p.text(v, R.id.c_of, WidgetPalette.MUTED);
        p.text(v, R.id.c_net, WidgetPalette.MUTED);
        p.text(v, R.id.c_head, WidgetPalette.TEXT2);
        p.tint(v, R.id.c_head_icon, WidgetPalette.TEXT2);
        p.text(v, R.id.c_msg_title, WidgetPalette.TEXT);
        p.text(v, R.id.c_msg_body, WidgetPalette.TEXT2);
        p.tint(v, R.id.c_msg_icon, WidgetPalette.TEXT2);
        p.tint(v, R.id.c_bar_track, WidgetPalette.TILE);
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/log?tab=food"));

        if (noData(context, v, state, R.id.c_msg_box, R.id.c_msg_title, R.id.c_msg_body)) {
            WidgetKit.show(v, R.id.c_numbers, false);
            return;
        }

        JSONObject cal = state.section("calories");
        String kind = cal.optString("state");
        // Hidden calorie numbers stay hidden here too
        if ("hidden".equals(kind)) { message(v, "Calories hidden", "Turn them on in Settings"); return; }
        if ("minor".equals(kind)) { message(v, "Calorie targets are off", "They are for adults"); return; }
        if ("setup".equals(kind)) { message(v, "Set up calorie targets", "Log a weight, then add height and age"); return; }

        WidgetKit.show(v, R.id.c_msg_box, false);
        WidgetKit.show(v, R.id.c_numbers, true);
        if (state.sick() || ("sick".equals(kind) && state.fresh)) {
            v.setTextViewText(R.id.c_eaten, String.valueOf(cal.optInt("eaten")));
            v.setTextViewText(R.id.c_of, width >= 200 ? "kcal eaten" : "kcal");
            v.setTextViewText(R.id.c_status, "No target today");
            p.text(v, R.id.c_status, WidgetPalette.TEXT2);
            WidgetKit.bar(v, R.id.c_bar_fill, 0);
            WidgetKit.show(v, R.id.c_net, false);
            return;
        }

        // After midnight: nothing eaten yet, against the last target
        int target = cal.optInt("target");
        int eaten = state.fresh ? cal.optInt("eaten") : 0;
        int left = target - eaten;
        String goal = cal.optString("goal");
        String status = state.fresh ? cal.optString("status") : ("gain".equals(goal) ? left + " to go" : left + " left");
        boolean warn = state.fresh && cal.optBoolean("warn");

        v.setTextViewText(R.id.c_eaten, String.valueOf(eaten));
        boolean strip = size.layout == R.layout.widget_cal_s;
        v.setTextViewText(R.id.c_of, !strip ? "of " + target + " kcal" : width >= 200 ? "/ " + target + " kcal" : "kcal");
        v.setTextViewText(R.id.c_status, status);
        p.text(v, R.id.c_status, warn ? WidgetPalette.WARNING : WidgetPalette.TEXT2);
        WidgetKit.bar(v, R.id.c_bar_fill, target > 0 ? eaten / (double) target : 0);
        p.tint(v, R.id.c_bar_fill, warn ? WidgetPalette.WARNING : WidgetPalette.BRAND);
        v.setContentDescription(R.id.c_numbers, eaten + " of " + target + " calories. " + status);

        // Net only at the larger size, and always marked as an estimate
        String net = cal.isNull("net") ? "" : cal.optString("net", "");
        boolean showNet = state.fresh && !net.isEmpty();
        WidgetKit.show(v, R.id.c_net, showNet);
        if (showNet) v.setTextViewText(R.id.c_net, net + " · estimate");
    }

    private static void message(RemoteViews v, String title, String body) {
        WidgetKit.show(v, R.id.c_numbers, false);
        WidgetKit.show(v, R.id.c_msg_box, true);
        v.setTextViewText(R.id.c_msg_title, title);
        v.setTextViewText(R.id.c_msg_body, body);
    }
}
