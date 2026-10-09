package com.healthquest.tracker;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UsageStatsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        // After 3 s the JS side has had time to write widget_data.json — refresh widget.
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> HealthQuestWidget.updateAll(this), 3000);
    }
}
