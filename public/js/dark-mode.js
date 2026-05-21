(function () {
  const STORAGE_KEY = 'theme';
  const btn = document.getElementById('dark-mode-toggle');

  // Áp dụng theme đã lưu ngay khi load (trước khi render)
  function applyTheme(theme) {
    document.body.classList.toggle('dark', theme === 'dark');
    const icon = document.getElementById('dark-mode-icon');
    if (icon) {
      // dark mode → đèn tắt, light mode → đèn sáng
      icon.src = theme === 'dark' ? '/images/idea (1).png' : '/images/idea.png';
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY) || 'light';
  applyTheme(saved);

  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark');
      const next = isDark ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  }
})();