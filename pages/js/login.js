import { setLanguage } from '../../i18n.js';

export function initLogin({ supabase, onLogin }) {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const errorBox = document.getElementById('loginError');
  const submitBtn = document.getElementById('loginSubmitBtn');

  if (!form || !emailInput || !passwordInput || !errorBox) return;

  form.onsubmit = async (e) => {
    e.preventDefault();

    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Jungiamasi...';

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    submitBtn.disabled = false;
    submitBtn.textContent = 'Prisijungti';

    if (error || !data.user) {
      errorBox.textContent = 'Neteisingas el. paštas arba slaptažodis.';
      errorBox.classList.remove('hidden');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('lang')
      .eq('id', data.user.id)
      .single();

    await setLanguage(profile?.lang || 'lt');

    await onLogin();
  };
}