package com.ainacedric.muse;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import org.json.JSONObject;

/** Réglages enregistrés sur le téléphone (jamais envoyés ailleurs que vers le dépôt GitHub privé de liaison). */
class Store {
    static SharedPreferences p(Context c) {
        return c.getSharedPreferences("muse", Context.MODE_PRIVATE);
    }

    static String repo(Context c) { return p(c).getString("repo", ""); }
    static String token(Context c) { return p(c).getString("token", ""); }
    static int issue(Context c) { return p(c).getInt("issue", 1); }
    static long lastId(Context c) { return p(c).getLong("lastId", 0); }
    static void setLastId(Context c, long id) { p(c).edit().putLong("lastId", id).apply(); }
    static boolean paused(Context c) { return p(c).getBoolean("paused", false); }
    static void setPaused(Context c, boolean v) { p(c).edit().putBoolean("paused", v).apply(); }
    static String brain(Context c) { return p(c).getString("brain", ""); }
    static String brainToken(Context c) { return p(c).getString("brainTok", ""); }
    static boolean brainLinked(Context c) { return !brain(c).isEmpty() && !brainToken(c).isEmpty(); }
    static int panelIssue(Context c) { return p(c).getInt("pIssue", 0); }
    static long panelAt(Context c) { return p(c).getLong("pAt", 0); }
    static void setPanelIssue(Context c, int n, long at) { p(c).edit().putInt("pIssue", n).putLong("pAt", at).apply(); }
    static boolean speak(Context c) { return p(c).getBoolean("speak", true); }
    static void setSpeak(Context c, boolean v) { p(c).edit().putBoolean("speak", v).apply(); }
    static boolean notify(Context c) { return p(c).getBoolean("notify", true); }
    static void setNotify(Context c, boolean v) { p(c).edit().putBoolean("notify", v).apply(); }
    static boolean wake(Context c) { return p(c).getBoolean("wake", false); }
    static void setWake(Context c, boolean v) { p(c).edit().putBoolean("wake", v).apply(); }
    static boolean linked(Context c) { return !repo(c).isEmpty() && !token(c).isEmpty(); }

    /** Code de liaison : "MUSE1." + base64url({"r":"user/depot","t":"jeton","i":1}) */
    static void link(Context c, String code) throws Exception {
        code = code == null ? "" : code.trim();
        if (!code.startsWith("MUSE1.")) throw new Exception("Code invalide : il doit commencer par MUSE1.");
        byte[] raw = Base64.decode(code.substring(6).replaceAll("\\s", ""), Base64.URL_SAFE | Base64.NO_WRAP);
        JSONObject j = new JSONObject(new String(raw, "UTF-8"));
        String r = j.getString("r");
        String t = j.getString("t");
        int i = j.optInt("i", 1);
        if (!r.matches("[\\w.-]+/[\\w.-]+") || t.length() < 20) throw new Exception("Code incomplet ou abîmé.");
        p(c).edit().putString("repo", r).putString("token", t).putInt("issue", i).putLong("lastId", 0).apply();
    }

    /** Code « Cerveau » (copié depuis la PWA) : "MUSEB." + base64url({"r":"user/muse-brain","t":"jeton"}) */
    static void linkBrain(Context c, String code) throws Exception {
        code = code == null ? "" : code.trim();
        if (!code.startsWith("MUSEB.")) throw new Exception("Code invalide : il doit commencer par MUSEB.");
        byte[] raw = Base64.decode(code.substring(6).replaceAll("\\s", ""), Base64.URL_SAFE | Base64.NO_WRAP);
        JSONObject j = new JSONObject(new String(raw, "UTF-8"));
        String r = j.getString("r");
        String t = j.getString("t");
        if (!r.matches("[\\w.-]+/[\\w.-]+") || t.length() < 20) throw new Exception("Code incomplet ou abîmé.");
        p(c).edit().putString("brain", r).putString("brainTok", t).putInt("pIssue", 0).apply();
    }
}
