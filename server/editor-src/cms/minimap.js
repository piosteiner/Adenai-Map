// A small Leaflet map of Adenai for the detail views: other locations as dots, the edited one as a draggable marker
// (click the map to move it), or a character's path. Coordinates as stored: [x, y] in the 2048 × 1536 image
// space of the public map (src/core/map-core.js), where L.latLng(y, x).
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { store } from './store';

const W = 2048;
const H = 1536;
const CRS = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1, 0, -1, H) });

export function createMiniMap({ point = null, path = [], editable = false, onPick } = {}) {
    const el = document.createElement('div');
    el.className = 'minimap';
    let map = null;
    let marker = null;

    function init() {
        map = L.map(el, { crs: CRS, minZoom: -2, maxZoom: 2, zoomSnap: 0.25, attributionControl: false, zoomControl: true });
        const bounds = [[0, 0], [H, W]];
        L.imageOverlay('map-2048.webp', bounds).addTo(map);
        map.setMaxBounds([[-200, -200], [H + 200, W + 200]]);

        for (const f of store.locations) {
            const c = f.geometry?.coordinates;
            if (!Array.isArray(c)) continue;
            L.circleMarker([c[1], c[0]], { radius: 3, color: '#000', weight: 1, fillColor: '#fff', fillOpacity: 0.9 })
                .bindTooltip(f.properties?.name || '', { direction: 'top' }).addTo(map);
        }

        if (path.length > 1) {
            L.polyline(path.map(([x, y]) => [y, x]), { color: '#6b5b95', weight: 3, dashArray: '6,6' }).addTo(map);
            path.forEach(([x, y], i) => L.circleMarker([y, x], { radius: 4, color: '#6b5b95', fillColor: i === path.length - 1 ? '#d4af37' : '#fff', fillOpacity: 1, weight: 2 }).addTo(map));
        }

        if (point) setPoint(point, false);
        if (editable) {
            map.on('click', (e) => { setPoint([Math.round(e.latlng.lng), Math.round(e.latlng.lat)], true); });
        }

        const focus = point || path[path.length - 1];
        if (focus) map.setView([focus[1], focus[0]], 0);
        else map.fitBounds(bounds);
    }

    function setPoint([x, y], notify = true) {
        if (!map || !Number.isFinite(+x) || !Number.isFinite(+y)) return;
        const ll = [+y, +x];
        if (!marker) {
            marker = L.marker(ll, { draggable: editable, icon: L.divIcon({ className: 'minimap-pin', iconSize: [16, 16] }) }).addTo(map);
            marker.on('dragend', () => {
                const p = marker.getLatLng();
                onPick?.([Math.round(p.lng), Math.round(p.lat)]);
            });
        } else {
            marker.setLatLng(ll);
        }
        if (notify) onPick?.([Math.round(ll[1]), Math.round(ll[0])]);
    }

    // Leaflet needs the element to be in the page and sized
    requestAnimationFrame(() => { if (el.isConnected) init(); else setTimeout(init, 50); });
    return {
        el,
        setPoint: (p) => setPoint(p, false),
        destroy: () => map?.remove(),
    };
}
