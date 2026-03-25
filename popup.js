// WorkspaceFlow Popup Interface
class PopupInterface {
  constructor() {
    this.groups = [];
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
    // Auto-organize button
    document.getElementById('organizeTabsBtn').addEventListener('click', () => {
      this.autoOrganizeTabs();
    });

    // Cleanup tabs button
    document.getElementById('cleanupTabsBtn').addEventListener('click', () => {
      this.cleanupTabs();
    });

    // Options button
    document.getElementById('optionsBtn').addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        window.open(chrome.runtime.getURL('options.html'));
      }
    });

    // Listen for tab/group changes to refresh UI
    chrome.tabs.onUpdated.addListener(() => this.refreshData());
    chrome.tabs.onRemoved.addListener(() => this.refreshData());
    chrome.tabGroups.onUpdated.addListener(() => this.refreshData());
    chrome.tabGroups.onRemoved.addListener(() => this.refreshData());
  }

  async getActiveWindowId() {
    const window = await chrome.windows.getLastFocused({ populate: false });
    return window.id;
  }

  async loadData() {
    try {
      const windowId = await this.getActiveWindowId();

      // Get all tab groups in the active window
      const groups = await chrome.tabGroups.query({ windowId: windowId });

      // Get tabs to count them per group
      const tabs = await chrome.tabs.query({ windowId: windowId });

      this.groups = groups.map(group => {
        const groupTabs = tabs.filter(t => t.groupId === group.id);
        return {
          ...group,
          tabCount: groupTabs.length
        };
      });

      // Get tab metadata from background script
      const metadataResponse = await this.sendMessage({ action: 'getTabMetadata' });
      this.tabMetadata = metadataResponse.metadata || [];

    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async refreshData() {
    await this.loadData();
    this.render();
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  render() {
    this.renderStats();
    this.renderGroupList();
  }

  async renderStats() {
    try {
      const windowId = await this.getActiveWindowId();
      chrome.tabs.query({ windowId: windowId }, (tabs) => {
        const totalTabsElement = document.getElementById('totalTabs');
        if (totalTabsElement) {
          totalTabsElement.textContent = tabs.length;
        }
      });
    } catch (error) {
      console.error('Error rendering stats:', error);
    }
  }

  renderGroupList() {
    const groupList = document.getElementById('groupList');

    if (this.groups.length === 0) {
      groupList.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🚀</div>
            <div class="empty-state-text">
              No active tab groups.<br>
              Use "Auto-Organize" to group your tabs with AI,<br>
              or right-click a tab to create a group manually.
            </div>
          </div>
        `;
      return;
    }

    groupList.innerHTML = this.groups.map(group => `
        <div class="context-item" 
             data-group-id="${group.id}">
          <div class="context-name">${this.escapeHtml(group.title || 'unnamed group')}</div>
          <div class="context-meta">
            <div class="context-tabs">
              <span class="tab-count">${group.tabCount} tabs</span>
            </div>
            <div class="context-actions">
              <button onclick="event.stopPropagation(); popupInterface.focusGroup(${group.id})" title="Expand & Focus">
                🎯
              </button>
            </div>
          </div>
        </div>
      `).join('');

    // Add click listeners for group items
    groupList.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', () => {
        const groupId = parseInt(item.dataset.groupId);
        this.focusGroup(groupId);
      });
    });
  }

  async focusGroup(groupId) {
    try {
      const tabs = await chrome.tabs.query({ groupId: groupId });
      if (tabs.length > 0) {
        // Focus the first tab in the group
        await chrome.tabs.update(tabs[0].id, { active: true });
        // Always ensure the group is expanded when focusing
        await chrome.tabGroups.update(groupId, { collapsed: false });
      }
    } catch (error) {
      console.error('Error focusing group:', error);
    }
  }

  async autoOrganizeTabs() {
    try {
      this.showNotification('🤖 AI is scanning and organizing your tabs...');

      const response = await this.sendMessage({ action: 'organizeAllTabsWithAI' });

      if (response && response.success) {
        this.showNotification('✨ All tabs perfectly organized!');
        await this.refreshData();
      } else {
        this.showNotification('❌ Waiting for AI Key (Check AI Settings)');
      }
    } catch (error) {
      console.error('Error organizing tabs:', error);
      this.showNotification('❌ Error organizing tabs');
    }
  }

  async cleanupTabs() {
    try {
      const windowId = await this.getActiveWindowId();
      const tabs = await chrome.tabs.query({ windowId: windowId });

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
        await chrome.tabs.remove(duplicates);
        this.showNotification(`🧹 Removed ${duplicates.length} duplicate tabs`);
        await this.refreshData();
      } else {
        this.showNotification('✨ No duplicates found!');
      }
    } catch (error) {
      console.error('Error cleaning up tabs:', error);
      this.showNotification('❌ Error cleaning up tabs');
    }
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
    if (!text) return '';
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