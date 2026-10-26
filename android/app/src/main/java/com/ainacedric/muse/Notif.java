package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Person;
import android.app.RemoteInput;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Notifications de Muse, envoyées par le cerveau via le dépôt-relais :
 *  - réponse normale  : style « conversation » avec l'avatar de Muse + 💬 Répondre directement depuis la notification ;
 *  - alerte de veille : 🔔 titre court, texte complet, mascotte pensive ;
 *  - accord demandé   : carte « 🔐 À confirmer » (appli · contact, bulle du message) + ✅ Oui / ❌ Non / ✏️ Modifier.
 */
class Notif {
    private static int next = 100;
    static final int ACCENT = 0xFF7C5CFF;
    static final String KEY_TEXT = "muse_text";

    static JSONObject show(Context c, JSONObject cmd) throws Exception {
        JSONObject out = new JSONObject();
        String title = cmd.optString("title", "Muse a répondu");
        String text = cmd.optString("text", "Ta réponse est prête.");
        int issue = cmd.optInt("issue", 0);
        String mode = cmd.optString("mode", "");
        boolean ask = cmd.optBoolean("ask", false);
        String where = cmd.optString("where", ""), msg = cmd.optString("msg", "");

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
        channels(nm);
        boolean alert = title.startsWith("🔔");
        String chan = ask ? "confirm" : alert ? "watch" : "replies";
        int nid = issue > 0 ? 1000 + issue : next++;
        boolean canAnswer = issue > 0 && Store.brainLinked(c);

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(Chat.URL + (issue > 0 ? "?c=" + issue : "")));
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        Notification.Builder b = new Notification.Builder(c, chan);
        b.setSmallIcon(R.drawable.ic_stat_muse);
        b.setColor(ACCENT);
        b.setAutoCancel(true);
        b.setShowWhen(true);
        b.setGroup("muse");
        b.setCategory(ask ? Notification.CATEGORY_REMINDER : Notification.CATEGORY_MESSAGE);
        b.setContentIntent(PendingIntent.getActivity(c, issue, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        Bitmap face = face(c, ask ? "muse_happy_00" : alert ? "muse_think_00" : "muse_idle_00");

        if (ask) {
            // ---- 🔐 Carte de confirmation
            if (where.isEmpty()) where = title.replaceFirst("^🔐\\s*", "");
            if (msg.isEmpty()) msg = text;
            String head = "Muse attend ton accord";
            b.setContentTitle("🔐 " + where);
            b.setContentText("« " + msg + " »");
            b.setSubText("À confirmer");
            b.setStyle(new Notification.DecoratedCustomViewStyle());
            RemoteViews small = new RemoteViews(c.getPackageName(), R.layout.notif_confirm_small);
            small.setTextViewText(R.id.n_head, "🔐 " + where);
            small.setTextViewText(R.id.n_msg, "« " + msg + " »");
            if (face != null) small.setImageViewBitmap(R.id.n_face, face);
            RemoteViews big = new RemoteViews(c.getPackageName(), R.layout.notif_confirm);
            big.setTextViewText(R.id.n_head, head);
            big.setTextViewText(R.id.n_chip, "🔐  " + where);
            big.setTextViewText(R.id.n_msg, msg);
            big.setTextViewText(R.id.n_hint, "✅ Oui envoie exactement ce texte · ✏️ Modifier pour changer");
            if (face != null) big.setImageViewBitmap(R.id.n_face, face);
            b.setCustomContentView(small);
            b.setCustomBigContentView(big);
            b.setCustomHeadsUpContentView(small);
            if (canAnswer) {
                b.addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat_muse), "✅ Oui", answer(c, issue, nid, "OUI", mode)).build());
                b.addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat_muse), "❌ Non", answer(c, issue, nid, "NON", mode)).build());
                b.addAction(replyAction(c, issue, nid, mode, "✏️ Modifier", "Ta version du message…", "EDIT"));
            }
        } else if (Build.VERSION.SDK_INT >= 28) {
            // ---- 💬 Réponse / 🔔 alerte : style conversation, avec l'avatar de Muse
            Person muse = new Person.Builder().setName("Muse").setIcon(face != null ? Icon.createWithBitmap(face) : null).setBot(true).build();
            Person me = new Person.Builder().setName("Moi").build();
            Notification.MessagingStyle st = new Notification.MessagingStyle(me);
            boolean plain = title.isEmpty() || title.equals("Muse a répondu");
            if (!plain) { st.setConversationTitle(title); st.setGroupConversation(true); }
            st.addMessage(text, System.currentTimeMillis(), muse);
            b.setStyle(st);
            if (face != null) b.setLargeIcon(face);
            if (canAnswer) b.addAction(replyAction(c, issue, nid, mode, "💬 Répondre", "Répondre à Muse…", "REPLY"));
        } else {
            b.setContentTitle(title);
            b.setContentText(text);
            b.setStyle(new Notification.BigTextStyle().bigText(text));
            if (face != null) b.setLargeIcon(face);
        }
        nm.notify(nid, b.build());
        out.put("shown", true);
        Bus.log("Notification : " + title);
        return out;
    }

    private static void channels(NotificationManager nm) {
        NotificationChannel r = new NotificationChannel("replies", "Réponses de Muse", NotificationManager.IMPORTANCE_HIGH);
        r.setDescription("Quand Muse a fini de répondre, et ton programme du matin");
        r.setLightColor(ACCENT); r.enableLights(true);
        NotificationChannel w = new NotificationChannel("watch", "Alertes de la veille", NotificationManager.IMPORTANCE_HIGH);
        w.setDescription("Ce que la veille proactive a repéré d'important");
        w.setLightColor(0xFFFF9A3C); w.enableLights(true);
        NotificationChannel k = new NotificationChannel("confirm", "Accords à donner", NotificationManager.IMPORTANCE_HIGH);
        k.setDescription("Muse attend ton OUI avant d'envoyer un message ou de faire une action sensible");
        k.setLightColor(ACCENT); k.enableLights(true); k.enableVibration(true);
        k.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        nm.createNotificationChannel(r); nm.createNotificationChannel(w); nm.createNotificationChannel(k);
    }

    /** Mascotte de Muse en petit (avatar rond des notifications). */
    private static Bitmap face(Context c, String name) {
        try {
            int id = c.getResources().getIdentifier(name, "drawable", c.getPackageName());
            if (id == 0) return null;
            Bitmap bm = BitmapFactory.decodeResource(c.getResources(), id);
            return bm == null ? null : Bitmap.createScaledBitmap(bm, 144, 144, true);
        } catch (Throwable t) { return null; }
    }

    private static Intent base(Context c, int issue, int nid, String a, String mode) {
        Intent i = new Intent(c, NotifAnswer.class);
        i.putExtra("issue", issue); i.putExtra("nid", nid); i.putExtra("a", a); i.putExtra("mode", mode);
        i.setAction("muse.answer." + issue + "." + a);
        return i;
    }

    private static PendingIntent answer(Context c, int issue, int nid, String a, String mode) {
        return PendingIntent.getBroadcast(c, issue * 4 + ("OUI".equals(a) ? 0 : 1), base(c, issue, nid, a, mode), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Champ de saisie dans la notification (Répondre / Modifier). Doit être « MUTABLE » pour recevoir le texte tapé. */
    private static Notification.Action replyAction(Context c, int issue, int nid, String mode, String label, String hint, String kind) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(c, issue * 4 + ("EDIT".equals(kind) ? 2 : 3), base(c, issue, nid, kind, mode), flags);
        RemoteInput ri = new RemoteInput.Builder(KEY_TEXT).setLabel(hint).build();
        return new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_stat_muse), label, pi).addRemoteInput(ri).setAllowGeneratedReplies(false).build();
    }
}
