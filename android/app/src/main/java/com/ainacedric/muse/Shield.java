package com.ainacedric.muse;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * « Écran bouclier » : pendant que Muse agit sur le téléphone, un écran opaque recouvre tout.
 * Cédric ne voit pas ce que Muse fait et ses touches sont avalées : il ne peut donc plus couper l'action par accident.
 * Les gestes de Muse (dispatchGesture) traversent le bouclier pendant quelques millisecondes (pass).
 * Toujours un bouton « Reprendre la main » ; le bouclier disparaît tout seul dès que Muse n'agit plus.
 */
class Shield {
    private static final Handler H = new Handler(Looper.getMainLooper());
    /** Le bouclier disparaît si Muse n'a rien fait depuis ce délai (la réflexion entre deux actions dure quelques secondes). */
    private static final long IDLE_MS = 15000;
    /** Après « Reprendre la main », les actions de Muse sont refusées pendant ce délai. */
    private static final long BACK_MS = 25000;

    private static WindowManager wm;
    private static FrameLayout root;
    private static WindowManager.LayoutParams lp;
    private static TextView sub;
    private static volatile long lastUse = 0;
    private static volatile long stoppedAt = 0;
    private static volatile long quietUntil = 0;
    private static int dots = 0;

    /** Actions qui touchent à l'écran (les autres — notifications, position, ping — se font sans rien afficher). */
    static boolean isUi(String op) {
        switch (op) {
            case "open_app": case "tap": case "swipe": case "type": case "key": case "open_url":
            case "shot": case "screen": case "notif_open":
                return true;
            default:
                return false;
        }
    }

    /** Cédric vient de dire « Reprendre la main » : Muse doit s'arrêter. */
    static boolean handedBack() { return System.currentTimeMillis() - stoppedAt < BACK_MS; }

    /** Montre le bouclier (ou le garde) pour l'action en cours. Appelé hors du fil principal. */
    static void begin(final Context c, final String label) {
        final MuseService s = MuseService.inst;
        if (s == null || !Store.shield(c)) return;
        long now = System.currentTimeMillis();
        if (now < quietUntil) return;      // passation en cours : Cédric utilise son téléphone
        lastUse = now;
        final CountDownLatch l = new CountDownLatch(1);
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (root == null) build(s);
                    if (sub != null) sub.setText(label == null || label.isEmpty() ? "Je travaille…" : label);
                } catch (Throwable t) {
                    Bus.log("Bouclier : " + t);
                }
                l.countDown();
            }
        });
        try { l.await(600, TimeUnit.MILLISECONDS); } catch (InterruptedException ignore) { }
    }

    /** Fin de travail (ou passation) : on retire le bouclier. */
    static void end() {
        lastUse = 0;
        H.post(new Runnable() { @Override public void run() { remove(); } });
    }

    /** Cédric doit agir lui-même (mot de passe, captcha…) : plus de bouclier pendant N secondes. */
    static void handoff(Context c, int seconds) {
        quietUntil = System.currentTimeMillis() + Math.max(5, Math.min(180, seconds)) * 1000L;
        end();
    }

    static void clearQuiet() { quietUntil = 0; }

    /** Laisse passer (ou bloque de nouveau) les touches pendant un geste de Muse. */
    static void pass(final boolean on) {
        if (root == null) return;
        final CountDownLatch l = new CountDownLatch(1);
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    if (root != null) {
                        lp.flags = flags(!on);
                        wm.updateViewLayout(root, lp);
                    }
                } catch (Throwable ignore) { }
                l.countDown();
            }
        });
        try { l.await(300, TimeUnit.MILLISECONDS); } catch (InterruptedException ignore) { }
    }

    /** Invisible le temps d'une capture d'écran (le bouclier ne doit pas figurer dessus). */
    static void ghost(final boolean on) {
        if (root == null) return;
        final CountDownLatch l = new CountDownLatch(1);
        H.post(new Runnable() {
            @Override
            public void run() {
                try { if (root != null) root.setVisibility(on ? View.INVISIBLE : View.VISIBLE); } catch (Throwable ignore) { }
                l.countDown();
            }
        });
        try { l.await(500, TimeUnit.MILLISECONDS); if (on) Thread.sleep(120); } catch (InterruptedException ignore) { }
    }

    private static int flags(boolean touchable) {
        int f = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
        return touchable ? f : f | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
    }

    private static void build(final MuseService s) {
        wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
        final float d = s.getResources().getDisplayMetrics().density;

        root = new FrameLayout(s);
        root.setBackgroundColor(Color.parseColor("#F5101418"));
        root.setClickable(true);
        root.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) { return true; }   // toutes les touches sont avalées
        });

        LinearLayout col = new LinearLayout(s);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setPadding((int) (28 * d), 0, (int) (28 * d), 0);

        Drawable mascot = Bubble.mascot();
        if (mascot != null) {
            ImageView im = new ImageView(s);
            im.setImageDrawable(mascot);
            im.setScaleType(ImageView.ScaleType.FIT_CENTER);
            col.addView(im, new LinearLayout.LayoutParams((int) (120 * d), (int) (120 * d)));
        }

        TextView title = new TextView(s);
        title.setText("Muse travaille pour toi");
        title.setTextColor(Color.WHITE);
        title.setTextSize(22);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, (int) (14 * d), 0, (int) (6 * d));
        col.addView(title);

        sub = new TextView(s);
        sub.setTextColor(Color.parseColor("#B8C4CE"));
        sub.setTextSize(16);
        sub.setGravity(Gravity.CENTER);
        col.addView(sub);

        TextView hint = new TextView(s);
        hint.setText("Ne touche pas l'écran : ton geste couperait son action.\nCet écran disparaît tout seul quand elle a fini.");
        hint.setTextColor(Color.parseColor("#7C8A96"));
        hint.setTextSize(13);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(0, (int) (22 * d), 0, (int) (30 * d));
        col.addView(hint);

        TextView btn = new TextView(s);
        btn.setText("✋  Reprendre la main");
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(16);
        btn.setGravity(Gravity.CENTER);
        btn.setPadding((int) (26 * d), (int) (14 * d), (int) (26 * d), (int) (14 * d));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#2A3440"));
        bg.setCornerRadius(40 * d);
        bg.setStroke((int) (1 * d), Color.parseColor("#4A5866"));
        btn.setBackground(bg);
        btn.setClickable(true);
        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stoppedAt = System.currentTimeMillis();
                Bus.activeUntil = 0;
                Bus.log("Cédric a repris la main");
                remove();
            }
        });
        col.addView(btn);

        FrameLayout.LayoutParams cp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        root.addView(col, cp);

        lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, flags(true), PixelFormat.TRANSLUCENT);
        if (Build.VERSION.SDK_INT >= 28) lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        wm.addView(root, lp);
        H.postDelayed(watch, 1000);
    }

    private static final Runnable watch = new Runnable() {
        @Override
        public void run() {
            if (root == null) return;
            if (System.currentTimeMillis() - lastUse > IDLE_MS) { remove(); return; }
            dots = (dots + 1) % 4;
            H.postDelayed(this, 1000);
        }
    };

    private static void remove() {
        H.removeCallbacks(watch);
        try { if (root != null && wm != null) wm.removeView(root); } catch (Throwable ignore) { }
        root = null; sub = null;
    }

    /** Service d'accessibilité arrêté. */
    static void destroy() {
        H.post(new Runnable() { @Override public void run() { remove(); } });
    }
}
