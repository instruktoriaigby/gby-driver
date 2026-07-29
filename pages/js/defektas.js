export async function initDefektas({ supabase, user, profile }) {
  const form = document.getElementById('defectForm');

  if (!form) {
    console.error('❌ Nerasta forma: defectForm');
    return;
  }

  const PHOTO_BUCKET = 'defect-photos';

  const role = profile?.role || 'driver';
  const isDriver = role === 'driver';

  let driversRows = [];

  function showModal({ title = 'Pranešimas', message = '', type = 'info' }) {
    const oldModal = document.getElementById('appModal');
    if (oldModal) oldModal.remove();

    const icon =
      type === 'success' ? '✅' :
      type === 'error' ? '⚠️' :
      'ℹ️';

    const colorClass =
      type === 'success' ? 'text-green-400' :
      type === 'error' ? 'text-red-400' :
      'text-blue-400';

    const modal = document.createElement('div');
    modal.id = 'appModal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-white">
        <div class="flex items-start gap-4">
          <div class="text-3xl ${colorClass}">${icon}</div>

          <div class="flex-1">
            <h3 class="text-xl font-semibold mb-2">${title}</h3>
            <div class="text-slate-300 whitespace-pre-line leading-relaxed">${message}</div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            id="appModalClose"
            class="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-xl font-semibold"
          >
            Gerai
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('appModalClose')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  function fill(id, data) {
    const el = document.getElementById(id);

    if (!el) {
      console.error('❌ Nėra datalist:', id);
      return;
    }

    el.innerHTML = '';

    data.forEach(value => {
      if (!value) return;

      const option = document.createElement('option');
      option.value = value;
      el.appendChild(option);
    });

    console.log('✅ Užpildyta:', id, data.length);
  }

  function markInvalid(field) {
    if (!field) return;

    field.classList.add(
      'border',
      'border-red-500',
      'ring-2',
      'ring-red-500'
    );
  }

  function markPhotoInvalid(fieldOrCategory) {
    const category = typeof fieldOrCategory === 'string'
      ? fieldOrCategory
      : fieldOrCategory?.dataset?.category;

    const wrapper =
      category
        ? getPhotoBlockForCategory(category)
        : fieldOrCategory?.closest('.photo-block') ||
          fieldOrCategory?.closest('.bg-slate-900\\/50') ||
          fieldOrCategory?.parentElement;

    if (wrapper) {
      wrapper.classList.add(
        'border',
        'border-red-500',
        'ring-2',
        'ring-red-500'
      );
    }
  }

  function clearInvalidMarks() {
    form.querySelectorAll('input, textarea, select').forEach(field => {
      field.classList.remove(
        'border',
        'border-red-500',
        'ring-2',
        'ring-red-500'
      );
    });

    form.querySelectorAll('[data-stage-card]').forEach(card => {
      card.classList.remove(
        'border',
        'border-red-500',
        'ring-2',
        'ring-red-500'
      );
    });

    form.querySelectorAll('.bg-slate-900\\/50, .photo-block').forEach(block => {
      block.classList.remove(
        'border',
        'border-red-500',
        'ring-2',
        'ring-red-500'
      );
    });
  }

  function getValue(formData, keys) {
    for (const key of keys) {
      const value = formData[key];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if (value) return value;
    }

    return null;
  }

  function normalizeCategory(category) {
    if (category === 'doc') return 'document';
    if (category === 'docs') return 'document';
    if (category === 'document') return 'document';
    if (category === 'vin') return 'vin';
    if (category === 'far') return 'far';
    if (category === 'close') return 'close';

    return category;
  }

  function getPhotoInputs() {
    return Array.from(form.querySelectorAll('input[type="file"][data-category]'));
  }

  function getPhotoInputsByCategory(category) {
    const normalized = normalizeCategory(category);

    return getPhotoInputs().filter(input => {
      return normalizeCategory(input.dataset.category) === normalized;
    });
  }

  function getRequiredPhotoInput(category) {
    const normalized = normalizeCategory(category);

    return getPhotoInputs().find(input => {
      return normalizeCategory(input.dataset.category) === normalized;
    });
  }

  function getFilesForCategory(category) {
    const inputs = getPhotoInputsByCategory(category);
    const files = [];

    inputs.forEach(input => {
      Array.from(input.files || []).forEach(file => {
        files.push({
          file,
          source: input.dataset.photoSource || 'file'
        });
      });
    });

    return files;
  }

  function getPhotoBlockForCategory(category) {
    const normalized = normalizeCategory(category);

    return (
      form.querySelector(`[data-photo-block="${normalized}"]`) ||
      getRequiredPhotoInput(normalized)?.closest('.photo-block') ||
      getRequiredPhotoInput(normalized)?.closest('.bg-slate-900\\/50')
    );
  }

  function getCurrentLang() {
    return localStorage.getItem('lang') || profile?.lang || 'lt';
  }

  function tr(key, fallback = '') {
    const lang = getCurrentLang();

    const dictionary = {
      lt: {
        selected_photos: 'Prisegta nuotraukų: {count}',
        selected_document: 'Dokumentas prisegtas',
        selected_documents: 'Dokumentų prisegta: {count}'
      },
      en: {
        selected_photos: 'Attached photos: {count}',
        selected_document: 'Document attached',
        selected_documents: 'Attached documents: {count}'
      },
      ru: {
        selected_photos: 'Прикреплено фото: {count}',
        selected_document: 'Документ прикреплён',
        selected_documents: 'Прикреплено документов: {count}'
      }
    };

    return dictionary[lang]?.[key] || dictionary.lt[key] || fallback;
  }

  function updatePhotoStatus(category) {
    const normalized = normalizeCategory(category);
    const status = form.querySelector(`[data-photo-status="${normalized}"]`);

    if (!status) return;

    const count = getFilesForCategory(normalized).length;

    if (!count) {
      status.textContent = '';
      return;
    }

    if (normalized === 'document') {
      status.textContent = count === 1
        ? tr('selected_document', 'Dokumentas prisegtas')
        : tr('selected_documents', 'Dokumentų prisegta: {count}').replace('{count}', count);
      return;
    }

    status.textContent = tr('selected_photos', 'Prisegta nuotraukų: {count}').replace('{count}', count);
  }

  function updateAllPhotoStatuses() {
    ['vin', 'far', 'close', 'document'].forEach(updatePhotoStatus);
  }

  function getSafePart(value, fallback = 'unknown') {
    const clean = String(value || fallback)
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return clean || fallback;
  }

  function getFileExtension(fileName, mimeType) {
    const cleanName = String(fileName || '').trim();

    if (cleanName.includes('.')) {
      const ext = cleanName.split('.').pop().toLowerCase();
      if (ext) return ext;
    }

    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/heic') return 'heic';
    if (mimeType === 'image/heif') return 'heif';

    return 'jpg';
  }

  function getDateTimeParts() {
    const now = new Date();

    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    const time = now.toTimeString().slice(0, 8).replaceAll(':', '');

    return { date, time };
  }

  function getDriverInput() {
    return (
      form.querySelector('[name="driver"]') ||
      form.querySelector('[name="driverName"]') ||
      form.querySelector('[name="driver_name"]') ||
      document.getElementById('driver') ||
      document.getElementById('driverName')
    );
  }

  function getProfileDriverName() {
    return String(
      profile?.full_name ||
      profile?.name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      ''
    ).trim();
  }

  function getLoggedInEmail() {
    return String(
      profile?.email ||
      user?.email ||
      ''
    ).toLowerCase().trim();
  }

  function getDriverNameFromRow(row) {
    if (!row) return '';

    return String(
      row.full_name ||
      row['Vardas/ Pavardė'] ||
      row['Vardas / Pavardė'] ||
      row['Vardas/Pavardė'] ||
      row['Vardas Pavardė'] ||
      row['Vardas ir pavardė'] ||
      row['Vardas'] ||
      row.name ||
      row.driver_name ||
      ''
    ).trim();
  }

  function getDriverEmailFromRow(row) {
    if (!row) return '';

    return String(
      row.email ||
      row['El. paštas'] ||
      row['El. pastas'] ||
      row['Email'] ||
      row['E-mail'] ||
      ''
    ).toLowerCase().trim();
  }

  function getCurrentDriverName() {
    const profileName = getProfileDriverName();
    const email = getLoggedInEmail();

    if (!isDriver) {
      const driverInput = getDriverInput();

      return String(driverInput?.value || '').trim();
    }

    if (email && driversRows.length) {
      const matchedDriver = driversRows.find(item => {
        const driverEmail = getDriverEmailFromRow(item);
        return driverEmail && driverEmail === email;
      });

      const matchedName = getDriverNameFromRow(matchedDriver);

      if (matchedName) {
        return matchedName;
      }
    }

    return profileName;
  }

  function lockDriverFieldForLoggedInDriver() {
    if (!isDriver) return;

    const driverInput = getDriverInput();
    if (!driverInput) return;

    const driverName = getCurrentDriverName();

    driverInput.value = driverName;
    driverInput.readOnly = true;
    driverInput.setAttribute('data-locked-driver', 'true');
    driverInput.setAttribute('title', 'Vairuotojas nustatomas automatiškai pagal prisijungimą');

    driverInput.classList.add(
      'opacity-70',
      'cursor-not-allowed'
    );

    const wrapper = driverInput.closest('.field, .form-group, div');

    if (wrapper && !wrapper.querySelector('.driver-auto-note')) {
      const note = document.createElement('div');
      note.className = 'driver-auto-note text-xs text-slate-400 mt-1';
      note.textContent = 'Vairuotojas nustatytas automatiškai pagal prisijungimą.';
      wrapper.appendChild(note);
    }
  }

  function validateRequiredFields(formData) {
    clearInvalidMarks();

    const driverValue = isDriver
      ? getCurrentDriverName()
      : getValue(formData, ['driver', 'driverName', 'driver_name']);

    const required = [
      {
        label: 'CMR numeris',
        value: getValue(formData, ['cmr', 'cmr_number', 'cmrNumber']),
        element: form.querySelector('[name="cmr"]')
      },
      {
        label: 'Vilkikas',
        value: getValue(formData, ['truck', 'truck_number', 'truckNumber']),
        element: form.querySelector('[name="truck"]')
      },
      {
        label: 'Vairuotojas',
        value: driverValue,
        element:
          form.querySelector('[name="driver"]') ||
          form.querySelector('[name="driverName"]') ||
          form.querySelector('[name="driver_name"]')
      },
      {
        label: 'Etapas',
        value: getValue(formData, ['stage']),
        element: null
      },
      {
        label: 'Pasikrovimo vieta',
        value: getValue(formData, [
          'pasikrovimo',
          'loadingPlace',
          'loading_place',
          'loading',
          'loadPlace',
          'load_location',
          'loadingLocation'
        ]),
        element:
          form.querySelector('[name="pasikrovimo"]') ||
          form.querySelector('[name="loadingPlace"]') ||
          form.querySelector('[name="loading_place"]')
      },
      {
        label: 'Išsikrovimo vieta',
        value: getValue(formData, [
          'issikrovimo',
          'unloadingPlace',
          'unloading_place',
          'unloading',
          'unloadPlace',
          'unload_location',
          'unloadingLocation'
        ]),
        element:
          form.querySelector('[name="issikrovimo"]') ||
          form.querySelector('[name="unloadingPlace"]') ||
          form.querySelector('[name="unloading_place"]')
      },
      {
        label: 'Defekto vieta',
        value: getValue(formData, [
          'location',
          'defectLocation',
          'defect_location',
          'defectPlace',
          'place'
        ]),
        element:
          form.querySelector('[name="location"]') ||
          form.querySelector('[name="defectLocation"]') ||
          form.querySelector('[name="defect_location"]')
      },
      {
        label: 'Paaiškinimas',
        value: getValue(formData, [
          'explanation',
          'description',
          'comment',
          'comments'
        ]),
        element:
          form.querySelector('[name="explanation"]') ||
          form.querySelector('[name="description"]') ||
          form.querySelector('[name="comment"]')
      }
    ];

    const missing = required.filter(item => !item.value);

    missing.forEach(item => {
      if (item.element) {
        markInvalid(item.element);
      }

      if (item.label === 'Etapas') {
        form.querySelectorAll('input[name="stage"]').forEach(radio => {
          const card = radio.closest('label')?.querySelector('div');

          if (card) {
            card.setAttribute('data-stage-card', 'true');
            markInvalid(card);
          }
        });
      }
    });

    const requiredPhotos = [
      {
        label: 'VIN nuotrauka',
        category: 'vin',
        input: getRequiredPhotoInput('vin')
      },
      {
        label: 'Nuotrauka iš toli',
        category: 'far',
        input: getRequiredPhotoInput('far')
      },
      {
        label: 'Nuotrauka iš arti',
        category: 'close',
        input: getRequiredPhotoInput('close')
      },
      {
        label: 'Dokumento nuotrauka',
        category: 'document',
        input: getRequiredPhotoInput('document')
      }
    ];

    const missingPhotos = requiredPhotos.filter(item => {
      const category = item.input?.dataset?.category || item.category;
      return getFilesForCategory(category).length === 0;
    });

    missingPhotos.forEach(item => {
      markPhotoInvalid(item.category || item.input?.dataset?.category || item.input);
    });

    const allMissing = [
      ...missing.map(item => item.label),
      ...missingPhotos.map(item => item.label)
    ];

    if (allMissing.length) {
      showModal({
        type: 'error',
        title: 'Neužpildyta ataskaita',
        message:
          'Užpildyk visus privalomus laukus:\n\n' +
          allMissing.map(item => `• ${item}`).join('\n')
      });

      missing[0]?.element?.focus();
      return false;
    }

    return true;
  }

  async function fetchAllLocations() {
    const pageSize = 1000;
    let from = 0;
    let allRows = [];

    while (true) {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .range(from, from + pageSize - 1);

      if (error) {
        throw error;
      }

      const rows = data || [];
      allRows = allRows.concat(rows);

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return allRows;
  }

  async function loadReferenceLists() {
    let trucksResult;
    let driversResult;
    let locationsRows;

    try {
      [trucksResult, driversResult, locationsRows] = await Promise.all([
        supabase.from('trucks').select('*'),
        supabase.from('drivers').select('*'),
        fetchAllLocations()
      ]);
    } catch (error) {
      console.error('❌ Supabase sąrašų klaida:', error);

      showModal({
        type: 'error',
        title: 'Nepavyko užkrauti duomenų',
        message: 'Nepavyko užkrauti vilkikų, vairuotojų arba lokacijų sąrašų. Patikrink Console klaidą.'
      });

      return;
    }

    if (trucksResult.error || driversResult.error) {
      console.error('❌ Supabase sąrašų klaida:', {
        trucksError: trucksResult.error,
        driversError: driversResult.error
      });

      showModal({
        type: 'error',
        title: 'Nepavyko užkrauti duomenų',
        message: 'Nepavyko užkrauti vilkikų, vairuotojų arba lokacijų sąrašų. Patikrink Console klaidą.'
      });

      return;
    }

    driversRows = driversResult.data || [];

    const trucks = (trucksResult.data || [])
      .map(item =>
        item.truck_number ||
        item.Truck ||
        item.Vilkikas ||
        item.vilkikas ||
        item.number ||
        item.name
      )
      .filter(Boolean)
      .sort();

    const drivers = driversRows
      .map(item =>
        item['Vardas/ Pavardė'] ||
        item['Vardas / Pavardė'] ||
        item['Vardas/Pavardė'] ||
        item['Vardas Pavardė'] ||
        item['Vardas ir pavardė'] ||
        item['Vardas'] ||
        item.full_name ||
        item.name ||
        item.driver_name
      )
      .filter(Boolean)
      .sort();

    const locations = (locationsRows || [])
      .map(item =>
        item.name ||
        item.Name ||
        item.Lokacija ||
        item.lokacija ||
        item.location
      )
      .filter(Boolean)
      .sort();

    fill('truckList', trucks);

    if (isDriver) {
      fill('driverList', []);
    } else {
      fill('driverList', drivers);
    }

    fill('locationsList', locations);

    console.log('✅ Lokacijų užkrauta:', locations.length);

    lockDriverFieldForLoggedInDriver();
  }

  async function uploadDefectPhotos(defectId, formData) {
    const photoRows = [];
    const usedFileNames = new Map();

    const { date, time } = getDateTimeParts();

    const truckNumber = getSafePart(
      getValue(formData, ['truck', 'truck_number', 'truckNumber']),
      'no_truck'
    );

    const categories = ['vin', 'far', 'close', 'document'];

    for (const category of categories) {
      const selectedFiles = getFilesForCategory(category);

      for (let index = 0; index < selectedFiles.length; index++) {
        const item = selectedFiles[index];
        const file = item.file;

        const extension = getFileExtension(file.name, file.type);
        const key = `${category}.${extension}`;
        const currentCount = usedFileNames.get(key) || 0;
        const nextCount = currentCount + 1;

        usedFileNames.set(key, nextCount);

        const suffix = nextCount > 1 ? `_${nextCount}` : '';
        const filePath = `${date}_${time}_${truckNumber}_${category}${suffix}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream'
          });

        if (uploadError) {
          console.error('❌ Nuotraukos įkėlimo klaida:', uploadError);
          throw new Error(`Nepavyko įkelti nuotraukos: ${file.name}`);
        }

        photoRows.push({
          defect_id: defectId,
          category,
          file_path: filePath,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size || null,
          uploaded_by: user?.id || null
        });
      }
    }

    if (!photoRows.length) {
      throw new Error('Nerasta nuotraukų įkėlimui.');
    }

    const { error: photosError } = await supabase
      .from('defect_photos')
      .insert(photoRows);

    if (photosError) {
      console.error('❌ Nuotraukų registro klaida:', photosError);
      throw new Error('Nuotraukos įkeltos, bet nepavyko įrašyti jų registro.');
    }

    return photoRows;
  }

  await loadReferenceLists();

  form.addEventListener('input', clearInvalidMarks);

  form.addEventListener('change', (event) => {
    clearInvalidMarks();

    const changedPhotoInput = event.target?.matches?.('input[type="file"][data-category]')
      ? event.target
      : null;

    if (changedPhotoInput) {
      updatePhotoStatus(changedPhotoInput.dataset.category);
    }

    if (isDriver) {
      lockDriverFieldForLoggedInDriver();
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();

    if (isDriver) {
      lockDriverFieldForLoggedInDriver();
    }

    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
    }

    try {
      const formData = Object.fromEntries(new FormData(form).entries());

      if (!validateRequiredFields(formData)) {
        return;
      }

      const currentDriverName = isDriver
        ? getCurrentDriverName()
        : getValue(formData, ['driver', 'driverName', 'driver_name']);

      const row = {
        driver_id: user?.id || null,

        driver_name: currentDriverName,

        cmr_number:
          getValue(formData, ['cmr', 'cmr_number', 'cmrNumber']),

        truck_number:
          getValue(formData, ['truck', 'truck_number', 'truckNumber']),

        stage:
          getValue(formData, ['stage']),

        loading_place:
          getValue(formData, [
            'pasikrovimo',
            'loadingPlace',
            'loading_place',
            'loading',
            'loadPlace',
            'load_location',
            'loadingLocation'
          ]),

        unloading_place:
          getValue(formData, [
            'issikrovimo',
            'unloadingPlace',
            'unloading_place',
            'unloading',
            'unloadPlace',
            'unload_location',
            'unloadingLocation'
          ]),

        defect_location:
          getValue(formData, [
            'location',
            'defectLocation',
            'defect_location',
            'defectPlace',
            'place'
          ]),

        explanation:
          getValue(formData, [
            'explanation',
            'description',
            'comment',
            'comments'
          ])
      };

      const { data: defect, error } = await supabase
        .from('defects')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        console.error('❌ Defekto išsaugojimo klaida:', error);

        showModal({
          type: 'error',
          title: 'Nepavyko išsaugoti',
          message: error.message
        });

        return;
      }

      if (!defect?.id) {
        showModal({
          type: 'error',
          title: 'Nepavyko išsaugoti',
          message: 'Defektas sukurtas, bet nepavyko gauti jo ID.'
        });

        return;
      }

      await uploadDefectPhotos(defect.id, formData);

      showModal({
        type: 'success',
        title: 'Ataskaita išsaugota',
        message: 'Defekto ataskaita ir nuotraukos sėkmingai pateiktos.'
      });

      form.reset();
      clearInvalidMarks();
      updateAllPhotoStatuses();

      if (isDriver) {
        lockDriverFieldForLoggedInDriver();
      }

    } catch (err) {
      console.error('❌ Defekto pateikimo klaida:', err);

      showModal({
        type: 'error',
        title: 'Nepavyko pateikti ataskaitos',
        message: err?.message || 'Įvyko nežinoma klaida.'
      });

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      }
    }
  };
}