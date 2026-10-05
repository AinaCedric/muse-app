package com.ainacedric.muse;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedList;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Relais entre le cerveau de Muse et le téléphone : une issue d'un dépôt GitHub PRIVÉ.
 * Le cerveau écrit un commentaire "<!--cmd:ID-->{json}", le téléphone l'exécute et répond "<!--res:ID-->{json}".
 */
class Bus {
    static final LinkedList<String> LOG = new LinkedList<>();
    static volatile long activeUntil = 0;
    private static String etag = null;

    static synchronized void log(String s) {
        LOG.addFirst(new SimpleDateFormat("HH:mm:ss", Locale.FRANCE).format(new Date()) + "  " + s);
        while (LOG.size() > 25) LOG.removeLast();
    }

    static synchronized String logText() {
        StringBuilder b = new StringBuilder();
        for (String s : LOG) b.append(s).append('\n');
        return b.length() == 0 ? "(rien pour l'instant)" : b.toString().trim();
    }

    static class Resp {
        int code;
        String body = "";
        String etag;
        long date;
    }

    static Resp req(Context c, String method, String path, String body, String ifNoneMatch) throws IOException {
        HttpURLConnection h = (HttpURLConnection) new URL("https://api.github.com" + path).openConnection();
        h.setRequestMethod(method);
        h.setConnectTimeout(10000);
        h.setReadTimeout(20000);
        h.setRequestProperty("Authorization", "Bearer " + Store.token(c));
        h.setRequestProperty("Accept", "application/vnd.github+json");
        h.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
        h.setRequestProperty("User-Agent", "MuseTelephone");
        if (ifNoneMatch != null) h.setRequestProperty("If-None-Match", ifNoneMatch);
        if (body != null) {
            h.setDoOutput(true);
            h.setRequestProperty("Content-Type", "application/json");
            OutputStream o = h.getOutputStream();
            o.write(body.getBytes(StandardCharsets.UTF_8));
            o.close();
        }
        Resp r = new Resp();
        r.code = h.getResponseCode();
        r.etag = h.getHeaderField("ETag");
        r.date = h.getDate();
        InputStream in;
        if (r.code >= 400) in = h.getErrorStream();
        else if (r.code == 304 || r.code == 204) in = null;
        else in = h.getInputStream();
        if (in != null) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
            r.body = bo.toString("UTF-8");
            in.close();
        }
        h.disconnect();
        return r;
    }

    static long ts(String iso) throws Exception {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.parse(iso).getTime();
    }

    /** Test de connexion depuis l'écran de réglages. */
    static String test(Context c) {
        try {
            Resp r = req(c, "GET", "/repos/" + Store.repo(c) + "/issues/" + Store.issue(c), null, null);
            if (r.code == 200) return "✅ Connecté au dépôt " + Store.repo(c) + " (relais n°" + Store.issue(c) + ")";
            if (r.code == 401) return "❌ Jeton refusé (expiré ou incorrect). Refais le code de liaison.";
            if (r.code == 404) return "❌ Dépôt ou issue introuvable : vérifie le code de liaison et les droits du jeton.";
            return "❌ GitHub a répondu " + r.code;
        } catch (Exception e) {
            return "❌ Pas de connexion : " + e.getMessage();
        }
    }

    /** Une relève : exécute les ordres en attente et poste les résultats. */
    static void poll(MuseService svc) throws Exception {
        if (!Store.linked(svc)) return;
        String repo = Store.repo(svc);
        int issue = Store.issue(svc);
        String list = "/repos/" + repo + "/issues/" + issue + "/comments?per_page=100";
        Resp r = req(svc, "GET", list, null, etag);
        if (r.code == 304) return;
        if (r.code != 200) {
            log("Relais GitHub : erreur " + r.code + (r.code == 401 ? " (jeton refusé)" : ""));
            return;
        }
        etag = r.etag;
        long now = r.date > 0 ? r.date : System.currentTimeMillis();
        JSONArray a = new JSONArray(r.body);
        long last = Store.lastId(svc);
        for (int i = 0; i < a.length(); i++) {
            JSONObject m = a.getJSONObject(i);
            long id = m.getLong("id");
            String b = m.optString("body", "");
            long age = now - ts(m.getString("created_at"));
            boolean mine = b.startsWith("<!--cmd:") || b.startsWith("<!--res:");
            if (mine && age > 15 * 60 * 1000) {
                try { req(svc, "DELETE", "/repos/" + repo + "/issues/comments/" + id, null, null); } catch (Exception ignore) { }
                continue;
            }
            if (!b.startsWith("<!--cmd:") || id <= last) continue;
            int end = b.indexOf("-->");
            if (end < 0) continue;
            String cid = b.substring(8, end);
            if (age > 4 * 60 * 1000) {          // ordre périmé : on ne l'exécute jamais
                Store.setLastId(svc, id);
                continue;
            }
            JSONObject res = new JSONObject();
            String opName = "?";
            try {
                JSONObject cmd = new JSONObject(b.substring(end + 3).trim());
                opName = cmd.optString("op", "?");
                activeUntil = System.currentTimeMillis() + 3 * 60 * 1000;
                if (Store.paused(svc) && !opName.equals("ping")) {
                    throw new Exception("Muse est en pause sur le téléphone : désactive « Pause » dans l'appli Muse.");
                }
                JSONObject out = svc.exec(cmd);
                res.put("ok", true);
                res.put("data", out);
                log("✓ " + opName);
            } catch (Exception e) {
                res.put("ok", false);
                res.put("error", e.getMessage() == null ? e.toString() : e.getMessage());
                log("✗ " + opName + " : " + e.getMessage());
            }
            String text = "<!--res:" + cid + "-->\n" + res.toString();
            req(svc, "POST", "/repos/" + repo + "/issues/" + issue + "/comments",
                    new JSONObject().put("body", text).toString(), null);
            Store.setLastId(svc, id);
            etag = null;
        }
    }
}
