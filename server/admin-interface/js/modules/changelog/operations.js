// admin-public/js/modules/changelog/operations.js - Changelog Operations Module - API operations and data management

class ChangelogOperations {
    constructor(auth, ui) {
        this.auth = auth;
        this.ui = ui;
        this.changelog = [];
        this.currentUser = null;
        this.userRole = null;
        this.pendingCount = 0;
        this.apiBaseUrl = '/api/changelog';
    }

    async loadChangelog(limit = 100) {
        try {
            console.log('📜 Loading changelog from API...');
            
            const response = await fetch(`${this.apiBaseUrl}?limit=${limit}`);
            
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
            
            return {
                changelog: this.changelog,
                currentUser: this.currentUser,
                userRole: this.userRole
            };

        } catch (error) {
            console.error('❌ Failed to load changelog:', error);
            this.ui.showToast('Failed to load changelog', 'error');
            this.changelog = [];
            throw error;
        }
    }

    async loadPendingCount() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/pending`);
            if (response.ok) {
                const data = await response.json();
                this.pendingCount = data.count;
                console.log('📜 Pending count loaded:', this.pendingCount);
                return this.pendingCount;
            }
        } catch (error) {
            console.error('❌ Error loading pending count:', error);
        }
        return 0;
    }

    async reviewChange(commitSha, status, notes = '') {
        if (!this.auth.requireAuth()) return null;

        try {
            console.log(`📜 Reviewing change ${commitSha} as ${status}`);
            
            const response = await this.auth.authenticatedFetch(`${this.apiBaseUrl}/review/${commitSha}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reviewNotes: notes })
            });

            const result = await response.json();
            
            if (result.success) {
                this.ui.showToast(`✅ Change ${status} successfully!`, 'success');
                
                // Update local changelog data
                const changeIndex = this.changelog.findIndex(c => 
                    c.review?.commitSha === commitSha || c.id === commitSha
                );
                if (changeIndex !== -1) {
                    this.changelog[changeIndex].review.status = status;
                    if (notes) {
                        this.changelog[changeIndex].review.reviewNotes = notes;
                    }
                    this.changelog[changeIndex].review.reviewedBy = this.currentUser;
                    this.changelog[changeIndex].review.reviewedAt = new Date().toISOString();
                }
                
                return result;
            } else {
                this.ui.showToast(`❌ Failed to ${status} change`, 'error');
                return null;
            }
        } catch (error) {
            console.error('❌ Error reviewing change:', error);
            this.ui.showToast(`❌ Failed to ${status} change`, 'error');
            return null;
        }
    }

    async loadUserStats() {
        try {
            console.log('📊 Loading user statistics...');
            
            const response = await fetch(`${this.apiBaseUrl}/user-stats`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load user stats');
            }

            return {
                stats: data.stats,
                user: data.user
            };
        } catch (error) {
            console.error('❌ Error loading user stats:', error);
            this.ui.showToast('Failed to load user statistics', 'error');
            throw error;
        }
    }

    getChangelog() {
        return this.changelog;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getUserRole() {
        return this.userRole;
    }

    getPendingCount() {
        return this.pendingCount;
    }

    isAdmin() {
        return this.userRole === 'gm' || this.userRole === 'admin';
    }

    filterChangelog(filter, changelog = null) {
        const items = changelog || this.changelog;
        
        switch (filter) {
            case 'all':
                return items;
            case 'mine':
                return items.filter(item => item.isOwnChange);
            case 'pending':
                return items.filter(item => item.review.status === 'pending');
            case 'approved':
                return items.filter(item => item.review.status === 'approved');
            case 'rejected':
                return items.filter(item => item.review.status === 'rejected');
            case 'need-review':
                return items.filter(item => item.review.status === 'pending');
            default:
                return items;
        }
    }

    getChangelogStats() {
        const total = this.changelog.length;
        const pending = this.changelog.filter(c => c.review.status === 'pending').length;
        const approved = this.changelog.filter(c => c.review.status === 'approved').length;
        const rejected = this.changelog.filter(c => c.review.status === 'rejected').length;
        const myChanges = this.changelog.filter(c => c.isOwnChange).length;
        
        return {
            total,
            pending,
            approved,
            rejected,
            myChanges,
            needsReview: pending
        };
    }

    validateReviewData(status, notes = '') {
        const errors = [];
        
        if (!['approved', 'rejected'].includes(status)) {
            errors.push('Invalid review status - must be "approved" or "rejected"');
        }
        
        if (status === 'rejected' && !notes.trim()) {
            errors.push('Rejection reason is required');
        }
        
        if (notes && notes.length > 500) {
            errors.push('Review notes must be less than 500 characters');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Format functions for display
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

    getReviewStatusBadge(status) {
        const statuses = {
            pending: '<span class="status-badge status-pending">⏳ Pending Review</span>',
            approved: '<span class="status-badge status-approved">✅ Approved</span>',
            rejected: '<span class="status-badge status-rejected">❌ Rejected</span>',
            untracked: '<span class="status-badge status-untracked">➖ Not Tracked</span>'
        };
        return statuses[status] || statuses.untracked;
    }

    // Export functions
    exportData() {
        const data = {
            version: "1.0",
            changelog: this.changelog,
            stats: this.getChangelogStats(),
            lastUpdated: new Date().toISOString()
        };
        this.ui.exportJson(data, 'adenai-changelog');
    }

    viewRawJson() {
        const data = {
            version: "1.0",
            changelog: this.changelog,
            stats: this.getChangelogStats(),
            lastUpdated: new Date().toISOString()
        };
        this.ui.viewRawJson(data, 'Adenai Changelog - Raw JSON');
    }

    // Search and pagination
    searchChangelog(searchTerm, changelog = null) {
        const items = changelog || this.changelog;
        if (!searchTerm || !searchTerm.trim()) return items;
        
        const term = searchTerm.toLowerCase();
        return items.filter(item => {
            return item.itemName.toLowerCase().includes(term) ||
                   item.description.toLowerCase().includes(term) ||
                   item.user.toLowerCase().includes(term) ||
                   item.type.toLowerCase().includes(term);
        });
    }

    paginateChangelog(changelog, page = 1, itemsPerPage = 20) {
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        
        return {
            items: changelog.slice(startIndex, endIndex),
            currentPage: page,
            totalPages: Math.ceil(changelog.length / itemsPerPage),
            totalItems: changelog.length,
            hasNextPage: endIndex < changelog.length,
            hasPrevPage: page > 1
        };
    }

    // Bulk operations
    async bulkReviewChanges(commitShas, status, notes = '') {
        if (!this.auth.requireAuth()) return null;

        const results = [];
        for (const commitSha of commitShas) {
            try {
                const result = await this.reviewChange(commitSha, status, notes);
                results.push({ commitSha, success: !!result });
            } catch (error) {
                results.push({ commitSha, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        this.ui.showToast(
            `Bulk review completed: ${successCount} successful, ${failCount} failed`,
            failCount === 0 ? 'success' : 'warning'
        );

        return results;
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChangelogOperations;
}