package com.ainacedric.muse;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Envoie une demande à Muse (issue du dépôt « cerveau ») et attend sa réponse, sans quitter l'écran où l'on est.
 * La même discussion est réutilisée pendant 30 min : les confirmations (« OUI 1234 ») et les relances fonctionnent.
 */
class Ask {
    interface Cb {
        void waiting(int seconds);
        void reply(String raw);
        void error(String msg);
    }

    private final Context ctx;
    private final Cb cb;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private volatile boolean stop = false;

    Ask(Context c, Cb cb) {
        this.ctx = c.getApplicationContext();
        this.cb = cb;
    }

    void cancel() { stop = true; }

    static void forgetConversation(Context c) { Store.setPanelIssue(c, 0, 0); }

    void start(final String q, final String mode) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    go(q, mode);
                } catch (final Exception e) {
                    post(new Runnable() { @Override public void run() { cb.error(e.getMessage() == null ? e.toString() : e.getMessage()); } });
                }
            }
        }, "muse-ask").start();
    }

    private void post(Runnable r) { if (!stop) ui.post(r); }

    private Bus.Resp call(String method, String path, String body) throws Exception {
        Bus.Resp r = Bus.reqTok(Store.brainToken(ctx), method, path, body, null);
        if (r.code == 401) throw new Exception("Jeton « Cerveau » refusé : recopie le code depuis la PWA (⚙️ Réglages).");
        if (r.code == 404) throw new Exception("Dépôt cerveau introuvable : vérifie le code « Cerveau ».");
        if (r.code >= 400) throw new Exception("GitHub a répondu " + r.code);
        return r;
    }

    private void go(String q, String mode) throws Exception {
        String repo = Store.brain(ctx);
        int n = Store.panelIssue(ctx);
        long now = System.currentTimeMillis();
        if (n <= 0 || now - Store.panelAt(ctx) > 30 * 60 * 1000L) {
            String title = ("📱 " + q).replace("\n", " ");
            if (title.length() > 60) title = title.substring(0, 60);
            JSONObject o = new JSONObject();
            o.put("title", title);
            o.put("body", "💬 Discussion Muse (panneau du téléphone)");
            Bus.Resp r = call("POST", "/repos/" + repo + "/issues", o.toString());
            n = new JSONObject(r.body).getInt("number");
        }
        JSONObject c = new JSONObject();
        c.put("body", q + "\n\n<!--mode:" + mode + "-->");
        Bus.Resp pr = call("POST", "/repos/" + repo + "/issues/" + n + "/comments", c.toString());
        JSONObject pj = new JSONObject(pr.body);
        final long mine = pj.getLong("id");
        final String since = pj.optString("created_at", "");
        Store.setPanelIssue(ctx, n, System.currentTimeMillis());
        Bus.log("Panneau : demande envoyée (discussion n°" + n + ")");

        long t0 = System.currentTimeMillis();
        int fails = 0;
        while (!stop && System.currentTimeMillis() - t0 < 8 * 60 * 1000L) {
            try {
                Thread.sleep(2500);
            } catch (InterruptedException e) { return; }
            if (stop) return;
            final int sec = (int) ((System.currentTimeMillis() - t0) / 1000);
            post(new Runnable() { @Override public void run() { cb.waiting(sec); } });
            try {
                Bus.Resp r = call("GET", "/repos/" + repo + "/issues/" + n + "/comments?per_page=100" + (since.isEmpty() ? "" : "&since=" + since), null);
                fails = 0;
                JSONArray a = new JSONArray(r.body);
                for (int i = 0; i < a.length(); i++) {
                    JSONObject k = a.getJSONObject(i);
                    if (k.getLong("id") <= mine) continue;
                    final String body = k.getString("body");
                    if (body.contains("<!--muse-reply-->") || body.contains("<!--muse-error-->")) {
                        Store.setPanelIssue(ctx, Store.panelIssue(ctx), System.currentTimeMillis());
                        post(new Runnable() { @Override public void run() { cb.reply(body); } });
                        return;
                    }
                }
            } catch (Exception e) {
                if (++fails >= 5) throw e;
            }
        }
        if (!stop) throw new Exception("Muse met trop de temps à répondre : regarde dans le chat.");
    }

    /** Nombre d'images jointes à la réponse (affichées dans le chat, pas dans le panneau). */
    static int imgCount(String raw) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\[\\[IMG:").matcher(raw);
        int n = 0;
        while (m.find()) n++;
        return n;
    }

    /** Texte lisible : sans balises cachées ni mise en forme Markdown. keepEmoji=false pour la voix. */
    static String plain(String raw, boolean forSpeech) {
        String s = raw.replaceAll("(?s)<!--.*?-->", "").replaceAll("[ \\t]*\\[\\[IMG:[^\\]]*\\]\\][ \\t]*", "");
        {   // cartes d'actualités : on garde titres + texte, sans les lignes techniques (image, sources…)
            java.util.regex.Matcher cm = java.util.regex.Pattern.compile("(?s)```[ \\t]*muse-cards[^\\n]*\\n(.*?)(```|$)").matcher(s);
            StringBuffer sb = new StringBuffer();
            while (cm.find()) {
                String body = cm.group(1)
                        .replaceAll("(?im)^\\s*(badge|img|image|sources?|date)\\s*:.*$", "")
                        .replaceAll("(?im)^\\s*int[ée]r[êe]t\\s*:\\s*", "👉 ")
                        .replaceAll("(?m)^\\s*#{2,3}\\s+", "\\n▪ ");
                cm.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(body));
            }
            cm.appendTail(sb);
            s = sb.toString();
        }
        s = s.replaceAll("(?s)```muse-ui.*?(```|$)", forSpeech ? " J'ai préparé une interface interactive, ouvre le chat pour l'utiliser. " : "\n🧩 Interface interactive : ouvre le chat Muse pour l'utiliser.\n");
        s = s.replaceAll("(?s)```.*?```", forSpeech ? " (bloc de code) " : "");
        s = s.replaceAll("(?m)^\\s*🧭.*$", "");
        s = s.replaceAll("\\[([^\\]]+)\\]\\((https?://[^)]+)\\)", forSpeech ? "$1" : "$1");
        s = s.replaceAll("https?://\\S+", forSpeech ? "lien" : "$0");
        s = s.replaceAll("(?m)^\\s{0,3}#{1,6}\\s*", "");
        s = s.replaceAll("(\\*\\*|__|`)", "");
        s = s.replaceAll("(?m)^\\s*[-*]\\s+", "• ");
        s = s.replaceAll("(?<![\\w*])[*_](\\S[^*_\\n]*?)[*_](?![\\w*])", "$1");
        if (forSpeech) {
            s = s.replaceAll("[\\p{So}\\p{Cs}\\uFE0F\\u200D•]", " ");
            s = s.replaceAll("(?m)^\\s*\\|.*$", "");
            s = s.replaceAll("[ \\t]+", " ").trim();
            s = s.replaceAll("(?<=[^.!?:;,\\s])\\s*\\n+\\s*", ". ");
        }
        s = s.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
        return s;
    }
}
