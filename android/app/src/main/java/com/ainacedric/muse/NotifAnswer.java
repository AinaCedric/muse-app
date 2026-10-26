package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Bouton « Oui » / « Non » d'une notification : poste la réponse dans la discussion (comme si tu l'écrivais dans le chat). */
public class NotifAnswer extends BroadcastReceiver {
    @Override
    public void onReceive(final Context c, final Intent i) {
        final int issue = i.getIntExtra("issue", 0), nid = i.getIntExtra("nid", 0);
        final String a = "NON".equals(i.getStringExtra("a")) ? "NON" : "OUI";
        final PendingResult pr = goAsync();
        final NotificationManager nm = c.getSystemService(NotificationManager.class);
        new Thread(new Runnable() {
            @Override public void run() {
                String done;
                try {
                    if (issue <= 0 || !Store.brainLinked(c)) throw new Exception("Cerveau non relié");
                    Bus.Resp r = Bus.reqTok(Store.brainToken(c), "POST", "/repos/" + Store.brain(c) + "/issues/" + issue + "/comments",
                            new JSONObject().put("body", a).toString(), null);
                    if (r.code >= 300) throw new Exception("GitHub " + r.code);
                    done = "OUI".equals(a) ? "✅ « Oui » envoyé : Muse s'en occupe" : "❌ « Non » envoyé : Muse annule";
                } catch (Throwable t) {
                    done = "⚠️ Réponse non envoyée (" + t.getMessage() + ") : ouvre le chat Muse";
                    Bus.log("Bouton notification : " + t.getMessage());
                }
                try {
                    Notification.Builder b = new Notification.Builder(c, "replies");
                    b.setSmallIcon(R.mipmap.ic_launcher);
                    b.setContentTitle("Muse");
                    b.setContentText(done);
                    b.setTimeoutAfter(6000);
                    b.setAutoCancel(true);
                    nm.notify(nid, b.build());
                } catch (Throwable ignore) { }
                pr.finish();
            }
        }).start();
    }
}
