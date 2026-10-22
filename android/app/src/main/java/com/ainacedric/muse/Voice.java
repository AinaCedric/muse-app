package com.ainacedric.muse;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** Voix de Muse indépendante de l'écran : parle à haute voix même téléphone verrouillé. */
class Voice {
    private static TextToSpeech tts;
    private static volatile boolean ready, failed, starting;
    private static volatile CountDownLatch done;
    private static volatile String cur = "";

    private static synchronized void init(final Context c) {
        if (tts != null || starting) return;
        starting = true;
        new Handler(Looper.getMainLooper()).post(new Runnable() {
            @Override public void run() {
                try {
                    tts = new TextToSpeech(c.getApplicationContext(), new TextToSpeech.OnInitListener() {
                        @Override public void onInit(int st) {
                            if (st != TextToSpeech.SUCCESS) { failed = true; return; }
                            try {
                                tts.setLanguage(Locale.FRANCE);
                                tts.setAudioAttributes(new AudioAttributes.Builder()
                                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                                    @Override public void onStart(String id) { }
                                    @Override public void onDone(String id) { CountDownLatch d = done; if (d != null && cur.equals(id)) d.countDown(); }
                                    @Override public void onError(String id) { CountDownLatch d = done; if (d != null && cur.equals(id)) d.countDown(); }
                                });
                            } catch (Throwable ignore) { }
                            ready = true;
                        }
                    });
                } catch (Throwable t) { failed = true; Bus.log("Voix de Muse impossible : " + t.getMessage()); }
            }
        });
    }

    /** Parle à haute voix (à appeler depuis un fil secondaire). Attend la fin de la phrase (max 15 s). */
    static boolean say(Context c, String text) {
        try {
            init(c);
            for (int i = 0; i < 40 && !ready && !failed; i++) Thread.sleep(100);
            if (!ready) return false;
            cur = "v" + System.nanoTime();
            done = new CountDownLatch(1);
            Bundle b = new Bundle();
            b.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, android.media.AudioManager.STREAM_MUSIC);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, cur);
            done.await(15, TimeUnit.SECONDS);
            return true;
        } catch (Throwable t) {
            Bus.log("Voix de Muse : " + t.getMessage());
            return false;
        }
    }
}
