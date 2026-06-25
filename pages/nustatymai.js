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

  if (!typeSelect || !instrList || !langSelect) return;

  if (!canManageInstructions) {
    instructionFormPanel?.classList.add('hidden');
  }

  if (!isAdmin) {
    dashboardPanel?.classList.add('hidden');
  }

  let instructions = [];
  let editInstructionId = localStorage.getItem('editInstructionId') || null;

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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Instructions load error:', error);
      instructions = [];
      return;
    }

    instructions = (data || []).map(normalizeInstruction);
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
      instrList.innerHTML = `<div class="text-slate-400">Nėra instrukcijų</div>`;
      return;
    }

    instrList.innerHTML = list.map(item => `
      <div class="bg-slate-800 rounded-lg p-3 flex items-center justify-between" data-id="${item.id}">
        <div class="pr-4 min-w-0">
          <div class="font-semibold break-words">${escapeHtml(item.title)}</div>
          <div class="text-sm text-slate-400 break-words">${escapeHtml(item.description || '')}</div>
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
        console.error('Instruction delete error:', error);
        alert(
          'Nepavyko ištrinti instrukcijos:\n\n' +
          (error.message || JSON.stringify(error))
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
      preview.innerHTML = `<div class="text-slate-400 text-sm">Dashboard paveikslėlių nėra</div>`;
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
}
