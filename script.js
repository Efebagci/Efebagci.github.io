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
