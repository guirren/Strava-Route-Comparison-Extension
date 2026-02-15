// Strava Route Comparison Extension - Content Script

(function() {
  'use strict';

  // Constants
  const MAX_RACES = 50;
  const STORAGE_WARNING_THRESHOLD = 45;
  const LOG_PREFIX = '[Strava Route Comparison]';

  // State
  let sidebar = null;
  let isValidActivityType = false;
  let observerActive = false;
  let updateTimeout = null;
  let hasRouteData = false;

  // Store current route data
  let currentRouteData = {
    distance: null,       // in km
    elevationGain: null,  // in meters
    elevationLoss: null   // in meters
  };

  // Store last displayed ekv values to prevent flashing
  let lastEkvDisplay = {
    gainHtml: '',
    lossHtml: ''
  };

  // Logging helper
  function log(message, data = null) {
    if (data) {
      console.log(`${LOG_PREFIX} ${message}`, data);
    } else {
      console.log(`${LOG_PREFIX} ${message}`);
    }
  }

  function logError(message, error = null) {
    if (error) {
      console.error(`${LOG_PREFIX} ${message}`, error);
    } else {
      console.error(`${LOG_PREFIX} ${message}`);
    }
  }

  // Show toast notification
  function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('src-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `src-toast src-toast-${type}`;

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('src-toast-visible');

    setTimeout(() => {
      toast.classList.remove('src-toast-visible');
      setTimeout(() => {
        toast.classList.add('src-hidden');
      }, 300);
    }, duration);
  }

  // Show field error
  function showFieldError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('src-hidden');
    }
  }

  // Clear field error
  function clearFieldError(elementId) {
    const errorEl = document.getElementById(elementId);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.classList.add('src-hidden');
    }
  }

  // Update save button state based on route data
  function updateSaveButtonState() {
    const saveBtn = document.getElementById('src-save-race');
    if (!saveBtn) return;

    if (hasRouteData && isValidActivityType) {
      saveBtn.disabled = false;
      saveBtn.title = '';
    } else {
      saveBtn.disabled = true;
      saveBtn.title = hasRouteData ? 'Switch to Run or Trail Run' : 'Draw a route first';
    }
  }

  // Check if we're on a route builder page
  function isRouteBuilderPage() {
    const url = window.location.href;
    return url.includes('/maps/create');
  }

  // Push website content to make room for sidebar
  function pushWebsiteContent(push = true) {
    const width = push ? '320px' : '0px';

    // Inject/update a style tag for CSS-based pushing
    let styleEl = document.getElementById('src-push-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'src-push-style';
      document.head.appendChild(styleEl);
    }

    if (push) {
      styleEl.textContent = `
        /* Push Strava content for sidebar */

        /* Header - use padding on the right nav group */
        #global-header ul[class*="styles_navGroup"]:last-child,
        [class*="GlobalHeader"] ul[class*="styles_navGroup"]:last-child {
          padding-right: 320px !important;
          transition: padding-right 0.3s ease !important;
        }

        /* Bottom bar - use padding on the wrapper */
        [class*="BottomBar_bottomBar"] {
          padding-right: 320px !important;
          transition: padding-right 0.3s ease !important;
        }

        /* Elevation chart */
        [class*="RouteOverviewBottomBar_elevationChart"],
        [class*="elevationChart"] {
          right: 320px !important;
          transition: right 0.3s ease !important;
        }

        /* Map navigation toolbar - tied to map, no adjustment needed */

        /* Route toolbar */
        [class*="RouteToolbar_toolbar"] {
          right: 320px !important;
          transition: right 0.3s ease !important;
        }

        /* Horizontal scroll menu - reduce width */
        .react-horizontal-scrolling-menu--scroll-container {
          max-width: calc(100vw - 320px - 120px) !important;
          transition: max-width 0.3s ease !important;
        }

        /* Map container - width only, no right offset needed */
        [class*="mapboxgl-map"],
        [class*="MapContainer"],
        [class*="Map_map"],
        .mapboxgl-map {
          width: calc(100% - 320px) !important;
          transition: width 0.3s ease !important;
        }

        /* Keep mapbox controls in place (they're relative to map, not viewport) */
        .mapboxgl-ctrl-top-left,
        .mapboxgl-ctrl-bottom-left,
        .mapboxgl-ctrl-top-right,
        .mapboxgl-ctrl-bottom-right {
          /* These are positioned relative to the map container, so no adjustment needed */
        }
      `;
    } else {
      styleEl.textContent = `
        /* Restore Strava content */

        /* Header */
        #global-header ul[class*="styles_navGroup"]:last-child,
        [class*="GlobalHeader"] ul[class*="styles_navGroup"]:last-child {
          padding-right: 0px !important;
          transition: padding-right 0.3s ease !important;
        }

        /* Bottom bar */
        [class*="BottomBar_bottomBar"] {
          padding-right: 0px !important;
          transition: padding-right 0.3s ease !important;
        }

        /* Elevation chart */
        [class*="RouteOverviewBottomBar_elevationChart"],
        [class*="elevationChart"] {
          right: 0px !important;
          transition: right 0.3s ease !important;
        }

        /* Map navigation toolbar - tied to map, no adjustment needed */

        /* Route toolbar */
        [class*="RouteToolbar_toolbar"] {
          right: 0px !important;
          transition: right 0.3s ease !important;
        }

        /* Horizontal scroll menu */
        .react-horizontal-scrolling-menu--scroll-container {
          max-width: none !important;
          transition: max-width 0.3s ease !important;
        }

        /* Map container */
        [class*="mapboxgl-map"],
        [class*="MapContainer"],
        [class*="Map_map"],
        .mapboxgl-map {
          width: 100% !important;
          transition: width 0.3s ease !important;
        }
      `;
    }

    log(`Website content ${push ? 'pushed' : 'restored'}`);

    // Trigger map resize after transition completes
    setTimeout(() => {
      // Dispatch resize event so Mapbox recalculates
      window.dispatchEvent(new Event('resize'));

      // Also try to find and resize Mapbox map directly
      const mapContainer = document.querySelector('.mapboxgl-map');
      if (mapContainer && mapContainer.__mapbox_map) {
        mapContainer.__mapbox_map.resize();
      }
    }, 350); // Wait for CSS transition to complete
  }

  // Close the sidebar completely
  function closeSidebar(manual = false) {
    if (sidebar) {
      sidebar.classList.add('src-sidebar-hidden');
      pushWebsiteContent(false);
      // Store closed state
      chrome.storage.local.set({
        sidebarClosed: true,
        sidebarManualClose: manual  // Track if user manually closed
      });
    }
  }

  // Open the sidebar
  function openSidebar() {
    if (sidebar) {
      sidebar.classList.remove('src-sidebar-hidden');
      pushWebsiteContent(true);
      // Store open state and reset manual close flag
      chrome.storage.local.set({
        sidebarClosed: false,
        sidebarManualClose: false
      });
    }
  }

  // Create and inject the sidebar
  function createSidebar() {
    if (sidebar) return;

    sidebar = document.createElement('div');
    sidebar.id = 'strava-route-comparison-sidebar';
    sidebar.innerHTML = `
      <div class="src-header">
        <h2>Route Comparison</h2>
        <button id="src-close" class="src-close-btn" title="Close sidebar">✕</button>
      </div>
      <div class="src-content">
        <div class="src-status">
          <span id="src-activity-status" class="src-status-badge">Checking activity type...</span>
        </div>

        <div id="src-main-content" class="src-hidden">
          <section class="src-section">
            <h3>Current Route</h3>
            <div id="src-no-route" class="src-empty-state">
              <p>Draw a route to see comparison</p>
            </div>
            <div id="src-route-stats" class="src-route-stats src-hidden">
              <div class="src-stat">
                <span class="src-stat-label">Distance</span>
                <span class="src-stat-value-group">
                  <span class="src-stat-main">
                    <span id="src-distance" class="src-stat-value">--</span>
                    <span class="src-stat-unit">km</span>
                  </span>
                </span>
              </div>
              <div class="src-stat">
                <span class="src-stat-label">Elevation Gain</span>
                <span class="src-stat-value-group">
                  <span class="src-stat-main">
                    <span id="src-elevation-gain" class="src-stat-value">--</span>
                    <span class="src-stat-unit">m</span>
                  </span>
                  <span id="src-elevation-gain-ekv" class="src-stat-ekv"></span>
                </span>
              </div>
              <div class="src-stat">
                <span class="src-stat-label">Elevation Loss</span>
                <span class="src-stat-value-group">
                  <span class="src-stat-main">
                    <span id="src-elevation-loss" class="src-stat-value">--</span>
                    <span class="src-stat-unit">m</span>
                  </span>
                  <span id="src-elevation-loss-ekv" class="src-stat-ekv"></span>
                </span>
              </div>
              <div class="src-stat">
                <span class="src-stat-label">Gain per km</span>
                <span class="src-stat-value-group">
                  <span class="src-stat-main">
                    <span id="src-gain-per-km" class="src-stat-value">--</span>
                    <span class="src-stat-unit">m/km</span>
                  </span>
                </span>
              </div>
            </div>
          </section>

          <section class="src-section">
            <h3>Compare With Race</h3>
            <div id="src-no-races" class="src-empty-state">
              <p>No races saved yet</p>
              <p class="src-empty-hint">Save a route or add one manually below</p>
            </div>
            <div id="src-race-selector-container" class="src-race-selector src-hidden">
              <select id="src-race-select">
                <option value="">Select a race...</option>
              </select>
            </div>
            <div id="src-race-count" class="src-race-count src-hidden"></div>
          </section>

          <section id="src-comparison" class="src-section src-hidden">
            <h3>Comparison</h3>
            <div id="src-comparison-results"></div>
          </section>

          <section class="src-section">
            <div class="src-section-header">
              <h3>Save Current Route</h3>
              <button id="src-toggle-save" class="src-link-btn">Show</button>
            </div>
            <div id="src-save-form" class="src-save-form src-hidden">
              <input type="text" id="src-race-name" placeholder="Race name" />
              <button id="src-save-race" class="src-btn src-btn-primary" disabled>Save as Race</button>
              <div id="src-save-error" class="src-field-error src-hidden"></div>
            </div>
          </section>

          <section class="src-section">
            <div class="src-section-header">
              <h3>Add Race Manually</h3>
              <button id="src-toggle-manual" class="src-link-btn">Show</button>
            </div>
            <div id="src-manual-form" class="src-manual-form src-hidden">
              <div class="src-form-group">
                <label for="src-manual-name">Race Name *</label>
                <input type="text" id="src-manual-name" placeholder="e.g., Mozart 100" />
              </div>
              <div class="src-form-row">
                <div class="src-form-group">
                  <label for="src-manual-distance">Distance (km) *</label>
                  <input type="number" id="src-manual-distance" step="0.1" min="0.1" placeholder="44.3" />
                </div>
              </div>
              <div class="src-form-row">
                <div class="src-form-group">
                  <label for="src-manual-gain">Elev. Gain (m) *</label>
                  <input type="number" id="src-manual-gain" step="1" min="0" placeholder="1665" />
                </div>
                <div class="src-form-group">
                  <label for="src-manual-loss">Elev. Loss (m)</label>
                  <input type="number" id="src-manual-loss" step="1" min="0" placeholder="1665" />
                </div>
              </div>
              <div id="src-manual-error" class="src-field-error src-hidden"></div>
              <button id="src-save-manual" class="src-btn src-btn-primary">Add Race</button>
            </div>
          </section>
        </div>

        <div id="src-not-trail-run" class="src-notice src-hidden">
          <p>This extension only works with <strong>Run</strong> or <strong>Trail Run</strong> activities.</p>
          <p>Please change the activity type to use route comparison.</p>
        </div>
      </div>
      <div id="src-toast" class="src-toast src-hidden"></div>
    `;

    document.body.appendChild(sidebar);

    // Check activity type and previous state to determine initial visibility
    chrome.storage.local.get(['sidebarClosed', 'sidebarManualClose'], function(result) {
      // Check current activity type
      const routeTypeEl = document.getElementById('routeType');
      let isValidActivity = false;

      if (routeTypeEl) {
        const valueEl = routeTypeEl.querySelector('[class*="singleValue"]');
        if (valueEl) {
          const activityType = valueEl.textContent.trim().toLowerCase();
          isValidActivity = activityType.includes('trail run') || activityType === 'run';
        }
      }

      // Show sidebar if: activity is valid AND (not manually closed OR never been closed)
      if (isValidActivity && !result.sidebarManualClose) {
        sidebar.classList.remove('src-sidebar-hidden');
        pushWebsiteContent(true);
      } else if (result.sidebarClosed || !isValidActivity) {
        sidebar.classList.add('src-sidebar-hidden');
        pushWebsiteContent(false);
      } else {
        pushWebsiteContent(true);
      }
    });

    initializeSidebarEvents();
    startObservingRouteData();
  }

  // Initialize sidebar event listeners
  function initializeSidebarEvents() {
    // Close sidebar (manual close by user)
    document.getElementById('src-close').addEventListener('click', function() {
      closeSidebar(true);  // true = manual close
    });

    // Race selection change
    document.getElementById('src-race-select').addEventListener('change', function() {
      if (this.value) {
        saveLastUsedRace(this.value);
        showComparison(this.value);
      } else {
        hideComparison();
      }
    });

    // Save race from current route
    document.getElementById('src-save-race').addEventListener('click', saveCurrentRoute);

    // Toggle save form
    document.getElementById('src-toggle-save').addEventListener('click', function() {
      const form = document.getElementById('src-save-form');
      const isHidden = form.classList.toggle('src-hidden');
      this.textContent = isHidden ? 'Show' : 'Hide';
    });

    // Toggle manual form
    document.getElementById('src-toggle-manual').addEventListener('click', function() {
      const form = document.getElementById('src-manual-form');
      const isHidden = form.classList.toggle('src-hidden');
      this.textContent = isHidden ? 'Show' : 'Hide';
    });

    // Save manual race
    document.getElementById('src-save-manual').addEventListener('click', saveManualRace);

    // Load saved races and restore last selection
    loadSavedRaces();

    // Try to get route title for auto-fill
    setTimeout(tryAutoFillRouteName, 2000);
  }

  // Try to extract route name from Strava page
  function tryAutoFillRouteName() {
    const nameInput = document.getElementById('src-race-name');
    if (nameInput && !nameInput.value) {
      // Try to find route title in Strava's UI
      const titleSelectors = [
        '[class*="RouteTitle"]',
        '[class*="routeName"]',
        'input[name="name"]',
        '[class*="RouteName"]'
      ];

      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          const title = el.value || el.textContent;
          if (title && title.trim()) {
            nameInput.placeholder = title.trim();
            break;
          }
        }
      }
    }
  }

  // Save last used race ID
  function saveLastUsedRace(raceId) {
    chrome.storage.local.set({ lastUsedRaceId: raceId });
  }

  // Get last used race ID
  function getLastUsedRace(callback) {
    chrome.storage.local.get(['lastUsedRaceId'], function(result) {
      callback(result.lastUsedRaceId || null);
    });
  }

  // Calculate and display projected elevation based on selected race
  // Shows what elevation you'd have if route extended/shortened to race distance
  function updateEquivalentElevation() {
    const select = document.getElementById('src-race-select');
    const gainEkvEl = document.getElementById('src-elevation-gain-ekv');
    const lossEkvEl = document.getElementById('src-elevation-loss-ekv');

    if (!select || !gainEkvEl || !lossEkvEl) return;

    const raceId = select.value;

    // Clear display if no race selected or no route data
    if (!raceId || currentRouteData.distance === null || currentRouteData.distance === 0) {
      gainEkvEl.textContent = '';
      lossEkvEl.textContent = '';
      return;
    }

    chrome.storage.local.get(['races'], function(result) {
      const races = result.races || [];
      const race = races.find(r => r.id === raceId);

      if (!race || race.distance === 0) {
        gainEkvEl.textContent = '';
        lossEkvEl.textContent = '';
        return;
      }

      // Get actual route values
      const actualGain = currentRouteData.elevationGain || 0;
      const actualLoss = currentRouteData.elevationLoss || 0;

      // Calculate projected elevation if route extended/shortened to race distance
      // Formula: projected = (route_elevation / route_distance) * race_distance
      const projectedGain = (actualGain / currentRouteData.distance) * race.distance;
      const projectedLoss = (actualLoss / currentRouteData.distance) * race.distance;

      // Calculate percentage difference vs race target: ((projected - race) / race) * 100
      // Positive = more elevation than race, Negative = less elevation than race
      const gainPercentOff = race.elevationGain > 0 ? ((projectedGain - race.elevationGain) / race.elevationGain) * 100 : 0;
      const lossPercentOff = race.elevationLoss > 0 ? ((projectedLoss - race.elevationLoss) / race.elevationLoss) * 100 : 0;

      // Determine color class based on percentage
      // GREEN: within ±10%, YELLOW: 10-20% off, RED: more than 20% off
      const gainColorClass = getColorClass(gainPercentOff);
      const lossColorClass = getColorClass(lossPercentOff);

      // Format percentage with sign
      const gainPercentStr = formatPercentage(gainPercentOff);
      const lossPercentStr = formatPercentage(lossPercentOff);

      // Display: "projected Xm (Y% vs race)"
      const newGainHtml = `<span class="src-ekv-badge ${gainColorClass}">@ race: ${Math.round(projectedGain)} m (${gainPercentStr})</span>`;
      const newLossHtml = `<span class="src-ekv-badge ${lossColorClass}">@ race: ${Math.round(projectedLoss)} m (${lossPercentStr})</span>`;

      // Only update DOM if values changed (prevents flashing)
      if (newGainHtml !== lastEkvDisplay.gainHtml) {
        gainEkvEl.innerHTML = newGainHtml;
        lastEkvDisplay.gainHtml = newGainHtml;
      }
      if (newLossHtml !== lastEkvDisplay.lossHtml) {
        lossEkvEl.innerHTML = newLossHtml;
        lastEkvDisplay.lossHtml = newLossHtml;
      }
    });
  }

  // Get color class based on percentage off target
  function getColorClass(percentOff) {
    const absPercent = Math.abs(percentOff);
    if (absPercent <= 10) {
      return 'src-ekv-green';  // Within ±10%
    } else if (absPercent <= 20) {
      return 'src-ekv-yellow'; // 10-20% off
    } else {
      return 'src-ekv-red';    // More than 20% off
    }
  }

  // Format percentage with sign
  function formatPercentage(percent) {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${Math.round(percent)}%`;
  }

  // Extract route data from Strava's interface
  // Strava structure: ul.Stats_listStats > li > div.Stat_stat > span.Stat_statLabel + div.Stat_statValue
  function extractRouteData() {
    const data = {
      distance: null,
      elevationGain: null,
      elevationLoss: null,
      activityType: null
    };

    try {
      // Find all stat items in the bottom bar
      // Using partial class matching since Strava uses CSS modules with hashed suffixes
      const statItems = document.querySelectorAll('[class*="Stat_stat__"]');

      if (statItems.length === 0) {
        log('No stat items found - Strava UI may not be loaded yet');
        return data;
      }

      log(`Found ${statItems.length} stat items`);

      statItems.forEach(statItem => {
        try {
          // Get the label and value elements
          const labelEl = statItem.querySelector('[class*="Stat_statLabel__"]');
          const valueEl = statItem.querySelector('[class*="Stat_statValue__"]');

          if (!labelEl) return;

          const label = labelEl.textContent.trim().toLowerCase();
          const valueText = valueEl ? valueEl.textContent.trim() : '';

          // Parse based on label
          if (label === 'distance') {
            // Format: "106.76 km" or "66.34 mi"
            const match = valueText.match(/([\d.,]+)\s*(km|mi)/i);
            if (match) {
              let value = parseFloat(match[1].replace(/,/g, ''));
              if (match[2].toLowerCase() === 'mi') {
                value = value * 1.60934; // Convert miles to km
              }
              data.distance = value;
            }
          }
          else if (label === 'elevation gain') {
            // Format: "3,090 m" or "10,138 ft"
            const match = valueText.match(/([\d.,]+)\s*(m|ft)/i);
            if (match) {
              let value = parseFloat(match[1].replace(/,/g, ''));
              if (match[2].toLowerCase() === 'ft') {
                value = value * 0.3048; // Convert feet to meters
              }
              data.elevationGain = value;
            }
          }
          else if (label === 'elevation loss') {
            // Format: "3,089 m" or "10,135 ft"
            const match = valueText.match(/([\d.,]+)\s*(m|ft)/i);
            if (match) {
              let value = parseFloat(match[1].replace(/,/g, ''));
              if (match[2].toLowerCase() === 'ft') {
                value = value * 0.3048; // Convert feet to meters
              }
              data.elevationLoss = value;
            }
          }
          else if (label === 'trail run' || label === 'run' || label === 'ride' || label === 'walk' || label === 'hike') {
            // Activity type is shown as the label (with an icon as the value)
            data.activityType = labelEl.textContent.trim();
          }
        } catch (itemError) {
          logError('Error parsing stat item', itemError);
        }
      });

      log('Extracted data:', data);

    } catch (error) {
      logError('Error extracting route data', error);
    }

    return data;
  }

  // Parse number from text, handling commas and converting units
  function parseNumericValue(text, convertFeet = false) {
    const match = text.match(/([\d.,]+)\s*(km|mi|m|ft)?/i);
    if (!match) return null;

    let value = parseFloat(match[1].replace(/,/g, ''));
    const unit = match[2] ? match[2].toLowerCase() : null;

    if (unit === 'mi') value *= 1.60934;
    if (unit === 'ft' && convertFeet) value *= 0.3048;

    return value;
  }

  // Update sidebar with current route data
  function updateSidebarData(data) {
    const noRouteEl = document.getElementById('src-no-route');
    const routeStatsEl = document.getElementById('src-route-stats');

    // Check if we have valid route data
    hasRouteData = data.distance !== null && data.distance > 0;

    // Show/hide route stats vs empty state
    if (hasRouteData) {
      noRouteEl.classList.add('src-hidden');
      routeStatsEl.classList.remove('src-hidden');

      // Store and display values
      currentRouteData.distance = data.distance;
      document.getElementById('src-distance').textContent = data.distance.toFixed(2);

      if (data.elevationGain !== null) {
        currentRouteData.elevationGain = data.elevationGain;
        document.getElementById('src-elevation-gain').textContent = Math.round(data.elevationGain);
      }
      if (data.elevationLoss !== null) {
        currentRouteData.elevationLoss = data.elevationLoss;
        document.getElementById('src-elevation-loss').textContent = Math.round(data.elevationLoss);
      }

      // Calculate and display gain per km
      if (data.distance > 0 && data.elevationGain !== null) {
        const gainPerKm = data.elevationGain / data.distance;
        document.getElementById('src-gain-per-km').textContent = Math.round(gainPerKm);
      } else {
        document.getElementById('src-gain-per-km').textContent = '--';
      }

      // Update equivalent elevation if a race is selected
      updateEquivalentElevation();
    } else {
      noRouteEl.classList.remove('src-hidden');
      routeStatsEl.classList.add('src-hidden');
      currentRouteData = { distance: null, elevationGain: null, elevationLoss: null };
    }

    // Check activity type
    const activityStatus = document.getElementById('src-activity-status');
    const mainContent = document.getElementById('src-main-content');
    const notTrailRun = document.getElementById('src-not-trail-run');

    const activityLower = data.activityType ? data.activityType.toLowerCase() : '';
    isValidActivityType = activityLower.includes('trail run') || activityLower === 'run';

    if (isValidActivityType) {
      activityStatus.textContent = data.activityType;
      activityStatus.classList.add('src-status-active');
      activityStatus.classList.remove('src-status-inactive');
      mainContent.classList.remove('src-hidden');
      notTrailRun.classList.add('src-hidden');
    } else if (data.activityType) {
      activityStatus.textContent = data.activityType;
      activityStatus.classList.remove('src-status-active');
      activityStatus.classList.add('src-status-inactive');
      mainContent.classList.add('src-hidden');
      notTrailRun.classList.remove('src-hidden');
    }

    // Update save button state
    updateSaveButtonState();
  }

  // Debounced update function to avoid excessive re-renders
  function debouncedUpdate() {
    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(() => {
      const data = extractRouteData();
      updateSidebarData(data);
    }, 250); // Wait 250ms after last change before updating
  }

  // Start observing DOM for route data changes
  function startObservingRouteData() {
    if (observerActive) return;

    // Watch for changes in the stats container specifically
    const observer = new MutationObserver((mutations) => {
      // Only update if mutations are relevant (contain stat-related changes)
      const isRelevant = mutations.some(mutation => {
        const target = mutation.target;
        if (target.nodeType === Node.ELEMENT_NODE) {
          const className = target.className || '';
          return className.includes('Stat') ||
                 className.includes('RouteOverview') ||
                 className.includes('Stats');
        }
        // Text content changes in stat values
        if (mutation.type === 'characterData') {
          const parent = target.parentElement;
          return parent && parent.className && parent.className.includes('Stat');
        }
        return false;
      });

      if (isRelevant) {
        debouncedUpdate();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    observerActive = true;

    // Initial extraction - wait for Strava to fully render
    setTimeout(() => {
      const data = extractRouteData();
      updateSidebarData(data);
    }, 1000);

    // Backup: re-check every 2 seconds in case we missed updates
    setInterval(() => {
      const data = extractRouteData();
      updateSidebarData(data);
    }, 2000);
  }

  // Load saved races from Chrome storage
  function loadSavedRaces() {
    chrome.storage.local.get(['races', 'lastUsedRaceId', 'raceOrder'], function(result) {
      const races = result.races || [];
      const lastUsedRaceId = result.lastUsedRaceId;
      const raceOrder = result.raceOrder || [];
      const select = document.getElementById('src-race-select');
      const noRacesEl = document.getElementById('src-no-races');
      const selectorContainer = document.getElementById('src-race-selector-container');
      const raceCountEl = document.getElementById('src-race-count');

      // Show/hide empty state vs selector
      if (races.length === 0) {
        noRacesEl.classList.remove('src-hidden');
        selectorContainer.classList.add('src-hidden');
        raceCountEl.classList.add('src-hidden');
        return;
      }

      noRacesEl.classList.add('src-hidden');
      selectorContainer.classList.remove('src-hidden');

      // Show race count and warning if approaching limit
      if (races.length >= STORAGE_WARNING_THRESHOLD) {
        raceCountEl.classList.remove('src-hidden');
        raceCountEl.innerHTML = `<span class="src-warning">${races.length}/${MAX_RACES} races saved</span>`;
      } else {
        raceCountEl.classList.add('src-hidden');
      }

      // Clear existing options
      select.innerHTML = '<option value="">Select a race...</option>';

      // Sort races by custom order, then alphabetically for any not in order
      const sortedRaces = [...races].sort((a, b) => {
        const aIndex = raceOrder.indexOf(a.id);
        const bIndex = raceOrder.indexOf(b.id);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      sortedRaces.forEach(race => {
        const option = document.createElement('option');
        option.value = race.id;
        // Just the race name - stats are shown in comparison section
        option.textContent = race.name;
        select.appendChild(option);
      });

      // Restore last used race selection
      if (lastUsedRaceId && races.some(r => r.id === lastUsedRaceId)) {
        select.value = lastUsedRaceId;
        // Trigger comparison display
        showComparison(lastUsedRaceId);
      }
    });
  }

  // Save current route as a race
  function saveCurrentRoute() {
    clearFieldError('src-save-error');
    const nameInput = document.getElementById('src-race-name');
    let name = nameInput.value.trim();

    // If no name provided, try to use the placeholder (route title)
    if (!name && nameInput.placeholder && nameInput.placeholder !== 'Race name') {
      name = nameInput.placeholder;
    }

    if (!name) {
      showFieldError('src-save-error', 'Please enter a race name');
      nameInput.focus();
      return;
    }

    // Check for route data
    const distance = currentRouteData.distance;
    const elevationGain = currentRouteData.elevationGain;
    const elevationLoss = currentRouteData.elevationLoss;

    if (distance === null || elevationGain === null) {
      showFieldError('src-save-error', 'Draw a route first');
      return;
    }

    const race = {
      id: Date.now().toString(),
      name: name,
      distance: Math.round(distance * 10) / 10,
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss || 0),
      createdAt: new Date().toISOString()
    };

    chrome.storage.local.get(['races'], function(result) {
      const races = result.races || [];

      // Check storage limit
      if (races.length >= MAX_RACES) {
        showFieldError('src-save-error', `Maximum ${MAX_RACES} races allowed. Delete some first.`);
        return;
      }

      // Check for duplicate name
      if (races.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        if (!confirm(`A race named "${name}" already exists. Save anyway?`)) {
          return;
        }
      }

      races.push(race);
      chrome.storage.local.set({ races: races }, function() {
        if (chrome.runtime.lastError) {
          logError('Storage error', chrome.runtime.lastError);
          showFieldError('src-save-error', 'Failed to save. Try again.');
          return;
        }

        nameInput.value = '';
        nameInput.placeholder = 'Race name';
        loadSavedRaces();
        document.getElementById('src-race-select').value = race.id;
        saveLastUsedRace(race.id);
        showComparison(race.id);
        showToast(`"${name}" saved`, 'success');
        log(`Race saved: ${name}`);
      });
    });
  }

  // Save manually entered race
  function saveManualRace() {
    clearFieldError('src-manual-error');

    const nameInput = document.getElementById('src-manual-name');
    const distanceInput = document.getElementById('src-manual-distance');
    const gainInput = document.getElementById('src-manual-gain');
    const lossInput = document.getElementById('src-manual-loss');

    const name = nameInput.value.trim();
    const distance = parseFloat(distanceInput.value);
    const elevationGain = parseFloat(gainInput.value);
    const elevationLoss = parseFloat(lossInput.value) || 0;

    // Validation
    const errors = [];

    if (!name) {
      errors.push('Race name is required');
    }

    if (isNaN(distance) || distance <= 0) {
      errors.push('Enter a valid distance (> 0)');
    }

    if (isNaN(elevationGain) || elevationGain < 0) {
      errors.push('Enter a valid elevation gain (>= 0)');
    }

    if (lossInput.value && (isNaN(elevationLoss) || elevationLoss < 0)) {
      errors.push('Enter a valid elevation loss (>= 0)');
    }

    if (errors.length > 0) {
      showFieldError('src-manual-error', errors[0]);
      if (!name) nameInput.focus();
      else if (isNaN(distance) || distance <= 0) distanceInput.focus();
      else if (isNaN(elevationGain) || elevationGain < 0) gainInput.focus();
      return;
    }

    const race = {
      id: Date.now().toString(),
      name: name,
      distance: Math.round(distance * 10) / 10,
      elevationGain: Math.round(elevationGain),
      elevationLoss: Math.round(elevationLoss),
      createdAt: new Date().toISOString(),
      manual: true
    };

    chrome.storage.local.get(['races'], function(result) {
      const races = result.races || [];

      // Check storage limit
      if (races.length >= MAX_RACES) {
        showFieldError('src-manual-error', `Maximum ${MAX_RACES} races allowed. Delete some first.`);
        return;
      }

      // Check for duplicate name
      if (races.some(r => r.name.toLowerCase() === name.toLowerCase())) {
        if (!confirm(`A race named "${name}" already exists. Save anyway?`)) {
          return;
        }
      }

      races.push(race);
      chrome.storage.local.set({ races: races }, function() {
        if (chrome.runtime.lastError) {
          logError('Storage error', chrome.runtime.lastError);
          showFieldError('src-manual-error', 'Failed to save. Try again.');
          return;
        }

        // Clear form
        nameInput.value = '';
        distanceInput.value = '';
        gainInput.value = '';
        lossInput.value = '';

        // Hide manual form
        document.getElementById('src-manual-form').classList.add('src-hidden');
        document.getElementById('src-toggle-manual').textContent = 'Show';

        loadSavedRaces();

        document.getElementById('src-race-select').value = race.id;
        saveLastUsedRace(race.id);
        showComparison(race.id);
        showToast(`"${name}" added`, 'success');
        log(`Manual race added: ${name}`);
      });
    });
  }

  // Delete selected race
  function deleteSelectedRace() {
    const select = document.getElementById('src-race-select');
    const raceId = select.value;

    if (!raceId) {
      showToast('Select a race first', 'error');
      return;
    }

    // Extract just the race name from the formatted option text
    const optionText = select.options[select.selectedIndex].text;
    const raceName = optionText.split(' (')[0];

    if (!confirm(`Delete "${raceName}"?`)) {
      return;
    }

    chrome.storage.local.get(['races', 'lastUsedRaceId'], function(result) {
      const races = result.races || [];
      const updatedRaces = races.filter(r => r.id !== raceId);

      const updates = { races: updatedRaces };

      // Clear last used if it was the deleted race
      if (result.lastUsedRaceId === raceId) {
        updates.lastUsedRaceId = null;
      }

      chrome.storage.local.set(updates, function() {
        if (chrome.runtime.lastError) {
          logError('Storage error', chrome.runtime.lastError);
          showToast('Failed to delete', 'error');
          return;
        }

        loadSavedRaces();
        hideComparison();
        showToast(`"${raceName}" deleted`, 'success');
        log(`Race deleted: ${raceName}`);
      });
    });
  }

  // Show comparison between current route and selected race
  function showComparison(raceId) {
    chrome.storage.local.get(['races'], function(result) {
      const races = result.races || [];
      const race = races.find(r => r.id === raceId);

      if (!race) return;

      const comparisonSection = document.getElementById('src-comparison');
      const resultsDiv = document.getElementById('src-comparison-results');

      // Show target race info
      resultsDiv.innerHTML = `
        <div class="src-target-race">
          <div class="src-target-header">${race.name}</div>
          <div class="src-target-stats">
            <div class="src-target-stat">
              <span class="src-target-label">Distance</span>
              <span class="src-target-value">${race.distance.toFixed(1)} km</span>
            </div>
            <div class="src-target-stat">
              <span class="src-target-label">Elevation Gain</span>
              <span class="src-target-value">${Math.round(race.elevationGain)} m</span>
            </div>
            <div class="src-target-stat">
              <span class="src-target-label">Elevation Loss</span>
              <span class="src-target-value">${Math.round(race.elevationLoss)} m</span>
            </div>
            <div class="src-target-stat">
              <span class="src-target-label">Gain per km</span>
              <span class="src-target-value">${Math.round(race.elevationGain / race.distance)} m/km</span>
            </div>
          </div>
        </div>
      `;

      comparisonSection.classList.remove('src-hidden');

      // Update equivalent elevation display
      updateEquivalentElevation();
    });
  }

  // Hide comparison section
  function hideComparison() {
    document.getElementById('src-comparison').classList.add('src-hidden');
    document.getElementById('src-race-select').value = '';
    // Clear equivalent elevation display
    const gainEkvEl = document.getElementById('src-elevation-gain-ekv');
    const lossEkvEl = document.getElementById('src-elevation-loss-ekv');
    if (gainEkvEl) gainEkvEl.textContent = '';
    if (lossEkvEl) lossEkvEl.textContent = '';
  }

  // Watch for activity type changes in Strava's route type dropdown
  function watchActivityType() {
    // The route type dropdown has id="routeType"
    // The selected value is in .css-138op6-singleValue or similar
    let lastActivityType = null;
    let userManuallyClosed = false;

    function checkActivityType() {
      const routeTypeEl = document.getElementById('routeType');
      if (!routeTypeEl) return;

      // Find the selected value text
      const valueEl = routeTypeEl.querySelector('[class*="singleValue"]');
      if (!valueEl) return;

      const activityType = valueEl.textContent.trim().toLowerCase();

      // Only act if activity type changed
      if (activityType === lastActivityType) return;

      const wasValidBefore = lastActivityType && (lastActivityType.includes('trail run') || lastActivityType === 'run');
      const isValidNow = activityType.includes('trail run') || activityType === 'run';

      lastActivityType = activityType;

      if (isValidNow && !wasValidBefore) {
        // Switched TO run/trail run - auto-open sidebar (unless user manually closed it)
        if (sidebar && sidebar.classList.contains('src-sidebar-hidden')) {
          // Check if user manually closed it this session
          chrome.storage.local.get(['sidebarManualClose'], function(result) {
            if (!result.sidebarManualClose) {
              openSidebar();
              log(`Auto-opened sidebar for ${activityType}`);
            }
          });
        }
      } else if (!isValidNow && wasValidBefore) {
        // Switched AWAY from run/trail run - auto-close sidebar
        if (sidebar && !sidebar.classList.contains('src-sidebar-hidden')) {
          closeSidebar();
          // Reset manual close flag since we auto-closed
          chrome.storage.local.set({ sidebarManualClose: false });
          log(`Auto-closed sidebar for ${activityType}`);
        }
      }
    }

    // Watch for changes in the routeType dropdown
    const observer = new MutationObserver(() => {
      checkActivityType();
    });

    // Start observing once the dropdown exists
    function startObserving() {
      const routeTypeEl = document.getElementById('routeType');
      if (routeTypeEl) {
        observer.observe(routeTypeEl, {
          childList: true,
          subtree: true,
          characterData: true
        });
        // Initial check
        checkActivityType();
        log('Activity type watcher started');
      } else {
        // Retry if not found yet
        setTimeout(startObserving, 500);
      }
    }

    startObserving();
  }

  // Initialize extension
  function init() {
    if (isRouteBuilderPage()) {
      // Wait for Strava's page to fully load
      setTimeout(() => {
        createSidebar();
        watchActivityType();
      }, 1500);
    }
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Handle navigation changes (Strava uses client-side routing)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (isRouteBuilderPage()) {
        setTimeout(createSidebar, 1500);
      } else if (sidebar) {
        sidebar.remove();
        sidebar = null;
        observerActive = false;
      }
    }
  }).observe(document, { subtree: true, childList: true });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'openSidebar') {
      if (sidebar) {
        openSidebar();
        sendResponse({ success: true });
      } else {
        // Sidebar doesn't exist yet, create it
        createSidebar();
        sendResponse({ success: true });
      }
    } else if (message.action === 'checkPage') {
      sendResponse({ isRouteBuilder: isRouteBuilderPage() });
    }
    return true; // Keep channel open for async response
  });

})();
