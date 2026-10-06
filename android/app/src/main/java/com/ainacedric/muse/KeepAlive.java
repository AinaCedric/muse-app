package com.ainacedric.muse;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
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
        boolean wantMic = Store.wake(this) && checkSelfPermission("android.permission.RECORD_AUDIO") == PackageManager.PERMISSION_GRANTED;
        boolean mic = startFg(wantMic);
        Bus.ensureLoop(getApplicationContext());
        if (mic) Wake.start(this);
        else {
            Wake.stop();
            if (wantMic) Wake.state = "en attente : ouvre l'appli Muse Tél. pour relancer l'écoute";
        }
        return START_STICKY;
    }

    /** Service au premier plan ; avec le type « micro » si l'écoute de « Muse » est active (sinon Android coupe le micro en arrière-plan). */
    private boolean startFg(boolean mic) {
        Notification n = build(this, false);
        if (Build.VERSION.SDK_INT >= 34) {
            int base = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
            if (mic) {
                try {
                    startForeground(2, n, base | ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
                    return true;
                } catch (Throwable t) {
                    Bus.log("Micro en arrière-plan refusé par Android : " + t.getMessage());
                }
            }
            startForeground(2, n, base);
            return false;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                startForeground(2, n, mic ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE : 0);
                return mic;
            } catch (Throwable t) {
                startForeground(2, n);
                return false;
            }
        }
        startForeground(2, n);
        return mic;
    }

    @Override
    public void onDestroy() {
        running = false;
        Wake.stop();
        super.onDestroy();
    }

    static Notification build(Context c, boolean active) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel("muse", "Muse", NotificationManager.IMPORTANCE_LOW));
        Notification.Builder b = new Notification.Builder(c, "muse");
        b.setSmallIcon(R.mipmap.ic_launcher);
        b.setContentTitle(active ? "Muse utilise ton téléphone" : Store.wake(c) ? "Muse t'écoute : dis « Muse »" : "Muse est connectée");
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
