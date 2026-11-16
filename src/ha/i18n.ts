import en from '../translations/en.json';
import type { HomeAssistant } from './types';

export type TKey = keyof typeof en;

const LANGUAGES: Partial<Record<string, Partial<Record<TKey, string>>>> = { en };

/** String for `hass.locale.language`, falling back to English. */
export function localize(hass: HomeAssistant | undefined, key: TKey): string {
  const lang = hass?.locale?.language ?? 'en';
  return LANGUAGES[lang]?.[key] ?? LANGUAGES[lang.split('-')[0] ?? '']?.[key] ?? en[key];
}
