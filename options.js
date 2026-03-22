document.addEventListener('DOMContentLoaded', () => {
    // Restore options
    chrome.storage.local.get(['geminiApiKey', 'autoGroupEnabled'], (items) => {
      document.getElementById('apiKey').value = items.geminiApiKey || '';
      document.getElementById('autoGroupSelect').checked = items.autoGroupEnabled !== false; // default true
    });
  
    // Save options
    document.getElementById('saveBtn').addEventListener('click', () => {
      const apiKey = document.getElementById('apiKey').value.trim();
      const autoGroupEnabled = document.getElementById('autoGroupSelect').checked;
      
      const statusElement = document.getElementById('status');
      
      if (autoGroupEnabled && !apiKey) {
          statusElement.textContent = 'Please enter an API Key to enable AI Auto-Grouping';
          statusElement.className = 'status-error';
          statusElement.style.display = 'block';
          setTimeout(() => {
              statusElement.style.display = 'none';
          }, 4000);
          return;
      }
      
      chrome.storage.local.set({
        geminiApiKey: apiKey,
        autoGroupEnabled: autoGroupEnabled
      }, () => {
        statusElement.textContent = 'Settings saved successfully!';
        statusElement.className = 'status-success';
        statusElement.style.display = 'block';
        
        // Notify background script about the settings change
        chrome.runtime.sendMessage({ action: 'settingsUpdated' });
        
        setTimeout(() => {
          statusElement.style.display = 'none';
        }, 3000);
      });
    });
});
