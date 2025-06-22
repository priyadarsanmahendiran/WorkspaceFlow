// WorkspaceFlow Background Service Worker
class WorkspaceFlowManager {
    constructor() {
      this.contexts = new Map();
      this.currentContext = null;
      this.tabMetadata = new Map();
      this.init();
    }
  
    async init() {
      // Load saved data
      await this.loadStoredData();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize current session
      await this.detectCurrentContext();
      
      console.log('WorkspaceFlow initialized');
    }
  
    setupEventListeners() {
      // Tab events
      chrome.tabs.onCreated.addListener((tab) => this.onTabCreated(tab));
      chrome.tabs.onRemoved.addListener((tabId) => this.onTabRemoved(tabId));
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => this.onTabUpdated(tabId, changeInfo, tab));
      chrome.tabs.onActivated.addListener((activeInfo) => this.onTabActivated(activeInfo));
      
      // Window events
      chrome.windows.onFocusChanged.addListener((windowId) => this.onWindowFocusChanged(windowId));
      
      // Command events (keyboard shortcuts)
      chrome.commands.onCommand.addListener((command) => this.onCommand(command));
      
      // Extension events
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async responses
      });
    }
  
    async onTabCreated(tab) {
      console.log('Tab created:', tab.url);
      await this.analyzeTab(tab);
      await this.updateContexts();
    }
  
    async onTabRemoved(tabId) {
      console.log('Tab removed:', tabId);
      this.tabMetadata.delete(tabId);
      await this.updateContexts();
    }
  
    async onTabUpdated(tabId, changeInfo, tab) {
      if (changeInfo.url || changeInfo.title) {
        console.log('Tab updated:', tab.url);
        await this.analyzeTab(tab);
        await this.updateContexts();
      }
    }
  
    async onTabActivated(activeInfo) {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      console.log('Tab activated:', tab.url);
      await this.updateLastAccessed(activeInfo.tabId);
    }
  
    async onWindowFocusChanged(windowId) {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        await this.detectCurrentContext();
      }
    }
  
    async onCommand(command) {
      switch (command) {
        case 'save-context':
          await this.saveCurrentContext();
          break;
        case 'switch-context':
          await this.showContextSwitcher();
          break;
        case 'toggle-popup':
          // This will be handled by the popup itself
          break;
      }
    }
  
    async handleMessage(message, sender, sendResponse) {
      try {
        switch (message.action) {
          case 'getContexts':
            sendResponse({ contexts: Array.from(this.contexts.values()) });
            break;
          
          case 'getCurrentContext':
            sendResponse({ context: this.currentContext });
            break;
            
          case 'saveContext':
            const result = await this.saveContext(message.data);
            sendResponse({ success: true, context: result });
            break;
            
          case 'loadContext':
            await this.loadContext(message.contextId);
            sendResponse({ success: true });
            break;
            
          case 'deleteContext':
            await this.deleteContext(message.contextId);
            sendResponse({ success: true });
            break;
            
          case 'getTabMetadata':
            sendResponse({ metadata: Array.from(this.tabMetadata.entries()) });
            break;
            
          default:
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
      }
    }
  
    async analyzeTab(tab) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }
  
      const domain = this.extractDomain(tab.url);
      const category = this.categorizeUrl(tab.url);
      const project = this.detectProject(tab.url, tab.title);
  
      const metadata = {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        domain,
        category,
        project,
        lastAccessed: Date.now(),
        timeSpent: 0,
        visits: (this.tabMetadata.get(tab.id)?.visits || 0) + 1
      };
  
      this.tabMetadata.set(tab.id, metadata);
      return metadata;
    }
  
    extractDomain(url) {
      try {
        return new URL(url).hostname;
      } catch {
        return 'unknown';
      }
    }
  
    categorizeUrl(url) {
      const patterns = {
        'development': [
          'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
          'developer.mozilla.org', 'docs.google.com', 'notion.so', 'atlassian.net'
        ],
        'documentation': [
          'docs.', 'documentation', 'readme', 'wiki', 'confluence'
        ],
        'tools': [
          'localhost', '127.0.0.1', 'vercel.app', 'netlify.app', 'herokuapp.com'
        ],
        'communication': [
          'slack.com', 'discord.com', 'teams.microsoft.com', 'zoom.us', 'mail.google.com',
        ],
        'productivity': [
          'trello.com', 'asana.com', 'monday.com', 'linear.app', 'clickup.com'
        ],
        'learning': [  
            'udemy.com', 'coursera.org', 'edx.org', 'khanacademy.org', 'pluralsight.com', 'youtube.com'
        ],
        'entertainment': [
          'netflix.com', 'youtube.com', 'spotify.com', 'twitch.tv', 'vimeo.com'
        ],
        'social': [
          'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 'reddit.com'
        ],
        'news': [
          'news.google.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com'
        ],
        'shopping': [
          'amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'bestbuy.com', 'flipkart.com', 'myntra.com'
        ],
        'finance': [
          'bankofamerica.com', 'chase.com', 'paypal.com', 'stripe.com', 'coinbase.com'
        ],
        'general': [
          'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'wikipedia.org'
        ],
        'other': [
          'example.com', 'test.com', 'demo.com', 'placeholder.com'
        ]
      };
  
      for (const [category, domains] of Object.entries(patterns)) {
        if (domains.some(pattern => url.includes(pattern))) {
          return category;
        }
      }
  
      return 'general';
    }
  
    detectProject(url, title) {
      // Simple project detection based on common patterns
      const projectPatterns = [
        // GitHub repos
        /github\.com\/([^\/]+)\/([^\/]+)/,
        // Local development
        /localhost:(\d+)/,
        // Project names in titles
        /(\w+(?:-\w+)*)\s*[-–—]\s*/
      ];
  
      for (const pattern of projectPatterns) {
        const match = url.match(pattern) || title?.match(pattern);
        if (match) {
          return match[1] || match[2] || 'unknown-project';
        }
      }
  
      return 'general';
    }
  
    async updateContexts() {
      const tabs = await chrome.tabs.query({});
      const contextGroups = new Map();
  
      // Group tabs by project and category
      for (const tab of tabs) {
        const metadata = this.tabMetadata.get(tab.id);
        if (!metadata) continue;
  
        const contextKey = `${metadata.project}-${metadata.category}`;
        
        if (!contextGroups.has(contextKey)) {
          contextGroups.set(contextKey, {
            id: contextKey,
            name: `${metadata.project} (${metadata.category})`,
            project: metadata.project,
            category: metadata.category,
            tabs: [],
            lastUsed: 0,
            totalTimeSpent: 0
          });
        }
  
        const context = contextGroups.get(contextKey);
        context.tabs.push(metadata);
        context.lastUsed = Math.max(context.lastUsed, metadata.lastAccessed);
        context.totalTimeSpent += metadata.timeSpent;
      }
  
      this.contexts = contextGroups;
      await this.saveStoredData();
    }
  
    async detectCurrentContext() {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab) return;
  
        const metadata = this.tabMetadata.get(activeTab.id);
        if (metadata) {
          const contextKey = `${metadata.project}-${metadata.category}`;
          this.currentContext = this.contexts.get(contextKey);
        }
      } catch (error) {
        console.error('Error detecting current context:', error);
      }
    }
  
    async saveCurrentContext() {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const contextName = prompt('Enter context name:') || `Context-${Date.now()}`;
      
      const context = {
        id: `custom-${Date.now()}`,
        name: contextName,
        tabs: tabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          pinned: tab.pinned
        })),
        created: Date.now(),
        type: 'saved'
      };
  
      this.contexts.set(context.id, context);
      await this.saveStoredData();
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'WorkspaceFlow',
        message: `Context "${contextName}" saved successfully!`
      });
    }
  
    async loadContext(contextId) {
      const context = this.contexts.get(contextId);
      if (!context) return;
  
      // Close current tabs (optional - could be a setting)
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      for (const tab of currentTabs) {
        if (!tab.pinned) {
          chrome.tabs.remove(tab.id);
        }
      }
  
      // Open context tabs
      for (const tabData of context.tabs) {
        await chrome.tabs.create({
          url: tabData.url,
          pinned: tabData.pinned || false
        });
      }
  
      this.currentContext = context;
    }
  
    async deleteContext(contextId) {
      this.contexts.delete(contextId);
      await this.saveStoredData();
    }
  
    async updateLastAccessed(tabId) {
      const metadata = this.tabMetadata.get(tabId);
      if (metadata) {
        metadata.lastAccessed = Date.now();
        this.tabMetadata.set(tabId, metadata);
      }
    }
  
    async showContextSwitcher() {
      // This will trigger the popup to show context switcher
      chrome.action.openPopup();
    }
  
    async loadStoredData() {
      try {
        const data = await chrome.storage.local.get(['contexts', 'tabMetadata']);
        
        if (data.contexts) {
          this.contexts = new Map(Object.entries(data.contexts));
        }
        
        if (data.tabMetadata) {
          this.tabMetadata = new Map(Object.entries(data.tabMetadata).map(([k, v]) => [parseInt(k), v]));
        }
      } catch (error) {
        console.error('Error loading stored data:', error);
      }
    }
  
    async saveStoredData() {
      try {
        await chrome.storage.local.set({
          contexts: Object.fromEntries(this.contexts),
          tabMetadata: Object.fromEntries(this.tabMetadata)
        });
      } catch (error) {
        console.error('Error saving stored data:', error);
      }
    }
  }
  
  // Initialize the WorkspaceFlow manager
  const workspaceFlow = new WorkspaceFlowManager();