package com.healthquest.tracker;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.util.Calendar;

/**
 * Redraws the widgets when the date changes, and when Today's next step moves on with
 * the clock. Not exact, and only while a widget is placed. A sleeping phone may run it
 * late, but the date is checked at every draw, so old data is never shown as today's.
 */
public class WidgetTicker extends BroadcastReceiver {
    private static final int REQUEST = 7001;
    private static final long AFTER_MIDNIGHT_MS = 30000;
    // The shortest window Android gives an app without the exact-alarm permission. Plain
    // set() let it slip by up to three quarters of the wait, half an hour past midnight.
    private static final long WINDOW_MS = 10 * 60000;

    @Override
    public void onReceive(Context context, Intent intent) {
        WidgetKit.updateAll(context);
    }

    static void schedule(Context context, WidgetState state) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent tick = PendingIntent.getBroadcast(context, REQUEST, new Intent(context, WidgetTicker.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (!WidgetKit.anyPlaced(context)) {
            alarms.cancel(tick);
            return;
        }
        Calendar midnight = Calendar.getInstance();
        midnight.setTimeInMillis(state.now);
        midnight.add(Calendar.DAY_OF_MONTH, 1);
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);
        long at = midnight.getTimeInMillis() + AFTER_MIDNIGHT_MS;
        long step = state.nextStepChange();
        if (step > state.now && step < at) at = step;
        // Not a wake-up alarm: a phone asleep gets it when the screen next comes on
        alarms.setWindow(AlarmManager.RTC, at, WINDOW_MS, tick);
    }
}
