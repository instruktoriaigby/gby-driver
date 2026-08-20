import { t } from '../../i18n.js';

export async function initInstrukcijos({ supabase, user, profile }) {
  const container = document.getElementById('topicsContainer');
  const searchInput = document.getElementById('instructionSearch');
  const searchList = document.getElementById('instructionSearchList');

  if (!container) return;

  const currentLang = localStorage.getItem('lang') || profile?.lang || 'lt';
  const role = profile?.role || 'driver';
  const transportMode =
    profile?.transport_mode ||
    profile?.app_transport_mode ||
    profile?.effective_transport_mode ||
    'car_transporter';

  const isEditorRole = [
    'admin',
    'instructor',
    'truck_instructor',
   ].includes(role);

  let currentTab = 'general';
  let instructions = [];

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getTranslation(key, fallback) {
    const value = t(key);

    if (!value) return fallback;
    if (value === key) return fallback;

    return value;
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
      unload: row.unload_text || '',
      images: []
    };
  }

  async function loadInstructions() {
    let query = supabase
      .from('instructions')
      .select('*')
      .eq('transport_mode', transportMode)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Instructions load error:', error);
      container.innerHTML = `
        <div class="text-red-400">
          ${getTranslation('common.no_instructions', 'Nepavyko užkrauti instrukcijų.')}
        </div>
      `;
      instructions = [];
      return;
    }

    instructions = (data || []).map(normalizeInstruction);

    console.log('✅ Instrukcijos užkrautos:', {
      transportMode,
      count: instructions.length
    });
  }

  function isGoogleDriveUrl(value) {
    return /drive\.google\.com/i.test(String(value || ''));
  }

  function getGoogleDrivePreviewUrl(value) {
    const raw = String(value || '').trim();

    const driveMatch =
      raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i) ||
      raw.match(/[?&]id=([^&]+)/i);

    if (driveMatch) {
      return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }

    return raw;
  }

  function getEmbedUrl(videoValue) {
    const value = String(videoValue || '').trim();

    if (!value) return '';

    if (isGoogleDriveUrl(value)) {
      return getGoogleDrivePreviewUrl(value);
    }

    if (/player\.vimeo\.com\/video\/(\d+)/i.test(value)) {
      return value;
    }

    const vimeoMatch =
      value.match(/vimeo\.com\/(\d+)/i) ||
      value.match(/^(\d+)$/);

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

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    return '';
  }

  function langInstructions() {
    return instructions.filter(item => {
      const itemLang = item.lang || 'lt';
      const itemMode = item.transport_mode || 'car_transporter';

      return itemLang === currentLang && itemMode === transportMode;
    });
  }

  function fillSearchSuggestions() {
    if (!searchList) return;

    searchList.innerHTML = langInstructions()
      .map(item => `<option value="${escapeHtml(item.title)}"></option>`)
      .join('');
  }

  function getVisibleInstructions() {
    const q = (searchInput?.value || '').toLowerCase().trim();

    return langInstructions().filter(item => {
      const matchesText =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q);

      return matchesText && item.type === currentTab;
    });
  }

  function renderList() {
    const list = getVisibleInstructions();

    if (!list.length) {
      container.innerHTML = `
        <div class="text-slate-400">
          ${getTranslation('common.no_instructions', 'Nėra instrukcijų')}
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(item => `
      <div
        class="topic instruction-card bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-hidden"
        data-id="${escapeHtml(item.id)}"
      >
        <div class="flex flex-col gap-3">
          <div class="min-w-0">
            <div class="font-semibold break-words">${escapeHtml(item.title)}</div>
            <div class="text-sm text-slate-400 break-words">${escapeHtml(item.description || '')}</div>
          </div>

          <div class="instruction-actions grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
            ${isEditorRole ? `
              <button class="edit-btn bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-xs">
                ✏️
              </button>
            ` : ''}

            ${isEditorRole ? `
              <button class="delete-btn bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-xs">
                🗑
              </button>
            ` : ''}

            <button class="open-topic-btn bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded-xl font-semibold">
              ${getTranslation('instr.open_instruction', getTranslation('common.open', 'Atidaryti'))}
            </button>
          </div>
        </div>

        <div
          class="topic-content hidden mt-4 bg-slate-900 p-3 sm:p-4 rounded-xl border border-slate-700 overflow-hidden"
          id="content-${escapeHtml(item.id)}"
        ></div>
      </div>
    `).join('');
  }

  function renderInstructionContent(instr) {
    if (!instr) {
      return getTranslation('common.no_instructions', 'Nėra instrukcijų');
    }

    const rawVideoUrl = String(instr.video || '').trim();
    const embedUrl = getEmbedUrl(rawVideoUrl);
    const isDriveVideo = rawVideoUrl && isGoogleDriveUrl(rawVideoUrl);

    let html = '';

    if (isDriveVideo) {
      html += `
        <div class="drive-video-desktop">
          <div class="instruction-video-box">
            <iframe
              class="instruction-video-frame"
              src="${escapeHtml(getGoogleDrivePreviewUrl(rawVideoUrl))}"
              loading="lazy"
              frameborder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen>
            </iframe>
          </div>
        </div>
      `;
    } else if (embedUrl) {
      html += `
        <div class="instruction-video-box">
          <iframe
            class="instruction-video-frame"
            src="${escapeHtml(embedUrl)}"
            loading="lazy"
            frameborder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      `;
    }

    if (rawVideoUrl || instr.test || instr.pdf || instr.link) {
      html += `<div class="instruction-links grid grid-cols-1 gap-2 mt-3">`;
    }

    if (rawVideoUrl) {
      html += `
        <a
          href="${escapeHtml(rawVideoUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block bg-blue-600 hover:bg-blue-700 px-4 py-3 text-center rounded-xl font-semibold break-words"
        >
          ${getTranslation('instr.video', '▶ Video')}
        </a>
      `;
    }

    if (instr.test) {
      html += `
        <a
          href="${escapeHtml(instr.test)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block bg-blue-600 hover:bg-blue-700 px-4 py-3 text-center rounded-xl font-semibold break-words"
        >
          ${getTranslation('common.go_to_test', 'Pereiti į testą')}
        </a>
      `;
    }

    if (instr.pdf) {
      html += `
        <a
          href="${escapeHtml(instr.pdf)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block bg-slate-700 hover:bg-slate-600 px-4 py-3 text-center rounded-xl font-semibold break-words"
        >
          ${getTranslation('common.cheat_sheet', 'Cheat sheet')}
        </a>
      `;
    }

    if (instr.link) {
      html += `
        <a
          href="${escapeHtml(instr.link)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block bg-blue-600 hover:bg-blue-700 px-4 py-3 text-center rounded-xl font-semibold break-words"
        >
          ${getTranslation('common.open_link', 'Atidaryti nuorodą')}
        </a>
      `;
    }

    if (rawVideoUrl || instr.test || instr.pdf || instr.link) {
      html += `</div>`;
    }

    if (instr.load || instr.unload) {
      html += `
        <div class="text-slate-400 mt-3 break-words">
          📍 ${escapeHtml(instr.load || '')} → ${escapeHtml(instr.unload || '')}
        </div>
      `;
    }

    if (instr.avoid) {
      html += `
        <div class="mt-3 break-words">
          <b>${getTranslation('common.avoid', 'Kaip išvengti:')}</b><br>
          ${escapeHtml(instr.avoid)}
        </div>
      `;
    }

    if (!html.trim()) {
      html = `
        <div class="text-slate-400">
          ${getTranslation('common.no_instructions', 'Nėra instrukcijų')}
        </div>
      `;
    }

    return html;
  }

 async function deleteInstruction(id) {
  if (!isEditorRole) {
    alert(
      currentLang === 'ru'
        ? 'У вас нет прав удалять инструкции.'
        : currentLang === 'en'
          ? 'You do not have permission to delete instructions.'
          : 'Neturite teisės trinti instrukcijų.'
    );
    return;
  }

  const confirmed = confirm(
    currentLang === 'ru'
      ? 'Вы уверены, что хотите удалить инструкцию?'
      : currentLang === 'en'
        ? 'Are you sure you want to delete this instruction?'
        : 'Ar tikrai ištrinti instrukciją?'
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from('instructions')
    .delete()
    .eq('id', id)
    .eq('transport_mode', transportMode);

  if (error) {
    console.error('Instruction delete error:', error);

    alert(
      currentLang === 'ru'
        ? 'Не удалось удалить инструкцию'
        : currentLang === 'en'
          ? 'Failed to delete instruction'
          : 'Nepavyko ištrinti instrukcijos'
    );

    return;
  }

  await loadInstructions();
  fillSearchSuggestions();
  renderList();
}

  await loadInstructions();
  fillSearchSuggestions();
  renderList();

  searchInput?.addEventListener('input', renderList);

  container.addEventListener('click', async (e) => {
    const topic = e.target.closest('.topic');

    if (!topic) return;

    const id = topic.dataset.id;
    const instr = instructions.find(item => String(item.id) === String(id));

    if (!instr) return;

    if (e.target.closest('.delete-btn')) {
  e.stopPropagation();

  if (!isEditorRole) {
    alert(
      currentLang === 'ru'
        ? 'У вас нет прав удалять инструкции.'
        : currentLang === 'en'
          ? 'You do not have permission to delete instructions.'
          : 'Neturite teisės trinti instrukcijų.'
    );
    return;
  }

  await deleteInstruction(id);
  return;
}

if (e.target.closest('.edit-btn')) {
  e.stopPropagation();

  if (!isEditorRole) {
    alert(
      currentLang === 'ru'
        ? 'У вас нет прав редактировать инструкции.'
        : currentLang === 'en'
          ? 'You do not have permission to edit instructions.'
          : 'Neturite teisės redaguoti instrukcijų.'
    );
    return;
  }

  localStorage.setItem('editInstructionId', id);
  window.navigateTo('nustatymai');
  return;
}

    if (!e.target.closest('.open-topic-btn')) {
      return;
    }

    const content = document.getElementById(`content-${id}`);

    if (!content) return;

    document.querySelectorAll('.topic-content').forEach(el => {
      if (el !== content) {
        el.classList.add('hidden');
      }
    });

    const isOpen = !content.classList.contains('hidden');

    content.classList.toggle('hidden');

    if (isOpen) return;

    content.innerHTML = renderInstructionContent(instr);
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      currentTab = btn.dataset.tab;

      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('bg-blue-600');
        b.classList.add('bg-slate-800');
      });

      btn.classList.add('bg-blue-600');
      btn.classList.remove('bg-slate-800');

      renderList();
    };
  });

  document.querySelector('[data-tab="general"]')?.click();
}