export async function initNustatymai({ supabase, user, profile }) {
  const currentUser = user;
  const role = profile?.role || 'driver';
  const isAdmin = role === 'admin';
  const canManageInstructions = role === 'admin' || role === 'instructor';

  if (role === 'driver') {
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
  const userFormPanel = document.getElementById('userFormPanel');
  const usersList = document.getElementById('usersList');
  const userSearch = document.getElementById('userSearch');
  const userSearchList = document.getElementById('userSearchList');

  const driversImportPanel = document.getElementById('driversImportPanel');
  const driversImportFile = document.getElementById('driversImportFile');
  const importDriversBtn = document.getElementById('importDriversBtn');
  const driversImportResult = document.getElementById('driversImportResult');

  const groupNameInput = document.getElementById('groupName');
  const groupDriverSearch = document.getElementById('groupDriverSearch');
  const groupDriverSearchList = document.getElementById('groupDriverSearchList');
  const groupSelectedDrivers = document.getElementById('groupSelectedDrivers');
  const saveGroupBtn = document.getElementById('saveGroupBtn');
  const groupSearch = document.getElementById('groupSearch');
  const groupSearchList = document.getElementById('groupSearchList');
  const groupsList = document.getElementById('groupsList');

  if (!typeSelect || !instrList || !langSelect || !usersList) return;

  if (!canManageInstructions) {
    instructionFormPanel?.classList.add('hidden');
  }

  if (!isAdmin) {
    dashboardPanel?.classList.add('hidden');
    userFormPanel?.classList.add('hidden');
    driversImportPanel?.classList.add('hidden');
  }

  let users = [];
  let groups = [];
  let groupMembers = [];
  let instructions = [];

  let editUserId = null;
  let editGroupId = null;
  let editInstructionId = localStorage.getItem('editInstructionId') || null;
  let selectedGroupDriverIds = [];

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setImportResult(message, type = 'info') {
    if (!driversImportResult) return;

    const colorClass =
      type === 'success' ? 'text-green-400' :
      type === 'error' ? 'text-red-400' :
      'text-slate-400';

    driversImportResult.innerHTML = `<div class="${colorClass}">${message}</div>`;
  }

  function getDrivers() {
    return users.filter(item => item.role === 'driver' && item.is_active !== false);
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

  async function loadUsersFromSupabase() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, lang, is_active, created_at')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Profiles load error:', error);
      users = [];
      return;
    }

    users = (data || []).sort((a, b) => {
      const aActive = a.is_active !== false ? 1 : 0;
      const bActive = b.is_active !== false ? 1 : 0;

      if (aActive !== bActive) {
        return bActive - aActive;
      }

      return String(a.full_name || a.email || '').localeCompare(
        String(b.full_name || b.email || ''),
        'lt'
      );
    });
  }

  async function loadGroupsFromSupabase() {
    const { data: groupsData, error: groupsError } = await supabase
      .from('driver_groups')
      .select('id, name, created_by, created_at')
      .order('created_at', { ascending: false });

    if (groupsError) {
      console.error('Groups load error:', groupsError);
      groups = [];
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

  async function loadInstructionsFromSupabase() {
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

  async function refreshUsersUi() {
    await loadUsersFromSupabase();

    fillUserSearchSuggestions();
    renderUsersList();
    fillDriverSuggestions();
    renderSelectedGroupDrivers();
    renderGroupsList();
  }

  async function refreshGroupsUi() {
    await loadGroupsFromSupabase();

    fillGroupSearchSuggestions();
    renderGroupsList();
    renderSelectedGroupDrivers();
  }

  async function refreshInstructionsUi() {
    await loadInstructionsFromSupabase();

    fillSearchSuggestions();
    renderInstrList();
  }

  function normalizeHeader(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\uFEFF/g, '')
      .replace(/\s+/g, ' ');
  }

  function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());

    return result;
  }

  function detectDelimiter(firstLine) {
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    if (tabCount > semicolonCount && tabCount > commaCount) return '\t';
    if (semicolonCount >= commaCount) return ';';
    return ',';
  }

  function parseCSV(text) {
    const cleanText = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    if (!cleanText) return [];

    const lines = cleanText
      .split('\n')
      .filter(line => line.trim());

    if (lines.length < 2) return [];

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCSVLine(lines[0], delimiter).map(normalizeHeader);

    return lines.slice(1).map(line => {
      const values = parseCSVLine(line, delimiter);
      const row = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      return row;
    });
  }

  function getCSVValue(row, possibleHeaders) {
    for (const header of possibleHeaders) {
      const normalized = normalizeHeader(header);

      if (row[normalized] !== undefined && String(row[normalized]).trim()) {
        return String(row[normalized]).trim();
      }
    }

    return '';
  }

  function normalizeDateValue(value) {
    const raw = String(value || '').trim();

    if (!raw) return null;

    const normalized = raw.replaceAll('.', '-').replaceAll('/', '-');
    const parts = normalized.split('-').map(part => part.trim());

    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }

      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    return raw;
  }

  function normalizeDriverRow(row) {
  const fullName = getCSVValue(row, [
    'Vardas/ Pavardė',
    'Vardas / Pavardė',
    'Vardas/Pavardė',
    'full_name',
    'name'
  ]);

  const position = getCSVValue(row, [
    'Pareigos',
    'position'
  ]);

  const phone = getCSVValue(row, [
    'Mobilusis telefonas',
    'Telefonas',
    'phone'
  ]);

  const email = getCSVValue(row, [
    'El. paštas',
    'El. Pastas',
    'Email',
    'E-mail',
    'email'
  ]).toLowerCase();

  const terminationDate = getCSVValue(row, [
    'Atleidimo data',
    'termination_date'
  ]);

  return {
    'Vardas/ Pavardė': fullName || null,
    'Pareigos': position || null,
    'Mobilusis telefonas': phone || null,
    'El. paštas': email || null,
    'Atleidimo data': terminationDate || null,
    full_name: fullName || null,
    imported_by: currentUser.id,
    process_status: 'new',
    process_error: null,
    processed_at: null
  };
}

  async function findExistingDriver(driver) {
    if (driver.tab_number) {
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('tab_number', driver.tab_number)
        .maybeSingle();

      if (!error && data?.id) {
        return data.id;
      }
    }

    if (driver.email) {
      const { data, error } = await supabase
        .from('drivers')
        .select('id')
        .eq('email', driver.email)
        .maybeSingle();

      if (!error && data?.id) {
        return data.id;
      }
    }

    return null;
  }

  async function importDriversFromCSV(file) {
    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      throw new Error('CSV faile nerasta duomenų.');
    }

    const normalizedRows = rows
      .map(normalizeDriverRow)
      .filter(row => row.full_name || row.tab_number || row.email);

    if (!normalizedRows.length) {
      throw new Error('Nepavyko atpažinti vairuotojų duomenų. Patikrink CSV antraštes.');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const driver of normalizedRows) {
      if (!driver.full_name) {
        skipped++;
        continue;
      }

      const existingId = await findExistingDriver(driver);

      if (existingId) {
        const { error } = await supabase
          .from('drivers')
          .update(driver)
          .eq('id', existingId);

        if (error) {
          console.error('Driver update error:', error, driver);
          skipped++;
          continue;
        }

        updated++;
      } else {
        const { error } = await supabase
          .from('drivers')
          .insert(driver);

        if (error) {
          console.error('Driver insert error:', error, driver);
          skipped++;
          continue;
        }

        created++;
      }
    }

    return {
      total: normalizedRows.length,
      created,
      updated,
      skipped
    };
  }

  await loadUsersFromSupabase();
  await loadGroupsFromSupabase();
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
      instrList.innerHTML = `<div class="text-slate-400">Nėra instrukcijų</div>`;
      return;
    }

    instrList.innerHTML = list.map(item => `
      <div class="bg-slate-800 rounded-lg p-3 flex items-center justify-between" data-id="${item.id}">
        <div class="pr-4">
          <div class="font-semibold">${escapeHtml(item.title)}</div>
          <div class="text-sm text-slate-400">${escapeHtml(item.description || '')}</div>
          <div class="text-xs text-slate-500 mt-1 uppercase">
            ${escapeHtml(item.lang)} · ${escapeHtml(item.type)}
          </div>
        </div>

        <div class="flex gap-2 shrink-0">
          ${canManageInstructions ? `<button class="edit-btn bg-yellow-600 px-2 py-1 rounded text-xs">✏️</button>` : ''}
          ${canManageInstructions ? `<button class="delete-btn bg-red-600 px-2 py-1 rounded text-xs">🗑</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function fillUserSearchSuggestions() {
    if (!userSearchList) return;

    const visibleUsers = isAdmin
      ? users
      : users.filter(item => item.role === 'driver');

    userSearchList.innerHTML = visibleUsers.map(item =>
      `<option value="${escapeHtml(item.full_name || item.email)}"></option>`
    ).join('');
  }

  function renderUsersList() {
    const q = (userSearch?.value || '').toLowerCase().trim();

    let visibleUsers = isAdmin
      ? users
      : users.filter(item => item.role === 'driver');

    if (q) {
      visibleUsers = visibleUsers.filter(item =>
        (item.full_name || '').toLowerCase().includes(q) ||
        (item.email || '').toLowerCase().includes(q) ||
        (item.role || '').toLowerCase().includes(q)
      );
    }

    visibleUsers = visibleUsers.sort((a, b) => {
      const aActive = a.is_active !== false ? 1 : 0;
      const bActive = b.is_active !== false ? 1 : 0;

      if (aActive !== bActive) {
        return bActive - aActive;
      }

      return String(a.full_name || a.email || '').localeCompare(
        String(b.full_name || b.email || ''),
        'lt'
      );
    });

    if (!visibleUsers.length) {
      usersList.innerHTML = `<div class="text-slate-400">Nėra vartotojų</div>`;
      return;
    }

    usersList.innerHTML = visibleUsers.map(item => `
      <div class="bg-slate-800 rounded-lg p-3 flex items-center justify-between ${item.is_active === false ? 'opacity-60' : ''}" data-user-id="${item.id}">
        <div class="pr-4">
          <div class="font-semibold">${escapeHtml(item.full_name || '-')}</div>
          <div class="text-sm text-slate-400">${escapeHtml(item.email || '-')}</div>
          <div class="text-xs text-slate-500 mt-1 uppercase">
            ${escapeHtml(item.role)} · ${(item.lang || 'lt').toUpperCase()}
          </div>
          <div class="text-xs ${item.is_active === false ? 'text-red-400' : 'text-green-400'} mt-1">
            ${item.is_active === false ? 'Išjungtas' : 'Aktyvus'}
          </div>
        </div>

        <div class="flex gap-2 shrink-0">
          ${isAdmin ? `<button class="user-edit-btn bg-yellow-600 px-2 py-1 rounded text-xs">✏️</button>` : ''}
          ${isAdmin ? `<button class="user-toggle-btn ${item.is_active === false ? 'bg-green-700' : 'bg-slate-600'} px-2 py-1 rounded text-xs">${item.is_active === false ? 'Įjungti' : 'Išjungti'}</button>` : ''}
        </div>
      </div>
    `).join('');
  }

  function fillDriverSuggestions() {
    if (!groupDriverSearchList) return;

    groupDriverSearchList.innerHTML = getDrivers().map(driver =>
      `<option value="${escapeHtml(driver.full_name || driver.email)}"></option>`
    ).join('');
  }

  function renderSelectedGroupDrivers() {
    if (!groupSelectedDrivers) return;

    const drivers = getDrivers().filter(driver =>
      selectedGroupDriverIds.includes(driver.id)
    );

    if (!drivers.length) {
      groupSelectedDrivers.innerHTML = `<div class="text-slate-400 text-sm">Pasirinktų vairuotojų nėra</div>`;
      return;
    }

    groupSelectedDrivers.innerHTML = drivers.map(driver => `
      <div class="bg-slate-800 px-3 py-2 rounded flex items-center gap-2" data-driver-id="${driver.id}">
        <span>${escapeHtml(driver.full_name || driver.email)}</span>
        <button class="remove-group-driver text-red-400 text-xs">✖</button>
      </div>
    `).join('');
  }

  function fillGroupSearchSuggestions() {
    if (!groupSearchList) return;

    groupSearchList.innerHTML = groups.map(group =>
      `<option value="${escapeHtml(group.name)}"></option>`
    ).join('');
  }

  function renderGroupsList() {
    if (!groupsList) return;

    const q = (groupSearch?.value || '').toLowerCase().trim();

    let list = groups;

    if (q) {
      list = list.filter(group =>
        (group.name || '').toLowerCase().includes(q)
      );
    }

    if (!list.length) {
      groupsList.innerHTML = `<div class="text-slate-400">Nėra grupių</div>`;
      return;
    }

    groupsList.innerHTML = list.map(group => {
      const driverNames = getDrivers()
        .filter(driver => group.driverIds.includes(driver.id))
        .map(driver => driver.full_name || driver.email);

      return `
        <div class="bg-slate-800 rounded-lg p-3 flex items-center justify-between" data-group-id="${group.id}">
          <div class="pr-4">
            <div class="font-semibold">${escapeHtml(group.name)}</div>
            <div class="text-sm text-slate-400">${escapeHtml(driverNames.join(', ') || 'Nėra vairuotojų')}</div>
          </div>

          <div class="flex gap-2 shrink-0">
            <button class="group-edit-btn bg-yellow-600 px-2 py-1 rounded text-xs">✏️</button>
            <button class="group-delete-btn bg-red-600 px-2 py-1 rounded text-xs">🗑</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function clearUserForm() {
    document.getElementById('userName').value = '';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Slaptažodis';
    document.getElementById('userEmail').value = '';
    document.getElementById('userRole').value = 'driver';
    document.getElementById('userLang').value = 'lt';
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
  fillUserSearchSuggestions();
  renderUsersList();
  fillDriverSuggestions();
  renderSelectedGroupDrivers();
  fillGroupSearchSuggestions();
  renderGroupsList();

  instrSearch?.addEventListener('input', renderInstrList);
  userSearch?.addEventListener('input', renderUsersList);
  groupSearch?.addEventListener('input', renderGroupsList);

  importDriversBtn?.addEventListener('click', async () => {
    if (!isAdmin) return;

    const file = driversImportFile?.files?.[0];

    if (!file) {
      setImportResult('Pasirink CSV failą.', 'error');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportResult('Įkelk CSV failą. XLSX pirma išsaugok kaip CSV UTF-8.', 'error');
      return;
    }

    importDriversBtn.disabled = true;
    importDriversBtn.classList.add('opacity-60', 'cursor-not-allowed');

    setImportResult('Importuojama...', 'info');

    try {
      const result = await importDriversFromCSV(file);

      setImportResult(
        `Importas baigtas.<br>
        <span class="text-slate-300">
          Iš viso: ${result.total} · Nauji: ${result.created} · Atnaujinti: ${result.updated} · Praleisti: ${result.skipped}
        </span>`,
        'success'
      );

      if (driversImportFile) {
        driversImportFile.value = '';
      }

    } catch (err) {
      console.error('Drivers import error:', err);
      setImportResult(err?.message || 'Importo klaida.', 'error');

    } finally {
      importDriversBtn.disabled = false;
      importDriversBtn.classList.remove('opacity-60', 'cursor-not-allowed');
    }
  });

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

    if (item) {
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
      const confirmed = confirm('Ar tikrai ištrinti instrukciją?');
      if (!confirmed) return;

      const { error } = await supabase
        .from('instructions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('Nepavyko ištrinti instrukcijos');
        return;
      }

      await refreshInstructionsUi();
    }
  });

  usersList.addEventListener('click', async (e) => {
    if (!isAdmin) return;

    const card = e.target.closest('[data-user-id]');
    if (!card) return;

    const id = card.dataset.userId;
    const selectedUser = users.find(item => String(item.id) === String(id));
    if (!selectedUser) return;

    if (e.target.closest('.user-edit-btn')) {
      editUserId = id;

      document.getElementById('userName').value = selectedUser.full_name || '';

      const usernameInput = document.getElementById('userUsername');
      if (usernameInput) usernameInput.value = selectedUser.email || '';

      const passwordInput = document.getElementById('userPassword');
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.placeholder = 'Keičiant profilį slaptažodžio nereikia';
      }

      document.getElementById('userEmail').value = selectedUser.email || '';
      document.getElementById('userRole').value = selectedUser.role || 'driver';
      document.getElementById('userLang').value = selectedUser.lang || 'lt';
      return;
    }

    if (e.target.closest('.user-toggle-btn')) {
      const newStatus = selectedUser.is_active === false ? true : false;

      const { data, error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', selectedUser.id)
        .select('id, is_active')
        .single();

      if (error) {
        console.error('User status update error:', error);
        alert('Nepavyko pakeisti vartotojo būsenos. Patikrink RLS policy.');
        return;
      }

      if (!data) {
        alert('Vartotojo būsena nepakeista.');
        return;
      }

      await refreshUsersUi();

      alert(newStatus ? 'Vartotojas įjungtas' : 'Vartotojas išjungtas');
      return;
    }
  });

  document.getElementById('saveUserBtn')?.addEventListener('click', async () => {
    if (!isAdmin) return;

    const name = document.getElementById('userName').value.trim();
    const username = document.getElementById('userUsername')?.value.trim();
    const password = document.getElementById('userPassword')?.value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const userRole = document.getElementById('userRole').value;
    const userLang = document.getElementById('userLang').value || 'lt';

    if (!name || !email) {
      alert('Užpildyk vardą, pavardę ir el. paštą');
      return;
    }

    if (!editUserId && !password) {
      alert('Naujam vartotojui būtinas slaptažodis');
      return;
    }

    const wasEditing = Boolean(editUserId);

    if (editUserId) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          email,
          role: userRole,
          lang: userLang
        })
        .eq('id', editUserId);

      if (error) {
        console.error(error);
        alert('Nepavyko išsaugoti vartotojo');
        return;
      }

      editUserId = null;
    } else {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          full_name: name,
          username,
          email,
          password,
          role: userRole,
          lang: userLang
        }
      });

      if (error || data?.error) {
        console.error('Create user error:', error || data?.error);
        alert(data?.error || error?.message || 'Nepavyko sukurti vartotojo');
        return;
      }
    }

    clearUserForm();
    await refreshUsersUi();

    alert(wasEditing ? 'Vartotojas atnaujintas' : 'Vartotojas sukurtas');
  });

  groupDriverSearch?.addEventListener('change', () => {
    const value = (groupDriverSearch.value || '').trim();
    if (!value) return;

    const driver = getDrivers().find(item =>
      (item.full_name || item.email) === value
    );

    if (!driver) return;

    if (!selectedGroupDriverIds.includes(driver.id)) {
      selectedGroupDriverIds.push(driver.id);
    }

    groupDriverSearch.value = '';
    renderSelectedGroupDrivers();
  });

  groupSelectedDrivers?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-driver-id]');
    if (!item) return;

    if (e.target.closest('.remove-group-driver')) {
      const driverId = item.dataset.driverId;
      selectedGroupDriverIds = selectedGroupDriverIds.filter(id => String(id) !== String(driverId));
      renderSelectedGroupDrivers();
    }
  });

  saveGroupBtn?.addEventListener('click', async () => {
    const name = (groupNameInput?.value || '').trim();

    if (!name) {
      alert('Įvesk grupės pavadinimą');
      return;
    }

    if (!selectedGroupDriverIds.length) {
      alert('Pasirink bent vieną vairuotoją');
      return;
    }

    const duplicate = groups.find(group =>
      group.name.toLowerCase() === name.toLowerCase() &&
      String(group.id) !== String(editGroupId)
    );

    if (duplicate) {
      alert('Tokia grupė jau yra');
      return;
    }

    let groupId = editGroupId;

    if (editGroupId) {
      const { error } = await supabase
        .from('driver_groups')
        .update({ name })
        .eq('id', editGroupId);

      if (error) {
        console.error(error);
        alert('Nepavyko atnaujinti grupės');
        return;
      }

      const { error: deleteMembersError } = await supabase
        .from('driver_group_members')
        .delete()
        .eq('group_id', editGroupId);

      if (deleteMembersError) {
        console.error(deleteMembersError);
        alert('Nepavyko atnaujinti grupės narių');
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('driver_groups')
        .insert({
          name,
          created_by: currentUser.id
        })
        .select('id')
        .single();

      if (error) {
        console.error(error);
        alert('Nepavyko sukurti grupės');
        return;
      }

      groupId = data.id;
    }

    const memberRows = selectedGroupDriverIds.map(driverId => ({
      group_id: groupId,
      driver_id: driverId
    }));

    const { error: membersError } = await supabase
      .from('driver_group_members')
      .insert(memberRows);

    if (membersError) {
      console.error(membersError);
      alert('Grupė sukurta, bet nepavyko pridėti vairuotojų');
      return;
    }

    editGroupId = null;
    selectedGroupDriverIds = [];

    if (groupNameInput) groupNameInput.value = '';
    if (groupDriverSearch) groupDriverSearch.value = '';

    await refreshGroupsUi();

    alert('Grupė išsaugota');
  });

  groupsList?.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-group-id]');
    if (!card) return;

    const id = card.dataset.groupId;
    const group = groups.find(item => String(item.id) === String(id));
    if (!group) return;

    if (e.target.closest('.group-edit-btn')) {
      editGroupId = id;

      if (groupNameInput) groupNameInput.value = group.name || '';

      selectedGroupDriverIds = [...group.driverIds];
      renderSelectedGroupDrivers();
      return;
    }

    if (e.target.closest('.group-delete-btn')) {
      const confirmed = confirm('Ar tikrai ištrinti grupę?');
      if (!confirmed) return;

      const { error } = await supabase
        .from('driver_groups')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(error);
        alert('Nepavyko ištrinti grupės');
        return;
      }

      editGroupId = null;
      selectedGroupDriverIds = [];

      if (groupNameInput) groupNameInput.value = '';
      if (groupDriverSearch) groupDriverSearch.value = '';

      await refreshGroupsUi();
    }
  });

  document.getElementById('saveBtn')?.addEventListener('click', async () => {
    if (!canManageInstructions) return;

    const type = typeSelect.value;

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('desc').value.trim();

    if (!title || !description) {
      alert('Įvesk instrukcijos pavadinimą ir aprašymą');
      return;
    }

    const payload = {
      title,
      description,
      type,
      lang: langSelect.value || 'lt',
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
        .eq('id', editInstructionId);

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
      alert('Nepavyko išsaugoti instrukcijos');
      return;
    }

    localStorage.removeItem('editInstructionId');
    editInstructionId = null;

    clearInstructionForm();
    await refreshInstructionsUi();

    alert('Instrukcija išsaugota!');
  });

  function renderDashboardPreview() {
    const preview = document.getElementById('dashboardPreview');
    if (!preview) return;

    const images = JSON.parse(localStorage.getItem('dashboardImages') || '[]');

    preview.innerHTML = images.map(img => `
      <div class="bg-slate-800 rounded overflow-hidden">
        <img src="${img}" class="w-full h-auto" />
      </div>
    `).join('');
  }

  renderDashboardPreview();

  document.getElementById('saveDashboardImages')?.addEventListener('click', () => {
    if (!isAdmin) return;

    const files = document.getElementById('dashboardUpload').files;

    if (!files.length) {
      alert('Pasirink JPEG');
      return;
    }

    let images = [];
    let loaded = 0;

    Array.from(files).forEach(file => {
      const reader = new FileReader();

      reader.onload = e => {
        images.push(e.target.result);
        loaded++;

        if (loaded === files.length) {
          localStorage.setItem('dashboardImages', JSON.stringify(images));
          renderDashboardPreview();
          alert('Dashboard atnaujintas!');
          window.navigateTo('dashboard');
        }
      };

      reader.readAsDataURL(file);
    });
  });
}