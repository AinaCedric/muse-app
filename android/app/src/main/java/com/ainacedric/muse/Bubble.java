package com.ainacedric.muse;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;
import android.widget.TextView;

import org.json.JSONObject;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * La bulle Muse : la mascotte 3D de Muse (images de l'avatar de l'appli, animées), glissable, à l'endroit choisi par Cédric.
 * Quand Muse agit sur le téléphone, elle se déplace TOUTE SEULE près de l'endroit où il agit (sans jamais le cacher),
 * affiche dans une petite bulle ce qu'il est en train de faire (« J'ouvre WhatsApp… », « Je lis l'écran… »),
 * puis revient à sa place quand il a fini. Pendant une action elle devient « transparente au toucher » pour ne rien bloquer,
 * et elle s'efface une fraction de seconde pendant les captures d'écran.
 */
class Bubble {
    private static ImageView v;
    private static TextView say;
    private static Drawable[] idle, think;
    private static int frame = 0, dir = 1;
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static Runnable tick, move;
    private static WindowManager wm;
    private static WindowManager.LayoutParams lp, sayLp;
    private static float d = 3f;
    private static int size, sw, sh;
    // position « maison » (choisie par Cédric), position actuelle (flottante), cible
    private static int homeX, homeY;
    private static float cx, cy, tx, ty;
    private static volatile long lastOp = 0;
    private static volatile boolean inOp = false, roaming = false;
    private static String label = "";
    private static long t0 = System.currentTimeMillis();

    private static Drawable[] load(MuseService s, String base) {
        Drawable[] out = new Drawable[24];
        for (int i = 0; i < 24; i++) {
            int id = s.getResources().getIdentifier(base + (i < 10 ? "_0" : "_") + i, "drawable", s.getPackageName());
            if (id == 0) return null;
            out[i] = s.getDrawable(id);
        }
        return out;
    }

    static void show(final MuseService s) {
        hide(s);
        try {
            wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
            d = s.getResources().getDisplayMetrics().density;
            size = (int) (72 * d);
            sw = s.getResources().getDisplayMetrics().widthPixels;
            sh = s.getResources().getDisplayMetrics().heightPixels;
            final SharedPreferences sp = s.getSharedPreferences("muse_bubble", Context.MODE_PRIVATE);

            if (idle == null) { idle = load(s, "muse_idle"); think = load(s, "muse_think"); }
            final ImageView t = new ImageView(s);
            t.setScaleType(ImageView.ScaleType.FIT_CENTER);
            if (idle != null) t.setImageDrawable(idle[0]);
            final PowerManager pm = (PowerManager) s.getSystemService(Context.POWER_SERVICE);

            // Images de la mascotte (12 images/s, aller-retour)
            tick = new Runnable() {
                @Override
                public void run() {
                    if (v != t) return;
                    try {
                        if (idle != null && (pm == null || pm.isInteractive())) {
                            boolean busy = System.currentTimeMillis() < Bus.activeUntil && think != null;
                            Drawable[] set = busy ? think : idle;
                            frame += dir;
                            if (frame >= set.length - 1) { frame = set.length - 1; dir = -1; }
                            if (frame <= 0) { frame = 0; dir = 1; }
                            t.setImageDrawable(set[frame]);
                        }
                    } catch (Throwable ignore) { }
                    H.postDelayed(this, 83);
                }
            };

            lp = new WindowManager.LayoutParams(size, size,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT);
            lp.gravity = Gravity.TOP | Gravity.LEFT;
            homeX = sp.getInt("x", sw - size - (int) (4 * d));
            homeY = Math.max(0, Math.min(sp.getInt("y", sh / 2), sh - size));
            lp.x = homeX; lp.y = homeY; cx = tx = homeX; cy = ty = homeY;

            final int slop = (int) (10 * d);
            t.setOnTouchListener(new View.OnTouchListener() {
                float dx, dy; int sx, sy; boolean moved;

                @Override
                public boolean onTouch(View view, MotionEvent e) {
                    switch (e.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            dx = e.getRawX(); dy = e.getRawY(); sx = lp.x; sy = lp.y; moved = false;
                            return true;
                        case MotionEvent.ACTION_MOVE: {
                            float mx = e.getRawX() - dx, my = e.getRawY() - dy;
                            if (!moved && Math.abs(mx) < slop && Math.abs(my) < slop) return true;
                            moved = true;
                            lp.x = (int) (sx + mx); lp.y = (int) (sy + my);
                            cx = tx = lp.x; cy = ty = lp.y;
                            try { wm.updateViewLayout(view, lp); } catch (Throwable ignore) { }
                            placeSay();
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                            if (moved) {
                                lp.x = (lp.x + size / 2 < sw / 2) ? (int) (4 * d) : sw - size - (int) (4 * d);
                                lp.y = Math.max(0, Math.min(lp.y, sh - size));
                                cx = tx = lp.x; cy = ty = lp.y;
                                try { wm.updateViewLayout(view, lp); } catch (Throwable ignore) { }
                                if (!roaming) { homeX = lp.x; homeY = lp.y; sp.edit().putInt("x", lp.x).putInt("y", lp.y).apply(); }
                                placeSay();
                            } else {
                                MuseService.lastClick = System.currentTimeMillis();
                                Bus.log("Bulle touchée");
                                try { Panel.toggle(s); } catch (Throwable x) { s.failOpen(x); }
                            }
                            return true;
                        default:
                            return true;
                    }
                }
            });
            wm.addView(t, lp);
            v = t;

            // Bulle de pensée (ne capte jamais le toucher)
            TextView b = new TextView(s);
            b.setTextColor(Color.parseColor("#1C1A2E"));
            b.setTextSize(13);
            b.setMaxWidth((int) (210 * d));
            b.setPadding((int) (12 * d), (int) (8 * d), (int) (12 * d), (int) (8 * d));
            GradientDrawable g = new GradientDrawable();
            g.setColor(Color.parseColor("#F7F5FF"));
            g.setCornerRadius(16 * d);
            g.setStroke((int) (1.5f * d), Color.parseColor("#7C66F5"));
            b.setBackground(g);
            b.setVisibility(View.GONE);
            sayLp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                    PixelFormat.TRANSLUCENT);
            sayLp.gravity = Gravity.TOP | Gravity.LEFT;
            wm.addView(b, sayLp);
            say = b;

            // Déplacement fluide (≈ 30 images/s) : vers la cible pendant le travail, retour à la maison ensuite
            move = new Runnable() {
                @Override
                public void run() {
                    if (v != t) return;
                    try { step(); } catch (Throwable ignore) { }
                    H.postDelayed(this, 33);
                }
            };
            H.removeCallbacksAndMessages(null);
            H.postDelayed(tick, 83);
            H.postDelayed(move, 33);
            Bus.log("Bulle affichée");
        } catch (Throwable x) {
            v = null;
            Bus.log("Bulle impossible : " + x.getMessage());
        }
    }

