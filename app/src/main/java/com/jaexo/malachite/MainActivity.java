package com.jaexo.malachite;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

public class MainActivity extends Activity {
    WebView webView;
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        
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
        }, "AndroidBridge");

        webView.loadUrl("file:///android_asset/jaexo-malachite.html");

        // Request notification listener permission to read Spotify/etc
        String listeners = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (listeners == null || !listeners.contains(getPackageName())) {
            startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        }

        registerReceiver(new BroadcastReceiver() {
            @Override public void onReceive(Context context, Intent intent) {
                String t = intent.getStringExtra("title");
                String a = intent.getStringExtra("artist");
                String act = intent.getStringExtra("active");
                webView.post(() -> webView.evaluateJavascript("window.updateNativeMedia('"+t+"', '"+a+"', '"+act+"');", null));
            }
        }, new IntentFilter("MEDIA_UPDATE"));
    }
}