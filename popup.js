// Strava Route Comparison Extension - Popup Script

document.addEventListener('DOMContentLoaded', function() {
  loadRaces();
  setupRouteBuilderButton();
});

function setupRouteBuilderButton() {
  const routeBuilderLink = document.querySelector('.footer a');
  if (!routeBuilderLink) return;

  routeBuilderLink.addEventListener('click', function(e) {
    e.preventDefault();

    // Check if we're already on the route builder page
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const currentTab = tabs[0];
      const isOnRouteBuilder = currentTab.url && currentTab.url.includes('strava.com/maps/create');

      if (isOnRouteBuilder) {
        // Send message to open sidebar
        chrome.tabs.sendMessage(currentTab.id, { action: 'openSidebar' }, function(response) {
          // Close popup after opening sidebar
          window.close();
        });
      } else {
        // Navigate to route builder
        chrome.tabs.create({ url: 'https://www.strava.com/maps/create' });
      }
    });
  });
}

function loadRaces() {
  chrome.storage.local.get(['races', 'raceOrder'], function(result) {
    const races = result.races || [];
    const raceOrder = result.raceOrder || [];
    const raceList = document.getElementById('race-list');

    if (races.length === 0) {
      raceList.innerHTML = `
        <div class="empty-state">
          <p>No races saved yet</p>
        </div>
      `;
      return;
    }

    // Sort races by custom order, then alphabetically for any not in order
    const sortedRaces = [...races].sort((a, b) => {
      const aIndex = raceOrder.indexOf(a.id);
      const bIndex = raceOrder.indexOf(b.id);

      // Both have custom order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      // Only a has custom order
      if (aIndex !== -1) return -1;
      // Only b has custom order
      if (bIndex !== -1) return 1;
      // Neither has custom order - sort alphabetically
      return a.name.localeCompare(b.name);
    });

    raceList.innerHTML = sortedRaces.map((race, index) => `
      <div class="race-item" data-id="${race.id}">
        <div class="race-info">
          <div class="race-name">${escapeHtml(race.name)}</div>
          <div class="race-stats">
            ${race.distance.toFixed(1)} km | +${Math.round(race.elevationGain)} m | -${Math.round(race.elevationLoss || 0)} m
          </div>
        </div>
        <div class="race-actions">
          <button class="race-move race-move-up" data-id="${race.id}" data-index="${index}" title="Move up" ${index === 0 ? 'disabled' : ''}>
            ↑
          </button>
          <button class="race-move race-move-down" data-id="${race.id}" data-index="${index}" title="Move down" ${index === sortedRaces.length - 1 ? 'disabled' : ''}>
            ↓
          </button>
          <button class="race-delete" data-id="${race.id}" title="Delete race">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.race-delete').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const raceId = this.getAttribute('data-id');
        deleteRace(raceId);
      });
    });

    document.querySelectorAll('.race-move-up').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const raceId = this.getAttribute('data-id');
        const index = parseInt(this.getAttribute('data-index'));
        moveRace(raceId, index, -1, sortedRaces);
      });
    });

    document.querySelectorAll('.race-move-down').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const raceId = this.getAttribute('data-id');
        const index = parseInt(this.getAttribute('data-index'));
        moveRace(raceId, index, 1, sortedRaces);
      });
    });
  });
}

function moveRace(raceId, currentIndex, direction, sortedRaces) {
  const newIndex = currentIndex + direction;
  if (newIndex < 0 || newIndex >= sortedRaces.length) return;

  // Create new order array from current sorted order
  const newOrder = sortedRaces.map(r => r.id);

  // Swap positions
  [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

  // Save new order
  chrome.storage.local.set({ raceOrder: newOrder }, function() {
    loadRaces();
  });
}

function deleteRace(raceId) {
  chrome.storage.local.get(['races', 'raceOrder'], function(result) {
    const races = result.races || [];
    const raceOrder = result.raceOrder || [];
    const race = races.find(r => r.id === raceId);

    if (!race) return;

    if (confirm(`Delete "${race.name}"?`)) {
      const updatedRaces = races.filter(r => r.id !== raceId);
      const updatedOrder = raceOrder.filter(id => id !== raceId);
      chrome.storage.local.set({ races: updatedRaces, raceOrder: updatedOrder }, function() {
        loadRaces();
      });
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
