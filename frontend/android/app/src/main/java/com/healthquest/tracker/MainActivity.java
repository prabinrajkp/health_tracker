package com.healthquest.tracker;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(NudgeBackgroundPlugin.class);
        registerPlugin(WidgetsPlugin.class);
        super.onCreate(savedInstanceState);
        rememberNudgeTap(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        rememberNudgeTap(intent);
    }

    // A tap on a notification the background worker posted, or on a widget. The app reads
    // it on resume and opens that screen.
    private void rememberNudgeTap(Intent intent) {
        String route = intent == null ? null : intent.getStringExtra(NudgeAlarmReceiver.EXTRA_ROUTE);
        if (route == null) return;
        NudgeWorker.prefs(this).edit()
            .putString(NudgeWorker.KEY_TAP_ROUTE, route)
            .putString(NudgeWorker.KEY_TAP_KEY, intent.getStringExtra(NudgeAlarmReceiver.EXTRA_KEY))
            .apply();
        intent.removeExtra(NudgeAlarmReceiver.EXTRA_ROUTE);
    }
}
