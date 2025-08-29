// GitHub Version Checker - Automatically fetch last commit info
class GitHubVersionChecker {
    constructor() {
        this.owner = 'piosteiner';
        this.repo = 'Adenai-Map';
        this.branch = 'main';
        this.apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/commits/${this.branch}`;
        this.cachedData = null;
        this.cacheTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // Cache for 5 minutes
    }

    async fetchLastCommit() {
        Logger.api('🐙 Fetching last commit from GitHub...');
        
        try {
            // Check cache first
            if (this.cachedData && this.cacheTime && (Date.now() - this.cacheTime < this.cacheTimeout)) {
                Logger.cache('📦 Using cached GitHub data');
                return this.cachedData;
            }

            const response = await HttpUtils.fetch(this.apiUrl);
            const data = await response.json();
            
            // Cache the data
            this.cachedData = {
                date: new Date(data.commit.committer.date),
                message: data.commit.message.split('\n')[0], // First line only
                sha: data.sha.substring(0, 7), // Short SHA
                author: data.commit.author.name,
                url: data.html_url
            };
            this.cacheTime = Date.now();
            
            Logger.success('✅ GitHub commit data fetched:', this.cachedData);
            return this.cachedData;
            
        } catch (error) {
            Logger.error('❌ Failed to fetch GitHub commit data:', error);
            
            // Return fallback data
            return {
                date: new Date(),
                message: 'Unable to fetch from GitHub',
                sha: 'unknown',
                author: 'unknown',
                url: null,
                error: true
            };
        }
    }

    async updateVersionDisplay() {
        const versionInfo = document.getElementById('version-info');
        if (!versionInfo) {
            Logger.warn('⚠️ Version info element not found');
            return;
        }

        // Show loading state
        versionInfo.innerHTML = `
            <div class="version-line">Movement System v2.0 (Clean API)</div>
            <div class="version-line">🔄 Fetching from GitHub...</div>
        `;

        const commitData = await this.fetchLastCommit();
        
        // Format the date
        const formatOptions = {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Berlin'
        };
        
        const formattedDate = commitData.date.toLocaleDateString('de-DE', formatOptions);
        
        // Update display
        if (commitData.error) {
            versionInfo.innerHTML = `
                <div class="version-line">Movement System v2.0 (Clean API)</div>
                <div class="version-line">⚠️ GitHub API unavailable</div>
                <div class="version-line">Local time: ${new Date().toLocaleTimeString('de-DE')}</div>
            `;
        } else {
            versionInfo.innerHTML = `
                <div class="version-line">Movement System v2.0 (Clean API)</div>
                <div class="version-line">Last Commit: ${formattedDate}</div>
                <div class="version-line" title="${commitData.message}">📝 ${commitData.sha} by ${commitData.author}</div>
            `;
        }
        
        // Add click handler to open GitHub commit if available
        if (commitData.url && !commitData.error) {
            versionInfo.style.cursor = 'pointer';
            versionInfo.onclick = () => {
                window.open(commitData.url, '_blank');
                Logger.debug('🔗 Opened GitHub commit:', commitData.url);
            };
            
            // Add hover effect
            versionInfo.title = `Click to view commit: ${commitData.message}`;
        }
    }

    // Force refresh from GitHub (bypass cache)
    async forceRefresh() {
        this.cachedData = null;
        this.cacheTime = null;
        await this.updateVersionDisplay();
    }

    // Get commit data without updating display
    async getCommitData() {
        return await this.fetchLastCommit();
    }
}

// Initialize and make globally available
const gitHubVersionChecker = new GitHubVersionChecker();
window.gitHubVersionChecker = gitHubVersionChecker;

// Auto-update version display when page loads
document.addEventListener('DOMContentLoaded', () => {
    gitHubVersionChecker.updateVersionDisplay();
});

// Also update when movement system loads
document.addEventListener('adenaiMapReady', () => {
    gitHubVersionChecker.updateVersionDisplay();
});

Logger.init('🐙 GitHub Version Checker loaded');
Logger.info('💡 Use gitHubVersionChecker.forceRefresh() to update manually');
