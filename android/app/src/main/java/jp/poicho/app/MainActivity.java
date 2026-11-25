package jp.poicho.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Switch from launch theme before AppCompat/Bridge initialization so no launch
    // attributes leak into WebView dialogs or text-selection toolbars.
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
    setTheme(R.style.AppTheme_NoActionBar);
    registerPlugin(ApkUpdaterPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  protected void load() {
    // Capacitor's BridgeActivity sets com.getcapacitor.android.R.style.AppTheme_NoActionBar
    // (which has a dark Theme.AppCompat.NoActionBar parent under non-transitive R classes).
    // Re-apply our app's Light theme right before Bridge constructs the WebView.
    getApplication().setTheme(R.style.AppTheme_NoActionBar);
    setTheme(R.style.AppTheme_NoActionBar);
    super.load();
    configureWebViewLightMode();
  }

  @SuppressWarnings("deprecation")
  private void configureWebViewLightMode() {
    if (this.bridge == null) return;
    WebView webView = this.bridge.getWebView();
    if (webView == null) return;
    WebSettings settings = webView.getSettings();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      settings.setAlgorithmicDarkeningAllowed(false);
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      settings.setForceDark(WebSettings.FORCE_DARK_OFF);
    }
  }
}
