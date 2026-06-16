import { initDefektas } from './pages/js/defektas.js';
import { initInstrukcijos } from './pages/js/instrukcijos.js';
import { initNustatymai } from './pages/js/nustatymai.js';
import { initUzduotys } from './pages/js/uzduotys.js';
import { initLogin } from './pages/js/login.js';
import { initI18n, applyTranslations, t } from './i18n.js';

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();

  const supabase = window.supabase.createClient(
    'https://mpinqqikfmzwionkynxh.supabase.co',
    'sb_publishable_hOk6XBQHl7CmkrEfFXxcHw_bliYYuIl'
  );

  window.appSupabase = supabase;

  const content = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  const logoutBtn = document.getElementById('logoutBtn');

  let currentPage = 'dashboard';
  let currentUser = null;
  let currentProfile = null;
  let isLoadingPage = false;
  let pendingPage = null;
  let blockedUserMessageShown = false;

  function getBlockedMessage(profile = currentProfile) {
    const lang =
      profile?.lang ||
      localStorage.getItem('lang') ||
      document.getElementById('langSwitcher')?.value ||
      'lt';

    const messages = {
      lt: {
        title: 'Paskyra išjungta',
        text: 'Jūsų paskyra išjungta. Kreipkitės į administratorių.',
        button: 'Gerai'
      },
      en: {
        title: 'Account disabled',
        text: 'Your account has been disabled. Please contact the administrator.',
        button: 'OK'
      },
      ru: {
        title: 'Аккаунт отключён',
        text: 'Ваша учётная запись отключена. Обратитесь к администратору.',
        button: 'OK'
      }
    };

    return messages[lang] || messages.lt;
  }

  function showSystemModal({ title, text, button }) {
    document.getElementById('systemModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'systemModal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-white">
        <div class="flex items-start gap-4">
          <div class="text-3xl text-red-400">⚠️</div>

          <div class="flex-1">
            <h3 class="text-xl font-semibold mb-2">${title}</h3>
            <p class="text-slate-300 leading-relaxed">${text}</p>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            id="systemModalClose"
            class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl font-semibold"
          >
            ${button}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('systemModalClose')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  async function forceLogoutBlockedUser(profileBeforeLogout = currentProfile) {
    const message = getBlockedMessage(profileBeforeLogout);

    await supabase.auth.signOut();

    currentUser = null;
    currentProfile = null;
    pendingPage = null;

    updateShellByAuth();
    applyRoleVisibility();

    if (content) {
      content.innerHTML = '';
    }

    if (!blockedUserMessageShown) {
      blockedUserMessageShown = true;

      showSystemModal({
        title: message.title,
        text: message.text,
        button: message.button
      });
    }
  }

  async function loadSession() {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('Session error:', sessionError);
      currentUser = null;
      currentProfile = null;
      return;
    }

    currentUser = session?.user || null;

    if (!currentUser) {
      currentProfile = null;
      return;
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.error('Profile load error:', error);
      currentUser = null;
      currentProfile = null;
      await supabase.auth.signOut();
      return;
    }

    currentProfile = profile;

    if (currentProfile?.is_active === false) {
      await forceLogoutBlockedUser(currentProfile);
      return;
    }
  }

  function getRole() {
    return currentProfile?.role || null;
  }

  function updateShellByAuth() {
    const isLoggedIn = Boolean(currentUser);

    if (sidebar) {
      sidebar.classList.toggle('hidden', !isLoggedIn);
    }

    if (logoutBtn) {
      logoutBtn.classList.toggle('hidden', !isLoggedIn);
    }
  }

  function applyRoleVisibility() {
  const role = currentProfile?.role || null;

  const settingsButtons = document.querySelectorAll('[data-page="nustatymai"]');

  settingsButtons.forEach(button => {
    if (role === 'driver' || !role) {
      button.classList.add('hidden');
      button.style.display = 'none';
    } else {
      button.classList.remove('hidden');
      button.style.display = '';
    }
  });

  if ((role === 'driver' || !role) && currentPage === 'nustatymai') {
    loadPage('dashboard');
  }
}

  function setActiveNav(page) {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.classList.remove('bg-blue-600');
      btn.classList.add('hover:bg-slate-800');
    });

    const activeBtn = document.querySelector(`[data-page="${page}"]`);

    if (activeBtn) {
      activeBtn.classList.add('bg-blue-600');
      activeBtn.classList.remove('hover:bg-slate-800');
    }
  }

  function getDashboardImageUrl(img) {
    if (img?.image_url) return img.image_url;

    if (img?.file_path) {
      const { data } = supabase
        .storage
        .from('dashboard-images')
        .getPublicUrl(img.file_path);

      return data?.publicUrl || '';
    }

    return '';
  }

  async function renderDashboardImages() {
    const container = document.getElementById('dashboardImages');

    if (!container) return;

    container.innerHTML = `<div class="text-slate-400">${t('common.loading') || 'Kraunama...'}</div>`;

    const { data, error } = await supabase
      .from('dashboard_images')
      .select('id, image_url, file_path, title, sort_order, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Dashboard images load error:', error);
      container.innerHTML = `<div class="text-red-400">Nepavyko užkrauti pagrindinio puslapio informacijos.</div>`;
      return;
    }

    const images = data || [];

    if (!images.length) {
      container.innerHTML = `<div class="text-slate-400">${t('dashboard.no_info') || 'Informacijos nėra.'}</div>`;
      return;
    }

    container.innerHTML = images.map(img => {
      const imageUrl = getDashboardImageUrl(img);

      if (!imageUrl) return '';

      return `
        <div class="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
          <img
            src="${imageUrl}"
            alt=""
            class="w-full h-auto block select-none pointer-events-none"
            draggable="false"
          >
        </div>
      `;
    }).join('');
  }

  async function initPage(page) {
    switch (page) {
      case 'dashboard':
        await renderDashboardImages();
        break;

      case 'defektas':
        await initDefektas({
          supabase,
          user: currentUser,
          profile: currentProfile
        });
        break;

      case 'instrukcijos':
        await initInstrukcijos({
          supabase,
          user: currentUser,
          profile: currentProfile
        });
        break;

      case 'nustatymai':
        await initNustatymai({
          supabase,
          user: currentUser,
          profile: currentProfile
        });
        break;

      case 'uzduotys':
        await initUzduotys({
          supabase,
          user: currentUser,
          profile: currentProfile
        });
        break;

      case 'login':
        initLogin({
          supabase,
          onLogin: async () => {
            blockedUserMessageShown = false;

            await loadSession();

            updateShellByAuth();
            applyRoleVisibility();

            if (!currentUser || !currentProfile) {
              await loadPage('login');
              return;
            }

            setTimeout(() => {
              loadPage('dashboard');
            }, 0);
          }
        });
        break;

      default:
        console.warn('Nežinomas puslapis:', page);
        break;
    }
  }

  async function loadPage(page) {
    if (isLoadingPage) {
      pendingPage = page;
      return;
    }

    isLoadingPage = true;

    try {
      if (currentUser) {
        await loadSession();
      }

      if (!currentUser && page !== 'login') {
        page = 'login';
      }

      if (currentUser && currentProfile?.is_active === false) {
        await forceLogoutBlockedUser(currentProfile);
        page = 'login';
      }

      if (currentUser && getRole() === 'driver' && page === 'nustatymai') {
        page = 'dashboard';
      }

      currentPage = page;
      setActiveNav(page);

      if (content) {
        content.innerHTML = `<div class="text-slate-400">Kraunama...</div>`;
      }

      const res = await fetch(`pages/${page}.html`, { cache: 'no-store' });

      if (!res.ok) {
        content.innerHTML = `<div class="text-red-400">Page not found: ${page}</div>`;
        return;
      }

      const html = await res.text();
      content.innerHTML = html;

      await initPage(page);

      applyTranslations();
      updateShellByAuth();
      applyRoleVisibility();

    } catch (err) {
      console.error('loadPage error:', err);

      if (content) {
        content.innerHTML = `
          <div class="text-red-400">
            Klaida kraunant puslapį. Patikrink Console.
          </div>
        `;
      }
    } finally {
      isLoadingPage = false;

      if (pendingPage) {
        const nextPage = pendingPage;
        pendingPage = null;

        if (nextPage !== currentPage) {
          await loadPage(nextPage);
        }
      }
    }
  }

  window.navigateTo = loadPage;

  document.addEventListener('click', async (e) => {
    const navBtn = e.target.closest('[data-page]');

    if (navBtn) {
      const page = navBtn.dataset.page;
      await loadPage(page);
      return;
    }

    const toggle = e.target.closest('#toggleSidebar');

    if (toggle && sidebar) {
      const labels = document.querySelectorAll('.label');
      const logoText = document.getElementById('logoText');

      const collapsed = sidebar.classList.contains('w-20');

      if (collapsed) {
        sidebar.classList.replace('w-20', 'w-64');
        labels.forEach(label => label.classList.remove('hidden'));
        logoText?.classList.remove('hidden');
      } else {
        sidebar.classList.replace('w-64', 'w-20');
        labels.forEach(label => label.classList.add('hidden'));
        logoText?.classList.add('hidden');
      }
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();

    currentUser = null;
    currentProfile = null;
    pendingPage = null;

    updateShellByAuth();
    applyRoleVisibility();

    await loadPage('login');
  });

  window.addEventListener('languageChanged', async () => {
    applyTranslations();
    await loadPage(currentPage);
  });

  await loadSession();

  updateShellByAuth();
  applyTranslations();

  await loadPage(currentUser ? 'dashboard' : 'login');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service worker užregistruotas');
    } catch (error) {
      console.warn('⚠️ Service worker nepavyko užregistruoti:', error);
    }
  });
}