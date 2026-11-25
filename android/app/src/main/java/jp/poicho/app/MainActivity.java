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
    // Keep the app and its native dialogs/selection toolbars consistently in Light mode
    // so OS Dark Mode or ColorOS ForceDark cannot produce white-on-white popups.
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
    registerPlugin(ApkUpdaterPlugin.class);
    super.onCreate(savedInstanceState);
  }

  @Override
  protected void load() {
    // Capacitor's BridgeActivity calls setTheme(com.getcapacitor.android.R.style.AppTheme_NoActionBar),
    // which resolves to Capacitor's dark Theme.AppCompat.NoActionBar under non-transitive R classes.
    // Re-apply our app's Light theme right before Bridge creates the WebView.
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
