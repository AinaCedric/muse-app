package com.ainacedric.muse;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

/** Ouvre le chat Muse (le PWA). Si le PWA est installé sur l'écran d'accueil, Android l'ouvre en plein écran ; sinon dans Chrome. */
class Chat {
    static final String URL = "https://ainacedric.github.io/muse-app/";

    static void open(Context c) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(URL));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Throwable t) {
            Bus.log("Impossible d'ouvrir le chat : " + t.getMessage());
        }
    }

    /** Ouvre le chat et lui transmet une demande (le chat l'envoie à Muse). mode : "auto" ou "phone". */
    static void ask(Context c, String q, String mode) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(URL + "?ask=" + Uri.encode(q) + "&mode=" + Uri.encode(mode)));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Throwable t) {
            Bus.log("Impossible d'ouvrir le chat : " + t.getMessage());
        }
    }
}
