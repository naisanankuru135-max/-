package jp.poicho.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

  @PluginMethod
  public void canRequestPackageInstalls(PluginCall call) {
    boolean allowed = true;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      allowed = getContext().getPackageManager().canRequestPackageInstalls();
    }
    JSObject ret = new JSObject();
    ret.put("allowed", allowed);
    call.resolve(ret);
  }

  @PluginMethod
  public void openInstallPermissionSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Intent intent = new Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + getContext().getPackageName())
      );
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void downloadAndInstall(PluginCall call) {
    String urlString = call.getString("url");
    if (urlString == null || urlString.trim().isEmpty()) {
      call.reject("APKのURLが指定されていません。");
      return;
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent permIntent = new Intent(
        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
        Uri.parse("package:" + getContext().getPackageName())
      );
      permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(permIntent);
      JSObject ret = new JSObject();
      ret.put("needsPermission", true);
      call.resolve(ret);
      return;
    }

    new Thread(() -> {
      HttpURLConnection conn = null;
      try {
        URL currentUrl = new URL(urlString);
        for (int redirectCount = 0; redirectCount < 6; redirectCount++) {
          conn = (HttpURLConnection) currentUrl.openConnection();
          conn.setInstanceFollowRedirects(false);
          conn.setConnectTimeout(15000);
          conn.setReadTimeout(60000);
          conn.setRequestProperty("User-Agent", "PoichoAndroidUpdater/1.0");
          int code = conn.getResponseCode();
          if (code >= 300 && code < 400) {
            String location = conn.getHeaderField("Location");
            conn.disconnect();
            if (location == null || location.isEmpty()) {
              throw new IllegalStateException("リダイレクト先が空です。");
            }
            currentUrl = new URL(currentUrl, location);
            continue;
          }
          if (code < 200 || code >= 300) {
            throw new IllegalStateException("ダウンロードに失敗しました (HTTP " + code + ")");
          }
          break;
        }

        File updateDir = new File(getContext().getCacheDir(), "updates");
        if (!updateDir.exists()) {
          updateDir.mkdirs();
        }
        File apkFile = new File(updateDir, "poicho-update.apk");

        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(apkFile)) {
          byte[] buffer = new byte[16384];
          int read;
          while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
          }
          out.flush();
        }

        Uri apkUri = FileProvider.getUriForFile(
          getContext(),
          getContext().getPackageName() + ".fileprovider",
          apkFile
        );

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(installIntent);

        JSObject ret = new JSObject();
        ret.put("needsPermission", false);
        ret.put("started", true);
        call.resolve(ret);
      } catch (Exception e) {
        call.reject("APKのダウンロード・起動に失敗しました: " + e.getMessage(), e);
      } finally {
        if (conn != null) {
          conn.disconnect();
        }
      }
    }).start();
  }
}
