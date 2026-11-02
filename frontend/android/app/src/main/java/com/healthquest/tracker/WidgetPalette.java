package com.healthquest.tracker;

import android.content.Context;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * The app's theme on a widget. Colours come from widget_colors.xml in res/values and
 * res/values-night, which scripts/gen_widget_colors.mjs generates from src/index.css.
 *
 * With the app on System, colours are left to the launcher (Android 12 and later), so
 * the widget switches with the phone, even at a scheduled sunset, without an update.
 * With the app forced to Light or Dark, each colour is set directly, since the phone
 * may be in the other mode.
 */
final class WidgetPalette {
    static final int CARD = 0, TILE = 1, BORDER = 2, EDGE = 3, TEXT = 4, TEXT2 = 5, MUTED = 6,
        BRAND = 7, ON_BRAND = 8, SUCCESS = 9, WARNING = 10, DANGER = 11, WATER = 12,
        DIET = 13, FASTING = 14, WORKOUT = 15, SLEEP = 16;

    private static final int[] AUTO = {
        R.color.widget_card, R.color.widget_tile, R.color.widget_border, R.color.widget_edge,
        R.color.widget_text, R.color.widget_text2, R.color.widget_muted, R.color.widget_brand,
        R.color.widget_on_brand, R.color.widget_success, R.color.widget_warning, R.color.widget_danger,
        R.color.widget_water, R.color.widget_diet, R.color.widget_fasting, R.color.widget_workout,
        R.color.widget_sleep,
    };
    private static final int[] LIGHT = {
        R.color.hq_light_card, R.color.hq_light_tile, R.color.hq_light_border, R.color.hq_light_edge,
        R.color.hq_light_text, R.color.hq_light_text2, R.color.hq_light_muted, R.color.hq_light_brand,
        R.color.hq_light_on_brand, R.color.hq_light_success, R.color.hq_light_warning, R.color.hq_light_danger,
        R.color.hq_light_water, R.color.hq_light_diet, R.color.hq_light_fasting, R.color.hq_light_workout,
        R.color.hq_light_sleep,
    };
    private static final int[] DARK = {
        R.color.hq_dark_card, R.color.hq_dark_tile, R.color.hq_dark_border, R.color.hq_dark_edge,
        R.color.hq_dark_text, R.color.hq_dark_text2, R.color.hq_dark_muted, R.color.hq_dark_brand,
        R.color.hq_dark_on_brand, R.color.hq_dark_success, R.color.hq_dark_warning, R.color.hq_dark_danger,
        R.color.hq_dark_water, R.color.hq_dark_diet, R.color.hq_dark_fasting, R.color.hq_dark_workout,
        R.color.hq_dark_sleep,
    };

    // The grade chip and status tints: the tone at 14% over the card, as on Today
    private static final int SOFT_ALPHA = Math.round(0.14f * 255);

    private final Context context;
    private final int[] forced;

    WidgetPalette(Context context, String theme) {
        this.context = context;
        this.forced = "light".equals(theme) ? LIGHT : "dark".equals(theme) ? DARK : null;
    }

    /** Calls `method` (setTextColor, setColorFilter) on the view with the role's colour. */
    void apply(RemoteViews views, int viewId, String method, int role) {
        if (forced != null) views.setInt(viewId, method, context.getColor(forced[role]));
        else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) views.setColor(viewId, method, AUTO[role]);
        else views.setInt(viewId, method, context.getColor(AUTO[role]));
    }

    void text(RemoteViews views, int viewId, int role) {
        apply(views, viewId, "setTextColor", role);
    }

    /** For an image drawn in white: icons, shapes, bars and charts. */
    void tint(RemoteViews views, int viewId, int role) {
        apply(views, viewId, "setColorFilter", role);
    }

    /**
     * The tone at 14% over the card. A tint cannot carry the transparency itself: Android
     * blends it onto the white shape, which gives a pale opaque pill in dark mode.
     */
    void soft(RemoteViews views, int viewId, int role) {
        tint(views, viewId, role);
        views.setInt(viewId, "setImageAlpha", SOFT_ALPHA);
    }

    /**
     * The card behind every widget: a solid surface, with a border in light mode only. On
     * System the border is coloured by the launcher, so it goes at night by itself.
     */
    void card(RemoteViews views) {
        tint(views, R.id.w_bg_fill, CARD);
        WidgetKit.show(views, R.id.w_bg_edge, forced != DARK);
        if (forced == LIGHT) {
            views.setImageViewResource(R.id.w_bg_edge, R.drawable.w_card_edge);
            tint(views, R.id.w_bg_edge, BORDER);
        } else if (forced == null) {
            views.setImageViewResource(R.id.w_bg_edge, R.drawable.w_card_edge_auto);
        }
    }

    /** A score or status tone from the app (success, brand, warning, danger) as a colour role. */
    static int tone(String tone) {
        switch (tone == null ? "" : tone) {
            case "success": return SUCCESS;
            case "warning": return WARNING;
            case "danger": return DANGER;
            case "brand": return BRAND;
            default: return TEXT2;
        }
    }

}
