package com.ainacedric.muse;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;

import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Mot d'activation « Muse » : reconnaissance vocale 100 % hors ligne (Vosk, petit modèle français).
 * Rien ne quitte le téléphone : le micro n'écoute que le mot « Muse », puis ouvre le panneau en mode conversation.
 * Le micro est relâché pendant que le panneau écoute ou parle, puis repris à sa fermeture.
 */
class Wake {
    static volatile String state = "désactivée";
    private static Context app;
    private static Model model;
    private static SpeechService ss;
    private static boolean loading = false, paused = false;
    private static long lastHit = 0;
    private static final Handler ui = new Handler(Looper.getMainLooper());
    private static final Pattern TXT = Pattern.compile("\"(?:partial|text)\"\\s*:\\s*\"([^\"]*)\"");

    static synchronized void start(Context c) {
        app = c.getApplicationContext();
        if (!Store.wake(app)) { stop(); return; }
        if (app.checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
            state = "micro non autorisé";
            return;
        }
        if (ss != null || loading) return;
        if (model == null) {
            loading = true;
            state = "préparation du modèle vocal…";
            StorageService.unpack(app, "model-fr", "model",
                    new StorageService.Callback<Model>() {
                        @Override
                        public void onComplete(Model m) {
                            synchronized (Wake.class) { model = m; loading = false; }
                            listen();
                        }
                    },
                    new StorageService.Callback<IOException>() {
                        @Override
                        public void onComplete(IOException e) {
                            synchronized (Wake.class) { loading = false; }
                            state = "modèle vocal introuvable";
                            Bus.log("Mot d'activation : modèle introuvable (" + e.getMessage() + ")");
                        }
                    });
            return;
        }
        listen();
    }

    private static synchronized void listen() {
        if (app == null || model == null || ss != null || paused || !Store.wake(app)) return;
        try {
            Recognizer rec = new Recognizer(model, 16000.0f, "[\"muse\", \"[unk]\"]");
            ss = new SpeechService(rec, 16000.0f);
            ss.startListening(new RecognitionListener() {
                @Override public void onPartialResult(String h) { check(h); }
                @Override public void onResult(String h) { check(h); }
                @Override public void onFinalResult(String h) { }
                @Override public void onError(Exception e) {
                    state = "erreur micro";
                    Bus.log("Mot d'activation : " + e.getMessage());
                    release();
                }
                @Override public void onTimeout() { }
            });
            state = "à l'écoute de « Muse »";
            Bus.log("Écoute de « Muse » active");
        } catch (Throwable t) {
            state = "impossible (" + t.getMessage() + ")";
            Bus.log("Mot d'activation : " + t.getMessage());
            release();
        }
    }

    private static void check(String json) {
        if (json == null) return;
        Matcher m = TXT.matcher(json);
        if (!m.find()) return;
        boolean hit = false;
        for (String w : m.group(1).split("\\s+")) if (w.equals("muse")) hit = true;
        if (!hit) return;
        long now = System.currentTimeMillis();
        if (now - lastHit < 4000) return;
        lastHit = now;
        Bus.log("« Muse » entendu");
        ui.post(new Runnable() {
            @Override
            public void run() {
                MuseService s = MuseService.inst;
                if (s == null) { Bus.log("Accessibilité inactive : impossible d'ouvrir le panneau"); return; }
                Panel.voice(s);
            }
        });
    }

    /** Le panneau prend le micro (pause) ou le rend (reprise). */
    static synchronized void pause(boolean p) {
        paused = p;
        if (p) release();
        else if (app != null && Store.wake(app)) ui.postDelayed(new Runnable() {
            @Override public void run() { start(app); }
        }, 800);
    }

    private static synchronized void release() {
        if (ss == null) return;
        try { ss.stop(); } catch (Throwable ignore) { }
        try { ss.shutdown(); } catch (Throwable ignore) { }
        ss = null;
    }

    static synchronized void stop() {
        release();
        state = "désactivée";
    }
}
