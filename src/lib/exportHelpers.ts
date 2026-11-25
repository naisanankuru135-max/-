import { DealReminder, PoikatsuApp, PointTransaction } from '../types/poikatsu';
import { REMINDER_KIND_LABELS, pointsToYen } from '../data/presets';

function escapeIcsText(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function nextDayIcsDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return formatIcsDate(dateStr);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function buildRemindersIcs(
  reminders: DealReminder[],
  appMap: Map<string, PoikatsuApp>
): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const events = reminders
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate))
    .map((r) => {
      const appName = appMap.get(r.appId)?.name || 'ポイ活';
      const kindLabel = REMINDER_KIND_LABELS[r.kind] || r.kind;
      const summary = `[${kindLabel}] ${r.title} (${appName})`;
      const descParts = [r.actionDetail];
      if (r.riskOrRewardText) descParts.push(`注意/特典: ${r.riskOrRewardText}`);
      const description = descParts.filter(Boolean).join('\n');
      const dtStart = formatIcsDate(r.dueDate);
      const dtEnd = nextDayIcsDate(r.dueDate);

      return [
        'BEGIN:VEVENT',
        `UID:${r.id}@poicho.app`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(description)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(summary)}`,
        'TRIGGER:-P1D',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Poicho//Poikatsu Reminder//JA',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const TX_TYPE_JA: Record<PointTransaction['type'], string> = {
  earned: '確定獲得',
  pending: '判定中',
  exchanged: '交換利用',
};

export function buildTransactionsCsv(
  transactions: PointTransaction[],
  apps: PoikatsuApp[]
): string {
  const appMap = new Map(apps.map((a) => [a.id, a]));
  const header = ['日付', 'アプリ名', '種別', '案件・内容', 'ポイント', '単位', '円換算', '交換先', 'メモ'];
  const rows = transactions.map((tx) => {
    const app = appMap.get(tx.appId);
    const yen = pointsToYen(tx.points, app?.pointsPerYen ?? 1);
    return [
      tx.date,
      app?.name || tx.appId,
      TX_TYPE_JA[tx.type] || tx.type,
      tx.title,
      tx.points,
      app?.unit || 'P',
      yen,
      tx.exchangeTarget || '',
      tx.note || '',
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return `\uFEFF${[header.map(escapeCsvCell).join(','), ...rows].join('\r\n')}`;
}

export function triggerTextDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
