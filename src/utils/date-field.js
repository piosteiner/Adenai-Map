// date-field.js - Date inputs you can type and paste into.
//
// Browsers' <input type="date"> takes neither pasted text nor free typing. DateField.enhance(input) keeps the input as
// the value holder (ISO "yyyy-mm-dd", hidden; forms read .value as before) and shows a text field next to a 📅 button
// that opens the browser's own picker. Text is read as DAY first — "03/06/5663", "3.6.5663", "3-6-5663" are 3 June —
// unless that can't be (06/23/2026: 23 is no month), and also "5663-06-03", "3. Juni 5663", "June 3, 5663".
// Without a year ("3.6.") the field's year is used: data-default-year, else the year of its min, else the current one.
// Used by the map (protocol form) and bundled into the CMS (server/editor-src).
(function (root) {
    const MONTHS = {
        jan: 1, januar: 1, january: 1, jänner: 1, feb: 2, februar: 2, february: 2, mär: 3, mar: 3, märz: 3, maerz: 3, march: 3,
        apr: 4, april: 4, mai: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8,
        sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10, nov: 11, november: 11, dez: 12, dec: 12, dezember: 12, december: 12,
    };
    const pad = (n, w = 2) => String(n).padStart(w, '0');

    function valid(y, m, d) {
        if (!(y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
        const t = new Date(Date.UTC(y, m - 1, d));
        if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null; // 31.02.
        return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
    }

    const fullYear = (y, s) => (s.length <= 2 ? 2000 + Number(y) : Number(y));

    // Text → "yyyy-mm-dd", or null if it isn't a date
    function parse(text, { defaultYear = new Date().getFullYear() } = {}) {
        const s = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!s) return null;
        let m;
        if ((m = /^(\d{3,5})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return valid(+m[1], +m[2], +m[3]); // ISO-like, year first
        if ((m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{3,5}))?\.?$/.exec(s))) {
            let [a, b] = [+m[1], +m[2]];
            const y = m[3] ? fullYear(m[3], m[3]) : defaultYear;
            if (b > 12 && a <= 12) [a, b] = [b, a]; // only when day-first is impossible: month/day
            return valid(y, b, a);
        }
        // "3. juni 5663", "3 june 5663", "june 3, 5663", "juni 5663" is not enough (no day)
        if ((m = /^(\d{1,2})\.? ([a-zäöü]+)\.?,? ?(\d{2}|\d{3,5})?$/.exec(s)) && MONTHS[m[2]]) return valid(m[3] ? fullYear(m[3], m[3]) : defaultYear, MONTHS[m[2]], +m[1]);
        if ((m = /^([a-zäöü]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? ?(\d{2}|\d{3,5})?$/.exec(s)) && MONTHS[m[1]]) return valid(m[3] ? fullYear(m[3], m[3]) : defaultYear, MONTHS[m[1]], +m[2]);
        return null;
    }

    const format = (iso) => {
        const m = /^(\d{3,5})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
    };

    const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const nativeMin = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'min');

    function enhance(input) {
        if (input.dataset.dateField) return input;
        input.dataset.dateField = '1';
        const iso = nativeValue.get.call(input);
        const min = input.getAttribute('min') || '';
        const yearOf = () => Number(input.dataset.defaultYear || (picker.min || '').slice(0, 4)) || new Date().getFullYear();

        const wrap = document.createElement('span');
        wrap.className = 'date-field';
        const text = document.createElement('input');
        text.type = 'text';
        text.inputMode = 'numeric';
        text.autocomplete = 'off';
        text.placeholder = 'tt.mm.jjjj';
        text.className = input.className;
        text.required = input.required;
        text.readOnly = input.readOnly;
        if (input.title) text.title = input.title;
        if (input.getAttribute('aria-label')) text.setAttribute('aria-label', input.getAttribute('aria-label'));
        const picker = document.createElement('input');
        picker.type = 'date';
        picker.className = 'date-field-picker';
        picker.tabIndex = -1;
        picker.setAttribute('aria-hidden', 'true');
        if (min) picker.min = min;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'date-field-button';
        button.textContent = '📅';
        button.title = 'Kalender';
        button.disabled = input.readOnly || input.disabled;

        input.type = 'hidden';
        input.required = false; // the visible field carries it
        input.after(wrap);
        wrap.append(text, button, picker, input);

        const commit = (value, notify = true) => {
            nativeValue.set.call(input, value || '');
            text.value = format(value);
            text.classList.remove('date-field-invalid');
            text.setCustomValidity('');
            picker.value = value || '';
            if (notify) {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        // forms set .value and .min on the input as before
        Object.defineProperty(input, 'value', { configurable: true, get() { return nativeValue.get.call(this); }, set(v) { commit(String(v ?? ''), false); } });
        Object.defineProperty(input, 'min', { configurable: true, get() { return picker.min; }, set(v) { nativeMin.set.call(picker, v); } });

        const fromText = () => {
            if (!text.value.trim()) return commit('', nativeValue.get.call(input) !== '');
            const parsed = parse(text.value, { defaultYear: yearOf() });
            if (parsed) { if (parsed !== nativeValue.get.call(input)) commit(parsed); else text.value = format(parsed); return; }
            text.classList.add('date-field-invalid');
            text.setCustomValidity('Datum nicht erkannt — z. B. 03.06.5663');
        };
        text.addEventListener('change', fromText);
        text.addEventListener('blur', fromText);
        text.addEventListener('keydown', (e) => { if (e.key === 'Enter') { fromText(); } });
        text.addEventListener('paste', (e) => {
            const pasted = (e.clipboardData || window.clipboardData)?.getData('text');
            const parsed = parse(pasted, { defaultYear: yearOf() });
            if (parsed) { e.preventDefault(); commit(parsed); }
        });
        text.addEventListener('input', (e) => e.stopPropagation()); // the hidden input reports real changes
        button.addEventListener('click', () => {
            // the picker opens at its value, or at min (5663 for in-game dates) instead of today's real date
            if (!picker.value && picker.min) picker.value = picker.min;
            try { picker.showPicker(); } catch { picker.focus(); picker.click(); }
        });
        picker.addEventListener('change', () => { if (picker.value) commit(picker.value); });

        commit(iso, false);
        return input;
    }

    function enhanceAll(rootEl = document) {
        rootEl.querySelectorAll('input[type="date"]:not([data-date-field]):not(.date-field-picker)').forEach(enhance);
    }

    // Convert every date input that appears below rootEl from now on (forms are built dynamically)
    function observe(rootEl = document.body) {
        enhanceAll(rootEl);
        new MutationObserver(() => enhanceAll(rootEl)).observe(rootEl, { childList: true, subtree: true });
    }

    root.DateField = { parse, format, enhance, enhanceAll, observe };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.DateField;
})(typeof window !== 'undefined' ? window : globalThis);
