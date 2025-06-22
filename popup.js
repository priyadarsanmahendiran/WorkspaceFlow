// WorkspaceFlow Popup Interface
class PopupInterface {
    constructor() {
      this.contexts = [];
      this.currentContext = null;
      this.tabMetadata = [];
      this.init();
    }
  
    async init() {
      // Load initial data
      await this.loadData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Render the interface
      this.render();
      
      console.log('PopupInterface initialized');
    }
  
    setupEventListeners() {
      // Save context button
      document.getElementById('saveContextBtn').addEventListener('click', () => {
        this.saveCurrentContext();
      });
  
      // Auto-organize button
      document.getElementById('organizeTabsBtn').addEventListener('click', () => {
        this.autoOrganizeTabs();
      });
  
      // Cleanup tabs button
      document.getElementById('cleanupTabsBtn').addEventListener('click', () => {
        this.cleanupTabs();
      });
  
      // Suspend tabs button
      document.getElementById('suspendTabsBtn').addEventListener('click', () => {
        this.suspendInactiveTabs();
      });
  
      // Export context button
      document.getElementById('exportContextBtn').addEventListener('click', () => {
        this.exportCurrentContext();
      });
  
      // Listen for updates from background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'contextUpdated') {
          this.loadData().then(() => this.render());
        }
      });
    }
  
    async loadData() {
      try {
        // Get contexts from background script
        const contextsResponse = await this.sendMessage({ action: 'getContexts' });
        this.contexts = contextsResponse.contexts || [];
  
        // Get current context
        const currentResponse = await this.sendMessage({ action: 'getCurrentContext' });
        this.currentContext = currentResponse.context;
  
        // Get tab metadata
        const metadataResponse = await this.sendMessage({ action: 'getTabMetadata' });
        this.tabMetadata = metadataResponse.metadata || [];
  
      } catch (error) {
        console.error('Error loading data:', error);
      }
    }
  
    async sendMessage(message) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    }
  
    render() {
      this.renderStats();
      this.renderContextList();
    }
  
    renderStats() {
      // Count total tabs
      chrome.tabs.query({}, (tabs) => {
        document.getElementById('totalTabs').textContent = tabs.length;
      });
  
      // Total contexts
      document.getElementById('totalContexts').textContent = this.contexts.length;
  
      // Active context
      const activeContextName = this.currentContext ? 
        this.currentContext.name.substring(0, 8) + (this.currentContext.name.length > 8 ? '...' : '') : 
        'None';
      document.getElementById('activeContext').textContent = activeContextName;
    }
  
    renderContextList() {
      const contextList = document.getElementById('contextList');
      
      if (this.contexts.length === 0) {
        contextList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🚀</div>
            <div class="empty-state-text">
              No workspaces yet.<br>
              Start browsing to automatically create contexts,<br>
              or save your current tabs as a workspace.
            </div>
          </div>
        `;
        return;
      }
  
      // Sort contexts by last used
      const sortedContexts = [...this.contexts].sort((a, b) => 
        (b.lastUsed || 0) - (a.lastUsed || 0)
      );
  
      contextList.innerHTML = sortedContexts.map(context => `
        <div class="context-item ${context.id === this.currentContext?.id ? 'active' : ''}" 
             data-context-id="${context.id}">
          <div class="context-name">${this.escapeHtml(context.name)}</div>
          <div class="context-meta">
            <div class="context-tabs">
              <span class="tab-count">${context.tabs?.length || 0} tabs</span>
              <span>${context.category || 'general'}</span>
            </div>
            <div class="context-actions">
              <button onclick="event.stopPropagation(); popupInterface.loadContext('${context.id}')" title="Load Context">
                🔄
              </button>
              <button onclick="event.stopPropagation(); popupInterface.shareContext('${context.id}')" title="Share Context">
                📤
              </button>
              <button onclick="event.stopPropagation(); popupInterface.deleteContext('${context.id}')" title="Delete Context">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `).join('');
  
      // Add click listeners for context items
      contextList.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', (e) => {
          if (!e.target.closest('button')) {
            const contextId = item.dataset.contextId;
            this.loadContext(contextId);
          }
        });
      });
    }
  
    async saveCurrentContext() {
      const contextName = prompt('Enter workspace name:');
      if (!contextName) return;
  
      try {
        // Get current tabs
        const tabs = await new Promise(resolve => 
          chrome.tabs.query({ currentWindow: true }, resolve)
        );
  
        const contextData = {
          name: contextName,
          tabs: tabs.map(tab => ({
            url: tab.url,
            title: tab.title,
            pinned: tab.pinned,
            favIconUrl: tab.favIconUrl
          })),
          created: Date.now(),
          type: 'manual'
        };
  
        const response = await this.sendMessage({ 
          action: 'saveContext', 
          data: contextData 
        });
  
        if (response.success) {
          this.showNotification('✅ Workspace saved successfully!');
          await this.loadData();
          this.render();
        } else {
          this.showNotification('❌ Failed to save workspace');
        }
      } catch (error) {
        console.error('Error saving context:', error);
        this.showNotification('❌ Error saving workspace');
      }
    }
  
    async loadContext(contextId) {
      try {
        const response = await this.sendMessage({ 
          action: 'loadContext', 
          contextId 
        });
  
        if (response.success) {
          this.showNotification('🔄 Workspace loaded!');
          // Close popup after loading context
          setTimeout(() => window.close(), 1000);
        } else {
          this.showNotification('❌ Failed to load workspace');
        }
      } catch (error) {
        console.error('Error loading context:', error);
        this.showNotification('❌ Error loading workspace');
      }
    }
  
    async deleteContext(contextId) {
      if (!confirm('Are you sure you want to delete this workspace?')) {
        return;
      }
  
      try {
        const response = await this.sendMessage({ 
          action: 'deleteContext', 
          contextId 
        });
  
        if (response.success) {
          this.showNotification('🗑️ Workspace deleted');
          await this.loadData();
          this.render();
        } else {
          this.showNotification('❌ Failed to delete workspace');
        }
      } catch (error) {
        console.error('Error deleting context:', error);
        this.showNotification('❌ Error deleting workspace');
      }
    }
  
    async shareContext(contextId) {
      const context = this.contexts.find(c => c.id === contextId);
      if (!context) return;
  
      // Create shareable data
      const shareData = {
        name: context.name,
        tabs: context.tabs.map(tab => ({
          url: tab.url,
          title: tab.title
        })),
        created: context.created,
        sharedAt: Date.now()
      };
  
      // Copy to clipboard
      try {
        await navigator.clipboard.writeText(JSON.stringify(shareData, null, 2));
        this.showNotification('📋 Workspace copied to clipboard!');
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = JSON.stringify(shareData, null, 2);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showNotification('📋 Workspace copied to clipboard!');
      }
    }
  
    async autoOrganizeTabs() {
      try {
        this.showNotification('🎯 Organizing tabs...');

        console.log("Organising tabs by domain");
        
        // Get all tabs
        const tabs = await new Promise(resolve => 
          chrome.tabs.query({}, resolve)
        );
  
        // Group tabs by domain
        const domainGroups = {};
        tabs.forEach(tab => {
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
          }
          
          const domain = new URL(tab.url).hostname;
          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
          }
          domainGroups[domain].push(tab);
        });
  
        // Create tab groups for domains with multiple tabs
        for (const [domain, domainTabs] of Object.entries(domainGroups)) {
          if (domainTabs.length > 0) {
            const tabIds = domainTabs.map(tab => tab.id);
            
            try {
              const group = await chrome.tabs.group({ tabIds });
              await chrome.tabGroups.update(group, {
                title: domain.replace("www.", "").replace(".com", "").replace(/^\w/, c => c.toUpperCase()), // Capitalize first letter
                color: this.getColorForDomain(domain)
              });
            } catch (error) {
              console.log('Could not group tabs for domain:', domain);
            }
          }
        }
  
        this.showNotification('✅ Tabs organized by domain!');
      } catch (error) {
        console.error('Error organizing tabs:', error);
        this.showNotification('❌ Error organizing tabs');
      }
    }
  
    async cleanupTabs() {
      try {
        const tabs = await new Promise(resolve => 
          chrome.tabs.query({}, resolve)
        );
  
        // Find duplicate tabs
        const urlMap = new Map();
        const duplicates = [];
  
        tabs.forEach(tab => {
          if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            return;
          }
  
          if (urlMap.has(tab.url)) {
            duplicates.push(tab.id);
          } else {
            urlMap.set(tab.url, tab.id);
          }
        });
  
        if (duplicates.length > 0) {
          await new Promise(resolve => 
            chrome.tabs.remove(duplicates, resolve)
          );
          this.showNotification(`🧹 Removed ${duplicates.length} duplicate tabs`);
        } else {
          this.showNotification('✨ No duplicates found!');
        }
      } catch (error) {
        console.error('Error cleaning up tabs:', error);
        this.showNotification('❌ Error cleaning up tabs');
      }
    }
  
    async suspendInactiveTabs() {
      try {
        const tabs = await new Promise(resolve => 
          chrome.tabs.query({}, resolve)
        );
  
        // Get current active tab
        const [activeTab] = await new Promise(resolve => 
          chrome.tabs.query({ active: true, currentWindow: true }, resolve)
        );
  
        // Find tabs that haven't been active recently
        const inactiveTabs = tabs.filter(tab => 
          !tab.active && 
          !tab.pinned && 
          tab.id !== activeTab.id &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('chrome-extension://')
        );
  
        let suspendedCount = 0;
        for (const tab of inactiveTabs) {
          try {
            // Inject a script to replace the page content with a suspended state
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: this.suspendTabContent,
              args: [tab.title, tab.url, tab.favIconUrl]
            });
            suspendedCount++;
          } catch (error) {
            console.log('Could not suspend tab:', tab.url);
          }
        }
  
        this.showNotification(`⏸️ Suspended ${suspendedCount} inactive tabs`);
      } catch (error) {
        console.error('Error suspending tabs:', error);
        this.showNotification('❌ Error suspending tabs');
      }
    }
  
    suspendTabContent(title, originalUrl, favIconUrl) {
      // This function runs in the context of the suspended tab
      document.documentElement.innerHTML = `
        <html>
          <head>
            <title>💤 ${title}</title>
            <link rel="icon" href="${favIconUrl || '/favicon.ico'}">
            <style>
              body {
                margin: 0;
                padding: 40px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                max-width: 500px;
              }
              .icon { font-size: 48px; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
              p { color: #666; margin-bottom: 30px; line-height: 1.5; }
              .url { 
                background: #f8f9fa; 
                padding: 10px; 
                border-radius: 6px; 
                font-family: monospace; 
                font-size: 12px; 
                word-break: break-all;
                margin-bottom: 30px;
              }
              button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                transition: transform 0.2s ease;
              }
              button:hover { transform: translateY(-2px); }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">💤</div>
              <h1>Tab Suspended</h1>
              <p>This tab has been suspended to save memory and improve performance.</p>
              <div class="url">${originalUrl}</div>
              <button onclick="window.location.reload()">Restore Tab</button>
            </div>
          </body>
        </html>
      `;
    }
  
    async exportCurrentContext() {
      try {
        const tabs = await new Promise(resolve => 
          chrome.tabs.query({ currentWindow: true }, resolve)
        );
  
        const exportData = {
          name: `Export-${new Date().toLocaleDateString()}`,
          tabs: tabs.map(tab => ({
            title: tab.title,
            url: tab.url,
            pinned: tab.pinned
          })),
          exported: new Date().toISOString(),
          tabCount: tabs.length
        };
  
        // Create downloadable file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
          type: 'application/json' 
        });
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = `workspaceflow-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
  
        this.showNotification('📤 Context exported successfully!');
      } catch (error) {
        console.error('Error exporting context:', error);
        this.showNotification('❌ Error exporting context');
      }
    }
  
    getColorForDomain(domain) {
      const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
      const hash = domain.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      return colors[Math.abs(hash) % colors.length];
    }
  
    showNotification(message) {
      // Create a temporary notification element
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
        animation: slideDown 0.3s ease;
      `;
  
      document.body.appendChild(notification);
  
      // Remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
  
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }
  
  // Initialize the popup interface when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    window.popupInterface = new PopupInterface();
  });
  
  // Add CSS animation for notifications
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
  `;
  document.head.appendChild(style);