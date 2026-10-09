package com.healthquest.tracker;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "UsageStats")
public class UsageStatsPlugin extends Plugin {

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageStatsPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Returns milliseconds the screen was ON between startTime and endTime.
     */
    @PluginMethod
    public void getScreenOnTime(PluginCall call) {
        Long startTime = call.getLong("startTime");
        if (startTime == null) { call.reject("startTime is required"); return; }
        long endTime = call.getLong("endTime", System.currentTimeMillis());

        if (!hasUsageStatsPermission()) {
            JSObject result = new JSObject();
            result.put("needsPermission", true);
            call.resolve(result);
            return;
        }

        UsageStatsManager usm = (UsageStatsManager) getContext()
                .getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents usageEvents = usm.queryEvents(startTime, endTime);

        long screenOnMs = 0L;
        long lastScreenOnTs = startTime;

        UsageEvents.Event event = new UsageEvents.Event();
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event);
            int type = event.getEventType();
            if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                if (lastScreenOnTs > 0) {
                    screenOnMs += event.getTimeStamp() - lastScreenOnTs;
                    lastScreenOnTs = -1;
                }
            } else if (type == UsageEvents.Event.SCREEN_INTERACTIVE) {
                if (lastScreenOnTs < 0) lastScreenOnTs = event.getTimeStamp();
            }
        }
        if (lastScreenOnTs > 0) screenOnMs += endTime - lastScreenOnTs;

        double screenOnHours = Math.round((screenOnMs / 3600000.0) * 10.0) / 10.0;
        JSObject result = new JSObject();
        result.put("needsPermission", false);
        result.put("screenOnMs", screenOnMs);
        result.put("screenOnHours", screenOnHours);
        call.resolve(result);
    }

    /**
     * Reads today's step count from the device's built-in STEP_COUNTER sensor.
     * Stores a daily baseline in SharedPreferences so cumulative sensor values
     * are converted to a daily step count. Handles device reboots gracefully.
     * Falls back with available=false if the sensor is absent or permission missing.
     */
    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor stepSensor = sm == null ? null : sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);

        if (stepSensor == null) {
            resolveNoSteps(call);
            return;
        }

        // ACTIVITY_RECOGNITION required on Android 10+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getContext().checkSelfPermission("android.permission.ACTIVITY_RECOGNITION")
                    != PackageManager.PERMISSION_GRANTED) {
                resolveNoSteps(call);
                return;
            }
        }

        call.setKeepAlive(true);

        final AtomicBoolean done = new AtomicBoolean(false);
        final SensorEventListener[] listenerRef = new SensorEventListener[1];

        listenerRef[0] = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (!done.compareAndSet(false, true)) return;
                sm.unregisterListener(listenerRef[0]);
                long raw = (long) event.values[0];
                long today = computeTodaySteps(raw);
                JSObject ret = new JSObject();
                ret.put("steps", (int) today);
                ret.put("available", true);
                call.resolve(ret);
            }
            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };

        sm.registerListener(listenerRef[0], stepSensor, SensorManager.SENSOR_DELAY_NORMAL);

        // Safety timeout — resolve with unavailable after 3 s if no sensor event fires
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!done.compareAndSet(false, true)) return;
            sm.unregisterListener(listenerRef[0]);
            resolveNoSteps(call);
        }, 3000);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private void resolveNoSteps(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("steps", 0);
        ret.put("available", false);
        call.resolve(ret);
    }

    /** Converts raw cumulative sensor value to today's step count using a stored baseline. */
    private long computeTodaySteps(long rawSteps) {
        SharedPreferences prefs = getContext()
                .getSharedPreferences("hq_steps", Context.MODE_PRIVATE);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String storedDate = prefs.getString("baseline_date", "");
        long baseline = prefs.getLong("baseline_steps", -1);

        if (!today.equals(storedDate) || baseline < 0) {
            // New day: set current reading as baseline; today's total = 0
            prefs.edit()
                    .putString("baseline_date", today)
                    .putLong("baseline_steps", rawSteps)
                    .apply();
            return 0;
        }

        if (rawSteps < baseline) {
            // Device rebooted: sensor reset; treat rawSteps as today's count
            prefs.edit().putLong("baseline_steps", 0).apply();
            return rawSteps;
        }

        return rawSteps - baseline;
    }

    private boolean hasUsageStatsPermission() {
        AppOpsManager appOps = (AppOpsManager) getContext()
                .getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    getContext().getPackageName());
        } else {
            mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    getContext().getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
