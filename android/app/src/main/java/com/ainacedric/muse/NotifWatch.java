package com.ainacedric.muse;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Parcelable;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Écoute des notifications pour les « Automatisations » de Muse.
 * - Les règles viennent du dépôt cerveau (data/automations.json), relues au plus toutes les 60 s.
 * - Quand une notification correspond à une règle, un commentaire est posté dans l'issue de cette règle : la GitHub Action de Muse s'en charge.
 * - La notification n'est jamais envoyée ailleurs que dans ce dépôt privé.
 * - Muse peut répondre via l'action « Répondre » de la notification (op notif_reply), sans toucher à l'écran.
 */
public class NotifWatch extends NotificationListenerService {
    static volatile NotifWatch inst;
    static volatile String state = "pas encore connecté";
    static volatile long lastEvent = 0;

    private static final ExecutorService EX = Executors.newSingleThreadExecutor();
    private static final SecureRandom RND = new SecureRandom();

    static class Pending {
        String id, pkg, from, key;
        PendingIntent pi;
        RemoteInput[] ri;
        long at;
        int sent;
    }

    private static final LinkedHashMap<String, Pending> PEND = new LinkedHashMap<>();
    private static final HashMap<String, Long> SEEN = new HashMap<>();
    private static final HashMap<String, ArrayList<Long>> RUNS = new HashMap<>();
    private static JSONArray rules = new JSONArray();
    private static long rulesAt = 0;
    private static String rulesEtag = null;
    private static boolean warnedBrain = false;

    // ---------- cycle de vie
    @Override
    public void onListenerConnected() {
        inst = this;
        state = "écoute active";
        Bus.log("Notifications : écoute active");
    }

    @Override
    public void onListenerDisconnected() {
        inst = null;
        state = "déconnecté (reconnexion…)";
        try { requestRebind(new ComponentName(this, NotifWatch.class)); } catch (Throwable ignore) { }
    }

    /** Appelée régulièrement par la relève : redemande la connexion si Android (ou MIUI) l'a coupée. */
    static void keep(Context c) {
        if (inst != null || !enabled(c)) return;
        try { NotificationListenerService.requestRebind(new ComponentName(c, NotifWatch.class)); } catch (Throwable ignore) { }
    }

