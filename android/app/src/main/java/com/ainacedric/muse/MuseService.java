package com.ainacedric.muse;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityButtonController;
import android.accessibilityservice.GestureDescription;
import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.graphics.Rect;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.graphics.PixelFormat;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Toast;
import android.os.PowerManager;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Les « mains » de Muse : lit l'écran, touche, glisse, écrit, ouvre des applis.
 * Ne fait rien tout seul : il exécute uniquement les ordres reçus par Bus (depuis ton dépôt GitHub privé).
 * Protections locales : applis d'argent / mots de passe / installation interdites.
 */
public class MuseService extends AccessibilityService {
    static volatile MuseService inst;

    static final Pattern DENY = Pattern.compile(
            "(bank|banque|bni|bfv|boa\\.|wallet|pay(pal|ment|ments)?\\b|finance|fintech|crypto|binance|coinbase|revolut|mvola|orange.?money|airtel.?money|moneygram|western.?union|authenticator|bitwarden|keepass|lastpass|1password|dashlane|vending|packageinstaller|permissioncontroller|devicepolicy|deviceadmin|findmydevice|\\.pass\\b|securefolder)",
            Pattern.CASE_INSENSITIVE);

    // ---------- Cycle de vie (la relève des ordres tourne dans Bus / KeepAlive, pas ici)
    @Override
    protected void onServiceConnected() {
        inst = this;
        Bus.log("Service d'accessibilité actif");
        Bus.ensureLoop(getApplicationContext());
        try {
            startForegroundService(new Intent(this, KeepAlive.class));
        } catch (Throwable ignore) { }
        // Bouton flottant d'accessibilité (la petite bulle Muse) : un toucher ouvre le chat Muse (le PWA).
        try {
            getAccessibilityButtonController().registerAccessibilityButtonCallback(new AccessibilityButtonController.AccessibilityButtonCallback() {
                @Override
                public void onClicked(AccessibilityButtonController c) {
                    lastClick = System.currentTimeMillis();
                    Bus.log("Bulle touchée");
                    try {
                        Panel.toggle(MuseService.this);
                    } catch (Throwable t) {
                        failOpen(t);
                    }
                }
            });
        } catch (Throwable t) { Bus.log("Bouton d'accessibilité : " + t.getMessage()); }
    }

