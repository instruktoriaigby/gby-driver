const SUPABASE_FUNCTION_URL =
  'https://mpinqqikfmzwionkynxh.supabase.co/functions/v1/dynamic-endpoint';

const params = new URLSearchParams(window.location.search);
const token = params.get('token') || '';

const descriptionEl = document.getElementById('description');
const generateBtn = document.getElementById('generateBtn');
const statusBox = document.getElementById('statusBox');

function showStatus(type, message) {
  statusBox.classList.remove(
    'hidden',
    'bg-red-900',
    'border-red-700',
    'text-red-100',
    'bg-green-900',
    'border-green-700',
    'text-green-100',
    'bg-blue-900',
    'border-blue-700',
    'text-blue-100'
  );

  statusBox.classList.add('border');

  if (type === 'error') {
    statusBox.classList.add('bg-red-900', 'border-red-700', 'text-red-100');
  } else if (type === 'success') {
    statusBox.classList.add('bg-green-900', 'border-green-700', 'text-green-100');
  } else {
    statusBox.classList.add('bg-blue-900', 'border-blue-700', 'text-blue-100');
  }

  statusBox.textContent = message;
}

function getFileNameFromContentDisposition(headerValue) {
  if (!headerValue) return '';

  const match = headerValue.match(/filename="?([^"]+)"?/i);
  return match?.[1] || '';
}

function setLoading(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? 'Generating PDF...' : 'Generate PDF report';
}

async function generatePdf() {
  const description = descriptionEl.value.trim();

  if (!token) {
    showStatus('error', 'Missing report token. Open the link from the defect email.');
    return;
  }

  if (!description) {
    showStatus('error', 'Please enter Description before generating PDF.');
    descriptionEl.focus();
    return;
  }

  setLoading(true);
  showStatus('info', 'Generating PDF report. Please wait...');

  try {
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        description
      })
    });

    const contentType = response.headers.get('Content-Type') || '';

    if (!response.ok) {
      let errorMessage = 'Failed to generate PDF report.';

      if (contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => null);
        errorMessage = errorData?.error || errorMessage;
      } else {
        errorMessage = await response.text().catch(() => errorMessage);
      }

      throw new Error(errorMessage);
    }

    const blob = await response.blob();

    const contentDisposition = response.headers.get('Content-Disposition');
    const fileName =
      getFileNameFromContentDisposition(contentDisposition) ||
      `Defect_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);

    showStatus('success', 'PDF report generated successfully.');
  } catch (error) {
    console.error(error);
    showStatus('error', error.message || 'Failed to generate PDF report.');
  } finally {
    setLoading(false);
  }
}

if (!token) {
  showStatus('error', 'Missing report token. Open this page from the defect email link.');
  generateBtn.disabled = true;
}

generateBtn.addEventListener('click', generatePdf);