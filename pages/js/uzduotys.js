import { t } from '../../i18n.js';

export async function initUzduotys({ supabase, user, profile } = {}) {
  const tx = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const table = document.getElementById('taskTable');
  const instrSelect = document.getElementById('taskInstr');
  const instrLangSelect = document.getElementById('taskInstrLang');
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

  if (!table || !instrSelect || !supabase || !user || !profile) return;

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
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showModal({ title = tx('common.message', 'Pranešimas'), message = '', type = 'info' }) {
    const oldModal = document.getElementById('appModal');
    if (oldModal) oldModal.remove();

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

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
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
      const oldModal = document.getElementById('confirmModal');
      if (oldModal) oldModal.remove();

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

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close(false);
      });
    });
  }

  function approveTestModal({ score = '', comment = '' } = {}) {
    return new Promise(resolve => {
      const oldModal = document.getElementById('approveTestModal');
      if (oldModal) oldModal.remove();

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
              <label class="block text-sm text-slate-400 mb-1">${tx('tasks.instructor_comment', 'Instruktoriaus komentaras')}</label>
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

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close(null);
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
      .eq('role', 'driver')
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

    const currentValue = select.value || 'all';

    select.innerHTML =
      `<option value="all">${tx('common.all_users', 'Visiems')}</option>` +
      groups.map(group => `<option value="group:${group.id}">👥 ${escapeHtml(group.name)}</option>`).join('') +
      drivers.map(driver => `<option value="${driver.id}">${escapeHtml(driver.full_name || driver.email)}</option>`).join('');

    if ([...select.options].some(opt => opt.value === currentValue)) {
      select.value = currentValue;
    }
  }

  function fillTaskInstructionOptions() {
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
      const instr = getInstructionById(task.instrId);
      return Boolean(instr?.test) && task.testSubmittedAt && task.status !== 'done';
    }).length;

    const pendingConfirms = tasks.filter(task => {
      const instr = getInstructionById(task.instrId);
      return !instr?.test && task.status !== 'done';
    }).length;

    if (pendingTestsCount) pendingTestsCount.textContent = String(pendingTests);
    if (pendingConfirmsCount) pendingConfirmsCount.textContent = String(pendingConfirms);
  }

  async function writeTrainingRegister(task, completionType, score = '', instructorComment = '') {
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

  instructionModal?.addEventListener('click', (e) => {
    if (e.target === instructionModal) closeTaskModal();
  });

  document.getElementById('addTask')?.addEventListener('click', async () => {
    if (!canCreate) return;

    const title = document.getElementById('taskTitle').value.trim();
    const desc = document.getElementById('taskDesc').value.trim();
    const selectedUser = document.getElementById('taskUser').value;
    const statusValue = document.getElementById('taskStatus').value;
    const done = statusValue === 'done' || statusValue === 'completed';
    const instrId = document.getElementById('taskInstr').value;
    const selectedInstr = instructions.find(item => String(item.id) === String(instrId));

    if (!title) {
      showModal({
        type: 'error',
        title: tx('tasks.missing_title_title', 'Trūksta pavadinimo'),
        message: tx('tasks.task_title_placeholder', 'Įvesk užduoties pavadinimą')
      });
      return;
    }

    if (!instrId) {
      showModal({
        type: 'error',
        title: tx('tasks.no_instruction_title', 'Nepasirinkta instrukcija'),
        message: tx('common.select_instruction', 'Pasirink instrukciją')
      });
      return;
    }

    let targetDrivers = [];
    let groupId = null;

    if (selectedUser === 'all') {
      targetDrivers = drivers;
    } else if (selectedUser.startsWith('group:')) {
      groupId = selectedUser.replace('group:', '');
      const group = groups.find(item => String(item.id) === String(groupId));
      targetDrivers = drivers.filter(driver => group?.driverIds.includes(driver.id));
    } else {
      targetDrivers = drivers.filter(driver => String(driver.id) === String(selectedUser));
    }

    if (!targetDrivers.length) {
      showModal({
        type: 'error',
        title: tx('tasks.no_drivers_title', 'Nėra vairuotojų'),
        message: tx('tasks.no_drivers_message', 'Nėra pasirinktų vairuotojų.')
      });
      return;
    }

    const now = new Date().toISOString();

    const rows = targetDrivers.map(driver => ({
      title,
      description: desc || null,
      status: done ? 'done' : 'pending',
      driver_id: driver.id,
      instruction_id: instrId,
      group_id: groupId,
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

    if (done && data?.length) {
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

    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDesc').value = '';
    document.getElementById('taskInstr').value = '';

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

  table.addEventListener('click', async (e) => {
    const openBtn = e.target.closest('.instr-open-btn');
    const approveBtn = e.target.closest('.approve-test-btn');
    const unapproveBtn = e.target.closest('.unapprove-btn');
    const deleteBtn = e.target.closest('.delete-btn');

    const id =
      openBtn?.dataset.id ||
      approveBtn?.dataset.id ||
      unapproveBtn?.dataset.id ||
      deleteBtn?.dataset.id;

    if (!id) return;

    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;

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
            <div class="text-slate-400 text-xs">${escapeHtml(task.desc || '')}</div>
          </td>

          <td class="p-3">
            <span class="px-2 py-1 rounded text-xs ${statusInfo.className}">
              ${escapeHtml(statusInfo.label)}
            </span>
          </td>

          ${role === 'driver' ? '' : `<td class="p-3 assigned-col">${escapeHtml(task.userLabel || '-')}</td>`}

          <td class="p-3">
            <button class="instr-open-btn text-blue-400 underline" data-id="${task.id}">
              ${escapeHtml(instruction?.title || '-')}
            </button>
          </td>

          <td class="p-3 text-right space-y-2">
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
          </td>
        </tr>
      `;
    }).join('');
  }

  await reloadAll();
}