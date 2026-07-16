import { t } from '../../i18n.js';

export async function initVilkikoPriemimas({ supabase, user, profile }) {
  const role = profile?.role || 'driver';
  const allowedRoles = ['admin', 'instructor', 'master_driver'];

  function tr(key, fallback) {
    const value = t(key);
    if (!value || value === key) return fallback;
    return value;
  }

  if (!allowedRoles.includes(role)) {
    alert(tr('truck_acceptance.no_permission', 'Neturite teisės naudoti šio puslapio'));
    window.navigateTo('dashboard');
    return;
  }

  const form = document.getElementById('truckAcceptanceForm');
  if (!form) return;

  const today = new Date().toISOString().slice(0, 10);
  const reportDateInput = document.getElementById('reportDate');
  const driverNameInput = document.getElementById('driverName');
  const notesInput = document.getElementById('notes');
  const notesCounter = document.getElementById('notesCounter');
  const saveBtn = document.getElementById('saveTruckAcceptanceBtn');

  if (reportDateInput && !reportDateInput.value) {
    reportDateInput.value = today;
  }

  const photos = new Map();

  const qualityItems = [
    {
      key: 'platform_condition',
      category: 'platform',
      titleKey: 'truck_acceptance.platform_condition',
      titleFallback: 'Platformos būklė'
    },
    {
      key: 'platform_order',
      category: 'platform_order',
      titleKey: 'truck_acceptance.platform_order',
      titleFallback: 'Tvarka ant platformos'
    },
    {
      key: 'safety_fences_condition',
      category: 'safety_fences',
      titleKey: 'truck_acceptance.safety_fences',
      titleFallback: 'Apsauginių tvorų būklė'
    },
    {
      key: 'straps_condition',
      category: 'straps',
      titleKey: 'truck_acceptance.straps',
      titleFallback: 'Tvirtinimo diržų būklė'
    },
    {
      key: 'work_inventory_condition',
      category: 'work_inventory',
      titleKey: 'truck_acceptance.work_inventory',
      titleFallback: 'Kitas darbo inventorius'
    },
    {
      key: 'fastening_condition',
      category: 'fastening',
      titleKey: 'truck_acceptance.fastening',
      titleFallback: 'Tvirtinimas'
    }
  ];

  const ratingOptions = [
    {
      value: 'Blokas',
      key: 'truck_acceptance.block',
      fallback: 'Blokas'
    },
    {
      value: 'Įspėjimas',
      key: 'truck_acceptance.warning',
      fallback: 'Įspėjimas'
    },
    {
      value: 'Gerai',
      key: 'truck_acceptance.good',
      fallback: 'Gerai'
    },
    {
      value: 'Puikiai',
      key: 'truck_acceptance.excellent',
      fallback: 'Puikiai'
    }
  ];

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function numberValue(id) {
    const value = document.getElementById(id)?.value;
    if (value === '' || value === null || value === undefined) return null;
    return Number(value);
  }

  function textValue(id) {
    return document.getElementById(id)?.value?.trim() || null;
  }

  function getChoice(groupName) {
    return document
      .querySelector(`[data-choice-group="${groupName}"] .choice-btn.active`)
      ?.dataset
      ?.value || null;
  }

  function setPhoto(category, file) {
    if (!file) return;

    photos.set(category, file);

    const preview = document.querySelector(`[data-photo-preview="${category}"]`);
    const status = document.querySelector(`[data-photo-status="${category}"]`);

    if (preview) {
      const url = URL.createObjectURL(file);

      preview.innerHTML = `
        <img
          src="${url}"
          class="w-full h-full object-cover rounded-lg"
          alt=""
        >
      `;
    }

    if (status) {
      status.textContent = file.name;
    }
  }

  function getRatingButtons(defaultValue = 'Gerai') {
    return ratingOptions.map(option => `
      <button
        type="button"
        class="choice-btn ${option.value === defaultValue ? 'active' : ''} break-words whitespace-normal min-h-[46px] text-xs sm:text-sm"
        data-value="${escapeHtml(option.value)}"
      >
        ${escapeHtml(tr(option.key, option.fallback))}
      </button>
    `).join('');
  }

  function renderQualityItems() {
    const grid = document.getElementById('qualityGrid');
    if (!grid) return;

    grid.innerHTML = qualityItems.map(item => `
      <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 min-w-0">
        <h3 class="font-semibold mb-3 break-words">${escapeHtml(tr(item.titleKey, item.titleFallback))}</h3>

        <div class="space-y-3">
          <div>
            <div
              data-photo-preview="${escapeHtml(item.category)}"
              class="h-32 border border-dashed border-slate-600 rounded-xl flex items-center justify-center text-slate-400 text-sm overflow-hidden bg-slate-900"
            >
              ${escapeHtml(tr('truck_acceptance.photo', 'Nuotrauka'))}
            </div>

            <div
              data-photo-status="${escapeHtml(item.category)}"
              class="text-xs text-slate-400 mt-1 truncate"
            ></div>
          </div>

          <div
            class="grid grid-cols-2 gap-2"
            data-choice-group="${escapeHtml(item.key)}"
          >
            ${getRatingButtons('Gerai')}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="cursor-pointer flex items-center justify-center min-h-[44px] text-center leading-tight whitespace-normal break-words bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm">
              ${escapeHtml(tr('truck_acceptance.choose_gallery', 'Pasirinkti iš galerijos'))}
              <input
                type="file"
                accept="image/*"
                class="hidden photo-input"
                data-category="${escapeHtml(item.category)}"
              >
            </label>

            <label class="cursor-pointer flex items-center justify-center min-h-[44px] text-center leading-tight whitespace-normal break-words bg-blue-600 hover:bg-blue-700 rounded-xl px-3 py-2 text-sm">
              ${escapeHtml(tr('truck_acceptance.take_photo', 'Fotografuoti'))}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden photo-input"
                data-category="${escapeHtml(item.category)}"
              >
            </label>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderTrailerAxles() {
    const container = document.getElementById('trailerAxles');
    if (!container) return;

    const rows = [1, 2, 3];

    container.innerHTML = rows.map(axle => `
      <div class="bg-slate-900 rounded-xl p-4 border border-slate-700">
        <div class="flex flex-col lg:flex-row lg:items-end gap-3">
          <div class="w-full lg:w-32">
            <label class="block text-sm mb-1">${escapeHtml(tr('truck_acceptance.axle', 'Ašis'))}</label>
            <div class="p-3 bg-slate-800 rounded-xl border border-slate-700">
              ${axle} ${escapeHtml(tr('truck_acceptance.axle', 'ašis').toLowerCase())}
            </div>
          </div>

          <div class="w-full lg:w-52">
            <label class="block text-sm mb-1">${escapeHtml(tr('truck_acceptance.wheels', 'Ratai'))}</label>
            <div class="grid grid-cols-2 gap-2" data-choice-group="trailerAxle${axle}Type">
              <button type="button" class="choice-btn active" data-value="Viengubi">${escapeHtml(tr('truck_acceptance.single_wheels', 'Viengubi'))}</button>
              <button type="button" class="choice-btn" data-value="Dvigubi">${escapeHtml(tr('truck_acceptance.double_wheels', 'Dvigubi'))}</button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <label class="text-sm">${escapeHtml(tr('truck_acceptance.outer_left', 'Išorinė kairė'))}
              <input id="trailerAxle${axle}LeftOuter" type="number" step="0.1" class="mt-1 w-full p-3 bg-slate-800 rounded-xl border border-slate-700" placeholder="0.0">
            </label>

            <label class="text-sm">${escapeHtml(tr('truck_acceptance.inner_left', 'Vidinė kairė'))}
              <input id="trailerAxle${axle}LeftInner" type="number" step="0.1" class="mt-1 w-full p-3 bg-slate-800 rounded-xl border border-slate-700" placeholder="0.0">
            </label>

            <label class="text-sm">${escapeHtml(tr('truck_acceptance.inner_right', 'Vidinė dešinė'))}
              <input id="trailerAxle${axle}RightInner" type="number" step="0.1" class="mt-1 w-full p-3 bg-slate-800 rounded-xl border border-slate-700" placeholder="0.0">
            </label>

            <label class="text-sm">${escapeHtml(tr('truck_acceptance.outer_right', 'Išorinė dešinė'))}
              <input id="trailerAxle${axle}RightOuter" type="number" step="0.1" class="mt-1 w-full p-3 bg-slate-800 rounded-xl border border-slate-700" placeholder="0.0">
            </label>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderAdditionalPhotos() {
    const grid = document.getElementById('additionalPhotosGrid');
    if (!grid) return;

    const items = [1, 2, 3, 4, 5, 6];

    grid.innerHTML = items.map(num => {
      const category = `additional_${num}`;

      return `
        <div class="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <div
            data-photo-preview="${category}"
            class="h-28 border border-dashed border-slate-600 rounded-xl flex items-center justify-center text-slate-400 text-sm overflow-hidden bg-slate-900"
          >
            ${escapeHtml(tr('truck_acceptance.photo', 'Nuotrauka'))}
          </div>

          <div
            data-photo-status="${category}"
            class="text-xs text-slate-400 mt-1 truncate"
          ></div>

          <div class="grid grid-cols-2 gap-2 mt-3">
            <label class="cursor-pointer flex items-center justify-center text-center bg-slate-900 hover:bg-slate-700 border border-slate-600 rounded-xl px-2 py-2 text-xs">
              ${escapeHtml(tr('truck_acceptance.gallery', 'Galerija'))}
              <input
                type="file"
                accept="image/*"
                class="hidden photo-input"
                data-category="${category}"
              >
            </label>

            <label class="cursor-pointer flex items-center justify-center text-center bg-blue-600 hover:bg-blue-700 rounded-xl px-2 py-2 text-xs">
              ${escapeHtml(tr('truck_acceptance.camera', 'Foto'))}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                class="hidden photo-input"
                data-category="${category}"
              >
            </label>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateTrailerAxleInnerInputs(groupName) {
    const match = String(groupName || '').match(/^trailerAxle(\d+)Type$/);
    if (!match) return;

    const axle = match[1];
    const selected = getChoice(groupName);
    const isSingle = selected === 'Viengubi';

    const inputs = [
      document.getElementById(`trailerAxle${axle}LeftInner`),
      document.getElementById(`trailerAxle${axle}RightInner`)
    ];

    inputs.forEach(input => {
      if (!input) return;
      input.disabled = isSingle;

      if (isSingle) {
        input.value = '';
        input.placeholder = '-';
        input.classList.add('opacity-40', 'cursor-not-allowed');
      } else {
        input.placeholder = '0.0';
        input.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    });
  }

  function updateAllTrailerAxleInnerInputs() {
    [1, 2, 3].forEach(axle => updateTrailerAxleInnerInputs(`trailerAxle${axle}Type`));
  }

  function updateLazyAxleState() {
    const hasLazy = Boolean(document.getElementById('hasLazyAxle')?.checked);
    const wrap = document.getElementById('lazyAxleInputs');
    const inputs = [
      document.getElementById('lazyLeftPressure'),
      document.getElementById('lazyRightPressure')
    ];

    wrap?.classList.toggle('opacity-40', !hasLazy);

    inputs.forEach(input => {
      if (!input) return;

      input.disabled = !hasLazy;

      if (!hasLazy) {
        input.value = '';
        input.placeholder = '-';
        input.classList.add('cursor-not-allowed');
      } else {
        input.placeholder = '0.0';
        input.classList.remove('cursor-not-allowed');
      }
    });
  }

  document.getElementById('hasLazyAxle')?.addEventListener('change', updateLazyAxleState);

  function bindChoiceButtons() {
    document.addEventListener('click', (event) => {
      const btn = event.target.closest('.choice-btn');
      if (!btn) return;

      const group = btn.closest('[data-choice-group]');
      if (!group) return;

      group.querySelectorAll('.choice-btn').forEach(item => {
        item.classList.remove('active');
      });

      btn.classList.add('active');
      updateTrailerAxleInnerInputs(group.dataset.choiceGroup);
    });
  }

  function bindPhotoInputs() {
    document.addEventListener('change', (event) => {
      const input = event.target.closest('.photo-input');
      if (!input) return;

      const category = input.dataset.category;
      const file = input.files?.[0];

      if (!category || !file) return;

      if (!file.type.startsWith('image/')) {
        alert(tr('truck_acceptance.images_only', 'Galima kelti tik nuotraukas'));
        input.value = '';
        return;
      }

      setPhoto(category, file);
    });
  }

  function updateChoiceButtonStyles() {
    const styleId = 'truck-acceptance-choice-style';

    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .choice-btn {
        background: rgb(15 23 42);
        border: 1px solid rgb(71 85 105);
        color: white;
        border-radius: 0.75rem;
        padding: 0.65rem 0.5rem;
        font-size: 0.8125rem;
        line-height: 1.15rem;
        min-height: 44px;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: normal;
      }

      .choice-btn:hover {
        background: rgb(51 65 85);
      }

      .choice-btn.active {
        background: rgb(37 99 235);
        border-color: rgb(37 99 235);
      }

      [data-choice-group$="condition"] .choice-btn.active,
      [data-choice-group="platform_condition"] .choice-btn.active,
      [data-choice-group="platform_order"] .choice-btn.active,
      [data-choice-group="safety_fences_condition"] .choice-btn.active,
      [data-choice-group="straps_condition"] .choice-btn.active,
      [data-choice-group="work_inventory_condition"] .choice-btn.active,
      [data-choice-group="fastening_condition"] .choice-btn.active,
      [data-choice-group="exteriorCleanliness"] .choice-btn.active {
        background: rgb(22 163 74);
        border-color: rgb(22 163 74);
      }
    `;

    document.head.appendChild(style);
  }

  async function uploadPhotos(reportId) {
    const rows = [];

    for (const [category, file] of photos.entries()) {
      const safeName = String(file.name || 'photo.jpg')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'photo.jpg';

      const filePath = `${reportId}/${category}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('truck-acceptance-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type || 'image/jpeg',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      rows.push({
        report_id: reportId,
        category,
        file_path: filePath,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size || null,
        uploaded_by: user.id
      });
    }

    if (!rows.length) return;

    const { error: insertError } = await supabase
      .from('truck_acceptance_photos')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }
  }

  function getReportPayload() {
    return {
      created_by: user.id,
      driver_id: user.id,

      report_date: textValue('reportDate'),
      driver_name: textValue('driverName'),
      truck_number: textValue('truckNumber'),
      trailer_type: textValue('trailerType'),
      client: textValue('client'),

      front_left_pressure: numberValue('frontLeftPressure'),
      front_right_pressure: numberValue('frontRightPressure'),

      lazy_left_pressure: numberValue('lazyLeftPressure'),
      lazy_right_pressure: numberValue('lazyRightPressure'),

      drive_outer_left_pressure: numberValue('driveOuterLeftPressure'),
      drive_inner_left_pressure: numberValue('driveInnerLeftPressure'),
      drive_inner_right_pressure: numberValue('driveInnerRightPressure'),
      drive_outer_right_pressure: numberValue('driveOuterRightPressure'),

      trailer_axle_1_type: getChoice('trailerAxle1Type'),
      trailer_axle_1_left_outer: numberValue('trailerAxle1LeftOuter'),
      trailer_axle_1_left_inner: numberValue('trailerAxle1LeftInner'),
      trailer_axle_1_right_inner: numberValue('trailerAxle1RightInner'),
      trailer_axle_1_right_outer: numberValue('trailerAxle1RightOuter'),

      trailer_axle_2_type: getChoice('trailerAxle2Type'),
      trailer_axle_2_left_outer: numberValue('trailerAxle2LeftOuter'),
      trailer_axle_2_left_inner: numberValue('trailerAxle2LeftInner'),
      trailer_axle_2_right_inner: numberValue('trailerAxle2RightInner'),
      trailer_axle_2_right_outer: numberValue('trailerAxle2RightOuter'),

      trailer_axle_3_type: getChoice('trailerAxle3Type'),
      trailer_axle_3_left_outer: numberValue('trailerAxle3LeftOuter'),
      trailer_axle_3_left_inner: numberValue('trailerAxle3LeftInner'),
      trailer_axle_3_right_inner: numberValue('trailerAxle3RightInner'),
      trailer_axle_3_right_outer: numberValue('trailerAxle3RightOuter'),

      platform_condition: getChoice('platform_condition'),
      platform_order: getChoice('platform_order'),
      safety_fences_condition: getChoice('safety_fences_condition'),
      straps_condition: getChoice('straps_condition'),
      work_inventory_condition: getChoice('work_inventory_condition'),
      fastening_condition: getChoice('fastening_condition'),
      exterior_cleanliness: getChoice('exteriorCleanliness'),

      windshield_condition: getChoice('windshieldCondition'),
      lights_condition: getChoice('lightsCondition'),

      notes: textValue('notes'),
      status: 'submitted'
    };
  }

  notesInput?.addEventListener('input', () => {
    if (!notesCounter) return;
    notesCounter.textContent = `${notesInput.value.length} / 1000`;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const truckNumber = textValue('truckNumber');
    const driverName = textValue('driverName');

    if (!truckNumber) {
      alert(tr('truck_acceptance.enter_truck', 'Įveskite vilkiko numerį'));
      return;
    }

    if (!driverName) {
      alert(tr('truck_acceptance.enter_driver', 'Įveskite vairuotoją'));
      return;
    }

    const originalText = saveBtn?.textContent || tr('truck_acceptance.save', 'Išsaugoti įvertinimą');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = tr('truck_acceptance.saving', 'Saugoma...');
    }

    try {
      const payload = getReportPayload();

      const { data, error } = await supabase
        .from('truck_acceptance_reports')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      await uploadPhotos(data.id);

      alert(tr('truck_acceptance.saved', 'Vilkiko priėmimo įvertinimas išsaugotas'));

      form.reset();
      photos.clear();

      if (reportDateInput) reportDateInput.value = today;
      renderQualityItems();
      renderTrailerAxles();
      renderAdditionalPhotos();
      updateLazyAxleState();

    } catch (err) {
      console.error('Truck acceptance save error:', err);
      alert(err?.message || tr('truck_acceptance.save_error', 'Nepavyko išsaugoti įvertinimo'));

    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
      }
    }
  });

  updateChoiceButtonStyles();
  renderTrailerAxles();
  updateAllTrailerAxleInnerInputs();
  updateLazyAxleState();
  renderQualityItems();
  renderAdditionalPhotos();
  bindChoiceButtons();
  bindPhotoInputs();
}
