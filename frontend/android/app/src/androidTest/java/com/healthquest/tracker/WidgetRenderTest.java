package com.healthquest.tracker;

import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.RemoteViews;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Draws every widget, at the sizes a launcher gives it, in each state and theme, into
 * PNG files for checking by eye. Widgets cannot be checked in a browser, and placing
 * each size on a home screen by hand takes an afternoon.
 *
 * Needs the app to have published its data once. Run on an emulator or phone:
 *   ./gradlew connectedDebugAndroidTest
 *   adb pull /sdcard/Android/data/com.healthquest.tracker/files/widget-shots
 *
 * It replaces the published data and inbox while it runs, then puts them back.
 */
@RunWith(AndroidJUnit4.class)
public class WidgetRenderTest {
    // Cell sizes in dp, as measured on screen: Launcher3 on a Pixel 6, and a dense 5 x 6 grid
    private static final float[][] GRIDS = { { 73, 137 }, { 76, 84 } };
    private static final String[] GRID_NAMES = { "roomy", "dense" };
    // The spans each widget can be resized to, as columns x rows
    private static final Object[][] SPANS = {
        { new HealthQuestWidget(), "today", new int[][] { { 2, 1 }, { 2, 2 }, { 4, 2 }, { 4, 3 } } },
        { new WeekWidget(), "week", new int[][] { { 3, 1 }, { 4, 1 }, { 4, 2 } } },
        { new CaloriesWidget(), "calories", new int[][] { { 2, 1 }, { 4, 1 }, { 2, 2 } } },
        { new GoalsWidget(), "goals", new int[][] { { 2, 2 }, { 4, 2 } } },
        { new DrinksWidget(), "drinks", new int[][] { { 1, 1 }, { 2, 1 }, { 2, 2 } } },
        { new SleepWidget(), "sleep", new int[][] { { 2, 1 }, { 4, 1 } } },
        { new QuickLogWidget(), "quick", new int[][] { { 3, 1 }, { 4, 1 } } },
        { new WeightWidget(), "weight", new int[][] { { 2, 1 }, { 3, 2 } } },
    };
    private static final String[] THEMES = { "light", "dark", "system-day", "system-night" };
    // The picker preview of each widget at its default size, drawn straight from the layout
    // as Android 12 does. Older phones show these as images: res/drawable-nodpi/w_preview_*.png
    private static final Object[][] PREVIEWS = {
        { "today", R.layout.widget_today_m, 2, 2 }, { "week", R.layout.widget_week_m, 4, 1 },
        { "calories", R.layout.widget_cal_m, 2, 2 }, { "goals", R.layout.widget_goals_s, 2, 2 },
        { "drinks", R.layout.widget_drinks_s, 2, 1 }, { "sleep", R.layout.widget_sleep_s, 2, 1 },
        { "quick", R.layout.widget_quick, 4, 1 }, { "weight", R.layout.widget_weight_xs, 2, 1 },
    };

    @Test
    public void drawsEveryWidgetInEveryState() throws Exception {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File dir = new File(app.getExternalFilesDir(null), "widget-shots");
        dir.mkdirs();
        File dataFile = new File(app.getFilesDir(), WidgetStore.DATA_FILE);
        File inboxFile = new File(app.getFilesDir(), WidgetStore.INBOX_FILE);
        String published = read(dataFile);
        String inbox = inboxFile.exists() ? read(inboxFile) : null;
        assertTrue("Open the app once so it publishes widget data", published.contains("\"v\":2"));

        List<String> failures = new ArrayList<>();
        for (Object[] row : PREVIEWS) {
            float w = (int) row[2] * GRIDS[0][0], h = (int) row[3] * GRIDS[0][1];
            try {
                drawRaw(withNight(app, "system-day"), (int) row[1], w, h, new File(dir, "preview_" + row[0] + ".png"));
            } catch (Throwable e) {
                failures.add("preview " + row[0] + ": " + e);
            }
        }
        try {
            for (String scenario : new String[] { "day", "sick", "stale", "empty", "hidden", "running", "inbox" }) {
                JSONObject data = scenario(new JSONObject(published), scenario);
                for (String theme : THEMES) {
                    if (data != null) data.put("theme", theme.startsWith("system") ? "system" : theme);
                    WidgetStore.publish(app, data == null ? "{}" : data.toString(), null);
                    write(inboxFile, "inbox".equals(scenario) ? inboxItems(data) : "[]");
                    WidgetState state = WidgetState.load(app);
                    Context context = withNight(app, theme);
                    for (Object[] row : SPANS) {
                        BaseWidget widget = (BaseWidget) row[0];
                        for (int[] span : (int[][]) row[2]) {
                            for (int g = 0; g < GRIDS.length; g++) {
                                float w = span[0] * GRIDS[g][0], h = span[1] * GRIDS[g][1];
                                String name = row[1] + "_" + span[0] + "x" + span[1] + "_" + GRID_NAMES[g] + "_" + scenario + "_" + theme;
                                try {
                                    draw(context, widget, state, data == null ? "system" : data.optString("theme"), w, h,
                                        new File(dir, name + ".png"));
                                } catch (Throwable e) {
                                    failures.add(name + ": " + e);
                                }
                            }
                        }
                    }
                }
            }
        } finally {
            write(dataFile, published);
            if (inbox == null) inboxFile.delete(); else write(inboxFile, inbox);
        }
        assertTrue(String.join("\n", failures), failures.isEmpty());
    }

