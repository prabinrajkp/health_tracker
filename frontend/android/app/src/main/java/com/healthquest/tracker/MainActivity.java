package com.healthquest.tracker;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        registerPlugin(NudgeBackgroundPlugin.class);
        super.onCreate(savedInstanceState);
        rememberNudgeTap(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        rememberNudgeTap(intent);
    }

    // A tap on a notification the background worker posted. The app reads it on resume.
    private void rememberNudgeTap(Intent intent) {
        String route = intent == null ? null : intent.getStringExtra(NudgeAlarmReceiver.EXTRA_ROUTE);
        if (route == null) return;
        NudgeWorker.prefs(this).edit()
            .putString(NudgeWorker.KEY_TAP_ROUTE, route)
            .putString(NudgeWorker.KEY_TAP_KEY, intent.getStringExtra(NudgeAlarmReceiver.EXTRA_KEY))
            .apply();
        intent.removeExtra(NudgeAlarmReceiver.EXTRA_ROUTE);
    }

    @Override
    public void onResume() {
        super.onResume();
        // After 3 s the JS side has had time to write widget_data.json — refresh widget.
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> HealthQuestWidget.updateAll(this), 3000);
    }
}
