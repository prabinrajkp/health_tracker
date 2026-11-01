package com.healthquest.tracker;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/** Shows a notification the background worker reworded. */
public class NudgeAlarmReceiver extends BroadcastReceiver {
    static final String EXTRA_ID = "hq_id";
    static final String EXTRA_TITLE = "hq_title";
    static final String EXTRA_BODY = "hq_body";
    static final String EXTRA_CHANNEL = "hq_channel";
    static final String EXTRA_ROUTE = "hq_route";
    static final String EXTRA_KEY = "hq_key";

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra(EXTRA_ID, 0);
        Intent open = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_ROUTE, intent.getStringExtra(EXTRA_ROUTE))
            .putExtra(EXTRA_KEY, intent.getStringExtra(EXTRA_KEY));
        PendingIntent tap = PendingIntent.getActivity(context, id, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, intent.getStringExtra(EXTRA_CHANNEL))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(intent.getStringExtra(EXTRA_TITLE))
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tap)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException e) {
            // Notifications were turned off after this was booked
        }
    }
}
