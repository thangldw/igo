const year = document.querySelector('[data-footer-year]');
if (year) year.textContent = String(new Date().getFullYear());
