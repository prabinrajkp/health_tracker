package com.healthquest.tracker;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The checks on AI wording, for the background worker. The rules themselves (blocked
 * terms, allowed numbers, length limits) are handed over by the app's own validator in
 * services/nudgeWriter.js, so they stay in one place.
 */
final class NudgeCopyCheck {
    private static final Pattern NUMBER = Pattern.compile("\\d+(?:\\.\\d+)?");
    private static final Pattern THOUSANDS = Pattern.compile("(\\d),(\\d)");
    private static final int MAX_EMOJI = 1;

    private NudgeCopyCheck() {}

    /** Returns null when the message passes, or a short reason when it does not. */
    static String check(String title, String body, Set<String> allowed, String blocked, String link,
                        String numberWords, int maxTitle, int maxBody) {
        if (title == null || body == null) return "not_text";
        title = title.trim();
        body = body.trim();
        if (title.isEmpty() || body.isEmpty()) return "empty";
        if (title.length() > maxTitle) return "title_too_long";
        if (body.length() > maxBody) return "body_too_long";
        String text = title + " " + body;
        Matcher m = NUMBER.matcher(THOUSANDS.matcher(text).replaceAll("$1$2"));
        while (m.find()) {
            if (!allowed.contains(m.group())) return "invented_number";
        }
        if (find(numberWords, text)) return "number_as_word";
        if (find(blocked, text)) return "blocked_term";
        if (find(link, text)) return "link";
        if (text.contains("!")) return "exclamation";
        if (emojiCount(text) > MAX_EMOJI) return "too_many_emoji";
        return null;
    }

    private static boolean find(String pattern, String text) {
        return pattern != null && !pattern.isEmpty()
            && Pattern.compile(pattern, Pattern.CASE_INSENSITIVE).matcher(text).find();
    }

    private static int emojiCount(String text) {
        return (int) text.codePoints().filter(c -> Character.getType(c) == Character.OTHER_SYMBOL).count();
    }
}
