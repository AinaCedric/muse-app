package com.ainacedric.muse;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Réveil du garde-fou : alarme, démarrage du téléphone, mise à jour de l'appli. */
public class GuardReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Guard.check(c);
    }
}
