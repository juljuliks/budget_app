import { ingestSms } from '../ingest';
import { createNotificationChannel } from '../notifications/notifeeBootstrap';
import { showDepositNotification, showLimitAlert, showUncategorizedTransactionNotification } from '../notifications/notifeeIntegration';
import { scheduleMonthReports } from '../notifications/monthReportNotice';

export type SmsTaskData = {
  sender: string;
  body: string;
  timestamp: number;
  /** 'push' when it came from the bank app's notification (BankPushListener) */
  source?: 'sms' | 'push';
};

// Headless JS task started by SmsHeadlessService (android/.../sms). Registered in index.js.
export default async function SmsBackgroundTask(data: SmsTaskData): Promise<void> {
  try {
    const result = await ingestSms({ sender: data.sender, body: data.body, timestamp: data.timestamp, source: data.source });
    console.log('SmsBackgroundTask:', result.status, 'txId' in result ? result.txId : '');

    if (result.status === 'inserted' && result.kind === 'deposit') {
      // in "Пополнение счёта": said so, with the transfer categories to move it to (a person paying back)
      await createNotificationChannel();
      await showDepositNotification(result.txId);
    } else if (result.status === 'inserted' && result.categoryId === null) {
      // the app may never have been opened, so the channel might not exist yet
      await createNotificationChannel();
      await showUncategorizedTransactionNotification(result.txId);
    } else if (result.status === 'inserted') {
      // the merchant's category: maybe it is near its limit now
      await createNotificationChannel();
      await showLimitAlert(result.categoryId);
    }
    // the month's report on the 1st, with what is put aside after this operation
    if (result.status === 'inserted') await scheduleMonthReports();
  } catch (e) {
    // Log instead of rethrowing: a failed task must not crash the headless JS context.
    console.error('SmsBackgroundTask failed', e);
  }
}
