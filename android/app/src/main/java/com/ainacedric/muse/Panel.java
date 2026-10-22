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
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Le panneau « assistant » de Muse : s'ouvre quand on touche la bulle (bouton d'accessibilité), par-dessus n'importe quelle appli.
 * Micro + waveform, 3 actions rapides, champ de saisie. Tirer le panneau vers le haut (ou toucher ⤢) ouvre le chat Muse en grand.
 * Les demandes partent directement à Muse ; la réponse s'affiche dans le panneau et est lue à voix haute (réglable avec le haut-parleur).
 * Si le code « Cerveau » n'est pas collé dans l'appli, la demande est transmise au chat (PWA) comme avant.
 */
class Panel {
    static Panel cur;

    // Palette commune avec le chat : lavande clair, cartes blanches, accent indigo
    private static final int ACC = Color.rgb(91, 63, 214);     // #5B3FD6
    private static final int INK = Color.rgb(28, 26, 46);
    private static final int GREY = Color.rgb(108, 106, 128);
    private static final int FAINT = Color.rgb(154, 151, 176);
    private static final int PAPER = Color.rgb(248, 247, 255); // #F8F7FF
    private static final int CARD = Color.WHITE;
    private static final int SOFT = Color.rgb(239, 236, 252);
    private static final int LINE = Color.rgb(232, 228, 247);

    // Palette « bulle du PC » : carte sombre translucide, accent lavande
    private static final int DKC = Color.argb(244, 27, 21, 47);
    private static final int DKLINE = Color.argb(40, 255, 255, 255);
    private static final int TXT = Color.rgb(239, 235, 250);
    private static final int TXT2 = Color.rgb(169, 164, 196);
    private static final int ACCL = Color.rgb(160, 140, 255);
    private static final int TILE = Color.argb(20, 255, 255, 255);
    private static final int BTN_BG = Color.argb(235, 28, 24, 46);

