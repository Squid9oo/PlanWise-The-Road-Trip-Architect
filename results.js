// PlanWise — Results Page Logic (Session 8)
// Reads URL params → calls Places API → renders real cards → wires filter chips

// ==========================================
// 1. READ URL PARAMS
// ==========================================
const params     = new URLSearchParams(window.location.search);
const from       = params.get('from')       || 'Your Start';
const to         = params.get('to')         || 'Your Destination';
const dateFrom   = params.get('dateFrom')   || '';
const dateTo     = params.get('dateTo')     || '';
const transport  = params.get('transport')  || 'car';
const fromLat    = parseFloat(params.get('fromLat'));
const fromLng    = parseFloat(params.get('fromLng'));
const toLat      = parseFloat(params.get('toLat'));
const toLng      = parseFloat(params.get('toLng'));
const activities = params.get('activities')
                    ? params.get('activities').split(',').filter(Boolean)
                    : [];
const searchRadius = parseInt(params.get('radius'), 10) || 50000;

// ==========================================
// 2. POPULATE TRIP SUMMARY BAR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // Cities
    document.getElementById('result-from').textContent = from;
    document.getElementById('result-to').textContent   = to;

    // Page title
    document.title = `${from} → ${to} · PlanWise Malaysia`;

    // Build meta badges
    const metaContainer = document.getElementById('trip-meta');

    if (dateFrom && dateTo) {
        const dFrom    = new Date(dateFrom);
        const dTo      = new Date(dateTo);
        const options  = { day: 'numeric', month: 'short' };
        const fromStr  = dFrom.toLocaleDateString('en-MY', options);
        const toStr    = dTo.toLocaleDateString('en-MY', options);
        const diffDays = Math.round((dTo - dFrom) / (1000 * 60 * 60 * 24));
        const nightLabel = diffDays === 0
            ? '1-day trip'
            : `${diffDays} night${diffDays > 1 ? 's' : ''}`;

        metaContainer.innerHTML += `
            <span class="trip-badge">📅 ${fromStr} – ${toStr}</span>
            <span class="trip-badge highlight">${nightLabel}</span>
        `;
    }

    const transportMap = {
        car:        '🚗 Car',
        motorcycle: '🏍️ Motorcycle',
        public:     '🚌 Public Transport',
    };
    metaContainer.innerHTML += `<span class="trip-badge">${transportMap[transport] || '🚗 Car'}</span>`;

    const activityMap = {
        food:      '🍜 Food & Drink',
        nature:    '🌳 Nature',
        beach:     '🏖️ Beach',
        heritage:  '🏛️ Heritage',
        family:    '🎠 Family',
        nightlife: '🌆 Nightlife',
        wellness:  '🧘 Wellness',
        shopping:  '🛍️ Shopping',
    };
    activities.forEach(act => {
        if (activityMap[act]) {
            metaContainer.innerHTML += `<span class="trip-badge">${activityMap[act]}</span>`;
        }
    });

});

// ==========================================
// 3. MAIN SEARCH — called by initMap() in app.js
// ==========================================

// Place types — shared by all search points
const PLACE_TYPES = [
    'tourist_attraction', 'park', 'museum', 'zoo',
    'amusement_park', 'shopping_mall', 'restaurant', 'spa', 'night_club',
    'cafe', 'bakery', 'bar', 'art_gallery', 'aquarium',
];

// --- Pagination + Shuffle State ---
let allPlaces      = [];  // Full shuffled/interleaved array (never changes after load)
let filteredPlaces = [];  // Subset based on active category filter
let loadedCount    = 0;   // How many from filteredPlaces are rendered
const BATCH_SIZE   = 12;  // Cards per page

