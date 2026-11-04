package com.ainacedric.muse;

import android.app.Activity;
import android.os.Bundle;

/** Icône « Muse » de l'écran d'accueil (même visuel que le chat) : ouvre le chat Muse.
 *  Elle appartient à l'appli Android, donc le lanceur (MIUI…) y affiche le nombre de discussions non lues en rouge. */
public class OpenChat extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Chat.open(this);
        finish();
        overridePendingTransition(0, 0);
    }
}
