package com.jaexo.malachite;
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
}