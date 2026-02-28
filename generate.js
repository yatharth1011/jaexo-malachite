const fs = require('fs');
const path = require('path');

const dirs = [
    'app/src/main/java/com/jaexo/malachite',
    'app/src/main/res/values',
    'app/src/main/assets',
    'app/src/main/res/mipmap-hdpi',
    'app/src/main/res/mipmap-mdpi',
    'app/src/main/res/mipmap-xhdpi',
    'app/src/main/res/mipmap-xxhdpi',
    'app/src/main/res/mipmap-xxxhdpi',
    '.github/workflows'
];

dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

// 1. Copy Assets & Icon
fs.copyFileSync('jaexo-malachite.html', 'app/src/main/assets/jaexo-malachite.html');
try {
    const iconDirs = ['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    iconDirs.forEach(d => {
        fs.copyFileSync('malachite_icon.png', `app/src/main/res/mipmap-${d}/ic_launcher.png`);
    });
    console.log("✅ Custom icon successfully applied!");
} catch (e) {
    console.log("⚠️  'malachite_icon.png' not found. App will build with default Android icon.");
}

// 2. Android Manifest (Added Storage + Query Permissions)
fs.writeFileSync('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.jaexo.malachite">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    
    <application android:label="Malachite" android:icon="@mipmap/ic_launcher" android:theme="@android:style/Theme.NoTitleBar.Fullscreen">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".MediaListener" android:label="Malachite Media Sync" android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
    </application>
</manifest>`);

// 3. MainActivity (Added Storage Prompts + Native File Read/Write API)
fs.writeFileSync('app/src/main/java/com/jaexo/malachite/MainActivity.java', `package com.jaexo.malachite;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

public class MainActivity extends Activity {
    WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        // Permissions Request Logic
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.addCategory("android.intent.category.DEFAULT");
                    intent.setData(Uri.parse(String.format("package:%s", getPackageName())));
                    startActivity(intent);
                } catch (Exception e) {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                    startActivity(intent);
                }
            }
        } else {
            requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1);
        }

        String listeners = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (listeners == null || !listeners.contains(getPackageName())) {
            Toast.makeText(this, "Please ENABLE Notification Access for Malachite to read Music", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        }

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void sendMediaCommand(String action) {
                Intent i = new Intent("MEDIA_COMMAND");
                i.putExtra("action", action);
                sendBroadcast(i);
            }

            @JavascriptInterface
            public String readFile(String path) {
                try {
                    File f = new File(path);
                    if (!f.exists()) return "";
                    byte[] bytes = new byte[(int) f.length()];
                    FileInputStream in = new FileInputStream(f);
                    in.read(bytes);
                    in.close();
                    return new String(bytes, "UTF-8");
                } catch (Exception e) { return ""; }
            }

            @JavascriptInterface
            public void writeFile(String path, String data) {
                try {
                    File f = new File(path);
                    if(!f.getParentFile().exists()) f.getParentFile().mkdirs();
                    FileOutputStream out = new FileOutputStream(f);
                    out.write(data.getBytes("UTF-8"));
                    out.close();
                } catch (Exception e) { e.printStackTrace(); }
            }
        }, "AndroidBridge");

        webView.loadUrl("file:///android_asset/jaexo-malachite.html");

        registerReceiver(new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String t = intent.getStringExtra("title");
                String a = intent.getStringExtra("artist");
                String act = intent.getStringExtra("active");
                if(t != null) {
                    webView.post(() -> webView.evaluateJavascript(
                        "window.updateNativeMedia('"+t.replace("'","\\\\'")+"', '"+a.replace("'","\\\\'")+"', '"+act+"');", null));
                }
            }
        }, new IntentFilter("MEDIA_UPDATE"));
    }
}`);

// 4. MediaListener (No changes, logic is identical)
fs.writeFileSync('app/src/main/java/com/jaexo/malachite/MediaListener.java', `package com.jaexo.malachite;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.service.notification.NotificationListenerService;
import android.view.KeyEvent;
import java.util.List;

public class MediaListener extends NotificationListenerService {
    private MediaController activeController;

    @Override public void onCreate() {
        super.onCreate();
        registerReceiver(new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String action = intent.getStringExtra("action");
                if (activeController != null && action != null) {
                    int code = action.equals("playpause") ? KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE :
                               action.equals("next") ? KeyEvent.KEYCODE_MEDIA_NEXT : KeyEvent.KEYCODE_MEDIA_PREVIOUS;
                    activeController.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
                    activeController.dispatchMediaButtonEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
                }
            }
        }, new IntentFilter("MEDIA_COMMAND"));
    }

    @Override public void onListenerConnected() { update(); }
    @Override public void onNotificationPosted(android.service.notification.StatusBarNotification s) { update(); }
    @Override public void onNotificationRemoved(android.service.notification.StatusBarNotification s) { update(); }

    private void update() {
        try {
            MediaSessionManager m = (MediaSessionManager) getSystemService(Context.MEDIA_SESSION_SERVICE);
            List<MediaController> controllers = m.getActiveSessions(new ComponentName(this, MediaListener.class));
            if (controllers != null && !controllers.isEmpty()) {
                activeController = controllers.get(0);
                MediaMetadata meta = activeController.getMetadata();
                if (meta != null) {
                    boolean playing = activeController.getPlaybackState() != null && activeController.getPlaybackState().getState() == PlaybackState.STATE_PLAYING;
                    Intent i = new Intent("MEDIA_UPDATE");
                    i.putExtra("title", meta.getString(MediaMetadata.METADATA_KEY_TITLE));
                    i.putExtra("artist", meta.getString(MediaMetadata.METADATA_KEY_ARTIST));
                    i.putExtra("active", playing ? "true" : "false");
                    sendBroadcast(i);
                }
            }
        } catch (Exception e) {}
    }
}`);

// 5. Build Configs
fs.writeFileSync('settings.gradle', 'pluginManagement {\n  repositories {\n    google()\n    mavenCentral()\n    gradlePluginPortal()\n  }\n}\ndependencyResolutionManagement {\n  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n  repositories {\n    google()\n    mavenCentral()\n  }\n}\nrootProject.name = "Malachite"\ninclude ":app"');
fs.writeFileSync('build.gradle', 'plugins { id "com.android.application" version "8.1.1" apply false }');
fs.writeFileSync('app/build.gradle', `plugins { id 'com.android.application' }
android {
    namespace 'com.jaexo.malachite'
    compileSdk 34
    defaultConfig { applicationId "com.jaexo.malachite"; minSdk 24; targetSdk 34; versionCode 1; versionName "1.0" }
}`);

// 6. GitHub Action Configuration (v4 compliant)
fs.writeFileSync('.github/workflows/build.yml', `name: Build APK
on: [push, workflow_dispatch]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: 'temurin', java-version: '17' }
      - uses: gradle/actions/setup-gradle@v3
        with: { gradle-version: '8.4' }
      - run: gradle assembleDebug
      - uses: actions/upload-artifact@v4
        with: { name: Malachite-APK, path: app/build/outputs/apk/debug/app-debug.apk }`);

console.log("✅ Android project successfully regenerated with Storage Sync and Custom Icon!");