    private final MuseService svc;
    private final WindowManager wm;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LinearLayout card, speech, bar, inputRow;
    private WindowManager.LayoutParams lp, barLp;
    private boolean placed = false;
    private int lastCx = -99999, lastCy = -99999, lastBx = -99999, lastBy = -99999;
    private String toolNote = "";
    private int moodColor = 0;
    private int waveShown = -1;
    private Wave wave;
    private TextView status, hint, answer;
    private Ico micBtn, spk, briefBtn, kbBtn, closeBtn;
    private ScrollView answerScroll, cardsScroll;
    private LinearLayout cardsBox;
    private int nCards = 0;
    private static final String BRIEF = "__BRIEF__";
    private LinearLayout chipsRow;
    private Ask ask;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private volatile boolean speaking = false;
    private volatile String lastUtt = "";
    private String pendingSpeech = null, lastSpeech = "";
    private EditText field;
    private SpeechRecognizer sr;
    private Live live;
    private boolean liveBusy = false;
    private boolean listening = false, closed = false, focusable = false;
    private boolean convo = false;   // conversation à la voix : après chaque réponse lue, le micro se rouvre
    private final Runnable relisten = new Runnable() {
        @Override public void run() { if (!closed && convo && !listening && !speaking) startListening(); }
    };
    private float downY;
    private boolean dragged;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (closed) return;
            if (speaking) wave.feed((float) (0.25 + 0.55 * Math.random()));
            wave.step(listening || speaking);
            int ws = (listening || speaking) ? 1 : 0;
            if (ws != waveShown) { waveShown = ws; wave.setVisibility(ws == 1 ? View.VISIBLE : View.GONE); }
            placePanel();
            String st = listening ? "listen" : speaking ? "speak" : !toolNote.isEmpty() && liveBusy ? "work"
                    : (liveBusy || status.getText().toString().contains("réfléchit")) ? "think" : "idle";
            Bubble.talk = st;
            h.postDelayed(this, 55);
        }
    };

    /** Appelé quand on touche la bulle : ouvre le panneau, ou le ferme s'il est déjà là. */
    static void toggle(MuseService s) {
        if (cur != null) { cur.close(); return; }
        try {
            s.snapshot();                       // mémorise l'écran AVANT que le panneau n'apparaisse (pour « Résumer cet écran »)
            final Panel p = new Panel(s);
            p.show();
            cur = p;
            if (Store.liveLinked(s)) {
                p.convo = true;
                p.h.postDelayed(new Runnable() {
                    @Override public void run() { if (!p.closed && !p.listening) p.startListening(); }
                }, 450);
            }
        } catch (Throwable t) {
            cur = null;
            s.failOpen(t);
        }
    }

    /** Ouverture par le mot d'activation « Muse » : panneau + micro tout de suite, en mode conversation. */
    static void voice(MuseService s) {
        if (cur == null) {
            toggle(s);
            if (cur == null) return;
        }
        final Panel p = cur;
        p.convo = true;
        p.h.postDelayed(new Runnable() {
            @Override public void run() { if (!p.closed && !p.listening) p.startListening(); }
        }, 350);
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

    private GradientDrawable darkCard(int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(DKC);
        g.setCornerRadius(dp(20));
        g.setStroke(dp(stroke == 0 ? 1 : 2), stroke == 0 ? DKLINE : stroke);
        return g;
    }

    private GradientDrawable circleBg(int color) {
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(color);
        g.setStroke(dp(1), DKLINE);
        return g;
    }

    // Petites icônes dans une seule « pilule » sombre (dock) : discrètes, comme sur le PC
    private Ico barBtn(int kind, int color, View.OnClickListener l) {
        Ico b = new Ico(svc, kind, color);
        b.setBackground(null);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(dp(38), dp(38));
        p.leftMargin = dp(2);
        p.rightMargin = dp(2);
        b.setLayoutParams(p);
        b.setOnClickListener(l);
        return b;
    }

    private GradientDrawable dot(int color) { GradientDrawable g = new GradientDrawable(); g.setShape(GradientDrawable.OVAL); g.setColor(color); return g; }
    private void micIdle() { if (micBtn == null) return; micBtn.set(Ico.MIC); micBtn.color(Color.WHITE); micBtn.setBackground(null); }
    private void micOn() { if (micBtn == null) return; micBtn.set(Ico.MIC); micBtn.color(Color.WHITE); micBtn.setBackground(dot(Color.rgb(92, 64, 214))); }
    private void micStop() { if (micBtn == null) return; micBtn.set(Ico.STOP); micBtn.color(Color.WHITE); micBtn.setBackground(dot(Color.argb(60, 255, 255, 255))); }

    /** Tape sur la mascotte pendant la conversation : couper Muse / reprendre le micro (comme sur le PC). */
    void micTap() { if (!closed) toggleMic(); }

    private void startBrief() {
        if (Store.liveLinked(svc) && Store.speak(svc) && !liveFailed) { convo = true; askLive(BRIEF); }
        else ask("Qu'ai-je à mon agenda aujourd'hui ? Ajoute la météo à Antananarivo et les e-mails importants non lus, en bref.", "auto");
    }

    private void addWin(View v, WindowManager.LayoutParams p) {
        try {
            wm.addView(v, p);
        } catch (Throwable first) {
            // 2e essai : fenêtre « par-dessus les autres applis » (autorisation de l'étape 3)
            Bus.log("Fenêtre d'accessibilité refusée (" + MuseService.why(first) + ") : 2e essai");
            p.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
            wm.addView(v, p);
        }
    }

    private void show() {
        int scw = svc.getResources().getDisplayMetrics().widthPixels;
        int cardW = Math.min(scw - dp(16), dp(320));

        // ---- Fenêtre « parole » : cartes de détail au-dessus, carte sombre de la réponse en dessous (flotte au-dessus de la mascotte)
        card = new LinearLayout(svc);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setAlpha(0f);

        cardsScroll = new ScrollView(svc);
        cardsBox = new LinearLayout(svc);
        cardsBox.setOrientation(LinearLayout.VERTICAL);
        cardsScroll.addView(cardsBox);
        LinearLayout.LayoutParams csl = new LinearLayout.LayoutParams(-1, -2);
        csl.bottomMargin = dp(8);
        cardsScroll.setLayoutParams(csl);
        cardsScroll.setVisibility(View.GONE);
        card.addView(cardsScroll);

        speech = new LinearLayout(svc);
        speech.setOrientation(LinearLayout.VERTICAL);
        speech.setPadding(dp(14), dp(10), dp(14), dp(12));
        speech.setBackground(darkCard(0));

        LinearLayout head = new LinearLayout(svc);
        head.setGravity(Gravity.CENTER_VERTICAL);
        status = label("Touche le micro pour parler", 12, ACCL, true);
        status.setSingleLine(true);
        status.setEllipsize(android.text.TextUtils.TruncateAt.END);
        head.addView(status, lpw(0, -2, 1f));
        spk = new Ico(svc, Store.speak(svc) ? Ico.SPEAKER : Ico.MUTE, Store.speak(svc) ? ACCL : TXT2);
        spk.setLayoutParams(new LinearLayout.LayoutParams(dp(36), dp(32)));
        spk.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { toggleSpeak(); }
        });
        head.addView(spk);
        TextView fresh = label("↺", 18, TXT2, false);
        fresh.setPadding(dp(8), dp(2), dp(8), dp(2));
        fresh.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { newConversation(); }
        });
        head.addView(fresh);
        TextView expand = label("⤢", 18, TXT2, false);
        expand.setPadding(dp(8), dp(2), dp(2), dp(2));
        expand.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openChat(typed()); }
        });
        head.addView(expand);
        speech.addView(head);

        wave = new Wave(svc);
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(-1, dp(24));
        wl.topMargin = dp(4);
        wave.setLayoutParams(wl);
        wave.setVisibility(View.GONE);
        speech.addView(wave);

        answerScroll = new ScrollView(svc);
        answer = label("", 15, TXT, false);
        answer.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, android.graphics.Typeface.ITALIC));
        answer.setPadding(0, dp(6), 0, dp(2));
        answer.setLineSpacing(0f, 1.1f);
        answer.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if (!lastSpeech.isEmpty()) speak(lastSpeech); }
        });
        answerScroll.addView(answer);
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(-1, dp(150));
        answerScroll.setLayoutParams(al);
        answerScroll.setVisibility(View.GONE);
        speech.addView(answerScroll);

        hint = label("Comment puis-je t'aider ?", 12, TXT2, false);
        hint.setPadding(0, dp(4), 0, 0);
        speech.addView(hint);

        // Saisie au clavier (cachée : s'ouvre avec le bouton clavier)
        inputRow = new LinearLayout(svc);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        inputRow.setBackground(shape(TILE, 22, DKLINE));
        inputRow.setPadding(dp(10), dp(2), dp(4), dp(2));
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2);
        rl.topMargin = dp(8);
        inputRow.setLayoutParams(rl);
        field = new EditText(svc);
        field.setHint("Écris ta demande…");
        field.setHintTextColor(TXT2);
        field.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        field.setTextColor(TXT);
        field.setSingleLine(true);
        field.setBackground(null);
        field.setImeOptions(EditorInfo.IME_ACTION_SEND);
        field.setPadding(dp(4), dp(8), dp(4), dp(8));
        field.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getActionMasked() == MotionEvent.ACTION_DOWN) makeTypable();
                return false;
            }
        });
        field.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override public boolean onEditorAction(TextView v, int actionId, android.view.KeyEvent ev) { sendTyped(); return true; }
        });
        inputRow.addView(field, lpw(0, -2, 1f));
        Ico send = new Ico(svc, Ico.UP, Color.WHITE);
        send.setBackground(circleBg(Color.rgb(92, 64, 214)));
        send.setLayoutParams(new LinearLayout.LayoutParams(dp(38), dp(38)));
        send.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { sendTyped(); }
        });
        inputRow.addView(send);
        inputRow.setVisibility(View.GONE);
        speech.addView(inputRow);
        card.addView(speech, new LinearLayout.LayoutParams(-1, -2));

        chipsRow = new LinearLayout(svc);   // (plus d'actions rapides : le briefing est sur la barre d'icônes)

        lp = new WindowManager.LayoutParams(cardW, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.LEFT;
        lp.x = dp(8);
        lp.y = svc.getResources().getDisplayMetrics().heightPixels / 3;
        lp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        addWin(card, lp);

        // ---- Icônes flottantes sous la mascotte : briefing · clavier · micro · fermer
        bar = new LinearLayout(svc);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setAlpha(0f);
        GradientDrawable pill = new GradientDrawable();
        pill.setColor(DKC);
        pill.setCornerRadius(dp(23));
        pill.setStroke(dp(1), DKLINE);
        bar.setBackground(pill);
        bar.setPadding(dp(4), dp(4), dp(4), dp(4));
        briefBtn = barBtn(Ico.SUN, Color.rgb(255, 200, 97), new View.OnClickListener() {
            @Override public void onClick(View v) { startBrief(); }
        });
        kbBtn = barBtn(Ico.KB, TXT, new View.OnClickListener() {
            @Override public void onClick(View v) {
                boolean on = inputRow.getVisibility() != View.VISIBLE;
                inputRow.setVisibility(on ? View.VISIBLE : View.GONE);
                kbBtn.setBackground(on ? dot(Color.rgb(92, 64, 214)) : null);
                if (on) { convo = false; stopListening(); makeTypable(); }
            }
        });
        micBtn = barBtn(Ico.MIC, Color.WHITE, new View.OnClickListener() {
            @Override public void onClick(View v) { toggleMic(); }
        });
        closeBtn = barBtn(Ico.CLOSE, Color.rgb(255, 122, 122), new View.OnClickListener() {
            @Override public void onClick(View v) { close(); }
        });
        bar.addView(briefBtn);
        bar.addView(kbBtn);
        bar.addView(micBtn);
        bar.addView(closeBtn);
        barLp = new WindowManager.LayoutParams(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        barLp.gravity = Gravity.TOP | Gravity.LEFT;
        barLp.x = dp(8);
        barLp.y = lp.y + dp(200);
        addWin(bar, barLp);

        h.post(tick);
        Wake.pause(true);   // le panneau prend le micro
        Bus.log("Panneau assistant ouvert");
    }

    /** Place la carte au-dessus de la mascotte et les icônes en dessous ; suit la mascotte quand elle bouge. */
    private void placePanel() {
        if (closed || card == null || bar == null) return;
        int cw = card.getWidth(), ch = card.getHeight(), bw = bar.getWidth(), bh = bar.getHeight();
        if (cw <= 0 || ch <= 0 || bw <= 0 || bh <= 0) return;
        android.util.DisplayMetrics dm = svc.getResources().getDisplayMetrics();
        int mx = Bubble.px(), my = Bubble.py(), ms = Bubble.sizePx();
        if (ms <= 0) { ms = dp(72); }
        int mid = mx + ms / 2;
        int by = Math.min(my + ms + dp(4), dm.heightPixels - bh - dp(24));   // juste sous la mascotte, sans la toucher
        int cy = my - ch + dp(8);
        if (cy < dp(28)) cy = by + bh + dp(6);          // pas de place au-dessus : la carte passe sous les icônes
        int cx = Math.max(dp(8), Math.min(mid - cw / 2, dm.widthPixels - cw - dp(8)));
        int bx = Math.max(dp(4), Math.min(mid - bw / 2, dm.widthPixels - bw - dp(4)));
        if (inputRow != null && inputRow.getVisibility() == View.VISIBLE) cy = dp(48);   // clavier ouvert : la carte monte en haut pour rester visible
        cy = Math.max(dp(24), Math.min(cy, dm.heightPixels - ch - dp(8)));
        try {
            if (cx != lastCx || cy != lastCy) { lp.x = cx; lp.y = cy; wm.updateViewLayout(card, lp); lastCx = cx; lastCy = cy; }
            if (bx != lastBx || by != lastBy) { barLp.x = bx; barLp.y = by; wm.updateViewLayout(bar, barLp); lastBx = bx; lastBy = by; }
            if (!placed) { placed = true; card.setAlpha(1f); bar.setAlpha(1f); }
        } catch (Throwable ignore) { }
    }

    private View chip(String first, String second, View.OnClickListener l) {
        TextView t = label(first + "\n" + second, 13, INK, false);
        t.setGravity(Gravity.CENTER);
        t.setLineSpacing(0f, 1.05f);
        t.setPadding(dp(4), dp(10), dp(4), dp(10));
        t.setBackground(shape(CARD, 20, LINE));
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
        convo = false;
        ask(q, "auto");
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

    // ---------- Demande + réponse dans le panneau
    private void ask(String q, String mode) {
        Shield.clearBack();
        stopListening();
        stopSpeaking();
        if (Store.liveLinked(svc) && "auto".equals(mode) && Store.speak(svc) && !liveFailed) { askLive(q); return; }
        if (!Store.brainLinked(svc)) {
            status.setText("Ouvert dans le chat");
            hint.setText("Pour voir et entendre la réponse ici : colle le code « Cerveau » dans l'appli Muse Tél. (étape 7).");
            openChatWith(q, mode);
            return;
        }
        if (ask != null) ask.cancel();
        field.setText("");
        chipsRow.setVisibility(View.GONE);
        answerScroll.setVisibility(View.GONE);
        hint.setVisibility(View.VISIBLE);
        String shown = q.length() > 90 ? q.substring(0, 90) + "…" : q;
        status.setText("Muse réfléchit…");
        hint.setText("« " + shown + " »");
        ask = new Ask(svc, new Ask.Cb() {
            @Override public void waiting(int seconds) { if (!closed) status.setText("Muse réfléchit… " + seconds + " s"); }
            @Override public void reply(String raw) { if (!closed) showReply(raw); }
            @Override public void error(String msg) {
                if (closed) return;
                status.setText("Oups, ça n'a pas marché");
                hint.setText(msg);
                chipsRow.setVisibility(View.VISIBLE);
                Bus.log("Panneau : " + msg);
            }
        });
        ask.start(q, mode);
    }


    // ---------- Muse Live : réponse à voix haute depuis le PC (voix neuronale, phrase par phrase)
    private boolean liveFailed = false;
    private final StringBuilder liveText = new StringBuilder();

    private void askLive(final String q) {
        Shield.clearBack();
        stopListening();
        stopSpeaking();
        field.setText("");
        chipsRow.setVisibility(View.GONE);
        answerScroll.setVisibility(View.GONE);
        hint.setVisibility(View.VISIBLE);
        hint.setText(BRIEF.equals(q) ? "☀️ Briefing du jour" : "« " + (q.length() > 90 ? q.substring(0, 90) + "…" : q) + " »");
        status.setText("Muse réfléchit…");
        liveText.setLength(0);
        clearCards();
        setMood("");
        Wake.prepare(svc);
        liveBusy = true;
        if (live == null) {
            live = new Live(svc, new Live.Cb() {
                @Override public void ready() { }
                @Override public void thinking() { if (!closed) status.setText("Muse réfléchit…"); }
                @Override public void speaking() { if (closed) return; speaking = true; toolNote = ""; micStop(); status.setText("Muse parle"); Wake.guard(true, halt); }
                @Override public void card(JSONObject c) { if (!closed) addCard(c); }
                @Override public void mood(String m) { if (!closed) setMood(m); }
                @Override public void tool(String label) { if (!closed && !label.isEmpty()) { toolNote = label; status.setText(label + "…"); hint.setVisibility(View.GONE); } }
                @Override public void delta(String t) {
                    if (closed) return;
                    liveText.append(t);
                    hint.setVisibility(View.GONE);
                    answer.setText(liveText.toString().trim());
                    answerScroll.setVisibility(View.VISIBLE);
                    answerScroll.getLayoutParams().height = liveText.length() < 140 ? -2 : dp(190);
                    answerScroll.requestLayout();
                }
                @Override public void finished() {
                    if (closed) return;
                    speaking = false; liveBusy = false; toolNote = "";
                    micIdle();
                    Wake.guard(false, null);
                    lastSpeech = liveText.toString().trim();
                    status.setText("À toi");
                    if (convo) h.postDelayed(relisten, 350);
                }
                @Override public void fallback(String t) { if (!closed) speak(t); }
                @Override public void error(String msg) {
                    if (closed) return;
                    liveBusy = false; speaking = false;
                    Wake.guard(false, null);
                    Bus.log("Live : " + msg);
                    if (live != null) { live.close(); live = null; }
                    liveFailed = true;   // on retombe sur le chemin habituel (GitHub) pour cette fois
                    status.setText("Live indisponible");
                    hint.setVisibility(View.VISIBLE);
                    hint.setText(msg);
                    if (BRIEF.equals(q)) ask("Qu'ai-je à mon agenda aujourd'hui ? Ajoute la météo à Antananarivo et les e-mails importants non lus, en bref.", "auto");
                    else ask(q, "auto");
                }
            });
            live.connect();
        }
        sendWhenOpen(q, 0);
    }

    private void sendWhenOpen(final String q, final int tries) {
        if (closed || live == null) return;
        if (live.isOpen()) { if (BRIEF.equals(q)) live.brief(); else live.say(q); return; }
        if (tries > 40) return;   // ~8 s : l'erreur de connexion prend le relais
        h.postDelayed(new Runnable() { @Override public void run() { sendWhenOpen(q, tries + 1); } }, 200);
    }

    // ✋ « Attends » / « Stop » pendant que Muse parle : elle se tait et le micro se rouvre
    private final Runnable halt = new Runnable() {
        @Override public void run() {
            Wake.guard(false, null);
            if (closed || live == null || !(speaking || liveBusy)) return;
            live.stop(); speaking = false; liveBusy = false;
            status.setText("Je t'écoute");
            convo = true;
            h.postDelayed(relisten, 300);
        }
    };

    private void setMood(String m) {
        int c = 0;
        switch (m == null ? "" : m) {
            case "joie": c = Color.rgb(255, 200, 97); Bubble.reaction("happy", 3200); break;
            case "surprise": c = Color.rgb(236, 90, 170); Bubble.reaction("happy", 3200); break;
            case "alerte": c = Color.rgb(255, 122, 64); Bubble.reaction("sad", 3200); break;
            case "triste": c = Color.rgb(100, 150, 245); Bubble.reaction("sad", 3200); break;
            case "taquine": c = Color.rgb(190, 125, 255); Bubble.reaction("happy", 3200); break;
            case "inquiete": c = Color.rgb(140, 165, 205); Bubble.reaction("sad", 3200); break;
            case "calme": c = Color.rgb(100, 217, 178); break;
            case "pense": c = ACCL; break;
            default: c = 0;
        }
        moodColor = c;
        try { if (speech != null) speech.setBackground(darkCard(c == 0 ? 0 : (c & 0x00FFFFFF) | 0x99000000)); } catch (Throwable ignore) { }
    }

    private int typeColor(String t) {
        switch (t == null ? "" : t) {
            case "meteo": return Color.rgb(255, 200, 97);
            case "agenda": return Color.rgb(127, 178, 255);
            case "mails": return Color.rgb(255, 143, 143);
            case "chiffres": case "lieu": return Color.rgb(124, 224, 181);
            case "action": return Color.rgb(255, 176, 103);
            default: return ACCL;
        }
    }

    private void clearCards() {
        nCards = 0;
        if (cardsBox == null) return;
        cardsBox.removeAllViews();
        cardsScroll.setVisibility(View.GONE);
    }

    private void addCard(JSONObject c) {
        try {
            if (nCards >= 3) return;
            nCards++;
            LinearLayout box = new LinearLayout(svc);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setBackground(darkCard(0));
            box.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(-1, -2);
            if (nCards > 1) bl.topMargin = dp(8);
            box.setLayoutParams(bl);
            String icon = c.optString("icon"), title = c.optString("title", "Muse"), sub = c.optString("sub"), big = c.optString("big");
            int tc = typeColor(c.optString("type"));
            TextView head = label((icon.isEmpty() ? "" : icon + "  ") + title, 16, TXT, true);
            box.addView(head);
            if (!sub.isEmpty()) box.addView(label(sub, 13, TXT2, false));
            if (!big.isEmpty()) {
                TextView b = label(big, 34, tc, true);
                b.setPadding(0, dp(2), 0, dp(2));
                box.addView(b);
            }
            JSONArray st = c.optJSONArray("stats");
            if (st != null && st.length() > 0) {
                LinearLayout row = null;
                for (int i = 0; i < Math.min(6, st.length()); i++) {
                    if (i % 3 == 0) {
                        row = new LinearLayout(svc);
                        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2);
                        rl.topMargin = dp(6);
                        row.setLayoutParams(rl);
                        box.addView(row);
                    }
                    JSONObject x = st.optJSONObject(i);
                    if (x == null) continue;
                    TextView t = label(x.optString("v") + "\n" + x.optString("k"), 14, TXT, true);
                    t.setPadding(dp(10), dp(6), dp(10), dp(6));
                    t.setBackground(shape(TILE, 12, 0));
                    LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(0, -2, 1f);
                    tl.rightMargin = dp(6);
                    t.setLayoutParams(tl);
                    row.addView(t);
                }
            }
            JSONArray it = c.optJSONArray("items");
            if (it != null) for (int i = 0; i < Math.min(6, it.length()); i++) {
                JSONObject x = it.optJSONObject(i);
                if (x == null || x.optString("t").isEmpty()) continue;
                LinearLayout row = new LinearLayout(svc);
                row.setGravity(Gravity.CENTER_VERTICAL);
                row.setPadding(0, dp(7), 0, dp(1));
                if (!x.optString("icon").isEmpty()) {
                    TextView ic = label(x.optString("icon"), 17, TXT, false);
                    ic.setPadding(0, 0, dp(10), 0);
                    row.addView(ic);
                }
                TextView mid = label(x.optString("t"), 14, TXT, false);
                if (!x.optString("s").isEmpty()) mid.append("\n" + x.optString("s"));
                row.addView(mid, lpw(0, -2, 1f));
                if (!x.optString("v").isEmpty()) {
                    TextView v = label(x.optString("v"), 13, tc, true);
                    v.setPadding(dp(8), 0, 0, 0);
                    row.addView(v);
                }
                final String url = x.optString("url");
                if (url.startsWith("http")) {
                    mid.setTextColor(ACCL);
                    row.setOnClickListener(new View.OnClickListener() {
                        @Override public void onClick(View v) {
                            try {
                                Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url));
                                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                svc.startActivity(i);
                                close();
                            } catch (Throwable ignore) { }
                        }
                    });
                }
                box.addView(row);
            }
            JSONArray ac = c.optJSONArray("actions");
            if (ac != null && ac.length() > 0) {
                LinearLayout row = new LinearLayout(svc);
                LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2);
                rl.topMargin = dp(10);
                row.setLayoutParams(rl);
                for (int i = 0; i < Math.min(3, ac.length()); i++) {
                    JSONObject x = ac.optJSONObject(i);
                    if (x == null) continue;
                    final String say = x.optString("say"), lab = x.optString("label");
                    if (say.isEmpty() || lab.isEmpty()) continue;
                    String l = lab.toLowerCase(Locale.FRANCE);
                    boolean ghost = i > 0 && (l.contains("annul") || l.contains("non") || l.contains("plus tard"));
                    TextView b = label(lab, 14, Color.WHITE, true);
                    b.setGravity(Gravity.CENTER);
                    b.setPadding(dp(14), dp(8), dp(14), dp(8));
                    b.setBackground(shape(ghost ? TILE : Color.rgb(92, 64, 214), 18, 0));
                    LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(-2, -2);
                    pl.rightMargin = dp(8);
                    b.setLayoutParams(pl);
                    b.setOnClickListener(new View.OnClickListener() {
                        @Override public void onClick(View v) { convo = true; askLive(say); }
                    });
                    row.addView(b);
                }
                box.addView(row);
            }
            cardsBox.addView(box);
            cardsScroll.setVisibility(View.VISIBLE);
            // panneau compact : la réponse parlée se réduit quand une carte arrive
            answerScroll.getLayoutParams().height = dp(90);
            answerScroll.requestLayout();
            int sh = svc.getResources().getDisplayMetrics().heightPixels;
            cardsScroll.getLayoutParams().height = nCards > 1 || (it != null && it.length() > 3) ? Math.min(dp(320), sh / 2) : -2;
            cardsScroll.requestLayout();
        } catch (Throwable t) {
            Bus.log("Carte : " + t.getMessage());
        }
    }

    private void showReply(String raw) {
        boolean err = raw.contains("<!--muse-error-->");
        String text = Ask.plain(raw, false);
        if (text.isEmpty()) text = "(réponse vide)";
        int nImg = Ask.imgCount(raw);
        if (nImg > 0) text += "\n\n" + nImg + (nImg > 1 ? " images" : " image") + " à voir dans le chat Muse (touche ⤢).";
        status.setText(err ? "⚠️ Problème" : "Muse");
        hint.setVisibility(View.GONE);
        answer.setText(text);
        answerScroll.scrollTo(0, 0);
        answerScroll.setVisibility(View.VISIBLE);
        answerScroll.getLayoutParams().height = text.length() < 140 ? -2 : dp(190);
        answerScroll.requestLayout();
        chipsRow.setVisibility(View.GONE);
        lastSpeech = err ? "" : Ask.plain(raw, true);
        if (!err && Store.speak(svc)) speak(lastSpeech);
        else if (convo) h.postDelayed(relisten, 900);
    }

    private void newConversation() {
        if (ask != null) ask.cancel();
        stopSpeaking();
        Ask.forgetConversation(svc);
        clearCards();
        answerScroll.setVisibility(View.GONE);
        hint.setVisibility(View.VISIBLE);
        chipsRow.setVisibility(View.VISIBLE);
        field.setText("");
        status.setText("Nouvelle conversation");
        hint.setText("Comment puis-je t'aider ?");
    }

    // ---------- Lecture à voix haute
    private void toggleSpeak() {
        boolean on = !Store.speak(svc);
        Store.setSpeak(svc, on);
        spk.set(on ? Ico.SPEAKER : Ico.MUTE);
        spk.color(on ? ACCL : TXT2);
        if (!on) stopSpeaking();
        else if (answerScroll.getVisibility() == View.VISIBLE && !lastSpeech.isEmpty()) speak(lastSpeech);
        Bus.log("Lecture à voix haute : " + (on ? "oui" : "non"));
    }

    private void speak(String text) {
        if (text == null || text.trim().isEmpty() || closed) return;
        if (tts == null) {
            pendingSpeech = text;
            try {
                tts = new TextToSpeech(svc, new TextToSpeech.OnInitListener() {
                    @Override
                    public void onInit(final int st) {
                        h.post(new Runnable() {
                            @Override public void run() { onTtsReady(st); }
                        });
                    }
                });
            } catch (Throwable t) {
                Bus.log("Voix de lecture impossible : " + t.getMessage());
            }
            return;
        }
        if (ttsReady) say(text); else pendingSpeech = text;
    }

    private void onTtsReady(int st) {
        if (closed) { try { if (tts != null) tts.shutdown(); } catch (Throwable ignore) { } return; }
        if (st != TextToSpeech.SUCCESS) {
            Bus.log("Voix de lecture indisponible (code " + st + ")");
            tts = null;
            hint.setVisibility(View.VISIBLE);
            hint.setText("Voix de lecture indisponible sur ce téléphone.");
            return;
        }
        ttsReady = true;
        int r = tts.setLanguage(Locale.FRANCE);
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) Bus.log("Voix française absente : voix par défaut du téléphone");
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { speaking = true; }
            @Override public void onDone(String id) {
                if (id != null && id.equals(lastUtt)) {
                    speaking = false;
                    if (convo) h.postDelayed(relisten, 450);
                }
            }
            @Override public void onError(String id) { if (id != null && id.equals(lastUtt)) speaking = false; }
        });
        String t = pendingSpeech;
        pendingSpeech = null;
        if (t != null) say(t);
    }

    private void say(String text) {
        try {
            tts.stop();
            String rest = text.trim();
            int i = 0;
            while (!rest.isEmpty()) {
                String part = rest;
                if (rest.length() > 1500) {
                    int cut = Math.max(rest.lastIndexOf(". ", 1500), rest.lastIndexOf("\n", 1500));
                    if (cut < 300) cut = rest.lastIndexOf(' ', 1500);
                    if (cut < 300) cut = 1500;
                    part = rest.substring(0, cut + 1);
                }
                rest = rest.substring(part.length()).trim();
                lastUtt = "m" + (rest.isEmpty() ? "last" : String.valueOf(i));
                tts.speak(part.trim(), TextToSpeech.QUEUE_ADD, null, lastUtt);
                i++;
            }
        } catch (Throwable t) {
            Bus.log("Lecture : " + t.getMessage());
        }
    }

    private void stopSpeaking() {
        Wake.guard(false, null);
        try { if (live != null) live.stop(); } catch (Throwable ignore) { }
        pendingSpeech = null;
        speaking = false;
        try { if (tts != null && ttsReady) tts.stop(); } catch (Throwable ignore) { }
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
        if (ask != null) ask.cancel();
        try { if (live != null) { live.close(); live = null; } } catch (Throwable ignore) { }
        Wake.guard(false, null);
        stopListening();
        speaking = false;
        try { if (tts != null) { tts.stop(); tts.shutdown(); } } catch (Throwable ignore) { }
        try { if (sr != null) sr.destroy(); } catch (Throwable ignore) { }
        h.removeCallbacksAndMessages(null);
        try { wm.removeView(card); } catch (Throwable ignore) { }
        try { if (bar != null) wm.removeView(bar); } catch (Throwable ignore) { }
        Bubble.talk = null;
        if (cur == this) cur = null;
        Wake.pause(false);
    }

    // ---------- Voix
    private void toggleMic() {
        if (live != null && (speaking || liveBusy)) { live.stop(); speaking = false; liveBusy = false; status.setText("À toi"); convo = true; startListening(); return; }
        if (listening) { convo = false; stopListening(); status.setText("Touche le micro pour parler"); return; }
        convo = true;      // parler au micro = conversation à la voix (réponse lue, puis le micro se rouvre)
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
                    @Override public void onEndOfSpeech() { listening = false; micIdle(); status.setText("Je réfléchis…"); }
                    @Override public void onError(int code) {
                        listening = false;
                        micIdle();
                        if (convo && (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                            convo = false;
                            status.setText("À plus tard");
                            closeLater();
                        } else if (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) status.setText("Je n'ai rien entendu : retouche le micro");
                        else if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) status.setText("Micro non autorisé");
                        else status.setText("Micro indisponible (code " + code + ") : écris ta demande");
                    }
                    @Override public void onResults(Bundle b) {
                        listening = false;
                        micIdle();
                        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String q = (r == null || r.isEmpty()) ? "" : r.get(0).trim();
                        if (q.isEmpty()) { status.setText("Je n'ai rien compris : retouche le micro"); return; }
                        if (convo && q.toLowerCase(Locale.FRANCE).matches("^(merci|stop|arrête|arrete|c'est tout|au revoir|ferme|ça ira|ca ira|non merci)\\b.*")) {
                            convo = false;
                            status.setText("À plus tard");
                            speak("À plus tard, Cédric.");
                            h.postDelayed(new Runnable() { @Override public void run() { close(); } }, 2600);
                            return;
                        }
                        field.setText(q);
                        status.setText("« " + q + " »");
                        ask(q, "auto");
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
            micOn();
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
        try { micIdle(); sr.stopListening(); } catch (Throwable ignore) { }
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
            float slot = w / N, bw = slot * 0.32f, mid = hh / 2f;
            for (int i = 0; i < N; i++) {
                float t = i / (float) (N - 1);
                p.setColor(ACCL);
                p.setAlpha(i % 3 == 0 ? 110 : 230);
                float half = Math.max(bw / 2f, lv[i] * hh * 0.5f);
                float x = i * slot + (slot - bw) / 2f;
                cv.drawRoundRect(x, mid - half, x + bw, mid + half, bw / 2f, bw / 2f, p);
            }
        }
    }
}