// --- Fisher-Yates Shuffle (randomises array in place) ---
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// --- Category Interleave ---
// Groups places by PlanWise category, shuffles within each group,
// then round-robins so the feed alternates: food → nature → heritage → family …
function interleaveByCategory(places) {
    const groups = {};
    places.forEach(place => {
        const tag = getTagInfo(place.types || []).tag;
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(place);
    });

    // Shuffle within each category group
    Object.values(groups).forEach(arr => shuffleArray(arr));

    // Shuffle the category order too so it's not always the same sequence
    const keys = Object.keys(groups);
    shuffleArray(keys);

    // Round-robin: pick one from each category in turn
    const result   = [];
    const pointers = {};
    keys.forEach(k => { pointers[k] = 0; });
    let exhausted = 0;

    while (exhausted < keys.length) {
        for (const key of keys) {
            if (pointers[key] < groups[key].length) {
                result.push(groups[key][pointers[key]]);
                pointers[key]++;
                if (pointers[key] >= groups[key].length) exhausted++;
            }
        }
    }
    return result;
}

// Search at one or more lat/lng points, combine + quality-filter, then call onComplete
function runPlacesSearch(locations, service, onComplete) {
    const total = locations.length * PLACE_TYPES.length;
    let completed = 0;
    // Keep results separated by location instead of one giant pool
    let locationResults = locations.map(() => []);

    locations.forEach((location, locIndex) => {
        PLACE_TYPES.forEach(type => {
            service.nearbySearch({ location, radius: searchRadius, type }, (results, status) => {
                completed++;
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    locationResults[locIndex] = locationResults[locIndex].concat(results);
                }
                if (completed === total) {
                    let finalUnique = [];
                    const seen = new Set();

                    // Deduplicate, quality-filter, cap at 60
                    locationResults.forEach(locArray => {
                    const uniqueLoc = locArray
                        .filter(p => { if (seen.has(p.place_id)) return false; seen.add(p.place_id); return true; })
                        .filter(p => p.rating >= 4.0 && p.user_ratings_total >= 50);
                    finalUnique = finalUnique.concat(uniqueLoc);
                });

                    // Sort by rating, then cap — Load More handles pagination
                    finalUnique.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                    finalUnique = finalUnique.slice(0, 60);

                    onComplete(finalUnique);
                }
            });
        });
    });
}

// Render cards + show grid after places search completes
function renderResults(unique) {
    const loadingEl  = document.getElementById('results-loading');
    const filterRow  = document.getElementById('results-filter-row');
    const countEl    = document.getElementById('results-count');
    const grid       = document.getElementById('results-grid');
    const emptyState = document.getElementById('empty-state');

    loadingEl.style.display = 'none';
    if (unique.length === 0) { emptyState.style.display = 'block'; return; }

    // Shuffle or interleave depending on whether user picked activities
    if (activities.length === 0) {
        allPlaces = interleaveByCategory(unique);
    } else {
        allPlaces = unique.slice();
        shuffleArray(allPlaces);
    }
    filteredPlaces = allPlaces.slice();
    loadedCount = 0;

    // Render first batch only — Load More handles the rest
    const firstBatch = filteredPlaces.slice(0, BATCH_SIZE);
    firstBatch.forEach((place, i) => {
        const card = buildPlaceCard(place, i);
        if (place.geometry?.location) {
            card.dataset.lat = place.geometry.location.lat();
            card.dataset.lng = place.geometry.location.lng();
        }
        grid.appendChild(card);
    });
    loadedCount = firstBatch.length;

    grid.style.display      = '';
    filterRow.style.display = 'flex';
    countEl.style.display   = 'block';
    countEl.innerHTML       = `Showing <strong>${firstBatch.length} gems</strong> near ${to}`;

    // Show map toggle button now that we have results
    const mapToggleBtn = document.getElementById('btn-map-toggle');
    if (mapToggleBtn) mapToggleBtn.style.display = 'flex';

    // Show search tip if Places results are low
    const tipEl = document.getElementById('results-tip');
    if (tipEl) {
        tipEl.style.display = allPlaces.length < 20 ? 'flex' : 'none';
    }

    updateLoadMoreButton();
    wireFilterChips();
    loadResultsGems();
}

