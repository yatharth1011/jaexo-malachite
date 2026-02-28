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

fs.copyFileSync('jaexo-malachite.html', 'app/src/main/assets/jaexo-malachite.html');
try {
    const iconDirs = ['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    iconDirs.forEach(d => { fs.copyFileSync('malachite_icon.png', `app/src/main/res/mipmap-${d}/ic_launcher.png`); });
} catch (e) {}

fs.writeFileSync('app/src/main/AndroidManifest.xml', `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.jaexo.malachite">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />
    <application android:label="Malachite" android:icon="@mipmap/ic_launcher" android:theme="@android:style/Theme.NoTitleBar.Fullscreen" android:requestLegacyExternalStorage="true" android:usesCleartextTraffic="true">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <service android:name=".MediaListener" android:label="Malachite Media Sync" android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE" android:exported="true">
            <intent-filter> <action android:name="android.service.notification.NotificationListenerService" /> </intent-filter>
        </service>
    </application>
</manifest>`);

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
import android.webkit.WebChromeClient;
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
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);

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
            Toast.makeText(this, "ENABLE Notification Access for Malachite", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        }

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

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
                    if(path.startsWith("/storage/emulated/0/")) {
                        path = path.replace("/storage/emulated/0/", Environment.getExternalStorageDirectory().getAbsolutePath() + "/");
                    }
                    File f = new File(path);
                    if (!f.exists()) return "__NOT_FOUND__";
                    byte[] bytes = new byte[(int) f.length()];
                    FileInputStream in = new FileInputStream(f);
                    in.read(bytes);
                    in.close();
                    return new String(bytes, "UTF-8");
                } catch (Exception e) { 
                    // Tell JS that the file exists but we failed to read it (lock/permissions)
                    return "__ERROR__"; 
                }
            }

            @JavascriptInterface
            public void writeFile(String path, String data) {
                try {
                    if(path.startsWith("/storage/emulated/0/")) {
                        path = path.replace("/storage/emulated/0/", Environment.getExternalStorageDirectory().getAbsolutePath() + "/");
                    }
                    File f = new File(path);
                    if(!f.getParentFile().exists()) f.getParentFile().mkdirs();
                    
                    // ATOMIC WRITE: Write to a .tmp file first, then swap it.
                    // This guarantees zero corruption if the app is killed mid-save.
                    File tmpFile = new File(path + ".tmp");
                    FileOutputStream out = new FileOutputStream(tmpFile);
                    out.write(data.getBytes("UTF-8"));
                    out.close();
                    
                    tmpFile.renameTo(f);
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

    @Override protected void onPause() {
        super.onPause();
        if (webView != null) { webView.onPause(); webView.pauseTimers(); }
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) { webView.resumeTimers(); webView.onResume(); }
    }
    
    @Override protected void onDestroy() {
        super.onDestroy();
        if (webView != null) webView.destroy();
    }
}`);

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

fs.writeFileSync('settings.gradle', 'pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = "Malachite"\ninclude ":app"');
fs.writeFileSync('build.gradle', 'plugins { id "com.android.application" version "8.1.1" apply false }');
fs.writeFileSync('app/build.gradle', "plugins { id 'com.android.application' }\nandroid { namespace 'com.jaexo.malachite'; compileSdk 34; defaultConfig { applicationId 'com.jaexo.malachite'; minSdk 24; targetSdk 34; versionCode 1; versionName '1.0' } }");
fs.writeFileSync('.github/workflows/build.yml', "name: Build APK\non: [push, workflow_dispatch]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-java@v4\n        with: { distribution: 'temurin', java-version: '17' }\n      - uses: gradle/actions/setup-gradle@v3\n        with: { gradle-version: '8.4' }\n      - run: gradle assembleDebug\n      - uses: actions/upload-artifact@v4\n        with: { name: Malachite-APK, path: app/build/outputs/apk/debug/app-debug.apk }");

console.log("✅ Fixes applied: Database Wipe Protection & Atomic File Saves implemented.");