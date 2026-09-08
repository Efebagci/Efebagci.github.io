// ------------------------------------------------------------------
// PAKETLER: Buradan paketleri ve özellik değerlerini düzenleyebilirsin.
// - "features" içindeki her satır tabloda bir satır olarak görünür.
//   true -> ✓ olarak görünür, yazı -> o yazı olduğu gibi görünür.
// - "Fiyat" satırının EN SONDA olması gerekir; tablo son satırı otomatik
//   olarak vurgulu (kırmızı, kalın) gösterir.
// - Tüm paketlerdeki "features" AYNI SIRADA ve AYNI İSİMLERLE olmalı.
// - "highlight: true" yaparsan o paket "Önerilen" etiketiyle vurgulanır.
// ------------------------------------------------------------------
const packages = [
  {
    name: 'Premium',
    highlight: false,
    features: {
      'Kullanım kolaylığı': true,
      'Anlık destek': 'Var',
      'Kişiye özel modifikasyonlar': 'Yok',
      'Scriptlerin maksimum kullanım ömrü': '10',
      'Aylık kredi': '200C',
      'Fiyat': '400 TL',
    },
  },
  {
    name: 'Ekstra',
    highlight: false,
    features: {
      'Kullanım kolaylığı': true,
      'Anlık destek': 'Öncelikli',
      'Kişiye özel modifikasyonlar': 'Sınırlı',
      'Scriptlerin maksimum kullanım ömrü': '15',
      'Aylık kredi': '400C',
      'Fiyat': '650 TL',
    },
  },
  {
    name: 'Max',
    highlight: false,
    features: {
      'Kullanım kolaylığı': true,
      'Anlık destek': 'En başta',
      'Kişiye özel modifikasyonlar': 'Var',
      'Scriptlerin maksimum kullanım ömrü': '20',
      'Aylık kredi': '600C',
      'Fiyat': '900 TL',
    },
  },
];

function renderPackageTable() {
  const table = document.getElementById('package-table');
  if (!table) return;

  const featureKeys = Object.keys(packages[0].features);

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th')).className = 'feature-col';

  packages.forEach((pkg) => {
    const th = document.createElement('th');
    th.className = 'pkg-col' + (pkg.highlight ? ' pkg-col-highlight' : '');
    th.innerHTML = `
      ${pkg.highlight ? '<span class="pkg-badge">Önerilen</span>' : ''}
      <div class="pkg-name">${pkg.name}</div>
    `;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  featureKeys.forEach((key) => {
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.className = 'feature-label';
    labelCell.textContent = key;
    row.appendChild(labelCell);

    packages.forEach((pkg) => {
      const cell = document.createElement('td');
      cell.className = 'pkg-col' + (pkg.highlight ? ' pkg-col-highlight' : '');
      const value = pkg.features[key];
      if (value === true) {
        cell.innerHTML = '<span class="check-yes">✓</span>';
      } else if (value === false) {
        cell.innerHTML = '<span class="check-no">–</span>';
      } else {
        cell.textContent = value;
      }
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
}

document.addEventListener('DOMContentLoaded', () => {
  // Mobil menü aç/kapat
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Paket karşılaştırma tablosunu oluştur
  renderPackageTable();

  // Terminal yazma animasyonu
  const body = document.getElementById('terminal-body');
  if (!body) return;

  const lines = [
    { text: '$ python otomasyon.py --musteri "ornek_firma"', type: 'prompt' },
    { text: 'Rapor hazırlanıyor...', type: 'normal' },
    { text: 'Veriler senkronize ediliyor...', type: 'normal' },
    { text: 'Bildirim gönderiliyor...', type: 'normal' },
    { text: '✓ Tamamlandı (3.2s)', type: 'success' },
  ];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion) {
    body.innerHTML = lines.map((l) => `<div class="${l.type}">${l.text}</div>`).join('');
    return;
  }

  let lineIndex = 0;
  let charIndex = 0;

  function typeNextChar() {
    if (lineIndex >= lines.length) return;
    const currentLine = lines[lineIndex];
    let lineEl = body.children[lineIndex];
    if (!lineEl) {
      lineEl = document.createElement('div');
      lineEl.className = currentLine.type;
      body.appendChild(lineEl);
    }
    charIndex++;
    lineEl.textContent = currentLine.text.slice(0, charIndex);
    if (charIndex < currentLine.text.length) {
      setTimeout(typeNextChar, 18);
    } else {
      lineIndex++;
      charIndex = 0;
      setTimeout(typeNextChar, 350);
    }
  }

  typeNextChar();
});