// ==========================================
// LOAD MORE — Append next batch of Places cards
// ==========================================
function loadMoreResults() {
    const grid    = document.getElementById('results-grid');
    const countEl = document.getElementById('results-count');
    const batch   = filteredPlaces.slice(loadedCount, loadedCount + BATCH_SIZE);

    // Places append after gems (gems-first order)
    batch.forEach((place, i) => {
        const card = buildPlaceCard(place, loadedCount + i);
        if (place.geometry?.location) {
            card.dataset.lat = place.geometry.location.lat();
            card.dataset.lng = place.geometry.location.lng();
        }
        grid.appendChild(card);
    });

    loadedCount += batch.length;
    updateLoadMoreButton();

    // Count all visible cards (Places + gems)
    let visibleCount = 0;
    grid.querySelectorAll('.feed-card, .gem-card').forEach(card => {
        if (card.style.display !== 'none') visibleCount++;
    });
    if (countEl) countEl.innerHTML = `Showing <strong>${visibleCount} gems</strong> near ${to}`;
}

function updateLoadMoreButton() {
    const btn = document.getElementById('btn-load-more');
    if (!btn) return;
    if (loadedCount >= filteredPlaces.length) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
        const remaining = filteredPlaces.length - loadedCount;
        btn.textContent = `Load More Gems (${remaining} remaining) ✦`;
    }
}

window.initResultsSearch = function () {
    const loadingEl  = document.getElementById('results-loading');
    const errorEl    = document.getElementById('results-error');
    const grid       = document.getElementById('results-grid');
    const emptyState = document.getElementById('empty-state');

    if (isNaN(toLat) || isNaN(toLng)) {
        loadingEl.style.display = 'none';
        errorEl.style.display   = 'block';
        return;
    }

    grid.innerHTML           = '';
    grid.style.display       = 'none';
    loadingEl.style.display  = 'flex';
    emptyState.style.display = 'none';

    const mapEl   = document.getElementById('hidden-map');
    const map     = new google.maps.Map(mapEl, { center: { lat: toLat, lng: toLng }, zoom: 12 });
    const service = new google.maps.places.PlacesService(map);
    const dest    = { lat: toLat, lng: toLng };
    
    // PIVOT: Destination-Only search. 
    // We removed the Directions API route math to improve UX and save API quota.
    window.activeSearchPoints = [dest]; 
    
    runPlacesSearch([dest], service, renderResults);

};

// ==========================================
// 4. FILTER CHIPS
// activeFilter persists so gem cards (added later) are filtered correctly too.
// When user selected activities on home page, cards are pre-filtered by those
// activities even when no single chip matches (multi-activity case).
// ==========================================
let activeFilter = 'all';

// homepageActivities drives the initial card-level filter separate from chip UI
let homepageActivities = activities.length > 0 ? activities : null;

function applyFilter(filterValue) {
    const chips      = document.querySelectorAll('.results-filter-row .chip');
    const grid       = document.getElementById('results-grid');
    const countEl    = document.getElementById('results-count');
    const emptyState = document.getElementById('empty-state');

    homepageActivities = null;
    activeFilter = filterValue;

    // Update chip selected state — only reset all chips when "All" is clicked
    // For single-category, wireFilterChips() already toggled the chip visually
    if (filterValue === 'all') {
        chips.forEach(c => c.classList.remove('selected'));
        const allChip = document.querySelector('.results-filter-row .chip[data-filter="all"]');
        if (allChip) allChip.classList.add('selected');
    }

    // Update URL so refresh preserves the active filter
    const url = new URL(window.location);
    if (filterValue === 'all') {
        url.searchParams.delete('activities');
    } else {
        url.searchParams.set('activities', filterValue);
    }
    history.replaceState({}, '', url);

    // Re-filter the full Places array by category
    if (filterValue === 'all') {
        filteredPlaces = allPlaces.slice();
    } else {
        filteredPlaces = allPlaces.filter(place => {
            const tag = getTagInfo(place.types || []).tag;
            return tag === filterValue;
        });
    }

    // Remove all Places cards from grid, re-render after gems (gems-first order)
    grid.querySelectorAll('.feed-card').forEach(card => card.remove());
    loadedCount = 0;

    const batch = filteredPlaces.slice(0, BATCH_SIZE);
    batch.forEach((place, i) => {
        const card = buildPlaceCard(place, i);
        if (place.geometry?.location) {
            card.dataset.lat = place.geometry.location.lat();
            card.dataset.lng = place.geometry.location.lng();
        }
        grid.appendChild(card);
    });
    loadedCount = batch.length;

    // Show/hide community gem cards based on filter
    grid.querySelectorAll('.gem-card').forEach(card => {
        const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
        const match = filterValue === 'all' || cats.includes(filterValue);
        card.style.display = match ? '' : 'none';
    });

    // Count all visible cards
    let visibleCount = 0;
    grid.querySelectorAll('.feed-card, .gem-card').forEach(card => {
        if (card.style.display !== 'none') visibleCount++;
    });

    updateLoadMoreButton();
    if (countEl) countEl.innerHTML = `Showing <strong>${visibleCount} gems</strong> near ${to}`;
    if (emptyState) emptyState.style.display = visibleCount === 0 ? 'block' : 'none';

    // If map is currently visible, redraw the pins to match new filter
    if (document.body.classList.contains('map-view-active') && typeof renderResultsMap === 'function') {
        renderResultsMap();
    }
}

