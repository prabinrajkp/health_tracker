package com.healthquest.tracker;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The bridge between the app and its home-screen widgets. See services/widgetData.js. */
@CapacitorPlugin(name = "Widgets")
public class WidgetsPlugin extends Plugin {
    private static final String[] KINDS = { "today", "week", "calories", "goals", "drinks", "sleep", "quick", "weight" };

    // Fresh data, and the inbox items it already counts, which can now leave the inbox
    @PluginMethod
    public void publish(PluginCall call) {
        Context context = getContext();
        String data = call.getString("data");
        if (data == null) {
            call.reject("No data");
            return;
        }
        WidgetStore.publish(context, data, call.getArray("applied"));
        WidgetKit.updateAll(context);
        call.resolve();
    }

    @PluginMethod
    public void readInbox(PluginCall call) {
        JSObject result = new JSObject();
        result.put("items", WidgetStore.readInbox(getContext()).toString());
        call.resolve(result);
    }

    // Which widgets are on the home screen, and whether this launcher can add one from the app
    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        JSObject placed = new JSObject();
        for (String kind : KINDS) {
            placed.put(kind, manager.getAppWidgetIds(new ComponentName(context, WidgetKit.kind(kind))).length);
        }
        JSObject result = new JSObject();
        result.put("canPin", manager.isRequestPinAppWidgetSupported());
        result.put("placed", placed);
        call.resolve(result);
    }

    // Asks the launcher to place a widget. The launcher shows its own confirmation.
    @PluginMethod
    public void pin(PluginCall call) {
        Context context = getContext();
        Class<? extends BaseWidget> kind = WidgetKit.kind(call.getString("kind"));
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        JSObject result = new JSObject();
        result.put("requested", kind != null && manager.isRequestPinAppWidgetSupported()
            && manager.requestPinAppWidget(new ComponentName(context, kind), null, null));
        call.resolve(result);
    }
}
