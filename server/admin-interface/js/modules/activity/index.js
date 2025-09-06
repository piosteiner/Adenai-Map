// admin-public/js/modules/activity/index.js - Activity tracking and history UI module

const ActivityModule = {
  // Initialize the activity module
  init() {
    this.bindEvents();
    this.createActivityTab();
  },

  // Bind event listeners
  bindEvents() {
    // Listen for history button clicks on cards
    document.addEventListener('click', (e) => {
      if (e.target.matches('.history-btn, .history-btn *')) {
        e.preventDefault();
        const btn = e.target.closest('.history-btn');
        const type = btn.dataset.type;
        const name = btn.dataset.name;
        this.showItemHistory(type, name);
      }
    });

    // Listen for activity tab clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('.activity-tab-btn')) {
        e.preventDefault();
        this.showActivityFeed();
      }
    });

    // Listen for stats button clicks
    document.addEventListener('click', (e) => {
      if (e.target.matches('.activity-stats-btn')) {
        e.preventDefault();
        this.showActivityStats();
      }
    });
  },

  // Create activity tab in navigation
  createActivityTab() {
    const navTabs = document.querySelector('.nav-tabs');
    if (!navTabs) return;

    // Check if activity tab already exists
    if (navTabs.querySelector('.activity-tab-btn')) return;

    const activityTab = document.createElement('li');
    activityTab.className = 'nav-item';
    activityTab.innerHTML = `
      <a class="nav-link activity-tab-btn" href="#" data-tab="activity">
        <i class="fas fa-history"></i> Activity
      </a>
    `;

    navTabs.appendChild(activityTab);
  },

  // Add history button to content cards
  addHistoryButton(cardElement, type, name) {
    const cardHeader = cardElement.querySelector('.card-header, .card-body');
    if (!cardHeader || cardHeader.querySelector('.history-btn')) return;

    const historyBtn = document.createElement('button');
    historyBtn.className = 'btn btn-outline-info btn-sm history-btn ms-2';
    historyBtn.dataset.type = type;
    historyBtn.dataset.name = name;
    historyBtn.innerHTML = '<i class="fas fa-history"></i> History';
    
    cardHeader.appendChild(historyBtn);
  },

  // Show recent activity feed
  async showActivityFeed() {
    try {
      AdminCore.showLoading('Loading activity feed...');
      
      const response = await fetch('/api/activity/recent?limit=30');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load activity');
      }

      this.displayActivityFeed(data.activities);
      
      // Update active tab
      document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
      document.querySelector('.activity-tab-btn')?.classList.add('active');

    } catch (error) {
      console.error('Error loading activity feed:', error);
      AdminCore.showError('Failed to load activity feed: ' + error.message);
    } finally {
      AdminCore.hideLoading();
    }
  },

  // Display activity feed in main content area
  displayActivityFeed(activities) {
    const content = `
      <div class="activity-feed">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="fas fa-history"></i> Recent Activity</h2>
          <button class="btn btn-outline-primary activity-stats-btn">
            <i class="fas fa-chart-bar"></i> Statistics
          </button>
        </div>
        
        ${activities.length === 0 ? 
          '<div class="alert alert-info">No recent activity found.</div>' :
          `<div class="activity-list">
            ${activities.map(activity => this.renderActivityItem(activity)).join('')}
          </div>`
        }
      </div>
    `;

    document.getElementById('main-content').innerHTML = content;
  },

  // Render individual activity item
  renderActivityItem(activity) {
    const timeAgo = this.formatTimeAgo(new Date(activity.timestamp));
    const actionIcon = this.getActionIcon(activity.action);
    const actionColor = this.getActionColor(activity.action);

    return `
      <div class="activity-item card mb-3">
        <div class="card-body">
          <div class="d-flex align-items-start">
            <div class="activity-icon me-3">
              <i class="fas ${actionIcon} text-${actionColor}"></i>
            </div>
            <div class="activity-content flex-grow-1">
              <div class="activity-header">
                <strong>${activity.user}</strong>
                <span class="action-text text-${actionColor}">${activity.action}d</span>
                <span class="item-type badge bg-secondary">${activity.type}</span>
                <strong class="item-name">${activity.itemName}</strong>
              </div>
              <div class="activity-description text-muted">
                ${activity.description}
              </div>
              <div class="activity-meta">
                <small class="text-muted">
                  <i class="fas fa-clock"></i> ${timeAgo}
                  <span class="commit-id ms-2">#${activity.id}</span>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Show history for specific item
  async showItemHistory(type, name) {
    try {
      AdminCore.showLoading(`Loading history for ${name}...`);
      
      const response = await fetch(`/api/activity/${type}/${encodeURIComponent(name)}/history`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load history');
      }

      this.displayItemHistory(data.history, data.itemName, data.itemType);

    } catch (error) {
      console.error('Error loading item history:', error);
      AdminCore.showError('Failed to load history: ' + error.message);
    } finally {
      AdminCore.hideLoading();
    }
  },

  // Display item history in modal
  displayItemHistory(history, itemName, itemType) {
    const modalHtml = `
      <div class="modal fade" id="historyModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="fas fa-history"></i> 
                History: ${itemName}
                <span class="badge bg-secondary ms-2">${itemType}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${history.length === 0 ? 
                '<div class="alert alert-info">No history found for this item.</div>' :
                `<div class="history-timeline">
                  ${history.map(item => this.renderHistoryItem(item)).join('')}
                </div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal
    const existingModal = document.getElementById('historyModal');
    if (existingModal) existingModal.remove();

    // Add new modal
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('historyModal'));
    modal.show();

    // Clean up when hidden
    document.getElementById('historyModal').addEventListener('hidden.bs.modal', function() {
      this.remove();
    });
  },

  // Render history timeline item
  renderHistoryItem(item) {
    const timeAgo = this.formatTimeAgo(new Date(item.timestamp));
    const actionIcon = this.getActionIcon(item.action);
    const actionColor = this.getActionColor(item.action);

    return `
      <div class="history-item">
        <div class="history-marker">
          <i class="fas ${actionIcon} text-${actionColor}"></i>
        </div>
        <div class="history-content">
          <div class="history-header">
            <strong>${item.user}</strong>
            <span class="action-text text-${actionColor}">${item.action}d this ${item.type}</span>
          </div>
          <div class="history-description">${item.description}</div>
          <div class="history-time">
            <small class="text-muted">
              <i class="fas fa-clock"></i> ${timeAgo}
              <span class="commit-id ms-2">#${item.id}</span>
            </small>
          </div>
        </div>
      </div>
    `;
  },

  // Show activity statistics
  async showActivityStats() {
    try {
      AdminCore.showLoading('Loading statistics...');
      
      const response = await fetch('/api/activity/stats?days=30');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load statistics');
      }

      this.displayActivityStats(data.stats, data.period);

    } catch (error) {
      console.error('Error loading activity stats:', error);
      AdminCore.showError('Failed to load statistics: ' + error.message);
    } finally {
      AdminCore.hideLoading();
    }
  },

  // Display activity statistics
  displayActivityStats(stats, period) {
    const content = `
      <div class="activity-stats">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h2><i class="fas fa-chart-bar"></i> Activity Statistics</h2>
          <button class="btn btn-outline-secondary" onclick="ActivityModule.showActivityFeed()">
            <i class="fas fa-arrow-left"></i> Back to Activity
          </button>
        </div>
        
        <div class="stats-period mb-4">
          <span class="badge bg-info">Last ${period}</span>
        </div>

        <div class="row mb-4">
          <div class="col-md-4">
            <div class="stat-card card">
              <div class="card-body text-center">
                <h3 class="text-primary">${stats.totalChanges}</h3>
                <p class="mb-0">Total Changes</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card card">
              <div class="card-body text-center">
                <h3 class="text-success">${stats.typeActivity.locations}</h3>
                <p class="mb-0">Location Updates</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="stat-card card">
              <div class="card-body text-center">
                <h3 class="text-info">${stats.typeActivity.characters}</h3>
                <p class="mb-0">Character Updates</p>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5>User Activity</h5>
              </div>
              <div class="card-body">
                ${this.renderUserActivityChart(stats.userActivity)}
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="card">
              <div class="card-header">
                <h5>Content Types</h5>
              </div>
              <div class="card-body">
                ${this.renderTypeActivityChart(stats.typeActivity)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('main-content').innerHTML = content;
  },

  // Render user activity chart
  renderUserActivityChart(userActivity) {
    const total = Object.values(userActivity).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(userActivity)
      .sort(([,a], [,b]) => b - a)
      .map(([user, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
          <div class="user-stat mb-2">
            <div class="d-flex justify-content-between">
              <span>${user}</span>
              <span><strong>${count}</strong> changes</span>
            </div>
            <div class="progress" style="height: 6px;">
              <div class="progress-bar" style="width: ${percentage}%"></div>
            </div>
          </div>
        `;
      }).join('');
  },

  // Render type activity chart
  renderTypeActivityChart(typeActivity) {
    const total = Object.values(typeActivity).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(typeActivity).map(([type, count]) => {
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      const color = type === 'locations' ? 'success' : type === 'characters' ? 'info' : 'secondary';
      
      return `
        <div class="type-stat mb-2">
          <div class="d-flex justify-content-between">
            <span class="text-capitalize">${type}</span>
            <span><strong>${count}</strong> changes</span>
          </div>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar bg-${color}" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  // Helper functions
  getActionIcon(action) {
    const icons = {
      create: 'fa-plus-circle',
      update: 'fa-edit',
      delete: 'fa-trash-alt',
      unknown: 'fa-question-circle'
    };
    return icons[action] || icons.unknown;
  },

  getActionColor(action) {
    const colors = {
      create: 'success',
      update: 'primary',
      delete: 'danger',
      unknown: 'secondary'
    };
    return colors[action] || colors.unknown;
  },

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
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ActivityModule.init());
} else {
  ActivityModule.init();
}