// Called when 2+ activities are passed from home page via URL
function applyMultiFilter(activityList) {
    const grid       = document.getElementById('results-grid');
    const countEl    = document.getElementById('results-count');
    const emptyState = document.getElementById('empty-state');

    activeFilter = 'multi';

    // Visually select matching chips
    document.querySelectorAll('.results-filter-row .chip').forEach(c => {
        if (activityList.includes(c.dataset.filter)) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });

    // Update URL so refresh preserves multi-filter
    const url = new URL(window.location);
    url.searchParams.set('activities', activityList.join(','));
    history.replaceState({}, '', url);

    // Re-filter full Places array by any matching category
    filteredPlaces = allPlaces.filter(place => {
        const tag = getTagInfo(place.types || []).tag;
        return activityList.includes(tag);
    });

    // Remove all Places cards, re-render after gems (gems-first order)
    grid.querySelectorAll('.feed-card').forEach(card => card.remove());
    loadedCount = 0;

    const batch = filteredPlaces.slice(0, BATCH_SIZE);
    batch.forEach((place, i) => {
        const card = buildPlaceCard(place, i);
        if (place.geometry?.location) {
            card.dataset.lat = place.geometry.location.lat();
            card.dataset.lng = place.geometry.location.lng();
        }
        grid.appendChild(card);
    });
    loadedCount = batch.length;

    // Show/hide community gem cards
    grid.querySelectorAll('.gem-card').forEach(card => {
        const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
        const match = activityList.some(act => cats.includes(act));
        card.style.display = match ? '' : 'none';
    });

    let visibleCount = 0;
    grid.querySelectorAll('.feed-card, .gem-card').forEach(card => {
        if (card.style.display !== 'none') visibleCount++;
    });

    updateLoadMoreButton();
    if (countEl)    countEl.innerHTML        = `Showing <strong>${visibleCount} gems</strong> near ${to}`;
    if (emptyState) emptyState.style.display = visibleCount === 0 ? 'block' : 'none';

    // If map is currently visible, redraw the pins to match new filter
    if (document.body.classList.contains('map-view-active') && typeof renderResultsMap === 'function') {
        renderResultsMap();
    }
}

function wireFilterChips() {
    const chips = document.querySelectorAll('.results-filter-row .chip');

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const value = chip.dataset.filter;

            if (value === 'all') {
                // "All" resets everything
                applyFilter('all');
                return;
            }

            // Toggle this chip on/off explicitly
            const isActive = chip.classList.contains('selected');
            if (isActive) {
                chip.classList.remove('selected');
            } else {
                chip.classList.add('selected');
            }

            // Deselect "All" chip whenever any category is active
            const allChip = document.querySelector('.results-filter-row .chip[data-filter="all"]');
            if (allChip) allChip.classList.remove('selected');

            // Collect all currently selected category chips
            const selected = [...document.querySelectorAll('.results-filter-row .chip.selected')]
                .map(c => c.dataset.filter)
                .filter(f => f !== 'all');

            if (selected.length === 0) {
                // Nothing selected → go back to All
                applyFilter('all');
            } else if (selected.length === 1) {
                applyFilter(selected[0]);
            } else {
                applyMultiFilter(selected);
            }
        });
    });

    // Auto-apply URL activities on first load
    if (activities.length === 1) {
        setTimeout(() => applyFilter(activities[0]), 0);
    }
    if (activities.length > 1) {
        setTimeout(() => applyMultiFilter(activities), 0);
    }
}

