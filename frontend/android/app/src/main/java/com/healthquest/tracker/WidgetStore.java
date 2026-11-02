package com.healthquest.tracker;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The two files the widgets work from: the data the app publishes, and the inbox of
 * taps made on a widget that the app has not written to its database yet. The app's
 * data lives in the WebView's IndexedDB, which Android code cannot reach, so taps wait
 * here until the app next opens. See docs/widgets_plan.md §3.
 */
final class WidgetStore {
    static final String DATA_FILE = "widget_data.json";
    static final String INBOX_FILE = "widget_inbox.json";
    static final int DATA_VERSION = 2;
    private static final int MAX_INBOX = 500;
    private static final Object LOCK = new Object();
    private static final SecureRandom RANDOM = new SecureRandom();

    private WidgetStore() {}

    /** The published data, or an empty object before the app has published this version. */
    static JSONObject readData(Context context) {
        synchronized (LOCK) {
            try {
                JSONObject data = new JSONObject(read(new File(context.getFilesDir(), DATA_FILE)));
                return data.optInt("v") == DATA_VERSION ? data : new JSONObject();
            } catch (Exception e) {
                return new JSONObject();
            }
        }
    }

    static JSONArray readInbox(Context context) {
        synchronized (LOCK) {
            return inbox(context);
        }
    }

    static void addToInbox(Context context, JSONObject item) {
        synchronized (LOCK) {
            JSONArray items = inbox(context);
            // A very long wait for the app keeps the newest taps rather than failing
            while (items.length() >= MAX_INBOX) items.remove(0);
            items.put(item);
            write(new File(context.getFilesDir(), INBOX_FILE), items.toString());
        }
    }

    static boolean removeFromInbox(Context context, String id) {
        synchronized (LOCK) {
            JSONArray items = inbox(context);
            for (int i = items.length() - 1; i >= 0; i--) {
                if (id.equals(items.optJSONObject(i) == null ? null : items.optJSONObject(i).optString("id"))) {
                    items.remove(i);
                    write(new File(context.getFilesDir(), INBOX_FILE), items.toString());
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Saves fresh data and drops the inbox items it already counts, in one step under the
     * lock, so a widget never adds a tap on top of data that already includes it.
     */
    static void publish(Context context, String data, JSONArray applied) {
        synchronized (LOCK) {
            write(new File(context.getFilesDir(), DATA_FILE), data);
            if (applied == null || applied.length() == 0) return;
            Set<String> done = new HashSet<>();
            for (int i = 0; i < applied.length(); i++) done.add(applied.optString(i));
            JSONArray items = inbox(context);
            JSONArray keep = new JSONArray();
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item != null && !done.contains(item.optString("id"))) keep.put(item);
            }
            write(new File(context.getFilesDir(), INBOX_FILE), keep.toString());
        }
    }

    static String newId() {
        return "w" + System.currentTimeMillis() + "-" + Integer.toString(RANDOM.nextInt(1 << 20), 36);
    }

    static JSONObject item(String type, long at, String date) {
        JSONObject item = new JSONObject();
        try {
            item.put("id", newId()).put("type", type).put("at", at);
            if (date != null) item.put("date", date);
        } catch (JSONException e) {
            // Keys and values are all plain strings and numbers
        }
        return item;
    }

    private static JSONArray inbox(Context context) {
        try {
            return new JSONArray(read(new File(context.getFilesDir(), INBOX_FILE)));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static String read(File file) throws Exception {
        if (!file.exists()) return "";
        try (InputStream in = new FileInputStream(file)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    // Written to a temporary file and renamed, so a crash never leaves half a file
    private static void write(File file, String text) {
        File tmp = new File(file.getParentFile(), file.getName() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (Exception e) {
            return;
        }
        if (!tmp.renameTo(file)) tmp.delete();
    }
}
