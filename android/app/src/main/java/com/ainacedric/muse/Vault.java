package com.ainacedric.muse;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Coffre du code de déverrouillage : chiffré AES-GCM avec une clé du Keystore Android (la clé ne quitte jamais la puce). Le code ne sort JAMAIS du téléphone. */
class Vault {
    private static final String ALIAS = "muse_pin";

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return g.generateKey();
    }

    static boolean has(Context c) { return !Store.p(c).getString("pinEnc", "").isEmpty(); }

    static void set(Context c, String pin) throws Exception {
        if (pin == null || !pin.matches("\\d{4,10}")) throw new Exception("Le code doit contenir 4 à 10 chiffres.");
        Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
        ci.init(Cipher.ENCRYPT_MODE, key());
        byte[] enc = ci.doFinal(pin.getBytes("UTF-8"));
        String v = Base64.encodeToString(ci.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(enc, Base64.NO_WRAP);
        Store.p(c).edit().putString("pinEnc", v).apply();
    }

    static void clear(Context c) { Store.p(c).edit().remove("pinEnc").apply(); }

    /** Renvoie le code en clair, uniquement en mémoire, le temps d'un déverrouillage. */
    static String get(Context c) throws Exception {
        String v = Store.p(c).getString("pinEnc", "");
        if (v.isEmpty()) return null;
        String[] p = v.split(":");
        Cipher ci = Cipher.getInstance("AES/GCM/NoPadding");
        ci.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
        return new String(ci.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), "UTF-8");
    }
}
