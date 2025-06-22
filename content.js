// WorkspaceFlow Content Script
// This script runs on every page to gather additional context information

class PageAnalyzer {
    constructor() {
      this.pageData = null;
      this.activityTracker = {
        startTime: Date.now(),
        interactions: 0,
        scrollDepth: 0,
        focusTime: 0
      };
      this.init();
    }
  
    init() {
      // Only run on actual web pages, not extension pages
      if (window.location.protocol === 'chrome-extension:' || 
          window.location.protocol === 'chrome:') {
        return;
      }
  
      // Analyze page content
      this.analyzePage();
      
      // Track user activity
      this.setupActivityTracking();
      
      // Send initial data to background script
      this.sendPageData();
      
      // Set up periodic updates
      this.setupPeriodicUpdates();
    }
  
    analyzePage() {
      const url = window.location.href;
      const title = document.title;
      
      // Detect page type and context
      const pageType = this.detectPageType(url, title);
      const projectInfo = this.extractProjectInfo(url, title);
      const techStack = this.detectTechStack();
      const workContext = this.detectWorkContext(url, title);
  
      this.pageData = {
        url,
        title,
        pageType,
        projectInfo,
        techStack,
        workContext,
        timestamp: Date.now(),
        domain: window.location.hostname,
        language: this.detectLanguage(),
        hasCode: this.hasCodeContent(),
        readingTime: this.estimateReadingTime()
      };
    }
  
    detectPageType(url, title) {
      const patterns = {
        'development': [
          /github\.com\/.*\/.*\/pull/i,
          /github\.com\/.*\/.*\/issues/i,
          /github\.com\/.*\/.*\/blob/i,
          /localhost:\d+/i,
          /127\.0\.0\.1/i,
          /\.local/i,
          /stackoverflow\.com\/questions/i,
          /stackexchange\.com/i
        ],
        'documentation': [
          /docs?\./i,
          /wiki/i,
          /documentation/i,
          /readme/i,
          /api\./i,
          /developer\./i,
          /reference/i
        ],
        'design': [
          /figma\.com/i,
          /sketch\.com/i,
          /adobe\.com/i,
          /dribbble\.com/i,
          /behance\.net/i
        ],
        'productivity': [
          /notion\.so/i,
          /trello\.com/i,
          /asana\.com/i,
          /linear\.app/i,
          /clickup\.com/i,
          /monday\.com/i,
          /airtable\.com/i
        ],
        'communication': [
          /slack\.com/i,
          /discord\.com/i,
          /teams\.microsoft\.com/i,
          /zoom\.us/i,
          /meet\.google\.com/i
        ],
        'learning': [
          /coursera\.org/i,
          /udemy\.com/i,
          /pluralsight\.com/i,
          /youtube\.com\/watch/i,
          /tutorial/i,
          /course/i
        ]
      };
  
      for (const [type, typePatterns] of Object.entries(patterns)) {
        if (typePatterns.some(pattern => pattern.test(url) || pattern.test(title))) {
          return type;
        }
      }
  
      return 'general';
    }
  
    extractProjectInfo(url, title) {
      // GitHub project detection
      const githubMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (githubMatch) {
        return {
          type: 'github',
          owner: githubMatch[1],
          repo: githubMatch[2],
          name: `${githubMatch[1]}/${githubMatch[2]}`
        };
      }
  
      // Local development detection
      const localhostMatch = url.match(/localhost:(\d+)/);
      if (localhostMatch) {
        return {
          type: 'localhost',
          port: localhostMatch[1],
          name: `Local Dev :${localhostMatch[1]}`
        };
      }
  
      // Extract project name from title
      const titleMatch = title.match(/^([^-–—|]+)/);
      if (titleMatch) {
        return {
          type: 'inferred',
          name: titleMatch[1].trim()
        };
      }
  
      return null;
    }
  
