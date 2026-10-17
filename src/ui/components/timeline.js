// timeline.js - A timeline at the bottom of the map: pick a date (or play), and every character path that is shown
// gets highlighted up to where that character was on that date, with a marker at the position.
//
// Where a character is on day D (movements in date order, as the paths are drawn):
//   - before the first movement: not on the timeline yet;
//   - during a travel-like movement (Reise, Rückkehr, Flucht, Exil) with a date range: on the way from the previous
//     place to this one, in proportion to the days passed;
//   - otherwise: at the place of the last movement that started by D.
// Dates far from the rest (e.g. a real-world 2025 among in-game 5663 dates) are left out of the range and the path.
class MapTimeline {
    constructor() {
        this.TRAVEL = new Set(['travel', 'return', 'escape', 'exile']);
        this.active = false;
        this.day = null;
        this.range = null;
        this.overlays = new Map(); // characterId → { done, marker }
        this.dimmed = new Map();   // characterId → original style
        this.playing = null;
        this.build();
        document.addEventListener('characterPathsReady', () => { if (this.active) this.refresh(); });
    }

    // ---------- dates ----------

    static dayOf(iso) {
        const m = /^(\d{1,5})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
    }

    static label(day) {
        const d = new Date(day * 86400000);
        return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
    }

    // The years most movements are in; dates outside them don't count (typos, real-world dates)
    usualYears(allStops) {
        const count = new Map();
        allStops.forEach((s) => count.set(s.year, (count.get(s.year) || 0) + 1));
        const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        return top === undefined ? null : [top - 2, top + 2];
    }

    // ---------- the paths ----------

    // Visible paths with their dated stops: { id, name, color, pathData, stops: [{ start, end, type, at, place }] }
    paths() {
        const ms = window.movementSystem;
        if (!ms) return [];
        const visible = MapUtils.withMap((map) => ms.characterPaths.filter((p) => p.pathLine && map.hasLayer(p.pathLine))) || [];
        const resolve = (m) => {
            if (Array.isArray(m.coordinates)) return [m.coordinates[1], m.coordinates[0]];
            const loc = window.locationSystem?.findLocationByName?.(m.location || '');
            return loc ? [loc.layer.getLatLng().lat, loc.layer.getLatLng().lng] : null;
        };
        const raw = visible.map((p) => ({
            id: p.character.id,
            name: p.character.name,
            color: p.style?.color || '#8b5cf6',
            pathData: p,
            stops: (p.info?.metadata?.movementHistory || [])
                .map((m) => {
                    const start = MapTimeline.dayOf(m.dateStart || m.date);
                    const end = MapTimeline.dayOf(m.dateEnd) ?? start;
                    return { start, end: Math.max(start ?? 0, end ?? 0), type: m.type, at: resolve(m), place: m.location || 'unterwegs', year: +String(m.dateStart || m.date || '').slice(0, 4) };
                })
                .filter((s) => s.start !== null && s.at),
        }));
        const years = this.usualYears(raw.flatMap((r) => r.stops));
        raw.forEach((r) => { r.stops = r.stops.filter((s) => years && s.year >= years[0] && s.year <= years[1]); });
        return raw.filter((r) => r.stops.length);
    }

    // { at: [lat, lng], done: [[lat, lng], …], place, moving } or null before the first movement
    positionOn(stops, day) {
        if (!stops.length || day < stops[0].start) return null;
        let i = 0;
        while (i + 1 < stops.length && stops[i + 1].start <= day) i++;
        const s = stops[i];
        const done = stops.slice(0, i).map((x) => x.at);
        if (i > 0 && this.TRAVEL.has(s.type) && s.end > s.start && day < s.end) {
            const f = (day - s.start) / (s.end - s.start);
            const [a, b] = [stops[i - 1].at, s.at];
            const at = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
            return { at, done: [...done, at], place: `unterwegs nach ${s.place}`, moving: true };
        }
        return { at: s.at, done: [...done, s.at], place: s.place, moving: false };
    }

    // ---------- drawing ----------

    draw() {
        if (!this.active) return;
        const paths = this.paths();
        const seen = new Set();
        MapUtils.withMap((map) => {
            for (const p of paths) {
                seen.add(p.id);
                if (!this.dimmed.has(p.id)) {
                    this.dimmed.set(p.id, { opacity: p.pathData.pathLine.options.opacity });
                    p.pathData.pathLine.setStyle({ opacity: 0.25 });
                }
                const pos = this.positionOn(p.stops, this.day);
                let o = this.overlays.get(p.id);
                if (!pos) { if (o) { o.done.remove(); o.marker.remove(); this.overlays.delete(p.id); } continue; }
                if (!o) {
                    o = {
                        done: L.polyline([], { color: p.color, weight: 5, opacity: 1, interactive: false }).addTo(map),
                        marker: L.circleMarker(pos.at, { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 })
                            .bindTooltip('', { direction: 'top', offset: [0, -8], permanent: paths.length <= 4, className: 'timeline-tip' })
                            .on('click', () => window.characterSystem?.focusCharacter?.(p.name))
                            .addTo(map),
                    };
                    this.overlays.set(p.id, o);
                }
                o.done.setLatLngs(pos.done);
                o.marker.setLatLng(pos.at);
                o.marker.setTooltipContent(`<strong>${RichText.escape(p.name)}</strong> · ${RichText.escape(pos.place)}`);
            }
            // paths hidden meanwhile: put them back as they were
            for (const id of [...this.overlays.keys()]) if (!seen.has(id)) this.clear(id);
            for (const id of [...this.dimmed.keys()]) if (!seen.has(id)) this.restore(id);
        });
        this.drawTicks(paths);
        this.dateLabel.textContent = this.day === null ? '–' : MapTimeline.label(this.day);
    }

