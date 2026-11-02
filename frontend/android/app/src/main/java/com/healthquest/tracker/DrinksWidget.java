package com.healthquest.tracker;

import android.content.Context;
import android.widget.RemoteViews;

/**
 * Drinks: one tap, a glass of water. Drinks are not part of the score, so the widget
 * shows the full effect at once, with the same filling glass and goal tick as Today.
 */
public class DrinksWidget extends BaseWidget {
    private static final Size[] SIZES = {
        new Size(R.layout.widget_drinks_xs, 40, 40),
        new Size(R.layout.widget_drinks_s, 110, 40),
        new Size(R.layout.widget_drinks_m, 110, 165),
    };
    // The glass's inside runs from 4 to 46 on its 50-high grid, as in WaterGlass.jsx
    private static final double GLASS_TOP = 4, GLASS_BOTTOM = 46, GLASS_HEIGHT = 50;

    @Override
    Size[] sizes() {
        return SIZES;
    }

    @Override
    void fill(Context context, RemoteViews v, Size size, int widgetId, WidgetState state, WidgetPalette p,
              float width, float height) {
        p.tint(v, R.id.d_glass_body, WidgetPalette.TILE);
        p.tint(v, R.id.d_glass_water, WidgetPalette.WATER);
        p.tint(v, R.id.d_glass_edge, WidgetPalette.EDGE);
        p.text(v, R.id.d_head, WidgetPalette.TEXT2);
        p.text(v, R.id.d_total, WidgetPalette.TEXT);
        p.text(v, R.id.d_size, WidgetPalette.MUTED);
        p.tint(v, R.id.d_undo_bg, WidgetPalette.TILE);
        p.tint(v, R.id.d_undo_icon, WidgetPalette.TEXT2);

        int ml = state.waterMl();
        int goal = state.waterGoalMl();
        int glass = state.glassMl();
        boolean reached = goal > 0 && ml >= goal;
        double share = goal > 0 ? Math.min(1, ml / (double) goal) : 0;

        // Filled the same way as the app: the water rises over the inside of the glass only
        double visible = share > 0 ? (GLASS_HEIGHT - GLASS_BOTTOM) + (GLASS_BOTTOM - GLASS_TOP) * share : 0;
        // The layout holds a half-full picture for the picker; the real glass fills by level
        v.setImageViewResource(R.id.d_glass_water, R.drawable.w_glass_water);
        v.setInt(R.id.d_glass_water, "setImageLevel", (int) Math.round(visible / GLASS_HEIGHT * WidgetKit.LEVEL_MAX));
        WidgetKit.show(v, R.id.d_glass_tick, reached);

        boolean small = size.layout == R.layout.widget_drinks_xs;
        v.setTextViewText(R.id.d_total, WidgetKit.litres(ml));
        String of = reached ? (width >= 170 ? "Goal reached" : "Reached") : goal > 0 ? "of " + WidgetKit.litres(goal) : state.sick() ? "Sick day" : "today";
        v.setTextViewText(R.id.d_of, of);
        p.text(v, R.id.d_of, reached ? WidgetPalette.SUCCESS : WidgetPalette.MUTED);
        v.setTextViewText(R.id.d_size, glass + " mL glass");

        // Past the goal it still adds, and earns nothing extra, as in the app
        String add = "Add a " + glass + " mL glass of water";
        p.tint(v, R.id.d_add_bg, reached ? WidgetPalette.TILE : WidgetPalette.BRAND);
        p.tint(v, R.id.d_add_icon, reached ? WidgetPalette.TEXT : WidgetPalette.ON_BRAND);
        p.text(v, R.id.d_add_label, reached ? WidgetPalette.TEXT : WidgetPalette.ON_BRAND);
        WidgetKit.show(v, R.id.d_add_label, width >= 170);
        v.setOnClickPendingIntent(R.id.d_add, WidgetKit.action(context, WidgetActionReceiver.WATER, widgetId, 0));
        v.setContentDescription(R.id.d_add, add);

        WidgetKit.show(v, R.id.d_undo, state.undoTarget() != null);
        v.setOnClickPendingIntent(R.id.d_undo, WidgetKit.action(context, WidgetActionReceiver.WATER_UNDO, widgetId, 0));

        // The smallest size is one button: the whole widget adds a glass
        if (small) {
            v.setOnClickPendingIntent(android.R.id.background, WidgetKit.action(context, WidgetActionReceiver.WATER, widgetId, 0));
            v.setContentDescription(android.R.id.background, add + ". " + WidgetKit.litres(ml) + " so far");
        } else {
            v.setOnClickPendingIntent(android.R.id.background, WidgetKit.open(context, "/"));
        }
    }
}
