package com.ainacedric.muse;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

/**
 * La bulle Muse : la mascotte 3D de Muse (images de l'avatar de l'appli, animées), toujours visible, glissable.
 * Au repos elle flotte et cligne des yeux ; quand Muse agit sur le téléphone, elle « réfléchit » (anneaux, comètes).
 * Remplace le bouton système d'accessibilité, qui se réduisait/s'estompait et n'avalait parfois que le 1er toucher.
 * Un toucher = ouvre/ferme le panneau. Glisser = déplacer ; au lâcher, elle se colle au bord le plus proche.
 */
class Bubble {
    private static ImageView v;
    private static Drawable[] idle, think;
    private static int frame = 0, dir = 1;
    private static final Handler H = new Handler(Looper.getMainLooper());
    private static Runnable tick;

    private static Drawable[] load(MuseService s, String base) {
        Drawable[] out = new Drawable[24];
        for (int i = 0; i < 24; i++) {
            int id = s.getResources().getIdentifier(base + (i < 10 ? "_0" : "_") + i, "drawable", s.getPackageName());
            if (id == 0) return null;
            out[i] = s.getDrawable(id);
        }
        return out;
    }
    private static WindowManager.LayoutParams lp;

    static void show(final MuseService s) {
        hide(s);
        try {
            final WindowManager wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
            final float d = s.getResources().getDisplayMetrics().density;
            final int size = (int) (72 * d);
            final int sw = s.getResources().getDisplayMetrics().widthPixels;
            final int sh = s.getResources().getDisplayMetrics().heightPixels;
            final SharedPreferences sp = s.getSharedPreferences("muse_bubble", Context.MODE_PRIVATE);

            if (idle == null) { idle = load(s, "muse_idle"); think = load(s, "muse_think"); }
            final ImageView t = new ImageView(s);
            t.setScaleType(ImageView.ScaleType.FIT_CENTER);
            if (idle != null) t.setImageDrawable(idle[0]);
            final PowerManager pm = (PowerManager) s.getSystemService(Context.POWER_SERVICE);
            // Animation aller-retour à 12 images/s (boucle sans saut)
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
            lp.x = sp.getInt("x", sw - size - (int) (4 * d));
            lp.y = Math.max(0, Math.min(sp.getInt("y", sh / 2), sh - size));

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
                            try { wm.updateViewLayout(view, lp); } catch (Throwable ignore) { }
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                            if (moved) {
                                lp.x = (lp.x + size / 2 < sw / 2) ? (int) (4 * d) : sw - size - (int) (4 * d);
                                lp.y = Math.max(0, Math.min(lp.y, sh - size));
                                try { wm.updateViewLayout(view, lp); } catch (Throwable ignore) { }
                                sp.edit().putInt("x", lp.x).putInt("y", lp.y).apply();
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
            H.removeCallbacksAndMessages(null);
            H.postDelayed(tick, 83);
            Bus.log("Bulle affichée");
        } catch (Throwable x) {
            v = null;
            Bus.log("Bulle impossible : " + x.getMessage());
        }
    }

    static void hide(MuseService s) {
        try {
            if (v != null) ((WindowManager) s.getSystemService(Context.WINDOW_SERVICE)).removeView(v);
        } catch (Throwable ignore) { }
        v = null;
        H.removeCallbacksAndMessages(null);
    }

    static boolean shown() { return v != null; }
}
