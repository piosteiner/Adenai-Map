// admin-public/js/modules/changelog/index.js - Changelog Management Module - Main Coordinator (Refactored)

class AdminChangelog {
    constructor() {
        this.ui = window.adminUI;
        this.auth = window.adminAuth;
        this.currentFilter = 'all';
        this.isInitialized = false;
        
        // Initialize sub-module
        this.operations = new ChangelogOperations(this.auth, this.ui);
        
        this.init();
    }

    init() {
        console.log('Changelog module initializing...');
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
                setTimeout(() => {
                    const tabName = e.target.dataset.tab;
                    if (tabName === 'changelog') {
                        this.loadChangelogIfNeeded();
                    }
                }, 100);
            }
        });

        // Direct event delegation for buttons
        document.addEventListener('click', (e) => {
            // Review approve button
            if (e.target.matches('.review-approve-btn')) {
                e.preventDefault();
                const commitSha = e.target.dataset.commit;
                this.reviewChange(commitSha, 'approved');
            }
            
            // Review reject button  
            if (e.target.matches('.review-reject-btn')) {
                e.preventDefault();
                const commitSha = e.target.dataset.commit;
                this.showRejectModal(commitSha);
            }
            
            // User stats button
            if (e.target.matches('.user-stats-btn')) {
                e.preventDefault();
                this.showUserStats();
            }
            
            // Cleanup reviews button (GM/Admin only)
            if (e.target.matches('.cleanup-reviews-btn')) {
                e.preventDefault();
                this.cleanupOldReviews();
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
            
            this.operations.currentUser = data.username;
            this.operations.userRole = data.role;
            
            console.log('User info loaded:', data.username, data.role);
            
            // Show/hide cleanup button based on user role
            const cleanupBtn = document.querySelector('.cleanup-reviews-btn');
            if (cleanupBtn) {
                if (data.role === 'gm' || data.role === 'admin') {
                    cleanupBtn.style.display = 'inline-block';
                } else {
                    cleanupBtn.style.display = 'none';
                }
            }
            
            // Load pending count if user is admin
            if (this.operations.isAdmin()) {
                await this.loadPendingCount();
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async loadPendingCount() {
        try {
            const pendingCount = await this.operations.loadPendingCount();
            this.updatePendingBadge(pendingCount);
        } catch (error) {
            console.error('Error loading pending count:', error);
        }
    }

    updatePendingBadge(count = null) {
        const pendingCount = count !== null ? count : this.operations.getPendingCount();
        const badge = document.querySelector('.changelog-pending-badge');
        
        if (badge) {
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    createChangelogTab() {
        const adminNav = document.querySelector('.admin-nav');
        if (!adminNav || adminNav.querySelector('[data-tab="changelog"]')) {
            return;
        }

        const changelogBtn = document.createElement('button');
        changelogBtn.className = 'tab-btn';
        changelogBtn.setAttribute('data-tab', 'changelog');
        changelogBtn.innerHTML = `
            Changelog
            <span class="changelog-pending-badge" style="display: none; background: red; color: white; border-radius: 50%; padding: 2px 6px; font-size: 0.8em; margin-left: 5px;"></span>
        `;

        adminNav.appendChild(changelogBtn);
        console.log('Changelog tab created');
    }

    createChangelogTabContent() {
        const adminMain = document.querySelector('.admin-main');
        if (!adminMain || document.getElementById('changelog-tab')) {
            return;
        }

        const changelogTabContent = document.createElement('div');
        changelogTabContent.id = 'changelog-tab';
        changelogTabContent.className = 'tab-content';
        changelogTabContent.innerHTML = `
            <div class="content-header">
                <h2>Campaign Changelog</h2>
                <div class="actions">
                    <select id="changelog-filter" class="search-input">
                        <option value="all">All Changes</option>
                        <option value="mine">My Changes</option>
                        <option value="pending">Pending Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button class="btn-secondary user-stats-btn">My Stats</button>
                    <button class="btn-warning cleanup-reviews-btn" title="Clean up old approved/rejected reviews (GM/Admin)" style="display: none;">🧹 Cleanup</button>
                </div>
            </div>
            
            <div id="changelog-content" class="content-list">
            </div>
        `;

        adminMain.appendChild(changelogTabContent);
        console.log('Changelog tab content created successfully');
    }

    async loadChangelogIfNeeded() {
        const changelogTab = document.getElementById('changelog-tab');
        if (!changelogTab || !changelogTab.classList.contains('active')) {
            return;
        }

        // Ensure the content container exists
        let changelogContent = document.getElementById('changelog-content');
        if (!changelogContent) {
            changelogContent = document.createElement('div');
            changelogContent.id = 'changelog-content';
            changelogContent.className = 'content-list';
            changelogTab.appendChild(changelogContent);
        }

        // Check if already loaded
        if (changelogContent.innerHTML.trim() !== '' && 
            (changelogContent.innerHTML.includes('changelog-item') || 
             changelogContent.innerHTML.includes('empty-state'))) {
            return;
        }

        await this.loadChangelog();
    }

    async loadChangelog() {
        try {
            console.log('Loading changelog from API...');
            
            const data = await this.operations.loadChangelog();
            this.renderChangelog(data.changelog);

        } catch (error) {
            console.error('Failed to load changelog:', error);
            
            const changelogContent = document.getElementById('changelog-content');
            if (changelogContent) {
                changelogContent.innerHTML = `
                    <div class="error-state">
                        <h3>Failed to load changelog</h3>
                        <p>${error.message}</p>
                        <button class="btn-primary" onclick="window.adminChangelog.loadChangelog()">Retry</button>
                    </div>
                `;
            }
        }
    }

    renderChangelog(changelog) {
        try {
            console.log('Starting renderChangelog() with', changelog.length, 'items');
            
            // Clean up any loading elements
            const changelogTab = document.getElementById('changelog-tab');
            if (changelogTab) {
                changelogTab.querySelectorAll('.loading').forEach(loading => loading.remove());
            }
            
            const container = document.getElementById('changelog-content');
            if (!container) {
                console.error('changelog-content container not found!');
                return;
            }

            container.innerHTML = '';

            if (changelog.length === 0) {
                this.ui.showEmptyState('changelog-content',
                    'No changelog entries yet',
                    'Campaign changes will appear here once you start making edits!'
                );
                return;
            }

            console.log('Updating filter options...');
            this.updateFilterOptions();
            
            console.log('Rendering', changelog.length, 'changelog items...');
            
            changelog.forEach((change, index) => {
                try {
                    const changeElement = document.createElement('div');
                    changeElement.innerHTML = this.renderChangelogItem(change);
                    container.appendChild(changeElement);
                } catch (itemError) {
                    console.error(`Error rendering item ${index + 1}:`, itemError, change);
                }
            });

            // Apply current filter
            this.filterChangelog(this.currentFilter);
            
            console.log('Successfully rendered', changelog.length, 'changelog items');
            
        } catch (error) {
            console.error('Error in renderChangelog():', error);
            const container = document.getElementById('changelog-content');
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <h3>Error rendering changelog</h3>
                        <p>${error.message}</p>
                        <button class="btn-primary" onclick="window.adminChangelog.loadChangelog()">Retry</button>
                    </div>
                `;
            }
        }
    }

    updateFilterOptions() {
        if (!this.operations.isAdmin()) return;
        
        const filterSelect = document.getElementById('changelog-filter');
        if (filterSelect && !filterSelect.querySelector('option[value="need-review"]')) {
            const needReviewOption = document.createElement('option');
            needReviewOption.value = 'need-review';
            needReviewOption.textContent = 'Need Review';
            filterSelect.appendChild(needReviewOption);
        }
    }

    renderChangelogItem(change) {
        const timeAgo = this.operations.formatTimeAgo(new Date(change.timestamp));
        const actionIcon = this.operations.getActionIcon(change.action);
        const isOwnChange = change.isOwnChange;
        const cardClass = isOwnChange ? 'changelog-item own-change' : 'changelog-item';
        
        // Review buttons for admins
        const reviewButtons = (change.canReview && change.review.status === 'pending') ? `
            <div class="review-actions" style="margin-top: 10px;">
                <button class="btn-primary review-approve-btn" style="margin-right: 5px;" data-commit="${change.review.commitSha || change.id}">
                    Approve
                </button>
                <button class="btn-danger review-reject-btn" data-commit="${change.review.commitSha || change.id}">
                    Reject
                </button>
            </div>
        ` : '';

        // Review details
        const reviewDetails = change.review.reviewedBy ? `
            <div class="review-details" style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                <small style="color: #666;">
                    Reviewed by <strong>${change.review.reviewedBy}</strong> 
                    ${this.operations.formatTimeAgo(new Date(change.review.reviewedAt))}
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
                                <span style="color: ${this.operations.getActionColorHex(change.action)};">${change.action}d</span>
                                <span style="background: #6c757d; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em;">${change.type}</span>
                                <strong style="color: #667eea;">${change.itemName}</strong>
                                ${isOwnChange ? '<span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.8em; margin-left: 5px;">You</span>' : ''}
                            </h3>
                            
                            <div style="margin-top: 5px;">
                                ${this.operations.getReviewStatusBadge(change.review.status)}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="location-details">
                    <p style="color: #666; margin: 5px 0;">${change.description}</p>
                    <small style="color: #999;">
                        ${timeAgo} • #${change.id}
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
                case 'need-review':
                    show = item.dataset.status === 'pending';
                    break;
                case 'approved':
                    show = item.dataset.status === 'approved';
                    break;
                case 'rejected':
                    show = item.dataset.status === 'rejected';
                    break;
            }
            
            item.style.display = show ? 'block' : 'none';
        });
    }

    async reviewChange(commitSha, status, notes = '') {
        const result = await this.operations.reviewChange(commitSha, status, notes);
        if (result) {
            await this.loadChangelog();
            await this.loadPendingCount();
        }
    }

    showRejectModal(commitSha) {
        const modalHtml = `
            <div class="modal show" id="rejectModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Reject Change</h3>
                        <button class="close-btn" onclick="adminChangelog.closeRejectModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Please provide a reason for rejecting this change:</p>
                        <textarea id="reject-notes" placeholder="Explain why this change is being rejected..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="adminChangelog.closeRejectModal()">Cancel</button>
                        <button class="btn-danger" onclick="adminChangelog.confirmReject('${commitSha}')">Reject Change</button>
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
            this.ui.showToast('Please provide a reason for rejection', 'error');
            return;
        }

        this.closeRejectModal();
        this.reviewChange(commitSha, 'rejected', notes);
    }

    async showUserStats() {
        try {
            const data = await this.operations.loadUserStats();
            this.displayUserStats(data.stats, data.user);
        } catch (error) {
            console.error('Error loading user stats:', error);
        }
    }

    displayUserStats(stats, username) {
        const modalHtml = `
            <div class="modal show modal-lg" id="userStatsModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Statistics for ${username}</h3>
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

    async cleanupOldReviews() {
        if (!this.auth.requireAuth()) return;

        // Check if user has permission
        if (!this.operations.isAdmin()) {
            this.ui.showToast('Only GM/Admin can perform review cleanup', 'error');
            return;
        }

        // Show confirmation dialog
        const retentionDays = prompt(
            'How many days of approved reviews should be kept?\n\n' +
            'Enter number of days (default: 30):\n\n' +
            'Note: Pending and rejected reviews are NEVER deleted.',
            '30'
        );

        if (retentionDays === null) return; // User cancelled

        const days = parseInt(retentionDays);
        if (isNaN(days) || days < 1) {
            this.ui.showToast('Please enter a valid number of days (1 or more)', 'error');
            return;
        }

        const confirmed = confirm(
            `Are you sure you want to clean up old reviews?\n\n` +
            `This will remove ONLY old APPROVED reviews older than ${days} days.\n` +
            `Pending and rejected reviews will be kept regardless of age.\n\n` +
            `This action cannot be undone.`
        );

        if (!confirmed) return;

        try {
            this.ui.showToast('Cleaning up old reviews...', 'info');

            const response = await this.auth.authenticatedFetch('/api/changelog/cleanup-reviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    retentionDays: days
                })
            });

            const result = await response.json();

            if (result.success) {
                this.ui.showToast(
                    `✅ Cleanup completed!\n` +
                    `Removed ${result.details.removedCount} old reviews\n` +
                    `Kept ${result.details.afterCount} recent reviews`,
                    'success'
                );

                // Refresh changelog to show updated data
                await this.loadChangelog();

                // Show detailed results if requested
                if (result.details.removedCount > 0) {
                    console.log('🧹 Cleanup details:', result.details);
                }
            } else {
                this.ui.showToast(`❌ Cleanup failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
            this.ui.showToast('❌ Failed to perform cleanup', 'error');
        }
    }

    onAuthStateChanged(isAuthenticated) {
        if (this.isInitialized) {
            this.loadChangelogIfNeeded();
        }
    }

    // Public API
    getChangelog() {
        return this.operations.getChangelog();
    }

    exportData() {
        this.operations.exportData();
    }

    viewRawJson() {
        this.operations.viewRawJson();
    }
}

// Create global changelog instance
window.adminChangelog = new AdminChangelog();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminChangelog;
}