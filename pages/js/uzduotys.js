import { t } from '../../i18n.js';

export async function initUzduotys({ supabase, user, profile } = {}) {
  const tx = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const table = document.getElementById('taskTable');
  const instrSelect = document.getElementById('taskInstr');
  const instrLangSelect = document.getElementById('taskInstrLang');
  const taskTypeSelect = document.getElementById('taskType');
  const createBlock = document.getElementById('taskCreateBlock');

  const filterSearch = document.getElementById('filterSearch');
  const filterStatus = document.getElementById('filterStatus');
  const filterUserSearch = document.getElementById('filterUserSearch');
  const filterUserList = document.getElementById('filterUserList');
  const filterUserWrap = document.getElementById('filterUserWrap');
  const filterInstr = document.getElementById('filterInstr');

  const taskBulkActions = document.getElementById('taskBulkActions');
  const selectedTasksCount = document.getElementById('selectedTasksCount');
  const deleteSelectedTasksBtn = document.getElementById('deleteSelectedTasks');
  const selectAllTasks = document.getElementById('selectAllTasks');
  const taskStats = document.getElementById('taskStats');
  const pendingTestsCount = document.getElementById('pendingTestsCount');
  const pendingConfirmsCount = document.getElementById('pendingConfirmsCount');

  const instructionModal = document.getElementById('instructionModal');
  const instructionModalTitle = document.getElementById('instructionModalTitle');
  const instructionModalBody = document.getElementById('instructionModalBody');
  const instructionModalFooter = document.getElementById('instructionModalFooter');
  const closeInstructionModal = document.getElementById('closeInstructionModal');

  if (!table || !supabase || !user || !profile) return;

  if (profile.is_active === false) {
    table.innerHTML = `
      <tr>
        <td colspan="5" class="p-4 text-red-400">
          ${tx('auth.disabled', 'Paskyra išjungta.')}
        </td>
      </tr>
    `;
    return;
  }

  const currentUser = user;
  const role = profile.role || 'driver';

  const transportMode =
    profile?.effective_transport_mode ||
    profile?.app_transport_mode ||
    profile?.transport_mode ||
    window.getAppTransportMode?.() ||
    'car_transporter';

  const isTruckMode = transportMode === 'truck';
  const isDriverRole =
    role === 'driver' ||
    role === 'truck_driver' ||
    role === 'master_driver' ||
    role === 'truck_master_driver'; 

  const driverRolesForMode = isTruckMode
    ? ['truck_driver', 'truck_master_driver']
    : ['driver', 'master_driver'];

  const assignableDriverRole = isTruckMode ? 'truck_driver' : 'driver';

  const canCreate =
    role === 'admin' ||
    role === 'instructor' ||
    role === 'truck_instructor';

  const canApprove =
    role === 'admin' ||
    role === 'instructor' ||
    role === 'truck_instructor';

  if (createBlock) createBlock.classList.toggle('hidden', !canCreate);
  if (filterUserWrap) filterUserWrap.classList.toggle('hidden', isDriverRole);

  document.querySelectorAll('.assigned-col').forEach(el => {
    el.classList.toggle('hidden', isDriverRole);
  });

  if (taskStats) {
    taskStats.classList.toggle('hidden', !canApprove);
  }

  document.querySelectorAll('.task-bulk-col').forEach(el => {
    el.classList.toggle('hidden', role !== 'admin');
  });

  if (taskBulkActions) {
    taskBulkActions.classList.toggle('hidden', role !== 'admin');
  }
  let drivers = [];
  let groups = [];
  let groupMembers = [];
  let instructions = [];
  let tasks = [];
  let selectedTaskIds = new Set();

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showModal({ title = tx('common.message', 'Pranešimas'), message = '', type = 'info' }) {
    document.getElementById('appModal')?.remove();

    const icon =
      type === 'success' ? '✅' :
      type === 'error' ? '⚠️' :
      type === 'warning' ? '⚠️' :
      'ℹ️';

    const colorClass =
      type === 'success' ? 'text-green-400' :
      type === 'error' ? 'text-red-400' :
      type === 'warning' ? 'text-orange-400' :
      'text-blue-400';

    const modal = document.createElement('div');
    modal.id = 'appModal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-white">
        <div class="flex items-start gap-4">
          <div class="text-3xl ${colorClass}">${icon}</div>
          <div class="flex-1">
            <h3 class="text-xl font-semibold mb-2">${escapeHtml(title)}</h3>
            <div class="text-slate-300 whitespace-pre-line leading-relaxed">${escapeHtml(message)}</div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            id="appModalClose"
            class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl font-semibold"
          >
            ${tx('common.ok', 'Gerai')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('appModalClose')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', event => {
      if (event.target === modal) modal.remove();
    });
  }

  function confirmModal({
    title = tx('common.confirmation', 'Patvirtinimas'),
    message = '',
    confirmText = tx('tasks.approve', 'Patvirtinti'),
    cancelText = tx('tasks.cancel', 'Atsaukti'),
    type = 'warning'
  }) {
    return new Promise(resolve => {
      document.getElementById('confirmModal')?.remove();

      const icon =
        type === 'danger' ? '⚠️' :
        type === 'success' ? '✅' :
        'ℹ️';

      const iconClass =
        type === 'danger' ? 'text-red-400' :
        type === 'success' ? 'text-green-400' :
        'text-orange-400';

      const confirmClass =
        type === 'danger'
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-blue-600 hover:bg-blue-700';

      const modal = document.createElement('div');
      modal.id = 'confirmModal';
      modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4';

      modal.innerHTML = `
        <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-white">
          <div class="flex items-start gap-4">
            <div class="text-3xl ${iconClass}">${icon}</div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">${escapeHtml(title)}</h3>
              <div class="text-slate-300 whitespace-pre-line leading-relaxed">${escapeHtml(message)}</div>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              id="confirmCancel"
              class="bg-slate-700 hover:bg-slate-600 px-5 py-2 rounded-xl font-semibold"
            >
              ${escapeHtml(cancelText)}
            </button>

            <button
              id="confirmOk"
              class="${confirmClass} px-5 py-2 rounded-xl font-semibold"
            >
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      function close(value) {
        modal.remove();
        resolve(value);
      }

      document.getElementById('confirmCancel')?.addEventListener('click', () => close(false));
      document.getElementById('confirmOk')?.addEventListener('click', () => close(true));

      modal.addEventListener('click', event => {
        if (event.target === modal) close(false);
      });
    });
  }

  function approveTestModal({ score = '', comment = '' } = {}) {
    return new Promise(resolve => {
      document.getElementById('approveTestModal')?.remove();

      const modal = document.createElement('div');
      modal.id = 'approveTestModal';
      modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4';

      modal.innerHTML = `
        <div class="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-white">
          <div class="flex items-start gap-4 mb-5">
            <div class="text-3xl text-orange-400">📝</div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold mb-2">${tx('tasks.approve_test', 'Patvirtinti testą')}</h3>
              <p class="text-slate-300 leading-relaxed">
                ${tx('tasks.approve_test_help', 'Įvesk įvertinimą ir komentarą. Uždarius langą arba paspaudus „Atšaukti“, testas nebus patvirtintas.')}
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm text-slate-400 mb-1">${tx('tasks.score', 'Įvertinimas')}</label>
              <input
                id="approveScore"
                class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                value="${escapeHtml(score)}"
                placeholder="${tx('tasks.score_placeholder', 'Pvz. 10/10 arba 85%')}"
              >
            </div>

            <div>
              <label class="block text-sm text-slate-400 mb-1">
                ${tx('tasks.instructor_comment', 'Instruktoriaus komentaras')}
              </label>
              <textarea
                id="approveComment"
                class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white min-h-[100px]"
                placeholder="${tx('tasks.comment_optional', 'Komentaras nebūtinas')}"
              >${escapeHtml(comment)}</textarea>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              id="approveCancel"
              class="bg-slate-700 hover:bg-slate-600 px-5 py-2 rounded-xl font-semibold"
            >
              ${tx('tasks.cancel', 'Atsaukti')}
            </button>

            <button
              id="approveOk"
              class="bg-green-600 hover:bg-green-700 px-5 py-2 rounded-xl font-semibold"
            >
              ${tx('tasks.approve', 'Patvirtinti')}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const scoreInput = document.getElementById('approveScore');
      const commentInput = document.getElementById('approveComment');

      setTimeout(() => scoreInput?.focus(), 0);

      function close(value) {
        modal.remove();
        resolve(value);
      }

      document.getElementById('approveCancel')?.addEventListener('click', () => close(null));

      document.getElementById('approveOk')?.addEventListener('click', () => {
        close({
          score: scoreInput?.value?.trim() || '',
          comment: commentInput?.value?.trim() || ''
        });
      });

      modal.addEventListener('click', event => {
        if (event.target === modal) close(null);
      });
    });
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

  function normalizeTask(row) {
    const instruction = instructions.find(item => item.id === row.instruction_id);
    const driver = drivers.find(item => item.id === row.driver_id);

    return {
      id: row.id,
      title: row.title || '',
      desc: row.description || '',
      status: row.status || 'pending',
      done: row.status === 'done',
      driverId: row.driver_id,
      userId: row.driver_id,
      userLabel: driver?.full_name || driver?.email || '-',
      instructionId: row.instruction_id,
      instrId: row.instruction_id,
      taskType: row.task_type || 'standard',
      transport_mode: row.transport_mode || 'car_transporter',
      relatedTable: row.related_table || null,
      relatedId: row.related_id || null,
      groupId: row.group_id || null,
      createdBy: row.created_by,
      createdAt: row.created_at,
      dueAt: row.due_at,
      testSubmittedAt: row.test_submitted_at,
      approvedAt: row.approved_at,
      approvedBy: row.approved_by,
      completionType: row.completion_type,
      score: row.score || '',
      instructorComment: row.instructor_comment || '',
      instruction
    };
  }

  function getInstructionById(id) {
    return instructions.find(item => String(item.id) === String(id)) || null;
  }

  async function loadDrivers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, lang, is_active, transport_mode, created_at')
      .in('role', driverRolesForMode)
      .eq('transport_mode', transportMode)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Drivers load error:', error);
      drivers = [];
      return;
    }

    drivers = data || [];
  }

  async function loadGroups() {
    const { data: groupsData, error: groupsError } = await supabase
      .from('driver_groups')
      .select('id, name, created_by, created_at')
      .order('name', { ascending: true });

    if (groupsError) {
      console.error('Groups load error:', groupsError);
      groups = [];
      groupMembers = [];
      return;
    }

    const { data: membersData, error: membersError } = await supabase
      .from('driver_group_members')
      .select('group_id, driver_id, added_at');

    if (membersError) {
      console.error('Group members load error:', membersError);
      groupMembers = [];
    } else {
      groupMembers = membersData || [];
    }

    const allowedDriverIds = new Set(drivers.map(driver => driver.id));

    groups = (groupsData || [])
      .map(group => ({
        ...group,
        driverIds: groupMembers
          .filter(member => member.group_id === group.id && allowedDriverIds.has(member.driver_id))
          .map(member => member.driver_id)
      }))
      .filter(group => group.driverIds.length > 0);
  }

  async function loadInstructions() {
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
  }

  async function loadTasks() {
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('transport_mode', transportMode)
      .order('created_at', { ascending: false });

    if (isDriverRole) {
      query = query.eq('driver_id', currentUser.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Tasks load error:', error);
      tasks = [];
      table.innerHTML = `
        <tr>
          <td colspan="${isDriverRole ? 4 : 5}" class="p-4 text-red-400">
            ${tx('tasks.load_error', 'Nepavyko užkrauti užduočių.')}
          </td>
        </tr>
      `;
      return;
    }

    tasks = (data || []).map(normalizeTask);
  }

  async function reloadAll() {
    await loadDrivers();
    await loadGroups();
    await loadInstructions();
    await loadTasks();

    fillTaskUsers();
    fillTaskInstructionOptions();
    fillDriverFilterSuggestions();
    initFilters();
    render();
  }

  function getEmbedUrl(videoValue) {
    const value = String(videoValue || '').trim();
    if (!value) return '';

    if (/player\.vimeo\.com\/video\/(\d+)/i.test(value)) {
      return value;
    }

    const vimeoMatch = value.match(/vimeo\.com\/(\d+)/i) || value.match(/^(\d+)$/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    const ytMatch =
      value.match(/youtube\.com\/watch\?v=([^&]+)/i) ||
      value.match(/youtu\.be\/([^?&]+)/i) ||
      value.match(/youtube\.com\/embed\/([^?&]+)/i);

    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }

    const driveMatch =
      value.match(/drive\.google\.com\/file\/d\/([^/]+)/i) ||
      value.match(/[?&]id=([^&]+)/i);

    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return '';
  }

  function getSelectedInstructionLang() {
    const instrId = instrSelect?.value || '';
    const selectedInstr = getInstructionById(instrId);

    return String(
      selectedInstr?.lang ||
      instrLangSelect?.value ||
      profile.lang ||
      localStorage.getItem('lang') ||
      'lt'
    ).toLowerCase();
  }

  function getLanguageFilteredDrivers() {
    const selectedLang = getSelectedInstructionLang();

    return drivers.filter(driver => {
      if (driver.role !== assignableDriverRole) return false;
      return String(driver.lang || '').toLowerCase() === selectedLang;
    });
  }

  function getSelectedTaskUserValues() {
    const select = document.getElementById('taskUser');
    if (!select) return ['all'];

    const values = Array.from(select.selectedOptions || [])
      .map(option => option.value)
      .filter(Boolean);

    return values.length ? values : ['all'];
  }


  function ensureDriverPickerStyles() {
    if (document.getElementById('taskDriverPickerStyles')) return;

    const style = document.createElement('style');
    style.id = 'taskDriverPickerStyles';
    style.textContent = `
      .task-driver-picker {
        position: relative;
        width: 100%;
      }

      .task-driver-picker-toggle {
        width: 100%;
        min-height: 56px;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(71, 85, 105, 0.9);
        background: #1e293b;
        color: #fff;
        text-align: left;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 15px;
        cursor: pointer;
      }

      .task-driver-picker-toggle:hover {
        background: #263449;
      }

      .task-driver-picker-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .task-driver-picker-arrow {
        flex-shrink: 0;
        opacity: 0.8;
      }

      .task-driver-picker-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        z-index: 9999;
        background: #0f172a;
        border: 1px solid rgba(71, 85, 105, 0.95);
        border-radius: 16px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45);
        padding: 10px;
        min-width: 320px;
      }

      .task-driver-picker-menu.hidden {
        display: none;
      }

      .task-driver-picker-search {
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 10px;
        border-radius: 12px;
        border: 1px solid rgba(71, 85, 105, 0.95);
        background: #1e293b;
        color: #fff;
        outline: none;
      }

      .task-driver-picker-search::placeholder {
        color: #94a3b8;
      }

      .task-driver-picker-options {
        max-height: 280px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-right: 2px;
      }

      .task-driver-picker-option {
        padding: 8px 10px;
        border-radius: 10px;
        background: rgba(30, 41, 59, 0.75);
      }

      .task-driver-picker-option:hover {
        background: rgba(51, 65, 85, 0.95);
      }

      .task-driver-picker-option label {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #fff;
        cursor: pointer;
        font-size: 14px;
        line-height: 1.25;
      }

      .task-driver-picker-option input[type="checkbox"] {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        accent-color: #3b82f6;
      }

      .task-driver-picker-option-all {
        border-bottom: 1px solid rgba(71, 85, 105, 0.55);
        margin-bottom: 6px;
        padding-bottom: 10px;
      }

      .task-driver-picker-empty {
        color: #94a3b8;
        padding: 10px;
        font-size: 14px;
      }
    `;

    document.head.appendChild(style);
  }

  function ensureDriverPickerUi() {
    const select = document.getElementById('taskUser');
    if (!select) return null;

    ensureDriverPickerStyles();

    let picker = document.getElementById('taskDriverPicker');

    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'taskDriverPicker';
      picker.className = 'task-driver-picker';

      picker.innerHTML = `
        <button type="button" class="task-driver-picker-toggle" id="taskDriverPickerToggle">
          <span class="task-driver-picker-label" id="taskDriverPickerLabel">Visiems pagal instr. kalba</span>
          <span class="task-driver-picker-arrow">v</span>
        </button>

        <div class="task-driver-picker-menu hidden" id="taskDriverPickerMenu">
          <input
            type="text"
            class="task-driver-picker-search"
            id="taskDriverPickerSearch"
            placeholder="Ieskoti vairuotojo..." autocomplete="off"
          >

          <div class="task-driver-picker-options" id="taskDriverPickerOptions"></div>
        </div>
      `;

      select.insertAdjacentElement('afterend', picker);
    }

    select.style.display = 'none';

    return picker;
  }

  function getTaskUserSelect() {
    return document.getElementById('taskUser');
  }

  function getDriverPickerSelectedValues() {
    const select = getTaskUserSelect();
    if (!select) return ['all'];

    const values = Array.from(select.selectedOptions || [])
      .map(option => option.value)
      .filter(Boolean);

    return values.length ? values : ['all'];
  }

  function setDriverPickerSelectedValues(values) {
    const select = getTaskUserSelect();
    if (!select) return;

    const valueSet = new Set(values.map(value => String(value)));

    Array.from(select.options).forEach(option => {
      option.selected = valueSet.has(String(option.value));
    });
  }

  function getDriverPickerOptionsForRender() {
    const select = getTaskUserSelect();
    if (!select) return [];

    return Array.from(select.options || [])
      .map(option => ({
        value: String(option.value || ''),
        label: String(option.textContent || '').trim()
      }))
      .filter(option => option.value && option.value !== 'none');
  }

  function updateDriverPickerLabel() {
    const label = document.getElementById('taskDriverPickerLabel');
    if (!label) return;

    const values = getDriverPickerSelectedValues();
    const options = getDriverPickerOptionsForRender();

    if (!values.length || values.includes('all')) {
      label.textContent = 'Visiems pagal instr. kalba';
      return;
    }

    const selectedOptions = options.filter(option => values.includes(option.value));

    if (selectedOptions.length === 1) {
      label.textContent = selectedOptions[0].label;
      return;
    }

    label.textContent = `Pasirinkta: ${selectedOptions.length}`;
  }

  function renderDriverPicker() {
    const select = getTaskUserSelect();
    const picker = ensureDriverPickerUi();

    if (!select || !picker) return;

    const taskType = taskTypeSelect?.value || 'standard';

    if (taskType === 'loading_scheme' || select.disabled) {
      picker.classList.add('hidden');
      return;
    }

    picker.classList.remove('hidden');

    const searchInput = document.getElementById('taskDriverPickerSearch');
    const optionsBox = document.getElementById('taskDriverPickerOptions');
    if (!optionsBox) return;

    const search = String(searchInput?.value || '').trim().toLowerCase();
    const selectedValues = getDriverPickerSelectedValues();
    const options = getDriverPickerOptionsForRender();

    const filteredOptions = options.filter(option => {
      if (option.value === 'all') return true;
      return !search || option.label.toLowerCase().includes(search);
    });

    if (!filteredOptions.length) {
      optionsBox.innerHTML = `<div class="task-driver-picker-empty">Vairuotoju nerasta</div>`;
      updateDriverPickerLabel();
      return;
    }

    optionsBox.innerHTML = filteredOptions.map(option => {
      const isAll = option.value === 'all';
      const checked = selectedValues.includes(option.value) || (isAll && selectedValues.includes('all'));

      return `
        <div class="task-driver-picker-option ${isAll ? 'task-driver-picker-option-all' : ''}">
          <label>
            <input
              type="checkbox"
              class="task-driver-picker-checkbox"
              data-value="${escapeHtml(option.value)}"
              ${checked ? 'checked' : ''}
            >
            <span>${escapeHtml(option.label)}</span>
          </label>
        </div>
      `;
    }).join('');

    updateDriverPickerLabel();
  }

  function closeDriverPicker() {
    document.getElementById('taskDriverPickerMenu')?.classList.add('hidden');
  }

  function toggleDriverPicker() {
    const menu = document.getElementById('taskDriverPickerMenu');
    if (!menu) return;

    menu.classList.toggle('hidden');

    if (!menu.classList.contains('hidden')) {
      setTimeout(() => document.getElementById('taskDriverPickerSearch')?.focus(), 50);
    }
  }

  document.addEventListener('click', event => {
    const toggle = event.target.closest('#taskDriverPickerToggle');
    const picker = event.target.closest('#taskDriverPicker');

    if (toggle) {
      toggleDriverPicker();
      return;
    }

    if (!picker) {
      closeDriverPicker();
    }
  });

  document.addEventListener('input', event => {
    if (event.target?.id === 'taskDriverPickerSearch') {
      renderDriverPicker();
    }
  });

  document.addEventListener('change', event => {
    const checkbox = event.target.closest('.task-driver-picker-checkbox');
    if (!checkbox) return;

    const value = String(checkbox.dataset.value || '');
    const currentValues = getDriverPickerSelectedValues().filter(item => item !== 'all');
    const selected = new Set(currentValues);

    if (value === 'all') {
      setDriverPickerSelectedValues(['all']);
      renderDriverPicker();
      return;
    }

    if (checkbox.checked) {
      selected.add(value);
    } else {
      selected.delete(value);
    }

    const newValues = selected.size ? Array.from(selected) : ['all'];
    setDriverPickerSelectedValues(newValues);
    renderDriverPicker();
  });

  function fillTaskUsers() {
    const select = document.getElementById('taskUser');
    if (!select) return;

    if (!canCreate) {
      select.innerHTML = '';
      renderDriverPicker();
      return;
    }

    const taskType = taskTypeSelect?.value || 'standard';
    const currentValues = getSelectedTaskUserValues();

    if (taskType === 'loading_scheme') {
      select.multiple = false;
      select.size = 1;
      select.innerHTML = `<option value="none">Neskiriama konkretiam vairuotojui</option>`;
      select.value = 'none';
      select.disabled = true;
      renderDriverPicker();
      return;
    }

    select.disabled = false;
    select.multiple = true;
    select.size = 6;

    const normalDrivers = getLanguageFilteredDrivers();

    select.innerHTML =
      `<option value="all">Visiems pagal instrukcijos kalba</option>` +
      groups.map(group => `<option value="group:${group.id}">š‘ ${escapeHtml(group.name)}</option>`).join('') +
      normalDrivers.map(driver => `<option value="${driver.id}">${escapeHtml(driver.full_name || driver.email)} (${escapeHtml(driver.lang || '-')})</option>`).join('');

    const validValues = new Set(Array.from(select.options).map(option => option.value));
    const restoredValues = currentValues.filter(value => validValues.has(value));
    const valuesToSelect = restoredValues.length ? restoredValues : ['all'];

    Array.from(select.options).forEach(option => {
      option.selected = valuesToSelect.includes(option.value);
    });

    renderDriverPicker();
  }
    function fillTaskInstructionOptions() {
    if (!instrSelect) return;

    const taskType = taskTypeSelect?.value || 'standard';

    if (taskType === 'loading_scheme') {
      if (instrLangSelect) instrLangSelect.disabled = true;
      instrSelect.disabled = true;
      instrSelect.innerHTML = `<option value="">Instrukcija nereikalinga</option>`;
      return;
    }

    if (instrLangSelect) instrLangSelect.disabled = false;
    instrSelect.disabled = false;

    const selectedLang = instrLangSelect?.value || profile.lang || localStorage.getItem('lang') || 'lt';

    instrSelect.innerHTML =
      `<option value="">${tx('common.select_instruction', 'Pasirink instrukcija')}</option>` +
      instructions
        .filter(item => item.lang === selectedLang && item.transport_mode === transportMode)
        .map(item => `<option value="${item.id}">${escapeHtml(item.title)}</option>`)
        .join('');
  }

  function fillDriverFilterSuggestions() {
    if (!filterUserList) return;

    filterUserList.innerHTML = drivers.map(driver => `
      <option value="${escapeHtml(driver.full_name || driver.email)}"></option>
    `).join('');
  }

  function initFilters() {
    if (!filterInstr) return;

    const instrMap = new Map();

    tasks.forEach(task => {
      const instr = getInstructionById(task.instrId);
      if (instr) instrMap.set(instr.id, instr.title);
    });

    filterInstr.innerHTML =
      `<option value="all">Visiems pagal instrukcijos kalba</option>` +
      [...instrMap.entries()].map(([id, title]) => `<option value="${id}">${escapeHtml(title)}</option>`).join('');
  }

  function getTaskStatusInfo(task) {
    if (task.taskType === 'truck_acceptance_review') {
      return {
        label: task.status === 'done'
          ? tx('tasks.done', 'Įvykdyta')
          : 'Vilkiko priėmimas',
        className: task.status === 'done' ? 'bg-green-600' : 'bg-yellow-600'
      };
    }

    if (task.taskType === 'loading_scheme') {
      return {
        label: task.status === 'done'
          ? tx('tasks.done', 'Įvykdyta')
          : 'Krovimo schema',
        className: task.status === 'done' ? 'bg-green-600' : 'bg-blue-600'
      };
    }

    const instruction = getInstructionById(task.instrId);
    const done = task.status === 'done';

    if (done) {
      return {
        label: tx('tasks.done', 'Įvykdyta'),
        className: 'bg-green-600'
      };
    }

    if (instruction?.test && task.testSubmittedAt) {
      return {
        label: tx('tasks.needs_approval', 'Reikia patvirtinti'),
        className: 'bg-orange-600'
      };
    }

    return {
      label: tx('tasks.waiting', 'Laukiama'),
      className: 'bg-yellow-600'
    };
  }

  function getFilteredTasks() {
    const search = (filterSearch?.value || '').toLowerCase().trim();
    const status = filterStatus?.value || 'all';
    const userSearch = (filterUserSearch?.value || '').toLowerCase().trim();
    const instr = filterInstr?.value || 'all';

    return tasks.filter(task => {
      if ((task.transport_mode || 'car_transporter') !== transportMode) {
        return false;
      }

      const instruction = getInstructionById(task.instrId);
      const isDone = task.status === 'done';
      const needsApproval = Boolean(instruction?.test && task.testSubmittedAt && !isDone);

      const statusOk =
        status === 'all' ||
        (status === 'done' && isDone) ||
        (status === 'completed' && isDone) ||
        (status === 'pending' && !isDone) ||
        (status === 'approval' && needsApproval);

      return (
        (!search || task.title.toLowerCase().includes(search) || (task.desc || '').toLowerCase().includes(search)) &&
        statusOk &&
        (isDriverRole || !userSearch || (task.userLabel || '').toLowerCase().includes(userSearch)) &&
        (instr === 'all' || String(task.instrId) === String(instr))
      );
    });
  }

  function updateStats() {
    if (!canApprove) return;

    const pendingTests = tasks.filter(task => {
      if (task.taskType === 'loading_scheme') return false;
      if (task.taskType === 'truck_acceptance_review') return false;

      const instr = getInstructionById(task.instrId);
      return Boolean(instr?.test) && task.testSubmittedAt && task.status !== 'done';
    }).length;

    const pendingConfirms = tasks.filter(task => {
      if (task.taskType === 'loading_scheme') return false;
      if (task.taskType === 'truck_acceptance_review') return task.status !== 'done';

      const instr = getInstructionById(task.instrId);
      return !instr?.test && task.status !== 'done';
    }).length;

    if (pendingTestsCount) pendingTestsCount.textContent = String(pendingTests);
    if (pendingConfirmsCount) pendingConfirmsCount.textContent = String(pendingConfirms);
  }

  async function writeTrainingRegister(task, completionType, score = '', instructorComment = '') {
    if (!task.driverId || !task.instrId) return;

    const row = {
      task_id: task.id,
      driver_id: task.driverId,
      instruction_id: task.instrId,
      completed_at: new Date().toISOString(),
      completion_type: completionType,
      score: score || null,
      instructor_comment: instructorComment || null,
      approved_by: canApprove ? currentUser.id : null
    };

    const { error } = await supabase
      .from('training_register')
      .upsert(row, { onConflict: 'task_id' });

    if (error) {
      console.error('Training register write error:', error);
    }
  }

  async function deleteTrainingRegister(taskId) {
    const { error } = await supabase
      .from('training_register')
      .delete()
      .eq('task_id', taskId);

    if (error) {
      console.error('Training register delete error:', error);
    }
  }

  function renderInstructionContent(instr) {
    if (!instr) return tx('common.no_instructions', 'Nėra instrukcijų');

    let html = `<div class="text-base leading-8">${escapeHtml(instr.description || '')}</div>`;

    const embedUrl = getEmbedUrl(instr.video);
    if (embedUrl) {
      html += `
        <div class="relative w-full pb-[56.25%] mt-6">
          <iframe
            class="absolute top-0 left-0 w-full h-full rounded"
            src="${escapeHtml(embedUrl)}"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    if (instr.pdf) {
      html += `
        <button onclick="window.open('${escapeHtml(instr.pdf)}')"
          class="mt-4 bg-slate-700 px-4 py-2 rounded">
          ${tx('common.cheat_sheet', 'Cheat sheet')}
        </button>
      `;
    }

    if (instr.load || instr.unload) {
      html += `<div class="text-slate-400 mt-4">📍 ${escapeHtml(instr.load || '')} → ${escapeHtml(instr.unload || '')}</div>`;
    }

    if (instr.avoid) {
      html += `<div class="mt-4"><b>${tx('common.avoid', 'Kaip išvengti:')}</b><br>${escapeHtml(instr.avoid)}</div>`;
    }

    if (instr.link) {
      html += `
        <a href="${escapeHtml(instr.link)}" target="_blank"
          class="mt-4 block bg-blue-600 p-2 text-center rounded">
          ${tx('common.open_link', 'Atidaryti nuorodą')}
        </a>
      `;
    }

    return html;
  }

  function closeTaskModal() {
    if (window.taskModalTimer) {
      clearTimeout(window.taskModalTimer);
      window.taskModalTimer = null;
    }

    instructionModal?.classList.add('hidden');
  }

  function openTaskImageViewer(url, title = '') {
    if (!url) return;

    document.getElementById('taskImageViewer')?.remove();

    const viewer = document.createElement('div');
    viewer.id = 'taskImageViewer';
    viewer.className = 'fixed inset-0 z-[10050] bg-black/90 flex items-center justify-center p-4';
    viewer.innerHTML = `
      <div class="relative max-w-6xl w-full max-h-[94vh] flex flex-col items-center">
        <button
          type="button"
          class="task-image-close fixed top-4 right-4 z-[10060] bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full w-12 h-12 text-2xl"
        >
          ×
        </button>

        <img src="${escapeHtml(url)}" class="max-w-full max-h-[86vh] object-contain rounded-xl" alt="">

        ${title ? `<div class="mt-3 text-slate-300 text-sm">${escapeHtml(title)}</div>` : ''}

        <div class="mt-2 text-slate-500 text-xs">
          ${escapeHtml(tx('loading_schemes.close_photo_hint', 'Uždaryti: X arba paspauskite tamsų foną'))}
        </div>
      </div>
    `;

    document.body.appendChild(viewer);

    viewer.addEventListener('click', event => {
      if (event.target === viewer || event.target.closest('.task-image-close')) {
        viewer.remove();
      }
    });
  }

  function getLoadingSchemePhotoUrl(filePath) {
    const { data } = supabase
      .storage
      .from('loading-scheme-photos')
      .getPublicUrl(filePath);

    return data?.publicUrl || '';
  }

  function getTruckAcceptancePhotoUrl(filePath) {
    const { data } = supabase
      .storage
      .from('truck-acceptance-photos')
      .getPublicUrl(filePath);

    return data?.publicUrl || '';
  }

  function getSchemeTitle(cars) {
    const first = cars?.[0];

    if (!first) {
      return 'Schema';
    }

    const make = String(first.car_make || '').trim();
    const model = String(first.car_model || '').trim();
    const count = Number(first.car_count || 0);

    return `Schema ${[make, model].filter(Boolean).join(' ')}${count ? ` - ${count} vnt` : ''}`;
  }

  function buildLoadingSchemeHtml(scheme, cars, photos) {
    const photoLabels = {
      truck_side_required: tx('loading_schemes.photo_truck_side', 'Autovežis iš šono'),
      trailer_side_required: tx('loading_schemes.photo_trailer_side', 'Priekaba iš šono'),
      full_carrier_side_required: tx('loading_schemes.photo_full_side', 'Visas autovežis iš šono'),
      extra_1: tx('loading_schemes.extra_1', 'Papildoma 1'),
      extra_2: tx('loading_schemes.extra_2', 'Papildoma 2'),
      extra_3: tx('loading_schemes.extra_3', 'Papildoma 3')
    };

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${tx('loading_schemes.loading_place', 'Pasikrovimas')}</div>
            <div class="font-semibold">${escapeHtml(scheme.loading_place || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${tx('loading_schemes.unloading_place', 'Išsikrovimas')}</div>
            <div class="font-semibold">${escapeHtml(scheme.destination || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${tx('loading_schemes.carrier_type', 'Autovežio tipas')}</div>
            <div class="font-semibold">${escapeHtml(scheme.carrier_type || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${tx('loading_schemes.status', 'Statusas')}</div>
            <div class="font-semibold">${escapeHtml(scheme.status || '-')}</div>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-2">${tx('loading_schemes.cars', 'Automobiliai')}</div>
          <div class="space-y-2">
            ${(cars || []).map(car => `
              <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
                ${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.
              </div>
            `).join('') || `<div class="text-slate-500">${tx('loading_schemes.no_cars', 'Automobilių nėra')}</div>`}
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">${tx('loading_schemes.scheme_description', 'Schemos aprašymas')}</div>
          <div class="whitespace-pre-line">${escapeHtml(scheme.scheme_description || '-')}</div>
        </div>

        ${scheme.master_driver_comment ? `
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400 text-sm mb-1">${tx('loading_schemes.master_comment', 'Master Driver komentaras')}</div>
            <div class="whitespace-pre-line">${escapeHtml(scheme.master_driver_comment)}</div>
          </div>
        ` : ''}

        ${scheme.instructor_comment ? `
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400 text-sm mb-1">${tx('loading_schemes.instructor_comment', 'Instruktoriaus komentaras')}</div>
            <div class="whitespace-pre-line">${escapeHtml(scheme.instructor_comment)}</div>
          </div>
        ` : ''}

        <div>
          <div class="text-slate-400 text-sm mb-2">${tx('loading_schemes.photos', 'Nuotraukos')}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${(photos || []).map(photo => {
              const url = getLoadingSchemePhotoUrl(photo.file_path);
              const label = photoLabels[photo.category] || photo.category;

              return `
                <button
                  type="button"
                  class="task-photo-view block text-left bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
                  data-url="${escapeHtml(url)}"
                  data-title="${escapeHtml(label)}"
                >
                  <img src="${escapeHtml(url)}" class="w-full h-40 object-cover" alt="">
                  <div class="p-2 text-xs text-slate-400">${escapeHtml(label)}</div>
                </button>
              `;
            }).join('') || `<div class="text-slate-500">${tx('loading_schemes.no_photos', 'Nuotraukų nėra')}</div>`}
          </div>
        </div>
      </div>
    `;
  }
    async function markLoadingSchemeViewDone(task) {
  if (!isDriverRole) return false;
  if (!task?.id) return false;
  if (task.status === 'done') return true;

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'done'
    })
    .eq('id', task.id)
    .eq('driver_id', currentUser.id)
    .eq('task_type', 'loading_scheme')
    .eq('transport_mode', transportMode);

  if (error) {
    console.error('Loading scheme view completion error:', error);

    showModal({
      type: 'error',
      title: tx('tasks.update_error_title', 'Nepavyko atnaujinti'),
      message: error.message || tx('tasks.update_error_message', 'Nepavyko atnaujinti užduoties.')
    });

    return false;
  }

  await loadTasks();
  initFilters();
  render();

  window.addEventListener('tasksUpdated', async () => {
    await updateTasksBadge();
});
  return true;
}

  async function updateLoadingSchemeStatus(schemeId, status, comment = null) {
    const payload = {
      status,
      updated_at: new Date().toISOString()
    };

    if (comment !== null) payload.instructor_comment = comment;

    if (status === 'approved') {
      payload.approved_by = currentUser.id;
      payload.approved_at = new Date().toISOString();
    }

    const { data: schemeBeforeUpdate } = await supabase
      .from('loading_scheme_tasks')
      .select('source_task_id')
      .eq('id', schemeId)
      .eq('transport_mode', transportMode)
      .maybeSingle();

    const { error } = await supabase
      .from('loading_scheme_tasks')
      .update(payload)
      .eq('id', schemeId)
      .eq('transport_mode', transportMode);

    if (error) {
      console.error('Loading scheme status error:', error);
      showModal({
        type: 'error',
        title: 'Nepavyko atnaujinti',
        message: 'Nepavyko atnaujinti krovimo schemos statuso.'
      });
      return false;
    }

    if (status === 'approved' && schemeBeforeUpdate?.source_task_id) {
      await supabase
        .from('tasks')
        .update({
          status: 'done',
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id,
          completion_type: 'loading_scheme'
        })
        .eq('id', schemeBeforeUpdate.source_task_id)
        .eq('transport_mode', transportMode);
    }

    return true;
  }

  async function openLoadingSchemeModal(taskId) {
    if (!instructionModal || !instructionModalTitle || !instructionModalBody || !instructionModalFooter) return;

    const task = tasks.find(item => String(item.id) === String(taskId));
    if (!task) return;

    let schemeQuery = supabase
      .from('loading_scheme_tasks')
      .select('*')
      .eq('transport_mode', transportMode)
      .order('created_at', { ascending: false })
      .limit(1);

    if (task.relatedTable === 'loading_scheme_tasks' && task.relatedId) {
      schemeQuery = schemeQuery.eq('id', task.relatedId);
    } else {
      schemeQuery = schemeQuery.eq('source_task_id', taskId);
    }

    const { data: scheme, error } = await schemeQuery.maybeSingle();

    if (error) {
      console.error('Loading scheme load error:', error);
      showModal({
        type: 'error',
        title: 'Klaida',
        message: 'Nepavyko užkrauti krovimo schemos.'
      });
      return;
    }

    if (!scheme) {
      showModal({
        type: 'warning',
        title: 'Schema dar nepateikta',
        message: 'Šiai užduočiai dar nėra pateiktos krovimo schemos. Ji atsiras, kai Master Driver ją užpildys ir pateiks patvirtinimui.'
      });
      return;
    }

    const [{ data: cars }, { data: photos }] = await Promise.all([
      supabase
        .from('loading_scheme_cars')
        .select('*')
        .eq('scheme_id', scheme.id)
        .order('sort_order', { ascending: true }),

      supabase
        .from('loading_scheme_photos')
        .select('*')
        .eq('scheme_id', scheme.id)
        .order('created_at', { ascending: true })
    ]);

    instructionModalTitle.textContent = getSchemeTitle(cars || []);
    instructionModalBody.innerHTML = buildLoadingSchemeHtml(scheme, cars || [], photos || []);
    instructionModalFooter.innerHTML = '';

    if (isDriverRole && task.taskType === 'loading_scheme' && task.relatedTable === 'loading_scheme_tasks' && task.status !== 'done') {
      const waitText = document.createElement('div');
      waitText.className = 'text-slate-300';
      waitText.textContent = 'Užduotis bus pažymėta kaip įvykdyta po 5 s peržiūros.';
      instructionModalFooter.appendChild(waitText);

      window.taskModalTimer = setTimeout(async () => {
  const ok = await markLoadingSchemeViewDone(task);

  if (!ok) {
    waitText.textContent = tx('tasks.update_error_message', 'Nepavyko atnaujinti užduoties.');
    waitText.className = 'text-red-400';
    return;
  }

  waitText.textContent = tx('tasks.done', 'Įvykdyta');
  waitText.className = 'text-green-400';
}, 5000);
    }

    if (canApprove && ['waiting_approval', 'needs_changes', 'rejected'].includes(scheme.status)) {
      instructionModalFooter.innerHTML = `
        <button type="button" class="ls-approve bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl" data-id="${scheme.id}">
          ${tx('loading_schemes.approve', 'Patvirtinti')}
        </button>

        <button type="button" class="ls-change bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl" data-id="${scheme.id}">
          ${tx('loading_schemes.comment', 'Komentaras')}
        </button>

        <button type="button" class="ls-reject bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl" data-id="${scheme.id}">
          ${tx('loading_schemes.reject', 'Atmesti')}
        </button>
      `;
    }

    instructionModal.classList.remove('hidden');
  }

  async function updateTruckAcceptanceReviewStatus(task, status, comment = '', actions = {}) {
    const now = new Date().toISOString();

    const { error: reviewError } = await supabase
      .from('truck_acceptance_reviews')
      .update({
        status,
        instructor_comment: comment || null,
        action_driver_instruction: Boolean(actions.driver_instruction),
        action_service: Boolean(actions.service),
        action_bonus: Boolean(actions.bonus),
        action_no_action: Boolean(actions.no_action),
        action_car_wash: Boolean(actions.car_wash),
        action_inventory_needed: Boolean(actions.inventory_needed),
        action_work_clothes_needed: Boolean(actions.work_clothes_needed),
        action_other: Boolean(actions.other),
        action_other_text: actions.other_text || null,
        reviewed_by: currentUser.id,
        reviewed_at: now,
        updated_at: now
      })
      .eq('task_id', task.id);

    if (reviewError) {
      console.error('Truck acceptance review update error:', reviewError);

      showModal({
        type: 'error',
        title: 'Nepavyko atnaujinti',
        message: 'Nepavyko atnaujinti vilkiko priėmimo patvirtinimo.'
      });

      return false;
    }

    const taskPatch = {
      status: status === 'approved' ? 'done' : 'pending',
      approved_at: status === 'approved' ? now : null,
      approved_by: status === 'approved' ? currentUser.id : null,
      instructor_comment: comment || null
    };

    const { error: taskError } = await supabase
      .from('tasks')
      .update(taskPatch)
      .eq('id', task.id)
      .eq('transport_mode', transportMode);

    if (taskError) {
      console.error('Truck acceptance task update error:', taskError);

      showModal({
        type: 'error',
        title: 'Nepavyko atnaujinti',
        message: taskError.message || 'Ataskaita atnaujinta, bet nepavyko atnaujinti užduoties statuso.'
      });

      return false;
    }

    if (task.relatedId) {
      const { error: reportError } = await supabase
        .from('truck_acceptance_reports')
        .update({
          status,
          updated_at: now
        })
        .eq('id', task.relatedId)
        .eq('transport_mode', transportMode);

      if (reportError) {
        console.error('Truck acceptance report update error:', reportError);
      }
    }

    return true;
  }

  async function saveTruckAcceptanceDecision(task, status) {
    const comment = document.getElementById('truckAcceptanceComment')?.value?.trim() || '';

    const actions = {
      driver_instruction: document.getElementById('taActionDriverInstruction')?.checked || false,
      service: document.getElementById('taActionService')?.checked || false,
      bonus: document.getElementById('taActionBonus')?.checked || false,
      no_action: document.getElementById('taActionNoAction')?.checked || false,
      car_wash: document.getElementById('taActionCarWash')?.checked || false,
      inventory_needed: document.getElementById('taActionInventoryNeeded')?.checked || false,
      work_clothes_needed: document.getElementById('taActionWorkClothesNeeded')?.checked || false,
      other: document.getElementById('taActionOther')?.checked || false,
      other_text: document.getElementById('taActionOtherText')?.value?.trim() || ''
    };

    const ok = await updateTruckAcceptanceReviewStatus(task, status, comment, actions);

    if (ok) {
      await loadTasks();
      initFilters();
      render();

      showModal({
        type: 'success',
        title: 'Išsaugota',
        message: 'Vilkiko priėmimo sprendimas išsaugotas.'
      });
    }

    return ok;
  }

  async function openTruckAcceptanceModal(taskId) {
    const task = tasks.find(item => String(item.id) === String(taskId));

    if (!task) return;

    if (!instructionModal || !instructionModalTitle || !instructionModalBody || !instructionModalFooter) return;

    const reportId = task.relatedId;

    if (!reportId) {
      showModal({
        type: 'error',
        title: 'Nėra ataskaitos',
        message: 'Užduotis neturi susietos vilkiko priėmimo ataskaitos.'
      });
      return;
    }

    const [{ data: report, error: reportError }, { data: photos }, { data: review }] = await Promise.all([
      supabase
        .from('truck_acceptance_reports')
        .select('*')
        .eq('id', reportId)
        .eq('transport_mode', transportMode)
        .maybeSingle(),

      supabase
        .from('truck_acceptance_photos')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true }),

      supabase
        .from('truck_acceptance_reviews')
        .select('*')
        .eq('task_id', task.id)
        .maybeSingle()
    ]);

    if (reportError || !report) {
      console.error('Truck acceptance report load error:', reportError);
      showModal({
        type: 'error',
        title: 'Klaida',
        message: 'Nepavyko užkrauti vilkiko priėmimo ataskaitos.'
      });
      return;
    }

    const reportMode = report.transport_mode || transportMode || 'car_transporter';
    const isTruckReport = reportMode === 'truck';

    const trailerTypeLabel = isTruckReport
      ? tx('truck_acceptance.semi_trailer_type', 'Puspriekabės tipas')
      : tx('truck_acceptance.trailer_type', 'Autovežio tipas');

    const exteriorCleanlinessLabel = isTruckReport
      ? tx('truck_acceptance.truck_exterior_cleanliness', 'Vilkiko išorinė švara')
      : tx('truck_acceptance.exterior_cleanliness', 'Autovežio išorinė švara');

    const qualityLabels = {
      block: 'Blokas',
      warning: 'Įspėjimas',
      good: 'Gerai',
      excellent: 'Puikiai',
      damaged: 'Su pažeidimais',
      minor: 'Minimalūs pažeidimai',
      ok: 'Be pažeidimų',
      working: 'Veikia',
      not_working: 'Neveikia',
      damaged_lights: 'Pažeisti',

      Blokas: 'Blokas',
      Įspėjimas: 'Įspėjimas',
      Gerai: 'Gerai',
      Puikiai: 'Puikiai',
      'Su pažeidimais': 'Su pažeidimais',
      'Minimalūs pažeidimai': 'Minimalūs pažeidimai',
      'Be pažeidimų': 'Be pažeidimų',
      Veikia: 'Veikia',
      Neveikia: 'Neveikia',
      Pažeisti: 'Pažeisti'
    };

    function q(value) {
      return qualityLabels[value] || value || '-';
    }

    function pressure(value) {
      if (value === null || value === undefined || value === '') return '-';
      return `${value} bar`;
    }

    function qualityRow(label, value) {
      return `
        <div>${escapeHtml(label)}: <b>${escapeHtml(q(value))}</b></div>
      `;
    }

    const qualityRows = isTruckReport
      ? [
          qualityRow(
            tx('truck_acceptance.semi_trailer_condition', 'Puspriekabės būklė'),
            report.semi_trailer_condition
          ),
          qualityRow(
            tx('truck_acceptance.straps', 'Tvirtinimo diržai'),
            report.straps_condition
          ),
          qualityRow(
            tx('truck_acceptance.work_inventory', 'Kitas inventorius'),
            report.work_inventory_condition
          ),
          qualityRow(
            tx('truck_acceptance.fastening', 'Tvirtinimas'),
            report.fastening_condition
          ),
          qualityRow(
            exteriorCleanlinessLabel,
            report.truck_exterior_cleanliness
          ),
          qualityRow(
            tx('truck_acceptance.windshield', 'Priekinis stiklas'),
            report.windshield_condition
          ),
          qualityRow(
            tx('truck_acceptance.lights', 'Žibintai'),
            report.lights_condition
          )
        ].join('')
      : [
          qualityRow(
            tx('truck_acceptance.platform_condition', 'Platformos būklė'),
            report.platform_condition
          ),
          qualityRow(
            tx('truck_acceptance.platform_order', 'Tvarka ant platformos'),
            report.platform_order
          ),
          qualityRow(
            tx('truck_acceptance.safety_fences', 'Apsauginės tvoros'),
            report.safety_fences_condition
          ),
          qualityRow(
            tx('truck_acceptance.straps', 'Tvirtinimo diržai'),
            report.straps_condition
          ),
          qualityRow(
            tx('truck_acceptance.work_inventory', 'Kitas inventorius'),
            report.work_inventory_condition
          ),
          qualityRow(
            tx('truck_acceptance.fastening', 'Tvirtinimas'),
            report.fastening_condition
          ),
          qualityRow(
            exteriorCleanlinessLabel,
            report.exterior_cleanliness
          ),
          qualityRow(
            tx('truck_acceptance.windshield', 'Priekinis stiklas'),
            report.windshield_condition
          ),
          qualityRow(
            tx('truck_acceptance.lights', 'Žibintai'),
            report.lights_condition
          )
        ].join('');

    const photoHtml = (photos || []).map(photo => {
      const url = getTruckAcceptancePhotoUrl(photo.file_path);

      return `
        <button
          type="button"
          class="task-photo-view block text-left bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
          data-url="${escapeHtml(url)}"
          data-title="${escapeHtml(photo.category || 'Nuotrauka')}"
        >
          <img src="${escapeHtml(url)}" class="w-full h-40 object-cover" alt="">
          <div class="p-2 text-xs text-slate-400">${escapeHtml(photo.category || 'Nuotrauka')}</div>
        </button>
      `;
    }).join('');

    instructionModalTitle.textContent = tx(
      'truck_acceptance.report_title',
      'Vilkiko priėmimo ataskaita'
    );

    instructionModalBody.innerHTML = `
      <div class="space-y-4">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">${tx('truck_acceptance.date', 'Data')}</div>
            <div class="font-semibold">${escapeHtml(report.report_date || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">${tx('truck_acceptance.driver', 'Vairuotojas')}</div>
            <div class="font-semibold">${escapeHtml(report.driver_name || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">${tx('truck_acceptance.truck_number', 'Vilkikas')}</div>
            <div class="font-semibold">${escapeHtml(report.truck_number || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">${escapeHtml(trailerTypeLabel)}</div>
            <div class="font-semibold">${escapeHtml(report.trailer_type || '-')}</div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">${tx('truck_acceptance.tire_pressure', 'Padangų slėgiai')}</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
            <div>${tx('truck_acceptance.front_left', 'Priekinė kairė')}: <b>${pressure(report.front_left_pressure)}</b></div>
            <div>${tx('truck_acceptance.front_right', 'Priekinė dešinė')}: <b>${pressure(report.front_right_pressure)}</b></div>
            <div>${tx('truck_acceptance.lazy_left', 'Tinginys kairė')}: <b>${pressure(report.lazy_left_pressure)}</b></div>
            <div>${tx('truck_acceptance.lazy_right', 'Tinginys dešinė')}: <b>${pressure(report.lazy_right_pressure)}</b></div>
            <div>${tx('truck_acceptance.drive_outer_left', 'Varomoji išorinė kairė')}: <b>${pressure(report.drive_outer_left_pressure)}</b></div>
            <div>${tx('truck_acceptance.drive_inner_left', 'Varomoji vidinė kairė')}: <b>${pressure(report.drive_inner_left_pressure)}</b></div>
            <div>${tx('truck_acceptance.drive_inner_right', 'Varomoji vidinė dešinė')}: <b>${pressure(report.drive_inner_right_pressure)}</b></div>
            <div>${tx('truck_acceptance.drive_outer_right', 'Varomoji išorinė dešinė')}: <b>${pressure(report.drive_outer_right_pressure)}</b></div>
          </div>
        </div>
                <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">${tx('truck_acceptance.trailer_axles', 'Priekabos ašys')}</h3>

          <div class="space-y-3 text-sm text-slate-300">
            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">1 ${tx('truck_acceptance.axle', 'ašis')}: ${escapeHtml(report.trailer_axle_1_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>${tx('truck_acceptance.outer_left', 'Kairė išorinė')}: <b>${pressure(report.trailer_axle_1_left_outer)}</b></div>
                <div>${tx('truck_acceptance.inner_left', 'Kairė vidinė')}: <b>${pressure(report.trailer_axle_1_left_inner)}</b></div>
                <div>${tx('truck_acceptance.inner_right', 'Dešinė vidinė')}: <b>${pressure(report.trailer_axle_1_right_inner)}</b></div>
                <div>${tx('truck_acceptance.outer_right', 'Dešinė išorinė')}: <b>${pressure(report.trailer_axle_1_right_outer)}</b></div>
              </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">2 ${tx('truck_acceptance.axle', 'ašis')}: ${escapeHtml(report.trailer_axle_2_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>${tx('truck_acceptance.outer_left', 'Kairė išorinė')}: <b>${pressure(report.trailer_axle_2_left_outer)}</b></div>
                <div>${tx('truck_acceptance.inner_left', 'Kairė vidinė')}: <b>${pressure(report.trailer_axle_2_left_inner)}</b></div>
                <div>${tx('truck_acceptance.inner_right', 'Dešinė vidinė')}: <b>${pressure(report.trailer_axle_2_right_inner)}</b></div>
                <div>${tx('truck_acceptance.outer_right', 'Dešinė išorinė')}: <b>${pressure(report.trailer_axle_2_right_outer)}</b></div>
              </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">3 ${tx('truck_acceptance.axle', 'ašis')}: ${escapeHtml(report.trailer_axle_3_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>${tx('truck_acceptance.outer_left', 'Kairė išorinė')}: <b>${pressure(report.trailer_axle_3_left_outer)}</b></div>
                <div>${tx('truck_acceptance.inner_left', 'Kairė vidinė')}: <b>${pressure(report.trailer_axle_3_left_inner)}</b></div>
                <div>${tx('truck_acceptance.inner_right', 'Dešinė vidinė')}: <b>${pressure(report.trailer_axle_3_right_inner)}</b></div>
                <div>${tx('truck_acceptance.outer_right', 'Dešinė išorinė')}: <b>${pressure(report.trailer_axle_3_right_outer)}</b></div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">${tx('truck_acceptance.quality', 'Kokybės įvertinimas')}</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
            ${qualityRows}
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-2">${tx('truck_acceptance.notes', 'Pastabos')}</h3>
          <div class="whitespace-pre-line text-slate-300">${escapeHtml(report.notes || '-')}</div>
        </div>

        <div>
          <h3 class="font-semibold mb-3">${tx('truck_acceptance.photos', 'Nuotraukos')}</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${photoHtml || `<div class="text-slate-400">${tx('truck_acceptance.no_photos', 'Nuotraukų nėra')}</div>`}
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">${tx('truck_acceptance.instructor_decision', 'Instruktoriaus sprendimas')}</h3>

          <label class="block text-sm text-slate-400 mb-1">${tx('truck_acceptance.comment', 'Komentaras')}</label>
          <textarea
            id="truckAcceptanceComment"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white min-h-[90px]"
            placeholder="${tx('truck_acceptance.comment_placeholder', 'Komentaras, jeigu yra neatitikimų...')}"
          >${escapeHtml(review?.instructor_comment || '')}</textarea>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm">
            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionDriverInstruction" type="checkbox" ${review?.action_driver_instruction ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_driver_instruction', 'Vairuotojo instruktavimas')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionService" type="checkbox" ${review?.action_service ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_service', 'Servisas')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionBonus" type="checkbox" ${review?.action_bonus ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_bonus', 'Premija')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionNoAction" type="checkbox" ${review?.action_no_action ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_no_action', 'Jokių veiksmų nereikia')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionCarWash" type="checkbox" ${review?.action_car_wash ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_car_wash', 'Plovykla')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionInventoryNeeded" type="checkbox" ${review?.action_inventory_needed ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_inventory_needed', 'Reikalingas inventorius')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionWorkClothesNeeded" type="checkbox" ${review?.action_work_clothes_needed ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_work_clothes_needed', 'Reikalingi darbo rūbai')}</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionOther" type="checkbox" ${review?.action_other ? 'checked' : ''}>
              <span>${tx('truck_acceptance.action_other', 'Kita')}</span>
            </label>
          </div>

          <input
            id="taActionOtherText"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white mt-3"
            placeholder="${tx('truck_acceptance.action_other_placeholder', 'Kita — įrašyti')}"
            value="${escapeHtml(review?.action_other_text || '')}"
          >
        </div>
      </div>
    `;

    instructionModalFooter.innerHTML = '';

    if (canApprove) {
      instructionModalFooter.innerHTML = `
        <button type="button" class="truck-acceptance-approve bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl">
          ${tx('truck_acceptance.approve', 'Patvirtinti')}
        </button>

        <button type="button" class="truck-acceptance-return bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl">
          ${tx('truck_acceptance.return_for_fix', 'Grąžinti taisymui')}
        </button>

        <button type="button" class="truck-acceptance-reject bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl">
          ${tx('truck_acceptance.reject', 'Atmesti')}
        </button>
      `;

      instructionModalFooter.querySelector('.truck-acceptance-approve')?.addEventListener('click', async () => {
        const ok = await saveTruckAcceptanceDecision(task, 'approved');
        if (ok) closeTaskModal();
      });

      instructionModalFooter.querySelector('.truck-acceptance-return')?.addEventListener('click', async () => {
        const ok = await saveTruckAcceptanceDecision(task, 'needs_changes');
        if (ok) closeTaskModal();
      });

      instructionModalFooter.querySelector('.truck-acceptance-reject')?.addEventListener('click', async () => {
        const ok = await saveTruckAcceptanceDecision(task, 'rejected');
        if (ok) closeTaskModal();
      });
    }

    instructionModal.classList.remove('hidden');
  }

  async function updateTask(taskId, patch) {
    const { error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .eq('transport_mode', transportMode);

    if (error) {
      console.error('Task update error:', error);

      showModal({
        type: 'error',
        title: tx('tasks.update_error_title', 'Nepavyko atnaujinti'),
        message: tx('tasks.update_error_message', 'Nepavyko atnaujinti užduoties.')
      });

      return false;
    }

    await loadTasks();
    initFilters();
    render();

    return true;
  }

  async function approveTest(task) {
    const confirmed = await confirmModal({
      title: tx('tasks.approve_test', 'Patvirtinti testą'),
      message: `${tx('tasks.approve_test_confirm', 'Ar tikrai patvirtinti testą?')}\n\n${tx('tasks.task', 'Užduotis')}: ${task.title}`,
      confirmText: tx('tasks.next', 'Toliau'),
      cancelText: tx('tasks.cancel', 'Atsaukti'),
      type: 'success'
    });

    if (!confirmed) return;

    const result = await approveTestModal({
      score: task.score || '',
      comment: task.instructorComment || ''
    });

    if (!result) return;

    const now = new Date().toISOString();

    const ok = await updateTask(task.id, {
      status: 'done',
      approved_at: now,
      approved_by: currentUser.id,
      completion_type: 'test',
      score: result.score || null,
      instructor_comment: result.comment || null
    });

    if (ok) {
      await writeTrainingRegister(task, 'test', result.score || '', result.comment || '');

      showModal({
        type: 'success',
        title: tx('tasks.test_approved_title', 'Testas patvirtintas'),
        message: tx('tasks.test_approved_message', 'Testas sėkmingai patvirtintas.')
      });
    }
  }

  async function unapproveTask(task) {
    const confirmed = await confirmModal({
      title: tx('tasks.undo_approval_title', 'Atšaukti patvirtinimą'),
      message: `${tx('tasks.undo_approval_confirm', 'Ar tikrai atšaukti testo patvirtinimą?')}\n\n${tx('tasks.task', 'Užduotis')}: ${task.title}\n\n${tx('tasks.undo_approval_note', 'Užduotis grįš į būseną „Reikia patvirtinti“.')}`,
      confirmText: tx('tasks.undo_approval', 'Atšaukti patvirtinimą'),
      cancelText: tx('tasks.no', 'Ne'),
      type: 'danger'
    });

    if (!confirmed) return;

    await deleteTrainingRegister(task.id);

    const ok = await updateTask(task.id, {
      status: 'pending',
      approved_at: null,
      approved_by: null,
      completion_type: null,
      score: null,
      instructor_comment: null
    });

    if (ok) {
      showModal({
        type: 'success',
        title: tx('tasks.approval_cancelled_title', 'Patvirtinimas atšauktas'),
        message: tx('tasks.approval_cancelled_message', 'Testo patvirtinimas atšauktas. Užduotis vėl laukia patvirtinimo.')
      });
    }
  }

  async function openInstructionModal(taskId) {
    const task = tasks.find(item => String(item.id) === String(taskId));
    if (!task) return;

    const instr = getInstructionById(task.instrId);

    if (!instructionModal || !instructionModalTitle || !instructionModalBody || !instructionModalFooter) return;

    instructionModalTitle.textContent = instr?.title || tx('tasks.instruction', 'Instrukcija');
    instructionModalBody.innerHTML = renderInstructionContent(instr);
    instructionModalFooter.innerHTML = '';

    if (task.status !== 'done') {
      if (isDriverRole) {
        if (instr?.test) {
          const testLink = document.createElement('a');
          testLink.href = instr.test;
          testLink.target = '_blank';
          testLink.className = 'bg-blue-600 px-4 py-2 rounded';
          testLink.textContent = tx('tasks.test', 'Testas');
          instructionModalFooter.appendChild(testLink);

          if (!task.testSubmittedAt) {
            const submitBtn = document.createElement('button');
            submitBtn.className = 'bg-green-600 px-4 py-2 rounded';
            submitBtn.textContent = tx('tasks.submitted_test', 'Pateikiau testą');

            submitBtn.onclick = async () => {
              const confirmed = await confirmModal({
                title: tx('tasks.test_completed_title', 'Testas išspręstas?'),
                message: tx('tasks.test_completed_confirm', 'Patvirtink, kad testą jau išsprendei ir pateikei.'),
                confirmText: tx('tasks.yes_submitted', 'Taip, pateikiau'),
                cancelText: tx('tasks.cancel', 'Atsaukti'),
                type: 'success'
              });

              if (!confirmed) return;

              const ok = await updateTask(task.id, {
                test_submitted_at: new Date().toISOString()
              });

              if (ok) {
                closeTaskModal();

                showModal({
                  type: 'success',
                  title: tx('tasks.submitted_title', 'Pateikta'),
                  message: tx('tasks.submitted_message', 'Testo pateikimas užregistruotas. Laukite instruktoriaus patvirtinimo.')
                });
              }
            };

            instructionModalFooter.appendChild(submitBtn);
          } else {
            const waiting = document.createElement('div');
            waiting.className = 'text-slate-300';
            waiting.textContent = tx('tasks.waiting_for_approval', 'Laukia patvirtinimo');
            instructionModalFooter.appendChild(waiting);
          }
        } else {
          const waitText = document.createElement('div');
          waitText.className = 'text-slate-300';
          waitText.textContent = tx('common.wait', 'Palaukite...');
          instructionModalFooter.appendChild(waitText);

          const confirmBtn = document.createElement('button');
          confirmBtn.className = 'bg-green-600 px-4 py-2 rounded hidden';
          confirmBtn.textContent = tx('tasks.confirm', 'Patvirtinu');

          confirmBtn.onclick = async () => {
            const confirmed = await confirmModal({
              title: tx('tasks.confirm_read_title', 'Patvirtinti susipažinimą'),
              message: tx('tasks.confirm_read_message', 'Ar tikrai patvirtinate, kad susipažinote su instrukcija?'),
              confirmText: tx('tasks.confirm', 'Patvirtinu'),
              cancelText: tx('tasks.cancel', 'Atsaukti'),
              type: 'success'
            });

            if (!confirmed) return;

            const now = new Date().toISOString();

            const ok = await updateTask(task.id, {
              status: 'done',
              approved_at: now,
              approved_by: currentUser.id,
              completion_type: 'confirmation'
            });

            if (ok) {
              await writeTrainingRegister(
                {
                  ...task,
                  status: 'done'
                },
                'confirmation'
              );

              closeTaskModal();
            }
          };

          instructionModalFooter.appendChild(confirmBtn);

          window.taskModalTimer = setTimeout(() => {
            waitText.remove();
            confirmBtn.classList.remove('hidden');
          }, 5000);
        }
      }

      if (canApprove && instr?.test) {
        if (task.testSubmittedAt) {
          const approveBtn = document.createElement('button');
          approveBtn.className = 'bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded';
          approveBtn.textContent = tx('tasks.approve_test', 'Patvirtinti testą');

          approveBtn.onclick = async () => {
            await approveTest(task);
            closeTaskModal();
          };

          instructionModalFooter.appendChild(approveBtn);
        } else {
          const waiting = document.createElement('div');
          waiting.className = 'text-slate-300';
          waiting.textContent = tx('tasks.driver_not_submitted_test', 'Vairuotojas dar nepateikė testo.');
          instructionModalFooter.appendChild(waiting);
        }
      }
    } else if (canApprove && instr?.test) {
      const unapproveBtn = document.createElement('button');
      unapproveBtn.className = 'bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded';
      unapproveBtn.textContent = tx('tasks.undo_approval', 'Atšaukti patvirtinimą');

      unapproveBtn.onclick = async () => {
        await unapproveTask(task);
        closeTaskModal();
      };

      instructionModalFooter.appendChild(unapproveBtn);
    }

    instructionModal.classList.remove('hidden');
  }

  closeInstructionModal?.addEventListener('click', closeTaskModal);

  instructionModal?.addEventListener('click', event => {
    if (event.target === instructionModal) closeTaskModal();
  });

  instructionModalBody?.addEventListener('click', event => {
    const photoBtn = event.target.closest('.task-photo-view');
    if (!photoBtn) return;

    openTaskImageViewer(photoBtn.dataset.url, photoBtn.dataset.title);
  });

  instructionModalFooter?.addEventListener('click', async event => {
    const approveBtn = event.target.closest('.ls-approve');
    const changeBtn = event.target.closest('.ls-change');
    const rejectBtn = event.target.closest('.ls-reject');

    if (approveBtn) {
      const ok = await updateLoadingSchemeStatus(approveBtn.dataset.id, 'approved');

      if (ok) {
        closeTaskModal();
        await loadTasks();
        initFilters();
        render();
      }

      return;
    }

    if (changeBtn) {
      const comment = prompt('Įrašykite komentarą, ką reikia pakeisti:');

      if (comment === null) return;

      const ok = await updateLoadingSchemeStatus(changeBtn.dataset.id, 'needs_changes', comment);

      if (ok) {
        closeTaskModal();
        await loadTasks();
        initFilters();
        render();
      }

      return;
    }

    if (rejectBtn) {
      const comment = prompt('Įrašykite atmetimo priežastį:');

      if (comment === null) return;

      const ok = await updateLoadingSchemeStatus(rejectBtn.dataset.id, 'rejected', comment);

      if (ok) {
        closeTaskModal();
        await loadTasks();
        initFilters();
        render();
      }
    }
  });

  function getSelectedTargetDrivers(selectedUserValues) {
    const normalDrivers = getLanguageFilteredDrivers();

    if (selectedUserValues.includes('all')) {
      return {
        targetDrivers: normalDrivers,
        groupId: null
      };
    }

    const selectedDriverIds = new Set();
    const selectedGroupIds = [];

    selectedUserValues.forEach(value => {
      if (value.startsWith('group:')) {
        selectedGroupIds.push(value.replace('group:', ''));
        return;
      }

      selectedDriverIds.add(value);
    });

    selectedGroupIds.forEach(selectedGroupId => {
      const group = groups.find(item => String(item.id) === String(selectedGroupId));

      (group?.driverIds || []).forEach(driverId => {
        selectedDriverIds.add(driverId);
      });
    });

    return {
      targetDrivers: normalDrivers.filter(driver => selectedDriverIds.has(driver.id)),
      groupId: selectedGroupIds.length === 1 && selectedDriverIds.size === 0 ? selectedGroupIds[0] : null
    };
  }

  async function createTask() {
    if (!canCreate) return;

    const title = document.getElementById('taskTitle')?.value?.trim() || '';
    const desc = document.getElementById('taskDesc')?.value?.trim() || '';
    const taskType = taskTypeSelect?.value || 'standard';
    const statusValue = document.getElementById('taskStatus')?.value || 'pending';
    const done = statusValue === 'done' || statusValue === 'completed';
    const instrId = document.getElementById('taskInstr')?.value || '';
    const selectedInstr = getInstructionById(instrId);
    const selectedUserValues = getSelectedTaskUserValues();

    if (!title) {
      showModal({
        type: 'error',
        title: tx('tasks.missing_title_title', 'Truksta pavadinimo'),
        message: tx('tasks.task_title_placeholder', 'Ivesk uzduoties pavadinima')
      });

      return;
    }

    if (taskType !== 'loading_scheme' && !instrId) {
      showModal({
        type: 'error',
        title: tx('tasks.no_instruction_title', 'Nepasirinkta instrukcija'),
        message: tx('common.select_instruction', 'Pasirink instrukcija')
      });

      return;
    }

    let targetDrivers = [];
    let groupId = null;

    if (taskType !== 'loading_scheme') {
      const result = getSelectedTargetDrivers(selectedUserValues);
      targetDrivers = result.targetDrivers;
      groupId = result.groupId;

      if (!targetDrivers.length) {
        showModal({
          type: 'error',
          title: tx('tasks.no_drivers_title', 'Nera vairuotoju'),
          message: 'Nera pasirinktu vairuotoju arba pasirinktos instrukcijos kalbai nera aktyviu vairuotoju.'
        });

        return;
      }
    }

    const now = new Date().toISOString();

    const rows = taskType === 'loading_scheme'
      ? [{
          title,
          description: desc || null,
          status: 'pending',
          driver_id: null,
          instruction_id: null,
          group_id: null,
          task_type: 'loading_scheme',
          transport_mode: transportMode,
          related_table: null,
          related_id: null,
          created_by: currentUser.id,
          created_at: now,
          approved_at: null,
          approved_by: null,
          completion_type: null
        }]
      : targetDrivers.map(driver => ({
          title,
          description: desc || null,
          status: done ? 'done' : 'pending',
          driver_id: driver.id,
          instruction_id: instrId,
          group_id: groupId,
          task_type: taskType,
          transport_mode: transportMode,
          related_table: null,
          related_id: null,
          created_by: currentUser.id,
          created_at: now,
          approved_at: done ? now : null,
          approved_by: done ? currentUser.id : null,
          completion_type: done ? (selectedInstr?.test ? 'test' : 'confirmation') : null
        }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(rows)
      .select('*');

    if (error) {
      console.error('Task create error:', error);

      showModal({
        type: 'error',
        title: tx('tasks.create_error_title', 'Nepavyko sukurti'),
        message: tx('tasks.create_error_message', 'Nepavyko sukurti uzduoties.')
      });

      return;
    }

    if (done && taskType !== 'loading_scheme' && data?.length) {
      for (const row of data) {
        await writeTrainingRegister(
          {
            id: row.id,
            driverId: row.driver_id,
            instrId: row.instruction_id
          },
          selectedInstr?.test ? 'test' : 'confirmation'
        );
      }
    }

    const taskTitleInput = document.getElementById('taskTitle');
    const taskDescInput = document.getElementById('taskDesc');
    const taskInstrInput = document.getElementById('taskInstr');

    if (taskTitleInput) taskTitleInput.value = '';
    if (taskDescInput) taskDescInput.value = '';
    if (taskInstrInput) taskInstrInput.value = '';

    await loadTasks();
    initFilters();
    render();

    showModal({
      type: 'success',
      title: tx('tasks.created_title', 'Uzduotis sukurta'),
      message: tx('tasks.created_message', 'Uzduotis sekmingai priskirta.')
    });
  }

  document.getElementById('addTask')?.addEventListener('click', createTask);

  [filterSearch, filterStatus, filterInstr]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

  filterUserSearch?.addEventListener('input', render);
  instrLangSelect?.addEventListener('change', () => {
    fillTaskInstructionOptions();
    fillTaskUsers();
  });

  taskTypeSelect?.addEventListener('change', () => {
    fillTaskUsers();
    fillTaskInstructionOptions();
  });

  instrSelect?.addEventListener('change', fillTaskUsers);

  document.addEventListener('click', async event => {
    if (event.target?.id === 'deleteSelectedTasks') {
      await deleteSelectedTasks();
    }
  });

  document.addEventListener('change', event => {
    const selectAll = event.target.closest('#selectAllTasks');

    if (selectAll && role === 'admin') {
      const visibleIds = getFilteredTasks().map(task => String(task.id));

      if (selectAll.checked) {
        visibleIds.forEach(id => selectedTaskIds.add(id));
      } else {
        visibleIds.forEach(id => selectedTaskIds.delete(id));
      }

      render();
      return;
    }

    const checkbox = event.target.closest('.task-select-checkbox');

    if (checkbox && role === 'admin') {
      const id = checkbox.dataset.id;

      if (checkbox.checked) {
        selectedTaskIds.add(String(id));
      } else {
        selectedTaskIds.delete(String(id));
      }

      updateBulkDeleteButton();
    }
  });
  table.addEventListener('click', async event => {
    const loadingSchemeBtn = event.target.closest('.open-loading-scheme');
    const truckAcceptanceBtn = event.target.closest('.open-truck-acceptance');
    const openBtn = event.target.closest('.instr-open-btn');
    const approveBtn = event.target.closest('.approve-test-btn');
    const unapproveBtn = event.target.closest('.unapprove-btn');
    const deleteBtn = event.target.closest('.delete-btn');

    const id =
      loadingSchemeBtn?.dataset.id ||
      truckAcceptanceBtn?.dataset.id ||
      openBtn?.dataset.id ||
      approveBtn?.dataset.id ||
      unapproveBtn?.dataset.id ||
      deleteBtn?.dataset.id;

    if (!id) return;

    const task = tasks.find(item => String(item.id) === String(id));

    if (!task) return;

    if (loadingSchemeBtn) {
      await openLoadingSchemeModal(id);
      return;
    }

    if (truckAcceptanceBtn) {
      await openTruckAcceptanceModal(id);
      return;
    }

    if (openBtn) {
      await openInstructionModal(id);
      return;
    }

    if (approveBtn && canApprove) {
      await approveTest(task);
      return;
    }

    if (unapproveBtn && canApprove) {
      await unapproveTask(task);
      return;
    }

    if (deleteBtn && role === 'admin') {
      const confirmed = await confirmModal({
        title: tx('tasks.delete_title', 'Ištrinti užduotį'),
        message: `${tx('tasks.delete_confirm', 'Ar tikrai ištrinti užduotį?')}\n\n${task.title}`,
        confirmText: tx('tasks.delete', 'Trinti'),
        cancelText: tx('tasks.cancel', 'Atsaukti'),
        type: 'danger'
      });

      if (!confirmed) return;

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id)
        .eq('transport_mode', transportMode);

      if (error) {
        console.error('Task delete error:', error);

        showModal({
          type: 'error',
          title: tx('tasks.delete_error_title', 'Nepavyko istrinti'),
          message: tx('tasks.delete_error_message', 'Nepavyko ištrinti užduoties.')
        });

        return;
      }

      await loadTasks();
      initFilters();
      render();
    }
  });

  function renderInstructionCell(task, instruction) {
    if (task.taskType === 'truck_acceptance_review') {
      return `
        <button class="open-truck-acceptance text-blue-400 underline" data-id="${task.id}">
          Vilkiko priėmimo ataskaita
        </button>
      `;
    }

    if (task.taskType === 'loading_scheme') {
      return `
        <button class="open-loading-scheme text-blue-400 underline" data-id="${task.id}">
          ${task.relatedTable === 'loading_scheme_tasks'
            ? 'Peržiūrėti schemą'
            : tx('tasks.loading_scheme_task', 'Krovimo schema')}
        </button>
      `;
    }

    return `
      <button class="instr-open-btn text-blue-400 underline" data-id="${task.id}">
        ${escapeHtml(instruction?.title || '-')}
      </button>
    `;
  }

  function renderActionsCell(task, instruction, done) {
    if (task.taskType === 'truck_acceptance_review') {
      return `
        <button class="open-truck-acceptance bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs" data-id="${task.id}">
          Atidaryti ataskaitą
        </button>

        ${role === 'admin'
          ? `<button class="delete-btn text-red-400 text-xs ml-2" data-id="${task.id}">✖</button>`
          : ''}
      `;
    }

    if (task.taskType === 'loading_scheme') {
      return `
        <button class="open-loading-scheme bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs" data-id="${task.id}">
          ${task.relatedTable === 'loading_scheme_tasks'
            ? 'Peržiūrėti'
            : tx('tasks.open_schemes', 'Atidaryti schemas')}
        </button>

        ${role === 'admin'
          ? `<button class="delete-btn text-red-400 text-xs ml-2" data-id="${task.id}">✖</button>`
          : ''}
      `;
    }

    return `
      ${
        done
          ? (
              canApprove && instruction?.test
                ? `
                  <div class="flex justify-end gap-2 items-center">
                    <span class="text-green-400 text-xs">✔</span>
                    <button class="unapprove-btn bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-xs" data-id="${task.id}">
                      ${tx('tasks.cancel_approval', 'Atšaukti')}
                    </button>
                  </div>
                `
                : `<span class="text-green-400 text-xs">✔</span>`
            )
          : isDriverRole
            ? (instruction?.test
                ? (task.testSubmittedAt
                    ? `<span class="text-slate-300 text-xs">${tx('tasks.waiting_for_approval', 'Laukia patvirtinimo')}</span>`
                    : `<button class="instr-open-btn bg-blue-600 px-3 py-1 rounded text-xs" data-id="${task.id}">${tx('tasks.test', 'Testas')}</button>`)
                : `<button class="instr-open-btn bg-slate-700 px-3 py-1 rounded text-xs" data-id="${task.id}">${tx('tasks.view', 'Peržiūrėti')}</button>`)
            : (instruction?.test
                ? (task.testSubmittedAt
                    ? `<button class="approve-test-btn bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded text-xs" data-id="${task.id}">${tx('tasks.approve', 'Patvirtinti')}</button>`
                    : `<span class="text-slate-400 text-xs">${tx('tasks.waiting_for_test', 'Laukia testo')}</span>`)
                : `<span class="text-slate-400 text-xs">${tx('tasks.waiting_for_approval', 'Laukia patvirtinimo')}</span>`)
      }

      ${role === 'admin'
        ? `<button class="delete-btn text-red-400 text-xs ml-2" data-id="${task.id}">✖</button>`
        : ''}
    `;
  }

  function ensureBulkActionsUi() {
    if (role !== 'admin') return;

    if (!document.getElementById('taskBulkActions')) {
      const wrapper = document.createElement('div');
      wrapper.id = 'taskBulkActions';
      wrapper.className = 'bg-slate-900 p-4 rounded-xl border border-slate-700 mb-4 flex items-center justify-between gap-3 flex-wrap';

      wrapper.innerHTML = `
        <div class="text-sm text-slate-300">
          Pazymeta: <span id="selectedTasksCount">0</span>
        </div>

        <button
          id="deleteSelectedTasks"
          type="button"
          class="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          disabled
        >
          Trinti pazymetas
        </button>
      `;

      const tableBox = table.closest('.bg-slate-900');
      tableBox?.parentElement?.insertBefore(wrapper, tableBox);
    }

    if (!document.getElementById('selectAllTasks')) {
      const headRow = table.closest('table')?.querySelector('thead tr');

      if (headRow) {
        const th = document.createElement('th');
        th.className = 'p-3 task-bulk-col w-10';
        th.innerHTML = `<input id="selectAllTasks" type="checkbox" class="w-4 h-4">`;
        headRow.insertBefore(th, headRow.firstElementChild);
      }
    }
  }

  function updateBulkDeleteButton() {
    const count = selectedTaskIds.size;
    const countEl = document.getElementById('selectedTasksCount');
    const deleteBtn = document.getElementById('deleteSelectedTasks');
    const selectAll = document.getElementById('selectAllTasks');

    if (countEl) countEl.textContent = String(count);
    if (deleteBtn) deleteBtn.disabled = count === 0;

    if (selectAll) {
      const visibleIds = getFilteredTasks().map(task => String(task.id));
      const visibleSelected = visibleIds.filter(id => selectedTaskIds.has(id));

      selectAll.checked = visibleIds.length > 0 && visibleSelected.length === visibleIds.length;
      selectAll.indeterminate = visibleSelected.length > 0 && visibleSelected.length < visibleIds.length;
    }
  }

  function getTableColspan() {
    let count = 4;

    if (!isDriverRole) count += 1;
    if (role === 'admin') count += 1;

    return count;
  }

  async function deleteSelectedTasks() {
    if (role !== 'admin') return;

    const ids = Array.from(selectedTaskIds);
    if (!ids.length) return;

    const confirmed = await confirmModal({
      title: 'Trinti pazymetas uzduotis',
      message: `Ar tikrai istrinti pazymetas uzduotis?\n\nKiekis: ${ids.length}`,
      confirmText: tx('tasks.delete', 'Trinti'),
      cancelText: tx('tasks.cancel', 'Atsaukti'),
      type: 'danger'
    });

    if (!confirmed) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids)
      .eq('transport_mode', transportMode);

    if (error) {
      console.error('Bulk task delete error:', error);

      showModal({
        type: 'error',
        title: tx('tasks.delete_error_title', 'Nepavyko istrinti'),
        message: 'Nepavyko istrinti pazymetu uzduociu.'
      });

      return;
    }

    selectedTaskIds.clear();

    await loadTasks();
    initFilters();
    render();
  }

  function render() {
    updateStats();
    ensureBulkActionsUi();

    const list = getFilteredTasks();

    const visibleTaskIds = new Set(tasks.map(task => String(task.id)));
    selectedTaskIds = new Set([...selectedTaskIds].filter(id => visibleTaskIds.has(id)));

    if (!list.length) {
      table.innerHTML = `
        <tr>
          ${role === 'admin' ? '<td class="p-3 task-bulk-col"></td>' : ''}
          <td colspan="${getTableColspan()}" class="p-4 text-slate-400">
            ${tx('tasks.no_tasks', 'Nera uzduociu')}
          </td>
        </tr>
      `;

      updateBulkDeleteButton();
      return;
    }

    table.innerHTML = list.map(task => {
      const instruction = getInstructionById(task.instrId);
      const done = task.status === 'done';
      const statusInfo = getTaskStatusInfo(task);

      return `
        <tr class="border-t border-slate-700 align-top">
          ${role === 'admin' ? `
            <td class="p-3 task-bulk-col">
              <input
                type="checkbox"
                class="task-select-checkbox w-4 h-4"
                data-id="${task.id}"
                ${selectedTaskIds.has(String(task.id)) ? 'checked' : ''}
              >
            </td>
          ` : ''}

          <td class="p-3">
            <div class="font-semibold">${escapeHtml(task.title)}</div>
            <div class="text-slate-400 text-xs whitespace-pre-line">${escapeHtml(task.desc || '')}</div>
          </td>

          <td class="p-3">
            <span class="px-2 py-1 rounded text-xs ${statusInfo.className}">
              ${escapeHtml(statusInfo.label)}
            </span>
          </td>

          ${isDriverRole ? '' : `<td class="p-3 assigned-col">${escapeHtml(task.userLabel || '-')}</td>`}

          <td class="p-3">
            ${renderInstructionCell(task, instruction)}
          </td>

          <td class="p-3 text-right space-y-2">
            ${renderActionsCell(task, instruction, done)}
          </td>
        </tr>
      `;
    }).join('');

    updateBulkDeleteButton();
  }

  await reloadAll();
}