    static boolean enabled(Context c) {
        String s = android.provider.Settings.Secure.getString(c.getContentResolver(), "enabled_notification_listeners");
        return s != null && s.contains(c.getPackageName());
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        final StatusBarNotification s = sbn;
        final Context app = getApplicationContext();
        EX.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    handle(app, s);
                } catch (Throwable t) {
                    Bus.log("Notification : " + t.getMessage());
                }
            }
        });
    }

    // ---------- utilitaires
    static String norm(String s) {
        if (s == null) return "";
        return Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT).trim();
    }

    private static String str(CharSequence c) { return c == null ? "" : c.toString().trim(); }

    private static String newId() {
        byte[] b = new byte[3];
        RND.nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private static String clean(String s, int max) {
        if (s == null) return "";
        s = s.replace("-->", "- >").replace("<!--", "< !--").replaceAll("[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]", " ");
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }

    /** Relit les règles (ETag : une réponse 304 ne coûte rien). */
    private static synchronized void refreshRules(Context c, boolean force) {
        long now = System.currentTimeMillis();
        if (!force && now - rulesAt < 60 * 1000L) return;
        rulesAt = now;
        if (!Store.brainLinked(c)) {
            if (!warnedBrain) { warnedBrain = true; Bus.log("Automatisations : colle d'abord le code Cerveau (étape 7)"); }
            return;
        }
        try {
            Bus.Resp r = Bus.reqTok(Store.brainToken(c), "GET", "/repos/" + Store.brain(c) + "/contents/data/automations.json", null, rulesEtag);
            if (r.code == 304) return;
            if (r.code == 404) { rules = new JSONArray(); rulesEtag = null; return; }
            if (r.code != 200) { Bus.log("Automatisations : GitHub " + r.code); return; }
            String b64 = new JSONObject(r.body).optString("content", "");
            String txt = new String(Base64.decode(b64, Base64.DEFAULT), "UTF-8");
            JSONObject root = new JSONObject(txt);
            rules = root.optJSONArray("items") == null ? new JSONArray() : root.getJSONArray("items");
            rulesEtag = r.etag;
        } catch (Throwable t) {
            Bus.log("Automatisations : lecture impossible (" + t.getMessage() + ")");
        }
    }

    private static boolean has(String hay, String needles) {
        for (String n : needles.split(",")) {
            n = norm(n);
            if (!n.isEmpty() && hay.contains(n)) return true;
        }
        return false;
    }

    private static Pending findReply(Notification n, String pkg, String from, String key) {
        if (n.actions == null) return null;
        for (Notification.Action a : n.actions) {
            RemoteInput[] ri = a.getRemoteInputs();
            if (ri == null || ri.length == 0 || a.actionIntent == null) continue;
            boolean free = false;
            for (RemoteInput r : ri) if (r.getAllowFreeFormInput()) free = true;
            if (!free) continue;
            Pending p = new Pending();
            p.id = newId();
            p.pkg = pkg;
            p.from = from;
            p.key = key;
            p.pi = a.actionIntent;
            p.ri = ri;
            p.at = System.currentTimeMillis();
            return p;
        }
        return null;
    }

    private static synchronized void keepPending(Pending p) {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Pending>> it = PEND.entrySet().iterator();
        while (it.hasNext()) if (now - it.next().getValue().at > 40 * 60 * 1000L) it.remove();
        while (PEND.size() >= 40) { it = PEND.entrySet().iterator(); it.next(); it.remove(); }
        PEND.put(p.id, p);
    }

    /** Détail lisible d'une notification : { title, text, sender, last } */
    private static JSONObject describe(Notification n) throws Exception {
        Bundle ex = n.extras;
        JSONObject o = new JSONObject();
        String title = str(ex == null ? null : ex.getCharSequence("android.title"));
        String text = str(ex == null ? null : ex.getCharSequence("android.text"));
        String big = str(ex == null ? null : ex.getCharSequence("android.bigText"));
        String conv = str(ex == null ? null : ex.getCharSequence("android.conversationTitle"));
        StringBuilder msgs = new StringBuilder();
        StringBuilder senders = new StringBuilder();
        String last = "";
        Parcelable[] ms = ex == null ? null : ex.getParcelableArray("android.messages");
        if (ms != null) {
            int from = Math.max(0, ms.length - 6);
            for (int i = from; i < ms.length; i++) {
                if (!(ms[i] instanceof Bundle)) continue;
                Bundle m = (Bundle) ms[i];
                String t = str(m.getCharSequence("text"));
                String who = str(m.getCharSequence("sender"));
                if (who.isEmpty()) who = title;
                if (!who.isEmpty() && senders.indexOf(who) < 0) senders.append(who).append(" | ");
                msgs.append(who).append(" : ").append(t).append("\n");
                last = who + "|" + t;
            }
        }
        if (last.isEmpty()) last = title + "|" + (big.isEmpty() ? text : big);
        o.put("title", title);
        o.put("conv", conv);
        o.put("text", big.isEmpty() ? text : big);
        o.put("messages", msgs.toString().trim());
        o.put("senders", senders.toString());
        o.put("last", last);
        return o;
    }

    // ---------- une notification arrive
    private static void handle(Context c, StatusBarNotification sbn) throws Exception {
        if (sbn == null || sbn.getPackageName().equals(c.getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null || sbn.isOngoing() || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        lastEvent = System.currentTimeMillis();
        refreshRules(c, false);
        if (rules.length() == 0) return;
        String pkg = sbn.getPackageName();
        JSONObject d = describe(n);
        String who = norm(d.optString("title") + " " + d.optString("conv") + " " + d.optString("senders"));
        String body = norm(d.optString("text") + " " + d.optString("messages"));
        if (who.trim().isEmpty() && body.trim().isEmpty()) return;
        String pk = norm(pkg);
        for (int i = 0; i < rules.length(); i++) {
            JSONObject r = rules.getJSONObject(i);
            if (!r.optBoolean("enabled", false) || r.optInt("issue", 0) <= 0) continue;
            JSONObject t = r.optJSONObject("trigger");
            if (t == null || !"notification".equals(t.optString("type", "notification"))) continue;
            String app = t.optString("app", "").trim();
            if (!app.isEmpty() && !has(pk, app)) continue;
            String match = t.optString("match", "").trim();
            String by = t.optString("by", "sender");
            boolean ok;
            if (match.isEmpty()) {
                // Sans nom ni mot : tous les messages de l'appli choisie (jamais « toutes les applis »), hors conversations de groupe
                if (app.isEmpty()) continue;
                ok = n.extras == null || !n.extras.getBoolean("android.isGroupConversation", false);
            } else {
                ok = "text".equals(by) ? has(body, match) : "any".equals(by) ? (has(who, match) || has(body, match)) : has(who, match);
            }
            if (!ok) continue;
            fire(c, r, pkg, sbn, n, d);
        }
    }

    private static synchronized boolean fresh(String sig) {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Long>> it = SEEN.entrySet().iterator();
        while (it.hasNext()) if (now - it.next().getValue() > 15 * 60 * 1000L) it.remove();
        if (SEEN.containsKey(sig)) return false;
        SEEN.put(sig, now);
        return true;
    }

    private static synchronized boolean underLimit(String rule, int perHour) {
        long now = System.currentTimeMillis();
        ArrayList<Long> l = RUNS.get(rule);
        if (l == null) { l = new ArrayList<>(); RUNS.put(rule, l); }
        Iterator<Long> it = l.iterator();
        while (it.hasNext()) if (now - it.next() > 3600 * 1000L) it.remove();
        if (l.size() >= perHour) return false;
        l.add(now);
        return true;
    }

    private static void fire(Context c, JSONObject r, String pkg, StatusBarNotification sbn, Notification n, JSONObject d) throws Exception {
        String rid = r.getString("id");
        String name = r.optString("name", "Automatisation");
        String sig = rid + "|" + pkg + "|" + d.optString("last").hashCode();
        if (!fresh(sig)) return;
        int per = Math.max(1, Math.min(60, r.optInt("maxPerHour", 6)));
        if (!underLimit(rid, per)) {
            Bus.log("⚡ " + name + " : limite de " + per + "/h atteinte, ignorée");
            return;
        }
        String from = d.optString("title");
        Pending p = r.optBoolean("autoReply", false) ? findReply(n, pkg, from, sbn.getKey()) : null;
        if (p != null) keepPending(p);
        JSONObject ctx = new JSONObject();
        ctx.put("pkg", clean(pkg, 80));
        ctx.put("from", clean(from, 80));
        ctx.put("reply", p == null ? "" : p.id);
        StringBuilder b = new StringBuilder();
        b.append("<!--auto:").append(rid).append("-->\n");
        b.append("<!--autoctx:").append(ctx.toString().replace("-->", "- >")).append("-->\n");
        b.append("⚡ **").append(clean(name, 80)).append("** : nouveau message\n\n");
        b.append("De : ").append(clean(from, 120)).append("  ·  appli : ").append(clean(pkg, 80)).append("\n\n");
        String m = d.optString("messages");
        b.append("```\n").append(clean(m.isEmpty() ? d.optString("text") : m, 1500).replace("```", "'''")).append("\n```\n");
        b.append("\n<!--mode:phone-->");
        Bus.Resp x = Bus.reqTok(Store.brainToken(c), "POST", "/repos/" + Store.brain(c) + "/issues/" + r.getInt("issue") + "/comments",
                new JSONObject().put("body", b.toString()).toString(), null);
        if (x.code >= 300) Bus.log("⚡ " + name + " : GitHub " + x.code + " (jeton Cerveau ou issue introuvable)");
        else Bus.log("⚡ " + name + " : Muse prévenue (" + clean(from, 30) + ")");
    }

    // ---------- ordres du cerveau
    /** op "notifs" : liste des notifications actuelles. op "notif_reply" : répond via l'action « Répondre ». */
    static JSONObject op(Context c, JSONObject cmd) throws Exception {
        String op = cmd.optString("op");
        if (op.equals("notifs")) {
            NotifWatch w = inst;
            if (w == null) throw new Exception("L'accès aux notifications n'est pas activé pour Muse (appli Muse Tél. → étape 9).");
            JSONArray out = new JSONArray();
            StatusBarNotification[] all = w.getActiveNotifications();
            if (all != null) {
                for (StatusBarNotification s : all) {
                    if (out.length() >= 25) break;
                    Notification n = s.getNotification();
                    if (n == null || s.getPackageName().equals(c.getPackageName()) || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) continue;
                    JSONObject d = describe(n);
                    JSONObject o = new JSONObject();
                    o.put("pkg", s.getPackageName());
                    o.put("title", clean(d.optString("title"), 100));
                    o.put("text", clean(d.optString("messages").isEmpty() ? d.optString("text") : d.optString("messages"), 400));
                    Pending p = findReply(n, s.getPackageName(), d.optString("title"), s.getKey());
                    if (p != null) { keepPending(p); o.put("reply", p.id); }
                    out.put(o);
                }
            }
            return new JSONObject().put("count", out.length()).put("notifications", out);
        }
        if (op.equals("notif_reply")) {
            String id = cmd.optString("id");
            String text = cmd.optString("text", "").trim();
            if (text.isEmpty()) throw new Exception("Texte vide.");
            if (text.length() > 600) text = text.substring(0, 600);
            Pending p;
            synchronized (NotifWatch.class) { p = PEND.get(id); }
            if (p == null) throw new Exception("Cette notification n'est plus disponible (déjà ouverte, effacée ou trop ancienne) : impossible de répondre sans ouvrir l'appli.");
            if (p.sent >= 3) throw new Exception("Déjà 3 réponses envoyées à cette notification.");
            Intent i = new Intent();
            Bundle b = new Bundle();
            for (RemoteInput r : p.ri) b.putCharSequence(r.getResultKey(), text);
            RemoteInput.addResultsToIntent(p.ri, i, b);
            try {
                p.pi.send(c, 0, i);
            } catch (PendingIntent.CanceledException e) {
                throw new Exception("La notification a été retirée : réponse impossible sans ouvrir l'appli.");
            }
            p.sent++;
            return new JSONObject().put("sent", true).put("to", p.from).put("app", p.pkg);
        }
        throw new Exception("Opération inconnue : " + op);
    }
}
