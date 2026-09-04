const pdfInput = document.getElementById('pdfInput');
const pdfViewer = document.getElementById('pdfViewer');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');

let zoom = 1;

pdfInput.addEventListener('change', (event) => {
  const file = event.target.files[0];

  if (!file) return;

  if (file.type !== 'application/pdf') {
    alert('Selecione um arquivo PDF válido.');
    return;
  }

  const fileUrl = URL.createObjectURL(file);
  pdfViewer.src = fileUrl;
});

zoomInBtn.addEventListener('click', () => {
  zoom = Math.min(zoom + 0.1, 2);
  pdfViewer.style.transform = `scale(${zoom})`;
});

zoomOutBtn.addEventListener('click', () => {
  zoom = Math.max(zoom - 0.1, 0.6);
  pdfViewer.style.transform = `scale(${zoom})`;
});
