package com.ainacedric.muse;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

/** Petites icônes dessinées au trait (micro, stop, envoyer, haut-parleur) : pas d'emojis dans le panneau. */
class Ico extends View {
    static final int MIC = 0, STOP = 1, UP = 2, SPEAKER = 3, MUTE = 4;
    private final Paint p = new Paint();
    private int kind;
    private final RectF r = new RectF();

    Ico(Context c, int kind, int color) {
        super(c);
        this.kind = kind;
        p.setAntiAlias(true);
        p.setColor(color);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeCap(Paint.Cap.ROUND);
        p.setStrokeJoin(Paint.Join.ROUND);
    }

    void set(int k) { kind = k; invalidate(); }

    void color(int c) { p.setColor(c); invalidate(); }

    @Override
    protected void onDraw(Canvas cv) {
        float w = getWidth(), h = getHeight();
        float s = Math.min(w, h) * 0.5f / 24f;          // icône de 24 unités occupant la moitié du bouton
        float ox = (w - 24 * s) / 2f, oy = (h - 24 * s) / 2f;
        p.setStrokeWidth(1.8f * s);
        p.setStyle(Paint.Style.STROKE);
        switch (kind) {
            case MIC:
                r.set(ox + 9 * s, oy + 3 * s, ox + 15 * s, oy + 14 * s);
                cv.drawRoundRect(r, 3 * s, 3 * s, p);
                r.set(ox + 5 * s, oy + 4 * s, ox + 19 * s, oy + 18 * s);
                cv.drawArc(r, 0, 180, false, p);
                cv.drawLine(ox + 12 * s, oy + 18 * s, ox + 12 * s, oy + 21 * s, p);
                break;
            case STOP:
                p.setStyle(Paint.Style.FILL);
                r.set(ox + 7 * s, oy + 7 * s, ox + 17 * s, oy + 17 * s);
                cv.drawRoundRect(r, 2 * s, 2 * s, p);
                break;
            case UP:
                p.setStrokeWidth(2.2f * s);
                cv.drawLine(ox + 12 * s, oy + 19 * s, ox + 12 * s, oy + 5 * s, p);
                cv.drawLine(ox + 6 * s, oy + 11 * s, ox + 12 * s, oy + 5 * s, p);
                cv.drawLine(ox + 18 * s, oy + 11 * s, ox + 12 * s, oy + 5 * s, p);
                break;
            default:
                float[] pts = {3, 9, 6, 9, 6, 9, 11, 5, 11, 5, 11, 19, 11, 19, 6, 15, 6, 15, 3, 15, 3, 15, 3, 9};
                for (int i = 0; i < pts.length; i += 4)
                    cv.drawLine(ox + pts[i] * s, oy + pts[i + 1] * s, ox + pts[i + 2] * s, oy + pts[i + 3] * s, p);
                if (kind == SPEAKER) {
                    r.set(ox + 10 * s, oy + 8 * s, ox + 18 * s, oy + 16 * s);
                    cv.drawArc(r, -50, 100, false, p);
                    r.set(ox + 8 * s, oy + 4 * s, ox + 24 * s, oy + 20 * s);
                    cv.drawArc(r, -50, 100, false, p);
                } else {
                    cv.drawLine(ox + 15 * s, oy + 9 * s, ox + 21 * s, oy + 15 * s, p);
                    cv.drawLine(ox + 21 * s, oy + 9 * s, ox + 15 * s, oy + 15 * s, p);
                }
        }
    }
}
