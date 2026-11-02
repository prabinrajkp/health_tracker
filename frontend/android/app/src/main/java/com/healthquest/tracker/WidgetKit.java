package com.healthquest.tracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.text.format.DateFormat;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Date;
import java.util.Locale;

/** Small things every widget needs: tap links, formatting, the trend line, redrawing all. */
final class WidgetKit {
    static final String PREFS = "hq_widgets";
    static final int LEVEL_MAX = 10000;

    private WidgetKit() {}

    static BaseWidget[] all() {
        return new BaseWidget[] {
            new HealthQuestWidget(), new WeekWidget(), new CaloriesWidget(), new GoalsWidget(),
            new DrinksWidget(), new SleepWidget(), new QuickLogWidget(), new WeightWidget(),
        };
    }

    /** The widget a Settings "Add" button places, by the name the app uses for it. */
    static Class<? extends BaseWidget> kind(String name) {
        switch (name == null ? "" : name) {
            case "today": return HealthQuestWidget.class;
            case "week": return WeekWidget.class;
            case "calories": return CaloriesWidget.class;
            case "goals": return GoalsWidget.class;
            case "drinks": return DrinksWidget.class;
            case "sleep": return SleepWidget.class;
            case "quick": return QuickLogWidget.class;
            case "weight": return WeightWidget.class;
            default: return null;
        }
    }

    static void updateAll(Context context) {
        WidgetState state = WidgetState.load(context);
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (BaseWidget widget : all()) widget.drawAll(context, manager, state);
        WidgetTicker.schedule(context, state);
    }

    static boolean anyPlaced(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (BaseWidget widget : all()) {
            if (manager.getAppWidgetIds(new ComponentName(context, widget.getClass())).length > 0) return true;
        }
        return false;
    }

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── Taps ─────────────────────────────────────────────────────────────────
    /** Opens the app on a screen. Goes through the same tap handling as notifications. */
    static PendingIntent open(Context context, String route) {
        Intent intent = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(NudgeAlarmReceiver.EXTRA_ROUTE, route)
            .putExtra(NudgeAlarmReceiver.EXTRA_KEY, "");
        // Intents that differ only in extras would share one PendingIntent, so each route has its own code
        return PendingIntent.getActivity(context, ("open:" + route).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** A button handled on the spot, with the app closed. */
    static PendingIntent action(Context context, String action, int widgetId, int value) {
        Intent intent = new Intent(context, WidgetActionReceiver.class)
            .setAction(action)
            .putExtra(WidgetActionReceiver.EXTRA_WIDGET, widgetId)
            .putExtra(WidgetActionReceiver.EXTRA_VALUE, value);
        return PendingIntent.getBroadcast(context, (action + ":" + widgetId + ":" + value).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    static void show(RemoteViews views, int viewId, boolean visible) {
        views.setViewVisibility(viewId, visible ? View.VISIBLE : View.GONE);
    }

    /** A bar's fill, 0 to 1, drawn by the scale drawable's level. */
    static void bar(RemoteViews views, int fillId, double share) {
        double s = Double.isNaN(share) ? 0 : Math.max(0, Math.min(1, share));
        views.setInt(fillId, "setImageLevel", (int) Math.round(s * LEVEL_MAX));
    }

    // ── Formatting, the same as the app's ────────────────────────────────────
    /** formatLitres in services/hydration.js: one decimal for whole tenths, otherwise two. */
    static String litres(int ml) {
        return String.format(Locale.US, ml % 100 == 0 ? "%.1f L" : "%.2f L", ml / 1000.0);
    }

    static String kg(double kg) {
        return String.format(Locale.US, "%.1f", kg);
    }

    /** A time in the phone's own 12 or 24-hour style. */
    static String clock(Context context, long ms) {
        return DateFormat.getTimeFormat(context).format(new Date(ms));
    }

    /** fmtHours in services/fasting.js. */
    static String hours(double h) {
        if (h <= 0) return "0 min";
        long total = Math.round(h * 60);
        long hrs = total / 60, mins = total % 60;
        if (hrs == 0) return mins + " min";
        if (mins == 0) return hrs + "h";
        return hrs + "h " + mins + "min";
    }

    // ── The weight trend ─────────────────────────────────────────────────────
    /**
     * The line drawn in white, for the widget to tint, so it switches with the theme like
     * everything else. Sized to the view so the line is not stretched.
     */
    static Bitmap trendLine(double[] values, float widthDp, float heightDp, float density) {
        int w = Math.max(2, Math.round(widthDp * density));
        int h = Math.max(2, Math.round(heightDp * density));
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        if (values.length == 0) return bitmap;
        Canvas canvas = new Canvas(bitmap);
        Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
        line.setColor(0xFFFFFFFF);
        line.setStyle(Paint.Style.STROKE);
        line.setStrokeWidth(2 * density);
        line.setStrokeCap(Paint.Cap.ROUND);
        line.setStrokeJoin(Paint.Join.ROUND);
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        dot.setColor(0xFFFFFFFF);

        double min = values[0], max = values[0];
        for (double v : values) { min = Math.min(min, v); max = Math.max(max, v); }
        // A flat stretch sits in the middle rather than on an edge
        double span = Math.max(max - min, 1.0);
        double mid = (max + min) / 2;
        float pad = 4 * density;
        float stepX = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
        Path path = new Path();
        float x = pad, y = 0;
        for (int i = 0; i < values.length; i++) {
            x = values.length > 1 ? pad + i * stepX : w / 2f;
            y = (float) (h / 2.0 - (values[i] - mid) / span * (h - 2 * pad));
            if (i == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        if (values.length > 1) canvas.drawPath(path, line);
        canvas.drawCircle(x, y, 3 * density, dot);
        return bitmap;
    }
}
