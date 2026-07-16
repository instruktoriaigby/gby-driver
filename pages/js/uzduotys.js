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
  const canCreate = role === 'admin' || role === 'instructor';
  const canApprove = role === 'admin' || role === 'instructor';

  if (createBlock) createBlock.classList.toggle('hidden', !canCreate);
  if (filterUserWrap) filterUserWrap.classList.toggle('hidden', role === 'driver');

  document.querySelectorAll('.assigned-col').forEach(el => {
    el.classList.toggle('hidden', role === 'driver');
  });

  if (taskStats) {
    taskStats.classList.toggle('hidden', !canApprove);
  }

  let drivers = [];
  let groups = [];
  let groupMembers = [];
  let instructions = [];
  let tasks = [];

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
    cancelText = tx('tasks.cancel', 'Atšaukti'),
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
              ${tx('tasks.cancel', 'Atšaukti')}
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
      .select('id, full_name, email, role, lang, is_active, created_at')
      .in('role', ['driver', 'master_driver'])
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

    groups = (groupsData || []).map(group => ({
      ...group,
      driverIds: groupMembers
        .filter(member => member.group_id === group.id)
        .map(member => member.driver_id)
    }));
  }

  async function loadInstructions() {
    const { data, error } = await supabase
      .from('instructions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Instructions load error:', error);
      instructions = [];
      return;
    }

    instructions = (data || []).map(normalizeInstruction);
  }

  async function loadTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Tasks load error:', error);
      tasks = [];
      table.innerHTML = `
        <tr>
          <td colspan="${role === 'driver' ? 4 : 5}" class="p-4 text-red-400">
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

  function fillTaskUsers() {
    const select = document.getElementById('taskUser');
    if (!select) return;

    if (!canCreate) {
      select.innerHTML = '';
      return;
    }

    const taskType = taskTypeSelect?.value || 'standard';
    const currentValue = select.value || 'all';

    if (taskType === 'loading_scheme') {
      select.innerHTML = `<option value="none">Neskiriama konkrečiam vairuotojui</option>`;
      select.value = 'none';
      select.disabled = true;
      return;
    }

    select.disabled = false;

    const normalDrivers = drivers.filter(driver => driver.role === 'driver');

    select.innerHTML =
      `<option value="all">${tx('common.all_users', 'Visiems')}</option>` +
      groups.map(group => `<option value="group:${group.id}">👥 ${escapeHtml(group.name)}</option>`).join('') +
      normalDrivers.map(driver => `<option value="${driver.id}">${escapeHtml(driver.full_name || driver.email)}</option>`).join('');

    if ([...select.options].some(opt => opt.value === currentValue)) {
      select.value = currentValue;
    }
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
      `<option value="">${tx('common.select_instruction', 'Pasirink instrukciją')}</option>` +
      instructions
        .filter(item => item.lang === selectedLang)
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
      `<option value="all">${tx('common.all_instructions', 'Visos instrukcijos')}</option>` +
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
        (role === 'driver' || !userSearch || (task.userLabel || '').toLowerCase().includes(userSearch)) &&
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
      .maybeSingle();

    const { error } = await supabase
      .from('loading_scheme_tasks')
      .update(payload)
      .eq('id', schemeId);

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
        .eq('id', schemeBeforeUpdate.source_task_id);
    }

    return true;
  }

  async function openLoadingSchemeModal(taskId) {
    if (!instructionModal || !instructionModalTitle || !instructionModalBody || !instructionModalFooter) return;

    const { data: scheme, error } = await supabase
      .from('loading_scheme_tasks')
      .select('*')
      .eq('source_task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

    const photoLabels = {
      truck_side_required: tx('loading_schemes.photo_truck_side', 'Autovežis iš šono'),
      trailer_side_required: tx('loading_schemes.photo_trailer_side', 'Priekaba iš šono'),
      full_carrier_side_required: tx('loading_schemes.photo_full_side', 'Visas autovežis iš šono'),
      extra_1: tx('loading_schemes.extra_1', 'Papildoma 1'),
      extra_2: tx('loading_schemes.extra_2', 'Papildoma 2'),
      extra_3: tx('loading_schemes.extra_3', 'Papildoma 3')
    };

    instructionModalTitle.textContent = tx('loading_schemes.title_single', 'Krovimo schema');

    instructionModalBody.innerHTML = `
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

    instructionModalFooter.innerHTML = '';

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
    .eq('id', task.id);

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
      .eq('id', task.relatedId);

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
      damaged_lights: 'Pažeisti'
    };

    function q(value) {
      return qualityLabels[value] || value || '-';
    }

    function pressure(value) {
      if (value === null || value === undefined || value === '') return '-';
      return `${value} bar`;
    }

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

    instructionModalTitle.textContent = 'Vilkiko priėmimo ataskaita';

    instructionModalBody.innerHTML = `
      <div class="space-y-4">

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">Data</div>
            <div class="font-semibold">${escapeHtml(report.report_date || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">Vairuotojas</div>
            <div class="font-semibold">${escapeHtml(report.driver_name || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">Vilkikas</div>
            <div class="font-semibold">${escapeHtml(report.truck_number || '-')}</div>
          </div>

          <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <div class="text-slate-400">Autovežio tipas</div>
            <div class="font-semibold">${escapeHtml(report.trailer_type || '-')}</div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">Padangų slėgiai</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
            <div>Priekinė kairė: <b>${pressure(report.front_left_pressure)}</b></div>
            <div>Priekinė dešinė: <b>${pressure(report.front_right_pressure)}</b></div>
            <div>Tinginys kairė: <b>${pressure(report.lazy_left_pressure)}</b></div>
            <div>Tinginys dešinė: <b>${pressure(report.lazy_right_pressure)}</b></div>
            <div>Varomoji išorinė kairė: <b>${pressure(report.drive_outer_left_pressure)}</b></div>
            <div>Varomoji vidinė kairė: <b>${pressure(report.drive_inner_left_pressure)}</b></div>
            <div>Varomoji vidinė dešinė: <b>${pressure(report.drive_inner_right_pressure)}</b></div>
            <div>Varomoji išorinė dešinė: <b>${pressure(report.drive_outer_right_pressure)}</b></div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">Priekabos ašys</h3>

          <div class="space-y-3 text-sm text-slate-300">
            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">1 ašis: ${escapeHtml(report.trailer_axle_1_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>Kairė išorinė: <b>${pressure(report.trailer_axle_1_left_outer)}</b></div>
                <div>Kairė vidinė: <b>${pressure(report.trailer_axle_1_left_inner)}</b></div>
                <div>Dešinė vidinė: <b>${pressure(report.trailer_axle_1_right_inner)}</b></div>
                <div>Dešinė išorinė: <b>${pressure(report.trailer_axle_1_right_outer)}</b></div>
              </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">2 ašis: ${escapeHtml(report.trailer_axle_2_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>Kairė išorinė: <b>${pressure(report.trailer_axle_2_left_outer)}</b></div>
                <div>Kairė vidinė: <b>${pressure(report.trailer_axle_2_left_inner)}</b></div>
                <div>Dešinė vidinė: <b>${pressure(report.trailer_axle_2_right_inner)}</b></div>
                <div>Dešinė išorinė: <b>${pressure(report.trailer_axle_2_right_outer)}</b></div>
              </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
              <div class="font-semibold mb-2">3 ašis: ${escapeHtml(report.trailer_axle_3_type || '-')}</div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>Kairė išorinė: <b>${pressure(report.trailer_axle_3_left_outer)}</b></div>
                <div>Kairė vidinė: <b>${pressure(report.trailer_axle_3_left_inner)}</b></div>
                <div>Dešinė vidinė: <b>${pressure(report.trailer_axle_3_right_inner)}</b></div>
                <div>Dešinė išorinė: <b>${pressure(report.trailer_axle_3_right_outer)}</b></div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">Kokybės įvertinimas</h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
            <div>Platformos būklė: <b>${escapeHtml(q(report.platform_condition))}</b></div>
            <div>Tvarka ant platformos: <b>${escapeHtml(q(report.platform_order))}</b></div>
            <div>Apsauginės tvoros: <b>${escapeHtml(q(report.safety_fences_condition))}</b></div>
            <div>Tvirtinimo diržai: <b>${escapeHtml(q(report.straps_condition))}</b></div>
            <div>Kitas inventorius: <b>${escapeHtml(q(report.work_inventory_condition))}</b></div>
            <div>Tvirtinimas: <b>${escapeHtml(q(report.fastening_condition))}</b></div>
            <div>Išorinė švara: <b>${escapeHtml(q(report.exterior_cleanliness))}</b></div>
            <div>Priekinis stiklas: <b>${escapeHtml(q(report.windshield_condition))}</b></div>
            <div>Žibintai: <b>${escapeHtml(q(report.lights_condition))}</b></div>
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-2">Pastabos</h3>
          <div class="whitespace-pre-line text-slate-300">${escapeHtml(report.notes || '-')}</div>
        </div>

        <div>
          <h3 class="font-semibold mb-3">Nuotraukos</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${photoHtml || '<div class="text-slate-400">Nuotraukų nėra</div>'}
          </div>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3">
          <h3 class="font-semibold mb-3">Instruktoriaus sprendimas</h3>

          <label class="block text-sm text-slate-400 mb-1">Komentaras</label>
          <textarea
            id="truckAcceptanceComment"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white min-h-[90px]"
            placeholder="Komentaras, jeigu yra neatitikimų..."
          >${escapeHtml(review?.instructor_comment || '')}</textarea>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm">
            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionDriverInstruction" type="checkbox" ${review?.action_driver_instruction ? 'checked' : ''}>
              <span>Vairuotojo instruktavimas</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionService" type="checkbox" ${review?.action_service ? 'checked' : ''}>
              <span>Servisas</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionBonus" type="checkbox" ${review?.action_bonus ? 'checked' : ''}>
              <span>Premija</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionNoAction" type="checkbox" ${review?.action_no_action ? 'checked' : ''}>
              <span>Jokių veiksmų nereikia</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionCarWash" type="checkbox" ${review?.action_car_wash ? 'checked' : ''}>
              <span>Plovykla</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionInventoryNeeded" type="checkbox" ${review?.action_inventory_needed ? 'checked' : ''}>
              <span>Reikalingas inventorius</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionWorkClothesNeeded" type="checkbox" ${review?.action_work_clothes_needed ? 'checked' : ''}>
              <span>Reikalingi darbo rūbai</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3">
              <input id="taActionOther" type="checkbox" ${review?.action_other ? 'checked' : ''}>
              <span>Kita</span>
            </label>
          </div>

          <input
            id="taActionOtherText"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white mt-3"
            placeholder="Kita — įrašyti"
            value="${escapeHtml(review?.action_other_text || '')}"
          >
        </div>
      </div>
    `;

    instructionModalFooter.innerHTML = '';

    if (canApprove) {
      instructionModalFooter.innerHTML = `
        <button type="button" class="truck-acceptance-approve bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl">
          Patvirtinti
        </button>

        <button type="button" class="truck-acceptance-return bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl">
          Grąžinti taisymui
        </button>

        <button type="button" class="truck-acceptance-reject bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl">
          Atmesti
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
      .eq('id', taskId);

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
      cancelText: tx('tasks.cancel', 'Atšaukti'),
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
      if (role === 'driver') {
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
                cancelText: tx('tasks.cancel', 'Atšaukti'),
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
              cancelText: tx('tasks.cancel', 'Atšaukti'),
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

  document.getElementById('addTask')?.addEventListener('click', async () => {
    if (!canCreate) return;

    const title = document.getElementById('taskTitle')?.value?.trim() || '';
    const desc = document.getElementById('taskDesc')?.value?.trim() || '';
    const taskType = taskTypeSelect?.value || 'standard';
    const selectedUser = document.getElementById('taskUser')?.value || 'all';
    const statusValue = document.getElementById('taskStatus')?.value || 'pending';
    const done = statusValue === 'done' || statusValue === 'completed';
    const instrId = document.getElementById('taskInstr')?.value || '';
    const selectedInstr = instructions.find(item => String(item.id) === String(instrId));

    if (!title) {
      showModal({
        type: 'error',
        title: tx('tasks.missing_title_title', 'Trūksta pavadinimo'),
        message: tx('tasks.task_title_placeholder', 'Įvesk užduoties pavadinimą')
      });

      return;
    }

    if (taskType !== 'loading_scheme' && !instrId) {
      showModal({
        type: 'error',
        title: tx('tasks.no_instruction_title', 'Nepasirinkta instrukcija'),
        message: tx('common.select_instruction', 'Pasirink instrukciją')
      });

      return;
    }

    let targetDrivers = [];
    let groupId = null;

    if (taskType !== 'loading_scheme') {
      const normalDrivers = drivers.filter(driver => driver.role === 'driver');

      if (selectedUser === 'all') {
        targetDrivers = normalDrivers;
      } else if (selectedUser.startsWith('group:')) {
        groupId = selectedUser.replace('group:', '');
        const group = groups.find(item => String(item.id) === String(groupId));
        targetDrivers = normalDrivers.filter(driver => group?.driverIds.includes(driver.id));
      } else {
        targetDrivers = normalDrivers.filter(driver => String(driver.id) === String(selectedUser));
      }

      if (!targetDrivers.length) {
        showModal({
          type: 'error',
          title: tx('tasks.no_drivers_title', 'Nėra vairuotojų'),
          message: tx('tasks.no_drivers_message', 'Nėra pasirinktų vairuotojų.')
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
        message: tx('tasks.create_error_message', 'Nepavyko sukurti užduoties.')
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
      title: tx('tasks.created_title', 'Užduotis sukurta'),
      message: tx('tasks.created_message', 'Užduotis sėkmingai priskirta.')
    });
  });

  [filterSearch, filterStatus, filterInstr]
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

  filterUserSearch?.addEventListener('input', render);
  instrLangSelect?.addEventListener('change', fillTaskInstructionOptions);

  taskTypeSelect?.addEventListener('change', () => {
    fillTaskUsers();
    fillTaskInstructionOptions();
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
        cancelText: tx('tasks.cancel', 'Atšaukti'),
        type: 'danger'
      });

      if (!confirmed) return;

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        console.error('Task delete error:', error);

        showModal({
          type: 'error',
          title: tx('tasks.delete_error_title', 'Nepavyko ištrinti'),
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
          ${tx('tasks.loading_scheme_task', 'Krovimo schema')}
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
          ${tx('tasks.open_schemes', 'Atidaryti schemas')}
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
          : role === 'driver'
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

  function render() {
    updateStats();

    const list = getFilteredTasks();

    if (!list.length) {
      table.innerHTML = `
        <tr>
          <td colspan="${role === 'driver' ? 4 : 5}" class="p-4 text-slate-400">
            ${tx('tasks.no_tasks', 'Nėra užduočių')}
          </td>
        </tr>
      `;
      return;
    }

    table.innerHTML = list.map(task => {
      const instruction = getInstructionById(task.instrId);
      const done = task.status === 'done';
      const statusInfo = getTaskStatusInfo(task);

      return `
        <tr class="border-t border-slate-700 align-top">
          <td class="p-3">
            <div class="font-semibold">${escapeHtml(task.title)}</div>
            <div class="text-slate-400 text-xs whitespace-pre-line">${escapeHtml(task.desc || '')}</div>
          </td>

          <td class="p-3">
            <span class="px-2 py-1 rounded text-xs ${statusInfo.className}">
              ${escapeHtml(statusInfo.label)}
            </span>
          </td>

          ${role === 'driver' ? '' : `<td class="p-3 assigned-col">${escapeHtml(task.userLabel || '-')}</td>`}

          <td class="p-3">
            ${renderInstructionCell(task, instruction)}
          </td>

          <td class="p-3 text-right space-y-2">
            ${renderActionsCell(task, instruction, done)}
          </td>
        </tr>
      `;
    }).join('');
  }

  await reloadAll();
}