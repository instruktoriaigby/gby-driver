import { t } from '../../i18n.js';

export async function initMasterDriver({ supabase, user, profile }) {
  const tx = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };

  const role = profile?.role || 'driver';

  const canViewApprovedSchemes = [
    'admin',
    'instructor',
    'master_driver',
    'driver',
    'truck_instructor',
    'truck_master_driver',
    'truck_driver'
  ].includes(role);

  const canFillLoadingSchemes = [
    'admin',
    'instructor',
    'master_driver',
    'truck_instructor',
    'truck_master_driver'
  ].includes(role);

  const canReviewLoadingSchemes = [
    'admin',
    'instructor',
    'truck_instructor'
  ].includes(role);

  const canUseSchemeAdminActions = [
    'admin',
    'instructor',
    'truck_instructor'
  ].includes(role);

  const transportMode =
    profile?.effective_transport_mode ||
    profile?.app_transport_mode ||
    profile?.transport_mode ||
    window.getAppTransportMode?.() ||
    'car_transporter';

  const isTruckMode = transportMode === 'truck';
  const GBY_LOGO_SRC = '/Logo_GBY.jpg';

  const canManage = canFillLoadingSchemes;
  const canReview = canReviewLoadingSchemes;
  const canOpenPage = canViewApprovedSchemes;

  const driverRolesForMode = isTruckMode ? ['truck_driver'] : ['driver'];

  if (!canOpenPage) {
    alert(tx('loading_schemes.no_permission', 'Neturite teisės naudoti šio puslapio'));
    window.navigateTo?.('dashboard');
    return;
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
    selectedSchemeId: '',
    files: new Map(),
    drivers: []
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

  if (!canFillLoadingSchemes) {
    el.manageArea?.classList.add('hidden');

    document.getElementById('ksActiveSection')?.classList.add('hidden');
    document.getElementById('ksFormSection')?.classList.add('hidden');
    document.getElementById('ksRequiredPhotosSection')?.classList.add('hidden');
    document.getElementById('ksWaitingSection')?.classList.add('hidden');

    el.activeList?.closest('section')?.classList.add('hidden');
    el.waitingList?.closest('section')?.classList.add('hidden');
    el.sourceTask?.closest('section')?.classList.add('hidden');
  }

  if (!canManage && el.manageArea) {
    el.manageArea.classList.add('hidden');
  }

  function tr(key, fallback) {
    const value = t(key);
    return value && value !== key ? value : fallback;
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

  function photoLabel(category) {
    const cfg = photoLabelKeys[category];
    return cfg ? tr(cfg[0], cfg[1]) : category;
  }

  function statusLabel(status) {
    const map = {
      active: tx('loading_schemes.status_active', 'Aktyvi'),
      waiting_approval: tx('loading_schemes.status_waiting', 'Laukia patvirtinimo'),
      approved: tx('loading_schemes.status_approved', 'Patvirtinta'),
      needs_changes: tx('loading_schemes.status_changes', 'Reikalingi pataisymai'),
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

  async function getLogoDataUrl() {
    const absoluteUrl = `${window.location.origin}${GBY_LOGO_SRC}`;

    try {
      const response = await fetch(absoluteUrl, { cache: 'no-store' });

      if (!response.ok) {
        console.warn('Logo not found:', absoluteUrl);
        return absoluteUrl;
      }

      const blob = await response.blob();

      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || absoluteUrl);
        reader.onerror = () => resolve(absoluteUrl);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('Logo load error:', error);
      return absoluteUrl;
    }
  }

  function getSchemeTitle(cars) {
    const first = cars?.[0];

    if (!first) return 'Schema';

    const make = String(first.car_make || '').trim();
    const model = String(first.car_model || '').trim();
    const count = Number(first.car_count || 0);

    return `Schema ${[make, model].filter(Boolean).join(' ')}${count ? ` - ${count} vnt` : ''}`;
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

  function getSchemeById(schemeId) {
    return state.schemes.find(item => String(item.id) === String(schemeId));
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

  function getNeedsChangesSchemes() {
    return state.schemes.filter(scheme => scheme.status === 'needs_changes');
  }

  function renderCounters() {
    const active = getActiveSourceTasks().length + getNeedsChangesSchemes().length;
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

      return scheme.status === 'active';
    });
  }

  function renderSourceTaskSelect() {
    if (!el.sourceTask) return;

    const activeTasks = getActiveSourceTasks();

    el.sourceTask.innerHTML = `
      <option value="">${escapeHtml(tr('loading_schemes.no_task_option', 'Be užduoties / rekomenduojama schema'))}</option>
      ${activeTasks.map(task => {
        return `<option value="${task.id}">${escapeHtml(getTaskName(task))}</option>`;
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
        rows.push({
          make,
          model,
          count: count || 1,
          sort_order: index
        });
      }
    });

    state.carRows = rows.length ? rows : [{ make: '', model: '', count: 1 }];

    return state.carRows;
  }

  function getSelectedScheme() {
    if (state.selectedSchemeId) {
      return getSchemeById(state.selectedSchemeId) || null;
    }

    if (state.selectedSourceTaskId) {
      return getSchemeBySourceTask(state.selectedSourceTaskId) || null;
    }

    return null;
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
      const previewUrl = file
        ? URL.createObjectURL(file)
        : existing
          ? getPhotoUrl(existing.file_path)
          : '';

      card.innerHTML = `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 h-full">
          <div class="font-semibold text-sm mb-2">
            ${escapeHtml(label)} ${required ? '<span class="text-red-400">*</span>' : ''}
          </div>

          <div class="h-32 border border-dashed border-slate-600 rounded-xl flex items-center justify-center overflow-hidden bg-slate-900 text-slate-400 text-sm mb-3">
            ${previewUrl ? `<img src="${escapeHtml(previewUrl)}" class="w-full h-full object-cover" alt="">` : escapeHtml(tr('loading_schemes.photo', 'Nuotrauka'))}
          </div>

          <div class="grid grid-cols-2 gap-2">
            <label class="cursor-pointer flex items-center justify-center min-h-[40px] text-center bg-blue-600 hover:bg-blue-700 rounded-xl px-3 py-2 text-sm">
              ${escapeHtml(tr('loading_schemes.take_photo', 'Fotografuoti'))}
              <input type="file" accept="image/*" capture="environment" class="hidden ks-photo-input" data-category="${escapeHtml(category)}">
            </label>

            <label class="cursor-pointer flex items-center justify-center min-h-[40px] text-center bg-slate-700 hover:bg-slate-600 rounded-xl px-3 py-2 text-sm">
              ${escapeHtml(tr('loading_schemes.gallery', 'Galerija'))}
              <input type="file" accept="image/*" class="hidden ks-photo-input" data-category="${escapeHtml(category)}">
            </label>
          </div>
        </div>
      `;
    });
  }

  function fillFormFromTask(taskId) {
    state.selectedSourceTaskId = taskId || '';
    state.files.clear();

    const task = state.sourceTasks.find(item => String(item.id) === String(taskId));
    const scheme = getSchemeBySourceTask(taskId);

    state.selectedSchemeId = scheme?.id || '';

    const schemeCars = scheme ? getSchemeCars(scheme.id) : [];

    const loadingPlace = document.getElementById('ksLoadingPlace');
    const destination = document.getElementById('ksDestination');
    const carrierType = document.getElementById('ksCarrierType');
    const schemeDescription = document.getElementById('ksSchemeDescription');
    const masterComment = document.getElementById('ksMasterComment');

    if (loadingPlace) loadingPlace.value = scheme?.loading_place || '';
    if (destination) destination.value = scheme?.destination || '';
    if (carrierType) carrierType.value = scheme?.carrier_type || '';
    if (schemeDescription) schemeDescription.value = scheme?.scheme_description || task?.description || '';
    if (masterComment) masterComment.value = scheme?.master_driver_comment || '';

    state.carRows = schemeCars.length
      ? schemeCars.map(car => ({
          make: car.car_make || '',
          model: car.car_model || '',
          count: car.car_count || 1
        }))
      : [{ make: '', model: '', count: 1 }];

    renderCarRows();
    renderPhotoCards();
  }

  function fillFormFromScheme(schemeId) {
    const scheme = getSchemeById(schemeId);
    if (!scheme) return;

    state.selectedSchemeId = scheme.id;
    state.selectedSourceTaskId = scheme.source_task_id || '';
    state.files.clear();

    if (el.sourceTask) {
      el.sourceTask.value = scheme.source_task_id || '';
    }

    const schemeCars = getSchemeCars(scheme.id);

    const loadingPlace = document.getElementById('ksLoadingPlace');
    const destination = document.getElementById('ksDestination');
    const carrierType = document.getElementById('ksCarrierType');
    const schemeDescription = document.getElementById('ksSchemeDescription');
    const masterComment = document.getElementById('ksMasterComment');

    if (loadingPlace) loadingPlace.value = scheme.loading_place || '';
    if (destination) destination.value = scheme.destination || '';
    if (carrierType) carrierType.value = scheme.carrier_type || '';
    if (schemeDescription) schemeDescription.value = scheme.scheme_description || '';
    if (masterComment) masterComment.value = scheme.master_driver_comment || '';

    state.carRows = schemeCars.length
      ? schemeCars.map(car => ({
          make: car.car_make || '',
          model: car.car_model || '',
          count: car.car_count || 1
        }))
      : [{ make: '', model: '', count: 1 }];

    renderCarRows();
    renderPhotoCards();
  }

  function schemeMatchesQuery(scheme, query) {
    if (!query) return true;

    const cars = getSchemeCars(scheme.id)
      .map(car => `${car.car_make} ${car.car_model}`)
      .join(' ');

    return [
      scheme.loading_place,
      scheme.destination,
      scheme.carrier_type,
      scheme.scheme_description,
      scheme.master_driver_comment,
      scheme.instructor_comment,
      cars
    ].some(value => String(value || '').toLowerCase().includes(query));
  }

  function taskMatchesQuery(task, query) {
    if (!query) return true;

    return [task.title, task.description].some(value =>
      String(value || '').toLowerCase().includes(query)
    );
  }

  function renderActiveList() {
    if (!el.activeList) return;

    const query = (el.activeSearch?.value || '').toLowerCase().trim();

    const needsChangesSchemes = getNeedsChangesSchemes()
      .filter(scheme => schemeMatchesQuery(scheme, query));

    const activeTasks = getActiveSourceTasks()
      .filter(task => taskMatchesQuery(task, query));

    if (!needsChangesSchemes.length && !activeTasks.length) {
      el.activeList.innerHTML = `<div class="text-slate-400">${escapeHtml(tr('loading_schemes.no_active_tasks', 'Aktyvių užduočių nėra'))}</div>`;
      return;
    }

    function renderNeedsChangesCard(scheme) {
      const cars = getSchemeCars(scheme.id);

      return `
        <div class="bg-orange-950/40 border border-orange-700 rounded-xl p-4">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div class="font-semibold text-orange-200">
                ${escapeHtml(scheme.loading_place || '-')} → ${escapeHtml(scheme.destination || '-')}
              </div>

              <div class="text-sm text-slate-400 mt-1">
                ${escapeHtml(scheme.carrier_type || '-')} · ${formatDate(scheme.updated_at)}
              </div>

              <div class="mt-2">
                <span class="text-xs px-3 py-1 rounded-full ${statusClass(scheme.status)}">
                  ${escapeHtml(statusLabel(scheme.status))}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="ks-select-scheme bg-orange-600 hover:bg-orange-700 rounded-xl px-4 py-2 text-sm font-semibold"
              data-id="${scheme.id}"
            >
              ${escapeHtml(tr('loading_schemes.fix_scheme', 'Taisyti'))}
            </button>
          </div>

          ${cars.length ? `
            <div class="mt-3 flex flex-wrap gap-2">
              ${cars.map(car => `
                <span class="text-xs bg-slate-900 border border-slate-700 rounded-full px-3 py-1">
                  ${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.
                </span>
              `).join('')}
            </div>
          ` : ''}

          ${scheme.instructor_comment ? `
            <div class="mt-3 bg-slate-900 border border-orange-700 rounded-xl p-3 text-sm">
              <div class="text-orange-300 font-semibold mb-1">
                ${escapeHtml(tr('loading_schemes.required_changes', 'Reikalingi pataisymai'))}:
              </div>
              <div class="whitespace-pre-line">${escapeHtml(scheme.instructor_comment)}</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    function renderTaskCard(task) {
      const scheme = getSchemeBySourceTask(task.id);

      return `
        <div class="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="font-semibold">${escapeHtml(getTaskName(task))}</div>
              <div class="text-sm text-slate-400 mt-1">${escapeHtml(task.description || '')}</div>

              ${scheme ? `
                <div class="mt-2">
                  <span class="text-xs px-3 py-1 rounded-full ${statusClass(scheme.status)}">
                    ${escapeHtml(statusLabel(scheme.status))}
                  </span>
                </div>
              ` : ''}
            </div>

            <button
              type="button"
              class="ks-select-task bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 text-sm font-semibold"
              data-id="${task.id}"
            >
              ${escapeHtml(tr('loading_schemes.fill', 'Pildyti'))}
            </button>
          </div>
        </div>
      `;
    }

    const blocks = [];

    if (needsChangesSchemes.length) {
      blocks.push(`
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold text-orange-300">
              ${escapeHtml(tr('loading_schemes.required_changes', 'Reikalingi pataisymai'))}
            </h3>
            <span class="text-xs bg-orange-600 rounded-full px-3 py-1">
              ${needsChangesSchemes.length}
            </span>
          </div>

          ${needsChangesSchemes.map(renderNeedsChangesCard).join('')}
        </div>
      `);
    }

    if (activeTasks.length) {
      blocks.push(`
        <div class="space-y-3 ${needsChangesSchemes.length ? 'mt-6 pt-5 border-t border-slate-700' : ''}">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">
              ${escapeHtml(tr('loading_schemes.active_tasks', 'Aktyvios užduotys'))}
            </h3>
            <span class="text-xs bg-blue-600 rounded-full px-3 py-1">
              ${activeTasks.length}
            </span>
          </div>

          ${activeTasks.map(renderTaskCard).join('')}
        </div>
      `);
    }

    el.activeList.innerHTML = blocks.join('');
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

          <span class="text-xs px-3 py-1 rounded-full ${statusClass(scheme.status)} w-fit">
            ${statusLabel(scheme.status)}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-4">
          <button type="button" class="ks-open bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl p-2 text-sm" data-id="${scheme.id}">
            ${escapeHtml(tr('loading_schemes.open', 'Atidaryti'))}
          </button>

          ${canReview ? `
            <button type="button" class="ks-approve bg-green-600 hover:bg-green-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.approve', 'Patvirtinti'))}
            </button>

            <button type="button" class="ks-change bg-yellow-600 hover:bg-yellow-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.comment', 'Komentaras'))}
            </button>

            <button type="button" class="ks-reject bg-red-600 hover:bg-red-700 rounded-xl p-2 text-sm" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.reject', 'Atmesti'))}
            </button>
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
              <div class="text-sm text-slate-400 mt-1">
                ${escapeHtml(scheme.carrier_type || '-')} · ${escapeHtml(tr('loading_schemes.approved_at', 'Patvirtinta'))}: ${formatDate(scheme.approved_at)}
              </div>
            </div>

            <button
              type="button"
              class="ks-open bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-sm"
              data-id="${scheme.id}"
            >
              ${escapeHtml(tr('loading_schemes.open', 'Atidaryti'))}
            </button>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            ${cars.map(car => `
              <span class="text-xs bg-slate-900 border border-slate-700 rounded-full px-3 py-1">
                ${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAll() {
    renderCounters();

    if (canFillLoadingSchemes) {
      renderSourceTaskSelect();
      renderLocationsList();
      renderMakeList();
      renderActiveList();
      renderWaitingList();
      renderPhotoCards();
    }

    renderApprovedList();
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

    state.locations = (data || []).sort((a, b) =>
      locationLabel(a).localeCompare(locationLabel(b))
    );
  }

  async function loadDrivers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, transport_mode')
      .in('role', driverRolesForMode)
      .eq('is_active', true)
      .eq('transport_mode', transportMode)
      .order('full_name', { ascending: true });

    if (error) {
      console.error('Drivers load error:', error);
      state.drivers = [];
      return;
    }

    state.drivers = data || [];
  }

  async function loadData() {
    await loadModels();
    await loadLocations();
    await loadDrivers();

    if (canManage) {
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, status, driver_id, created_at, due_at, task_type, transport_mode')
        .eq('task_type', 'loading_scheme')
        .eq('transport_mode', transportMode)
        .order('created_at', { ascending: false });

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
      .eq('transport_mode', transportMode)
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

    state.cars = carsError ? [] : (cars || []);
    if (carsError) console.error('Loading scheme cars error:', carsError);

    const { data: photos, error: photosError } = await supabase
      .from('loading_scheme_photos')
      .select('*')
      .in('scheme_id', ids)
      .order('created_at', { ascending: true });

    state.photos = photosError ? [] : (photos || []);
    if (photosError) console.error('Loading scheme photos error:', photosError);

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

    if (!isTruckMode && !text('ksCarrierType')) {
      alert(tr('loading_schemes.choose_carrier_type', 'Pasirinkite autovežio tipą'));
      return false;
    }

    const cars = collectCarRows();
    const invalidCar = cars.find(row => !row.make || !row.count);

    if (!isTruckMode && invalidCar) {
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
        source_task_id: state.selectedSourceTaskId || existing?.source_task_id || null,
        client: null,
        loading_place: text('ksLoadingPlace'),
        destination: text('ksDestination'),
        carrier_type: text('ksCarrierType'),
        scheme_description: text('ksSchemeDescription'),
        master_driver_comment: text('ksMasterComment'),
        status: 'waiting_approval',
        transport_mode: transportMode,
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let schemeId = existing?.id;

      if (existing) {
        const { error } = await supabase
          .from('loading_scheme_tasks')
          .update(payload)
          .eq('id', existing.id)
          .eq('transport_mode', transportMode);

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

      if (carRows.length) {
        const { error: carsError } = await supabase
          .from('loading_scheme_cars')
          .insert(carRows);

        if (carsError) throw carsError;
      }

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
    state.selectedSchemeId = '';
    state.files.clear();
    state.carRows = [{ make: '', model: '', count: 1 }];

    if (el.sourceTask) el.sourceTask.value = '';

    [
      'ksLoadingPlace',
      'ksDestination',
      'ksCarrierType',
      'ksSchemeDescription',
      'ksMasterComment'
    ].forEach(id => {
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

    if (['needs_changes', 'rejected', 'waiting_approval'].includes(status)) {
      payload.approved_by = null;
      payload.approved_at = null;
    }

    const { error } = await supabase
      .from('loading_scheme_tasks')
      .update(payload)
      .eq('id', id)
      .eq('transport_mode', transportMode);

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
        .eq('transport_mode', transportMode)
        .maybeSingle();

      if (schemeRow?.source_task_id) {
        await supabase
          .from('tasks')
          .update({
            status: 'done',
            approved_at: new Date().toISOString(),
            approved_by: user.id
          })
          .eq('id', schemeRow.source_task_id)
          .eq('transport_mode', transportMode);
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
        <button
          type="button"
          class="ks-image-close fixed top-4 right-4 z-[10060] bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full w-12 h-12 text-2xl"
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
      if (event.target === viewer || event.target.closest('.ks-image-close')) {
        viewer.remove();
      }
    });
  }

  function getSchemePdfHtml(scheme, cars, photos, logoSrc) {
    return `
      <div class="pdf-root">
        <div class="pdf-header">
          <h1 class="pdf-title">Schemos aprašymas</h1>
          <img src="${escapeHtml(logoSrc)}" class="pdf-logo" alt="GBY">
        </div>

        <div class="pdf-report">
          <div class="pdf-section">
            <div class="pdf-grid">
              <div class="pdf-card">
                <div class="pdf-label">${escapeHtml(tr('loading_schemes.loading_place', 'Pasikrovimas'))}</div>
                <div class="pdf-value">${escapeHtml(scheme.loading_place || '-')}</div>
              </div>

              <div class="pdf-card">
                <div class="pdf-label">${escapeHtml(tr('loading_schemes.unloading_place', 'Išsikrovimas'))}</div>
                <div class="pdf-value">${escapeHtml(scheme.destination || '-')}</div>
              </div>

              <div class="pdf-card">
                <div class="pdf-label">${escapeHtml(tr('loading_schemes.carrier_type', 'Autovežio tipas'))}</div>
                <div class="pdf-value">${escapeHtml(scheme.carrier_type || '-')}</div>
              </div>

              <div class="pdf-card">
                <div class="pdf-label">${escapeHtml(tr('loading_schemes.status', 'Statusas'))}</div>
                <div class="pdf-value">${escapeHtml(statusLabel(scheme.status))}</div>
              </div>
            </div>
          </div>

          <div class="pdf-card">
            <div class="pdf-label">${escapeHtml(tr('loading_schemes.cars', 'Automobiliai'))}</div>
            <div class="pdf-inner-card">
              ${cars.map(car => `${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.`).join('<br>') || escapeHtml(tr('loading_schemes.no_cars', 'Automobilių nėra'))}
            </div>
          </div>

          <div class="pdf-card">
            <div class="pdf-label">${escapeHtml(tr('loading_schemes.scheme_description', 'Schemos aprašymas'))}</div>
            <div class="pdf-text">${escapeHtml(scheme.scheme_description || '-')}</div>
          </div>

          ${scheme.master_driver_comment ? `
            <div class="pdf-card">
              <div class="pdf-label">${escapeHtml(tr('loading_schemes.master_comment', 'Master driver komentaras'))}</div>
              <div class="pdf-text">${escapeHtml(scheme.master_driver_comment)}</div>
            </div>
          ` : ''}

          ${scheme.instructor_comment ? `
            <div class="pdf-card">
              <div class="pdf-label">${escapeHtml(tr('loading_schemes.instructor_comment', 'Instruktoriaus komentaras'))}</div>
              <div class="pdf-text">${escapeHtml(scheme.instructor_comment)}</div>
            </div>
          ` : ''}

          <div class="pdf-photo-title">${escapeHtml(tr('loading_schemes.photos', 'Nuotraukos'))}</div>

          <div class="pdf-photo-grid">
            ${photos.map(photo => {
              const url = getPhotoUrl(photo.file_path);
              const label = photoLabel(photo.category);

              return `
                <div class="pdf-photo-card">
                  <img src="${escapeHtml(url)}" alt="">
                  <div class="pdf-photo-caption">${escapeHtml(label)}</div>
                </div>
              `;
            }).join('') || `<div class="pdf-muted">${escapeHtml(tr('loading_schemes.no_photos', 'Nuotraukų nėra'))}</div>`}
          </div>
        </div>
      </div>
    `;
  }

  async function printSchemePdf(schemeId) {
    const scheme = state.schemes.find(item => String(item.id) === String(schemeId));
    if (!scheme) return;

    const cars = getSchemeCars(scheme.id);
    const photos = getSchemePhotos(scheme.id);
    const logoSrc = await getLogoDataUrl();
    const title = getSchemeTitle(cars);
    const html = getSchemePdfHtml(scheme, cars, photos, logoSrc);

    const printWindow = window.open('', '_blank', 'width=900,height=1200');

    if (!printWindow) {
      alert('Naršyklė užblokavo PDF langą. Leiskite popup langus šiam puslapiui.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${escapeHtml(title)}</title>

          <style>
            @page {
              size: A4 portrait;
              margin: 4mm;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #ffffff;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .pdf-page {
              background: #ffffff;
              color: #111827;
              width: 202mm;
              height: 289mm;
              padding: 0;
              overflow: hidden;
              display: flex;
              justify-content: center;
              align-items: center;
            }

            .pdf-content {
              width: 190mm;
              max-width: 190mm;
              transform: none;
              transform-origin: top center;
            }

            .pdf-root {
              background: transparent;
              color: #111827;
              font-size: 13px;
              line-height: 1.25;
            }

            .pdf-report {
              background: #0f172a;
              color: #ffffff;
              padding: 10px;
              border-radius: 0;
            }

            .pdf-header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 16px;
              margin-bottom: 8px;
              color: #111827;
            }

            .pdf-title {
              font-size: 18px;
              line-height: 1.2;
              font-weight: 700;
              margin: 0;
              color: #111827;
            }

            .pdf-logo {
              width: 120px;
              height: auto;
              max-height: 48px;
              display: block;
              object-fit: contain;
              background: #ffffff;
              border-radius: 8px;
              padding: 4px 8px;
            }

            .pdf-section {
              margin-bottom: 12px;
            }

            .pdf-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
            }

            .pdf-card {
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 6px;
              margin-bottom: 5px;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .pdf-inner-card {
              background: #0f172a;
              border: 1px solid #334155;
              border-radius: 10px;
              padding: 11px;
              font-size: 14px;
              line-height: 1.3;
            }

            .pdf-label {
              color: #93c5fd;
              font-size: 12px;
              line-height: 1.2;
              margin-bottom: 4px;
            }

            .pdf-value {
              color: #ffffff;
              font-size: 13px;
              line-height: 1.25;
              font-weight: 700;
            }

            .pdf-text {
              color: #ffffff;
              font-size: 14px;
              line-height: 1.35;
              white-space: pre-line;
            }

            .pdf-photo-title {
              color: #bfdbfe;
              font-size: 13px;
              line-height: 1.2;
              margin-bottom: 8px;
            }

            .pdf-photo-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 6px;
            }

            .pdf-photo-card {
              background: #1e293b;
              border: 1px solid #334155;
              border-radius: 12px;
              overflow: hidden;
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .pdf-photo-card img {
              width: 100%;
              height: 190px;
              object-fit: cover;
              display: block;
            }

            .pdf-photo-caption {
              color: #bfdbfe;
              font-size: 11px;
              line-height: 1.2;
              padding: 8px;
            }

            .pdf-muted {
              color: #94a3b8;
              font-size: 13px;
            }

            @media print {
              html,
              body {
                width: 210mm;
                height: 297mm;
              }
            }
          </style>
        </head>

        <body>
          <div class="pdf-page">
            <div class="pdf-content" id="pdfContent">
              ${html}
            </div>
          </div>

          <script>
            function waitForImages() {
              const images = Array.from(document.images);

              if (!images.length) return Promise.resolve();

              return Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();

                return new Promise(resolve => {
                  img.addEventListener('load', resolve, { once: true });
                  img.addEventListener('error', resolve, { once: true });
                });
              }));
            }

            function fitToOnePage() {
              const page = document.querySelector('.pdf-page');
              const content = document.getElementById('pdfContent');

              if (!page || !content) return;

              content.style.zoom = '1';
              content.style.transform = 'none';

              const pageRect = page.getBoundingClientRect();
              const contentWidth = content.scrollWidth;
              const contentHeight = content.scrollHeight;

              const scale = Math.min(
                1,
                (pageRect.width - 12) / contentWidth,
                (pageRect.height - 12) / contentHeight
              );

              content.style.zoom = String(scale);
            }

            window.addEventListener('load', async () => {
              await waitForImages();
              fitToOnePage();
              setTimeout(() => window.print(), 300);
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function openAssignDriverModal(schemeId) {
    if (!canUseSchemeAdminActions) return;

    const scheme = state.schemes.find(item => String(item.id) === String(schemeId));
    if (!scheme) return;

    const cars = getSchemeCars(scheme.id);
    const title = getSchemeTitle(cars);

    document.getElementById('assignSchemeModal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'assignSchemeModal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 text-white shadow-2xl">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold">${escapeHtml(tr('loading_schemes.assign_driver_title', 'Skirti schemą vairuotojui'))}</h3>
          <button type="button" class="assign-close bg-slate-800 hover:bg-slate-700 rounded-xl px-3 py-2">×</button>
        </div>

        <div class="bg-slate-800 border border-slate-700 rounded-xl p-3 mb-4">
          <div class="text-slate-400 text-sm">${escapeHtml(tr('loading_schemes.assign_task', 'Užduotis'))}</div>
          <div class="font-semibold">${escapeHtml(title)}</div>
        </div>

        <label class="block text-sm text-slate-300 mb-1">
          ${escapeHtml(tr('loading_schemes.driver', 'Vairuotojas'))}
        </label>

        <input
          id="assignSchemeDriverSearch"
          type="search"
          autocomplete="off"
          class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3"
          placeholder="${escapeHtml(tr('loading_schemes.driver_search_placeholder', 'Rašykite vairuotojo vardą...'))}"
        >

        <input id="assignSchemeDriver" type="hidden" value="">

        <div
          id="assignSchemeDriverResults"
          class="mt-2 max-h-56 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl hidden"
        ></div>

        <div
          id="assignSchemeDriverSelected"
          class="mt-2 text-sm text-slate-400 hidden"
        ></div>

        <div class="mt-5 flex justify-end gap-3">
          <button type="button" class="assign-close bg-slate-700 hover:bg-slate-600 rounded-xl px-4 py-2">
            ${escapeHtml(tr('loading_schemes.cancel', 'Atšaukti'))}
          </button>

          <button type="button" class="assign-save bg-blue-600 hover:bg-blue-700 rounded-xl px-4 py-2 font-semibold">
            ${escapeHtml(tr('loading_schemes.create_task', 'Sukurti užduotį'))}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const driverSearch = modal.querySelector('#assignSchemeDriverSearch');
    const driverHidden = modal.querySelector('#assignSchemeDriver');
    const driverResults = modal.querySelector('#assignSchemeDriverResults');
    const driverSelected = modal.querySelector('#assignSchemeDriverSelected');

    function driverDisplayName(driver) {
      return driver.full_name || driver.email || driver.id;
    }

    function renderDriverResults(query = '') {
      if (!driverResults) return;

      const q = String(query || '').toLowerCase().trim();

      const matches = state.drivers
        .filter(driver => {
          const haystack = [
            driver.full_name,
            driver.email,
            driver.role
          ].join(' ').toLowerCase();

          return !q || haystack.includes(q);
        })
        .slice(0, 12);

      if (!matches.length) {
        driverResults.innerHTML = `
          <div class="p-3 text-sm text-slate-400">
            ${escapeHtml(tr('loading_schemes.driver_not_found', 'Vairuotojų nerasta'))}
          </div>
        `;
        driverResults.classList.remove('hidden');
        return;
      }

      driverResults.innerHTML = matches.map(driver => `
        <button
          type="button"
          class="assign-driver-result w-full text-left p-3 hover:bg-slate-800 border-b border-slate-800 last:border-b-0"
          data-driver-id="${escapeHtml(driver.id)}"
        >
          <div class="font-semibold">${escapeHtml(driverDisplayName(driver))}</div>
          ${driver.email ? `<div class="text-xs text-slate-400">${escapeHtml(driver.email)}</div>` : ''}
        </button>
      `).join('');

      driverResults.classList.remove('hidden');
    }

    driverSearch?.addEventListener('input', () => {
      if (driverHidden) driverHidden.value = '';

      if (driverSelected) {
        driverSelected.textContent = '';
        driverSelected.classList.add('hidden');
      }

      renderDriverResults(driverSearch.value);
    });

    driverSearch?.addEventListener('focus', () => {
      renderDriverResults(driverSearch.value);
    });

    driverResults?.addEventListener('click', event => {
      const btn = event.target.closest('.assign-driver-result');
      if (!btn) return;

      const driverId = btn.dataset.driverId;
      const driver = state.drivers.find(item => String(item.id) === String(driverId));

      if (!driver) return;

      if (driverHidden) driverHidden.value = driver.id;
      if (driverSearch) driverSearch.value = driverDisplayName(driver);

      if (driverSelected) {
        driverSelected.textContent = `${tr('loading_schemes.selected_driver', 'Pasirinkta')}: ${driverDisplayName(driver)}`;
        driverSelected.classList.remove('hidden');
      }

      driverResults.classList.add('hidden');
    });

    modal.addEventListener('click', async event => {
      if (event.target === modal || event.target.closest('.assign-close')) {
        modal.remove();
        return;
      }

      if (event.target.closest('.assign-save')) {
        const driverId = document.getElementById('assignSchemeDriver')?.value || '';

        if (!driverId) {
          alert(tr('loading_schemes.choose_driver_alert', 'Pasirinkite vairuotoją.'));
          return;
        }

        await createSchemeViewTask(scheme, driverId, title);
        modal.remove();
      }
    });
  }

  async function createSchemeViewTask(scheme, driverId, title) {
    if (!canUseSchemeAdminActions) return;

    const { error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: tr('loading_schemes.scheme_view_description', 'Peržiūrėti patvirtintą krovimo schemą.'),
        status: 'pending',
        driver_id: driverId,
        instruction_id: null,
        group_id: null,
        task_type: 'loading_scheme',
        transport_mode: scheme.transport_mode || transportMode,
        related_table: 'loading_scheme_tasks',
        related_id: scheme.id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        approved_at: null,
        approved_by: null,
        completion_type: null
      });

    if (error) {
      console.error('Scheme view task create error:', error);
      alert(error.message || tr('loading_schemes.scheme_task_create_error', 'Nepavyko sukurti užduoties vairuotojui.'));
      return;
    }

    alert(tr('loading_schemes.scheme_task_created', 'Užduotis vairuotojui sukurta.'));
  }

  function openScheme(id) {
    const scheme = state.schemes.find(item => String(item.id) === String(id));
    if (!scheme || !el.modal || !el.modalContent) return;

    const cars = getSchemeCars(scheme.id);
    const photos = getSchemePhotos(scheme.id);

    el.modalContent.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${escapeHtml(tr('loading_schemes.loading_place', 'Pasikrovimas'))}</div>
            <div class="font-semibold">${escapeHtml(scheme.loading_place || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${escapeHtml(tr('loading_schemes.unloading_place', 'Išsikrovimas'))}</div>
            <div class="font-semibold">${escapeHtml(scheme.destination || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${escapeHtml(tr('loading_schemes.carrier_type', 'Autovežio tipas'))}</div>
            <div class="font-semibold">${escapeHtml(scheme.carrier_type || '-')}</div>
          </div>

          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400">${escapeHtml(tr('loading_schemes.status', 'Statusas'))}</div>
            <div class="font-semibold">${escapeHtml(statusLabel(scheme.status))}</div>
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-2">${escapeHtml(tr('loading_schemes.cars', 'Automobiliai'))}</div>
          <div class="space-y-2">
            ${cars.map(car => `
              <div class="bg-slate-900 border border-slate-700 rounded-xl p-3">
                ${escapeHtml(car.car_make)} ${escapeHtml(car.car_model || '')} · ${escapeHtml(car.car_count)} vnt.
              </div>
            `).join('') || `<div class="text-slate-500">${escapeHtml(tr('loading_schemes.no_cars', 'Automobilių nėra'))}</div>`}
          </div>
        </div>

        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div class="text-slate-400 text-sm mb-1">${escapeHtml(tr('loading_schemes.scheme_description', 'Schemos aprašymas'))}</div>
          <div class="whitespace-pre-line">${escapeHtml(scheme.scheme_description || '-')}</div>
        </div>

        ${scheme.master_driver_comment ? `
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400 text-sm mb-1">${escapeHtml(tr('loading_schemes.master_comment', 'Master driver komentaras'))}</div>
            <div class="whitespace-pre-line">${escapeHtml(scheme.master_driver_comment)}</div>
          </div>
        ` : ''}

        ${scheme.instructor_comment ? `
          <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <div class="text-slate-400 text-sm mb-1">${escapeHtml(tr('loading_schemes.instructor_comment', 'Instruktoriaus komentaras'))}</div>
            <div class="whitespace-pre-line">${escapeHtml(scheme.instructor_comment)}</div>
          </div>
        ` : ''}

        <div>
          <div class="text-slate-400 text-sm mb-2">${escapeHtml(tr('loading_schemes.photos', 'Nuotraukos'))}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${photos.map(photo => {
              const url = getPhotoUrl(photo.file_path);
              const label = photoLabel(photo.category);

              return `
                <button
                  type="button"
                  class="ks-photo-view block text-left bg-slate-800 border border-slate-700 rounded-xl overflow-hidden"
                  data-url="${escapeHtml(url)}"
                  data-title="${escapeHtml(label)}"
                >
                  <img src="${escapeHtml(url)}" class="w-full h-40 object-cover" alt="">
                  <div class="p-2 text-xs text-slate-400">${escapeHtml(label)}</div>
                </button>
              `;
            }).join('') || `<div class="text-slate-500">${escapeHtml(tr('loading_schemes.no_photos', 'Nuotraukų nėra'))}</div>`}
          </div>
        </div>

        ${scheme.status === 'approved' && canUseSchemeAdminActions ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <button type="button" class="ks-pdf bg-blue-600 hover:bg-blue-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.download_pdf', 'Atsisiųsti PDF'))}
            </button>

            <button type="button" class="ks-assign bg-purple-600 hover:bg-purple-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.assign_driver', 'Skirti vairuotojui'))}
            </button>
          </div>
        ` : ''}

        ${canReview && scheme.status === 'waiting_approval' ? `
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button type="button" class="ks-modal-approve bg-green-600 hover:bg-green-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.approve', 'Patvirtinti'))}
            </button>

            <button type="button" class="ks-modal-change bg-yellow-600 hover:bg-yellow-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.comment', 'Komentaras'))}
            </button>

            <button type="button" class="ks-modal-reject bg-red-600 hover:bg-red-700 rounded-xl p-3 text-sm font-semibold" data-id="${scheme.id}">
              ${escapeHtml(tr('loading_schemes.reject', 'Atmesti'))}
            </button>
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

  function confirmDiscardIfDirty(nextTaskId, nextSchemeId = '') {
    if (!isFormDirty()) return true;

    if (nextTaskId && String(state.selectedSourceTaskId || '') === String(nextTaskId || '')) return true;
    if (nextSchemeId && String(state.selectedSchemeId || '') === String(nextSchemeId || '')) return true;

    return confirm(tx(
      'loading_schemes.discard_confirm',
      'Jau pradėjote pildyti schemą. Ar tikrai nutraukti pildymą ir atidaryti kitą užduotį?'
    ));
  }

  el.activeList?.addEventListener('click', event => {
    const taskBtn = event.target.closest('.ks-select-task');
    const schemeBtn = event.target.closest('.ks-select-scheme');

    if (!taskBtn && !schemeBtn) return;

    const taskId = taskBtn?.dataset.id || '';
    const schemeId = schemeBtn?.dataset.id || '';

    if (isFormDirty()) {
      const ok = confirm(tr('loading_schemes.interrupt_confirm', 'Jau pradėtas pildymas. Ar tikrai nutraukti dabartinį pildymą ir atidaryti kitą užduotį?'));
      if (!ok) return;
    }

    if (!confirmDiscardIfDirty(taskId, schemeId)) return;

    if (taskBtn) {
      if (el.sourceTask) el.sourceTask.value = taskId;
      fillFormFromTask(taskId);
    }

    if (schemeBtn) {
      fillFormFromScheme(schemeId);
    }

    document.getElementById('ksSourceTask')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
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
    const pdfBtn = event.target.closest('.ks-pdf');
    const assignBtn = event.target.closest('.ks-assign');
    const approveBtn = event.target.closest('.ks-modal-approve');
    const changeBtn = event.target.closest('.ks-modal-change');
    const rejectBtn = event.target.closest('.ks-modal-reject');

    if (photoBtn) {
      openImageViewer(photoBtn.dataset.url, photoBtn.dataset.title);
      return;
    }

    if (pdfBtn) {
      if (!canUseSchemeAdminActions) return;

      await printSchemePdf(pdfBtn.dataset.id);
      return;
    }

    if (assignBtn) {
      if (!canUseSchemeAdminActions) return;

      openAssignDriverModal(assignBtn.dataset.id);
      return;
    }

    if (approveBtn) {
      if (!canReview) return;

      await updateSchemeStatus(approveBtn.dataset.id, 'approved');
      return;
    }

    if (changeBtn) {
      if (!canReview) return;

      const comment = prompt(tr('loading_schemes.change_comment_prompt', 'Įrašykite komentarą, ką reikia pakeisti:'));
      if (comment === null) return;

      await updateSchemeStatus(changeBtn.dataset.id, 'needs_changes', comment);
      return;
    }

    if (rejectBtn) {
      if (!canReview) return;

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