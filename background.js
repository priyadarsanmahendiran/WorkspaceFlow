// WorkspaceFlow Background Service Worker
class WorkspaceFlowManager {
  constructor() {
    this.tabMetadata = new Map();
    this.aiCategoryCache = new Map();
    this.geminiApiKey = '';
    this.autoGroupEnabled = true;

    // Set up event listeners synchronously so MV3 wakes up the service worker properly
    this.setupEventListeners();

    // Create a promise to track when data is ready
    this.readyComplete = false;
    this.readyPromise = this.init();
  }

  async init() {
    // Load saved data
    await this.loadStoredData();
    this.readyComplete = true;

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
  }

  async onTabRemoved(tabId) {
    console.log('Tab removed:', tabId);
    this.tabMetadata.delete(tabId);
  }

  async onTabUpdated(tabId, changeInfo, tab) {
    if (!this.readyComplete) await this.readyPromise;

    if (changeInfo.url || changeInfo.title) {
      console.log('Tab updated:', tab.url);
      await this.analyzeTab(tab);
    }

    // Auto-group based on AI categorization when navigation occurs
    if (typeof changeInfo.status !== 'undefined' || typeof changeInfo.url !== 'undefined') {
      if (this.autoGroupEnabled && this.geminiApiKey && tab.url) {
        this.groupTabWithAI(tab).catch(console.error);
      }
    }

    // Monitor manual tab group changes to update AI category cache
    if (changeInfo.groupId !== undefined && changeInfo.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      try {
        const group = await chrome.tabGroups.get(changeInfo.groupId);
        if (group && group.title && tab.url) {
          const domain = this.extractDomain(tab.url);
          if (domain && domain !== 'unknown') {
            const existingCategory = this.aiCategoryCache.get(domain);
            if (existingCategory !== group.title) {
              this.aiCategoryCache.set(domain, group.title);
              await this.saveStoredData();
              console.log(`Updated AI Category Cache for ${domain} to "${group.title}"`);
            }
          }
        }
      } catch (error) {
        console.error("Error updating category cache from manual group change:", error);
      }
    }
  }

  async onTabActivated(activeInfo) {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    console.log('Tab activated:', tab.url);
    await this.updateLastAccessed(activeInfo.tabId);
  }

  async onWindowFocusChanged(windowId) {
    // No longer detecting current context
  }

  async onCommand(command) {
    switch (command) {
      case 'toggle-popup':
        // This will be handled by the popup itself
        break;
      // save-context and switch-context are removed
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'getTabMetadata':
          sendResponse({ metadata: Array.from(this.tabMetadata.entries()) });
          break;

        case 'settingsUpdated':
          await this.loadStoredData();
          sendResponse({ success: true });
          break;

        case 'organizeAllTabsWithAI':
          this.organizeAllTabsWithAI().then((res) => {
            sendResponse(res);
          }).catch(e => sendResponse({ error: e.toString() }));
          return true; // async

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

    // Use AI category if available, otherwise fallback to hardcoded
    const aiCategory = this.aiCategoryCache.get(domain);
    const category = aiCategory || this.categorizeUrl(tab.url);

    const metadata = {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      domain,
      category,
      lastAccessed: Date.now(),
      timeSpent: 0,
      visits: (this.tabMetadata.get(tab.id)?.visits || 0) + 1
    };

    this.tabMetadata.set(tab.id, metadata);
    return metadata;
  }

  async categorizeWithAI(url, title) {
    if (!this.geminiApiKey) return null;
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) return null;

    const domain = this.extractDomain(url);

    // Use cached category if available for this domain
    if (this.aiCategoryCache.has(domain)) {
      return this.aiCategoryCache.get(domain);
    }

    const prompt = `You are an assistant classifying web pages into concise group names for Chrome Tab Groups. 
  Categorize the following webpage based on it's context.
  URL: ${url}
  Title: ${title}
  
  Return ONLY the category name in 1-2 words (e.g. "Development", "Social", "News", "Shopping", "Finance", "Entertainment", "Documentation", "Work"). If it's a specific recognized project or brand (like "GitHub", "AWS"), you can return that. Keep it very short. Do not include any other text format or markdown.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 10 }
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates.length > 0) {
        let categoryName = data.candidates[0].content.parts[0].text.trim();
        categoryName = categoryName.replace(/["']/g, '').split('\n')[0].trim();

        if (categoryName) {
          this.aiCategoryCache.set(domain, categoryName);
          this.saveStoredData();
          return categoryName;
        }
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
    }

    return null;
  }

  async groupTabWithAI(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || !tab.id) {
      return;
    }

    let category = await this.categorizeWithAI(tab.url, tab.title);

    // Fallback gracefully if AI is ratelimited, unavailable, or unsupported in region
    if (!category) {
      category = this.categorizeUrl(tab.url);
      // Capitalize for tab group title
      category = category.charAt(0).toUpperCase() + category.slice(1);
    }

    if (!category) return;

    try {
      const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
      let targetGroup = groups.find(g => g.title === category || g.title?.toLowerCase() === category.toLowerCase());

      if (targetGroup) {
        await chrome.tabs.group({
          tabIds: [tab.id],
          groupId: targetGroup.id
        });

        try {
          await chrome.tabGroups.update(targetGroup.id, { title: category });
        } catch (e) { }
      } else {
        const groupId = await chrome.tabs.group({
          tabIds: [tab.id]
        });

        const colors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan'];
        const hash = this.extractDomain(tab.url).split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        const color = colors[Math.abs(hash) % colors.length];

        // Small delay to address a known Chrome API bug where TabGroup UI 
        // doesn't immediately reflect title/color changes on creation.
        await new Promise(resolve => setTimeout(resolve, 300));

        await chrome.tabGroups.update(groupId, {
          title: category,
          color: color
        });
      }
    } catch (error) {
      console.error("Error creating/updating tab group:", error);
    }
  }

  async organizeAllTabsWithAI() {
    if (!this.geminiApiKey) {
      return { success: false, error: 'No API Key' };
    }

    // Get the most recently focused window to organize
    const window = await chrome.windows.getLastFocused({ populate: false });
    const tabs = await chrome.tabs.query({ windowId: window.id });

    for (const tab of tabs) {
      await this.groupTabWithAI(tab);
    }
    return { success: true };
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

  async updateLastAccessed(tabId) {
    const metadata = this.tabMetadata.get(tabId);
    if (metadata) {
      metadata.lastAccessed = Date.now();
      this.tabMetadata.set(tabId, metadata);
    }
  }

  async loadStoredData() {
    try {
      const data = await chrome.storage.local.get(['tabMetadata', 'geminiApiKey', 'autoGroupEnabled', 'aiCategoryCache']);

      if (data.tabMetadata) {
        this.tabMetadata = new Map(Object.entries(data.tabMetadata).map(([k, v]) => [parseInt(k), v]));
      }

      this.geminiApiKey = data.geminiApiKey || '';
      this.autoGroupEnabled = data.autoGroupEnabled !== false;

      if (data.aiCategoryCache) {
        this.aiCategoryCache = new Map(Object.entries(data.aiCategoryCache));
      }
    } catch (error) {
      console.error('Error loading stored data:', error);
    }
  }

  async saveStoredData() {
    try {
      await chrome.storage.local.set({
        tabMetadata: Object.fromEntries(this.tabMetadata),
        aiCategoryCache: Object.fromEntries(this.aiCategoryCache)
      });
    } catch (error) {
      console.error('Error saving stored data:', error);
    }
  }
}

// Initialize the WorkspaceFlow manager
const workspaceFlow = new WorkspaceFlowManager();