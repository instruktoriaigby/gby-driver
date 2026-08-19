import { initDefektas } from './pages/js/defektas.js';
import { initInstrukcijos } from './pages/js/instrukcijos.js';
import { initNustatymai } from './pages/js/nustatymai.js';
import { initUzduotys } from './pages/js/uzduotys.js';
import { initVilkikoPriemimas } from './pages/js/vilkiko-priemimas.js';
import { initMasterDriver } from './pages/js/master-driver.js';
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

  const TRANSPORT_MODES = {
    CAR_TRANSPORTER: 'car_transporter',
    TRUCK: 'truck'
  };

  const CAR_TRANSPORTER_ROLES = [
    'driver',
    'master_driver',
    'instructor'
  ];

  const TRUCK_ROLES = [
    'truck_driver',
    'truck_master_driver',
    'truck_instructor'
  ];

  const ADMIN_ROLES = [
    'admin'
  ];

  const DRIVER_ROLES = [
    'driver',
    'truck_driver'
  ];

  const MODE_STORAGE_KEY = 'gby_admin_transport_mode';

  const PAGE_ACCESS = {
    dashboard: {
      car_transporter: ['admin', 'driver', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    defektas: {
      car_transporter: ['admin', 'driver', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    instrukcijos: {
      car_transporter: ['admin', 'driver', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    uzduotys: {
      car_transporter: ['admin', 'driver', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    'vilkiko-priemimas': {
      car_transporter: ['admin', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    'master-driver': {
      car_transporter: ['admin', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_driver', 'truck_master_driver', 'truck_instructor']
    },

    nustatymai: {
      car_transporter: ['admin', 'master_driver', 'instructor'],
      truck: ['admin', 'truck_master_driver', 'truck_instructor']
    },

    login: {
      car_transporter: [],
      truck: []
    }
  };

  function isAdminRole(role = getRole()) {
    return ADMIN_ROLES.includes(role);
  }

  function isTruckRole(role = getRole()) {
    return TRUCK_ROLES.includes(role);
  }

  function isCarTransporterRole(role = getRole()) {
    return CAR_TRANSPORTER_ROLES.includes(role);
  }

  function isDriverRole(role = getRole()) {
    return DRIVER_ROLES.includes(role);
  }

  function getStoredAdminMode() {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);

    if (stored === TRANSPORT_MODES.TRUCK) {
      return TRANSPORT_MODES.TRUCK;
    }

    return TRANSPORT_MODES.CAR_TRANSPORTER;
  }

  function setStoredAdminMode(mode) {
    const cleanMode = mode === TRANSPORT_MODES.TRUCK
      ? TRANSPORT_MODES.TRUCK
      : TRANSPORT_MODES.CAR_TRANSPORTER;

    localStorage.setItem(MODE_STORAGE_KEY, cleanMode);
  }

  function getEffectiveTransportMode() {
    const role = getRole();

    if (!role) {
      return TRANSPORT_MODES.CAR_TRANSPORTER;
    }

    if (isAdminRole(role)) {
      return getStoredAdminMode();
    }

    if (isTruckRole(role)) {
      return TRANSPORT_MODES.TRUCK;
    }

    if (isCarTransporterRole(role)) {
      return TRANSPORT_MODES.CAR_TRANSPORTER;
    }

    return currentProfile?.transport_mode || TRANSPORT_MODES.CAR_TRANSPORTER;
  }

  function getModeLabel(mode = getEffectiveTransportMode()) {
    const lang =
      localStorage.getItem('lang') ||
      currentProfile?.lang ||
      document.getElementById('langSwitcher')?.value ||
      'lt';

    const labels = {
      lt: {
        car_transporter: 'Autovežiai',
        truck: 'Vilkikai'
      },
      en: {
        car_transporter: 'Car transporters',
        truck: 'Trucks'
      },
      ru: {
        car_transporter: 'Автовозы',
        truck: 'Тягачи'
      }
    };

    return labels[lang]?.[mode] || labels.lt[mode] || mode;
  }

  function updateAdminModeSwitcherLabels() {
    const select = document.getElementById('adminTransportModeSwitcher');

    if (!select) return;

    const carOption = select.querySelector('option[value="car_transporter"]');
    const truckOption = select.querySelector('option[value="truck"]');

    if (carOption) {
      carOption.textContent = getModeLabel(TRANSPORT_MODES.CAR_TRANSPORTER);
    }

    if (truckOption) {
      truckOption.textContent = getModeLabel(TRANSPORT_MODES.TRUCK);
    }

    select.value = getEffectiveTransportMode();
  }

  function getProfileForModules() {
    if (!currentProfile) return null;

    const effectiveMode = getEffectiveTransportMode();

    return {
      ...currentProfile,

      transport_mode: effectiveMode,
      app_transport_mode: effectiveMode,
      effective_transport_mode: effectiveMode,

      db_transport_mode: currentProfile.transport_mode || null
    };
  }

  function isPageAllowed(page) {
    if (page === 'login') return true;

    const role = getRole();
    const mode = getEffectiveTransportMode();

    if (!role) return false;

    const config = PAGE_ACCESS[page];

    if (!config) {
      return true;
    }

    const allowedRoles = config[mode] || [];

    return allowedRoles.includes(role);
  }

  function getDefaultPageForCurrentUser() {
    return 'dashboard';
  }

  function ensureAllowedPage(page) {
    if (isPageAllowed(page)) {
      return page;
    }

    return getDefaultPageForCurrentUser();
  }

  function updateMobileNavScrollHint() {
    const wrap = document.querySelector('.mobile-nav-wrap');
    const nav = document.querySelector('#sidebar .mobile-nav-scroll');
    const progress = document.getElementById('mobileNavProgress');

    if (!wrap || !nav || !progress) return;

    const maxScroll = nav.scrollWidth - nav.clientWidth;
    const current = nav.scrollLeft;

    wrap.classList.toggle('can-scroll-left', current > 4);
    wrap.classList.toggle('can-scroll-right', maxScroll > 4 && current < maxScroll - 4);

    if (maxScroll <= 0) {
      progress.style.width = '100%';
      progress.style.transform = 'translateX(0%)';
      return;
    }

    const visibleRatio = Math.max(0.18, nav.clientWidth / nav.scrollWidth);
    const progressWidth = visibleRatio * 100;
    const progressMove = (current / maxScroll) * (100 - progressWidth);

    progress.style.width = `${progressWidth}%`;
    progress.style.transform = `translateX(${progressMove}%)`;
  }

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
    ensureAdminModeSwitcher();

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

    ensureAdminModeSwitcher();
  }

  function ensureAdminModeSwitcher() {
    const oldSwitcher = document.getElementById('adminTransportModeSwitcherWrap');
    const role = getRole();

    if (!currentUser || !isAdminRole(role)) {
      if (oldSwitcher) oldSwitcher.remove();
      return;
    }

    if (oldSwitcher) {
      updateAdminModeSwitcherLabels();
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.id = 'adminTransportModeSwitcherWrap';
    wrapper.className = 'flex items-center gap-2';

    wrapper.innerHTML = `
      <select
        id="adminTransportModeSwitcher"
        class="bg-slate-900 text-white border border-slate-700 rounded-xl px-3 py-2 text-sm"
        title="Transporto režimas"
      >
        <option value="car_transporter"></option>
        <option value="truck"></option>
      </select>
    `;

    const select = wrapper.querySelector('#adminTransportModeSwitcher');
    select.value = getEffectiveTransportMode();

    select.addEventListener('change', async () => {
      setStoredAdminMode(select.value);

      applyRoleVisibility();
      applyTranslations();
      updateAdminModeSwitcherLabels();

      const targetPage = isPageAllowed(currentPage)
        ? currentPage
        : getDefaultPageForCurrentUser();

      await loadPage(targetPage);
    });

    const headerRightArea =
      logoutBtn?.parentElement ||
      document.querySelector('header .flex.items-center.gap-2') ||
      document.querySelector('header .flex.items-center') ||
      document.querySelector('header');

    if (headerRightArea && logoutBtn) {
      headerRightArea.insertBefore(wrapper, logoutBtn);
    } else if (headerRightArea) {
      headerRightArea.appendChild(wrapper);
    } else {
      document.body.appendChild(wrapper);
      wrapper.classList.add('fixed', 'top-3', 'right-32', 'z-[999]');
    }

    updateAdminModeSwitcherLabels();
  }

  function applyRoleVisibility() {
    const role = currentProfile?.role || null;

    document.querySelectorAll('[data-page]').forEach(element => {
      const page = element.dataset.page;

      if (!page) return;

      const allowed = Boolean(role && isPageAllowed(page));

      element.classList.toggle('hidden', !allowed);
      element.style.display = allowed ? '' : 'none';
    });

    document.querySelectorAll('[data-roles]:not([data-page])').forEach(element => {
      const roles = String(element.dataset.roles || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

      if (!roles.length) return;

      const allowed = Boolean(role && roles.includes(role));

      element.classList.toggle('hidden', !allowed);
      element.style.display = allowed ? '' : 'none';
    });

    if (currentUser && !isPageAllowed(currentPage)) {
      loadPage(getDefaultPageForCurrentUser());
    }

    ensureAdminModeSwitcher();
    updateAdminModeSwitcherLabels();

    setTimeout(updateMobileNavScrollHint, 50);
  }

  function setActiveNav(page) {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'active');
      btn.classList.add('hover:bg-slate-800');
    });

    const activeBtn = document.querySelector(`[data-page="${page}"]`);

    if (activeBtn) {
      activeBtn.classList.add('bg-blue-600', 'hover:bg-blue-700', 'active');
      activeBtn.classList.remove('hover:bg-slate-800');

      if (window.innerWidth < 768) {
        setTimeout(() => {
          activeBtn.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest'
          });

          updateMobileNavScrollHint();
        }, 60);
      }
    }

    setTimeout(updateMobileNavScrollHint, 50);
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
      container.innerHTML = `<div class="text-slate-400" data-i18n="dashboard.no_info">${t('dashboard.no_info') || 'Informacijos nėra.'}</div>`;
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
  async function updateTasksBadge() {
  const btn = document.querySelector('[data-page="uzduotys"]');

  if (!btn) return;

  let badge = btn.querySelector('.tasks-badge');

  function removeBadge() {
    if (badge) badge.remove();
  }

  if (!currentUser || !currentProfile) {
    removeBadge();
    return;
  }

  const role = getRole();
  const isDriver =
    role === 'driver' ||
    role === 'truck_driver' ||
    role === 'master_driver' ||
    role === 'truck_master_driver';

  if (!isDriver) {
    removeBadge();
    return;
  }

  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', currentUser.id)
    .eq('transport_mode', getEffectiveTransportMode())
    .neq('status', 'done');

  if (error) {
    console.warn('Tasks badge error:', error);
    removeBadge();
    return;
  }

  if (!count) {
    removeBadge();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'tasks-badge ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold leading-none';
    btn.appendChild(badge);
  }

  badge.textContent = String(count);
}

  async function initPage(page) {
    const moduleProfile = getProfileForModules();

    switch (page) {
      case 'dashboard':
        await renderDashboardImages();
        break;

      case 'defektas':
        await initDefektas({
          supabase,
          user: currentUser,
          profile: moduleProfile
        });
        break;

      case 'instrukcijos':
        await initInstrukcijos({
          supabase,
          user: currentUser,
          profile: moduleProfile
        });
        break;

      case 'nustatymai':
        await initNustatymai({
          supabase,
          user: currentUser,
          profile: moduleProfile
        });
        break;

      case 'uzduotys':
        await initUzduotys({
          supabase,
          user: currentUser,
          profile: moduleProfile
        });
        break;

      case 'vilkiko-priemimas':
        await initVilkikoPriemimas({
          supabase,
          user: currentUser,
          profile: moduleProfile
        });
        break;

      case 'master-driver':
        await initMasterDriver({
          supabase,
          user: currentUser,
          profile: moduleProfile
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

      if (currentUser && page !== 'login') {
        page = ensureAllowedPage(page);
      }

      currentPage = page;
      setActiveNav(page);

      if (content) {
        content.innerHTML = `<div class="text-slate-400" data-i18n="common.loading">${t('common.loading') || 'Kraunama...'}</div>`;
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
      updateAdminModeSwitcherLabels();
      await updateTasksBadge();

      setTimeout(updateMobileNavScrollHint, 50);

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
  window.getAppTransportMode = getEffectiveTransportMode;

  document.addEventListener('click', async (e) => {
    const navBtn = e.target.closest('[data-page]');

    if (navBtn) {
      e.preventDefault();
      e.stopPropagation();

      const page = navBtn.dataset.page;

      if (!page) return;

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

  window.addEventListener('resize', updateMobileNavScrollHint);

  document
    .querySelector('#sidebar .mobile-nav-scroll')
    ?.addEventListener('scroll', updateMobileNavScrollHint);

  setTimeout(updateMobileNavScrollHint, 300);

  logoutBtn?.addEventListener('click', async () => {
    await supabase.auth.signOut();

    currentUser = null;
    currentProfile = null;
    pendingPage = null;

    updateShellByAuth();
    applyRoleVisibility();
    ensureAdminModeSwitcher();
    await updateTasksBadge();

    await loadPage('login');
  });

  window.addEventListener('languageChanged', async () => {
  applyTranslations();
  updateAdminModeSwitcherLabels();
  updateShellByAuth();
  applyRoleVisibility();

  const pageToReload = currentPage || 'dashboard';

  if (currentUser && pageToReload !== 'login') {
    await loadPage(pageToReload);
  } else {
    applyTranslations();
  }
    await updateTasksBadge();

  setTimeout(updateMobileNavScrollHint, 50);
});
  await loadSession();

  updateShellByAuth();
  applyTranslations();

  await loadPage(currentUser ? 'dashboard' : 'login');

  setTimeout(updateMobileNavScrollHint, 300);
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