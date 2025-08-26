// search-system.js - Search Functionality for Characters and Locations
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
            console.warn('Search elements not found');
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

        const results = this.searchIndex
            .filter(item =>
                item.name.toLowerCase().includes(queryLower) || 
                item.desc.toLowerCase().includes(queryLower)
            )
            .sort((a, b) => this.sortSearchResults(a, b, queryLower));

        if (results.length > 0) {
            this.renderSearchResults(results);
            this.dropdown.style.display = 'block';
        } else {
            this.showNoResults();
            this.dropdown.style.display = 'block';
        }
    }

    sortSearchResults(a, b, query) {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        
        // 🥇 PRIORITY 1: Exact matches first
        const exactMatchA = nameA === query;
        const exactMatchB = nameB === query;
        if (exactMatchA && !exactMatchB) return -1;
        if (!exactMatchA && exactMatchB) return 1;
        
        // 🥈 PRIORITY 2: Names starting with the query
        const startsWithA = nameA.startsWith(query);
        const startsWithB = nameB.startsWith(query);
        if (startsWithA && !startsWithB) return -1;
        if (!startsWithA && startsWithB) return 1;
        
        // 🥉 PRIORITY 3: Characters before locations (if same match quality)
        if (startsWithA === startsWithB) {
            if (a.type === 'character' && b.type === 'location') return -1;
            if (a.type === 'location' && b.type === 'character') return 1;
        }
        
        // 🔤 FINAL: Alphabetical order
        return nameA.localeCompare(nameB);
    }

    renderSearchResults(results) {
        results.forEach((result, index) => {
            const item = document.createElement("div");
            item.innerHTML = this.renderSearchResult(result);
            
            item.addEventListener("click", () => {
                this.selectSearchResult(result);
            });
            
            this.dropdown.appendChild(item);
        });
    }

    renderSearchResult(result) {
        if (result.type === 'character') {
            return window.characterSystem.renderSearchResult(result.character);
        } else {
            // Location result
            const filename = window.mapCore.sanitizeFilename(result.name);
            return `
                <div class="dropdown-item location-result">
                    <img src="images/${filename}.jpg" alt="${result.name}" onerror="this.style.display='none'" />
                    <div class="dropdown-text">
                        <strong>📍 ${result.name}</strong><br>
                        <span>${result.desc.replace(/(<([^>]+)>)/gi, '').substring(0, 100)}...</span>
                    </div>
                </div>
            `;
        }
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
        const map = window.mapCore.getMap();
        
        if (result.type === 'character') {
            // For characters, use character system to focus
            window.characterSystem.focusCharacter(result.character.name);
        } else {
            // For locations, use locations system if available
            if (window.locationsSystem && window.locationsSystem.focusLocation) {
                window.locationsSystem.focusLocation(result.name);
            } else {
                // Fallback to direct map navigation
                map.setView([result.latlng.lat, result.latlng.lng], Math.max(map.getZoom(), 1));
            }
        }
        
        this.dropdown.style.display = 'none';
        this.searchInput.blur();
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
        
        console.log(`🔍 Updated search index with characters. Total entries: ${this.searchIndex.length}`);
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
        
        console.log(`🔍 Updated search index with locations. Total entries: ${this.searchIndex.length}`);
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