    /**
     * Ouvre le chat Muse depuis n'importe où. Android (et surtout MIUI) bloque l'ouverture d'une appli depuis l'arrière-plan,
     * sauf si l'appli a une fenêtre visible : on pose donc une fenêtre invisible de 1 pixel (calque d'accessibilité) pendant l'ouverture.
     */
    void openChat() {
        Bus.log("Bulle touchée : ouverture du chat");
        final WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        final View v = new View(this);
        boolean added = false;
        try {
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(1, 1,
                    WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
                    PixelFormat.TRANSLUCENT);
            wm.addView(v, lp);
            added = true;
        } catch (Throwable t) {
            Bus.log("Calque invisible impossible : " + t.getMessage());
        }
        Chat.open(this);
        if (added) {
            new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() { try { wm.removeView(v); } catch (Throwable ignore) { } }
            }, 3000);
        }
    }

    static volatile long lastClick = 0;

    static String why(Throwable t) {
        StackTraceElement[] st = t.getStackTrace();
        return t.getClass().getSimpleName() + ": " + t.getMessage() + (st.length > 0 ? " @ " + st[0].getFileName() + ":" + st[0].getLineNumber() : "");
    }

    /** Si le panneau ne peut pas s'afficher : on le dit (message + journal) et on ouvre quand même le chat. */
    void failOpen(Throwable t) {
        String w = why(t);
        Bus.log("Panneau impossible → " + w);
        try { Toast.makeText(this, "Panneau indisponible, ouverture du chat (" + w + ")", Toast.LENGTH_LONG).show(); } catch (Throwable ignore) { }
        openChat();
    }

    // Écran tel qu'il était quand on a touché la bulle (avant l'ouverture du panneau) : sert à « Résumer cet écran ».
    static volatile JSONObject before = null;
    static volatile long beforeAt = 0;

    void snapshot() {
        try {
            JSONObject o = screen();
            before = o;
            beforeAt = System.currentTimeMillis();
        } catch (Throwable t) {
            before = null;
            Bus.log("Écran non mémorisé : " + t.getMessage());
        }
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) { }

    @Override
    public void onInterrupt() { }

    @Override
    public boolean onUnbind(Intent intent) {
        inst = null;
        Bus.log("Service d'accessibilité arrêté");
        return super.onUnbind(intent);
    }

    @Override
    public void onDestroy() {
        inst = null;
        super.onDestroy();
    }

    // ---------- Aides
    private static String str(CharSequence s) { return s == null ? "" : s.toString(); }

    private static String cut(String s, int n) { return s.length() > n ? s.substring(0, n) : s; }

    static String norm(String s) {
        return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase().trim();
    }

    private String pkg() {
        AccessibilityNodeInfo r = getRootInActiveWindow();
        if (r == null) return "";
        return str(r.getPackageName());
    }

    private int[] size() {
        DisplayMetrics dm = new DisplayMetrics();
        try {
            ((WindowManager) getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay().getRealMetrics(dm);
        } catch (Throwable t) {
            dm = getResources().getDisplayMetrics();
        }
        return new int[]{dm.widthPixels, dm.heightPixels};
    }

    private void denyCheck() throws Exception {
        String p = pkg();
        if (DENY.matcher(p).find()) {
            throw new Exception("Refusé : « " + p + " » est une appli protégée (argent, mots de passe, installation). Muse n'y touche jamais : dis à Cédric de le faire lui-même.");
        }
    }

    private void wake() {
        PowerManager pm = getSystemService(PowerManager.class);
        @SuppressWarnings("deprecation")
        PowerManager.WakeLock wl = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "muse:wake");
        wl.acquire(3000);
    }

    /** Allume l'écran et dépasse un écran de verrouillage SANS code. Si un code est demandé : on s'arrête. */
    private void prep() throws Exception {
        PowerManager pm = getSystemService(PowerManager.class);
        KeyguardManager km = getSystemService(KeyguardManager.class);
        if (!pm.isInteractive()) {
            wake();
            Thread.sleep(900);
        }
        if (km.isKeyguardLocked()) {
            if (!km.isKeyguardSecure()) {
                int[] s = size();
                gesture(s[0] / 2f, s[1] * 0.85f, s[0] / 2f, s[1] * 0.3f, 250);
                Thread.sleep(900);
            }
            if (km.isKeyguardLocked()) {
                throw new Exception("ÉCRAN VERROUILLÉ : Muse ne connaît pas ton code. Dis à Cédric de déverrouiller son téléphone, puis de réessayer.");
            }
        }
    }

    private boolean gesture(float x1, float y1, float x2, float y2, long ms) throws Exception {
        Path p = new Path();
        p.moveTo(x1, y1);
        if (x1 != x2 || y1 != y2) p.lineTo(x2, y2);
        GestureDescription.Builder b = new GestureDescription.Builder();
        b.addStroke(new GestureDescription.StrokeDescription(p, 0, Math.max(1, ms)));
        final CountDownLatch l = new CountDownLatch(1);
        final boolean[] ok = {false};
        boolean sent = dispatchGesture(b.build(), new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription g) { ok[0] = true; l.countDown(); }

            @Override
            public void onCancelled(GestureDescription g) { l.countDown(); }
        }, null);
        if (!sent) return false;
        l.await(ms + 3000, TimeUnit.MILLISECONDS);
        return ok[0];
    }

    // ---------- Lecture de l'écran
    private static String labelOf(AccessibilityNodeInfo n) {
        if (n.isPassword()) return "(champ mot de passe)";
        String t = str(n.getText());
        if (t.isEmpty()) t = str(n.getContentDescription());
        if (t.isEmpty()) {
            String id = n.getViewIdResourceName();
            if (id != null) {
                int k = id.indexOf(":id/");
                t = k >= 0 ? id.substring(k + 4) : id;
            }
        }
        return cut(t.replaceAll("\\s+", " ").trim(), 90);
    }

    private static String cls(AccessibilityNodeInfo n) {
        String c = str(n.getClassName());
        int k = c.lastIndexOf('.');
        return k >= 0 ? c.substring(k + 1) : c;
    }

    private void walk(AccessibilityNodeInfo n, JSONArray out, int depth) throws Exception {
        if (n == null || depth > 45 || out.length() >= 220) return;
        if (n.isVisibleToUser()) {
            Rect b = new Rect();
            n.getBoundsInScreen(b);
            String lb = labelOf(n);
            boolean click = n.isClickable() || n.isLongClickable();
            boolean edit = n.isEditable();
            if ((!lb.isEmpty() || click || edit || n.isScrollable()) && b.width() > 0 && b.height() > 0) {
                JSONObject o = new JSONObject();
                o.put("lb", lb);
                o.put("c", cls(n));
                o.put("k", click);
                o.put("s", n.isScrollable());
                o.put("e", edit);
                o.put("ck", n.isCheckable());
                o.put("ch", n.isChecked());
                o.put("en", n.isEnabled());
                o.put("pw", n.isPassword());
                o.put("l", b.left);
                o.put("tp", b.top);
                o.put("r", b.right);
                o.put("bt", b.bottom);
                out.put(o);
            }
        }
        for (int i = 0; i < n.getChildCount(); i++) walk(n.getChild(i), out, depth + 1);
    }

    private JSONObject screen() throws Exception {
        int[] s = size();
        String p = pkg();
        JSONObject o = new JSONObject();
        o.put("pkg", p);
        o.put("w", s[0]);
        o.put("h", s[1]);
        JSONArray a = new JSONArray();
        if (DENY.matcher(p).find()) {
            o.put("denied", true);
        } else {
            AccessibilityNodeInfo r = getRootInActiveWindow();
            if (r != null) walk(r, a, 0);
        }
        o.put("nodes", a);
        return o;
    }

    /** Même règle que le cerveau : plus petit élément contenant le point, avec un libellé ou cliquable. */
    private String labelAt(double x, double y) throws Exception {
        JSONArray a = new JSONArray();
        AccessibilityNodeInfo r = getRootInActiveWindow();
        if (r != null) walk(r, a, 0);
        String best = "";
        long bestArea = Long.MAX_VALUE;
        for (int i = 0; i < a.length(); i++) {
            JSONObject n = a.getJSONObject(i);
            if (x >= n.getInt("l") && x <= n.getInt("r") && y >= n.getInt("tp") && y <= n.getInt("bt") && (!n.getString("lb").isEmpty() || n.getBoolean("k"))) {
                long area = (long) (n.getInt("r") - n.getInt("l")) * (n.getInt("bt") - n.getInt("tp"));
                if (area < bestArea) { bestArea = area; best = n.getString("lb"); }
            }
        }
        return best;
    }

    private JSONObject shot() throws Exception {
        if (Build.VERSION.SDK_INT < 30) throw new Exception("Capture d'écran : Android 11 minimum.");
        final Bitmap[] bm = new Bitmap[1];
        final int[] err = {0};
        for (int attempt = 0; attempt < 2 && bm[0] == null; attempt++) {
            err[0] = 0;
            final CountDownLatch lt = new CountDownLatch(1);
            takeScreenshot(Display.DEFAULT_DISPLAY, getMainExecutor(), new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult r) {
                    try {
                        Bitmap hw = Bitmap.wrapHardwareBuffer(r.getHardwareBuffer(), r.getColorSpace());
                        bm[0] = hw.copy(Bitmap.Config.ARGB_8888, false);
                        r.getHardwareBuffer().close();
                    } catch (Throwable t) {
                        err[0] = -1;
                    }
                    lt.countDown();
                }

                @Override
                public void onFailure(int code) { err[0] = code; lt.countDown(); }
            });
            lt.await(8, TimeUnit.SECONDS);
            if (bm[0] == null && attempt == 0) Thread.sleep(1200);
        }
        if (bm[0] == null) throw new Exception("Capture impossible (code " + err[0] + ") : fenêtre protégée contre les captures, ou appels trop rapprochés.");
        int[][] opts = {{540, 50}, {480, 45}, {420, 40}, {360, 35}};
        String b64 = "";
        int W = 0, H = 0;
        for (int[] o : opts) {
            int w = Math.min(o[0], bm[0].getWidth());
            int h = Math.round(bm[0].getHeight() * (w / (float) bm[0].getWidth()));
            Bitmap sc = Bitmap.createScaledBitmap(bm[0], w, h, true);
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            sc.compress(Bitmap.CompressFormat.JPEG, o[1], bo);
            b64 = Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP);
            W = w;
            H = h;
            if (b64.length() <= 58000) break;
        }
        if (b64.length() > 62000) throw new Exception("Capture trop lourde pour le relais : utilise phone_screen.");
        JSONObject o = new JSONObject();
        o.put("pkg", pkg());
        o.put("w", W);
        o.put("h", H);
        o.put("b64", b64);
        return o;
    }

    // ---------- Saisie
    private AccessibilityNodeInfo focusedInput() {
        AccessibilityNodeInfo r = getRootInActiveWindow();
        if (r == null) return null;
        AccessibilityNodeInfo f = r.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (f != null && f.isEditable()) return f;
        List<AccessibilityNodeInfo> eds = new ArrayList<>();
        collectEditable(r, eds, 0);
        return eds.size() == 1 ? eds.get(0) : null;
    }

    private void collectEditable(AccessibilityNodeInfo n, List<AccessibilityNodeInfo> out, int depth) {
        if (n == null || depth > 45) return;
        if (n.isVisibleToUser() && n.isEditable()) out.add(n);
        for (int i = 0; i < n.getChildCount(); i++) collectEditable(n.getChild(i), out, depth + 1);
    }

    private int setText(AccessibilityNodeInfo f, String nt) throws Exception {
        Bundle a = new Bundle();
        a.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, nt);
        if (!f.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, a)) throw new Exception("Le champ a refusé le texte.");
        Bundle s = new Bundle();
        s.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, nt.length());
        s.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, nt.length());
        f.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, s);
        return nt.length();
    }

    private String currentText(AccessibilityNodeInfo f) {
        CharSequence t = f.getText();
        return (t == null || f.isShowingHintText()) ? "" : t.toString();
    }

    // ---------- Applis
    private Map<String, String> launchables() {
        PackageManager pm = getPackageManager();
        Intent q = new Intent(Intent.ACTION_MAIN);
        q.addCategory(Intent.CATEGORY_LAUNCHER);
        Map<String, String> m = new LinkedHashMap<>();
        for (ResolveInfo ri : pm.queryIntentActivities(q, 0)) {
            String p = ri.activityInfo.packageName;
            if (!m.containsKey(p)) m.put(p, str(ri.loadLabel(pm)));
        }
        return m;
    }

    private void launch(String pkg) throws Exception {
        Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
        if (i == null) throw new Exception("Impossible d'ouvrir " + pkg + ".");
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
    }

    // ---------- Exécution d'un ordre
    private JSONObject finish(JSONObject out, JSONObject c) throws Exception {
        if (c.optBoolean("look", false)) {
            Thread.sleep(Math.max(300, Math.min(4000, c.optInt("settle", 900))));
            out.put("screen", screen());
        }
        return out;
    }

    JSONObject exec(JSONObject c) throws Exception {
        String op = c.getString("op");
        JSONObject out = new JSONObject();
        switch (op) {
            case "ping": {
                out.put("model", Build.MODEL);
                out.put("android", Build.VERSION.RELEASE);
                out.put("sdk", Build.VERSION.SDK_INT);
                out.put("app", "1.8");
                return out;
            }
            case "state": {
                PowerManager pm = getSystemService(PowerManager.class);
                KeyguardManager km = getSystemService(KeyguardManager.class);
                int[] s = size();
                out.put("awake", pm.isInteractive());
                out.put("locked", km.isKeyguardLocked());
                out.put("secure", km.isKeyguardSecure());
                out.put("pkg", pkg());
                out.put("w", s[0]);
                out.put("h", s[1]);
                return out;
            }
            case "screen": {
                prep();
                return screen();
            }
            case "screen_before": {
                JSONObject b = before;
                long age = (System.currentTimeMillis() - beforeAt) / 1000;
                if (b == null || age > 600) throw new Exception("Aucun écran mémorisé récemment : Cédric doit toucher la bulle Muse depuis l'écran à résumer, puis lancer « Résumer cet écran ».");
                JSONObject o = new JSONObject(b.toString());
                o.put("ageSec", age);
                return o;
            }
            case "shot": {
                prep();
                denyCheck();
                return shot();
            }
            case "tap": {
                prep();
                denyCheck();
                double x = c.getDouble("x"), y = c.getDouble("y");
                if (c.has("expect")) {
                    String now = labelAt(x, y);
                    if (!norm(now).equals(norm(c.getString("expect")))) {
                        throw new Exception("L'écran a changé (il y a maintenant « " + now + " » à cet endroit au lieu de « " + c.getString("expect") + " ») : relis l'écran avec phone_screen.");
                    }
                }
                if (!gesture((float) x, (float) y, (float) x, (float) y, 60)) throw new Exception("Le toucher a été annulé par Android.");
                out.put("done", true);
                return finish(out, c);
            }
            case "swipe": {
                prep();
                denyCheck();
                double x1, y1, x2, y2;
                if (c.has("direction")) {
                    int[] s = size();
                    double cx = s[0] / 2.0, cy = s[1] / 2.0;
                    String d = c.getString("direction");
                    if (d.equals("down")) { x1 = cx; y1 = s[1] * 0.72; x2 = cx; y2 = s[1] * 0.28; }
                    else if (d.equals("up")) { x1 = cx; y1 = s[1] * 0.28; x2 = cx; y2 = s[1] * 0.72; }
                    else if (d.equals("left")) { x1 = s[0] * 0.8; y1 = cy; x2 = s[0] * 0.2; y2 = cy; }
                    else if (d.equals("right")) { x1 = s[0] * 0.2; y1 = cy; x2 = s[0] * 0.8; y2 = cy; }
                    else throw new Exception("Direction inconnue : " + d);
                } else {
                    x1 = c.getDouble("x1"); y1 = c.getDouble("y1"); x2 = c.getDouble("x2"); y2 = c.getDouble("y2");
                }
                if (!gesture((float) x1, (float) y1, (float) x2, (float) y2, Math.max(80, Math.min(2000, c.optLong("ms", 300))))) {
                    throw new Exception("Le geste a été annulé par Android.");
                }
                out.put("done", true);
                return finish(out, c);
            }
            case "type": {
                prep();
                denyCheck();
                AccessibilityNodeInfo f = focusedInput();
                if (f == null) throw new Exception("Aucun champ de saisie actif : touche d'abord le champ (phone_tap_text), puis réessaie.");
                String text = c.getString("text");
                String nt = c.optBoolean("clear", false) ? text : currentText(f) + text;
                out.put("length", setText(f, nt));
                return finish(out, c);
            }
            case "key": {
                prep();
                String k = c.getString("key");
                if (k.equals("home")) performGlobalAction(GLOBAL_ACTION_HOME);
                else if (k.equals("back") || k.equals("collapse")) performGlobalAction(GLOBAL_ACTION_BACK);
                else if (k.equals("recents")) performGlobalAction(GLOBAL_ACTION_RECENTS);
                else if (k.equals("notifications")) performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
                else if (k.equals("quick_settings")) performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
                else if (k.equals("wake")) wake();
                else if (k.equals("volume_up") || k.equals("volume_down") || k.equals("mute")) {
                    AudioManager am = getSystemService(AudioManager.class);
                    int dir = k.equals("volume_up") ? AudioManager.ADJUST_RAISE : k.equals("volume_down") ? AudioManager.ADJUST_LOWER : AudioManager.ADJUST_TOGGLE_MUTE;
                    am.adjustStreamVolume(AudioManager.STREAM_MUSIC, dir, AudioManager.FLAG_SHOW_UI);
                } else if (k.equals("enter") || k.equals("delete")) {
                    denyCheck();
                    AccessibilityNodeInfo f = focusedInput();
                    if (f == null) throw new Exception("Aucun champ de saisie actif.");
                    if (k.equals("delete")) {
                        String cur = currentText(f);
                        setText(f, cur.isEmpty() ? cur : cur.substring(0, cur.length() - 1));
                    } else {
                        if (Build.VERSION.SDK_INT < 30) throw new Exception("Touche Entrée : Android 11 minimum (touche le bouton Envoyer / Rechercher à l'écran).");
                        if (!f.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_IME_ENTER.getId())) throw new Exception("Le champ a refusé la touche Entrée.");
                    }
                } else {
                    throw new Exception("Touche non prise en charge : " + k + " (home, back, recents, notifications, quick_settings, enter, delete, wake, volume_up, volume_down, mute).");
                }
                out.put("done", true);
                return finish(out, c);
            }
            case "apps": {
                String q = norm(c.optString("query", ""));
                JSONArray a = new JSONArray();
                for (Map.Entry<String, String> e : launchables().entrySet()) {
                    if (a.length() >= 30) break;
                    if (q.isEmpty() || norm(e.getValue()).contains(q) || e.getKey().toLowerCase().contains(q)) a.put(e.getValue() + " | " + e.getKey());
                }
                out.put("apps", a);
                return out;
            }
            case "open_app": {
                prep();
                String app = c.getString("app");
                JSONArray pk = c.optJSONArray("pkgs");
                Map<String, String> all = launchables();
                String pkg = null;
                if (pk != null) {
                    for (int i = 0; i < pk.length() && pkg == null; i++) if (all.containsKey(pk.getString(i))) pkg = pk.getString(i);
                }
                if (pkg == null) {
                    String n = norm(app);
                    List<String> exact = new ArrayList<>(), part = new ArrayList<>();
                    for (Map.Entry<String, String> e : all.entrySet()) {
                        String l = norm(e.getValue());
                        if (e.getKey().equalsIgnoreCase(app) || l.equals(n)) exact.add(e.getKey());
                        else if (l.contains(n) || e.getKey().toLowerCase().contains(n)) part.add(e.getKey());
                    }
                    if (!exact.isEmpty()) pkg = exact.get(0);
                    else if (part.size() == 1) pkg = part.get(0);
                    else if (part.size() > 1) {
                        JSONArray a = new JSONArray();
                        for (String p : part) { if (a.length() < 12) a.put(all.get(p) + " | " + p); }
                        out.put("ambiguous", a);
                        return out;
                    } else throw new Exception("Appli « " + app + " » introuvable sur ce téléphone.");
                }
                if (DENY.matcher(pkg).find()) throw new Exception("Refusé : « " + pkg + " » est une appli protégée (argent, mots de passe, installation). Muse n'y touche jamais.");
                launch(pkg);
                out.put("pkg", pkg);
                out.put("label", all.get(pkg));
                if (!c.has("settle")) c.put("settle", 1600);
                return finish(out, c);
            }
            case "open_url": {
                prep();
                String u = c.getString("uri");
                String low = u.toLowerCase();
                if (!(low.startsWith("https:") || low.startsWith("http:") || low.startsWith("tel:") || low.startsWith("sms:") || low.startsWith("smsto:") || low.startsWith("mailto:") || low.startsWith("geo:"))) {
                    throw new Exception("Schéma non autorisé (https, tel, sms, mailto, geo seulement).");
                }
                Intent i = new Intent(low.startsWith("tel:") ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, Uri.parse(u));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                out.put("uri", u);
                if (!c.has("settle")) c.put("settle", 1600);
                return finish(out, c);
            }
            default:
                throw new Exception("Ordre inconnu : " + op);
        }
    }
}
