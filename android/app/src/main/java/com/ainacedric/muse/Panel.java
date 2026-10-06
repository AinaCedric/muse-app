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

    // Palette « papier » commune avec le chat
    private static final int ACC = Color.rgb(196, 83, 45);     // terracotta
    private static final int INK = Color.rgb(28, 27, 25);
    private static final int GREY = Color.rgb(110, 106, 98);
    private static final int FAINT = Color.rgb(156, 151, 141);
    private static final int PAPER = Color.rgb(246, 243, 238);
    private static final int CARD = Color.rgb(255, 253, 249);
    private static final int SOFT = Color.rgb(236, 230, 220);
    private static final int LINE = Color.rgb(227, 221, 210);

    private final MuseService svc;
    private final WindowManager wm;
    private final Handler h = new Handler(Looper.getMainLooper());
    private LinearLayout card;
    private WindowManager.LayoutParams lp;
    private Wave wave;
    private TextView status, hint, answer;
    private Ico micBtn, spk;
    private ScrollView answerScroll;
    private LinearLayout chipsRow;
    private Ask ask;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private volatile boolean speaking = false;
    private volatile String lastUtt = "";
    private String pendingSpeech = null, lastSpeech = "";
    private EditText field;
    private SpeechRecognizer sr;
    private boolean listening = false, closed = false, focusable = false;
    private float downY;
    private boolean dragged;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (closed) return;
            if (speaking) wave.feed((float) (0.25 + 0.55 * Math.random()));
            wave.step(listening || speaking);
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
        card.setBackground(shape(PAPER, 22, LINE));

        // Poignée + en-tête (zone qu'on tire vers le haut pour agrandir vers le chat)
        LinearLayout top = new LinearLayout(svc);
        top.setOrientation(LinearLayout.VERTICAL);
        LinearLayout gripRow = new LinearLayout(svc);
        gripRow.setGravity(Gravity.CENTER);
        View grip = new View(svc);
        grip.setBackground(shape(Color.rgb(214, 207, 194), 3, 0));
        grip.setLayoutParams(new LinearLayout.LayoutParams(dp(44), dp(5)));
        gripRow.addView(grip);
        gripRow.setPadding(0, dp(4), 0, dp(8));
        top.addView(gripRow);

        LinearLayout head = new LinearLayout(svc);
        head.setGravity(Gravity.CENTER_VERTICAL);
        View dot = new View(svc);
        GradientDrawable dg = new GradientDrawable();
        dg.setShape(GradientDrawable.OVAL);
        dg.setColor(ACC);
        dot.setBackground(dg);
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(dp(8), dp(8));
        dl.leftMargin = dp(4);
        dot.setLayoutParams(dl);
        head.addView(dot);
        TextView title = label("Muse", 22, INK, false);
        title.setTypeface(android.graphics.Typeface.SERIF);
        title.setPadding(dp(10), 0, 0, 0);
        head.addView(title, lpw(0, -2, 1f));
        spk = new Ico(svc, Store.speak(svc) ? Ico.SPEAKER : Ico.MUTE, Store.speak(svc) ? ACC : GREY);
        spk.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
        spk.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { toggleSpeak(); }
        });
        head.addView(spk);
        TextView fresh = label("↺", 22, GREY, false);
        fresh.setPadding(dp(8), dp(4), dp(8), dp(4));
        fresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { newConversation(); }
        });
        head.addView(fresh);
        TextView expand = label("⤢", 22, GREY, false);
        expand.setPadding(dp(8), dp(4), dp(8), dp(4));
        expand.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { openChat(typed()); }
        });
        head.addView(expand);
        TextView min = label("—", 22, GREY, false);
        min.setPadding(dp(8), dp(4), dp(6), dp(4));
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
        waveBox.setBackground(shape(CARD, 14, LINE));
        waveBox.setPadding(dp(10), dp(6), dp(10), dp(6));
        wave = new Wave(svc);
        waveBox.addView(wave, new LinearLayout.LayoutParams(-1, dp(56)));
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(-1, -2);
        wl.topMargin = dp(10);
        waveBox.setLayoutParams(wl);
        card.addView(waveBox);

        status = label("Touche le micro pour parler", 19, INK, false);
        status.setTypeface(android.graphics.Typeface.create(android.graphics.Typeface.SERIF, android.graphics.Typeface.ITALIC));
        status.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(-1, -2);
        sl.topMargin = dp(10);
        status.setLayoutParams(sl);
        card.addView(status);
        hint = label("Comment puis-je t'aider ?", 14, GREY, false);
        hint.setGravity(Gravity.CENTER);
        card.addView(hint);
        answerScroll = new ScrollView(svc);
        answer = label("", 15, INK, false);
        answer.setPadding(dp(14), dp(10), dp(14), dp(10));
        answer.setLineSpacing(0f, 1.1f);
        answer.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { if (!lastSpeech.isEmpty()) speak(lastSpeech); }
        });
        answerScroll.addView(answer);
        answerScroll.setBackground(shape(CARD, 14, LINE));
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(-1, dp(190));
        al.topMargin = dp(8);
        answerScroll.setLayoutParams(al);
        answerScroll.setVisibility(View.GONE);
        card.addView(answerScroll);

        // 3 actions rapides
        LinearLayout chips = new LinearLayout(svc);
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(-1, -2);
        cl.topMargin = dp(12);
        chips.setLayoutParams(cl);
        chipsRow = chips;
        chips.addView(chip("Résumer", "cet écran", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                ask("Résume en quelques lignes ce qui était affiché sur l'écran de mon téléphone quand j'ai ouvert l'assistant (lis-le avec l'outil phone_screen_before, sans rien toucher).", "phone");
            }
        }), lpw(0, -2, 1f));
        chips.addView(chip("Écrire", "un message", new View.OnClickListener() {
            @Override
            public void onClick(View v) { writeMessage(); }
        }), lpw(0, -2, 1f));
        chips.addView(chip("Programme", "du jour", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                ask("Qu'ai-je à mon agenda aujourd'hui ? Ajoute les e-mails importants non lus, en bref.", "auto");
            }
        }), lpw(0, -2, 1f));
        card.addView(chips);

        // Saisie : micro · champ · envoyer
        LinearLayout row = new LinearLayout(svc);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackground(shape(CARD, 14, Color.rgb(214, 207, 194)));
        row.setPadding(dp(6), dp(4), dp(6), dp(4));
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, -2);
        rl.topMargin = dp(12);
        row.setLayoutParams(rl);
        micBtn = new Ico(svc, Ico.MIC, GREY);
        micBtn.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
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
        Ico send = new Ico(svc, Ico.UP, Color.WHITE);
        send.setBackground(shape(INK, 10, 0));
        send.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
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

    private View chip(String first, String second, View.OnClickListener l) {
        TextView t = label(first + "\n" + second, 13, INK, false);
        t.setGravity(Gravity.CENTER);
        t.setLineSpacing(0f, 1.05f);
        t.setPadding(dp(4), dp(10), dp(4), dp(10));
        t.setBackground(shape(CARD, 12, LINE));
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
        stopListening();
        stopSpeaking();
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

    private void showReply(String raw) {
        boolean err = raw.contains("<!--muse-error-->");
        String text = Ask.plain(raw, false);
        if (text.isEmpty()) text = "(réponse vide)";
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
    }

    private void newConversation() {
        if (ask != null) ask.cancel();
        stopSpeaking();
        Ask.forgetConversation(svc);
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
        spk.color(on ? ACC : GREY);
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
            @Override public void onDone(String id) { if (id != null && id.equals(lastUtt)) speaking = false; }
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
        stopListening();
        speaking = false;
        try { if (tts != null) { tts.stop(); tts.shutdown(); } } catch (Throwable ignore) { }
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
                    @Override public void onEndOfSpeech() { listening = false; micBtn.set(Ico.MIC); micBtn.color(GREY); micBtn.setBackground(null); status.setText("Je réfléchis…"); }
                    @Override public void onError(int code) {
                        listening = false;
                        micBtn.set(Ico.MIC); micBtn.color(GREY); micBtn.setBackground(null);
                        if (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) status.setText("Je n'ai rien entendu : retouche le micro");
                        else if (code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) status.setText("Micro non autorisé");
                        else status.setText("Micro indisponible (code " + code + ") : écris ta demande");
                    }
                    @Override public void onResults(Bundle b) {
                        listening = false;
                        micBtn.set(Ico.MIC); micBtn.color(GREY); micBtn.setBackground(null);
                        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String q = (r == null || r.isEmpty()) ? "" : r.get(0).trim();
                        if (q.isEmpty()) { status.setText("Je n'ai rien compris : retouche le micro"); return; }
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
            micBtn.set(Ico.STOP); micBtn.color(Color.WHITE); micBtn.setBackground(shape(Color.rgb(180, 53, 31), 10, 0));
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
        try { micBtn.set(Ico.MIC); micBtn.color(GREY); micBtn.setBackground(null); sr.stopListening(); } catch (Throwable ignore) { }
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
                p.setColor(ACC);
                p.setAlpha(i % 3 == 0 ? 110 : 220);
                float half = Math.max(bw / 2f, lv[i] * hh * 0.5f);
                float x = i * slot + (slot - bw) / 2f;
                cv.drawRoundRect(x, mid - half, x + bw, mid + half, bw / 2f, bw / 2f, p);
            }
        }
    }
}
