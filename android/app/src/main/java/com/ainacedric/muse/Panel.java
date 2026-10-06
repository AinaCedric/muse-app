package com.ainacedric.muse;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;

/**
 * Le panneau « assistant » de Muse : s'ouvre quand on touche la bulle (bouton d'accessibilité), par-dessus n'importe quelle appli.
 * Micro + waveform, 3 actions rapides, champ de saisie. Tirer le panneau vers le haut (ou toucher ⤢) ouvre le chat Muse en grand.
 * Les demandes sont transmises au chat (PWA) qui les envoie à Muse.
 */
class Panel {
    static Panel cur;

    private static final int INDIGO = Color.rgb(91, 63, 214);
    private static final int INK = Color.rgb(28, 26, 46);
    private static final int GREY = Color.rgb(108, 106, 128);

    private final MuseService svc;
    private final WindowManager wm;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LinearLayout card;
    private WindowManager.LayoutParams lp;
    private Wave wave;
    private TextView status, hint, micBtn;
    private EditText field;
    private SpeechRecognizer sr;
    private boolean listening = false, closed = false, focusable = false;
    private float downY;
    private boolean dragged;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (closed) return;
            wave.step(listening);
            h.postDelayed(this, 55);
        }
    };

    /** Appelé quand on touche la bulle : ouvre le panneau, ou le ferme s'il est déjà là. */
    static void toggle(MuseService s) {
        if (cur != null) { cur.close(); return; }
        try {
            s.snapshot();                       // mémorise l'écran AVANT que le panneau n'apparaisse (pour « Résumer cet écran »)
            Panel p = new Panel(s);
            p.show();
            cur = p;
        } catch (Throwable t) {
            cur = null;
            s.failOpen(t);
        }
    }

    private Panel(MuseService s) {
        svc = s;
        wm = (WindowManager) s.getSystemService(Context.WINDOW_SERVICE);
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, svc.getResources().getDisplayMetrics());
    }

    private GradientDrawable shape(int color, int radiusDp, int strokeColor) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) g.setStroke(dp(1), strokeColor);
        return g;
    }

    private TextView label(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(svc);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        return t;
    }

    private LinearLayout.LayoutParams lpw(int w, int hh, float weight) {
        return new LinearLayout.LayoutParams(w, hh, weight);
    }

    private TextView circle(String glyph, int bg, int fg, int sizeDp, int sp) {
        TextView t = label(glyph, sp, fg, true);
        t.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(bg);
        t.setBackground(g);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        return t;
    }

    private void show() {
        card = new LinearLayout(svc);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(8), dp(16), dp(14));
        card.setBackground(shape(Color.rgb(248, 247, 255), 28, Color.rgb(224, 220, 245)));

        // Poignée + en-tête (zone qu'on tire vers le haut pour agrandir vers le chat)
        LinearLayout top = new LinearLayout(svc);
        top.setOrientation(LinearLayout.VERTICAL);
        LinearLayout gripRow = new LinearLayout(svc);
        gripRow.setGravity(Gravity.CENTER);
        View grip = new View(svc);
        grip.setBackground(shape(Color.rgb(200, 196, 224), 3, 0));
        grip.setLayoutParams(new LinearLayout.LayoutParams(dp(44), dp(5)));
        gripRow.addView(grip);
        gripRow.setPadding(0, dp(4), 0, dp(8));
        top.addView(gripRow);

        LinearLayout head = new LinearLayout(svc);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView badge = circle("✦", INDIGO, Color.WHITE, 34, 16);
        head.addView(badge);
        TextView title = label("Muse", 20, INK, true);
        title.setPadding(dp(10), 0, 0, 0);
        head.addView(title, lpw(0, -2, 1f));
        TextView expand = label("⤢", 22, GREY, false);
        expand.setPadding(dp(12), dp(4), dp(12), dp(4));
        expand.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { openChat(typed()); }
        });
        head.addView(expand);
        TextView min = label("—", 22, GREY, false);
        min.setPadding(dp(12), dp(4), dp(8), dp(4));
        min.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { close(); }
        });
        head.addView(min);
        top.addView(head);
        top.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                int a = e.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN) { downY = e.getRawY(); dragged = false; return true; }
                if (a == MotionEvent.ACTION_MOVE && !dragged && downY - e.getRawY() > dp(70)) {
                    dragged = true;
                    openChat(typed());
                    return true;
                }
                return true;
            }
        });
        card.addView(top);

        // Waveform
        LinearLayout waveBox = new LinearLayout(svc);
        waveBox.setBackground(shape(Color.rgb(236, 233, 251), 18, 0));
        waveBox.setPadding(dp(10), dp(6), dp(10), dp(6));
        wave = new Wave(svc);
        waveBox.addView(wave, new LinearLayout.LayoutParams(-1, dp(78)));
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(-1, -2);
        wl.topMargin = dp(10);
        waveBox.setLayoutParams(wl);
        card.addView(waveBox);

        status = label("Touche le micro pour parler", 18, INDIGO, true);
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(-1, -2);
        sl.topMargin = dp(10);
        status.setLayoutParams(sl);
        card.addView(status);
        hint = label("Comment puis-je t'aider ?", 14, GREY, false);
        hint.setGravity(Gravity.CENTER);
        card.addView(hint);

        // 3 actions rapides
        LinearLayout chips = new LinearLayout(svc);
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-1, -2);
        cl.topMargin = dp(12);
        chips.setLayoutParams(cl);
        chips.addView(chip("✨", "Résumer\ncet écran", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openChatWith("Résume en quelques lignes ce qui était affiché sur l'écran de mon téléphone quand j'ai ouvert l'assistant (lis-le avec l'outil phone_screen_before, sans rien toucher).", "phone");
            }
        }), lpw(0, -2, 1f));
        chips.addView(chip("✏️", "Écrire\nun message", new View.OnClickListener() {
            @Override
            public void onClick(View v) { writeMessage(); }
        }), lpw(0, -2, 1f));
        chips.addView(chip("📅", "Mon programme\ndu jour", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                openChatWith("Qu'ai-je à mon agenda aujourd'hui ? Ajoute les e-mails importants non lus, en bref.", "auto");
            }
        }), lpw(0, -2, 1f));
        card.addView(chips);

        // Saisie : micro · champ · envoyer
        LinearLayout row = new LinearLayout(svc);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackground(shape(Color.WHITE, 26, Color.rgb(214, 210, 238)));
        row.setPadding(dp(6), dp(4), dp(6), dp(4));
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2);
        rl.topMargin = dp(12);
        row.setLayoutParams(rl);
        micBtn = circle("🎤", Color.rgb(236, 233, 251), INDIGO, 40, 18);
        micBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { toggleMic(); }
        });
        row.addView(micBtn);
        field = new EditText(svc);
        field.setHint("Demande-moi n'importe quoi…");
        field.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        field.setTextColor(INK);
        field.setSingleLine(true);
        field.setBackground(null);
        field.setImeOptions(EditorInfo.IME_ACTION_SEND);
        field.setPadding(dp(10), dp(8), dp(10), dp(8));
        field.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent e) {
                if (e.getActionMasked() == MotionEvent.ACTION_DOWN) makeTypable();
                return false;
            }
        });
        field.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, android.view.KeyEvent ev) {
                sendTyped();
                return true;
            }
        });
        row.addView(field, lpw(0, -2, 1f));
        TextView send = circle("➤", INDIGO, Color.WHITE, 40, 16);
        send.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { sendTyped(); }
        });
        row.addView(send);
        card.addView(row);

        int sw = svc.getResources().getDisplayMetrics().widthPixels;
        lp = new WindowManager.LayoutParams(sw - dp(20), WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        lp.y = dp(26);
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        try {
            wm.addView(card, lp);
        } catch (Throwable first) {
            // 2e essai : fenêtre « par-dessus les autres applis » (autorisation de l'étape 3)
            Bus.log("Fenêtre d'accessibilité refusée (" + MuseService.why(first) + ") : 2e essai");
            lp.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            wm.addView(card, lp);
        }
        h.post(tick);
        Bus.log("Panneau assistant ouvert");
    }

    private View chip(String icon, String text, View.OnClickListener l) {
        TextView t = label(icon + "\n" + text, 12, INK, false);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(4), dp(10), dp(4), dp(10));
        t.setBackground(shape(Color.WHITE, 16, Color.rgb(214, 210, 238)));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1f);
        p.leftMargin = dp(3);
        p.rightMargin = dp(3);
        t.setLayoutParams(p);
        t.setOnClickListener(l);
        return t;
    }

    private String typed() {
        return field == null ? "" : field.getText().toString().trim();
    }

    /** Rend la fenêtre « tapable » (clavier) : elle ne l'est qu'au moment où on touche le champ, pour ne pas gêner l'appli dessous. */
    private void makeTypable() {
        if (focusable || closed) return;
        focusable = true;
        try {
            lp.flags = lp.flags & ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            wm.updateViewLayout(card, lp);
            h.postDelayed(new Runnable() {
                @Override
                public void run() {
                    try {
                        field.requestFocus();
                        ((InputMethodManager) svc.getSystemService(Context.INPUT_METHOD_SERVICE)).showSoftInput(field, InputMethodManager.SHOW_IMPLICIT);
                    } catch (Throwable ignore) { }
                }
            }, 120);
        } catch (Throwable t) {
            Bus.log("Clavier impossible dans le panneau : " + t.getMessage());
        }
    }

    private void writeMessage() {
        stopListening();
        field.setText("Écris un message à ");
        field.setSelection(field.getText().length());
        status.setText("À qui, et quoi écrire ?");
        hint.setText("Ex. : « Écris à Maman que j'arrive dans 10 minutes »");
        makeTypable();
    }

    private void sendTyped() {
        String q = typed();
        if (q.isEmpty()) { status.setText("Écris ou dis ta demande"); return; }
        openChatWith(q, "auto");
    }

    private void openChat(String q) {
        if (q == null || q.isEmpty()) { Chat.open(svc); closeLater(); }
        else openChatWith(q, "auto");
    }

    private void openChatWith(String q, String mode) {
        stopListening();
        Chat.ask(svc, q, mode);
        closeLater();
    }

    private void closeLater() {
        h.postDelayed(new Runnable() {
            @Override
            public void run() { close(); }
        }, 1500);
    }

    void close() {
        if (closed) return;
        closed = true;
        stopListening();
        try { if (sr != null) sr.destroy(); } catch (Throwable ignore) { }
        h.removeCallbacksAndMessages(null);
        try { wm.removeView(card); } catch (Throwable ignore) { }
        if (cur == this) cur = null;
    }

    // ---------- Voix
    private void toggleMic() {
        if (listening) { stopListening(); status.setText("Touche le micro pour parler"); return; }
        startListening();
    }

    private void startListening() {
        if (svc.checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
            status.setText("Autorise le micro, puis reviens");
            hint.setText("Une page de réglages s'ouvre : touche « Autoriser le micro ».");
            try {
                Intent i = new Intent(svc, MainActivity.class);
                i.putExtra("mic", true);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                svc.startActivity(i);
            } catch (Throwable ignore) { }
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(svc)) {
            status.setText("Voix indisponible sur ce téléphone");
            hint.setText("Écris ta demande dans le champ ci-dessous.");
            return;
        }
        try {
            if (sr == null) {
                sr = SpeechRecognizer.createSpeechRecognizer(svc);
                sr.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle b) { status.setText("J'écoute…"); }
                    @Override public void onBeginningOfSpeech() { }
                    @Override public void onRmsChanged(float rms) { wave.feed(Math.max(0f, Math.min(1f, (rms + 2f) / 12f))); }
                    @Override public void onBufferReceived(byte[] buf) { }
                    @Override public void onEndOfSpeech() { listening = false; micBtn.setText("🎤"); status.setText("Je réfléchis…"); }
                    @Override public void onError(int code) {
                        listening = false;
                        micBtn.setText("🎤");
                        if (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) status.setText("Je n'ai rien entendu : retouche le micro");
                        else if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) status.setText("Micro non autorisé");
                        else status.setText("Micro indisponible (code " + code + ") : écris ta demande");
                    }
                    @Override public void onResults(Bundle b) {
                        listening = false;
                        micBtn.setText("🎤");
                        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String q = (r == null || r.isEmpty()) ? "" : r.get(0).trim();
                        if (q.isEmpty()) { status.setText("Je n'ai rien compris : retouche le micro"); return; }
                        field.setText(q);
                        status.setText("« " + q + " »");
                        openChatWith(q, "auto");
                    }
                    @Override public void onPartialResults(Bundle b) {
                        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        if (r != null && !r.isEmpty()) hint.setText(r.get(0));
                    }
                    @Override public void onEvent(int type, Bundle b) { }
                });
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "fr-FR");
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            listening = true;
            micBtn.setText("⏹");
            status.setText("J'écoute…");
            hint.setText("Parle, je t'écoute");
            sr.startListening(i);
        } catch (Throwable t) {
            listening = false;
            status.setText("Voix impossible : écris ta demande");
            Bus.log("Voix : " + t.getMessage());
        }
    }

    private void stopListening() {
        if (!listening) return;
        listening = false;
        try { micBtn.setText("🎤"); sr.stopListening(); } catch (Throwable ignore) { }
    }

    // ---------- Waveform
    static class Wave extends View {
        private static final int N = 36;
        private final Paint p = new Paint();
        private final float[] lv = new float[N];
        private float level = 0f, phase = 0f;

        Wave(Context c) {
            super(c);
            p.setAntiAlias(true);
        }

        void feed(float l) { level = Math.max(level, l); }

        void step(boolean live) {
            phase += 0.22f;
            for (int i = 0; i < N - 1; i++) lv[i] = lv[i + 1];
            float v;
            if (live) {
                v = 0.10f + 0.9f * level * (0.65f + 0.35f * (float) Math.abs(Math.sin(phase * 1.7f)));
                level *= 0.6f;
            } else {
                v = 0.07f + 0.05f * (float) Math.sin(phase);
            }
            lv[N - 1] = Math.max(0.05f, Math.min(1f, v));
            invalidate();
        }

        @Override
        protected void onDraw(Canvas cv) {
            float w = getWidth(), hh = getHeight();
            float slot = w / N, bw = slot * 0.55f, mid = hh / 2f;
            for (int i = 0; i < N; i++) {
                float t = i / (float) (N - 1);
                p.setColor(Color.rgb((int) (79 + 89 * t), (int) (70 + 15 * t), (int) (229 + 18 * t)));
                float half = Math.max(bw / 2f, lv[i] * hh * 0.5f);
                float x = i * slot + (slot - bw) / 2f;
                cv.drawRoundRect(x, mid - half, x + bw, mid + half, bw / 2f, bw / 2f, p);
            }
        }
    }
}
