package com.ainacedric.muse;

import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.CancellationSignal;

import org.json.JSONObject;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Position du téléphone (pour « les restaurants les plus proches », l'itinéraire…). Lecture seule, jamais enregistrée sur le téléphone. */
class Loc {
    static boolean granted(Context c) {
        return c.checkSelfPermission("android.permission.ACCESS_FINE_LOCATION") == PackageManager.PERMISSION_GRANTED
                || c.checkSelfPermission("android.permission.ACCESS_COARSE_LOCATION") == PackageManager.PERMISSION_GRANTED;
    }

    static boolean background(Context c) {
        return Build.VERSION.SDK_INT < 29 || c.checkSelfPermission("android.permission.ACCESS_BACKGROUND_LOCATION") == PackageManager.PERMISSION_GRANTED;
    }

    static JSONObject op(Context c) throws Exception {
        if (!granted(c)) throw new Exception("Localisation non autorisée : dans l'appli Muse du téléphone, étape 10 « Position », touche le bouton et choisis « Toujours autoriser ».");
        LocationManager lm = (LocationManager) c.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) throw new Exception("Service de localisation indisponible.");
        Location best = null;
        for (String p : new String[]{"fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER, LocationManager.PASSIVE_PROVIDER}) {
            try {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            } catch (Throwable ignore) { }
        }
        // Position trop ancienne (> 3 min) : on en demande une fraîche (15 s max)
        if ((best == null || System.currentTimeMillis() - best.getTime() > 3 * 60 * 1000) && Build.VERSION.SDK_INT >= 30) {
            for (String p : new String[]{LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
                try {
                    if (!lm.isProviderEnabled(p)) continue;
                    final CountDownLatch done = new CountDownLatch(1);
                    final AtomicReference<Location> got = new AtomicReference<>();
                    lm.getCurrentLocation(p, new CancellationSignal(), c.getMainExecutor(), new java.util.function.Consumer<Location>() {
                        @Override
                        public void accept(Location l) { got.set(l); done.countDown(); }
                    });
                    done.await(15, TimeUnit.SECONDS);
                    if (got.get() != null) { best = got.get(); break; }
                } catch (Throwable ignore) { }
            }
        }
        if (best == null) {
            boolean on = false;
            try { on = lm.isLocationEnabled(); } catch (Throwable ignore) { }
            throw new Exception(on ? (background(c) ? "Position introuvable pour l'instant (GPS sans signal) : réessaie dehors ou près d'une fenêtre." : "Position refusée en arrière-plan : étape 10 de l'appli Muse, choisis « Toujours autoriser ».") : "La localisation du téléphone est coupée : active-la dans le volet des réglages rapides.");
        }
        JSONObject o = new JSONObject();
        o.put("lat", best.getLatitude());
        o.put("lng", best.getLongitude());
        o.put("acc", Math.round(best.getAccuracy()));
        o.put("ageSec", Math.max(0, (System.currentTimeMillis() - best.getTime()) / 1000));
        o.put("provider", String.valueOf(best.getProvider()));
        return o;
    }
}
