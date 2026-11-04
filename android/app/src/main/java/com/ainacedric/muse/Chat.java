package com.ainacedric.muse;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;

import java.util.List;

/** Ouvre le chat Muse (le PWA) EN PLEIN ÉCRAN, comme une vraie appli : on vise directement l'appli Muse installée par Chrome
 *  (paquet « org.chromium.webapk… »), sinon Android ouvrirait un simple onglet Chrome avec la barre d'adresse. */
class Chat {
    static final String URL = "https://ainacedric.github.io/muse-app/";

    /** Paquet de l'appli Muse installée par Chrome (WebAPK), ou null si elle n'est pas installée. */
    static String webApk(Context c) {
        try {
            PackageManager pm = c.getPackageManager();
            List<ResolveInfo> l = pm.queryIntentActivities(new Intent(Intent.ACTION_VIEW, Uri.parse(URL)), PackageManager.MATCH_ALL);
            for (ResolveInfo r : l) { String p = r.activityInfo.packageName; if (p != null && p.startsWith("org.chromium.webapk")) return p; }
        } catch (Throwable ignore) { }
        return null;
    }

    static Intent view(Context c, String url) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        String p = webApk(c);
        if (p != null) i.setPackage(p);
        else Bus.log("Appli Muse (PWA) non installée : le chat s'ouvre dans Chrome. Installe-la : Chrome ⋮ → « Installer l'application ».");
        return i;
    }

    static void open(Context c) {
        try { c.startActivity(view(c, URL)); }
        catch (Throwable t) {
            try { Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(URL)); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); }
            catch (Throwable t2) { Bus.log("Impossible d'ouvrir le chat : " + t2.getMessage()); }
        }
    }

    /** Ouvre le chat et lui transmet une demande (le chat l'envoie à Muse). mode : "auto" ou "phone". */
    static void ask(Context c, String q, String mode) {
        Shield.clearBack();
        try { c.startActivity(view(c, URL + "?ask=" + Uri.encode(q) + "&mode=" + Uri.encode(mode))); }
        catch (Throwable t) { Bus.log("Impossible d'ouvrir le chat : " + t.getMessage()); }
    }
}
