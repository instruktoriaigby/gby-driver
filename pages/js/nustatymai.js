import { t } from '../../i18n.js';

export async function initNustatymai({ supabase, user, profile }) {
  const currentUser = user;
  const role = profile?.role || 'driver';

  const transportMode =
    profile?.transport_mode ||
    profile?.app_transport_mode ||
    profile?.effective_transport_mode ||
    'car_transporter';

  const isAdmin = role === 'admin';

  const canManageInstructions = [
    'admin',
    'instructor',
    'truck_instructor'
  ].includes(role);

  const canOpenSettings = [
    'admin',
    'instructor',
    'master_driver',
    'truck_master_driver',
    'truck_instructor'
  ].includes(role);

  if (!canOpenSettings) {
    window.navigateTo('dashboard');
    return;
  }

  const typeSelect = document.getElementById('typeSelect');
  const langSelect = document.getElementById('instrLang');
  const blocks = document.querySelectorAll('.form-block');
  const instrList = document.getElementById('instrList');
  const instrSearch = document.getElementById('instrSearch');
  const instrSearchList = document.getElementById('instrSearchList');

  const instructionFormPanel = document.getElementById('instructionFormPanel');
  const dashboardPanel = document.getElementById('dashboardPanel');

  if (!typeSelect || !instrList || !langSelect) return;

  if (!canManageInstructions) {
    instructionFormPanel?.classList.add('hidden');
  }

  if (!isAdmin) {
    dashboardPanel?.classList.add('hidden');
  }

  let instructions = [];
  let editInstructionId = localStorage.getItem('editInstructionId') || null;

  function getTranslation(key, fallback) {
    const value = t(key);

    if (!value) return fallback;
    if (value === key) return fallback;

    return value;
  }

  function getCurrentLang() {
    return localStorage.getItem('lang') || profile?.lang || 'lt';
  }

  function getModeLabel(mode = transportMode) {
    const lang = getCurrentLang();

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

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function normalizeInstruction(row) {
    return {
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      type: row.type || 'general',
      lang: row.lang || 'lt',
      transport_mode: row.transport_mode || 'car_transporter',
      video: row.video_url || '',
      test: row.test_url || '',
      pdf: row.pdf_url || '',
      link: row.link_url || '',
      avoid: row.avoid_text || '',
      load: row.load_text || '',
      unload: row.unload_text || ''
    };
  }

  async function loadInstructionsFromSupabase() {
    const { data, error } = await supabase
      .from('instructions')
      .select('*')
      .eq('transport_mode', transportMode)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Instructions load error:', error);
      instructions = [];
      return;
    }

    instructions = (data || []).map(normalizeInstruction);

    console.log('✅ Nustatymai instrukcijos užkrautos:', {
      transportMode,
      count: instructions.length
    });
  }

  async function refreshInstructionsUi() {
    await loadInstructionsFromSupabase();

    fillSearchSuggestions();
    renderInstrList();
  }

  await loadInstructionsFromSupabase();

  function fillSearchSuggestions() {
    if (!instrSearchList) return;

    instrSearchList.innerHTML = instructions.map(item =>
      `<option value="${escapeHtml(item.title)}"></option>`
    ).join('');
  }

  function renderInstrList() {
    const q = (instrSearch?.value || '').toLowerCase().trim();

    const list = instructions.filter(item => {
      if (!q) return true;

      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });

    if (!list.length) {
      instrList.innerHTML = `
        <div class="text-slate-400">
          ${getTranslation('common.no_instructions', 'Nėra instrukcijų')}
        </div>
      `;
      return;
    }

    instrList.innerHTML = list.map(item => `
      <div class="bg-slate-800 rounded-lg p-3 flex items-center justify-between" data-id="${escapeHtml(item.id)}">
        <div class="pr-4 min-w-0">
          <div class="font-semibold break-words">${escapeHtml(item.title)}</div>
          <div class="text-sm text-slate-400 break-words">${escapeHtml(item.description || '')}</div>
          <div class="text-xs text-slate-500 mt-1 uppercase">
            ${escapeHtml(item.lang)} · ${escapeHtml(item.type)} · ${escapeHtml(getModeLabel(item.transport_mode))}
          </div>
        </div>

        <div class="flex gap-2 shrink-0">
          ${canManageInstructions ? `<button class="edit-btn bg-yellow-600 px-2 py-1 rounded text-xs">✏️</button>` : ''}
          ${canManageInstructions ? `<button class="delete-btn bg-red-600 px-2 py-1 rounded text-xs">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function clearInstructionForm() {
    document.getElementById('title').value = '';
    document.getElementById('desc').value = '';
    document.getElementById('video').value = '';
    document.getElementById('test').value = '';
    document.getElementById('pdf').value = '';
    document.getElementById('newsLink').value = '';
    document.getElementById('avoid').value = '';
    document.getElementById('load').value = '';
    document.getElementById('unload').value = '';
    document.getElementById('cargoAvoid').value = '';

    typeSelect.value = 'general';
    typeSelect.dispatchEvent(new Event('change'));
  }

  fillSearchSuggestions();
  renderInstrList();

  instrSearch?.addEventListener('input', renderInstrList);

  typeSelect.onchange = () => {
    const val = typeSelect.value;

    blocks.forEach(block => {
      block.classList.toggle('hidden', block.dataset.type !== val);
    });
  };

  typeSelect.dispatchEvent(new Event('change'));

  const uiLang = localStorage.getItem('lang') || profile?.lang || 'lt';
  langSelect.value = uiLang;

  if (editInstructionId) {
    const item = instructions.find(x => String(x.id) === String(editInstructionId));

    if (item && item.transport_mode === transportMode) {
      typeSelect.value = item.type || 'general';
      typeSelect.dispatchEvent(new Event('change'));

      langSelect.value = item.lang || 'lt';

      document.getElementById('title').value = item.title || '';
      document.getElementById('desc').value = item.description || '';

      document.getElementById('video').value = item.video || '';
      document.getElementById('test').value = item.test || '';
      document.getElementById('pdf').value = item.pdf || '';

      document.getElementById('newsLink').value = item.link || '';
      document.getElementById('avoid').value = item.avoid || '';
      document.getElementById('load').value = item.load || '';
      document.getElementById('unload').value = item.unload || '';
      document.getElementById('cargoAvoid').value = item.avoid || '';
    } else {
      localStorage.removeItem('editInstructionId');
      editInstructionId = null;
    }
  }

  instrList.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-id]');
    if (!card) return;

    const id = card.dataset.id;

    if (canManageInstructions && e.target.closest('.edit-btn')) {
      localStorage.setItem('editInstructionId', id);
      window.navigateTo('nustatymai');
      return;
    }

    if (canManageInstructions && e.target.closest('.delete-btn')) {
      const confirmed = confirm(
        getCurrentLang() === 'ru'
          ? 'Вы уверены, что хотите удалить инструкцию?'
          : getCurrentLang() === 'en'
            ? 'Are you sure you want to delete this instruction?'
            : 'Ar tikrai ištrinti instrukciją?'
      );

      if (!confirmed) return;

      const { error } = await supabase
        .from('instructions')
        .delete()
        .eq('id', id)
        .eq('transport_mode', transportMode);

      if (error) {
        console.error('Instruction delete error:', error);
        alert(
          getCurrentLang() === 'ru'
            ? 'Не удалось удалить инструкцию'
            : getCurrentLang() === 'en'
              ? 'Failed to delete instruction'
              : 'Nepavyko ištrinti instrukcijos'
        );
        return;
      }

      await refreshInstructionsUi();
    }
  });

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    if (!canManageInstructions) return;

    const type = typeSelect.value;

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('desc').value.trim();

    if (!title || !description) {
      alert(
        getCurrentLang() === 'ru'
          ? 'Введите название и описание инструкции'
          : getCurrentLang() === 'en'
            ? 'Enter instruction title and description'
            : 'Įvesk instrukcijos pavadinimą ir aprašymą'
      );
      return;
    }

    const payload = {
      title,
      description,
      type,
      lang: langSelect.value || 'lt',
      transport_mode: transportMode,
      video_url: document.getElementById('video').value.trim() || null,
      test_url: document.getElementById('test').value.trim() || null,
      pdf_url: document.getElementById('pdf').value.trim() || null,
      link_url: null,
      avoid_text: null,
      load_text: null,
      unload_text: null,
      updated_by: currentUser.id
    };

    if (type === 'news') {
      payload.link_url = document.getElementById('newsLink').value.trim() || null;
    }

    if (type === 'event') {
      payload.avoid_text = document.getElementById('avoid').value.trim() || null;
    }

    if (type === 'cargo') {
      payload.load_text = document.getElementById('load').value.trim() || null;
      payload.unload_text = document.getElementById('unload').value.trim() || null;
      payload.avoid_text = document.getElementById('cargoAvoid').value.trim() || null;
    }

    let error;

    if (editInstructionId) {
      const result = await supabase
        .from('instructions')
        .update(payload)
        .eq('id', editInstructionId)
        .eq('transport_mode', transportMode);

      error = result.error;
    } else {
      const result = await supabase
        .from('instructions')
        .insert({
          ...payload,
          created_by: currentUser.id
        });

      error = result.error;
    }

    if (error) {
      console.error('Instruction save error:', error);
      alert(
        getCurrentLang() === 'ru'
          ? 'Не удалось сохранить инструкцию'
          : getCurrentLang() === 'en'
            ? 'Failed to save instruction'
            : 'Nepavyko išsaugoti instrukcijos'
      );
      return;
    }

    localStorage.removeItem('editInstructionId');
    editInstructionId = null;

    clearInstructionForm();
    await refreshInstructionsUi();

    alert(
      getCurrentLang() === 'ru'
        ? 'Инструкция сохранена!'
        : getCurrentLang() === 'en'
          ? 'Instruction saved!'
          : 'Instrukcija išsaugota!'
    );
  });

  // ==========================================================
  // VADYBININKŲ VALDYMAS
  // Admin gali pridėti, paslėpti ir aktyvuoti vadybininkus.
  // Lentelė: public.managers
  // ==========================================================

  let managers = [];

  function getManagerTexts() {
    const lang = getCurrentLang();

    const texts = {
      lt: {
        title: 'Vadybininkai',
        subtitle: 'Čia administratoriui galima pridėti vadybininkus ir paslėpti tuos, kurie neturi būti rodomi defektų formoje.',
        namePlaceholder: 'Vadybininko vardas, pvz. Tomas B.',
        add: 'Pridėti vadybininką',
        active: 'Aktyvūs',
        hidden: 'Paslėpti',
        hide: 'Paslėpti',
        show: 'Aktyvuoti',
        noActive: 'Aktyvių vadybininkų nėra',
        noHidden: 'Paslėptų vadybininkų nėra',
        enterName: 'Įveskite vadybininko vardą',
        addError: 'Nepavyko pridėti vadybininko',
        updateError: 'Nepavyko atnaujinti vadybininko',
        confirmHide: 'Paslėpti vadybininką?',
        confirmShow: 'Aktyvuoti vadybininką?'
      },
      en: {
        title: 'Managers',
        subtitle: 'Admin can add managers and hide those who should not appear in the defect form.',
        namePlaceholder: 'Manager name, e.g. Tomas B.',
        add: 'Add manager',
        active: 'Active',
        hidden: 'Hidden',
        hide: 'Hide',
        show: 'Activate',
        noActive: 'No active managers',
        noHidden: 'No hidden managers',
        enterName: 'Enter manager name',
        addError: 'Failed to add manager',
        updateError: 'Failed to update manager',
        confirmHide: 'Hide this manager?',
        confirmShow: 'Activate this manager?'
      },
      ru: {
        title: 'Менеджеры',
        subtitle: 'Администратор может добавить менеджеров и скрыть тех, кто не должен отображаться в форме дефектов.',
        namePlaceholder: 'Имя менеджера, напр. Tomas B.',
        add: 'Добавить менеджера',
        active: 'Активные',
        hidden: 'Скрытые',
        hide: 'Скрыть',
        show: 'Активировать',
        noActive: 'Активных менеджеров нет',
        noHidden: 'Скрытых менеджеров нет',
        enterName: 'Введите имя менеджера',
        addError: 'Не удалось добавить менеджера',
        updateError: 'Не удалось обновить менеджера',
        confirmHide: 'Скрыть менеджера?',
        confirmShow: 'Активировать менеджера?'
      }
    };

    return texts[lang] || texts.lt;
  }

  function ensureManagersPanel() {
    if (!isAdmin) return null;

    let panel = document.getElementById('managersPanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'managersPanel';
    panel.className = 'bg-slate-900/60 p-5 rounded-2xl border border-slate-800 mt-6';

    const insertAfter =
      dashboardPanel ||
      instructionFormPanel ||
      document.getElementById('defectPhotosExportPanel') ||
      document.querySelector('.bg-slate-900\\/60');

    if (insertAfter?.parentElement) {
      insertAfter.insertAdjacentElement('afterend', panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  async function loadManagers() {
    if (!isAdmin) return;

    const { data, error } = await supabase
      .from('managers')
      .select('id, full_name, is_active, created_at')
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Managers load error:', error);
      managers = [];
      return;
    }

    managers = data || [];
  }

  function renderManagersPanel() {
    if (!isAdmin) return;

    const panel = ensureManagersPanel();
    if (!panel) return;

    const txt = getManagerTexts();

    const activeManagers = managers
      .filter(manager => manager.is_active !== false)
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'lt'));

    const hiddenManagers = managers
      .filter(manager => manager.is_active === false)
      .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'lt'));

    function renderManagerRow(manager, active = true) {
      return `
        <div class="bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3" data-manager-id="${escapeHtml(manager.id)}">
          <div class="min-w-0">
            <div class="font-semibold break-words">${escapeHtml(manager.full_name)}</div>
            <div class="text-xs ${active ? 'text-green-400' : 'text-slate-500'}">
              ${active ? escapeHtml(txt.active) : escapeHtml(txt.hidden)}
            </div>
          </div>

          <button
            type="button"
            class="${active ? 'manager-hide bg-yellow-600 hover:bg-yellow-700' : 'manager-show bg-green-600 hover:bg-green-700'} px-3 py-2 rounded-xl text-sm shrink-0"
            data-manager-id="${escapeHtml(manager.id)}"
          >
            ${active ? escapeHtml(txt.hide) : escapeHtml(txt.show)}
          </button>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="flex flex-col gap-2 mb-4">
        <h2 class="text-xl font-semibold">${escapeHtml(txt.title)}</h2>
        <p class="text-sm text-slate-400">${escapeHtml(txt.subtitle)}</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-5">
        <input
          id="managerNameInput"
          type="text"
          autocomplete="off"
          class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
          placeholder="${escapeHtml(txt.namePlaceholder)}"
        >

        <button
          id="addManagerBtn"
          type="button"
          class="bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-3 font-semibold"
        >
          ${escapeHtml(txt.add)}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold">${escapeHtml(txt.active)}</h3>
            <span class="text-xs bg-green-700 rounded-full px-3 py-1">${activeManagers.length}</span>
          </div>

          <div class="space-y-2">
            ${
              activeManagers.length
                ? activeManagers.map(manager => renderManagerRow(manager, true)).join('')
                : `<div class="text-sm text-slate-400">${escapeHtml(txt.noActive)}</div>`
            }
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold">${escapeHtml(txt.hidden)}</h3>
            <span class="text-xs bg-slate-700 rounded-full px-3 py-1">${hiddenManagers.length}</span>
          </div>

          <div class="space-y-2">
            ${
              hiddenManagers.length
                ? hiddenManagers.map(manager => renderManagerRow(manager, false)).join('')
                : `<div class="text-sm text-slate-400">${escapeHtml(txt.noHidden)}</div>`
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('addManagerBtn')?.addEventListener('click', addManager);

    panel.querySelectorAll('.manager-hide').forEach(button => {
      button.addEventListener('click', async () => {
        await updateManagerActive(button.dataset.managerId, false);
      });
    });

    panel.querySelectorAll('.manager-show').forEach(button => {
      button.addEventListener('click', async () => {
        await updateManagerActive(button.dataset.managerId, true);
      });
    });

    document.getElementById('managerNameInput')?.addEventListener('keydown', async event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await addManager();
      }
    });
  }

  async function refreshManagersUi() {
    if (!isAdmin) return;

    await loadManagers();
    renderManagersPanel();
  }

  async function addManager() {
    if (!isAdmin) return;

    const txt = getManagerTexts();
    const input = document.getElementById('managerNameInput');
    const fullName = String(input?.value || '').trim();

    if (!fullName) {
      alert(txt.enterName);
      input?.focus();
      return;
    }

    const { error } = await supabase
      .from('managers')
      .insert({
        full_name: fullName,
        is_active: true,
        created_by: currentUser.id
      });

    if (error) {
      console.error('Manager add error:', error);
      alert(error.message || txt.addError);
      return;
    }

    if (input) input.value = '';

    await refreshManagersUi();
  }

  async function updateManagerActive(managerId, isActive) {
    if (!isAdmin || !managerId) return;

    const txt = getManagerTexts();

    const confirmed = confirm(isActive ? txt.confirmShow : txt.confirmHide);
    if (!confirmed) return;

    const { error } = await supabase
      .from('managers')
      .update({
        is_active: isActive
      })
      .eq('id', managerId);

    if (error) {
      console.error('Manager update error:', error);
      alert(error.message || txt.updateError);
      return;
    }

    await refreshManagersUi();
  }

  if (isAdmin) {
    await refreshManagersUi();
  }

  // ==========================================================
  // DASHBOARD PAVEIKSLĖLIAI
  // ==========================================================

  let dashboardImages = [];

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

  async function loadDashboardImages() {
    if (!isAdmin) return;

    const { data, error } = await supabase
      .from('dashboard_images')
      .select('id, image_url, file_path, title, sort_order, is_active, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Dashboard images load error:', error);
      dashboardImages = [];
      return;
    }

    dashboardImages = data || [];
  }

  function renderDashboardPreview() {
    const preview = document.getElementById('dashboardPreview');
    if (!preview) return;

    if (!dashboardImages.length) {
      preview.innerHTML = `
        <div class="text-slate-400 text-sm">
          Dashboard paveikslėlių nėra
        </div>
      `;
      return;
    }

    preview.innerHTML = dashboardImages.map(img => {
      const imageUrl = getDashboardImageUrl(img);

      if (!imageUrl) return '';

      return `
        <div class="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
          <img
            src="${imageUrl}"
            class="w-full h-auto block select-none pointer-events-none"
            draggable="false"
            alt=""
          >
        </div>
      `;
    }).join('');
  }

  function getSafeFileName(fileName) {
    return String(fileName || 'dashboard.jpg')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'dashboard.jpg';
  }

  async function removeOldDashboardFiles() {
    const filePaths = dashboardImages
      .map(img => img.file_path)
      .filter(Boolean);

    if (!filePaths.length) return;

    const { error } = await supabase
      .storage
      .from('dashboard-images')
      .remove(filePaths);

    if (error) {
      console.warn('Old dashboard files remove skipped:', error);
    }
  }

  await loadDashboardImages();
  renderDashboardPreview();

  document.getElementById('saveDashboardImages')?.addEventListener('click', async () => {
    if (!isAdmin) return;

    const input = document.getElementById('dashboardUpload');
    const files = Array.from(input?.files || []);

    if (!files.length) {
      alert('Pasirink JPEG');
      return;
    }

    if (files.length > 3) {
      alert('Galima įkelti iki 3 paveikslėlių');
      return;
    }

    const invalidFile = files.find(file => {
      const name = file.name.toLowerCase();
      return !file.type.includes('jpeg') && !name.endsWith('.jpg') && !name.endsWith('.jpeg');
    });

    if (invalidFile) {
      alert('Galima kelti tik JPG / JPEG failus');
      return;
    }

    const saveBtn = document.getElementById('saveDashboardImages');
    const originalText = saveBtn?.textContent || 'Išsaugoti dashboard';

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-60', 'cursor-not-allowed');
      saveBtn.textContent = 'Saugoma...';
    }

    try {
      await removeOldDashboardFiles();

      const { error: deleteError } = await supabase
        .from('dashboard_images')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('Dashboard delete error:', deleteError);
        alert('Nepavyko išvalyti senų dashboard paveikslėlių');
        return;
      }

      const rows = [];

      for (const [index, file] of files.entries()) {
        const safeName = getSafeFileName(file.name);
        const filePath = `${currentUser.id}/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase
          .storage
          .from('dashboard-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            contentType: file.type || 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.error('Dashboard upload error:', uploadError);
          alert('Nepavyko įkelti dashboard paveikslėlio į Storage');
          return;
        }

        const { data: publicData } = supabase
          .storage
          .from('dashboard-images')
          .getPublicUrl(filePath);

        rows.push({
          image_url: publicData?.publicUrl || null,
          file_path: filePath,
          title: `Dashboard ${index + 1}`,
          sort_order: index,
          is_active: true,
          created_by: currentUser.id
        });
      }

      const { error: insertError } = await supabase
        .from('dashboard_images')
        .insert(rows);

      if (insertError) {
        console.error('Dashboard insert error:', insertError);
        alert('Nepavyko išsaugoti dashboard paveikslėlių');
        return;
      }

      if (input) input.value = '';

      await loadDashboardImages();
      renderDashboardPreview();

      alert('Dashboard atnaujintas!');
      window.navigateTo('dashboard');

    } catch (err) {
      console.error('Dashboard save error:', err);
      alert(err?.message || 'Dashboard išsaugojimo klaida');

    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        saveBtn.textContent = originalText;
      }
    }
  });

  // ==========================================================
  // DEFEKTŲ NUOTRAUKŲ EXPORT
  // ==========================================================

  const defectPhotosExportPanel = document.getElementById('defectPhotosExportPanel');
  const defectPhotosExportStats = document.getElementById('defectPhotosExportStats');
  const defectPhotosExportMessage = document.getElementById('defectPhotosExportMessage');
  const refreshDefectPhotosExportBtn = document.getElementById('refreshDefectPhotosExport');
  const downloadDefectPhotosZipBtn = document.getElementById('downloadDefectPhotosZip');
  const markLastDefectPhotosExportedBtn = document.getElementById('markLastDefectPhotosExported');
  const deleteExportedDefectPhotosBtn = document.getElementById('deleteExportedDefectPhotos');

  const DEFECT_PHOTOS_BUCKET = 'defect-photos';
  const LAST_EXPORT_IDS_KEY = 'lastDefectPhotoExportIds';

  let lastExportedPhotoIds = [];

  if (!isAdmin) {
    defectPhotosExportPanel?.classList.add('hidden');
  }

  function setExportMessage(message, type = 'info') {
    if (!defectPhotosExportMessage) return;

    defectPhotosExportMessage.textContent = message || '';
    defectPhotosExportMessage.classList.remove('text-slate-400', 'text-green-400', 'text-red-400', 'text-yellow-400');

    if (type === 'success') {
      defectPhotosExportMessage.classList.add('text-green-400');
    } else if (type === 'error') {
      defectPhotosExportMessage.classList.add('text-red-400');
    } else if (type === 'warning') {
      defectPhotosExportMessage.classList.add('text-yellow-400');
    } else {
      defectPhotosExportMessage.classList.add('text-slate-400');
    }
  }

  function setButtonsDisabled(buttons, disabled) {
    buttons.forEach(button => {
      if (!button) return;
      button.disabled = disabled;
      button.classList.toggle('opacity-60', disabled);
      button.classList.toggle('cursor-not-allowed', disabled);
    });
  }

  function chunkArray(items, size) {
    const chunks = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  function safeFilePart(value, fallback = 'nezinoma') {
    return String(value || fallback)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || fallback;
  }

  function formatDateFolder(value) {
    const date = value ? new Date(value) : new Date();

    if (Number.isNaN(date.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  function createDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function loadJsZip() {
    if (window.JSZip) return window.JSZip;

    await new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-jszip="true"]');

      if (existingScript) {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.async = true;
      script.dataset.jszip = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Nepavyko užkrauti ZIP bibliotekos'));
      document.head.appendChild(script);
    });

    return window.JSZip;
  }

  async function loadDefectRows(defectIds) {
    const uniqueIds = [...new Set((defectIds || []).filter(Boolean))];

    if (!uniqueIds.length) return new Map();

    const map = new Map();

    for (const idsChunk of chunkArray(uniqueIds, 100)) {
      const { data, error } = await supabase
        .from('defects')
        .select('id, cmr_number, truck_number, driver_name, created_at')
        .in('id', idsChunk);

      if (error) {
        console.warn('Defects load for export skipped:', error);
        continue;
      }

      (data || []).forEach(row => map.set(row.id, row));
    }

    return map;
  }

  async function loadPhotosForExport({ exported = false } = {}) {
    let query = supabase
      .from('defect_photos')
      .select('id, defect_id, category, file_path, file_name, mime_type, size_bytes, created_at, exported_to_sharepoint, deleted_after_export')
      .eq('deleted_after_export', false)
      .order('created_at', { ascending: true })
      .limit(1000);

    if (exported) {
      query = query.eq('exported_to_sharepoint', true);
    } else {
      query = query.eq('exported_to_sharepoint', false);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  }

  async function updateDefectPhotosExportStats() {
    if (!isAdmin || !defectPhotosExportStats) return;

    try {
      const [{ count: notExportedCount, error: notExportedError }, { count: exportedCount, error: exportedError }] = await Promise.all([
        supabase
          .from('defect_photos')
          .select('id', { count: 'exact', head: true })
          .eq('exported_to_sharepoint', false)
          .eq('deleted_after_export', false),
        supabase
          .from('defect_photos')
          .select('id', { count: 'exact', head: true })
          .eq('exported_to_sharepoint', true)
          .eq('deleted_after_export', false)
      ]);

      if (notExportedError) throw notExportedError;
      if (exportedError) throw exportedError;

      defectPhotosExportStats.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div><span class="text-slate-400">Neperkeltos nuotraukos:</span> <b>${notExportedCount || 0}</b></div>
          <div><span class="text-slate-400">Pažymėtos kaip perkeltos, bet dar Storage:</span> <b>${exportedCount || 0}</b></div>
        </div>
      `;

    } catch (err) {
      console.error('Export stats error:', err);
      defectPhotosExportStats.textContent = 'Nepavyko suskaičiuoti defektų nuotraukų.';
    }
  }

  async function downloadDefectPhotosZip() {
    if (!isAdmin) return;

    setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], true);
    setExportMessage('Ruošiamas ZIP failas...', 'info');

    try {
      const photos = await loadPhotosForExport({ exported: false });

      if (!photos.length) {
        setExportMessage('Nėra neperkeltų defektų nuotraukų.', 'warning');
        return;
      }

      const JSZip = await loadJsZip();
      const zip = new JSZip();
      const defectsMap = await loadDefectRows(photos.map(photo => photo.defect_id));
      const usedNames = new Map();
      const successfulIds = [];
      const failed = [];

      for (const [index, photo] of photos.entries()) {
        setExportMessage(`Atsisiunčiama ${index + 1} iš ${photos.length}...`, 'info');

        if (!photo.file_path) {
          failed.push(`${photo.id}: nėra file_path`);
          continue;
        }

        const { data: blob, error: downloadError } = await supabase
          .storage
          .from(DEFECT_PHOTOS_BUCKET)
          .download(photo.file_path);

        if (downloadError || !blob) {
          console.error('Defect photo download error:', photo, downloadError);
          failed.push(`${photo.file_name || photo.file_path}: ${downloadError?.message || 'nepavyko atsisiųsti'}`);
          continue;
        }

        const defect = defectsMap.get(photo.defect_id) || {};
        const dateFolder = formatDateFolder(defect.created_at || photo.created_at);
        const cmr = safeFilePart(defect.cmr_number, 'be-cmr');
        const truck = safeFilePart(defect.truck_number, 'be-vilkiko');
        const defectFolder = `${dateFolder}/${cmr}_${truck}_${safeFilePart(photo.defect_id, 'defektas')}`;
        const originalName = safeFilePart(photo.file_name || photo.file_path.split('/').pop() || 'photo.jpg', 'photo.jpg');
        const category = safeFilePart(photo.category || 'foto', 'foto');
        const baseName = `${defectFolder}/${category}_${originalName}`;
        const usedCount = usedNames.get(baseName) || 0;
        const finalName = usedCount ? baseName.replace(/(\.[^.]+)?$/, `_${usedCount}$1`) : baseName;

        usedNames.set(baseName, usedCount + 1);
        zip.file(finalName, blob);
        successfulIds.push(photo.id);
      }

      if (!successfulIds.length) {
        setExportMessage('Nepavyko atsisiųsti nė vienos nuotraukos. Patikrink Storage teises arba bucket pavadinimą.', 'error');
        return;
      }

      setExportMessage('Kuriamas ZIP failas...', 'info');

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const fileName = `defektu-nuotraukos-${new Date().toISOString().slice(0, 10)}.zip`;

      createDownload(zipBlob, fileName);

      lastExportedPhotoIds = successfulIds;
      localStorage.setItem(LAST_EXPORT_IDS_KEY, JSON.stringify(successfulIds));

      const message = [
        `ZIP paruoštas: ${fileName}`,
        `Nuotraukų ZIP faile: ${successfulIds.length}`,
        failed.length ? `Nepavyko atsisiųsti: ${failed.length}` : '',
        'Įkelk ZIP arba išarchyvuotas nuotraukas į SharePoint, tada spausk „Pažymėti paskutinį ZIP kaip perkeltą“.',
      ].filter(Boolean).join('\n');

      setExportMessage(message, failed.length ? 'warning' : 'success');

    } catch (err) {
      console.error('Defect photos ZIP export error:', err);
      setExportMessage(err?.message || 'Nepavyko sukurti ZIP failo.', 'error');

    } finally {
      setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], false);
      await updateDefectPhotosExportStats();
    }
  }

  async function markLastDefectPhotosExported() {
    if (!isAdmin) return;

    const storedIds = JSON.parse(localStorage.getItem(LAST_EXPORT_IDS_KEY) || '[]');
    const ids = lastExportedPhotoIds.length ? lastExportedPhotoIds : storedIds;

    if (!ids.length) {
      alert('Pirma atsisiųsk ZIP failą. Tada galėsi pažymėti nuotraukas kaip perkeltas.');
      return;
    }

    const confirmed = confirm(`Pažymėti ${ids.length} paskutinio ZIP nuotraukų kaip perkeltas į SharePoint?`);
    if (!confirmed) return;

    setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], true);
    setExportMessage('Žymima kaip perkelta...', 'info');

    try {
      for (const idsChunk of chunkArray(ids, 100)) {
        const { error } = await supabase
          .from('defect_photos')
          .update({
            exported_to_sharepoint: true,
            exported_to_sharepoint_at: new Date().toISOString()
          })
          .in('id', idsChunk);

        if (error) throw error;
      }

      localStorage.removeItem(LAST_EXPORT_IDS_KEY);
      lastExportedPhotoIds = [];

      setExportMessage('Nuotraukos pažymėtos kaip perkeltos į SharePoint.', 'success');

    } catch (err) {
      console.error('Mark exported error:', err);
      setExportMessage(err?.message || 'Nepavyko pažymėti kaip perkeltų.', 'error');

    } finally {
      setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], false);
      await updateDefectPhotosExportStats();
    }
  }

  async function deleteExportedDefectPhotos() {
    if (!isAdmin) return;

    const photos = await loadPhotosForExport({ exported: true });

    if (!photos.length) {
      setExportMessage('Nėra perkeltų nuotraukų, kurias būtų galima ištrinti iš Storage.', 'warning');
      return;
    }

    const confirmed = confirm(
      `Bus ištrinta ${photos.length} nuotraukų iš Supabase Storage.\n\n` +
      'Prieš tęsiant įsitikink, kad jos jau įkeltos į SharePoint. Tęsti?'
    );

    if (!confirmed) return;

    setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], true);
    setExportMessage('Trinama iš Supabase Storage...', 'info');

    try {
      const filePaths = photos.map(photo => photo.file_path).filter(Boolean);

      for (const pathsChunk of chunkArray(filePaths, 100)) {
        const { error } = await supabase
          .storage
          .from(DEFECT_PHOTOS_BUCKET)
          .remove(pathsChunk);

        if (error) throw error;
      }

      for (const idsChunk of chunkArray(photos.map(photo => photo.id), 100)) {
        const { error } = await supabase
          .from('defect_photos')
          .update({
            deleted_after_export: true,
            deleted_after_export_at: new Date().toISOString()
          })
          .in('id', idsChunk);

        if (error) throw error;
      }

      setExportMessage('Perkeltos nuotraukos ištrintos iš Supabase Storage.', 'success');

    } catch (err) {
      console.error('Delete exported photos error:', err);
      setExportMessage(err?.message || 'Nepavyko ištrinti nuotraukų iš Storage.', 'error');

    } finally {
      setButtonsDisabled([refreshDefectPhotosExportBtn, downloadDefectPhotosZipBtn, markLastDefectPhotosExportedBtn, deleteExportedDefectPhotosBtn], false);
      await updateDefectPhotosExportStats();
    }
  }

  if (isAdmin) {
    refreshDefectPhotosExportBtn?.addEventListener('click', updateDefectPhotosExportStats);
    downloadDefectPhotosZipBtn?.addEventListener('click', downloadDefectPhotosZip);
    markLastDefectPhotosExportedBtn?.addEventListener('click', markLastDefectPhotosExported);
    deleteExportedDefectPhotosBtn?.addEventListener('click', deleteExportedDefectPhotos);

    await updateDefectPhotosExportStats();
  }
}