// panel-resize.js - Side panels (protocols, glossary) get wider or narrower by dragging their inner edge.
//
//   PanelResize.attach(panel, { edge: 'right', key: 'adenai-protocol-width', min: 340 })
//
// edge: the side with the handle ('right' for a panel on the left of the screen). The width is remembered per device;
// a double click on the handle goes back to the default. Not on narrow screens, where the panels fill the screen.
window.PanelResize = {
    attach(panel, { edge = 'right', key, min = 320, margin = 60 } = {}) {
        const handle = document.createElement('div');
        handle.className = `panel-resize panel-resize-${edge}`;
        handle.title = 'Ziehen ändert die Breite · Doppelklick: Standard';
        handle.setAttribute('role', 'separator');
        handle.setAttribute('aria-orientation', 'vertical');
        panel.appendChild(handle);

        const max = () => window.innerWidth - margin;
        const apply = (w) => { panel.style.width = w ? `${Math.round(Math.max(min, Math.min(max(), w)))}px` : ''; };
        const save = (w) => { try { if (w) localStorage.setItem(key, String(Math.round(w))); else localStorage.removeItem(key); } catch { /* private mode */ } };
        try { const w = Number(localStorage.getItem(key)); if (w && window.innerWidth >= 800) apply(w); } catch { /* none saved */ }

        handle.addEventListener('pointerdown', (e) => {
            if (window.innerWidth < 800 || e.button !== 0) return;
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            const rect = panel.getBoundingClientRect();
            const startX = e.clientX;
            panel.classList.add('resizing');
            const move = (ev) => apply(edge === 'right' ? rect.width + ev.clientX - startX : rect.width - (ev.clientX - startX));
            const up = () => {
                handle.removeEventListener('pointermove', move);
                panel.classList.remove('resizing');
                save(panel.getBoundingClientRect().width);
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up, { once: true });
            handle.addEventListener('pointercancel', up, { once: true });
        });
        handle.addEventListener('dblclick', () => { apply(0); save(0); });
        // keyboard: arrows on the focused handle
        handle.tabIndex = 0;
        handle.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            e.preventDefault();
            const step = (e.key === 'ArrowRight') === (edge === 'right') ? 40 : -40;
            apply(panel.getBoundingClientRect().width + step);
            save(panel.getBoundingClientRect().width);
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth < 800) panel.style.width = '';
            else try { const w = Number(localStorage.getItem(key)); if (w) apply(w); } catch { /* none */ }
        });
    },
};
