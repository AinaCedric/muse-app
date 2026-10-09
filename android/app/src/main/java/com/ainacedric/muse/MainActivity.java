package com.ainacedric.muse;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.CompoundButton;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Switch;
import android.widget.TextView;
import android.widget.Toast;

/** Assistant de configuration : chaque réglage nécessaire, avec un bouton qui ouvre la bonne page Android. */
public class MainActivity extends Activity {
    private LinearLayout root;
    private Button wakeBtn, notifBtn;
    private TextView sLoc, sAuto, sWake, sBrain, sLink, sAcc, sOver, sBat, sNot, sMic, sTest, logv;
    private String testMsg = "";
    private TextView sStat;
    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable tick = new Runnable() {
        @Override
        public void run() { refresh(); h.postDelayed(this, 2500); }
    };

    private int dp(int v) { return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()); }

    private TextView text(String s, int sp, boolean bold, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(t.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(6);
        t.setLayoutParams(lp);
        return t;
    }

    private Button button(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setOnClickListener(l);
        return b;
    }

    private TextView step(int n, String title, String desc) {
        TextView head = text("⬜  " + n + ". " + title, 17, true, Color.parseColor("#1a1a2e"));
        LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) head.getLayoutParams();
        lp.topMargin = dp(22);
        root.addView(head);
        root.addView(text(desc, 14, false, Color.parseColor("#444444")));
        return head;
    }

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ScrollView sv = new ScrollView(this);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int p = dp(18);
        root.setPadding(p, dp(28), p, p);
        sv.addView(root);
        setContentView(sv);

        root.addView(text("Muse · Téléphone  v2.6", 26, true, Color.parseColor("#5B3FD6")));
        root.addView(text("Cette appli permet à Muse de manipuler ce téléphone quand tu le lui demandes dans l'appli Muse (mode 📱 Téléphone). Fais les étapes 1 à 5 (la 6, le micro, est facultative) ci-dessous, une seule fois. Rien ne bouge tant que tu n'écris pas à Muse.", 14, false, Color.parseColor("#444444")));

        // Voyant d'état en direct
        sStat = text("", 13, true, Color.parseColor("#1a1a2e"));
        root.addView(sStat);
        Bus.ensureLoop(getApplicationContext());
        startKeepAlive();

        // 1. Liaison
        sLink = step(1, "Lier ce téléphone à ton Muse", "Colle le code de liaison (qui commence par MUSE1.) fourni par ton PC. Astuce : envoie-le toi à toi-même (e-mail, WhatsApp, Telegram), copie-le, puis touche le bouton.");
        root.addView(button("📋  Coller le code et enregistrer", new View.OnClickListener() {
            @Override
            public void onClick(View v) { pasteCode(); }
        }));

        // 2. Accessibilité
        sAcc = step(2, "Activer l'accessibilité", "Dans la liste, touche « Muse » (parfois sous « Applications installées »), active l'interrupteur et accepte. Si l'interrupteur est grisé (Android 13+) : touche le 2e bouton, puis ⋮ en haut à droite → « Autoriser les paramètres restreints », et recommence.");
        root.addView(button("♿  Ouvrir les réglages d'accessibilité", new View.OnClickListener() {
            @Override
            public void onClick(View v) { open(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); }
        }));
        root.addView(button("⚙️  Si c'est grisé : infos de l'appli", new View.OnClickListener() {
            @Override
            public void onClick(View v) { open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()))); }
        }));

        // 3. Superposition
        sOver = step(3, "Autoriser l'affichage par-dessus les autres applis", "Nécessaire pour que Muse puisse ouvrir une appli (agenda, WhatsApp…) quand l'écran est sur autre chose. Active l'interrupteur pour Muse.");
        root.addView(button("🪟  Ouvrir ce réglage", new View.OnClickListener() {
            @Override
            public void onClick(View v) { open(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()))); }
        }));

        // 4. Batterie
        sBat = step(4, "Désactiver l'économie de batterie pour Muse", "Sinon Android endort l'appli et Muse ne répond plus quand l'écran est éteint. Choisis « Autoriser ».");
        root.addView(button("🔋  Ouvrir ce réglage", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    startActivity(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getPackageName())));
                } catch (Exception e) {
                    open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                }
            }
        }));

        // 5. Notifications
        sNot = step(5, "Autoriser les notifications", "Muse affichera « Muse utilise ton téléphone » pendant qu'elle agit, pour que tu voies toujours quand elle travaille.");
        root.addView(button("🔔  Autoriser", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
                else Toast.makeText(MainActivity.this, "Déjà autorisé sur cette version d'Android.", Toast.LENGTH_SHORT).show();
            }
        }));

        // 6. Micro
        sMic = step(6, "Autoriser le micro (pour parler à Muse)", "Optionnel : permet de dicter tes demandes dans le panneau de la bulle. Sans le micro, tu peux toujours écrire.");
        root.addView(button("🎤  Autoriser le micro", new View.OnClickListener() {
            @Override
            public void onClick(View v) { requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, 2); }
        }));
        if (getIntent().getBooleanExtra("mic", false)) requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, 2);

        // 7. Réponses dans le panneau
        sBrain = step(7, "Voir et entendre les réponses dans le panneau", "Dans l'appli Muse (PWA) : ⚙️ Réglages → « 📲 Copier le code pour le téléphone ». Reviens ici et touche le bouton : le panneau de la bulle affichera les réponses et les lira à voix haute (🔊/🔇 pour couper).");
        root.addView(button("🧠  Coller le code Cerveau", new View.OnClickListener() {
            @Override
            public void onClick(View v) { pasteBrain(); }
        }));

        // 8. Mot d'activation
        sWake = step(8, "Dire « Muse » pour lui parler", "Optionnel : le téléphone écoute le seul mot « Muse » (reconnaissance 100 % hors ligne, rien n'est envoyé). Dis « Muse », puis ta demande : elle répond à voix haute et le micro se rouvre pour enchaîner. Dis « merci » pour terminer. Le voyant micro d'Android reste allumé et la batterie s'use un peu plus.");
        wakeBtn = button("", new View.OnClickListener() {
            @Override
            public void onClick(View v) { toggleWake(); }
        });
        root.addView(wakeBtn);
        notifBtn = button("", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Store.setNotify(MainActivity.this, !Store.notify(MainActivity.this));
                refresh();
            }
        });
        root.addView(notifBtn);

        // 9. Automatisations
        sAuto = step(9, "Automatisations : surveiller les notifications", "Pour l'onglet ⚡ Automatisations de l'appli Muse : Muse repère les notifications que tu as choisies (ex. un message d'un contact) et agit toute seule. Touche le bouton, active « Muse » dans la liste et accepte. Si c'est grisé : bouton « infos de l'appli » de l'étape 2, ⋮ → « Autoriser les paramètres restreints ». Il faut aussi avoir collé le code Cerveau (étape 7).");
        root.addView(button("🔔  Autoriser l'accès aux notifications", new View.OnClickListener() {
            @Override
            public void onClick(View v) { open(new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")); }
        }));

        // 10. Position
        sLoc = step(10, "Position (restaurants proches, itinéraires)", "Optionnel : quand tu demandes « le plus proche », Muse lit la position du téléphone pour chercher autour de toi et tracer le chemin. Touche le bouton, accepte, puis choisis « Toujours autoriser » (sinon Muse ne la voit pas quand l'appli est fermée). Muse ne la lit que quand tu le lui demandes.");
        root.addView(button("📍  Autoriser la position", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (!Loc.granted(MainActivity.this)) requestPermissions(new String[]{"android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"}, 4);
                else if (!Loc.background(MainActivity.this)) requestPermissions(new String[]{"android.permission.ACCESS_BACKGROUND_LOCATION"}, 5);
                else Toast.makeText(MainActivity.this, "Position déjà autorisée ✅", Toast.LENGTH_SHORT).show();
            }
        }));

        root.addView(button("🫧  Tester le panneau (comme la bulle)", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (MuseService.inst == null) {
                    Toast.makeText(MainActivity.this, "Accessibilité inactive : réactive Muse dans Réglages → Accessibilité.", Toast.LENGTH_LONG).show();
                    return;
                }
                try {
                    Panel.toggle(MuseService.inst);
                } catch (Throwable t) {
                    MuseService.inst.failOpen(t);
                }
            }
        }));
        root.addView(button("💬  Ouvrir le chat Muse", new View.OnClickListener() {
            @Override
            public void onClick(View v) { Chat.open(MainActivity.this); }
        }));

        // Test + pause
        sTest = text("", 15, true, Color.parseColor("#1a1a2e"));
        LinearLayout.LayoutParams tl = (LinearLayout.LayoutParams) sTest.getLayoutParams();
        tl.topMargin = dp(26);
        root.addView(sTest);
        root.addView(button("🧪  Tester la connexion à Muse", new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                testMsg = "Test en cours…";
                sTest.setText(testMsg);
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        final String r = Bus.test(MainActivity.this);
                        runOnUiThread(new Runnable() {
                            @Override
                            public void run() { testMsg = r; sTest.setText(r); }
                        });
                    }
                }).start();
            }
        }));

        Switch pause = new Switch(this);
        pause.setText("⏸️  Pause : Muse n'agit plus sur ce téléphone");
        pause.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        pause.setChecked(Store.paused(this));
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(-1, -2);
        pl.topMargin = dp(18);
        pause.setLayoutParams(pl);
        pause.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton v, boolean on) { Store.setPaused(MainActivity.this, on); }
        });
        root.addView(pause);

        root.addView(text("Sécurité", 17, true, Color.parseColor("#1a1a2e")));
        root.addView(text("• Les applis d'argent (banque, Mvola, Orange Money…), de mots de passe et le Play Store sont interdites à Muse.\n• Envoyer, appeler, payer, supprimer, installer, ouvrir un lien : Muse te demande toujours OUI avant.\n• Pour tout couper : interrupteur Pause ci-dessus, ou désactive Muse dans les réglages d'accessibilité.", 13, false, Color.parseColor("#444444")));

        root.addView(text("Dernières actions", 17, true, Color.parseColor("#1a1a2e")));
        logv = text("", 12, false, Color.parseColor("#555555"));
        logv.setTypeface(android.graphics.Typeface.MONOSPACE);
        root.addView(logv);
    }

    private void startKeepAlive() {
        try {
            startForegroundService(new Intent(this, KeepAlive.class));
        } catch (Throwable t) {
            Bus.log("Service permanent non démarré : " + t.getMessage());
        }
    }

    private void open(Intent i) {
        try {
            startActivity(i);
        } catch (Exception e) {
            Toast.makeText(this, "Impossible d'ouvrir ce réglage : " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void pasteCode() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData d = cm.getPrimaryClip();
            String s = (d != null && d.getItemCount() > 0) ? d.getItemAt(0).coerceToText(this).toString() : "";
            int k = s.indexOf("MUSE1.");
            if (k < 0) throw new Exception("Le presse-papiers ne contient pas de code MUSE1.… : copie-le d'abord.");
            String code = s.substring(k).trim().split("\\s+")[0];
            Store.link(this, code);
            Toast.makeText(this, "✅ Code enregistré pour " + Store.repo(this), Toast.LENGTH_LONG).show();
            testMsg = "";
        } catch (Exception e) {
            Toast.makeText(this, "❌ " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
        refresh();
    }

    private void toggleWake() {
        boolean on = !Store.wake(this);
        Store.setWake(this, on);
        if (on && checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.RECORD_AUDIO"}, 3);
        } else {
            startKeepAlive();
        }
        Toast.makeText(this, on ? "Dis « Muse » pour lui parler" : "Écoute de « Muse » coupée", Toast.LENGTH_SHORT).show();
        refresh();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 4 && Loc.granted(this) && !Loc.background(this)) { Toast.makeText(this, "Choisis maintenant « Toujours autoriser »", Toast.LENGTH_LONG).show(); requestPermissions(new String[]{"android.permission.ACCESS_BACKGROUND_LOCATION"}, 5); }
        startKeepAlive();
        refresh();
    }

    private void pasteBrain() {
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData d = cm.getPrimaryClip();
            String s = (d != null && d.getItemCount() > 0) ? d.getItemAt(0).coerceToText(this).toString() : "";
            int k = s.indexOf("MUSEB.");
            if (k < 0) throw new Exception("Le presse-papiers ne contient pas de code MUSEB.… : copie-le d'abord depuis la PWA (⚙️ Réglages).");
            String code = s.substring(k).trim().split("\\s+")[0];
            Store.linkBrain(this, code);
            Toast.makeText(this, "✅ Panneau relié à " + Store.brain(this), Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "❌ " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
        refresh();
    }

    private static void mark(TextView t, boolean ok) {
        String s = t.getText().toString();
        if (s.length() > 1) t.setText((ok ? "✅" : "⬜") + s.substring(1));
    }

    private boolean accessibilityOn() {
        String s = Settings.Secure.getString(getContentResolver(), Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
        return s != null && s.contains(getPackageName()) && s.contains("MuseService");
    }

    private void refresh() {
        mark(sLink, Store.linked(this));
        mark(sBrain, Store.brainLinked(this));
        mark(sWake, Store.wake(this));
        mark(sAuto, NotifWatch.enabled(this) && Store.brainLinked(this));
        mark(sLoc, Loc.granted(this) && Loc.background(this));
        wakeBtn.setText(Store.wake(this) ? "🔕  Arrêter l'écoute de « Muse »" : "🗣️  Activer « Muse » à la voix");
        notifBtn.setText(Store.notify(this) ? "🔔  Notifications des réponses : activées" : "🔕  Notifications des réponses : coupées");
        mark(sAcc, accessibilityOn());
        mark(sOver, Settings.canDrawOverlays(this));
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        mark(sBat, pm.isIgnoringBatteryOptimizations(getPackageName()));
        mark(sMic, checkSelfPermission("android.permission.RECORD_AUDIO") == PackageManager.PERMISSION_GRANTED);
        mark(sNot, Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED);
        String link = Store.linked(this) ? "Lié à " + Store.repo(this) : "Pas encore lié";
        String acc = MuseService.inst != null ? "service actif" : "service inactif";
        sTest.setText(testMsg.isEmpty() ? link + " · " + acc : testMsg);
        long ago = Bus.lastPoll == 0 ? -1 : (System.currentTimeMillis() - Bus.lastPoll) / 1000;
        sStat.setText("Accessibilité : " + (MuseService.inst != null ? "✅ active" : "❌ INACTIVE (réactive Muse dans les réglages d'accessibilité)")
                + "\nDernier toucher de la bulle : " + (MuseService.lastClick == 0 ? "aucun" : "il y a " + (System.currentTimeMillis() - MuseService.lastClick) / 1000 + " s")
                + "\nMot d'activation : " + Wake.state
                + "\nNotifications (automatisations) : " + (NotifWatch.enabled(this) ? NotifWatch.state : "❌ accès non accordé (étape 9)")
                + "\nRelève des ordres : " + (ago < 0 ? "pas encore" : "il y a " + ago + " s (HTTP " + Bus.lastCode + ")"));
        logv.setText(Bus.logText());
    }

    @Override
    protected void onResume() {
        super.onResume();
        h.post(tick);
    }

    @Override
    protected void onPause() {
        super.onPause();
        h.removeCallbacks(tick);
    }
}
