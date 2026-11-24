import { NativeModules } from 'react-native';

// RemoteConfigModule (android/.../config): Firebase Remote Config's parameters, fetched at most once an hour.
type Native = { fetchString(key: string): Promise<string | null> };
const native = NativeModules.RemoteConfig as Native | undefined;

/** The parameter's value fetched now (or the last one, offline); null — no Firebase in this build, or not set. */
export async function remoteString(key: string): Promise<string | null> {
  return native ? native.fetchString(key) : null;
}