    private static void step() {
        long now = System.currentTimeMillis();
        boolean active = now < Bus.activeUntil && now - lastOp < 45000;
        if (active) {
            roaming = true;
            if (!inOp && now - lastOp > 2500) {
                setLabel("Je réfléchis…");
                // petite promenade autour de la dernière position pendant la réflexion
                double k = (now - t0) / 1000.0;
                float wx = (float) (Math.sin(k * 0.9) * 28 * d), wy = (float) (Math.sin(k * 1.7) * 16 * d);
                drift(tx + wx, ty + wy);
            } else drift(tx, ty);
        } else {
            if (roaming) { tx = homeX; ty = homeY; setLabel(""); }
            drift(tx, ty);
            if (roaming && Math.abs(cx - homeX) < 2 && Math.abs(cy - homeY) < 2) roaming = false;
        }
    }

    private static void drift(float gx, float gy) {
        float nx = cx + (gx - cx) * 0.12f, ny = cy + (gy - cy) * 0.12f;
        if (Math.abs(nx - cx) < 0.3f && Math.abs(ny - cy) < 0.3f) return;
        cx = nx; cy = ny;
        lp.x = Math.round(cx); lp.y = Math.round(cy);
        try { wm.updateViewLayout(v, lp); } catch (Throwable ignore) { }
        placeSay();
    }

    private static void placeSay() {
        if (say == null || say.getVisibility() != View.VISIBLE) return;
        int w = say.getWidth() > 0 ? say.getWidth() : (int) (180 * d);
        int h = say.getHeight() > 0 ? say.getHeight() : (int) (40 * d);
        boolean right = lp.x + size / 2 < sw / 2;            // mascotte à gauche → bulle à droite
        sayLp.x = right ? lp.x + size - (int) (4 * d) : lp.x - w + (int) (4 * d);
        sayLp.x = Math.max((int) (4 * d), Math.min(sayLp.x, sw - w - (int) (4 * d)));
        sayLp.y = Math.max(0, lp.y + size / 2 - h / 2 - (int) (18 * d));
        try { wm.updateViewLayout(say, sayLp); } catch (Throwable ignore) { }
    }

