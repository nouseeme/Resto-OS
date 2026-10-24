export const DEFAULT_MENU_LANGUAGE = 'id';
export function languageCode(value) {
  if (typeof value !== 'string' || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value)) return null;
  try { return Intl.getCanonicalLocales(value)[0]; } catch { return null; }
}
export function menuLanguages(menu) {
  return [DEFAULT_MENU_LANGUAGE, ...[...new Set(menu.flatMap(item => Object.entries(item.descriptionTranslations ?? {}).filter(([code, text]) => languageCode(code) && typeof text === 'string' && text.trim()).map(([code]) => code)))].filter(code => code !== DEFAULT_MENU_LANGUAGE).sort()];
}
export function menuDescription(item, language = DEFAULT_MENU_LANGUAGE) {
  const translated = item.descriptionTranslations?.[language];
  return language !== DEFAULT_MENU_LANGUAGE && typeof translated === 'string' && translated.trim() ? translated : item.description ?? '';
}
