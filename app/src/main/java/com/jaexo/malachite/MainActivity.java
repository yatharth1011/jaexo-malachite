package com.jaexo.malachite;
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
                    if (!f.exists()) return "{}";
                    byte[] bytes = new byte[(int) f.length()];
                    FileInputStream in = new FileInputStream(f);
                    in.read(bytes);
                    in.close();
                    return new String(bytes, "UTF-8");
                } catch (Exception e) { return "{}"; }
            }

            @JavascriptInterface
            public void writeFile(String path, String data) {
                try {
                    if(path.startsWith("/storage/emulated/0/")) {
                        path = path.replace("/storage/emulated/0/", Environment.getExternalStorageDirectory().getAbsolutePath() + "/");
                    }
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
                        "window.updateNativeMedia('"+t.replace("'","\\'")+"', '"+a.replace("'","\\'")+"', '"+act+"');", null));
                }
            }
        }, new IntentFilter("MEDIA_UPDATE"));
    }

    // === NEW: LIFECYCLE DEEP FREEZE LOGIC ===
    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers(); // Completely freezes all JavaScript intervals
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers(); // Wakes up JS logic
            webView.onResume();
        }
    }
    
    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.destroy();
        }
    }
}