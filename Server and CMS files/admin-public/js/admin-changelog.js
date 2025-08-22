// Changelog Management Module - Following existing admin patterns
class AdminChangelog {
    constructor() {
        this.changelog = [];
        this.currentUser = null;
        this.userRole = null;
        this.pendingCount = 0;
        this.currentFilter = 'all';
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.isInitialized = false;
        this.init();
    }

    init() {
        console.log('📜 Changelog module initializing...');
        this.setupEventListeners();
        this.createChangelogTab();
        this.createChangelogTabContent();
        this.loadUserInfo();
        this.isInitialized = true;
        
        // Listen for auth state changes
        document.addEventListener('authStateChanged', (e) => {
            this.onAuthStateChanged(e.detail.isAuthenticated);
        });
    }

    setupEventListeners() {
        // Listen for tab changes - integrate with existing tab system
        document.addEventListener('click', (e) => {
            if (e.target.matches('.tab-btn')) {
                // Small delay to let existing tab system work first
                setTimeout(() => {
                    const tabName = e.target.dataset.tab;
                    if (tabName === 'changelog') {
                        this.loadChangelogIfNeeded();
                    }
                }, 100);
            }
        });

        // 🔧 FIX: Use direct event delegation instead of UI method
        document.addEventListener('click', (e) => {
            // Review approve button
            if (e.target.matches('.review-approve-btn')) {
                e.preventDefault();
                console.log('🎯 Approve button clicked!', e.target);
                const commitSha = e.target.dataset.commit;
                console.log('📝 Commit SHA:', commitSha);
                this.reviewChange(commitSha, 'approved');
            }
            
            // Review reject button  
            if (e.target.matches('.review-reject-btn')) {
                e.preventDefault();
                console.log('🎯 Reject button clicked!', e.target);
                const commitSha = e.target.dataset.commit;
                console.log('📝 Commit SHA:', commitSha);
                this.showRejectModal(commitSha);
            }
            
            // User stats button
            if (e.target.matches('.user-stats-btn')) {
                e.preventDefault();
                console.log('🎯 Stats button clicked!', e.target);
                this.showUserStats();
            }
        });

        // Filter change listener
        document.addEventListener('change', (e) => {
            if (e.target.matches('#changelog-filter')) {
                this.currentFilter = e.target.value;
                this.filterChangelog(e.target.value);
            }
        });
    }

    async loadUserInfo() {
        try {
            const response = await fetch('/api/auth-status');
            const data = await response.json();
            this.currentUser = data.username;
            this.userRole = data.role;
            
            console.log('📜 User info loaded:', this.currentUser, this.userRole);
            
            // Load pending count if user is GM/Admin
            if (this.userRole === 'gm' || this.userRole === 'admin') {
                this.loadPendingCount();
            }
        } catch (error) {
            console.error('❌ Error loading user info:', error);
        }
    }

    async loadPendingCount() {
        try {
            const response = await fetch('/api/changelog/pending');
            if (response.ok) {
                const data = await response.json();
                this.pendingCount = data.count;
                this.updatePendingBadge();
                console.log('📜 Pending count loaded:', this.pendingCount);
            }
        } catch (error) {
            console.error('❌ Error loading pending count:', error);
        }
    }

