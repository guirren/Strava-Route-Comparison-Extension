# Strava Route Comparison Extension

Compare your Strava routes against saved race profiles. See if your training matches the elevation intensity of your target race - the extension calculates what your route's elevation would be at race distance and shows green/yellow/red feedback. Works on Strava's route builder for Run and Trail Run activities.

## Features

- **Real-time route data extraction** from Strava's route builder
- **Equivalent elevation calculation** based on race profile ratios
- **Color-coded feedback** (green/yellow/red) showing how your route compares
- **Save races** directly from Strava routes or enter manually
- **Persistent storage** - your races are saved between sessions

---

## Installation Guide (macOS / Chrome)

### Step 1: Download the Extension

Make sure you have the extension folder with these files:
```
Strava Route Comparison Extension/
├── manifest.json
├── content.js
├── styles.css
├── popup.html
├── popup.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Step 2: Open Chrome Extensions Page

1. Open Google Chrome
2. Click the **three dots menu** (⋮) in the top-right corner
3. Go to **Extensions** → **Manage Extensions**

   Or type this in the address bar:
   ```
   chrome://extensions
   ```

### Step 3: Enable Developer Mode

1. Look for the **"Developer mode"** toggle in the top-right corner
2. Click to turn it **ON** (toggle should be blue)

```
┌─────────────────────────────────────────────────────────┐
│ Extensions                              [Developer mode]│
│                                              ☑ ON       │
└─────────────────────────────────────────────────────────┘
```

### Step 4: Load the Extension

1. Click **"Load unpacked"** button (appears after enabling Developer mode)
2. Navigate to your extension folder:
   ```
   MyFolder/Strava Route Comparison Extension
   ```
3. Select the folder and click **"Select"** (or "Open")

### Step 5: Verify Installation

You should see:
- ✅ "Strava Route Comparison" card appears in extensions list
- ✅ Extension icon appears in Chrome toolbar (may need to pin it)
- ✅ No error messages

**To pin the extension icon:**
1. Click the puzzle piece icon (🧩) in Chrome toolbar
2. Find "Strava Route Comparison"
3. Click the pin icon (📌) to keep it visible

### Step 6: Grant Permissions

The extension only needs access to `strava.com`. This is automatically granted when you load it.

---

## Troubleshooting

### Sidebar doesn't appear

1. **Check the URL**: Must be `strava.com/maps/create`
2. **Refresh the page**: Cmd+R
3. **Check extension is enabled**: Go to `chrome://extensions`
4. **Check console for errors**:
   - Right-click → Inspect → Console tab
   - Look for `[Strava Route Comparison]` messages

### Data not extracting

1. **Strava may have updated their UI**
   - Open Console (Cmd+Option+J)
   - Look for: `[Strava Route Comparison] Found X stat items`
   - If 0 items found, selectors may need updating

2. **Wait for page to fully load**
   - The extension waits 1.5 seconds before activating
   - If loading is slow, wait a few more seconds

### Changes not saving

1. **Check Chrome storage**:
   - Go to `chrome://extensions`
   - Click "Service Worker" under the extension
   - In DevTools, go to Application → Local Storage

2. **Storage quota**: Maximum 50 races allowed

### Extension not loading at all

1. **Check manifest.json** is valid JSON
2. **Check for error badge** on the extension card
3. **Click "Errors"** button if visible to see details

### To reload after making changes

1. Go to `chrome://extensions`
2. Find "Strava Route Comparison"
3. Click the **refresh icon** (↻)
4. Refresh the Strava page

---

## Console Debugging

Open Chrome DevTools (Cmd+Option+J) and look for these log messages:

```
[Strava Route Comparison] Found 6 stat items
[Strava Route Comparison] Extracted data: {distance: 44.3, ...}
[Strava Route Comparison] Race saved: Mozart
[Strava Route Comparison] Race deleted: Test Race
```

### Enable verbose logging

The extension logs key events. Filter console by typing:
```
[Strava Route Comparison]
```

---

## Data Storage

Races are stored in Chrome's local storage with this structure:

```javascript
{
  id: "1707998400000",      // Timestamp ID
  name: "Mozart 100",       // Race name
  distance: 44.3,           // km
  elevationGain: 1665,      // meters
  elevationLoss: 1665,      // meters
  createdAt: "2024-02-15T...",
  manual: false             // true if manually entered
}
```

### Export/Import (Advanced)

To backup your races, open Console and run:
```javascript
chrome.storage.local.get(['races'], r => console.log(JSON.stringify(r.races)));
```

To restore, run:
```javascript
chrome.storage.local.set({races: [/* paste your data */]});
```

---

## Known Limitations

1. **Only works on Strava route builder** (`/maps/create`)
2. **Requires "Run" or "Trail Run"** activity type
3. **Maximum 50 saved races** (to stay within storage limits)
4. **Selectors may break** if Strava updates their UI
5. **No sync across devices** (uses local storage only)

---

## Version History

### v1.0.0
- Initial release
- Route data extraction from Strava
- Equivalent elevation calculation
- Race saving and management
- Color-coded comparison display

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Look for errors in the browser console
3. Try reloading the extension
4. Clear extension storage and re-add races

For persistent issues, the extension may need updates to match Strava's latest UI changes.
