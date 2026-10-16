package com.ainacedric.muse;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;

import org.json.JSONObject;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/** Muse Live : parle directement au démon du PC (WebSocket via Tailscale) et joue sa voix neuronale phrase par phrase. */
class Live {
    interface Cb {
        void ready();
        void thinking();
        void speaking();
        void delta(String text);
        void finished();           // plus rien à dire : on peut réécouter
        void fallback(String t);   // le PC n'a pas de voix neuronale : lire avec la voix du téléphone
        void error(String msg);
    }

    private final Context ctx;
    private final Cb cb;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService audioQ = Executors.newSingleThreadExecutor();
    private final OkHttpClient http = new OkHttpClient.Builder().pingInterval(25, TimeUnit.SECONDS).readTimeout(0, TimeUnit.MILLISECONDS).build();
    private WebSocket ws;
    private AudioTrack track;
    private int trackRate = 0;
    private volatile int gen = 0;
    private volatile boolean doneSeen = false, closed = false, open = false;
    private volatile int pending = 0;   // phrases reçues mais pas encore finies de jouer

    Live(Context c, Cb cb) { this.ctx = c.getApplicationContext(); this.cb = cb; }

    boolean isOpen() { return open && !closed; }

    void connect() {
        String url = Store.liveUrl(ctx), tok = Store.liveTok(ctx);
        if (url.isEmpty() || tok.isEmpty()) { cb.error("Code Live absent."); return; }
        Request r = new Request.Builder().url(url + (url.contains("?") ? "&" : "?") + "t=" + tok).build();
        ws = http.newWebSocket(r, new WebSocketListener() {
            @Override public void onMessage(WebSocket w, String text) { try { handle(new JSONObject(text)); } catch (Throwable t) { Bus.log("Live : " + t.getMessage()); } }
            @Override public void onFailure(WebSocket w, Throwable t, Response resp) {
                open = false;
                final String m = resp != null && resp.code() == 401 ? "Code Live refusé : refais-le avec voice-setup.sh." : "Muse Live injoignable : le PC est-il allumé et Tailscale connecté sur le téléphone ?";
                if (!closed) main.post(new Runnable() { @Override public void run() { cb.error(m); } });
            }
            @Override public void onClosed(WebSocket w, int code, String reason) { open = false; }
        });
    }

    void say(String text) {
        gen++; flush(); doneSeen = false; pending = 0;
        if (ws != null) ws.send("{\"type\":\"say\",\"text\":" + JSONObject.quote(text) + "}");
    }

    /** Coupe Muse (elle se tait tout de suite). */
    void stop() {
        gen++; flush(); pending = 0; doneSeen = true;
        if (ws != null) ws.send("{\"type\":\"stop\"}");
    }

    void close() {
        closed = true; open = false;
        flush();
        try { if (ws != null) { ws.send("{\"type\":\"stop\"}"); ws.close(1000, "bye"); } } catch (Throwable ignore) { }
        try { if (track != null) track.release(); } catch (Throwable ignore) { }
        track = null;
        audioQ.shutdown();
    }

    private void flush() {
        try { if (track != null) { track.pause(); track.flush(); } } catch (Throwable ignore) { }
    }

    private void handle(final JSONObject m) throws Exception {
        String t = m.optString("type");
        switch (t) {
            case "ready": open = true; main.post(new Runnable() { @Override public void run() { cb.ready(); } }); break;
            case "state": {
                final String s = m.optString("s");
                if ("think".equals(s)) main.post(new Runnable() { @Override public void run() { cb.thinking(); } });
                break;
            }
            case "delta": { final String d = m.optString("text"); main.post(new Runnable() { @Override public void run() { cb.delta(d); } }); break; }
            case "audio": {
                final int g = gen, rate = m.optInt("sr", 22050);
                final byte[] pcm = Base64.decode(m.optString("b64"), Base64.NO_WRAP);
                pending++;
                main.post(new Runnable() { @Override public void run() { cb.speaking(); } });
                audioQ.execute(new Runnable() { @Override public void run() { playPcm(pcm, rate, g); } });
                break;
            }
            case "speak": { final String s = m.optString("text"); main.post(new Runnable() { @Override public void run() { cb.fallback(s); } }); break; }
            case "done": doneSeen = true; maybeFinished(); break;
            case "error": { final String e = m.optString("msg", "Erreur"); main.post(new Runnable() { @Override public void run() { cb.error(e); } }); break; }
            default: break;
        }
    }

    private void playPcm(byte[] pcm, int rate, int g) {
        try {
            if (g != gen || closed) return;
            if (track == null || trackRate != rate) {
                if (track != null) track.release();
                int min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
                track = new AudioTrack.Builder()
                        .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        .setAudioFormat(new AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(rate).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build())
                        .setBufferSizeInBytes(Math.max(min, rate)).setTransferMode(AudioTrack.MODE_STREAM).build();
                trackRate = rate;
            }
            track.play();
            int off = 0;
            while (off < pcm.length && g == gen && !closed) {
                int n = track.write(pcm, off, Math.min(4096, pcm.length - off));
                if (n <= 0) break;
                off += n;
            }
            // laisse le tampon se vider avant de dire « fini »
            if (g == gen) { int frames = pcm.length / 2; long wait = Math.min(1500, 1000L * Math.min(frames, rate) / rate); Thread.sleep(Math.max(150, wait / 2)); }
        } catch (Throwable t) {
            Bus.log("Lecture Live : " + t.getMessage());
        } finally {
            if (g == gen) { pending = Math.max(0, pending - 1); maybeFinished(); }
        }
    }

    private void maybeFinished() {
        if (doneSeen && pending == 0 && !closed) {
            doneSeen = false;
            main.post(new Runnable() { @Override public void run() { cb.finished(); } });
        }
    }
}
