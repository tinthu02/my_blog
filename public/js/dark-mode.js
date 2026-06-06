(function () {
  const STORAGE_KEY = 'theme';

  function applyTheme(theme) {
    const root = document.documentElement;
    document.body.classList.toggle('dark', theme === 'dark');
    if (theme === 'dark') {
      root.setAttribute('data-bs-theme', 'dark');
    } else {
      root.removeAttribute('data-bs-theme');
    }

    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      icon.src = theme === 'dark' ? '/images/idea (1).png' : '/images/idea.png';
    }
  }

  // Áp dụng theme đã lưu ngay khi load
  const saved = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(saved);

  // Gắn event listener sau khi DOM load xong
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        const next = isDark ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        applyTheme(next);
      });
    }
  });
})();