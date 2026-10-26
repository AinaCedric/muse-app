package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.app.Notification.Action;
import android.graphics.drawable.Icon;

import org.json.JSONObject;

/** Notifications « Muse a répondu » et « Ton programme du jour », envoyées par le cerveau via le dépôt-relais. */
class Notif {
    private static int next = 100;

    static JSONObject show(Context c, JSONObject cmd) throws Exception {
        JSONObject out = new JSONObject();
        String title = cmd.optString("title", "Muse a répondu");
        String text = cmd.optString("text", "Ta réponse est prête.");
        int issue = cmd.optInt("issue", 0);

        // Pas de notification si tu regardes déjà la réponse (panneau de la bulle ouvert, ou chat Muse au premier plan)
        String why = "";
        if (Panel.cur != null) why = "panneau ouvert";
        else {
            MuseService s = MuseService.inst;
            String fg = "";
            try { if (s != null) fg = s.pkg(); } catch (Throwable ignore) { }
            if (fg.startsWith("org.chromium.webapk")) why = "chat Muse ouvert";
        }
        if (!Store.notify(c)) why = "notifications désactivées dans l'appli";
        if (!why.isEmpty()) {
            out.put("shown", false);
            out.put("why", why);
            Bus.log("Notification ignorée (" + why + ")");
            return out;
        }

        NotificationManager nm = c.getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel("replies", "Réponses de Muse", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Quand Muse a fini de répondre, et ton programme du matin");
        nm.createNotificationChannel(ch);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(Chat.URL + (issue > 0 ? "?c=" + issue : "")));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        Notification.Builder b = new Notification.Builder(c, "replies");
        b.setSmallIcon(R.mipmap.ic_launcher);
        b.setContentTitle(title);
        b.setContentText(text);
        b.setStyle(new Notification.BigTextStyle().bigText(text));
        b.setAutoCancel(true);
        b.setColor(0xFF5B3FD6);
        b.setContentIntent(PendingIntent.getActivity(c, issue, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        int nid = issue > 0 ? 1000 + issue : next++;
        // ✅ Oui / ❌ Non directement dans la notification (question de confirmation) : pas besoin d'ouvrir l'appli
        if (cmd.optBoolean("ask", false) && issue > 0 && Store.brainLinked(c)) {
            b.addAction(new Action.Builder(Icon.createWithResource(c, android.R.drawable.checkbox_on_background), "✅ Oui", answer(c, issue, nid, "OUI")).build());
            b.addAction(new Action.Builder(Icon.createWithResource(c, android.R.drawable.ic_delete), "❌ Non", answer(c, issue, nid, "NON")).build());
        }
        nm.notify(nid, b.build());
        out.put("shown", true);
        Bus.log("Notification : " + title);
        return out;
    }

    private static PendingIntent answer(Context c, int issue, int nid, String a) {
        Intent i = new Intent(c, NotifAnswer.class);
        i.putExtra("issue", issue); i.putExtra("nid", nid); i.putExtra("a", a);
        i.setAction("muse.answer." + issue + "." + a);
        return PendingIntent.getBroadcast(c, issue * 2 + ("OUI".equals(a) ? 0 : 1), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