    clear(id) {
        const o = this.overlays.get(id);
        if (o) { o.done.remove(); o.marker.remove(); this.overlays.delete(id); }
    }

    restore(id) {
        const style = this.dimmed.get(id);
        const p = window.movementSystem?.characterPaths.find((x) => x.character.id === id);
        if (style && p?.pathLine) p.pathLine.setStyle(style);
        this.dimmed.delete(id);
    }

    drawTicks(paths) {
        if (!this.range) return;
        const [min, max] = this.range;
        const span = Math.max(1, max - min);
        const days = new Map();
        paths.forEach((p) => p.stops.forEach((s) => days.set(s.start, (days.get(s.start) || 0) + 1)));
        this.ticks.replaceChildren(...[...days.entries()].map(([d, n]) => {
            const t = document.createElement('span');
            t.className = 'timeline-tick';
            t.style.left = `${((d - min) / span) * 100}%`;
            t.title = `${MapTimeline.label(d)} · ${n} Bewegung${n === 1 ? '' : 'en'}`;
            return t;
        }));
    }

    // ---------- UI ----------

    build() {
        const bar = document.createElement('div');
        bar.className = 'map-timeline collapsed';
        bar.innerHTML = `
            <button type="button" class="timeline-open" title="Zeitleiste: wo waren die Charaktere wann?">🕒 Zeitleiste</button>
            <div class="timeline-body">
                <button type="button" class="timeline-play" title="Abspielen / Pause">▶</button>
                <div class="timeline-track">
                    <div class="timeline-ticks"></div>
                    <input type="range" class="timeline-range" min="0" max="1" step="1" value="0" aria-label="Datum">
                </div>
                <span class="timeline-date">–</span>
                <button type="button" class="timeline-close" title="Zeitleiste schliessen">×</button>
            </div>`;
        document.body.appendChild(bar);
        this.bar = bar;
        this.slider = bar.querySelector('.timeline-range');
        this.ticks = bar.querySelector('.timeline-ticks');
        this.dateLabel = bar.querySelector('.timeline-date');
        this.playBtn = bar.querySelector('.timeline-play');

        bar.querySelector('.timeline-open').addEventListener('click', () => this.open());
        bar.querySelector('.timeline-close').addEventListener('click', () => this.close());
        this.slider.addEventListener('input', () => { this.stop(); this.day = +this.slider.value; this.draw(); });
        this.playBtn.addEventListener('click', () => (this.playing ? this.stop() : this.play()));
        // the map must not pan or zoom while the slider is dragged
        if (window.L) L.DomEvent.disableClickPropagation(bar), L.DomEvent.disableScrollPropagation(bar);
    }

    refresh() {
        const days = this.paths().flatMap((p) => p.stops.flatMap((s) => [s.start, s.end]));
        if (!days.length) {
            this.range = null;
            this.dateLabel.textContent = 'keine datierten Bewegungen sichtbar';
            this.slider.disabled = true;
            return;
        }
        this.slider.disabled = false;
        this.range = [Math.min(...days), Math.max(...days)];
        this.slider.min = this.range[0];
        this.slider.max = this.range[1];
        if (this.day === null || this.day < this.range[0] || this.day > this.range[1]) this.day = this.range[1];
        this.slider.value = this.day;
        this.draw();
    }

    open() {
        this.active = true;
        this.bar.classList.remove('collapsed');
        this.refresh();
        // the panel's checkboxes change which paths are shown: follow them while open
        this.syncTimer = setInterval(() => { if (!this.playing) this.refreshKeepingDay(); }, 1200);
    }

    refreshKeepingDay() {
        const before = this.day;
        this.refresh();
        if (before !== null && this.range && before >= this.range[0] && before <= this.range[1]) {
            this.day = before;
            this.slider.value = before;
            this.draw();
        }
    }

    close() {
        this.stop();
        clearInterval(this.syncTimer);
        this.active = false;
        for (const id of [...this.overlays.keys()]) this.clear(id);
        for (const id of [...this.dimmed.keys()]) this.restore(id);
        this.bar.classList.add('collapsed');
    }

    play() {
        if (!this.range) return;
        if (this.day >= this.range[1]) this.day = this.range[0];
        this.playBtn.textContent = '❚❚';
        const step = Math.max(1, Math.round((this.range[1] - this.range[0]) / 300)); // about 30 s for the whole range
        this.playing = setInterval(() => {
            this.day = Math.min(this.range[1], this.day + step);
            this.slider.value = this.day;
            this.draw();
            if (this.day >= this.range[1]) this.stop();
        }, 100);
    }

    stop() {
        clearInterval(this.playing);
        this.playing = null;
        this.playBtn.textContent = '▶';
    }
}

document.addEventListener('DOMContentLoaded', () => { window.mapTimeline = new MapTimeline(); });
