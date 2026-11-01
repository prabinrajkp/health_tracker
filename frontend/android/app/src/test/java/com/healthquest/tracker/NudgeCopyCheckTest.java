package com.healthquest.tracker;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

public class NudgeCopyCheckTest {
    private static final String BLOCKED = "diagnos|eat less|because";
    private static final String LINK = "https?:|www\\.";
    private static final String WORDS = "\\b(two|three)\\b";
    private static final Set<String> ALLOWED = new HashSet<>(Arrays.asList("5", "8000"));

    private String check(String title, String body) {
        return NudgeCopyCheck.check(title, body, ALLOWED, BLOCKED, LINK, WORDS, 35, 130);
    }

    @Test public void passesGoodCopy() { assertNull(check("Dinner soon", "Before 9 keeps points".replace("9", "5"))); }
    @Test public void readsThousands() { assertNull(check("Walk", "8,000 steps is the target")); }
    @Test public void rejectsInventedNumber() { assertEquals("invented_number", check("Dinner", "Worth 7 points")); }
    @Test public void rejectsNumberWord() { assertEquals("number_as_word", check("Dinner", "Worth three points")); }
    @Test public void rejectsBlockedTerm() { assertEquals("blocked_term", check("Dinner", "Try to Eat Less tonight")); }
    @Test public void rejectsLink() { assertEquals("link", check("Dinner", "See www.example.org")); }
    @Test public void rejectsExclamation() { assertEquals("exclamation", check("Dinner", "Go on!")); }
    @Test public void rejectsLongTitle() { assertEquals("title_too_long", check("x".repeat(36), "ok")); }
    @Test public void rejectsLongBody() { assertEquals("body_too_long", check("ok", "x".repeat(131))); }
    @Test public void rejectsEmpty() { assertEquals("empty", check(" ", "ok")); }
    @Test public void allowsOneEmojiOnly() {
        assertNull(check("Walk 🚶", "Time for one"));
        assertEquals("too_many_emoji", check("Walk 🚶", "Time for one 🚶"));
    }
}
