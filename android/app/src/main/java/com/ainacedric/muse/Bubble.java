package com.ainacedric.muse;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

/**
 * La bulle Muse : notre propre fenêtre flottante (calque d'accessibilité), toujours visible, glissable.
 * Remplace le bouton système d'accessibilité, qui se réduisait/s'estompait et n'avalait parfois que le 1er toucher.
 * Un toucher = ouvre/ferme le panneau. Glisser = déplacer ; au lâcher, elle se colle au bord le plus proche.
 */
class Bubble {
    private static TextView v;
    private static WindowManager.LayoutParams lp;

    static void show(final MuseService s) {
        hide(s);
        try {
            final WindowManager wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
            final float d = s.getResources().getDisplayMetrics().density;
            final int size = (int) (54 * d);
            final int sw = s.getResources().getDisplayMetrics().widthPixels;
            final int sh = s.getResources().getDisplayMetrics().heightPixels;
            final SharedPreferences sp = s.getSharedPreferences("muse_bubble", Context.MODE_PRIVATE);

            TextView t = new TextView(s);
            t.setText("M");
            t.setTextColor(Color.WHITE);
            t.setTextSize(22);
            t.setGravity(Gravity.CENTER);
            GradientDrawable g = new GradientDrawable();
            g.setShape(GradientDrawable.OVAL);
            g.setColor(Color.parseColor("#5B3FD6"));
            t.setBackground(g);
            t.setAlpha(0.92f);

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
    }

    static boolean shown() { return v != null; }
}
