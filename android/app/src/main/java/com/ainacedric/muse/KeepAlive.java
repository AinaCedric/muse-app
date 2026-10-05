package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;

/**
 * Service permanent (notification fixe) : empêche Android / MIUI d'endormir la relève des ordres de Muse.
 * Il ne fait rien d'autre que relever le dépôt-relais privé.
 */
public class KeepAlive extends Service {
    private static volatile boolean running = false;
    private static volatile boolean shownActive = false;

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        running = true;
        startForeground(2, build(this, false));
        Bus.ensureLoop(getApplicationContext());
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    static Notification build(Context c, boolean active) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("muse", "Muse", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder b = new Notification.Builder(c, "muse");
        b.setSmallIcon(R.mipmap.ic_launcher);
        b.setContentTitle(active ? "Muse utilise ton téléphone" : "Muse est connectée");
        b.setContentText(active ? "Touche pour ouvrir Muse (bouton Pause pour l'arrêter)" : "Prête à recevoir tes demandes");
        b.setOngoing(true);
        b.setContentIntent(PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_IMMUTABLE));
        return b.build();
    }

    /** Met à jour le texte de la notification quand Muse commence / finit d'agir. */
    static void refresh(Context c, boolean active) {
        if (!running || shownActive == active) return;
        shownActive = active;
        c.getSystemService(NotificationManager.class).notify(2, build(c, active));
    }
}
