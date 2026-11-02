package com.healthquest.tracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.widget.RemoteViews;
import java.util.HashMap;
import java.util.Map;

/**
 * What every widget shares: drawing at the right size, the card, and keeping the
 * redraw alarm going. Each widget only fills in its own views.
 *
 * Widget code never enqueues WorkManager work: doing that from onUpdate is a known
 * cause of endless update loops, and the app already uses WorkManager for nudges.
 */
abstract class BaseWidget extends AppWidgetProvider {
    /** One size the widget can be drawn at: the layout, and the smallest size in dp it suits. */
    static final class Size {
        final int layout;
        final float width;
        final float height;

        Size(int layout, float width, float height) {
            this.layout = layout;
            this.width = width;
            this.height = height;
        }
    }

    /** Smallest first. */
    abstract Size[] sizes();

    /** Fills one layout. `width` and `height` are the space it is drawn in, in dp. */
    abstract void fill(Context context, RemoteViews views, Size size, int widgetId, WidgetState state,
                       WidgetPalette palette, float width, float height);

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        WidgetState state = WidgetState.load(context);
        for (int id : widgetIds) draw(context, manager, id, state);
        WidgetTicker.schedule(context, state);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int widgetId, Bundle options) {
        draw(context, manager, widgetId, WidgetState.load(context));
    }

    @Override
    public void onDisabled(Context context) {
        // The last of this kind was removed: the alarm stops if no widget is left at all
        WidgetTicker.schedule(context, WidgetState.load(context));
    }

    void drawAll(Context context, AppWidgetManager manager, WidgetState state) {
        for (int id : manager.getAppWidgetIds(new ComponentName(context, getClass()))) draw(context, manager, id, state);
    }

    void draw(Context context, AppWidgetManager manager, int widgetId, WidgetState state) {
        try {
            manager.updateAppWidget(widgetId, build(context, manager, widgetId, state));
        } catch (RuntimeException e) {
            // A drawing fault must not take the launcher's other widgets with it
            Log.w("HQWidgets", getClass().getSimpleName() + " could not draw", e);
        }
    }

    private RemoteViews build(Context context, AppWidgetManager manager, int widgetId, WidgetState state) {
        WidgetPalette palette = new WidgetPalette(context, state.theme());
        Bundle options = manager.getAppWidgetOptions(widgetId);
        float shownWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        float shownHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        Size[] sizes = sizes();

        // Android 12 and later: one layout per size, and the launcher picks as it resizes
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Map<SizeF, RemoteViews> map = new HashMap<>();
            for (Size size : sizes) {
                float w = Math.max(size.width, shownWidth), h = Math.max(size.height, shownHeight);
                map.put(new SizeF(size.width, size.height), layout(context, size, widgetId, state, palette, w, h));
            }
            return new RemoteViews(map);
        }

        // Older phones: pick the largest layout that fits the size the launcher reports
        Size chosen = sizes[0];
        for (Size size : sizes) {
            if (size.width <= shownWidth && size.height <= shownHeight) chosen = size;
        }
        return layout(context, chosen, widgetId, state, palette,
            Math.max(chosen.width, shownWidth), Math.max(chosen.height, shownHeight));
    }

    // Package-private so WidgetRenderTest can draw every size without a launcher
    RemoteViews layout(Context context, Size size, int widgetId, WidgetState state, WidgetPalette palette,
                       float width, float height) {
        RemoteViews views = new RemoteViews(context.getPackageName(), size.layout);
        palette.card(views);
        fill(context, views, size, widgetId, state, palette, width, height);
        return views;
    }

    /** Before the app has published anything: one line, and a tap opens the app. */
    static boolean noData(Context context, RemoteViews views, WidgetState state, int msgBox, int title, int body) {
        if (state.hasData()) return false;
        views.setTextViewText(title, "Open Health Quest");
        views.setTextViewText(body, "to start this widget");
        WidgetKit.show(views, msgBox, true);
        views.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/"));
        return true;
    }
}