    private static void setLabel(String s) {
        if (say == null || s.equals(label)) return;
        label = s;
        if (s.isEmpty()) { say.setVisibility(View.GONE); return; }
        say.setText("💭 " + s);
        say.setVisibility(View.VISIBLE);
        say.post(new Runnable() { @Override public void run() { placeSay(); } });
    }

    private static void touchable(boolean on) {
        if (v == null) return;
        int f = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
        lp.flags = on ? f : f | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
        try { wm.updateViewLayout(v, lp); } catch (Throwable ignore) { }
    }

    private static String q(String s) { s = s == null ? "" : s.trim(); return s.length() > 28 ? s.substring(0, 27) + "…" : s; }

    /** Ce que Muse fait, en mots simples (jamais le texte tapé : il peut être privé). */
    private static String phrase(String op, JSONObject c) {
        switch (op) {
            case "open_app": return "J'ouvre " + q(c.optString("app", "une appli")) + "…";
            case "screen": case "state": return "Je lis l'écran…";
            case "screen_before": return "Je regarde ce que tu voyais…";
            case "shot": return "Je regarde l'écran 📸";
            case "tap": return c.optString("expect", "").isEmpty() ? "Je touche l'écran…" : "Je touche « " + q(c.optString("expect")) + " »…";
            case "type": return "J'écris…";
            case "swipe": return "Je fais défiler…";
            case "key": return "J'appuie sur « " + q(c.optString("key", "une touche")) + " »…";
            case "open_url": return "J'ouvre un lien…";
            case "apps": return "Je cherche l'appli…";
            case "notifs": return "Je lis tes notifications…";
            case "notif_reply": return "Je réponds au message…";
            case "notif_open": return "J'ouvre la conversation…";
            case "location": return "Je regarde où tu es 📍";
            default: return "Je travaille…";
        }
    }

    /** Avant une action de Muse (appelé par Bus, hors du fil principal). */
    static void act(final String op, final JSONObject c) {
        if (v == null || "ping".equals(op) || "notify".equals(op)) return;
        lastOp = System.currentTimeMillis();
        inOp = true;
        final String text = phrase(op, c);
        final CountDownLatch ready = new CountDownLatch(1);
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    touchable(false);
                    ready.countDown();
                    setLabel(text);
                    // Où aller : près du point touché (sans le recouvrir), sinon en haut de l'écran
                    float px = sw / 2f, py = sh * 0.22f;
                    if (c.has("x") && c.has("y")) { px = (float) c.optDouble("x", px); py = (float) c.optDouble("y", py); }
                    else if (c.has("x1")) { px = (float) c.optDouble("x1", px); py = (float) c.optDouble("y1", py); }
                    float gy = py > sh * 0.5f ? py - size - 90 * d : py + 70 * d;
                    float gx = px < sw / 2f ? px + 60 * d : px - size - 60 * d;
                    tx = Math.max(4 * d, Math.min(gx, sw - size - 4 * d));
                    ty = Math.max(40 * d, Math.min(gy, sh - size - 60 * d));
                } catch (Throwable ignore) { }
                ready.countDown();
            }
        });
        // on attend que la bulle soit « transparente au toucher » avant que Muse ne touche l'écran
        try { ready.await(400, TimeUnit.MILLISECONDS); } catch (InterruptedException ignore) { }
    }

    /** Après l'action : la bulle redevient touchable un peu plus tard. */
    static void done() {
        inOp = false;
        H.postDelayed(new Runnable() { @Override public void run() { if (!inOp) touchable(true); } }, 600);
    }

    /** S'efface (ou réapparaît) pour ne pas figurer sur une capture d'écran. */
    static void ghost(final boolean on) {
        if (v == null) return;
        final CountDownLatch l = new CountDownLatch(1);
        H.post(new Runnable() {
            @Override
            public void run() {
                try {
                    v.setVisibility(on ? View.INVISIBLE : View.VISIBLE);
                    if (say != null && !label.isEmpty()) say.setVisibility(on ? View.INVISIBLE : View.VISIBLE);
                } catch (Throwable ignore) { }
                l.countDown();
            }
        });
        try { l.await(500, TimeUnit.MILLISECONDS); if (on) Thread.sleep(120); } catch (InterruptedException ignore) { }
    }

    static void hide(MuseService s) {
        try {
            WindowManager m = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
            if (v != null) m.removeView(v);
            if (say != null) m.removeView(say);
        } catch (Throwable ignore) { }
        v = null; say = null; label = "";
        H.removeCallbacksAndMessages(null);
    }

    static boolean shown() { return v != null; }
}
