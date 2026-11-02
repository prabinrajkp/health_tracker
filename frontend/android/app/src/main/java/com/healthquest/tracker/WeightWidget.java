package com.healthquest.tracker;

import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Weight: log it and see where it is heading. Widgets cannot show a keyboard, so it
 * starts at the last weight and steps by 0.1 kg, which suits a daily weigh-in.
 */
public class WeightWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_weight_xs, 110, 40),
        new Size(R.layout.widget_weight_s, 180, 40),
        new Size(R.layout.widget_weight_m, 180, 150),
    };
    static final double START_KG = 70;   // the Weight screen's starting point with nothing logged
    static final double MIN_KG = 20, MAX_KG = 400;

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    public void onDeleted(Context context, int[] widgetIds) {
        SharedPreferences.Editor edit = WidgetKit.prefs(context).edit();
        for (int id : widgetIds) edit.remove(draftKey(id)).remove(draftDayKey(id));
        edit.apply();
    }

    static String draftKey(int widgetId) {
        return "kg_" + widgetId;
    }

    static String draftDayKey(int widgetId) {
        return "kg_day_" + widgetId;
    }

    /** The value being stepped on this widget today, or NaN when it shows the saved weight. */
    static double draft(Context context, int widgetId, String today) {
        SharedPreferences prefs = WidgetKit.prefs(context);
        if (!today.equals(prefs.getString(draftDayKey(widgetId), ""))) return Double.NaN;
        return Double.longBitsToDouble(prefs.getLong(draftKey(widgetId), Double.doubleToLongBits(Double.NaN)));
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.text(v, R.id.k_head, WidgetPalette.TEXT2);
        p.text(v, R.id.k_latest, WidgetPalette.TEXT);
        p.text(v, R.id.k_avg, WidgetPalette.MUTED);
        p.text(v, R.id.k_togo, WidgetPalette.MUTED);
        p.text(v, R.id.k_status, WidgetPalette.MUTED);
        p.text(v, R.id.k_value, WidgetPalette.TEXT);
        p.tint(v, R.id.k_minus_bg, WidgetPalette.TILE);
        p.tint(v, R.id.k_minus_icon, WidgetPalette.TEXT2);
        p.tint(v, R.id.k_plus_bg, WidgetPalette.TILE);
        p.tint(v, R.id.k_plus_icon, WidgetPalette.TEXT2);
        v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/weight"));
        v.setOnClickPendingIntent(R.id.k_minus, WidgetKit.action(context, WidgetActionReceiver.WEIGHT_STEP, widgetId, -1));
        v.setOnClickPendingIntent(R.id.k_plus, WidgetKit.action(context, WidgetActionReceiver.WEIGHT_STEP, widgetId, 1));
        v.setOnClickPendingIntent(R.id.k_save, WidgetKit.action(context, WidgetActionReceiver.WEIGHT_SAVE, widgetId, 0));

        double latest = state.latestKg();
        double draft = draft(context, widgetId, state.today);
        boolean editing = !Double.isNaN(draft) && (Double.isNaN(latest) || Math.abs(draft - latest) > 0.05);
        double shown = !Double.isNaN(draft) ? draft : latest;
        boolean saved = state.pendingWeight() != null && !editing;
        boolean weighed = state.weighedToday() && !editing;

        v.setTextViewText(R.id.k_value, Double.isNaN(shown) ? "–" : WidgetKit.kg(shown));
        v.setContentDescription(R.id.k_value, Double.isNaN(shown) ? "No weight yet" : WidgetKit.kg(shown) + " kilograms");
        // The tick is the main action until today's weight is in
        boolean main = !weighed;
        p.tint(v, R.id.k_save_bg, main ? WidgetPalette.BRAND : WidgetPalette.TILE);
        p.tint(v, R.id.k_save_icon, main ? WidgetPalette.ON_BRAND : WidgetPalette.SUCCESS);

        String status = saved ? "Saved. Score updates in the app"
            : editing ? "Tap ✓ to save " + WidgetKit.kg(draft) + " kg"
            : weighed ? "Logged today"
            : Double.isNaN(latest) ? "Step to your weight, then tap ✓" : "Not logged today";
        v.setTextViewText(R.id.k_status, status);

        if (size.layout != R.layout.widget_weight_m) return;
        JSONObject w = state.section("weight");
        v.setTextViewText(R.id.k_latest, Double.isNaN(latest) ? "No weight yet" : WidgetKit.kg(latest) + " kg");
        boolean hasAvg = !w.isNull("avg7") && w.has("avg7");
        WidgetKit.show(v, R.id.k_avg, hasAvg);
        if (hasAvg) v.setTextViewText(R.id.k_avg, "7-day " + WidgetKit.kg(w.optDouble("avg7")));
        String togo = w.optBoolean("reached") ? "Target reached"
            : !w.isNull("toGo") && w.has("toGo") ? WidgetKit.kg(w.optDouble("toGo")) + " kg to go" : null;
        WidgetKit.show(v, R.id.k_togo, togo != null);
        if (togo != null) v.setTextViewText(R.id.k_togo, togo);

        // The line and its colour follow the body goal, as on the Weight screen
        JSONArray trend = w.optJSONArray("trend");
        JSONObject pending = state.pendingWeight();
        int n = trend == null ? 0 : trend.length();
        double[] values = new double[n + (pending != null ? 1 : 0)];
        for (int i = 0; i < n; i++) values[i] = trend.optDouble(i);
        if (pending != null) values[n] = pending.optDouble("kg");
        float density = context.getResources().getDisplayMetrics().density;
        float chartW = Math.max(60, width - 28), chartH = Math.max(24, Math.min(64, height - 150));
        v.setImageViewBitmap(R.id.k_chart, WidgetKit.trendLine(values, chartW, chartH, density));
        p.tint(v, R.id.k_chart, WidgetPalette.tone(w.isNull("tone") ? null : w.optString("tone")));
        WidgetKit.show(v, R.id.k_chart, values.length > 0);
    }
}
