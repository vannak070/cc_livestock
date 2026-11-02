/**
 * Server messages people meet on any page (sign-in and access checks), in the language they chose. The browser keeps
 * the choice in localStorage and copies it into the LANG_COOKIE cookie (LanguageContext) so server actions can answer
 * in it (runAction). Messages not listed here are returned as they are. Khmer drafted by Claude.
 */
export const LANG_COOKIE = 'cc_lang';

const KM: Record<string, string> = {
  'You can only work with records from your own farm.': 'អ្នកអាចធ្វើការបានតែជាមួយកំណត់ត្រារបស់កសិដ្ឋានអ្នកប៉ុណ្ណោះ។',
  'You do not have permission to perform this action.': 'អ្នកមិនមានសិទ្ធិធ្វើសកម្មភាពនេះទេ។',
  'Your session has expired. Please sign in again.': 'ការចូលប្រើរបស់អ្នកបានផុតកំណត់។ សូមចូលម្តងទៀត។',
};

/** The message in the chosen language; Khmer is the app's default when no choice was sent. */
export function localizeServerMessage(message: string, lang: string | undefined): string {
  if (lang === 'en') return message;
  return KM[message] ?? message;
}
