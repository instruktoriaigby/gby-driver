let LANG = localStorage.getItem('lang') || 'lt';
let dict = {};

export async function initI18n() {
  await loadLang(LANG);
  initSwitcher();
  applyTranslations();
  document.documentElement.lang = LANG;
}

async function loadLang(lang) {
  try {
    const res = await fetch(`./locales/${lang}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Lang file not found');
    dict = await res.json();
  } catch (e) {
    console.error('Kalbos klaida:', e);
    dict = {};
  }
}

export async function setLanguage(lang) {
  LANG = lang || 'lt';
  localStorage.setItem('lang', LANG);
  document.documentElement.lang = LANG;

  await loadLang(LANG);

  const switcher = document.getElementById('langSwitcher');
  if (switcher) switcher.value = LANG;

  applyTranslations();
}

export function t(path) {
  return path.split('.').reduce((o, i) => o?.[i], dict) || path;
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const value = t(key);
    if (value !== key) el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const value = t(key);
    if (value !== key) el.placeholder = value;
  });
}

function initSwitcher() {
  const switcher = document.getElementById('langSwitcher');
  if (!switcher) return;

  switcher.value = LANG;

  switcher.onchange = async (e) => {
    await setLanguage(e.target.value);
    window.dispatchEvent(new Event('languageChanged'));
  };
}