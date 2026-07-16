import { t } from '../../i18n.js';

export async function initMasterDriver({ supabase, user, profile }) {
  const tx = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };
  const role = profile?.role || 'driver';
  const canManage = ['admin', 'instructor', 'master_driver'].includes(role);
  const canReview = ['admin', 'instructor'].includes(role);
  const canOpenPage = ['admin', 'instructor', 'master_driver', 'driver'].includes(role);

  if (!canOpenPage) {
    alert(tx('loading_schemes.no_permission', 'Neturite teisės naudoti šio puslapio'));
    window.navigateTo('dashboard');
    return;
  }

  function tr(key, fallback) {
    const value = t(key);
    if (!value || value === key) return fallback;
    return value;
  }

  const state = {
    sourceTasks: [],
    schemes: [],
    cars: [],
    photos: [],
    locations: [],
    models: {},
    carRows: [],
    selectedSourceTaskId: '',
    files: new Map()
  };

  const requiredPhotoCategories = [
    'truck_side_required',
    'trailer_side_required',
    'full_carrier_side_required'
  ];

  const photoLabelKeys = {
    truck_side_required: ['loading_schemes.photo_truck_side', 'Autovežis iš šono'],
    trailer_side_required: ['loading_schemes.photo_trailer_side', 'Priekaba iš šono'],
    full_carrier_side_required: ['loading_schemes.photo_full_side', 'Visas autovežis iš šono'],
    extra_1: ['loading_schemes.extra_1', 'Papildoma 1'],
    extra_2: ['loading_schemes.extra_2', 'Papildoma 2'],
    extra_3: ['loading_schemes.extra_3', 'Papildoma 3']
  };

  function photoLabel(category) {
    const cfg = photoLabelKeys[category];
    return cfg ? tr(cfg[0], cfg[1]) : category;
  }

  const el = {
    manageArea: document.getElementById('ksManageArea'),
    activeCount: document.getElementById('ksActiveCount'),
    waitingCount: document.getElementById('ksWaitingCount'),
    approvedCount: document.getElementById('ksApprovedCount'),
    sourceTask: document.getElementById('ksSourceTask'),
    locationsList: document.getElementById('ksLocationsList'),
    makeList: document.getElementById('ksMakeList'),
    cars: document.getElementById('ksCars'),
    addCar: document.getElementById('ksAddCar'),
    submitBtn: document.getElementById('ksSubmitBtn'),
    activeList: document.getElementById('ksActiveList'),
    waitingList: document.getElementById('ksWaitingList'),
    approvedList: document.getElementById('ksApprovedList'),
    activeSearch: document.getElementById('ksActiveSearch'),
    approvedSearch: document.getElementById('ksApprovedSearch'),
    modal: document.getElementById('ksModal'),
    modalContent: document.getElementById('ksModalContent'),
    modalClose: document.getElementById('ksModalClose')
  };

  if (!canManage && el.manageArea) {
    el.manageArea.classList.add('hidden');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function text(id) {
    return document.getElementById(id)?.value?.trim() || null;
  }

  function statusLabel(status) {
    const map = {
      active: tx('loading_schemes.status_active', 'Aktyvi'),
      waiting_approval: tx('loading_schemes.status_waiting', 'Laukia patvirtinimo'),
      approved: tx('loading_schemes.status_approved', 'Patvirtinta'),
      needs_changes: tx('loading_schemes.status_changes', 'Grąžinta taisymui'),
      rejected: tx('loading_schemes.status_rejected', 'Atmesta')
    };

    return map[status] || status || '-';
  }

  function statusClass(status) {
    if (status === 'approved') return 'bg-green-600';
    if (status === 'waiting_approval') return 'bg-yellow-600';
    if (status === 'needs_changes') return 'bg-orange-600';
    if (status === 'rejected') return 'bg-red-600';
    return 'bg-blue-600';
  }

  function getPhotoUrl(filePath) {
    const { data } = supabase
      .storage
      .from('loading-scheme-photos')
      .getPublicUrl(filePath);

    return data?.publicUrl || '';
  }

  function formatDate(value) {
    if (!value) return '-';

    return new Intl.DateTimeFormat('lt-LT', {
      timeZone: 'Europe/Vilnius',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  }

  function locationLabel(row) {
    if (!row) return '';

    return (
      row.name ||
      row.title ||
      row.location_name ||
      row.location ||
      row.address ||
      row.city ||
      row.place ||
      row.label ||
      String(row.id || '')
    );
  }

  function getSchemeCars(schemeId) {
    return state.cars
      .filter(car => String(car.scheme_id) === String(schemeId))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  function getSchemePhotos(schemeId) {
    return state.photos.filter(photo => String(photo.scheme_id) === String(schemeId));
  }

  function getSchemeBySourceTask(taskId) {
    return state.schemes.find(item => String(item.source_task_id) === String(taskId));
  }

  function getTaskName(task) {
    return task?.title || tr('loading_schemes.task_fallback', 'Krovimo schemos užduotis');
  }

  function getMakeOptions() {
    return Object.keys(state.models || {}).sort((a, b) => a.localeCompare(b));
  }

  function getModelOptions(make) {
    const key = getMakeOptions().find(item => item.toLowerCase() === String(make || '').toLowerCase());
    return key ? (state.models[key] || []) : [];
  }

  function renderModelDatalists() {
    document.querySelectorAll('[data-model-list]').forEach(node => node.remove());

    state.carRows.forEach((row, index) => {
      const datalist = document.createElement('datalist');
      datalist.id = `ksModelList${index}`;
      datalist.dataset.modelList = String(index);
      datalist.innerHTML = getModelOptions(row.make)
        .map(model => `<option value="${escapeHtml(model)}"></option>`)
        .join('');
      document.body.appendChild(datalist);
    });
  }

  function renderModelDatalistForRow(index) {
    const old = document.getElementById(`ksModelList${index}`);
    if (!old) return;

    const row = state.carRows[index] || {};
    old.innerHTML = getModelOptions(row.make)
      .map(model => `<option value="${escapeHtml(model)}"></option>`)
      .join('');
  }

  function renderMakeList() {
    if (!el.makeList) return;

    el.makeList.innerHTML = getMakeOptions()
      .map(make => `<option value="${escapeHtml(make)}"></option>`)
      .join('');
  }

  function renderLocationsList() {
    if (!el.locationsList) return;

    el.locationsList.innerHTML = state.locations
      .map(row => `<option value="${escapeHtml(locationLabel(row))}"></option>`)
      .join('');
  }

  function renderCounters() {
    const active = getActiveSourceTasks().length;
    const waiting = state.schemes.filter(s => s.status === 'waiting_approval').length;
    const approved = state.schemes.filter(s => s.status === 'approved').length;

    if (el.activeCount) el.activeCount.textContent = active;
    if (el.waitingCount) el.waitingCount.textContent = waiting;
    if (el.approvedCount) el.approvedCount.textContent = approved;
  }

  function getActiveSourceTasks() {
    return state.sourceTasks.filter(task => {
      const scheme = getSchemeBySourceTask(task.id);
      if (!scheme) return true;
      return ['active', 'needs_changes', 'rejected'].includes(scheme.status);
    });
  }

  function renderSourceTaskSelect() {
    if (!el.sourceTask) return;

    const activeTasks = getActiveSourceTasks();

    el.sourceTask.innerHTML = `
      <option value="">${escapeHtml(tr('loading_schemes.no_task_option', 'Be užduoties / rekomenduojama schema'))}</option>
      ${activeTasks.map(task => {
        const scheme = getSchemeBySourceTask(task.id);
        const suffix = scheme?.status === 'needs_changes' ? ` · ${tr('loading_schemes.returned_for_changes_suffix', 'grąžinta taisymui')}` : '';
        return `<option value="${task.id}">${escapeHtml(getTaskName(task) + suffix)}</option>`;
      }).join('')}
    `;
  }

  function renderCarRows() {
    if (!el.cars) return;

    if (!state.carRows.length) {
      state.carRows = [{ make: '', model: '', count: 1 }];
    }

    el.cars.innerHTML = state.carRows.map((row, index) => `
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_44px] gap-2 bg-slate-900 border border-slate-700 rounded-xl p-3" data-car-row="${index}">
        <input class="ks-car-make w-full p-3 bg-slate-800 rounded-xl border border-slate-700" list="ksMakeList" autocomplete="off" placeholder="${escapeHtml(tr('loading_schemes.car_make', 'Markė'))}" value="${escapeHtml(row.make)}">
        <input class="ks-car-model w-full p-3 bg-slate-800 rounded-xl border border-slate-700" list="ksModelList${index}" autocomplete="off" placeholder="${escapeHtml(tr('loading_schemes.car_model', 'Modelis'))}" value="${escapeHtml(row.model)}">
        <input class="ks-car-count w-full p-3 bg-slate-800 rounded-xl border border-slate-700" type="number" min="1" placeholder="${escapeHtml(tr('loading_schemes.car_count', 'Kiekis'))}" value="${escapeHtml(row.count || 1)}">
        <button type="button" class="ks-remove-car bg-red-600 hover:bg-red-700 rounded-xl px-3 py-2 ${state.carRows.length <= 1 ? 'hidden' : ''}">×</button>
      </div>
    `).join('');

    renderModelDatalists();
  }

  function collectCarRows() {
    const rows = [];

    document.querySelectorAll('[data-car-row]').forEach((row, index) => {
      const make = row.querySelector('.ks-car-make')?.value?.trim() || '';
      const model = row.querySelector('.ks-car-model')?.value?.trim() || '';
      const count = Number(row.querySelector('.ks-car-count')?.value || 0);

      if (make || model || count) {
        rows.push({ make, model, count: count || 1, sort_order: index });
      }
    });

    state.carRows = rows.length ? rows : [{ make: '', model: '', count: 1 }];

    return state.carRows;
  }

  function getSelectedScheme() {
    if (!state.selectedSourceTaskId) return null;
    return getSchemeBySourceTask(state.selectedSourceTaskId) || null;
  }

  function getSelectedSchemePhotos() {
    const scheme = getSelectedScheme();
    if (!scheme) return [];
    return getSchemePhotos(scheme.id);
  }

  function renderPhotoCards() {
    document.querySelectorAll('.ks-photo-card').forEach(card => {
      const category = card.dataset.category;
      const label = photoLabel(category);
      const required = requiredPhotoCategories.includes(category);
      const existing = getSelectedSchemePhotos().find(photo => photo.category === category);
      const file = state.files.get(category);
      const previewUrl = file ? URL.createObjectURL(file) : existing ? getPhotoUrl(existing.file_path) : '';

      card.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 h-full">
          <div class="font-semibold text-sm mb-2">
            ${escapeHtml(label)} ${required ? '<span class="text-red-400">*</span>' : ''}
          </div>

          <div class="h-32 border border-dashed border-slate-600 rounded-xl flex items-center justify-center overflow-hidden bg-slate-900 text-slate-400 text-sm mb-3">
            ${previewUrl ? `<img src="${previewUrl}" class="w-full h-full object-cover" alt="">` : escapeHtml(tr('loading_schemes.photo', 'Nuotrauka'))}
          </div>

          <label class="cursor-pointer flex items-center justify-center min-h-[40px] text-center bg-blue-600 hover:bg-blue-700 rounded-xl px-3 py-2 text-sm">
            ${escapeHtml(tr('loading_schemes.choose_or_photo', 'Pasirinkti / fotografuoti'))}
            <input type="file" accept="image/*" capture="environment" class="hidden ks-photo-input" data-category="${escapeHtml(category)}">
          </label>
        </div>
      `;
    });
  }

  function fillFormFromTask(taskId) {
    state.selectedSourceTaskId = taskId || '';
    state.files.clear();

    const task = state.sourceTasks.find(item => String(item.id) === String(taskId));
    const scheme = getSchemeBySourceTask(taskId);
    const schemeCars = scheme ? getSchemeCars(scheme.id) : [];

    document.getElementById('ksLoadingPlace').value = scheme?.loading_place || '';
    document.getElementById('ksDestination').value = scheme?.destination || '';
    document.getElementById('ksCarrierType').value = scheme?.carrier_type || '';
    document.getElementById('ksSchemeDescription').value = scheme?.scheme_description || task?.description || '';
    document.getElementById('ksMasterComment').value = scheme?.master_driver_comment || '';

    state.carRows = schemeCars.length
      ? schemeCars.map(car => ({ make: car.car_make || '', model: car.car_model || '', count: car.car_count || 1 }))
      : [{ make: '', model: '', count: 1 }];

    renderCarRows();
    renderPhotoCards();
  }

  function renderActiveList() {
    if (!el.activeList) return;

    const query = (el.activeSearch?.value || '').toLowerCase().trim();

    const activeTasks = getActiveSourceTasks().filter(task => {
      if (!query) return true;
      return [task.title, task.description].some(value => String(value || '').toLowerCase().includes(query));
    });

    if (!activeTasks.length) {
      el.activeList.innerHTML = `<div class="text-slate-400">${escapeHtml(tr('loading_schemes.no_active_tasks', 'Aktyvių užduočių nėra'))}</div>`;
      return;
    }

    el.activeList.innerHTML = activeTasks.map(task => {
      const scheme = getSchemeBySourceTask(task.id);
      return `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="font-semibold">${escapeHtml(getTaskName(task))}</div>
              <div class="text-sm text-slate-400 mt-1">${escapeHtml(task.description || '')}</div>
            </div>
            <button type="button" class="ks-select-task bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 text-sm font-semibold" data-id="${task.id}">
              ${escapeHtml(tr('loading_schemes.fill', 'Pildyti'))}
            </button>
          </div>
          ${scheme?.instructor_comment ? `
            <div class="mt-3 bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm">
              <div class="text-slate-400 mb-1">${escapeHtml(tr('loading_schemes.instructor_comment', 'Instruktoriaus komentaras'))}:</div>
              <div>${escapeHtml(scheme.instructor_comment)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function renderWaitingList() {
    if (!el.waitingList) return;

    const waiting = state.schemes.filter(s => s.status === 'waiting_approval');

    if (!waiting.length) {
      el.waitingList.innerHTML = `<div class="text-slate-400">${escapeHtml(tr('loading_schemes.no_waiting_tasks', 'Laukiančių patvirtinimo nėra'))}</div>`;
      return;
    }

    el.waitingList.innerHTML = waiting.map(scheme => `
      <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div class="font-semibold">${escapeHtml(scheme.loading_place || '-')} → ${escapeHtml(scheme.destination || '-')}</div>
            <div class="text-sm text-slate-400 mt-1">${escapeHtml(scheme.carrier_type || '-')} · ${formatDate(scheme.submitted_at)}</div>
          </div>
          <span class="text-xs px-3 py-1 rounded-full ${statusClass(scheme.status)} w-fit">${statusLabel(scheme.status)}</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
          <button type="button" class="ks-open bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl p-2 text-sm" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.open', 'Atidaryti'))}</button>
          ${canReview ? `
            <button type="button" class="ks-approve bg-green-600 hover:bg-green-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.approve', 'Patvirtinti'))}</button>
            <button type="button" class="ks-change bg-yellow-600 hover:bg-yellow-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.comment', 'Komentaras'))}</button>
            <button type="button" class="ks-reject bg-red-600 hover:bg-red-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.reject', 'Atmesti'))}</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderApprovedList() {
    if (!el.approvedList) return;

    const q = (el.approvedSearch?.value || '').toLowerCase().trim();

    const approved = state.schemes.filter(scheme => {
      if (scheme.status !== 'approved') return false;
      if (!q) return true;

      const cars = getSchemeCars(scheme.id)
        .map(car => `${car.car_make} ${car.car_model}`)
        .join(' ');

      return [
        scheme.loading_place,
        scheme.destination,
        scheme.carrier_type,
        scheme.scheme_description,
        cars
      ].some(value => String(value || '').toLowerCase().includes(q));
    });

    if (!approved.length) {
      el.approvedList.innerHTML = `<div class="text-slate-400">${escapeHtml(tr('loading_schemes.no_approved', 'Patvirtintų schemų nėra'))}</div>`;
      return;
    }

    el.approvedList.innerHTML = approved.map(scheme => {
      const cars = getSchemeCars(scheme.id);
      return `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div class="font-semibold">${escapeHtml(scheme.loading_place || '-')} → ${escapeHtml(scheme.destination || '-')}</div>
              <div class="text-sm text-slate-400 mt-1">${escapeHtml(scheme.carrier_type || '-')} · ${escapeHtml(tr('loading_schemes.approved_at', 'Patvirtinta'))}: ${formatDate(scheme.approved_at)}</div>
            </div>
            <button type="button" class="ks-open bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-sm" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.open', 'Atidaryti'))}</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${cars.map(car => `<span class="text-xs bg-slate-900 border border-slate-700 rounded-full px-3 py-1">${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.</span>`).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderCounters();
    renderSourceTaskSelect();
    renderLocationsList();
    renderMakeList();
    renderActiveList();
    renderWaitingList();
    renderApprovedList();
    renderPhotoCards();
  }

  async function loadModels() {
    try {
      const res = await fetch('models.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('models.json not found');
      state.models = await res.json();
    } catch (err) {
      console.warn('Models load error:', err);
      state.models = {};
    }
  }

  async function loadLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*');

    if (error) {
      console.warn('Locations load error:', error);
      state.locations = [];
      return;
    }

    state.locations = (data || []).sort((a, b) => locationLabel(a).localeCompare(locationLabel(b)));
  }

  async function loadData() {
    await loadModels();
    await loadLocations();

    if (canManage) {
      let query = supabase
        .from('tasks')
        .select('id, title, description, status, driver_id, created_at, due_at, task_type')
        .eq('task_type', 'loading_scheme')
        .order('created_at', { ascending: false });

      const { data: tasks, error: tasksError } = await query;

      if (tasksError) {
        console.error('Loading scheme source tasks error:', tasksError);
        alert('Nepavyko užkrauti krovimo schemų užduočių. Patikrink, ar tasks lentelėje yra task_type stulpelis.');
        state.sourceTasks = [];
      } else {
        state.sourceTasks = (tasks || []).filter(task => task.status !== 'done');
      }
    }

    const { data: schemes, error: schemesError } = await supabase
      .from('loading_scheme_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (schemesError) {
      console.error('Loading schemes error:', schemesError);
      alert('Nepavyko užkrauti krovimo schemų');
      return;
    }

    state.schemes = schemes || [];

    const ids = state.schemes.map(s => s.id);

    if (!ids.length) {
      state.cars = [];
      state.photos = [];
      renderAll();
      return;
    }

    const { data: cars, error: carsError } = await supabase
      .from('loading_scheme_cars')
      .select('*')
      .in('scheme_id', ids)
      .order('sort_order', { ascending: true });

    if (carsError) {
      console.error('Loading scheme cars error:', carsError);
      state.cars = [];
    } else {
      state.cars = cars || [];
    }

    const { data: photos, error: photosError } = await supabase
      .from('loading_scheme_photos')
      .select('*')
      .in('scheme_id', ids)
      .order('created_at', { ascending: true });

    if (photosError) {
      console.error('Loading scheme photos error:', photosError);
      state.photos = [];
    } else {
      state.photos = photos || [];
    }

    renderAll();
  }

  function validateBeforeSubmit() {
    if (!text('ksLoadingPlace')) {
      alert(tr('loading_schemes.choose_loading_place', 'Pasirinkite pasikrovimą'));
      return false;
    }

    if (!text('ksDestination')) {
      alert(tr('loading_schemes.choose_unloading_place', 'Pasirinkite išsikrovimą'));
      return false;
    }

    if (!text('ksCarrierType')) {
      alert(tr('loading_schemes.choose_carrier_type', 'Pasirinkite autovežio tipą'));
      return false;
    }

    const cars = collectCarRows();
    const invalidCar = cars.find(row => !row.make || !row.count);

    if (invalidCar) {
      alert(tr('loading_schemes.enter_car_make_count', 'Įveskite automobilio markę ir kiekį'));
      return false;
    }

    const existingPhotos = getSelectedSchemePhotos();

    for (const category of requiredPhotoCategories) {
      const hasNew = state.files.has(category);
      const hasExisting = existingPhotos.some(photo => photo.category === category);

      if (!hasNew && !hasExisting) {
        alert(`${tr('loading_schemes.required_photo_alert', 'Privaloma nuotrauka')}: ${photoLabel(category)}`);
        return false;
      }
    }

    return true;
  }

  async function uploadPhotos(schemeId) {
    const rows = [];

    for (const [category, file] of state.files.entries()) {
      const safeName = String(file.name || 'photo.jpg')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'photo.jpg';

      const filePath = `${schemeId}/${category}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('loading-scheme-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type || 'image/jpeg',
          upsert: false
        });

      if (uploadError) throw uploadError;

      rows.push({
        scheme_id: schemeId,
        category,
        file_path: filePath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        is_required: requiredPhotoCategories.includes(category),
        uploaded_by: user.id
      });
    }

    if (!rows.length) return;

    const { error: insertError } = await supabase
      .from('loading_scheme_photos')
      .insert(rows);

    if (insertError) throw insertError;
  }

  async function saveAndSubmit() {
    if (!validateBeforeSubmit()) return;

    if (el.submitBtn) {
      el.submitBtn.disabled = true;
      el.submitBtn.textContent = tr('loading_schemes.submitting', 'Pateikiama...');
    }

    try {
      const existing = getSelectedScheme();
      const payload = {
        source_task_id: state.selectedSourceTaskId || null,
        client: null,
        loading_place: text('ksLoadingPlace'),
        destination: text('ksDestination'),
        carrier_type: text('ksCarrierType'),
        scheme_description: text('ksSchemeDescription'),
        master_driver_comment: text('ksMasterComment'),
        status: 'waiting_approval',
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let schemeId = existing?.id;

      if (existing) {
        const { error } = await supabase
          .from('loading_scheme_tasks')
          .update(payload)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('loading_scheme_tasks')
          .insert({
            ...payload,
            created_by: user.id
          })
          .select('id')
          .single();

        if (error) throw error;
        schemeId = data.id;
      }

      const cars = collectCarRows();

      await supabase
        .from('loading_scheme_cars')
        .delete()
        .eq('scheme_id', schemeId);

      const carRows = cars.map((car, index) => ({
        scheme_id: schemeId,
        car_make: car.make,
        car_model: car.model || null,
        car_count: Number(car.count) || 1,
        sort_order: index
      }));

      const { error: carsError } = await supabase
        .from('loading_scheme_cars')
        .insert(carRows);

      if (carsError) throw carsError;

      await uploadPhotos(schemeId);

      alert(tr('loading_schemes.submitted_success', 'Schema pateikta patvirtinimui'));
      clearForm();
      await loadData();

    } catch (err) {
      console.error('Loading scheme submit error:', err);
      alert(err?.message || tr('loading_schemes.submit_error', 'Nepavyko pateikti patvirtinimui'));

    } finally {
      if (el.submitBtn) {
        el.submitBtn.disabled = false;
        el.submitBtn.textContent = tr('loading_schemes.submit_for_approval_full', 'Pateikti užpildytą schemą patvirtinimui');
      }
    }
  }

  function clearForm() {
    state.selectedSourceTaskId = '';
    state.files.clear();
    state.carRows = [{ make: '', model: '', count: 1 }];

    if (el.sourceTask) el.sourceTask.value = '';

    ['ksLoadingPlace', 'ksDestination', 'ksCarrierType', 'ksSchemeDescription', 'ksMasterComment'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });

    renderCarRows();
    renderPhotoCards();
  }

  async function updateSchemeStatus(id, status, comment = null) {
    const payload = {
      status,
      updated_at: new Date().toISOString()
    };

    if (comment !== null) payload.instructor_comment = comment;

    if (status === 'approved') {
      payload.approved_by = user.id;
      payload.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('loading_scheme_tasks')
      .update(payload)
      .eq('id', id);

    if (error) {
      console.error('Loading scheme status error:', error);
      alert(tr('loading_schemes.status_update_error', 'Nepavyko atnaujinti statuso'));
      return;
    }

    if (status === 'approved') {
      const { data: schemeRow } = await supabase
        .from('loading_scheme_tasks')
        .select('source_task_id')
        .eq('id', id)
        .maybeSingle();

      if (schemeRow?.source_task_id) {
        await supabase
          .from('tasks')
          .update({
            status: 'done',
            approved_at: new Date().toISOString(),
            approved_by: user.id,
            completion_type: 'loading_scheme'
          })
          .eq('id', schemeRow.source_task_id);
      }
    }

    el.modal?.classList.add('hidden');
    await loadData();
  }

  function openImageViewer(url, title = '') {
    if (!url) return;

    document.getElementById('ksImageViewer')?.remove();

    const viewer = document.createElement('div');
    viewer.id = 'ksImageViewer';
    viewer.className = 'fixed inset-0 z-[10050] bg-black/90 flex items-center justify-center p-4';
    viewer.innerHTML = `
      <div class="relative max-w-6xl w-full max-h-[94vh] flex flex-col items-center">
        <button type="button" class="ks-image-close fixed top-4 right-4 z-[10060] bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full w-12 h-12 text-2xl">×</button>
        <img src="${escapeHtml(url)}" class="max-w-full max-h-[86vh] object-contain rounded-xl" alt="">
        ${title ? `<div class="mt-3 text-slate-300 text-sm">${escapeHtml(title)}</div>` : ''}<div class="mt-2 text-slate-500 text-xs">${escapeHtml(tx('loading_schemes.close_photo_hint', 'Uždaryti: X arba paspauskite tamsų foną'))}</div>
      </div>
    `;

    document.body.appendChild(viewer);

    viewer.addEventListener('click', event => {
      if (event.target === viewer || event.target.closest('.ks-image-close')) viewer.remove();
    });
  }

  function openScheme(id) {
    const scheme = state.schemes.find(item => String(item.id) === String(id));
    if (!scheme || !el.modal || !el.modalContent) return;

    const cars = getSchemeCars(scheme.id);
    const photos = getSchemePhotos(scheme.id);

    el.modalContent.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400">${escapeHtml(tr('loading_schemes.loading_place', 'Pasikrovimas'))}</div><div class="font-semibold">${escapeHtml(scheme.loading_place || '-')}</div></div>
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400">${escapeHtml(tr('loading_schemes.unloading_place', 'Išsikrovimas'))}</div><div class="font-semibold">${escapeHtml(scheme.destination || '-')}</div></div>
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400">${escapeHtml(tr('loading_schemes.carrier_type', 'Autovežio tipas'))}</div><div class="font-semibold">${escapeHtml(scheme.carrier_type || '-')}</div></div>
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400">${escapeHtml(tr('loading_schemes.status', 'Statusas'))}</div><div class="font-semibold">${escapeHtml(statusLabel(scheme.status))}</div></div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-2">${escapeHtml(tr('loading_schemes.cars', 'Automobiliai'))}</div>
          <div class="space-y-2">
            ${cars.map(car => `<div class="bg-slate-900 border border-slate-700 rounded-xl p-3">${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.</div>`).join('') || `<div class="text-slate-500">${escapeHtml(tr('loading_schemes.no_cars', 'Automobilių nėra'))}</div>`}
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">${escapeHtml(tr('loading_schemes.scheme_description', 'Schemos aprašymas'))}</div>
          <div class="whitespace-pre-line">${escapeHtml(scheme.scheme_description || '-')}</div>
        </div>

        ${scheme.master_driver_comment ? `<div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400 text-sm mb-1">${escapeHtml(tr('loading_schemes.master_comment', 'Master driver komentaras'))}</div><div class="whitespace-pre-line">${escapeHtml(scheme.master_driver_comment)}</div></div>` : ''}
        ${scheme.instructor_comment ? `<div class="bg-slate-800 rounded-xl p-3 border border-slate-700"><div class="text-slate-400 text-sm mb-1">Instruktoriaus komentaras</div><div class="whitespace-pre-line">${escapeHtml(scheme.instructor_comment)}</div></div>` : ''}

        <div>
          <div class="text-slate-400 text-sm mb-2">${escapeHtml(tr('loading_schemes.photos', 'Nuotraukos'))}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${photos.map(photo => {
              const url = getPhotoUrl(photo.file_path);
              const label = photoLabel(photo.category);
              return `<button type="button" class="ks-photo-view block text-left bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" data-url="${escapeHtml(url)}" data-title="${escapeHtml(label)}"><img src="${url}" class="w-full h-40 object-cover" alt=""><div class="p-2 text-xs text-slate-400">${escapeHtml(label)}</div></button>`;
            }).join('') || `<div class="text-slate-500">${escapeHtml(tr('loading_schemes.no_photos', 'Nuotraukų nėra'))}</div>`}
          </div>
        </div>

        ${canReview && ['waiting_approval', 'needs_changes', 'rejected'].includes(scheme.status) ? `
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button type="button" class="ks-modal-approve bg-green-600 hover:bg-green-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.approve', 'Patvirtinti'))}</button>
            <button type="button" class="ks-modal-change bg-yellow-600 hover:bg-yellow-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.comment', 'Komentaras'))}</button>
            <button type="button" class="ks-modal-reject bg-red-600 hover:bg-red-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">${escapeHtml(tr('loading_schemes.reject', 'Atmesti'))}</button>
          </div>
        ` : ''}
      </div>
    `;

    el.modal.classList.remove('hidden');
  }

  el.addCar?.addEventListener('click', () => {
    collectCarRows();
    state.carRows.push({ make: '', model: '', count: 1 });
    renderCarRows();
  });

  el.cars?.addEventListener('input', event => {
    const rowEl = event.target.closest('[data-car-row]');
    if (!rowEl) return;

    const index = Number(rowEl.dataset.carRow);
    collectCarRows();

    if (event.target.classList.contains('ks-car-make')) {
      const modelInput = rowEl.querySelector('.ks-car-model');
      if (modelInput) modelInput.value = '';
      state.carRows[index].model = '';
      renderModelDatalistForRow(index);
    }
  });

  el.cars?.addEventListener('click', event => {
    const btn = event.target.closest('.ks-remove-car');
    if (!btn) return;

    const row = btn.closest('[data-car-row]');
    const index = Number(row?.dataset.carRow);

    collectCarRows();
    state.carRows.splice(index, 1);
    renderCarRows();
  });

  el.sourceTask?.addEventListener('change', () => {
    if (isFormDirty()) {
      const ok = confirm(tr('loading_schemes.interrupt_confirm', 'Jau pradėtas pildymas. Ar tikrai nutraukti dabartinį pildymą ir atidaryti kitą užduotį?'));
      if (!ok) {
        el.sourceTask.value = state.selectedSourceTaskId || '';
        return;
      }
    }

    fillFormFromTask(el.sourceTask.value);
  });

  document.addEventListener('change', event => {
    const input = event.target.closest('.ks-photo-input');
    if (!input) return;

    const category = input.dataset.category;
    const file = input.files?.[0];

    if (!category || !file) return;

    if (!file.type.startsWith('image/')) {
      alert(tr('loading_schemes.images_only', 'Galima kelti tik nuotraukas'));
      input.value = '';
      return;
    }

    state.files.set(category, file);
    renderPhotoCards();
  });

  el.submitBtn?.addEventListener('click', saveAndSubmit);

  function isFormDirty() {
    const cars = collectCarRows();

    return Boolean(
      text('ksLoadingPlace') ||
      text('ksDestination') ||
      text('ksCarrierType') ||
      text('ksSchemeDescription') ||
      text('ksMasterComment') ||
      state.files.size ||
      cars.some(row => row.make || row.model || Number(row.count || 0) !== 1)
    );
  }


  function isFormDirty() {
    collectCarRows();
    return Boolean(
      text('ksLoadingPlace') ||
      text('ksDestination') ||
      text('ksCarrierType') ||
      text('ksSchemeDescription') ||
      text('ksMasterComment') ||
      state.files.size ||
      state.carRows.some(row => row.make || row.model || Number(row.count || 0) > 1)
    );
  }

  function confirmDiscardIfDirty(nextTaskId) {
    if (!isFormDirty()) return true;
    if (String(state.selectedSourceTaskId || '') === String(nextTaskId || '')) return true;
    return confirm(tx('loading_schemes.discard_confirm', 'Jau pradėjote pildyti schemą. Ar tikrai nutraukti pildymą ir atidaryti kitą užduotį?'));
  }

  el.activeList?.addEventListener('click', event => {
    const btn = event.target.closest('.ks-select-task');
    if (!btn) return;

    if (isFormDirty()) {
      const ok = confirm(tr('loading_schemes.interrupt_confirm', 'Jau pradėtas pildymas. Ar tikrai nutraukti dabartinį pildymą ir atidaryti kitą užduotį?'));
      if (!ok) return;
    }

    if (!confirmDiscardIfDirty(btn.dataset.id)) return;
    if (el.sourceTask) el.sourceTask.value = btn.dataset.id;
    fillFormFromTask(btn.dataset.id);
    document.getElementById('ksSourceTask')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  el.waitingList?.addEventListener('click', async event => {
    const openBtn = event.target.closest('.ks-open');
    const approveBtn = event.target.closest('.ks-approve');
    const changeBtn = event.target.closest('.ks-change');
    const rejectBtn = event.target.closest('.ks-reject');

    if (openBtn) {
      openScheme(openBtn.dataset.id);
      return;
    }

    if (approveBtn) {
      await updateSchemeStatus(approveBtn.dataset.id, 'approved');
      return;
    }

    if (changeBtn) {
      const comment = prompt(tr('loading_schemes.change_comment_prompt', 'Įrašykite komentarą, ką reikia pakeisti:'));
      if (comment === null) return;
      await updateSchemeStatus(changeBtn.dataset.id, 'needs_changes', comment);
      return;
    }

    if (rejectBtn) {
      const comment = prompt(tr('loading_schemes.reject_comment_prompt', 'Įrašykite atmetimo priežastį:'));
      if (comment === null) return;
      await updateSchemeStatus(rejectBtn.dataset.id, 'rejected', comment);
    }
  });

  el.approvedList?.addEventListener('click', event => {
    const openBtn = event.target.closest('.ks-open');
    if (!openBtn) return;
    openScheme(openBtn.dataset.id);
  });

  el.activeSearch?.addEventListener('input', renderActiveList);
  el.approvedSearch?.addEventListener('input', renderApprovedList);

  el.modalContent?.addEventListener('click', async event => {
    const photoBtn = event.target.closest('.ks-photo-view');
    const approveBtn = event.target.closest('.ks-modal-approve');
    const changeBtn = event.target.closest('.ks-modal-change');
    const rejectBtn = event.target.closest('.ks-modal-reject');

    if (photoBtn) {
      openImageViewer(photoBtn.dataset.url, photoBtn.dataset.title);
      return;
    }

    if (approveBtn) {
      await updateSchemeStatus(approveBtn.dataset.id, 'approved');
      return;
    }

    if (changeBtn) {
      const comment = prompt(tr('loading_schemes.change_comment_prompt', 'Įrašykite komentarą, ką reikia pakeisti:'));
      if (comment === null) return;
      await updateSchemeStatus(changeBtn.dataset.id, 'needs_changes', comment);
      return;
    }

    if (rejectBtn) {
      const comment = prompt(tr('loading_schemes.reject_comment_prompt', 'Įrašykite atmetimo priežastį:'));
      if (comment === null) return;
      await updateSchemeStatus(rejectBtn.dataset.id, 'rejected', comment);
    }
  });

  el.modalClose?.addEventListener('click', () => {
    el.modal?.classList.add('hidden');
  });

  el.modal?.addEventListener('click', event => {
    if (event.target === el.modal) {
      el.modal.classList.add('hidden');
    }
  });

  renderCarRows();
  renderPhotoCards();
  await loadData();
}