// ==========================================
// 5. COMMUNITY GEMS — Fetch + render on results page
// ==========================================
function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function loadResultsGems() {

    const grid      = document.getElementById('results-grid');
    const countEl   = document.getElementById('results-count');

    if (!grid) return;

    try {
        const gems = await fetchApprovedGems(); // defined in app.js
        if (!gems.length) return;

        // Filter gems by activities AND geography (within 50km of destination)
        const filteredGems = gems.filter(gem => {
            // 1. Activity filter
            const gemCats = (gem.category || '').split(',').map(c => c.trim());
            const actMatch = activities.length === 0 || activities.some(act => gemCats.includes(act));
            if (!actMatch) return false;

            // 2. Geography filter
            if (!window.activeSearchPoints || window.activeSearchPoints.length === 0) return true;
            
            // parseFloat ensures Google Sheets text strings become actual math numbers
            const gLat = parseFloat(gem.lat);
            const gLng = parseFloat(gem.lng);
            const radiusKm = searchRadius / 1000; // convert metres to km
            return window.activeSearchPoints.some(pt => getDistanceKm(gLat, gLng, pt.lat, pt.lng) <= radiusKm);
        });

        if (!filteredGems.length) return;

        // Shuffle gems so they appear in random order each visit (same as Places cards)
        shuffleArray(filteredGems);

        // Build all gem cards concurrently (parallel thumbnail fetches)
        const cards = await Promise.all(filteredGems.map(gem => buildGemCard(gem)));

        cards.forEach((card, i) => {
            card.dataset.source = 'gem';
            card.dataset.lat    = filteredGems[i].lat;
            card.dataset.lng    = filteredGems[i].lng;

            // Pre-filter gem cards by homepage activities before appending
            // so they're already hidden/shown correctly before applyFilter runs
            if (homepageActivities && homepageActivities.length > 1) {
                const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
                const match = homepageActivities.some(act => cats.includes(act));
                card.style.display = match ? '' : 'none';
            }

            // Gems first: insert before the first Google Places card
            const firstPlacesCard = grid.querySelector('.feed-card');
            if (firstPlacesCard) {
                grid.insertBefore(card, firstPlacesCard);
            } else {
                grid.appendChild(card);
            }
        });

        // Lightweight filter — show/hide gem cards only (don't re-render Places)
        const filterList = (homepageActivities && homepageActivities.length > 0)
            ? homepageActivities
            : (activeFilter !== 'all' && activeFilter !== 'multi') ? [activeFilter] : null;

        if (filterList) {
            grid.querySelectorAll('.gem-card').forEach(card => {
                const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
                const match = filterList.some(f => cats.includes(f));
                card.style.display = match ? '' : 'none';
            });
        }

        // Update visible count to include new gem cards
        let visibleCount = 0;
        grid.querySelectorAll('.feed-card, .gem-card').forEach(card => {
            if (card.style.display !== 'none') visibleCount++;
        });
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.innerHTML = `Showing <strong>${visibleCount} gems</strong> near ${to}`;

    } catch (err) {
        // Gems failed silently — Places results still show fine
        console.warn('Could not load community gems:', err);
    }
}

// NOTE: Auto-run timer removed. 
// loadResultsGems() is now safely called directly by renderResults() 
// once the Google Places search has finished finding the destination.

// ==========================================
// 6. LOAD MORE + BACK TO TOP — Wire buttons
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const loadMoreBtn  = document.getElementById('btn-load-more');
    const backToTopBtn = document.getElementById('btn-back-to-top');

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreResults);
    }

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            backToTopBtn.classList.toggle('visible', window.scrollY > 400);
        });
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    const tipClose = document.getElementById('results-tip-close');
    if (tipClose) {
        tipClose.addEventListener('click', () => {
            const tip = document.getElementById('results-tip');
            if (tip) tip.style.display = 'none';
        });
    }
});

// ==========================================
// 7. RESULTS MAP — Interactive Map View
// ==========================================
let resultsMap     = null;
let resultsMarkers = [];

