// Admin Interface JavaScript
class AdenaiAdmin {
    constructor() {
        this.locations = [];
        this.characters = [];
        this.currentFilter = '';
        this.currentCharacterFilter = '';
        this.isAuthenticated = false; // NEW
        this.username = null; // NEW
        this.init();
    }

    async init() {
        console.log('🚀 Initializing Adenai Admin Interface');
        this.setupEventListeners();
        await this.checkConnection();
        await this.checkAuthStatus(); // NEW
        await this.loadLocations();
        await this.loadCharacters();
        this.renderLocations();
        this.renderCharacters();
        this.updateStats();
        this.updateAuthUI(); // NEW
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        ///// LOCATION MANAGEMENT /////
        // Add location button
        document.getElementById('add-location-btn').addEventListener('click', () => {
            this.openAddLocationModal();
        });

        // Location form submission
        document.getElementById('location-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLocation();
        });

        // Location search functionality
        document.getElementById('location-search').addEventListener('input', (e) => {
            this.currentFilter = e.target.value;
            this.renderLocations();
        });

        // Location modal close
        document.querySelector('.close-btn').addEventListener('click', () => {
            this.closeModal();
        });

        // Location Export button
        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.exportData();
        });
        
        ///// CHARACTER MANAGEMENT /////
        // Add character button
        document.getElementById('add-character-btn').addEventListener('click', () => {
            this.openAddCharacterModal();
        });

        // Character form submission
        document.getElementById('character-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCharacter();
        });

        // Character search functionality
        document.getElementById('character-search').addEventListener('input', (e) => {
            this.currentCharacterFilter = e.target.value;
            this.renderCharacters();
        });

        // Character modal close
        document.querySelector('.close-character-btn').addEventListener('click', () => {
            this.closeCharacterModal();
        });

        // Close character modal on backdrop click
        document.getElementById('add-character-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-character-modal') {
                this.closeCharacterModal();
            }
        });

        ///// AUTHENTICATION /////
        // Login form submission
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Login modal close
        document.querySelector('.close-login-btn').addEventListener('click', () => {
            this.closeLoginModal();
        });

        // Close login modal on backdrop click
        document.getElementById('login-modal').addEventListener('click', (e) => {
            if (e.target.id === 'login-modal') {
                this.closeLoginModal();
            }
        });

        ///// VARIOUS /////
        // View raw JSON button
        document.getElementById('view-raw-btn')?.addEventListener('click', () => {
            this.viewRawJson();
        });

        // Close modal on backdrop click
        document.getElementById('add-location-modal').addEventListener('click', (e) => {
            if (e.target.id === 'add-location-modal') {
                this.closeModal();
            }
        });
    }

    async checkConnection() {
        try {
            const response = await fetch('/api/test');
            const result = await response.json();
            
            const indicator = document.getElementById('status-indicator');
            const text = document.getElementById('status-text');
            
            if (result.success) {
                indicator.textContent = '✅';
                text.textContent = `Connected to ${result.repo}`;
            } else {
                indicator.textContent = '❌';
                text.textContent = 'Connection failed';
            }
        } catch (error) {
            document.getElementById('status-indicator').textContent = '❌';
            document.getElementById('status-text').textContent = 'Connection error';
            this.showToast('Failed to connect to GitHub', 'error');
        }
    }

    ///// AUTHENTICATION METHODS /////
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            this.isAuthenticated = data.authenticated;
            this.username = data.username;
        } catch (error) {
            console.error('Failed to check auth status:', error);
            this.isAuthenticated = false;
            this.username = null;
        }
    }

    updateAuthUI() {
        const authContainer = document.getElementById('auth-container');
        
        if (this.isAuthenticated) {
            authContainer.innerHTML = `
                <span class="welcome-text">Welcome, ${this.username}</span>
                <button id="logout-btn" class="btn-secondary">Logout</button>
            `;
            
            // Show all action buttons
            document.querySelectorAll('.admin-action').forEach(btn => {
                btn.style.display = 'inline-block';
            });
        } else {
            authContainer.innerHTML = `
                <button id="login-btn" class="btn-primary">Login</button>
            `;
            
            // Hide action buttons
            document.querySelectorAll('.admin-action').forEach(btn => {
                btn.style.display = 'none';
            });
        }
        
        this.setupAuthEventListeners();
    }

    setupAuthEventListeners() {
        const loginBtn = document.getElementById('login-btn');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    showLoginModal() {
        document.getElementById('login-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeLoginModal() {
        document.getElementById('login-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('login-form').reset();
    }

    async login() {
        const form = document.getElementById('login-form');
        const formData = new FormData(form);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = true;
                this.username = result.username;
                this.updateAuthUI();
                this.closeLoginModal();
                this.showToast('✅ Login successful!', 'success');
            } else {
                this.showToast('❌ Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.showToast('❌ Login failed', 'error');
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            const result = await response.json();
            
            if (result.success) {
                this.isAuthenticated = false;
                this.username = null;
                this.updateAuthUI();
                this.showToast('✅ Logout successful!', 'success');
            }
        } catch (error) {
            console.error('Logout failed:', error);
            this.showToast('❌ Logout failed', 'error');
        }
    }

    ///// LOCATION MANAGEMENT METHODS /////
    async loadLocations() {
        try {
            console.log('📡 Loading locations from GitHub...');
            const response = await fetch('/api/locations');
            const data = await response.json();
            
            this.locations = data.features || [];
            console.log(`✅ Loaded ${this.locations.length} locations`);
        } catch (error) {
            console.error('❌ Failed to load locations:', error);
            this.showToast('Failed to load locations', 'error');
            this.locations = [];
        }
    }

    renderLocations() {
        const container = document.getElementById('locations-list');
        
        if (this.locations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🗺️ No locations yet</h3>
                    <p>Add your first campaign location to get started!</p>
                </div>
            `;
            return;
        }

        // Filter locations based on search
        const filteredLocations = this.locations.filter(location => {
            const name = location.properties.name?.toLowerCase() || '';
            const description = location.properties.description?.toLowerCase() || '';
            const region = location.properties.region?.toLowerCase() || '';
            const searchTerm = this.currentFilter.toLowerCase();
            
            return name.includes(searchTerm) || 
                   description.includes(searchTerm) || 
                   region.includes(searchTerm);
        });

        if (filteredLocations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🔍 No matches found</h3>
                    <p>Try adjusting your search terms</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredLocations.map(location => {
            const props = location.properties;
            const coords = location.geometry.coordinates;
            
            // Only show edit/delete buttons if authenticated
            const actionButtons = this.isAuthenticated ? `
                <div class="location-actions">
                    <button onclick="admin.editLocation('${props.name}')" class="btn-secondary">✏️ Edit</button>
                    <button onclick="admin.deleteLocation('${props.name}')" class="btn-danger">🗑️ Delete</button>
                </div>
            ` : '';
            
            return `
                <div class="location-card" data-id="${props.name}">
                    <div class="location-header">
                        <h3>${props.name}</h3>
                        <span class="location-type">${this.formatType(props.type || 'unknown')}</span>
                    </div>
                    <div class="location-details">
                        <p><strong>📍 Region:</strong> ${this.formatRegion(props.region || 'Unknown')}</p>
                        <p><strong>📐 Coordinates:</strong> ${coords[0]}, ${coords[1]}</p>
                        <p><strong>👥 Visited:</strong> ${props.visited ? '✅ Yes' : '❌ No'}</p>
                        ${props.description ? `<p><strong>📝 Description:</strong> ${props.description}</p>` : ''}
                    </div>
                    ${actionButtons}
                </div>
            `;
        }).join('');
    }

    formatType(type) {
        const types = {
            city: '🏙️ City',
            town: '🏘️ Town', 
            village: '🏡 Village',
            landmark: '🗿 Landmark',
            dungeon: '🏴‍☠️ Dungeon',
            ruin: '🏛️ Ruin',
            camp: '⛺ Camp',
            unknown: '❓ Unknown'
        };
        return types[type] || `❓ ${type}`;
    }

    formatRegion(region) {
        const regions = {
            eastern_adenai: 'Eastern Adenai',
            western_adenai: 'Western Adenai',
            upeto: 'Upeto',
            harak: 'Harak',
            sea: 'Sea/Ocean',
            other: 'Other'
        };
        return regions[region] || region;
    }

    updateStats() {
        document.getElementById('total-locations').textContent = this.locations.length;
        
        const visited = this.locations.filter(loc => loc.properties.visited).length;
        document.getElementById('visited-locations').textContent = visited;
        
        const regions = new Set(this.locations.map(loc => loc.properties.region).filter(Boolean));
        document.getElementById('regions-count').textContent = regions.size;
        
        if (document.getElementById('total-characters')) {
            document.getElementById('total-characters').textContent = this.characters.length;
            
            const alive = this.characters.filter(char => char.status === 'alive').length;
            document.getElementById('alive-characters').textContent = alive;
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        console.log(`📄 Switched to ${tabName} tab`);
    }

    openAddLocationModal() {
        if (!this.isAuthenticated) {
            this.showToast('❌ Please login to add locations', 'error');
            return;
        }
        document.getElementById('add-location-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('add-location-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('location-form').reset();
    }

    async saveLocation() {
        if (!this.isAuthenticated) {
            this.showToast('❌ Please login to add locations', 'error');
            return;
        }

        const form = document.getElementById('location-form');
        const formData = new FormData(form);
        
        // Create GeoJSON feature
        const locationData = {
            type: "Feature",
            properties: {
                name: formData.get('name'),
                description: formData.get('description') || '',
                region: formData.get('region'),
                type: formData.get('type'),
                visited: formData.has('visited'),
                contentUrl: null // We'll add this later
            },
            geometry: {
                type: "Point",
                coordinates: [parseInt(formData.get('x')), parseInt(formData.get('y'))]
            }
        };

        try {
            console.log('💾 Saving location:', locationData.properties.name);
            
            const response = await fetch('/api/locations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(locationData)
            });

            if (response.status === 401) {
                this.showToast('❌ Session expired. Please login again.', 'error');
                this.isAuthenticated = false;
                this.updateAuthUI();
                return;
            }

            const result = await response.json();
            
            if (result.success) {
                this.showToast(`✅ Location "${locationData.properties.name}" saved successfully!`, 'success');
                await this.loadLocations();
                this.renderLocations();
                this.updateStats();
                this.closeModal();
            } else {
                this.showToast('❌ Failed to save location', 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('❌ Failed to save location', 'error');
        }
    }

    exportData() {
        const dataStr = JSON.stringify({
            type: "FeatureCollection",
            features: this.locations
        }, null, 2);
        
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `adenai-locations-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showToast('📤 Data exported successfully!', 'success');
    }

    viewRawJson() {
        const data = {
            type: "FeatureCollection", 
            features: this.locations
        };
        
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`
            <html>
                <head><title>Raw JSON Data</title></head>
                <body>
                    <h2>Adenai Locations - Raw JSON</h2>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow: auto;">
                    ${JSON.stringify(data, null, 2)}
                    </pre>
                </body>
            </html>
        `);
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.remove();
        }, 4000);

        console.log(`📢 Toast: ${message}`);
    }
    
    ///// CHARACTER MANAGEMENT METHODS /////
    async loadCharacters() {
        try {
            console.log('👥 Loading characters from GitHub...');
            const response = await fetch('/api/characters');
            const data = await response.json();
            
            this.characters = data.characters || [];
            console.log(`✅ Loaded ${this.characters.length} characters`);
            
            // Populate location dropdown
            this.populateLocationDropdown();
        } catch (error) {
            console.error('❌ Failed to load characters:', error);
            this.showToast('Failed to load characters', 'error');
            this.characters = [];
        }
    }

    populateLocationDropdown() {
        const select = document.getElementById('character-location-select');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select location...</option>';
        
        this.locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.properties.name;
            option.textContent = location.properties.name;
            select.appendChild(option);
        });
    }

    renderCharacters() {
        const container = document.getElementById('characters-list');
        
        if (this.characters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>👥 No characters yet</h3>
                    <p>Add your first campaign character to get started!</p>
                </div>
            `;
            return;
        }

        // Filter characters based on search
        const filteredCharacters = this.characters.filter(character => {
            const name = character.name?.toLowerCase() || '';
            const description = character.description?.toLowerCase() || '';
            const location = character.location?.toLowerCase() || '';
            const title = character.title?.toLowerCase() || '';
            const searchTerm = this.currentCharacterFilter.toLowerCase();
            
            return name.includes(searchTerm) || 
                description.includes(searchTerm) || 
                location.includes(searchTerm) ||
                title.includes(searchTerm);
        });

        if (filteredCharacters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>🔍 No matches found</h3>
                    <p>Try adjusting your search terms</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredCharacters.map(character => {
            // Only show edit/delete buttons if authenticated
            const actionButtons = this.isAuthenticated ? `
                <div class="character-actions">
                    <button onclick="admin.editCharacter('${character.id}')" class="btn-secondary">✏️ Edit</button>
                    <button onclick="admin.deleteCharacter('${character.id}')" class="btn-danger">🗑️ Delete</button>
                </div>
            ` : '';
            
            return `
                <div class="character-card" data-id="${character.id}">
                    <div class="character-header">
                        <div class="character-info">
                            <h3>${character.name}</h3>
                            ${character.title ? `<p class="character-title">${character.title}</p>` : ''}
                        </div>
                        <div class="character-status">
                            <span class="status-badge status-${character.status}">${this.formatStatus(character.status)}</span>
                            <span class="relationship-badge relationship-${character.relationship}">${this.formatRelationship(character.relationship)}</span>
                        </div>
                    </div>
                    <div class="character-details">
                        ${character.location ? `<p><strong>📍 Location:</strong> ${character.location}</p>` : ''}
                        ${character.faction ? `<p><strong>🏛️ Faction:</strong> ${character.faction}</p>` : ''}
                        ${character.firstMet ? `<p><strong>📅 First Met:</strong> ${character.firstMet}</p>` : ''}
                        ${character.description ? `<p><strong>📝 Description:</strong> ${character.description}</p>` : ''}
                        ${character.notes ? `<p><strong>📋 Notes:</strong> ${character.notes}</p>` : ''}
                    </div>
                    ${actionButtons}
                </div>
            `;
        }).join('');
    }

    formatStatus(status) {
        const statuses = {
            alive: '😊 Alive',
            dead: '💀 Dead',
            missing: '❓ Missing',
            unknown: '🤷 Unknown'
        };
        return statuses[status] || status;
    }

    formatRelationship(relationship) {
        const relationships = {
            ally: '😊 Ally',
            friendly: '🙂 Friendly',
            neutral: '😐 Neutral',
            suspicious: '🤨 Suspicious',
            hostile: '😠 Hostile',
            enemy: '⚔️ Enemy'
        };
        return relationships[relationship] || relationship;
    }

    openAddCharacterModal() {
        if (!this.isAuthenticated) {
            this.showToast('❌ Please login to add characters', 'error');
            return;
        }
        this.populateLocationDropdown(); // Refresh location options
        document.getElementById('add-character-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeCharacterModal() {
        document.getElementById('add-character-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
        document.getElementById('character-form').reset();
    }

    async saveCharacter() {
        if (!this.isAuthenticated) {
            this.showToast('❌ Please login to add characters', 'error');
            return;
        }

        const form = document.getElementById('character-form');
        const formData = new FormData(form);
        
        // Create character data
        const characterData = {
            name: formData.get('name'),
            title: formData.get('title') || '',
            location: formData.get('location') || '',
            description: formData.get('description') || '',
            image: formData.get('image') || '',
            status: formData.get('status') || 'alive',
            faction: formData.get('faction') || '',
            relationship: formData.get('relationship') || 'neutral',
            firstMet: formData.get('firstMet') || '',
            notes: formData.get('notes') || ''
        };

        try {
            console.log('💾 Saving character:', characterData.name);
            
            const response = await fetch('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });

            if (response.status === 401) {
                this.showToast('❌ Session expired. Please login again.', 'error');
                this.isAuthenticated = false;
                this.updateAuthUI();
                return;
            }

            const result = await response.json();
            
            if (result.success) {
                this.showToast(`✅ Character "${characterData.name}" saved successfully!`, 'success');
                await this.loadCharacters();
                this.renderCharacters();
                this.updateStats();
                this.closeCharacterModal();
            } else {
                this.showToast('❌ Failed to save character', 'error');
            }
        } catch (error) {
            console.error('Save failed:', error);
            this.showToast('❌ Failed to save character', 'error');
        }
    }

    // Placeholder methods for future features
    editCharacter(id) {
        this.showToast('🚧 Edit character functionality coming soon!', 'warning');
    }

    deleteCharacter(id) {
        const character = this.characters.find(c => c.id === id);
        if (character && confirm(`Are you sure you want to delete "${character.name}"?`)) {
            this.showToast('🚧 Delete character functionality coming soon!', 'warning');
        }
    }

    editLocation(name) {
        this.showToast('🚧 Edit location functionality coming soon!', 'warning');
    }

    deleteLocation(name) {
        if (confirm(`Are you sure you want to delete "${name}"?`)) {
            this.showToast('🚧 Delete location functionality coming soon!', 'warning');
        }
    }
}

// Global admin instance
let admin;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdenaiAdmin();
});

// Global function for location modal
window.closeModal = () => admin.closeModal();

// Global function for character modal
window.closeCharacterModal = () => admin.closeCharacterModal();