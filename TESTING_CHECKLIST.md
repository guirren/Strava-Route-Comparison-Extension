# Testing Checklist

Quick reference for testing the Strava Route Comparison extension.

**Test URL:** https://www.strava.com/maps/create

---

## Pre-Test Setup

- [ ] Extension loaded in Chrome (`chrome://extensions`)
- [ ] Developer mode enabled
- [ ] No error badges on extension card
- [ ] Logged into Strava

---

## Core Functionality

### 1. Extension Loading
| Test | Expected | Pass |
|------|----------|------|
| Navigate to `/maps/create` | Sidebar appears on right | ☐ |
| Sidebar header visible | Shows "Route Comparison" in orange | ☐ |
| Status badge | Shows activity type detection | ☐ |

### 2. Activity Type Detection
| Test | Expected | Pass |
|------|----------|------|
| Set activity to "Trail Run" | Green badge, main content visible | ☐ |
| Set activity to "Run" | Green badge, main content visible | ☐ |
| Set activity to "Ride" | Warning message shown | ☐ |

### 3. Route Data Extraction
| Test | Expected | Pass |
|------|----------|------|
| No route drawn | "Draw a route" message shown | ☐ |
| Draw simple route | Distance displays correctly | ☐ |
| Route with elevation | Gain/Loss display in meters | ☐ |
| Save button state | Disabled until route exists | ☐ |

### 4. Real-time Updates
| Test | Expected | Pass |
|------|----------|------|
| Add waypoint | Values update within 2s | ☐ |
| Drag waypoint | Values update within 2s | ☐ |
| Delete waypoint | Values update within 2s | ☐ |

### 5. Save Race
| Test | Expected | Pass |
|------|----------|------|
| Save with name | Toast: "saved", appears in dropdown | ☐ |
| Save without name | Error message shown | ☐ |
| Duplicate name | Confirmation dialog | ☐ |
| Save at limit (50) | Error message shown | ☐ |

### 6. Race Dropdown
| Test | Expected | Pass |
|------|----------|------|
| No races saved | "No races saved" message | ☐ |
| Races exist | Dropdown with formatted names | ☐ |
| Format correct | "Name (XX.Xkm, +XXXXm)" | ☐ |
| Alphabetical sort | Races sorted A-Z | ☐ |

### 7. Session Persistence
| Test | Expected | Pass |
|------|----------|------|
| Select race, refresh | Same race selected | ☐ |
| Close/reopen tab | Races still saved | ☐ |

### 8. Equivalent Elevation
| Test | Expected | Pass |
|------|----------|------|
| Race selected | "(ekv: Xm, +Y%)" appears | ☐ |
| Math is correct | ekv = (race_elev/race_dist) * route_dist | ☐ |
| Updates with route | Recalculates on route change | ☐ |

### 9. Color Coding
| Test | Expected | Pass |
|------|----------|------|
| Within ±10% | Green badge | ☐ |
| 10-20% off | Yellow badge | ☐ |
| >20% off | Red badge | ☐ |

### 10. Delete Race
| Test | Expected | Pass |
|------|----------|------|
| No race selected | "Select a race first" toast | ☐ |
| Click delete | Confirmation dialog | ☐ |
| Confirm delete | Toast: "deleted", removed from dropdown | ☐ |
| Cancel delete | Race remains | ☐ |

### 11. Manual Race Entry
| Test | Expected | Pass |
|------|----------|------|
| Toggle form | Show/Hide works | ☐ |
| Empty name | Validation error | ☐ |
| Invalid distance (0) | Validation error | ☐ |
| Negative elevation | Validation error | ☐ |
| Valid entry | Saved, appears in dropdown | ☐ |

### 12. Layout Integration
| Test | Expected | Pass |
|------|----------|------|
| Map still usable | Can draw routes | ☐ |
| Bottom bar visible | Strava stats visible | ☐ |
| No overlap | Sidebar doesn't cover map controls | ☐ |
| Sidebar toggle | Collapse/expand works | ☐ |

### 13. Edit Existing Route
| Test | Expected | Pass |
|------|----------|------|
| Open saved route | Sidebar appears | ☐ |
| Data extracts | Shows route stats | ☐ |
| Modifications work | Updates in real-time | ☐ |

---

## Error Handling

| Scenario | Expected Behavior | Pass |
|----------|-------------------|------|
| Storage full | Clear error message | ☐ |
| Strava UI not loaded | Graceful wait/retry | ☐ |
| Invalid form input | Inline error, field focus | ☐ |
| Chrome storage error | Toast error message | ☐ |

---

## Console Checks

Open DevTools (Cmd+Option+J) and verify:

- [ ] No red errors on page load
- [ ] `[Strava Route Comparison] Found X stat items` appears
- [ ] Data extraction logs show correct values
- [ ] Save/delete operations logged

---

## Test Results

| Category | Tests Passed | Total |
|----------|-------------|-------|
| Loading | /3 | 3 |
| Activity Type | /3 | 3 |
| Data Extraction | /4 | 4 |
| Real-time | /3 | 3 |
| Save Race | /4 | 4 |
| Dropdown | /4 | 4 |
| Persistence | /2 | 2 |
| Equivalent Elev | /3 | 3 |
| Color Coding | /3 | 3 |
| Delete | /4 | 4 |
| Manual Entry | /5 | 5 |
| Layout | /4 | 4 |
| Edit Route | /3 | 3 |
| **TOTAL** | **/45** | **45** |

---

## Quick Commands

**Reload extension:**
```
chrome://extensions → Click ↻ on extension card
```

**View storage:**
```javascript
// In console
chrome.storage.local.get(null, r => console.log(r));
```

**Clear all data:**
```javascript
// In console (careful!)
chrome.storage.local.clear();
```

**Filter console logs:**
```
[Strava Route Comparison]
```
