// Crash reports (Firebase Crashlytics, android/.../crash/CrashReportModule.kt): a fatal JS error and every console.error
// sent as the logged text and the Error's message and stack — never the objects logged with them (an operation, an
// SMS): no amounts or merchants leave the phone. Only a release build with Firebase reports (the native side decides);
// in the tests and a debug build the module is missing — nothing.
import { NativeModules } from 'react-native';
import { reportOf } from './crashText';

type Native = { recordError(message: string, stack: string, fatal: boolean): void };
const native = NativeModules.CrashReport as Native | undefined;

function record(args: unknown[], fatal: boolean) {
  if (!native) return;
  try {
    const { message, stack } = reportOf(args);
    native.recordError(message, stack, fatal);
  } catch {
    // reporting never breaks the app
  }
}

type ErrorUtilsT = { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void };

/** Once, first thing in index.js (the app and the headless SMS task alike). */
export function installCrashReporting() {
  if (!native) return;
  const errorUtils = (global as unknown as { ErrorUtils?: ErrorUtilsT }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((e, fatal) => {
      record([e instanceof Error ? e : String(e)], !!fatal);
      previous(e, fatal);
    });
  }
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    record(args, false);
    original(...args);
  };
}
