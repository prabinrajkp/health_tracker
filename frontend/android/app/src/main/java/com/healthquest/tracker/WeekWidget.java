package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/** This week: a dot for each day in the Progress calendar's colours, the average, and one thing to fix. */
public class WeekWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_week_s, 180, 40),
        new Size(R.layout.widget_week_m, 180, 130),
    };
    private static final int[] LETTERS = { R.id.wk_l0, R.id.wk_l1, R.id.wk_l2, R.id.wk_l3, R.id.wk_l4, R.id.wk_l5, R.id.wk_l6 };
    private static final int[] DOTS = { R.id.wk_d0, R.id.wk_d1, R.id.wk_d2, R.id.wk_d3, R.id.wk_d4, R.id.wk_d5, R.id.wk_d6 };
    private static final String[] DAY_NAMES = { "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" };

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.text(v, R.id.wk_title, WidgetPalette.TEXT);
        p.text(v, R.id.wk_avg, WidgetPalette.TEXT);
        p.text(v, R.id.wk_avg_label, WidgetPalette.MUTED);
        p.text(v, R.id.wk_msg, WidgetPalette.TEXT2);
        p.text(v, R.id.wk_fix, WidgetPalette.TEXT2);
        p.tint(v, R.id.wk_fix_chev, WidgetPalette.MUTED);
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/progress?tab=week"));

        JSONObject week = state.section("week");
        // A new week since the app last published: last week's dots would mislead
        if (!state.hasData() || !thisMonday(state.now).equals(week.optString("start"))) {
            WidgetKit.show(v, R.id.wk_days, false);
            WidgetKit.show(v, R.id.wk_msg, true);
            WidgetKit.show(v, R.id.wk_change, false);
            WidgetKit.show(v, R.id.wk_fix_box, false);
            v.setTextViewText(R.id.wk_msg, state.hasData() ? "Open the app to see this week" : "Open Health Quest to start this widget");
            v.setTextViewText(R.id.wk_avg, "–");
            v.setTextViewText(R.id.wk_avg_label, "avg");
            return;
        }
        WidgetKit.show(v, R.id.wk_days, true);
        WidgetKit.show(v, R.id.wk_msg, false);

        JSONArray days = week.optJSONArray("days");
        StringBuilder said = new StringBuilder();
        for (int i = 0; i < 7; i++) {
            JSONObject day = days == null ? null : days.optJSONObject(i);
            String date = day == null ? "" : day.optString("date");
            String kind = day == null ? "empty" : day.optString("state");
            // Published yesterday: today has come since, so it is no longer a day ahead
            if ("future".equals(kind) && date.compareTo(state.today) <= 0) kind = "empty";
            boolean isToday = date.equals(state.today);
            p.text(v, LETTERS[i], isToday ? WidgetPalette.TEXT : WidgetPalette.MUTED);
            switch (kind) {
                case "score":
                    v.setImageViewResource(DOTS[i], R.drawable.w_dot);
                    p.tint(v, DOTS[i], WidgetPalette.tone(day.optString("tone")));
                    break;
                case "sick":
                    v.setImageViewResource(DOTS[i], R.drawable.w_dash);
                    p.tint(v, DOTS[i], WidgetPalette.MUTED);
                    break;
                case "future":
                    v.setImageViewResource(DOTS[i], R.drawable.w_dot_small);
                    p.tint(v, DOTS[i], WidgetPalette.EDGE);
                    break;
                default:
                    v.setImageViewResource(DOTS[i], R.drawable.w_ring);
                    p.tint(v, DOTS[i], WidgetPalette.EDGE);
            }
            said.append(DAY_NAMES[i]).append(' ').append(describe(kind, day)).append(". ");
        }
        v.setContentDescription(R.id.wk_days, said.toString());

        boolean hasAvg = !week.isNull("avg") && week.has("avg");
        v.setTextViewText(R.id.wk_avg, hasAvg ? String.valueOf(week.optInt("avg")) : "–");
        // The average is marked when it was worked out before today
        v.setTextViewText(R.id.wk_avg_label, state.fresh ? "avg" : "avg, " + shortDay(state.data.optString("date")));

        boolean hasChange = !week.isNull("change") && week.has("change");
        WidgetKit.show(v, R.id.wk_change, true);
        if (hasChange) {
            int change = week.optInt("change");
            v.setTextViewText(R.id.wk_change, (change > 0 ? "+" : change < 0 ? "−" : "±") + Math.abs(change) + " vs last week");
            p.text(v, R.id.wk_change, change > 0 ? WidgetPalette.SUCCESS : change < 0 ? WidgetPalette.WARNING : WidgetPalette.TEXT2);
        } else {
            int logged = week.optInt("logged");
            v.setTextViewText(R.id.wk_change, logged + (logged == 1 ? " day logged" : " days logged"));
            p.text(v, R.id.wk_change, WidgetPalette.TEXT2);
        }

        String fix = week.optString("fix", "");
        boolean showFix = !week.isNull("fix") && !fix.isEmpty();
        WidgetKit.show(v, R.id.wk_fix_box, showFix);
        if (showFix) v.setTextViewText(R.id.wk_fix, "To fix: " + fix);
    }

    private static String describe(String kind, JSONObject day) {
        switch (kind) {
            case "score": return "success".equals(day.optString("tone")) ? "a good day" : "logged";
            case "sick": return "sick day";
            case "future": return "still to come";
            default: return "nothing logged";
        }
    }

    private static String thisMonday(long now) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(now);
        int fromMonday = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        c.add(Calendar.DAY_OF_MONTH, -fromMonday);
        return WidgetState.day(c.getTimeInMillis());
    }

    private static String shortDay(String date) {
        try {
            return new SimpleDateFormat("EEE", Locale.getDefault())
                .format(new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(date));
        } catch (Exception e) {
            return "earlier";
        }
    }
}
