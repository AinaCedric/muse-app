package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

import org.json.JSONObject;

/**
 * Boutons de la notification : ✅ Oui · ❌ Non · ✏️ Modifier (ta version) · 💬 Répondre.
 * La réponse est postée dans la discussion, exactement comme si tu l'écrivais dans le chat.
 */
public class NotifAnswer extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c, final Intent i) {
        final int issue = i.getIntExtra("issue", 0), nid = i.getIntExtra("nid", 0);
        final String kind = String.valueOf(i.getStringExtra("a")), mode = i.getStringExtra("mode");
        String typed = "";
        Bundle in = RemoteInput.getResultsFromIntent(i);
        if (in != null) { CharSequence t = in.getCharSequence(Notif.KEY_TEXT); if (t != null) typed = t.toString().trim(); }
        final String body;
        if ("OUI".equals(kind) || "NON".equals(kind)) body = kind;
        else if ("EDIT".equals(kind)) body = typed.isEmpty() ? "" : "Envoie plutôt exactement ce texte : « " + typed + " »";
        else body = typed;
        if (body.isEmpty()) return;
        final PendingResult pr = goAsync();
        final NotificationManager nm = c.getSystemService(NotificationManager.class);
        new Thread(new Runnable() {
            @Override public void run() {
                String done; boolean ok = false;
                try {
                    if (issue <= 0 || !Store.brainLinked(c)) throw new Exception("Cerveau non relié");
                    String full = body + ("REPLY".equals(kind) && mode != null && !"auto".equals(mode) && mode.matches("\\w{2,20}") ? "\n\n<!--mode:" + mode + "-->" : "");   // 💬 réponse libre : même mode que la discussion
                    Bus.Resp r = Bus.reqTok(Store.brainToken(c), "POST", "/repos/" + Store.brain(c) + "/issues/" + issue + "/comments",
                            new JSONObject().put("body", full).toString(), null);
                    if (r.code >= 300) throw new Exception("GitHub " + r.code);
                    ok = true;
                    done = "OUI".equals(kind) ? "C'est parti, je m'en occupe ✨" : "NON".equals(kind) ? "D'accord, j'annule. Rien n'est envoyé." : "EDIT".equals(kind) ? "Ta version est notée, je te la montre avant d'envoyer." : "Message reçu, je te réponds vite.";
                } catch (Throwable t) {
                    done = "Réponse non envoyée (" + t.getMessage() + ") : ouvre le chat Muse.";
                    Bus.log("Bouton notification : " + t.getMessage());
                }
                try {
                    Notification.Builder b = new Notification.Builder(c, "replies");
                    b.setSmallIcon(R.drawable.ic_stat_muse);
                    b.setColor(Notif.ACCENT);
                    b.setContentTitle(ok ? ("OUI".equals(kind) ? "✅ Accord donné" : "NON".equals(kind) ? "❌ Annulé" : "💬 Envoyé à Muse") : "⚠️ Muse");
                    b.setContentText(done);
                    b.setOnlyAlertOnce(true);
                    b.setTimeoutAfter(ok ? 5000 : 30000);
                    b.setAutoCancel(true);
                    nm.notify(nid, b.build());
                } catch (Throwable ignore) { }
                pr.finish();
            }
        }).start();
    }
}
