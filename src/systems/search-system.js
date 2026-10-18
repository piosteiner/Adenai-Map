// search-system.js - Search Functionality for Characters and Locations, glossary terms and — on a device unlocked for
// them — the session minutes (components/protocols.js): a session opens with the search term highlighted
class SearchSystem {
    constructor() {
        this.searchIndex = [];
        this.selectedIndex = -1;
        this.searchInput = null;
        this.dropdown = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initSearch());
        } else {
            this.initSearch();
        }

        // Listen for characters loaded event
        document.addEventListener('charactersLoaded', (e) => {
            this.updateSearchIndexWithCharacters();
        });

        // Listen for locations loaded event
        document.addEventListener('locationsLoaded', (e) => {
            this.updateSearchIndexWithLocations(e.detail.locations);
        });
    }

    initSearch() {
        this.searchInput = document.getElementById("searchBox");
        this.dropdown = document.getElementById("resultsDropdown");

        if (!this.searchInput || !this.dropdown) {
            Logger.warning('Search elements not found');
            return;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Input event for search
        this.searchInput.addEventListener("input", (e) => {
            this.handleSearchInput(e.target.value);
        });

        // Keyboard navigation
        this.searchInput.addEventListener("keydown", (e) => {
            this.handleKeyNavigation(e);
        });

        // Hide dropdown when clicking outside
        document.addEventListener("click", (e) => {
            const searchContainer = document.getElementById("search-container");
            if (!searchContainer.contains(e.target)) {
                this.dropdown.style.display = "none";
            }
        });

        // Re-open dropdown on focus if there's a query
        this.searchInput.addEventListener("focus", () => {
            if (this.searchInput.value.trim() !== '' && this.dropdown.children.length > 0) {
                this.dropdown.style.display = "block";
            }
        });
    }

    handleSearchInput(query) {
        const queryLower = query.toLowerCase();
        this.dropdown.innerHTML = '';
        this.selectedIndex = -1;

        if (query === '') {
            this.dropdown.style.display = 'none';
            return;
        }

        const extra = (window.mapGlossary?.allTerms?.() || window.mapGlossary?.terms || []).map((t) => ({ name: t.name, desc: t.description || '', type: 'term', term: t }));
        // the site's one search (src/utils/search.js): exact name first, then names starting with the query, then words
        // of names, then other fields; typos only when nothing matches as typed
        const results = window.AdenaiSearch.rank([...this.searchIndex, ...extra], query, (item) => this.searchDoc(item))
            .map((r) => ({ ...r.item, relevanceScore: r.score, why: r.why, fuzzy: !!r.fuzzy }));
        const sessions = this.searchMinutes(query);
        if (results.length > 0 || sessions.length) {
            this.renderSearchResults(results.slice(0, 15)); // Limit to top 15 results
            this.renderMinutesResults(sessions, query);
            this.dropdown.style.display = 'block';
        } else {
            this.showNoResults();
            this.dropdown.style.display = 'block';
        }
    }

    // what is searched in an entry, and how much each field counts
    searchDoc(item) {
        if (item.type === 'character') {
            const c = item.character || {};
            return { name: c.name || item.name, fields: [
                { label: 'Titel', text: c.title, weight: 3 }, { label: 'Fraktion', text: c.faction, weight: 2 },
                { label: 'Ort', text: [...new Set([c.location, c.currentLocation?.location, c.placeOfOrigin].filter(Boolean))].join(' · '), weight: 2 },
                { label: 'Beschreibung', text: c.description, weight: 1 }, { label: 'Notizen', text: c.notes, weight: 1 }] };
        }
        if (item.type === 'term') {
            const t = item.term;
            return { name: t.name, aliases: t.aliases || [], fields: [{ label: 'Kategorie', text: t.category || t.kindLabel, weight: 2 }, { label: 'Beschreibung', text: t.description, weight: 1 }] };
        }
        const p = item.feature?.properties || {};
        return { name: item.name, fields: [
            { label: 'Typ', text: window.AdenaiConfig?.getLocationTypeLabel?.(p.type) || p.type, weight: 2 },
            { label: 'Region', text: window.AdenaiConfig?.getLocationRegionLabel?.(p.region) || p.region, weight: 2 },
            { label: 'Beschreibung', text: String(item.desc || '').replace(/<[^>]+>/g, ''), weight: 1 }] };
    }

    // "Gefunden in Beschreibung: …Text…" under a result when the match is in a field it doesn't show
    whyLine(result, query) {
        if (!result.why) return '';
        const label = result.fuzzy ? 'Ähnlicher Name' : result.why.label;
        const text = result.fuzzy ? '' : result.why.text;
        return `<div class="result-why">${RichText.escape(label)}${text ? `: ${window.AdenaiSearch.highlight(text, query)}` : ''}</div>`;
    }

    sortSearchResults(a, b, query) {
        // First sort by relevance score (higher is better)
        if (a.relevanceScore !== b.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
        }
        
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        
        // Then by exact matches
        const exactMatchA = nameA === query;
        const exactMatchB = nameB === query;
        if (exactMatchA && !exactMatchB) return -1;
        if (!exactMatchA && exactMatchB) return 1;
        
        // Then by starts with
        const startsWithA = nameA.startsWith(query);
        const startsWithB = nameB.startsWith(query);
        if (startsWithA && !startsWithB) return -1;
        if (!startsWithA && startsWithB) return 1;
        
        // Then by type priority (characters first)
        if (a.type !== b.type) {
            if (a.type === 'character' && b.type === 'location') return -1;
            if (a.type === 'location' && b.type === 'character') return 1;
        }
        
        // Finally alphabetical
        return nameA.localeCompare(nameB);
    }

    calculateRelevanceScore(item, query) {
        let score = 0;
        const name = item.name.toLowerCase();
        const desc = item.desc.toLowerCase();
        
        // Name matching (highest priority)
        if (name === query) score += 100;
        else if (name.startsWith(query)) score += 80;
        else if (name.includes(query)) score += 60;
        else if (this.fuzzyMatch(name, query)) score += 40;
        
        // Description matching
        if (desc.includes(query)) score += 30;
        else if (this.fuzzyMatch(desc, query)) score += 15;
        
        // Character-specific fields
        if (item.type === 'character' && item.character) {
            const char = item.character;
            const searchableFields = [
                char.title, char.location, char.faction, 
                char.description, char.notes, char.status, char.relationship
            ];
            
            searchableFields.forEach(field => {
                if (field && field.toLowerCase().includes(query)) {
                    score += 20;
                } else if (field && this.fuzzyMatch(field.toLowerCase(), query)) {
                    score += 10;
                }
            });
        }
        
        // Boost for shorter names (more likely to be relevant)
        if (score > 0 && name.length < 15) {
            score += 5;
        }
        
        return score;
    }

    getMatchedFields(item, query) {
        const matches = [];
        
        if (item.name.toLowerCase().includes(query)) {
            matches.push('name');
        }
        
        if (item.desc.toLowerCase().includes(query)) {
            matches.push('description');
        }
        
        if (item.type === 'character' && item.character) {
            const char = item.character;
            if (char.title && char.title.toLowerCase().includes(query)) matches.push('title');
            if (char.location && char.location.toLowerCase().includes(query)) matches.push('location');
            if (char.faction && char.faction.toLowerCase().includes(query)) matches.push('faction');
            if (char.notes && char.notes.toLowerCase().includes(query)) matches.push('notes');
            if (char.status && char.status.toLowerCase().includes(query)) matches.push('status');
            if (char.relationship && char.relationship.toLowerCase().includes(query)) matches.push('relationship');
        }
        
        return matches;
    }

    fuzzyMatch(text, query) {
        if (query.length < 3) return false; // Too short for fuzzy matching
        
        // Simple fuzzy matching - allows for 1 character difference per 3 characters
        const allowedErrors = Math.floor(query.length / 3);
        let errors = 0;
        let textIndex = 0;
        
        for (let i = 0; i < query.length; i++) {
            const found = text.indexOf(query[i], textIndex);
            if (found === -1) {
                errors++;
                if (errors > allowedErrors) return false;
            } else {
                textIndex = found + 1;
            }
        }
        
        return true;
    }

    renderSearchResults(results) {
        results.forEach((result, index) => {
            const item = document.createElement("div");
            item.innerHTML = this.renderSearchResult(result);
            // where the match is, when the result doesn't show it
            const shown = item.textContent;
            if (result.why && (result.fuzzy || !window.AdenaiSearch.matches(shown, this.searchInput.value))) {
                item.querySelector('.dropdown-text')?.insertAdjacentHTML('beforeend', this.whyLine(result, this.searchInput.value));
            }
            
            item.addEventListener("click", () => {
                this.selectSearchResult(result);
            });
            
            this.dropdown.appendChild(item);
        });
    }

    // Sessions whose title or text contains the query (accents don't matter), most matches first
    searchMinutes(query) {
        const mp = window.mapProtocols;
        const q = query.trim();
        if (!mp?.unlocked || !mp.sessions?.length || q.length < 3) return [];
        const re = new RegExp(MapProtocols.loose(q), 'giu');
        const plain = (t) => MapProtocols.plain(String(t || '')).replace(/\\(.)/g, '$1');
        return mp.sessions
            .filter((s) => s.published !== false)
            .map((s) => {
                const text = `${plain(s.title)}\n${plain(s.content)}`;
                const hits = [...text.matchAll(re)];
                return { s, n: hits.length, at: hits[0]?.index ?? -1, text };
            })
            .filter((x) => x.n)
            .sort((a, b) => b.n - a.n || b.s.number - a.s.number);
    }

    renderMinutesResults(found, query) {
        if (!found.length) return;
        const esc = (t) => RichText.escape(t);
        const head = document.createElement('div');
        head.className = 'dropdown-heading';
        head.textContent = `📜 Protokolle · ${found.length} Sitzung${found.length === 1 ? '' : 'en'}`;
        this.dropdown.appendChild(head);
        const re = new RegExp(MapProtocols.loose(query.trim()), 'giu');
        for (const x of found.slice(0, 6)) {
            const from = Math.max(0, x.at - 50);
            let snippet = x.text.slice(from, x.at + 90).replace(/\s+/g, ' ');
            snippet = esc(snippet).replace(re, (m) => `<mark>${m}</mark>`);
            const item = document.createElement('div');
            item.innerHTML = `
                <div class="dropdown-item session-result">
                    <div class="dropdown-text">
                        <div class="result-header"><strong>Sitzung ${x.s.number}${x.s.title ? ` · ${esc(MapProtocols.plain(x.s.title))}` : ''}</strong> <span class="session-hits">${x.n}×</span></div>
                        <div class="location-preview">${from ? '…' : ''}${snippet}…</div>
                    </div>
                </div>`;
            item.addEventListener('click', () => this.selectSearchResult({ type: 'session', session: x.s, query }));
            this.dropdown.appendChild(item);
        }
        const all = document.createElement('div');
        all.innerHTML = `<div class="dropdown-item session-all">🔎 Alle ${found.reduce((n, x) => n + x.n, 0)} Treffer im Protokoll zeigen</div>`;
        all.addEventListener('click', () => this.selectSearchResult({ type: 'session', session: null, query }));
        this.dropdown.appendChild(all);
    }

    renderTermResult(result, query) {
        const t = result.term;
        const desc = MapProtocols.plain(t.description || '').replace(/\\(.)/g, '$1');
        const kind = t.pending ? '⏳ Vorschlag' : (t.category || 'Glossar');
        return `
            <div class="dropdown-item term-result" data-relevance="${result.relevanceScore}">
                <div class="result-avatar"><div class="character-placeholder">📖</div></div>
                <div class="dropdown-text">
                    <div class="result-header"><strong>${this.highlightText(t.name, query)}</strong></div>
                    <div class="character-title">${RichText.escape(kind)}</div>
                    ${desc ? `<div class="character-preview">${this.highlightText(desc.substring(0, 120), query)}${desc.length > 120 ? '...' : ''}</div>` : ''}
                </div>
            </div>
        `;
    }

    renderSearchResult(result) {
        const query = this.searchInput.value.toLowerCase();
        
        if (result.type === 'term') return this.renderTermResult(result, query);
        if (result.type === 'character') {
            return this.renderCharacterResult(result, query);
        } else {
            return this.renderLocationResult(result, query);
        }
    }

    renderCharacterResult(result, query) {
        const char = result.character;
        const highlightedName = this.highlightText(char.name, query);
        const highlightedTitle = char.title ? this.highlightText(char.title, query) : '';
        const highlightedLocation = char.location ? this.highlightText(char.location, query) : 'Ort unbekannt';
        
        // Relationship emoji
        const relationshipEmoji = this.getRelationshipEmoji(char.relationship);
        
        return `
            <div class="dropdown-item character-result" data-relevance="${result.relevanceScore}">
                <div class="result-avatar">
                    ${char.image ? `<img src="${char.image}" alt="${char.name}" />` : '<div class="character-placeholder">👤</div>'}
                    <div class="relationship-indicator">${relationshipEmoji}</div>
                </div>
                <div class="dropdown-text">
                    <div class="result-header">
                        <strong>${highlightedName}</strong>
                    </div>
                    ${highlightedTitle ? `<div class="character-title">${highlightedTitle}</div>` : ''}
                    <div class="character-meta">
                        📍 ${highlightedLocation}
                    </div>
                    ${char.description ? `<div class="character-preview">${this.highlightText(window.AdenaiSearch.plain(char.description).substring(0, 120), query)}${char.description.length > 120 ? '…' : ''}</div>` : ''}
                </div>
            </div>
        `;
    }

    renderLocationResult(result, query) {
        const filename = window.mapCore.sanitizeFilename(result.name);
        const highlightedName = this.highlightText(result.name, query);
        const highlightedDesc = this.highlightText(window.AdenaiSearch.plain(result.desc.replace(/(<([^>]+)>)/gi, '')).substring(0, 120), query);
        
        return `
            <div class="dropdown-item location-result" data-relevance="${result.relevanceScore}">
                <div class="result-avatar">
                    <img src="public/images/${filename}.jpg" alt="${result.name}" onerror="this.style.display='none'" />
                    <div class="location-indicator">🏛️</div>
                </div>
                <div class="dropdown-text">
                    <div class="result-header">
                        <strong>📍 ${highlightedName}</strong>
                    </div>
                    <div class="location-preview">${highlightedDesc}${result.desc.length > 120 ? '...' : ''}</div>
                </div>
            </div>
        `;
    }

    // text without its [[link]] and **markup** syntax, escaped, with the query's words marked (accents don't matter)
    highlightText(text, query) {
        if (!text) return '';
        return window.AdenaiSearch.highlight(window.AdenaiSearch.plain(text), query || '');
    }

    createMatchBadges(matchedFields) {
        if (!matchedFields || matchedFields.length === 0) return '';
        
        const badgeMap = {
            'name': '📛',
            'title': '👑',
            'location': '📍',
            'description': '📝',
            'faction': '🏰',
            'notes': '📋',
            'status': '💫',
            'relationship': '❤️'
        };
        
        return matchedFields.slice(0, 3).map(field => 
            `<span class="match-badge" title="Matched in ${field}">${badgeMap[field] || '🔍'}</span>`
        ).join('');
    }

    getRelationshipEmoji(relationship) {
        const emojiMap = {
            'ally': '🤝',
            'friendly': '😊',
            'neutral': '😐',
            'suspicious': '🤨',
            'hostile': '😠',
            'enemy': '⚔️',
            'party': '⭐'
        };
        return emojiMap[relationship] || '❓';
    }

    getStatusColor(status) {
        const colorMap = {
            'alive': '#4ade80',
            'dead': '#f87171',
            'missing': '#fbbf24',
            'unknown': '#94a3b8'
        };
        return colorMap[status] || '#94a3b8';
    }

    showNoResults() {
        const noResult = document.createElement("div");
        noResult.className = "dropdown-item";
        noResult.style.opacity = "0.6";
        noResult.style.fontStyle = "italic";
        noResult.textContent = "Keine Übereinstimmungen gefunden";
        this.dropdown.appendChild(noResult);
    }

    selectSearchResult(result) {
        if (result.type === 'term' || result.type === 'session') {
            if (result.type === 'term') window.mapGlossary?.open(result.term.name);
            else window.mapProtocols?.openSearch(result.session?.id || null, result.query);
            this.dropdown.style.display = 'none';
            this.searchInput.blur();
            return;
        }
        MapUtils.withMap((map) => {
            if (result.type === 'character') {
                // For characters, use character system to focus
                Logger.info(`Search requesting focus for character: "${result.character.name}"`);
                window.characterSystem.focusCharacter(result.character.name);
            } else {
                // For locations, use locations system if available
                if (window.locationSystem && window.locationSystem.focusLocation) {
                    window.locationSystem.focusLocation(result.name);
                } else {
                    // Fallback to direct map navigation
                    map.setView([result.latlng.lat, result.latlng.lng], Math.max(map.getZoom(), 1));
                }
            }
            
            this.dropdown.style.display = 'none';
            this.searchInput.blur();
        });
    }

    handleKeyNavigation(e) {
        const items = this.dropdown.querySelectorAll(".dropdown-item:not(.no-match)");
        if (items.length === 0) return;

        if (e.key === "ArrowDown") {
            this.selectedIndex = (this.selectedIndex + 1) % items.length;
            e.preventDefault();
        } else if (e.key === "ArrowUp") {
            this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
            e.preventDefault();
        } else if (e.key === "Enter" && items[this.selectedIndex]) {
            items[this.selectedIndex].click();
            return;
        } else if (e.key === "Escape") {
            this.dropdown.style.display = 'none';
            this.selectedIndex = -1;
            return;
        }

        this.updateSelectedItem(items);
    }

    updateSelectedItem(items) {
        items.forEach((item, i) => {
            item.classList.toggle("active", i === this.selectedIndex);
            if (i === this.selectedIndex) {
                item.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        });
    }

    updateSearchIndexWithCharacters() {
        // Remove existing character entries
        this.searchIndex = this.searchIndex.filter(item => item.type !== 'character');
        
        // Add characters to search index
        window.characterSystem.addToSearchIndex(this.searchIndex);
        
        Logger.success(`Updated search index with characters. Total entries: ${this.searchIndex.length}`);
    }

    updateSearchIndexWithLocations(locations) {
        // Remove existing location entries
        this.searchIndex = this.searchIndex.filter(item => item.type !== 'location');
        
        // Add locations to search index
        locations.forEach(locationData => {
            const { feature, desc } = locationData;
            const name = feature.properties.name || '';
            const latlng = {
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0]
            };

            this.searchIndex.push({
                name,
                desc: desc || feature.properties.description || '',
                latlng,
                type: 'location',
                feature: feature
            });
        });
        
        Logger.success(`Updated search index with locations. Total entries: ${this.searchIndex.length}`);
    }

    // Public method to manually add items to search index
    addToIndex(item) {
        this.searchIndex.push(item);
    }

    // Public method to clear search index
    clearIndex() {
        this.searchIndex = [];
    }

    // Public method to get current search index
    getSearchIndex() {
        return this.searchIndex;
    }

    // Public method to perform programmatic search
    search(query) {
        if (this.searchInput) {
            this.searchInput.value = query;
            this.handleSearchInput(query);
        }
    }
}

// Create global search system instance
window.searchSystem = new SearchSystem();

// Legacy support - make initSearch available globally
window.initSearch = () => {
    window.searchSystem.initSearch();
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchSystem;
}