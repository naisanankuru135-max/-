import { Capacitor, registerPlugin } from '@capacitor/core';

interface ApkUpdaterPlugin {
  canRequestPackageInstalls(): Promise<{ allowed: boolean }>;
  openInstallPermissionSettings(): Promise<void>;
  downloadAndInstall(options: {
    url: string;
  }): Promise<{ needsPermission?: boolean; started?: boolean }>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export const CURRENT_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0';
export const CURRENT_APP_VERSION_CODE =
  typeof __APP_VERSION_CODE__ !== 'undefined' ? __APP_VERSION_CODE__ : 2;

export const DEFAULT_GITHUB_REPO = 'naisanankuru135-max/-';
export const UPDATE_URL_STORAGE_KEY = 'poicho_update_feed_url_v1';
export const UPDATE_LAST_CHECK_KEY = 'poicho_update_last_check_v1';

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  latestVersionCode?: number;
  hasUpdate: boolean;
  apkUrl: string;
  htmlUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export function getSavedUpdateFeedUrl(): string {
  try {
    return localStorage.getItem(UPDATE_URL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveUpdateFeedUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(UPDATE_URL_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(UPDATE_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

export function compareVersions(a: string, b: string): number {
  const clean = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = clean(a);
  const pb = clean(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForAppUpdate(customFeedUrl?: string): Promise<AppUpdateInfo> {
  const feedUrl = (customFeedUrl ?? getSavedUpdateFeedUrl()).trim();

  // Custom JSON manifest mode (e.g. version.json)
  if (feedUrl) {
    const res = await fetch(feedUrl, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`アップデート情報の取得に失敗しました (HTTP ${res.status})`);
    }
    const json = (await res.json()) as {
      version?: string;
      versionCode?: number;
      apkUrl?: string;
      downloadUrl?: string;
      htmlUrl?: string;
      releaseNotes?: string;
      publishedAt?: string;
    };
    const latestVersion = (json.version || '').replace(/^v/i, '') || CURRENT_APP_VERSION;
    const latestCode = typeof json.versionCode === 'number' ? json.versionCode : undefined;
    const hasUpdate =
      compareVersions(latestVersion, CURRENT_APP_VERSION) > 0 ||
      (latestCode !== undefined && latestCode > CURRENT_APP_VERSION_CODE);
    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion,
      latestVersionCode: latestCode,
      hasUpdate,
      apkUrl: json.apkUrl || json.downloadUrl || '',
      htmlUrl: json.htmlUrl || feedUrl,
      releaseNotes: json.releaseNotes || '',
      publishedAt: json.publishedAt || '',
    };
  }

  // Default: GitHub Releases latest API
  const ghUrl = `https://api.github.com/repos/${DEFAULT_GITHUB_REPO}/releases/latest`;
  const res = await fetch(ghUrl, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (res.status === 404) {
    return {
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      hasUpdate: false,
      apkUrl: '',
      htmlUrl: `https://github.com/${DEFAULT_GITHUB_REPO}/releases`,
      releaseNotes: 'GitHub Releases にまだリリースが公開されていません。',
      publishedAt: '',
    };
  }
  if (!res.ok) {
    throw new Error(`GitHub Releases の確認に失敗しました (HTTP ${res.status})`);
  }

  const rel = (await res.json()) as {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    published_at?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };

  const latestVersion = (rel.tag_name || rel.name || CURRENT_APP_VERSION).replace(/^v/i, '');
  const apkAsset =
    rel.assets?.find((a) => a.name?.toLowerCase().endsWith('.apk')) ||
    rel.assets?.[0];
  const hasUpdate = compareVersions(latestVersion, CURRENT_APP_VERSION) > 0;

  return {
    currentVersion: CURRENT_APP_VERSION,
    latestVersion,
    hasUpdate,
    apkUrl: apkAsset?.browser_download_url || rel.html_url || '',
    htmlUrl: rel.html_url || `https://github.com/${DEFAULT_GITHUB_REPO}/releases`,
    releaseNotes: rel.body || '',
    publishedAt: rel.published_at || '',
  };
}

export async function installAppUpdate(
  apkUrl: string,
  fallbackUrl?: string
): Promise<{ status: 'installing' | 'needs_permission' | 'opened_browser' }> {
  if (!apkUrl) {
    if (fallbackUrl) {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return { status: 'opened_browser' };
    }
    throw new Error('APK のダウンロードURLが見つかりません。');
  }

  if (Capacitor.isNativePlatform()) {
    const res = await ApkUpdater.downloadAndInstall({ url: apkUrl });
    if (res?.needsPermission) {
      return { status: 'needs_permission' };
    }
    return { status: 'installing' };
  }

  window.open(apkUrl, '_blank', 'noopener,noreferrer');
  return { status: 'opened_browser' };
}
