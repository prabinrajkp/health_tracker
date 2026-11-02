package com.healthquest.tracker;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;

/** What the widgets work out for themselves: date rules, waiting taps, the step by the clock. */
@RunWith(AndroidJUnit4.class)
public class WidgetStateTest {
    private static final long DAY = 86400000L;

    private static long at(int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.set(2026, Calendar.NOVEMBER, 5, hour, minute, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    private static final long NOON = at(13, 0);
    private static final String TODAY = WidgetState.day(NOON);
    private static final String YESTERDAY = WidgetState.day(NOON - DAY);

    private static JSONObject data(String date) throws Exception {
        return new JSONObject()
            .put("v", 2).put("date", date).put("sick", false)
            .put("drinks", new JSONObject().put("ml", 500).put("goalMl", 2400).put("glassMl", 300)
                .put("entries", new JSONArray().put(new JSONObject().put("id", "e1").put("ml", 250))
                    .put(new JSONObject().put("id", "e2").put("ml", 250))))
            .put("sleep", new JSONObject().put("startedAt", 0))
            .put("weight", new JSONObject().put("latest", 80.8).put("latestDate", YESTERDAY))
            .put("next", new JSONArray()
                .put(new JSONObject().put("from", "08:00").put("label", "Log breakfast"))
                .put(new JSONObject().put("from", "12:00").put("label", "Log lunch"))
                .put(new JSONObject().put("from", "22:00").put("label", "Start your sleep timer")))
            .put("nextNoSleep", new JSONArray()
                .put(new JSONObject().put("from", "08:00").put("label", "Log breakfast"))
                .put(new JSONObject().put("from", "12:00").put("label", "Log lunch"))
                .put(new JSONObject().put("from", "22:00").put("label", "Take a post-dinner walk")));
    }

    private static JSONObject item(String id, String type, long at, String date) throws Exception {
        return new JSONObject().put("id", id).put("type", type).put("at", at).put("date", date);
    }

    private static WidgetState state(JSONObject data, JSONObject... pending) {
        return WidgetState.of(data, new ArrayList<>(Arrays.asList(pending)), NOON);
    }

    @Test
    public void yesterdaysDataIsNeverToday() throws Exception {
        assertTrue(state(data(TODAY)).fresh);
        assertFalse(state(data(YESTERDAY)).fresh);
        assertFalse(state(data(WidgetState.day(NOON - 7 * DAY))).fresh);
        assertNull(state(data(YESTERDAY)).nextStep());
    }

    @Test
    public void drinksAddGlassesTappedSince() throws Exception {
        WidgetState s = state(data(TODAY),
            item("a", "water", NOON - 2000, TODAY).put("ml", 300),
            item("b", "water", NOON - 1000, TODAY).put("ml", 300),
            item("old", "water", NOON - DAY, YESTERDAY).put("ml", 300));
        assertEquals(1100, s.waterMl());
        assertEquals(300, s.glassMl());
    }

    @Test
    public void drinksStartAtZeroAfterMidnight() throws Exception {
        WidgetState s = state(data(YESTERDAY), item("a", "water", NOON, TODAY).put("ml", 300));
        assertEquals(300, s.waterMl());
        assertEquals(2400, s.waterGoalMl());
        assertEquals(0, state(data(YESTERDAY).put("sick", true)).waterGoalMl());
    }

    @Test
    public void undoTakesBackTheLatestGlass() throws Exception {
        // A glass still waiting goes first
        assertEquals("a", state(data(TODAY), item("a", "water", NOON, TODAY).put("ml", 300)).undoTarget().optString("id"));
        // Then the ones the app saved, newest first, skipping any already undone
        assertEquals("e2", state(data(TODAY)).undoTarget().optString("id"));
        WidgetState undone = state(data(TODAY), item("u", "water_undo", NOON, TODAY).put("target", "e2").put("ml", 250));
        assertEquals("e1", undone.undoTarget().optString("id"));
        assertEquals(250, undone.waterMl());
        assertNull(state(data(YESTERDAY)).undoTarget());
    }

    @Test
    public void theTimerFollowsStartsAndStopsTappedHere() throws Exception {
        long start = at(23, 0) - DAY;
        WidgetState running = state(data(TODAY), item("s", "sleep_start", start, YESTERDAY));
        assertEquals(start, running.timerStart());
        assertNull(running.pendingStop());

        WidgetState stopped = state(data(TODAY), item("s", "sleep_start", start, YESTERDAY),
            item("t", "sleep_stop", NOON, TODAY).put("startedAt", start));
        assertEquals(0, stopped.timerStart());
        assertEquals("t", stopped.pendingStop().optString("id"));

        // A start tapped here never moves a timer the app already runs
        JSONObject appRunning = data(TODAY);
        appRunning.getJSONObject("sleep").put("startedAt", start - 1000);
        assertEquals(start - 1000, state(appRunning, item("s", "sleep_start", start, YESTERDAY)).timerStart());
    }

    @Test
    public void theNextStepIsPickedByTheClock() throws Exception {
        assertEquals("Log lunch", state(data(TODAY)).nextStep().optString("label"));
        assertEquals(at(22, 0), state(data(TODAY)).nextStepChange());
        // A timer started here: the app's own sleep steps no longer apply
        WidgetState timer = WidgetState.of(data(TODAY), new ArrayList<>(Arrays.asList(
            item("s", "sleep_start", at(22, 30), TODAY))), at(22, 40));
        assertEquals("Take a post-dinner walk", timer.nextStep().optString("label"));
    }

    @Test
    public void aWeightSavedHereShowsAtOnce() throws Exception {
        assertEquals(80.8, state(data(TODAY)).latestKg(), 0.001);
        assertFalse(state(data(TODAY)).weighedToday());
        WidgetState saved = state(data(TODAY), item("w", "weight", NOON, TODAY).put("kg", 80.4));
        assertEquals(80.4, saved.latestKg(), 0.001);
        assertTrue(saved.weighedToday());
        assertTrue(Double.isNaN(state(new JSONObject().put("v", 2).put("date", TODAY)).latestKg()));
    }

    @Test
    public void formatsMatchTheApp() {
        assertEquals("0.5 L", WidgetKit.litres(500));
        assertEquals("1.75 L", WidgetKit.litres(1750));
        assertEquals("2.0 L", WidgetKit.litres(2000));
        assertEquals("7h 30min", WidgetKit.hours(7.5));
        assertEquals("45 min", WidgetKit.hours(0.75));
        assertEquals("8h", WidgetKit.hours(8));
    }

    @Test
    public void noDataUntilTheAppPublishes() {
        List<JSONObject> none = new ArrayList<>();
        assertFalse(WidgetState.of(new JSONObject(), none, NOON).hasData());
    }
}
