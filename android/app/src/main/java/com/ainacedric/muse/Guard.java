package com.ainacedric.muse;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;
import android.provider.Settings;

/**
 * Garde-fou : Muse doit voir et manipuler le téléphone en permanence, dès qu'il y a Internet, sans que Cédric ait quelque chose à réactiver.
 * - Réveil toutes les 2 min (alarme) + tâche périodique + réveil au retour d'Internet + au démarrage du téléphone.
 * - À chaque réveil : relève relancée, service permanent relancé, écoute des notifications relancée.
 * - Si la permission WRITE_SECURE_SETTINGS a été donnée une fois (commande adb), l'appli réactive elle-même
 *   l'accessibilité et l'accès aux notifications quand Android / MIUI les coupe. Sans elle : on fait au mieux.
 */
class Guard {
    static final String ACT = "com.ainacedric.muse.GUARD";
    private static final long EVERY_MS = 120000;
    private static volatile long accOffSince = 0, lastAccToggle = 0;
    private static volatile boolean netWatching = false;
    static volatile long lastCheck = 0;

    /** Vérifie tout et se reprogramme. Peut être appelé de partout, souvent. */
    static void check(Context c) {
        Context app = c.getApplicationContext();
        lastCheck = System.currentTimeMillis();
        try { Bus.ensureLoop(app); } catch (Throwable ignore) { }
        try { if (!KeepAlive.isRunning()) app.startForegroundService(new Intent(app, KeepAlive.class)); } catch (Throwable ignore) { /* refusé en arrière-plan : la relève tourne quand même */ }
        try { heal(app); } catch (Throwable t) { Bus.log("Garde-fou : " + t.getMessage()); }
        try { NotifWatch.keep(app); } catch (Throwable ignore) { }
        schedule(app, EVERY_MS);
        try { job(app); } catch (Throwable ignore) { }
        try { netWatch(app); } catch (Throwable ignore) { }
    }

    static boolean secure(Context c) {
        return c.checkSelfPermission("android.permission.WRITE_SECURE_SETTINGS") == PackageManager.PERMISSION_GRANTED;
    }

    static final String ADB = "adb shell pm grant com.ainacedric.muse android.permission.WRITE_SECURE_SETTINGS";

    /** Réactive l'accessibilité et l'accès aux notifications s'ils ont été coupés (nécessite WRITE_SECURE_SETTINGS). */
    static void heal(Context c) {
        if (!secure(c)) return;
        android.content.ContentResolver cr = c.getContentResolver();
        long now = System.currentTimeMillis();
        String acc = new ComponentName(c, MuseService.class).flattenToString();
        String cur = Settings.Secure.getString(cr, "enabled_accessibility_services");
        boolean listed = cur != null && cur.contains(c.getPackageName()) && cur.contains("MuseService");
        if (!listed) {
            Settings.Secure.putString(cr, "enabled_accessibility_services", cur == null || cur.isEmpty() ? acc : cur + ":" + acc);
            Settings.Secure.putString(cr, "accessibility_enabled", "1");
            Bus.log("Garde-fou : accessibilité réactivée");
        } else if (MuseService.inst == null) {
            if (accOffSince == 0) accOffSince = now;
            if (now - accOffSince > 45000 && now - lastAccToggle > 180000) {   // listée mais pas branchée : on la coupe et on la remet
                lastAccToggle = now;
                String without = cur.replace(acc, "").replace("::", ":");
                if (without.startsWith(":")) without = without.substring(1);
                if (without.endsWith(":")) without = without.substring(0, without.length() - 1);
                Settings.Secure.putString(cr, "enabled_accessibility_services", without);
                try { Thread.sleep(500); } catch (InterruptedException ignore) { }
                Settings.Secure.putString(cr, "enabled_accessibility_services", without.isEmpty() ? acc : without + ":" + acc);
                Bus.log("Garde-fou : accessibilité relancée");
            }
        } else accOffSince = 0;
        if (!NotifWatch.enabled(c)) {
            String nl = new ComponentName(c, NotifWatch.class).flattenToString();
            String ncur = Settings.Secure.getString(cr, "enabled_notification_listeners");
            Settings.Secure.putString(cr, "enabled_notification_listeners", ncur == null || ncur.isEmpty() ? nl : ncur + ":" + nl);
            Bus.log("Garde-fou : accès aux notifications réactivé");
        }
    }

    /** Prochain réveil dans delay ms (alarme précise, même en veille profonde). */
    static void schedule(Context c, long delay) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = PendingIntent.getBroadcast(c, 77, new Intent(c, GuardReceiver.class).setAction(ACT), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            long t = System.currentTimeMillis() + delay;
            try {
                if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
                else am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            } catch (SecurityException e) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi);
            }
        } catch (Throwable ignore) { }
    }

    /** Filet de sécurité : tâche périodique du système (au plus toutes les 15 min), conservée après redémarrage. */
    static void job(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null || js.getPendingJob(78) != null) return;
        js.schedule(new JobInfo.Builder(78, new ComponentName(c, GuardJob.class))
                .setPeriodic(15 * 60 * 1000L)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build());
    }

    /** Dès qu'Internet revient (Wi-Fi, données), on revérifie tout tout de suite. */
    static void netWatch(final Context c) {
        if (netWatching) return;
        ConnectivityManager cm = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;
        netWatching = true;
        cm.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network n) {
                Bus.log("Internet revenu : vérification");
                check(c);
            }
        });
    }
}
