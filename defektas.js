export async function initDefektas({ supabase, user, profile }) {
  const form = document.getElementById('defectForm');

  if (!form) {
    console.error('❌ Nerasta forma: defectForm');
    return;
  }

  const PHOTO_BUCKET = 'defect-photos';
  const LOCATIONS_CACHE_KEY = 'gby_locations_cache_v1';
  const LOCATIONS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

  const role = profile?.role || 'driver';

  const transportMode =
    profile?.effective_transport_mode ||
    profile?.app_transport_mode ||
    profile?.transport_mode ||
    window.getAppTransportMode?.() ||
    'car_transporter';

  const isTruckMode = transportMode === 'truck';
  const isDriver = role === 'driver' || role === 'truck_driver';

  let driversRows = [];

  function getCurrentLang() {
    return localStorage.getItem('lang') || profile?.lang || 'lt';
  }

  function tr(key, fallback = '') {
    const lang = getCurrentLang();

    const dictionary = {
      lt: {
        selected_photos: 'Prisegta nuotraukų: {count}',
        selected_document: 'Dokumentas prisegtas',
        selected_documents: 'Dokumentų prisegta: {count}',

        modal_ok: 'Gerai',
        report_incomplete_title: 'Neužpildyta ataskaita',
        report_incomplete_message: 'Užpildyk visus privalomus laukus:',
        data_load_error_title: 'Nepavyko užkrauti duomenų',
        data_load_error_message: 'Nepavyko užkrauti vilkikų, vairuotojų arba lokacijų sąrašų. Patikrink Console klaidą.',
        save_error_title: 'Nepavyko išsaugoti',
        save_missing_id: 'Defektas sukurtas, bet nepavyko gauti jo ID.',
        submit_error_title: 'Nepavyko pateikti ataskaitos',
        unknown_error: 'Įvyko nežinoma klaida.',
        success_title: 'Ataskaita išsaugota',
        success_message: 'Defekto ataskaita ir nuotraukos sėkmingai pateiktos.',
        driver_auto_title: 'Vairuotojas nustatomas automatiškai pagal prisijungimą',
        driver_auto_note: 'Vairuotojas nustatytas automatiškai pagal prisijungimą.',

        cmr_number: 'CMR numeris',
        truck: 'Vilkikas',
        driver: 'Vairuotojas',
        stage: 'Etapas',
        loading_place: 'Pasikrovimo vieta',
        unloading_place: 'Išsikrovimo vieta',
        defect_location: 'Defekto vieta',
        truck_cargo_defect_location: 'Krovinio defekto / pažeidimo vieta',
        damage_type: 'Pažeidimo tipas',
        cargo_type: 'Krovinio tipas',
        vin_number: 'VIN',
        explanation: 'Paaiškinimas',

        photo_vin: 'VIN / numerio nuotrauka',
        photo_far: 'Nuotrauka iš toli',
        photo_close: 'Nuotrauka iš arti',
        photo_document: 'Dokumento nuotrauka',

        unsupported_file_format: 'Failo formatas nepalaikomas: {file}. Naudokite JPG, JPEG, PNG, WEBP arba HEIC. RAW / DNG formato nuotraukos nepalaikomos.',
        photo_upload_error: 'Nepavyko įkelti nuotraukos: {file}',
        photo_register_error: 'Nuotraukos įkeltos, bet nepavyko įrašyti jų registro.',
        no_photos_to_upload: 'Nerasta nuotraukų įkėlimui.'
      },

      en: {
        selected_photos: 'Attached photos: {count}',
        selected_document: 'Document attached',
        selected_documents: 'Attached documents: {count}',

        modal_ok: 'OK',
        report_incomplete_title: 'Incomplete report',
        report_incomplete_message: 'Fill in all required fields:',
        data_load_error_title: 'Failed to load data',
        data_load_error_message: 'Failed to load truck, driver or location lists. Check Console error.',
        save_error_title: 'Failed to save',
        save_missing_id: 'The defect was created, but its ID could not be received.',
        submit_error_title: 'Failed to submit report',
        unknown_error: 'Unknown error occurred.',
        success_title: 'Report saved',
        success_message: 'Defect report and photos were submitted successfully.',
        driver_auto_title: 'Driver is set automatically based on login',
        driver_auto_note: 'Driver was set automatically based on login.',

        cmr_number: 'CMR number',
        truck: 'Truck',
        driver: 'Driver',
        stage: 'Stage',
        loading_place: 'Loading place',
        unloading_place: 'Unloading place',
        defect_location: 'Defect location',
        truck_cargo_defect_location: 'Cargo defect / damage location',
        damage_type: 'Damage type',
        cargo_type: 'Cargo type',
        vin_number: 'VIN',
        explanation: 'Explanation',

        photo_vin: 'VIN / number photo',
        photo_far: 'Photo from distance',
        photo_close: 'Close-up photo',
        photo_document: 'Document photo',

        unsupported_file_format: 'Unsupported file format: {file}. Use JPG, JPEG, PNG, WEBP or HEIC. RAW / DNG photos are not supported.',
        photo_upload_error: 'Failed to upload photo: {file}',
        photo_register_error: 'Photos were uploaded, but photo register could not be saved.',
        no_photos_to_upload: 'No photos found for upload.'
      },

      ru: {
        selected_photos: 'Прикреплено фото: {count}',
        selected_document: 'Документ прикреплён',
        selected_documents: 'Прикреплено документов: {count}',

        modal_ok: 'OK',
        report_incomplete_title: 'Отчёт не заполнен',
        report_incomplete_message: 'Заполните все обязательные поля:',
        data_load_error_title: 'Не удалось загрузить данные',
        data_load_error_message: 'Не удалось загрузить список тягачей, водителей или локаций. Проверьте ошибку в Console.',
        save_error_title: 'Не удалось сохранить',
        save_missing_id: 'Дефект создан, но не удалось получить его ID.',
        submit_error_title: 'Не удалось отправить отчёт',
        unknown_error: 'Произошла неизвестная ошибка.',
        success_title: 'Отчёт сохранён',
        success_message: 'Отчёт о дефекте и фотографии успешно отправлены.',
        driver_auto_title: 'Водитель определяется автоматически по логину',
        driver_auto_note: 'Водитель установлен автоматически по логину.',

        cmr_number: 'Номер CMR',
        truck: 'Тягач',
        driver: 'Водитель',
        stage: 'Этап',
        loading_place: 'Место загрузки',
        unloading_place: 'Место выгрузки',
        defect_location: 'Место дефекта',
        truck_cargo_defect_location: 'Место дефекта / повреждения груза',
        damage_type: 'Тип нарушения',
        cargo_type: 'Тип груза',
        vin_number: 'VIN',
        explanation: 'Объяснение',

        photo_vin: 'Фото VIN / номера',
        photo_far: 'Фото издалека',
        photo_close: 'Фото вблизи',
        photo_document: 'Фото документа',

        unsupported_file_format: 'Формат файла не поддерживается: {file}. Используйте JPG, JPEG, PNG, WEBP или HEIC. Фото RAW / DNG не поддерживаются.',
        photo_upload_error: 'Не удалось загрузить фото: {file}',
        photo_register_error: 'Фото загружены, но не удалось сохранить их в реестре.',
        no_photos_to_upload: 'Не найдено фото для загрузки.'
      }
    };

    return dictionary[lang]?.[key] || dictionary.lt[key] || fallback || key;
  }

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
            ${tr('modal_ok', 'Gerai')}
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

  function applyTransportModeVisibility() {
    form.querySelectorAll('[data-transport-mode]').forEach(element => {
      const mode = element.dataset.transportMode;
      const visible = mode === transportMode;

      element.classList.toggle('hidden', !visible);

      element.querySelectorAll('input, select, textarea').forEach(field => {
        field.disabled = !visible;
      });
    });

    console.log('✅ Defektų forma režimas:', transportMode);
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

  function validateFileFormat(file) {
    const extension = getFileExtension(file.name, file.type);
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

    if (!allowedExtensions.includes(extension)) {
      throw new Error(
        tr(
          'unsupported_file_format',
          'Failo formatas nepalaikomas: {file}. Naudokite JPG, JPEG, PNG, WEBP arba HEIC. RAW / DNG formato nuotraukos nepalaikomos.'
        ).replace('{file}', file.name)
      );
    }

    return extension;
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
    driverInput.removeAttribute('list');
    driverInput.setAttribute('data-locked-driver', 'true');
    driverInput.setAttribute('title', tr('driver_auto_title', 'Vairuotojas nustatomas automatiškai pagal prisijungimą'));

    driverInput.classList.add(
      'opacity-70',
      'cursor-not-allowed'
    );

    const wrapper = driverInput.closest('.field, .form-group, div');

    if (wrapper && !wrapper.querySelector('.driver-auto-note')) {
      const note = document.createElement('div');
      note.className = 'driver-auto-note text-xs text-slate-400 mt-1';
      note.textContent = tr('driver_auto_note', 'Vairuotojas nustatytas automatiškai pagal prisijungimą.');
      wrapper.appendChild(note);
    }
  }

  function getDefectLocationValue(formData) {
    if (isTruckMode) {
      return getValue(formData, ['truck_location']);
    }

    return getValue(formData, [
      'location',
      'defectLocation',
      'defect_location',
      'defectPlace',
      'place'
    ]);
  }

  function getCachedLocations() {
    try {
      const raw = sessionStorage.getItem(LOCATIONS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!parsed || !Array.isArray(parsed.rows) || !parsed.cached_at) {
        return null;
      }

      const age = Date.now() - Number(parsed.cached_at);

      if (age > LOCATIONS_CACHE_TTL_MS) {
        sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
        return null;
      }

      return parsed.rows;
    } catch (error) {
      console.warn('⚠️ Nepavyko perskaityti lokacijų cache:', error);
      sessionStorage.removeItem(LOCATIONS_CACHE_KEY);
      return null;
    }
  }

  function setCachedLocations(rows) {
    try {
      sessionStorage.setItem(
        LOCATIONS_CACHE_KEY,
        JSON.stringify({
          cached_at: Date.now(),
          rows
        })
      );
    } catch (error) {
      console.warn('⚠️ Nepavyko išsaugoti lokacijų cache:', error);
    }
  }

  async function fetchAllLocations() {
    const cached = getCachedLocations();

    if (cached) {
      console.log('✅ Lokacijos iš cache:', cached.length);
      return cached;
    }

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

    setCachedLocations(allRows);

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
        title: tr('data_load_error_title', 'Nepavyko užkrauti duomenų'),
        message: tr('data_load_error_message', 'Nepavyko užkrauti vilkikų, vairuotojų arba lokacijų sąrašų. Patikrink Console klaidą.')
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
        title: tr('data_load_error_title', 'Nepavyko užkrauti duomenų'),
        message: tr('data_load_error_message', 'Nepavyko užkrauti vilkikų, vairuotojų arba lokacijų sąrašų. Patikrink Console klaidą.')
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

  function validateRequiredFields(formData) {
    clearInvalidMarks();

    const driverValue = isDriver
      ? getCurrentDriverName()
      : getValue(formData, ['driver', 'driverName', 'driver_name']);

    const required = [
      {
        label: tr('cmr_number', 'CMR numeris'),
        value: getValue(formData, ['cmr', 'cmr_number', 'cmrNumber']),
        element: form.querySelector('[name="cmr"]')
      },
      {
        label: tr('truck', 'Vilkikas'),
        value: getValue(formData, ['truck', 'truck_number', 'truckNumber']),
        element: form.querySelector('[name="truck"]')
      },
      {
        label: tr('driver', 'Vairuotojas'),
        value: driverValue,
        element:
          form.querySelector('[name="driver"]') ||
          form.querySelector('[name="driverName"]') ||
          form.querySelector('[name="driver_name"]')
      },
      {
        label: tr('stage', 'Etapas'),
        value: getValue(formData, ['stage']),
        element: null
      },
      {
        label: tr('loading_place', 'Pasikrovimo vieta'),
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
        label: tr('unloading_place', 'Išsikrovimo vieta'),
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
        label: isTruckMode
          ? tr('truck_cargo_defect_location', 'Krovinio defekto / pažeidimo vieta')
          : tr('defect_location', 'Defekto vieta'),
        value: getDefectLocationValue(formData),
        element: isTruckMode
          ? form.querySelector('[name="truck_location"]')
          : (
              form.querySelector('[name="location"]') ||
              form.querySelector('[name="defectLocation"]') ||
              form.querySelector('[name="defect_location"]')
            )
      },
      {
        label: tr('vin_number', 'VIN'),
        value: getValue(formData, ['vin_number', 'vin', 'vinNumber']),
        element:
          form.querySelector('[name="vin_number"]') ||
          form.querySelector('[name="vin"]') ||
          form.querySelector('[name="vinNumber"]')
      },
      {
        label: tr('explanation', 'Paaiškinimas'),
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

    if (isTruckMode) {
      required.push(
        {
          label: tr('damage_type', 'Pažeidimo tipas'),
          value: getValue(formData, ['damage_type', 'damageType']),
          element: form.querySelector('[name="damage_type"]')
        },
        {
          label: tr('cargo_type', 'Krovinio tipas'),
          value: getValue(formData, ['cargo_type', 'cargoType']),
          element: form.querySelector('[name="cargo_type"]')
        }
      );
    }

    const missing = required.filter(item => !item.value);

    missing.forEach(item => {
      if (item.element) {
        markInvalid(item.element);
      }

      if (item.label === tr('stage', 'Etapas')) {
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
        label: tr('photo_vin', 'VIN / numerio nuotrauka'),
        category: 'vin',
        input: getRequiredPhotoInput('vin')
      },
      {
        label: tr('photo_far', 'Nuotrauka iš toli'),
        category: 'far',
        input: getRequiredPhotoInput('far')
      },
      {
        label: tr('photo_close', 'Nuotrauka iš arti'),
        category: 'close',
        input: getRequiredPhotoInput('close')
      },
      {
        label: tr('photo_document', 'Dokumento nuotrauka'),
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
        title: tr('report_incomplete_title', 'Neužpildyta ataskaita'),
        message:
          tr('report_incomplete_message', 'Užpildyk visus privalomus laukus:') +
          '\n\n' +
          allMissing.map(item => `• ${item}`).join('\n')
      });

      missing[0]?.element?.focus();
      return false;
    }

    return true;
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

        const extension = validateFileFormat(file);

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
          throw new Error(
            tr('photo_upload_error', 'Nepavyko įkelti nuotraukos: {file}')
              .replace('{file}', file.name)
          );
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
      throw new Error(tr('no_photos_to_upload', 'Nerasta nuotraukų įkėlimui.'));
    }

    const { error: photosError } = await supabase
      .from('defect_photos')
      .insert(photoRows);

    if (photosError) {
      console.error('❌ Nuotraukų registro klaida:', photosError);
      throw new Error(tr('photo_register_error', 'Nuotraukos įkeltos, bet nepavyko įrašyti jų registro.'));
    }

    return photoRows;
  }

  applyTransportModeVisibility();
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
        transport_mode: transportMode,

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
          getDefectLocationValue(formData),

        vin_number:
          getValue(formData, ['vin_number', 'vin', 'vinNumber']),

        damage_type: isTruckMode
          ? getValue(formData, ['damage_type', 'damageType'])
          : null,

        cargo_type: isTruckMode
          ? getValue(formData, ['cargo_type', 'cargoType'])
          : null,

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
          title: tr('save_error_title', 'Nepavyko išsaugoti'),
          message: error.message
        });

        return;
      }

      if (!defect?.id) {
        showModal({
          type: 'error',
          title: tr('save_error_title', 'Nepavyko išsaugoti'),
          message: tr('save_missing_id', 'Defektas sukurtas, bet nepavyko gauti jo ID.')
        });

        return;
      }

      await uploadDefectPhotos(defect.id, formData);

      showModal({
        type: 'success',
        title: tr('success_title', 'Ataskaita išsaugota'),
        message: tr('success_message', 'Defekto ataskaita ir nuotraukos sėkmingai pateiktos.')
      });

      form.reset();
      clearInvalidMarks();
      updateAllPhotoStatuses();
      applyTransportModeVisibility();

      if (isDriver) {
        lockDriverFieldForLoggedInDriver();
      }

    } catch (err) {
      console.error('❌ Defekto pateikimo klaida:', err);

      showModal({
        type: 'error',
        title: tr('submit_error_title', 'Nepavyko pateikti ataskaitos'),
        message: err?.message || tr('unknown_error', 'Įvyko nežinoma klaida.')
      });

    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      }
    }
  };
}