function toggleMapView() {
    const isMapActive  = document.body.classList.toggle('map-view-active');
    const mapContainer = document.getElementById('results-map-container');
    const toggleText   = document.querySelector('.btn-map-toggle .toggle-text');
    const toggleIcon   = document.querySelector('.btn-map-toggle .toggle-icon');

    if (isMapActive) {
            mapContainer.style.display = 'block';
            if (toggleText) toggleText.textContent = 'Show List';
            if (toggleIcon) toggleIcon.textContent = '📄';
            renderResultsMap();
            
            // Smoothly scroll to the top so the map is perfectly framed
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            mapContainer.style.display = 'none';
        if (toggleText) toggleText.textContent = 'Show Map';
        if (toggleIcon) toggleIcon.textContent = '🗺️';
    }
}

function renderResultsMap() {
    const mapEl = document.getElementById('results-map');
    if (!mapEl) return;

    if (!resultsMap) {
        resultsMap = new google.maps.Map(mapEl, {
            center: { lat: toLat, lng: toLng },
            zoom: 12,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
        });
    }

    // Clear existing markers
    resultsMarkers.forEach(m => m.setMap(null));
    resultsMarkers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // 1. Add Departure Pin
    if (!isNaN(fromLat) && !isNaN(fromLng)) {
        const fromPos = { lat: fromLat, lng: fromLng };
        bounds.extend(fromPos);
        hasPoints = true;
        resultsMarkers.push(new google.maps.Marker({
            position: fromPos, map: resultsMap, title: 'Departure: ' + from, zIndex: 200,
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#00d2ff', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 12 },
            label: { text: '🏡', fontSize: '14px' }
        }));
    }

    // 2. Add Destination Pin
    if (!isNaN(toLat) && !isNaN(toLng)) {
        const toPos = { lat: toLat, lng: toLng };
        bounds.extend(toPos);
        hasPoints = true;
        resultsMarkers.push(new google.maps.Marker({
            position: toPos, map: resultsMap, title: 'Destination: ' + to, zIndex: 200,
            icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#1a1a2e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 12 },
            label: { text: '🏁', fontSize: '14px' }
        }));
    }

    // Loop through all visible cards to drop pins
    document.querySelectorAll('.feed-card, .gem-card').forEach(card => {
        if (card.style.display === 'none') return;
        
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        if (isNaN(lat) || isNaN(lng)) return;

        const isGem = card.dataset.source === 'gem';
        const pos = { lat, lng };
        bounds.extend(pos);
        hasPoints = true;

        const marker = new google.maps.Marker({
            position: pos,
            map: resultsMap,
            icon: isGem ? undefined : {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#ff477e',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 10,
            },
            label: isGem ? { text: '💎', fontSize: '18px' } : undefined,
            title: card.querySelector('h3')?.textContent || 'Gem',
            zIndex: isGem ? 100 : 10
        });

        // Click pin -> switch back to list view, scroll to card, and highlight
        marker.addListener('click', () => {
            if (document.body.classList.contains('map-view-active')) {
                toggleMapView();
            }
            // Add a tiny delay to allow CSS grid to render before scrolling
            setTimeout(() => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
                const originalShadow = card.style.boxShadow;
                const originalTransform = card.style.transform;
                card.style.boxShadow = '0 0 0 4px var(--primary)';
                card.style.transform = 'translateY(-8px)';
                setTimeout(() => {
                    card.style.boxShadow = originalShadow;
                    card.style.transform = originalTransform;
                }, 2000);
            }, 100);
        });

        resultsMarkers.push(marker);
    });

    // Fit bounds after DOM update
    if (hasPoints) {
        google.maps.event.trigger(resultsMap, 'resize');
        setTimeout(() => {
            resultsMap.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
            // Prevent over-zoom
            const listener = google.maps.event.addListener(resultsMap, 'idle', () => {
                if (resultsMap.getZoom() > 15) resultsMap.setZoom(15);
                google.maps.event.removeListener(listener);
            });
        }, 150);
    }
}

// Wire the map toggle button
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('btn-map-toggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleMapView);
});