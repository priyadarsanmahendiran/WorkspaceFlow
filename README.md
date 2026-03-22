# WorkspaceFlow ✨

**Intelligent AI Tab Management for Chrome**

WorkspaceFlow represents the next step in browser organization. Using Google's modern Gemini API, WorkspaceFlow eliminates browser clutter by automatically categorizing and moving your tabs into beautifully colored and named Chrome Tab Groups the moment you navigate to a webpage.

## Features 🚀

- **Lightning-Fast Auto Grouping**: Leverages Gemini 1.5 Flash to automatically detect the fundamental category of any website you visit (e.g., Development, News, Shopping, Learning).
- **Native UI Integration**: Built directly upon the modern Chrome Tab Groups API for native, seamless visual organization.
- **Smart Caching Engine**: Dramatically saves AI API tokens by caching domains locally. Visit a Wikipedia page once, and every subsequent Wikipedia tab falls instantly into place without hitting the API.
- **Dynamic Regrouping**: Navigate from GitHub to YouTube using the same tab? WorkspaceFlow will dynamically pull the tab out of "Development" and into "Entertainment".
- **Glassmorphic UI**: Ships with a premium dark-mode, glass effect options menu and popup dashboard. 

## Getting Started 🛠️

1. **Install extension**: Unpack the extension folder into `chrome://extensions`.
2. **Configure API**: Click the WorkspaceFlow icon, select "⚙️ AI Settings" (or right click and hit Options).
3. **Grab a Key**: Get a completely free API key from [Google AI Studio](https://aistudio.google.com/app/apikey) and pop it into the config box.
4. **Enjoy the magic**: Open a new tab (`Cmd+T` or `Ctrl+T`), type `github.com` and hit Enter. Watch Chrome instantly organize your flow.

## Managing Workspaces 💾

Beyond AI Tab Groups, WorkspaceFlow acts as a dedicated session manager:
- You can manually press **"Auto-Organize Everything"** to organize all current tabs into domain-based Tab Groups.
- Manually suspend inactive tabs to free up Chrome memory resources.
- Save your current session as a specific "Workspace" that you can recall at a later time.

## Permissions 🔒

We request exactly what we need for maximum functionality:
- `tabs` and `activeTab` - To detect the URL of the tab you are on.
- `tabGroups` - To create, color, and name the Chrome Tab Groups.
- `storage` - To keep your API Keys securely locked on your local machine and to remember domain caches.
- `scripting` - Used for suspending tabs cleanly.

*All data and API keys live solely inside your browser. No middleman servers.*
