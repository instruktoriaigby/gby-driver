function renderDashboardImages() {

  const container = document.getElementById('dashboardImages');
  if (!container) return;

  let images = [];

  try {
    images = JSON.parse(localStorage.getItem('dashboardImages') || '[]');
  } catch {}

  if (images.length === 0) {
    container.innerHTML = `
      <div class="text-slate-400 col-span-3">
        Nėra informacijos (įkelk per nustatymus)
      </div>
    `;
    return;
  }

  container.innerHTML = images.map(img => `
    <div class="bg-slate-800 rounded-xl overflow-hidden">
      <img src="${img}" class="w-full h-48 object-cover cursor-pointer"
        onclick="window.open('${img}', '_blank')">
    </div>
  `).join('');
}