    detectTechStack() {
      const technologies = [];
      const pageContent = document.documentElement.outerHTML.toLowerCase();
      const url = window.location.href.toLowerCase();
  
      // Detect based on URL patterns
      const urlPatterns = {
        'react': [/react/i, /jsx/i],
        'vue': [/vue/i, /nuxt/i],
        'angular': [/angular/i, /ng-/i],
        'node': [/node/i, /npm/i, /yarn/i],
        'python': [/python/i, /django/i, /flask/i],
        'java': [/java/i, /spring/i],
        'php': [/php/i, /laravel/i, /wordpress/i],
        'ruby': [/ruby/i, /rails/i],
        'go': [/golang/i, /\/go\//i],
        'rust': [/rust/i, /cargo/i],
        'docker': [/docker/i, /container/i],
        'kubernetes': [/k8s/i, /kubernetes/i]
      };
  
      // Detect based on page content
      const contentPatterns = {
        'react': /react|jsx|create-react-app/i,
        'vue': /vue\.js|vuejs|nuxt/i,
        'angular': /angular|@angular/i,
        'node': /node\.js|npm|yarn|package\.json/i,
        'typescript': /typescript|\.ts|\.tsx/i,
        'javascript': /javascript|\.js/i,
        'python': /python|django|flask|pip/i,
        'docker': /dockerfile|docker-compose/i
      };
  
      // Check URL patterns
      for (const [tech, patterns] of Object.entries(urlPatterns)) {
        if (patterns.some(pattern => pattern.test(url))) {
          technologies.push(tech);
        }
      }
  
      // Check content patterns
      for (const [tech, pattern] of Object.entries(contentPatterns)) {
        if (pattern.test(pageContent)) {
          technologies.push(tech);
        }
      }
  
      return [...new Set(technologies)]; // Remove duplicates
    }
  
    detectWorkContext(url, title) {
      const context = {
        isWork: false,
        category: 'personal',
        urgency: 'normal',
        tags: []
      };
  
      // Work-related patterns
      const workPatterns = [
        /jira/i, /confluence/i, /bitbucket/i,
        /teams\.microsoft/i, /sharepoint/i,
        /slack\.com\/.*workspace/i,
        /enterprise/i, /corp/i, /company/i,
        /ticket/i, /bug/i, /issue/i, /sprint/i,
        /meeting/i, /standup/i, /retrospective/i
      ];
  
      if (workPatterns.some(pattern => pattern.test(url) || pattern.test(title))) {
        context.isWork = true;
        context.category = 'work';
      }
  
      // Urgency detection
      const urgentPatterns = [
        /urgent/i, /critical/i, /hotfix/i, /emergency/i,
        /breaking/i, /production/i, /down/i, /error/i
      ];
  
      if (urgentPatterns.some(pattern => pattern.test(title))) {
        context.urgency = 'high';
      }
  
      // Add tags based on content
      const tagPatterns = {
        'bug': /bug|error|exception|crash/i,
        'feature': /feature|enhancement|improvement/i,
        'review': /review|pull request|merge/i,
        'documentation': /docs|readme|wiki|guide/i,
        'testing': /test|qa|quality|cypress|jest/i,
        'deployment': /deploy|release|ci\/cd|pipeline/i
      };
  
      for (const [tag, pattern] of Object.entries(tagPatterns)) {
        if (pattern.test(url) || pattern.test(title)) {
          context.tags.push(tag);
        }
      }
  
      return context;
    }
  
    detectLanguage() {
      const htmlLang = document.documentElement.lang;
      if (htmlLang) return htmlLang;
  
      // Simple language detection based on common words
      const text = document.body.textContent.toLowerCase();
      const languages = {
        'en': ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'],
        'es': ['el', 'la', 'y', 'o', 'pero', 'en', 'con', 'para', 'por'],
        'fr': ['le', 'la', 'et', 'ou', 'mais', 'dans', 'avec', 'pour', 'par'],
        'de': ['der', 'die', 'das', 'und', 'oder', 'aber', 'in', 'mit', 'für']
      };
  
      let maxScore = 0;
      let detectedLang = 'en';
  
      for (const [lang, words] of Object.entries(languages)) {
        const score = words.reduce((acc, word) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          const matches = text.match(regex);
          return acc + (matches ? matches.length : 0);
        }, 0);
  
        if (score > maxScore) {
          maxScore = score;
          detectedLang = lang;
        }
      }
  
      return detectedLang;
    }
  
    hasCodeContent() {
      // Check for code blocks, syntax highlighting, or development-related content
      const codeSelectors = [
        'pre', 'code', '.highlight', '.hljs', '.codehilite',
        '.language-', '.syntax', '.code-block', '.source-code'
      ];
  
      return codeSelectors.some(selector => document.querySelector(selector));
    }
  
    estimateReadingTime() {
      const text = document.body.textContent || '';
      const wordsPerMinute = 200;
      const wordCount = text.trim().split(/\s+/).length;
      return Math.ceil(wordCount / wordsPerMinute);
    }
  
    setupActivityTracking() {
      let isVisible = !document.hidden;
      let focusStartTime = isVisible ? Date.now() : null;
  
      // Track visibility changes
      document.addEventListener('visibilitychange', () => {
        const now = Date.now();
        
        if (document.hidden) {
          if (focusStartTime) {
            this.activityTracker.focusTime += now - focusStartTime;
            focusStartTime = null;
          }
          isVisible = false;
        } else {
          focusStartTime = now;
          isVisible = true;
        }
      });
  
      // Track interactions
      ['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
        document.addEventListener(event, () => {
          this.activityTracker.interactions++;
        }, { passive: true });
      });
  
      // Track scroll depth
      let maxScrollDepth = 0;
      window.addEventListener('scroll', () => {
        const scrollPercent = Math.round(
          (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        );
        maxScrollDepth = Math.max(maxScrollDepth, scrollPercent || 0);
        this.activityTracker.scrollDepth = maxScrollDepth;
      }, { passive: true });
  
      // Final focus time calculation on beforeunload
      window.addEventListener('beforeunload', () => {
        if (focusStartTime) {
          this.activityTracker.focusTime += Date.now() - focusStartTime;
        }
      });
    }
  
    sendPageData() {
      // Send page analysis data to background script
      chrome.runtime.sendMessage({
        type: 'pageAnalysis',
        data: {
          ...this.pageData,
          activity: this.activityTracker
        }
      }).catch(() => {
        // Extension context might be invalid, ignore errors
      });
    }
  
    setupPeriodicUpdates() {
      // Send activity updates every 30 seconds
      setInterval(() => {
        this.sendActivityUpdate();
      }, 30000);
  
      // Send final update when leaving page
      window.addEventListener('beforeunload', () => {
        this.sendActivityUpdate();
      });
    }
  
    sendActivityUpdate() {
      chrome.runtime.sendMessage({
        type: 'activityUpdate',
        data: {
          url: window.location.href,
          activity: {
            ...this.activityTracker,
            timeOnPage: Date.now() - this.activityTracker.startTime
          }
        }
      }).catch(() => {
        // Extension context might be invalid, ignore errors
      });
    }
}
  
  // Initialize page analyzer
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new PageAnalyzer();
    });
  } else {
    new PageAnalyzer();
  }