    updatePendingBadge() {
        const badge = document.querySelector('.changelog-pending-badge');
        if (badge) {
            if (this.pendingCount > 0) {
                badge.textContent = this.pendingCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    createChangelogTab() {
        const adminNav = document.querySelector('.admin-nav');
        if (!adminNav) {
            console.log('📜 Admin nav not found');
            return;
        }

        // Check if changelog tab already exists
        if (adminNav.querySelector('[data-tab="changelog"]')) {
            console.log('📜 Changelog tab already exists');
            return;
        }

        const changelogBtn = document.createElement('button');
        changelogBtn.className = 'tab-btn';
        changelogBtn.setAttribute('data-tab', 'changelog');
        changelogBtn.innerHTML = `
            📜 Changelog
            <span class="changelog-pending-badge" style="display: none; background: red; color: white; border-radius: 50%; padding: 2px 6px; font-size: 0.8em; margin-left: 5px;"></span>
        `;

        adminNav.appendChild(changelogBtn);
        console.log('📜 Changelog tab created');
    }

    createChangelogTabContent() {
        const adminMain = document.querySelector('.admin-main');
        if (!adminMain) {
            console.log('❌ Admin main not found');
            return;
        }

        // Check if changelog tab content already exists
        if (document.getElementById('changelog-tab')) {
            console.log('📜 Changelog tab content already exists');
            return;
        }

        console.log('📜 Creating changelog tab content...');

        const changelogTabContent = document.createElement('div');
        changelogTabContent.id = 'changelog-tab';
        changelogTabContent.className = 'tab-content';
        changelogTabContent.innerHTML = `
            <div class="content-header">
                <h2>📜 Campaign Changelog</h2>
                <div class="actions">
                    <select id="changelog-filter" class="search-input">
                        <option value="all">All Changes</option>
                        <option value="mine">My Changes</option>
                        <option value="pending">Pending Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button class="btn-secondary user-stats-btn">📊 My Stats</button>
                </div>
            </div>
            
            <div id="changelog-content" class="content-list">
                <!-- Content will be loaded here -->
            </div>
        `;

        adminMain.appendChild(changelogTabContent);
        console.log('✅ Changelog tab content created successfully');
    }

    async loadChangelogIfNeeded() {
        const changelogTab = document.getElementById('changelog-tab');
        if (!changelogTab || !changelogTab.classList.contains('active')) {
            console.log('📜 Changelog tab not active, skipping load');
            return;
        }

        // Ensure the content container exists
        let changelogContent = document.getElementById('changelog-content');
        if (!changelogContent) {
            console.log('📜 Creating missing changelog-content container');
            changelogContent = document.createElement('div');
            changelogContent.id = 'changelog-content';
            changelogContent.className = 'content-list';
            changelogTab.appendChild(changelogContent);
        }

        // Check if already loaded (avoid reloading unnecessarily)
        if (changelogContent.innerHTML.includes('changelog-item')) {
            console.log('📜 Changelog already loaded');
            return;
        }

        await this.loadChangelog();
    }

    async loadChangelog() {
        try {
            console.log('📜 Loading changelog from API...');
            
            // Show loading state manually instead of using UI method
            const changelogContent = document.getElementById('changelog-content');
            if (changelogContent) {
                changelogContent.innerHTML = '<div class="loading">Loading changelog... 🔄</div>';
            }
            
            const response = await fetch('/api/changelog?limit=100');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📜 API Response:', data);

            if (!data.success) {
                throw new Error(data.error || 'Failed to load changelog');
            }

            this.changelog = data.changelog || [];
            this.currentUser = data.currentUser;
            this.userRole = data.userRole;
            
            console.log(`✅ Loaded ${this.changelog.length} changelog entries`);
            
            this.renderChangelog();

        } catch (error) {
            console.error('❌ Failed to load changelog:', error);
            this.ui.showToast('Failed to load changelog', 'error');
            
            // Show error state
            const changelogContent = document.getElementById('changelog-content');
            if (changelogContent) {
                changelogContent.innerHTML = `
                    <div class="error-state">
                        <h3>❌ Failed to load changelog</h3>
                        <p>${error.message}</p>
                        <button class="btn-primary" onclick="window.adminChangelog.loadChangelog()">🔄 Retry</button>
                    </div>
                `;
            }
        }
    }

    renderChangelog() {
        try {
            console.log('📜 Starting renderChangelog() with', this.changelog.length, 'items');
            
            const container = document.getElementById('changelog-content');
            if (!container) {
                console.error('❌ changelog-content container not found!');
                return;
            }

            console.log('📜 Found container, clearing loading state...');
            
            // Clear the container content
            container.innerHTML = '';
            
            // Also remove any loading messages that might be in parent containers
            const changelogTab = document.getElementById('changelog-tab');
            if (changelogTab) {
                const loadingElements = changelogTab.querySelectorAll('.loading');
                loadingElements.forEach(loading => {
                    if (loading.textContent.includes('Loading changelog')) {
                        loading.remove();
                        console.log('📜 Removed loading message');
                    }
                });
            }

            if (this.changelog.length === 0) {
                console.log('📜 No changelog entries, showing empty state');
                this.ui.showEmptyState('changelog-content',
                    '📜 No changelog entries yet',
                    'Campaign changes will appear here once you start making edits!'
                );
                return;
            }

            console.log('📜 Updating filter options...');
            // Update filter options for admin users
            this.updateFilterOptions();
            
            console.log('📜 Rendering', this.changelog.length, 'changelog items...');
            
            this.changelog.forEach((change, index) => {
                try {
                    console.log(`📜 Rendering item ${index + 1}:`, change.itemName);
                    const changeElement = document.createElement('div');
                    changeElement.innerHTML = this.renderChangelogItem(change);
                    container.appendChild(changeElement);
                } catch (itemError) {
                    console.error(`❌ Error rendering item ${index + 1}:`, itemError, change);
                }
            });

            console.log('📜 Applying filter:', this.currentFilter);
            // Apply current filter
            this.filterChangelog(this.currentFilter);
            
            console.log('✅ Successfully rendered', this.changelog.length, 'changelog items');
            
        } catch (error) {
            console.error('❌ Error in renderChangelog():', error);
            const container = document.getElementById('changelog-content');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <h3>❌ Error rendering changelog</h3>
                        <p>${error.message}</p>
                        <button class="btn-primary" onclick="window.adminChangelog.loadChangelog()">🔄 Retry</button>
                    </div>
                `;
            }
        }
    }

    updateFilterOptions() {
        const isAdmin = this.userRole === 'gm' || this.userRole === 'admin';
        const filterSelect = document.getElementById('changelog-filter');
        
        if (filterSelect && isAdmin) {
            // Add admin-only filter option if not already present
            if (!filterSelect.querySelector('option[value="need-review"]')) {
                const needReviewOption = document.createElement('option');
                needReviewOption.value = 'need-review';
                needReviewOption.textContent = 'Need Review';
                filterSelect.appendChild(needReviewOption);
            }
        }
    }

    renderChangelogItem(change) {
        const timeAgo = this.formatTimeAgo(new Date(change.timestamp));
        const actionIcon = this.getActionIcon(change.action);
        const isOwnChange = change.isOwnChange;
        const cardClass = isOwnChange ? 'changelog-item own-change' : 'changelog-item';
        
        // Review buttons for admins
        const reviewButtons = (change.canReview && change.review.status === 'pending') ? `
            <div class="review-actions" style="margin-top: 10px;">
                <button class="btn-primary review-approve-btn" style="margin-right: 5px;" data-commit="${change.review.commitSha || change.id}">
                    ✅ Approve
                </button>
                <button class="btn-danger review-reject-btn" data-commit="${change.review.commitSha || change.id}">
                    ❌ Reject
                </button>
            </div>
        ` : '';

        // Review details
        const reviewDetails = change.review.reviewedBy ? `
            <div class="review-details" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                <small style="color: #666;">
                    Reviewed by <strong>${change.review.reviewedBy}</strong> 
                    ${this.formatTimeAgo(new Date(change.review.reviewedAt))}
                    ${change.review.reviewNotes ? `<br><em>"${change.review.reviewNotes}"</em>` : ''}
                </small>
            </div>
        ` : '';

        return `
            <div class="location-card ${cardClass}" data-status="${change.review.status}" style="margin-bottom: 15px;">
                <div class="location-header">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h3 style="margin: 0; font-size: 1.1em;">
                                ${actionIcon} <strong>${change.user}</strong>
                                <span style="color: ${this.getActionColorHex(change.action)};">${change.action}d</span>
                                <span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${change.type}</span>
                                <strong style="color: #667eea;">${change.itemName}</strong>
                                ${isOwnChange ? '<span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">You</span>' : ''}
                            </h3>
                            
                            <!-- Status below main info as requested -->
                            <div style="margin-top: 5px;">
                                ${this.getCleanReviewStatus(change.review.status)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="location-details">
                    <p style="color: #666; margin: 5px 0;">${change.description}</p>
                    <small style="color: #999;">
                        🕒 ${timeAgo} • #${change.id}
                    </small>
                    ${reviewDetails}
                    ${reviewButtons}
                </div>
            </div>
        `;
    }

    filterChangelog(filter) {
        const items = document.querySelectorAll('.changelog-item');
        
        items.forEach(item => {
            let show = false;
            
            switch (filter) {
                case 'all':
                    show = true;
                    break;
                case 'mine':
                    show = item.classList.contains('own-change');
                    break;
                case 'pending':
                    show = item.dataset.status === 'pending';
                    break;
                case 'approved':
                    show = item.dataset.status === 'approved';
                    break;
                case 'rejected':
                    show = item.dataset.status === 'rejected';
                    break;
                case 'need-review':
                    show = item.dataset.status === 'pending';
                    break;
            }
            
            item.style.display = show ? 'block' : 'none';
        });
    }

    async reviewChange(commitSha, status, notes = '') {
        if (!this.auth.requireAuth()) return;

        try {
            console.log(`📜 Reviewing change ${commitSha} as ${status}`);
            
            const response = await this.auth.authenticatedFetch(`/api/changelog/review/${commitSha}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reviewNotes: notes })
            });

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Change ${status} successfully!`, 'success');
                await this.loadChangelog(); // Reload changelog
                this.loadPendingCount(); // Update pending count
            } else {
                this.ui.showToast(`❌ Failed to ${status} change`, 'error');
            }
        } catch (error) {
            console.error('❌ Error reviewing change:', error);
            this.ui.showToast(`❌ Failed to ${status} change`, 'error');
        }
    }

    showRejectModal(commitSha) {
        const modalHtml = `
            <div class="modal show" id="rejectModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>❌ Reject Change</h3>
                        <button class="close-btn" onclick="adminChangelog.closeRejectModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Please provide a reason for rejecting this change:</p>
                        <textarea id="reject-notes" placeholder="Explain why this change is being rejected..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="adminChangelog.closeRejectModal()">Cancel</button>
                        <button class="btn-danger" onclick="adminChangelog.confirmReject('${commitSha}')">❌ Reject Change</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.classList.add('modal-open');
    }

    closeRejectModal() {
        const modal = document.getElementById('rejectModal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.remove();
                document.body.classList.remove('modal-open');
            }, 300);
        }
    }

    confirmReject(commitSha) {
        const notes = document.getElementById('reject-notes').value.trim();
        if (!notes) {
            this.ui.showToast('❌ Please provide a reason for rejection', 'error');
            return;
        }

        this.closeRejectModal();
        this.reviewChange(commitSha, 'rejected', notes);
    }

    async showUserStats() {
        try {
            console.log('📊 Loading user statistics...');
            
            const response = await fetch('/api/changelog/user-stats');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load user stats');
            }

            this.displayUserStats(data.stats, data.user);
        } catch (error) {
            console.error('❌ Error loading user stats:', error);
            this.ui.showToast('Failed to load user statistics', 'error');
        }
    }

    displayUserStats(stats, username) {
        const modalHtml = `
            <div class="modal show modal-lg" id="userStatsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📊 Statistics for ${username}</h3>
                        <button class="close-btn" onclick="adminChangelog.closeStatsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-number">${stats.total}</div>
                                <div class="stat-label">Total Changes</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.pending}</div>
                                <div class="stat-label">Pending</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.approved}</div>
                                <div class="stat-label">Approved</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-number">${stats.rejected}</div>
                                <div class="stat-label">Rejected</div>
                            </div>
                        </div>
                        
                        <h4 style="margin-top: var(--spacing-xl); margin-bottom: var(--spacing-md);">Recent Changes:</h4>
                        <div class="recent-changes">
                            ${stats.recentChanges.length === 0 ? 
                                '<p class="text-muted">No recent changes found.</p>' :
                                stats.recentChanges.map(change => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--spacing-sm) 0; border-bottom: 1px solid var(--border-color);">
                                        <div>
                                            <strong>${change.itemName}</strong>
                                            <span class="text-secondary">(${change.action} ${change.type})</span>
                                        </div>
                                        <span class="status-badge status-${change.status}">${change.status}</span>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.classList.add('modal-open');
    }

    closeStatsModal() {
        const modal = document.getElementById('userStatsModal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => {
                modal.remove();
                document.body.classList.remove('modal-open');
            }, 300);
        }
    }

    onAuthStateChanged(isAuthenticated) {
        // Reload changelog to update review buttons
        if (this.isInitialized) {
            this.loadChangelogIfNeeded();
        }
    }

    // Helper functions
    getActionIcon(action) {
        const icons = {
            create: '➕',
            update: '✏️',
            delete: '🗑️',
            unknown: '❓'
        };
        return icons[action] || icons.unknown;
    }

    getActionColorHex(action) {
        const colors = {
            create: '#198754',
            update: '#0d6efd',
            delete: '#dc3545',
            unknown: '#6c757d'
        };
        return colors[action] || colors.unknown;
    }

    getReviewStatus(status) {
        const statuses = {
            pending: '<span style="background: #ffc107; color: black; padding: 4px 8px; border-radius: 3px; font-size: 0.9em;">⏳ Pending Review</span>',
            approved: '<span style="background: #198754; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.9em;">✅ Approved</span>',
            rejected: '<span style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.9em;">❌ Rejected</span>',
            untracked: '<span style="background: #6c757d; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.9em;">➖ Not Tracked</span>'
        };
        return statuses[status] || statuses.untracked;
    }

    getCleanReviewStatus(status) {
        const statuses = {
            pending: '<span class="status-badge status-pending">⏳ Pending Review</span>',
            approved: '<span class="status-badge status-approved">✅ Approved</span>',
            rejected: '<span class="status-badge status-rejected">❌ Rejected</span>',
            untracked: '<span class="status-badge status-untracked">➖ Not Tracked</span>'
        };
        return statuses[status] || statuses.untracked;
    }

    getStatusColor(status) {
        const colors = {
            pending: '#ffc107',
            approved: '#198754',
            rejected: '#dc3545',
            untracked: '#6c757d'
        };
        return colors[status] || '#6c757d';
    }

    formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    // Export methods for other modules
    getChangelog() {
        return this.changelog;
    }

    exportData() {
        const data = {
            version: "1.0",
            changelog: this.changelog,
            lastUpdated: new Date().toISOString()
        };
        this.ui.exportJson(data, 'adenai-changelog');
    }

    viewRawJson() {
        const data = {
            version: "1.0",
            changelog: this.changelog,
            lastUpdated: new Date().toISOString()
        };
        this.ui.viewRawJson(data, 'Adenai Changelog - Raw JSON');
    }
}

// Create global changelog instance
window.adminChangelog = new AdminChangelog();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminChangelog;
}