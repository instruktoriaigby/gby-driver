import { t } from '../../i18n.js';

export async function initInstrukcijos({ supabase, user, profile }) {
  const container = document.getElementById('topicsContainer');
  const searchInput = document.getElementById('instructionSearch');
  const searchList = document.getElementById('instructionSearchList');

  if (!container) return;

  const currentLang = localStorage.getItem('lang') || profile?.lang || 'lt';
  const role = profile?.role || 'driver';
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
      unload: row.unload_text || '',
      images: []
    };
  }

  async function loadInstructions() {
    const { data, error } = await supabase
      .from('instructions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Instructions load error:', error);
      container.innerHTML = `<div class="text-red-400">Nepavyko užkrauti instrukcijų.</div>`;
      instructions = [];
      return;
    }

    instructions = (data || []).map(normalizeInstruction);
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

  function langInstructions() {
    return instructions.filter(item => (item.lang || 'lt') === currentLang);
  }

  function fillSearchSuggestions() {
    if (!searchList) return;

    searchList.innerHTML = langInstructions().map(item =>
      `<option value="${escapeHtml(item.title)}"></option>`
    ).join('');
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
      container.innerHTML = `<div class="text-slate-400">${t('common.no_instructions')}</div>`;
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="topic bg-slate-800 p-4 rounded-xl cursor-pointer hover:bg-slate-700"
        data-id="${item.id}">

        <div class="flex justify-between items-center gap-4">
          <div>
            <div class="font-semibold">${escapeHtml(item.title)}</div>
            <div class="text-sm text-slate-400">${escapeHtml(item.description || '')}</div>
          </div>

          <div class="flex gap-2 shrink-0">
            ${item.pdf ? `<button class="cheat-btn bg-slate-700 px-3 py-1 rounded">${t('common.cheat_sheet')}</button>` : ''}
            ${role === 'instructor' || role === 'admin' ? `<button class="edit-btn bg-yellow-600 px-2 py-1 rounded text-xs">✏️</button>` : ''}
            ${role === 'instructor' || role === 'admin' ? `<button class="delete-btn bg-red-600 px-2 py-1 rounded text-xs">🗑</button>` : ''}
          </div>
        </div>

        <div class="topic-content hidden mt-4 bg-slate-900 p-4 rounded-xl border border-slate-700 space-y-3"
          id="content-${item.id}">
        </div>
      </div>
    `).join('');
  }

  function renderInstructionContent(instr) {
    if (!instr) return t('common.no_instructions');

    let html = `
      <div class="text-slate-200 break-words">
        ${escapeHtml(instr.description || '')}
      </div>
    `;

    const embedUrl = getEmbedUrl(instr.video);

    if (embedUrl) {
      html += `
        <div class="instruction-video-box mt-3">
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

    if (instr.test || instr.pdf || instr.link) {
      html += `<div class="instruction-links grid grid-cols-1 gap-2 mt-3">`;
    }

    if (instr.test) {
      html += `
        <a
          href="${escapeHtml(instr.test)}"
          target="_blank"
          rel="noopener noreferrer"
          class="block bg-blue-600 hover:bg-blue-700 px-4 py-3 text-center rounded-xl font-semibold break-words"
        >
          ${t('common.go_to_test')}
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
          ${t('common.cheat_sheet')}
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
          Atidaryti nuorodą
        </a>
      `;
    }

    if (instr.test || instr.pdf || instr.link) {
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
          <b>${t('common.avoid')}</b><br>
          ${escapeHtml(instr.avoid)}
        </div>
      `;
    }

    return html;
  }

  async function deleteInstruction(id) {
    const confirmed = confirm('Ar tikrai ištrinti instrukciją?');
    if (!confirmed) return;

    const { error } = await supabase
      .from('instructions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Instruction delete error:', error);
      alert('Nepavyko ištrinti instrukcijos');
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
      await deleteInstruction(id);
      return;
    }

    if (e.target.closest('.edit-btn')) {
      e.stopPropagation();
      localStorage.setItem('editInstructionId', id);
      window.navigateTo('nustatymai');
      return;
    }

    if (e.target.closest('.cheat-btn')) {
      e.stopPropagation();
      if (instr.pdf) window.open(instr.pdf, '_blank');
      return;
    }

    const content = document.getElementById(`content-${id}`);

    document.querySelectorAll('.topic-content').forEach(el => {
      if (el !== content) el.classList.add('hidden');
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
      renderList();
    };
  });

  document.querySelector('[data-tab="general"]')?.click();
}