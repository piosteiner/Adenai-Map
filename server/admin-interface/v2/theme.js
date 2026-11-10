// The chosen light or dark theme before the first paint — a file, not an inline script, so the CSP forbids inline
// scripts (2026-11-10).
try { var t = localStorage.getItem('adenai-cms-theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