    // The largest layout that fits, as the launcher picks on Android 12 and later
    private static void draw(Context context, BaseWidget widget, WidgetState state, String theme, float w, float h,
                             File out) throws Exception {
        BaseWidget.Size chosen = widget.sizes()[0];
        for (BaseWidget.Size size : widget.sizes()) if (size.width <= w && size.height <= h) chosen = size;
        BaseWidget.Size size = chosen;
        float density = context.getResources().getDisplayMetrics().density;
        int wpx = Math.round(w * density), hpx = Math.round(h * density), pad = Math.round(12 * density);
        Bitmap bitmap = Bitmap.createBitmap(wpx + 2 * pad, hpx + 2 * pad, Bitmap.Config.ARGB_8888);
        Throwable[] error = new Throwable[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                RemoteViews views = widget.layout(context, size, 1, state, new WidgetPalette(context, theme), w, h);
                View view = views.apply(context, new FrameLayout(context));
                view.measure(View.MeasureSpec.makeMeasureSpec(wpx, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(hpx, View.MeasureSpec.EXACTLY));
                view.layout(0, 0, wpx, hpx);
                Canvas canvas = new Canvas(bitmap);
                canvas.drawColor(0xFF6B7280);   // a mid-grey wallpaper, so the card's edge shows
                canvas.translate(pad, pad);
                view.draw(canvas);
            } catch (Throwable e) {
                error[0] = e;
            }
        });
        if (error[0] != null) throw new RuntimeException(error[0]);
        try (FileOutputStream stream = new FileOutputStream(out)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        }
    }

    private static void drawRaw(Context context, int layout, float w, float h, File out) throws Exception {
        float density = context.getResources().getDisplayMetrics().density;
        int wpx = Math.round(w * density), hpx = Math.round(h * density);
        Bitmap bitmap = Bitmap.createBitmap(wpx, hpx, Bitmap.Config.ARGB_8888);
        Throwable[] error = new Throwable[1];
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            try {
                View view = new RemoteViews(context.getPackageName(), layout).apply(context, new FrameLayout(context));
                view.measure(View.MeasureSpec.makeMeasureSpec(wpx, View.MeasureSpec.EXACTLY),
                    View.MeasureSpec.makeMeasureSpec(hpx, View.MeasureSpec.EXACTLY));
                view.layout(0, 0, wpx, hpx);
                view.draw(new Canvas(bitmap));
            } catch (Throwable e) {
                error[0] = e;
            }
        });
        if (error[0] != null) throw new RuntimeException(error[0]);
        try (FileOutputStream stream = new FileOutputStream(out)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
        }
    }

    private static Context withNight(Context app, String theme) {
        Configuration config = new Configuration(app.getResources().getConfiguration());
        int night = "system-night".equals(theme) ? Configuration.UI_MODE_NIGHT_YES : Configuration.UI_MODE_NIGHT_NO;
        config.uiMode = (config.uiMode & ~Configuration.UI_MODE_NIGHT_MASK) | night;
        return app.createConfigurationContext(config);
    }

    private static JSONObject scenario(JSONObject data, String name) throws Exception {
        long now = System.currentTimeMillis();
        switch (name) {
            case "sick":
                data.put("sick", true).put("score", JSONObject.NULL).put("next", new JSONArray());
                data.getJSONObject("drinks").put("goalMl", 0);
                data.getJSONObject("calories").put("state", "sick");
                break;
            case "stale":
                data.put("date", WidgetState.day(now - 86400000L));
                break;
            case "empty":
                return null;
            case "hidden":
                data.put("calories", new JSONObject().put("state", "hidden"));
                break;
            case "running":
                data.getJSONObject("sleep").put("startedAt", now - (2 * 3600000L + 10 * 60000L));
                JSONObject drinks = data.getJSONObject("drinks");
                drinks.put("ml", drinks.optInt("goalMl", 2000));
                break;
            default:
                break;
        }
        return data;
    }

    // Two glasses, a stopped night and a weight tapped on widgets, waiting for the app
    private static String inboxItems(JSONObject data) throws Exception {
        long now = System.currentTimeMillis();
        String today = WidgetState.day(now);
        JSONArray items = new JSONArray();
        items.put(WidgetStore.item("water", now - 60000, today).put("ml", 250));
        items.put(WidgetStore.item("water", now - 30000, today).put("ml", 250));
        items.put(WidgetStore.item("sleep_start", now - 8 * 3600000L, today));
        items.put(WidgetStore.item("sleep_stop", now - 1000, today).put("startedAt", now - 8 * 3600000L));
        items.put(WidgetStore.item("weight", now, today).put("kg", 80.2));
        return items.toString();
    }

    private static String read(File file) throws Exception {
        return new String(java.nio.file.Files.readAllBytes(file.toPath()), "UTF-8");
    }

    private static void write(File file, String text) throws Exception {
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(text.getBytes("UTF-8"));
        }
    }
}
