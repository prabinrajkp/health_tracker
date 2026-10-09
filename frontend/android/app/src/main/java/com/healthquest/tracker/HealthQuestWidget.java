package com.healthquest.tracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class HealthQuestWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] widgetIds) {
        for (int id : widgetIds) updateWidget(ctx, mgr, id);
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        android.content.ComponentName comp =
            new android.content.ComponentName(ctx, HealthQuestWidget.class);
        int[] ids = mgr.getAppWidgetIds(comp);
        for (int id : ids) updateWidget(ctx, mgr, id);
    }

    static void updateWidget(Context ctx, AppWidgetManager mgr, int widgetId) {
        RemoteViews views = new RemoteViews(ctx.getPackageName(), R.layout.widget_health_quest);

        // ── Read widget_data.json written by the Capacitor JS layer ───────────
        int total = 0, diet = 0, dietMax = 35,
            workout = 0, workoutMax = 35,
            sleep = 0, sleepMax = 30, streak = 0;
        try {
            File f = new File(ctx.getFilesDir(), "widget_data.json");
            if (f.exists()) {
                StringBuilder sb = new StringBuilder();
                BufferedReader br = new BufferedReader(
                    new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8));
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();
                JSONObject j = new JSONObject(sb.toString());
                total      = j.optInt("total", 0);
                diet       = j.optInt("diet", 0);
                dietMax    = j.optInt("diet_max", 35);
                workout    = j.optInt("workout", 0);
                workoutMax = j.optInt("workout_max", 35);
                sleep      = j.optInt("sleep", 0);
                sleepMax   = j.optInt("sleep_max", 30);
                streak     = j.optInt("streak", 0);
            }
        } catch (Exception ignored) {}

        // ── Character + tier color ────────────────────────────────────────────
        String[] ch   = character(total);
        int tierColor = tierColor(total);

        views.setTextViewText(R.id.wCharEmoji, ch[0]);
        views.setTextViewText(R.id.wCharTitle, ch[1]);
        views.setTextViewText(R.id.wSubtitle,  ch[2]);
        views.setTextViewText(R.id.wScore,     total + " / 100");
        views.setTextViewText(R.id.wStreak,    streak > 0 ? streak + " 🔥" : "");
        views.setTextColor(R.id.wCharTitle, tierColor);
        views.setTextColor(R.id.wScore, tierColor);

        // ── Metrics row ───────────────────────────────────────────────────────
        views.setTextViewText(R.id.wDietMetric,    "🥗 " + diet + "/" + dietMax);
        views.setTextViewText(R.id.wWorkoutMetric, "⚡ " + workout + "/" + workoutMax);
        views.setTextViewText(R.id.wSleepMetric,   "🌙 " + sleep + "/" + sleepMax);

        // ── Radar chart bitmap ────────────────────────────────────────────────
        float dp = ctx.getResources().getDisplayMetrics().density;
        int bitmapPx = (int)(120 * dp);
        Bitmap bm = drawRadar(bitmapPx, dp,
            diet    / (float) Math.max(dietMax, 1),
            workout / (float) Math.max(workoutMax, 1),
            sleep   / (float) Math.max(sleepMax, 1));
        views.setImageViewBitmap(R.id.wChart, bm);

        // ── Tap intents: all open the app ─────────────────────────────────────
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.wRoot,       pi);
        views.setOnClickPendingIntent(R.id.wRefreshBtn, pi);

        mgr.updateAppWidget(widgetId, views);
    }

    // ── Tier lookup: {emoji, title, subtitle message} ─────────────────────────
    private static String[] character(int score) {
        if (score >= 91) return new String[]{"👑", "LEGEND",      "You are unstoppable."};
        if (score >= 81) return new String[]{"🌟", "CHAMPION",    "Peak performance."};
        if (score >= 71) return new String[]{"🦸", "HERO",        "Stronger every day."};
        if (score >= 61) return new String[]{"⚔️", "WARRIOR",    "Push for hero tier."};
        if (score >= 41) return new String[]{"🛡️", "APPRENTICE", "Every point counts."};
        if (score >= 21) return new String[]{"🏃", "NOVICE",      "The journey begins."};
        return new String[]{"😴", "IDLE", "Log today to begin."};
    }

    // ── Tier color (matches Dashboard.jsx RPG_TIERS colors) ──────────────────
    private static int tierColor(int score) {
        if (score >= 91) return 0xFFA78BFA;  // violet
        if (score >= 81) return 0xFFF59E0B;  // amber
        if (score >= 71) return 0xFF22C55E;  // green
        if (score >= 61) return 0xFF38BDF8;  // sky
        if (score >= 41) return 0xFFF97316;  // orange
        if (score >= 21) return 0xFFEF4444;  // red
        return 0xFF64748B;                   // slate
    }

    // ── Full-width centered radar chart ───────────────────────────────────────
    // Angles: Workout top (-90°), Diet bottom-left (150°), Sleep bottom-right (30°)
    // Colors: Workout=blue, Diet=green, Sleep=purple
    private static Bitmap drawRadar(int size, float dp,
                                    float dietPct, float workoutPct, float sleepPct) {
        Bitmap bm = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas c  = new Canvas(bm);

        float cx = size / 2f;
        float cy = size / 2f;
        float r  = size * 0.36f;

        float[] ang  = {-90f, 150f, 30f};
        float[] pcts = {clamp(workoutPct), clamp(dietPct), clamp(sleepPct)};

        // Grid rings
        Paint grid = new Paint(Paint.ANTI_ALIAS_FLAG);
        grid.setStyle(Paint.Style.STROKE);
        for (float lvl : new float[]{0.33f, 0.67f, 1f}) {
            grid.setStrokeWidth(lvl == 1f ? 1.2f * dp : 0.7f * dp);
            grid.setColor(lvl == 1f ? 0x44FFFFFF : 0x1AFFFFFF);
            c.drawPath(triPath(cx, cy, r * lvl, ang), grid);
        }

        // Axis lines
        grid.setColor(0x1AFFFFFF);
        grid.setStrokeWidth(0.6f * dp);
        for (float a : ang) {
            double rad = Math.toRadians(a);
            c.drawLine(cx, cy,
                cx + r * (float) Math.cos(rad),
                cy + r * (float) Math.sin(rad), grid);
        }

        // Value polygon — compute vertices
        float[] vx = new float[3], vy = new float[3];
        Path vp = new Path();
        for (int i = 0; i < 3; i++) {
            double rad = Math.toRadians(ang[i]);
            vx[i] = cx + r * pcts[i] * (float) Math.cos(rad);
            vy[i] = cy + r * pcts[i] * (float) Math.sin(rad);
            if (i == 0) vp.moveTo(vx[i], vy[i]); else vp.lineTo(vx[i], vy[i]);
        }
        vp.close();

        // Soft glow fill (two-pass for depth)
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setStyle(Paint.Style.FILL);
        fill.setColor(0x2A7C3AED);
        c.drawPath(vp, fill);
        fill.setColor(0x807C3AED);
        c.drawPath(vp, fill);

        // Border stroke
        Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
        border.setStyle(Paint.Style.STROKE);
        border.setStrokeWidth(1.5f * dp);
        border.setColor(0xFFAA88FF);
        c.drawPath(vp, border);

        // Vertex dots with per-axis colors (workout=blue, diet=green, sleep=purple)
        int[] dotColors = {0xFF38BDF8, 0xFF22C55E, 0xFFA78BFA};
        Paint dot = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < 3; i++) {
            dot.setColor(dotColors[i]);
            c.drawCircle(vx[i], vy[i], 3f * dp, dot);
        }

        // Axis labels with per-axis colors
        String[] labels   = {"W", "D", "S"};
        int[]    lblColors = {0xFF38BDF8, 0xFF22C55E, 0xFFA78BFA};
        Paint lp = new Paint(Paint.ANTI_ALIAS_FLAG);
        lp.setTextSize(8.5f * dp);
        lp.setTextAlign(Paint.Align.CENTER);
        lp.setTypeface(Typeface.DEFAULT_BOLD);
        for (int i = 0; i < 3; i++) {
            lp.setColor(lblColors[i]);
            double rad = Math.toRadians(ang[i]);
            float lx = cx + (r + 13 * dp) * (float) Math.cos(rad);
            float ly = cy + (r + 13 * dp) * (float) Math.sin(rad) + lp.getTextSize() / 3f;
            c.drawText(labels[i], lx, ly, lp);
        }

        return bm;
    }

    private static Path triPath(float cx, float cy, float r, float[] angles) {
        Path p = new Path();
        for (int i = 0; i < angles.length; i++) {
            double rad = Math.toRadians(angles[i]);
            float x = cx + r * (float) Math.cos(rad);
            float y = cy + r * (float) Math.sin(rad);
            if (i == 0) p.moveTo(x, y); else p.lineTo(x, y);
        }
        p.close();
        return p;
    }

    private static float clamp(float v) { return Math.max(0f, Math.min(1f, v)); }
}
