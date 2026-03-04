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
let allPlaces   = [];  // Full shuffled/interleaved array
let loadedCount = 0;   // How many Places cards have been rendered so far
const BATCH_SIZE = 12; // Cards per page

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
            service.nearbySearch({ location, radius: 25000, type }, (results, status) => {
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
                            .filter(p => p.rating >= 4.0 && p.user_ratings_total >= 100);
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
    loadedCount = 0;

    // Render first batch only — Load More handles the rest
    const firstBatch = allPlaces.slice(0, BATCH_SIZE);
    firstBatch.forEach((place, i) => grid.appendChild(buildPlaceCard(place, i)));
    loadedCount = firstBatch.length;

    grid.style.display      = '';
    filterRow.style.display = 'flex';
    countEl.style.display   = 'block';
    countEl.innerHTML       = `Showing <strong>${firstBatch.length} gems</strong> near ${to}`;

    updateLoadMoreButton();
    wireFilterChips();
    loadResultsGems();
}

// ==========================================
// LOAD MORE — Append next batch of Places cards
// ==========================================
function loadMoreResults() {
    const grid      = document.getElementById('results-grid');
    const countEl   = document.getElementById('results-count');
    const nextBatch = allPlaces.slice(loadedCount, loadedCount + BATCH_SIZE);

    // Insert before the first community gem card so Places stay grouped
    const firstGemCard = grid.querySelector('.gem-card');

    nextBatch.forEach((place, i) => {
        const card = buildPlaceCard(place, loadedCount + i);
        if (firstGemCard) {
            grid.insertBefore(card, firstGemCard);
        } else {
            grid.appendChild(card);
        }
    });

    loadedCount += nextBatch.length;
    updateLoadMoreButton();

    // Re-apply current filter to all cards (including new ones)
    const selectedChips   = [...document.querySelectorAll('.results-filter-row .chip.selected')];
    const selectedFilters = selectedChips.map(c => c.dataset.filter).filter(f => f !== 'all');

    let visibleCount = 0;
    grid.querySelectorAll('.feed-card, .gem-card').forEach(card => {
        if (selectedFilters.length > 0) {
            const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
            const match = selectedFilters.some(f => cats.includes(f));
            card.style.display = match ? '' : 'none';
            if (match) visibleCount++;
        } else {
            card.style.display = '';
            visibleCount++;
        }
    });

    if (countEl) countEl.innerHTML = `Showing <strong>${visibleCount} gems</strong> near ${to}`;
}

function updateLoadMoreButton() {
    const btn = document.getElementById('btn-load-more');
    if (!btn) return;
    if (loadedCount >= allPlaces.length) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
        const remaining = allPlaces.length - loadedCount;
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

    // Disable homepage multi-activity memory so it doesn't accidentally re-trigger
    homepageActivities = null;

    activeFilter = filterValue;

    // Update chip selected state
    chips.forEach(c => c.classList.remove('selected'));
    const activeChip = document.querySelector(
        `.results-filter-row .chip[data-filter="${filterValue}"]`
    );
    if (activeChip) activeChip.classList.add('selected');

    // Show / hide cards based on chip filter
    const allCards = grid.querySelectorAll('.feed-card, .gem-card');
    let visibleCount = 0;
    allCards.forEach(card => {
        const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
        const match = filterValue === 'all' || cats.includes(filterValue);
        card.style.display = match ? '' : 'none';
        if (match) visibleCount++;
    });

    if (countEl) {
        countEl.innerHTML = `Showing <strong>${visibleCount} result${visibleCount !== 1 ? 's' : ''}</strong> near ${to}`;
    }
    if (emptyState) {
        emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }
}

// Called when 2+ activities are passed from home page via URL
function applyMultiFilter(activityList) {
    const grid       = document.getElementById('results-grid');
    const countEl    = document.getElementById('results-count');
    const emptyState = document.getElementById('empty-state');

    // Visually select all chips that match the activities, deselect others
    document.querySelectorAll('.results-filter-row .chip').forEach(c => {
        if (activityList.includes(c.dataset.filter)) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });

    // Show cards matching ANY selected activity
    const allCards = grid.querySelectorAll('.feed-card, .gem-card');
    let visible = 0;
    allCards.forEach(card => {
        const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
        const match = activityList.some(act => cats.includes(act));
        card.style.display = match ? '' : 'none';
        if (match) visible++;
    });

    if (countEl)    countEl.innerHTML          = `Showing <strong>${visible} result${visible !== 1 ? 's' : ''}</strong> near ${to}`;
    if (emptyState) emptyState.style.display   = visible === 0 ? 'block' : 'none';
}

function wireFilterChips() {
    const chips = document.querySelectorAll('.results-filter-row .chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => applyFilter(chip.dataset.filter));
    });

    if (activities.length === 1) {
        setTimeout(() => applyFilter(activities[0]), 0);
    }
    // Multi-activity: show label + filter cards
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
            return window.activeSearchPoints.some(pt => getDistanceKm(gLat, gLng, pt.lat, pt.lng) <= 50);
        });

        if (!filteredGems.length) return;

        // Build all gem cards concurrently (parallel thumbnail fetches)
        const cards = await Promise.all(filteredGems.map(gem => buildGemCard(gem)));

        cards.forEach(card => {
            card.dataset.source = 'gem';

            // Pre-filter gem cards by homepage activities before appending
            // so they're already hidden/shown correctly before applyFilter runs
            if (homepageActivities && homepageActivities.length > 1) {
                const cats  = (card.dataset.category || '').split(',').map(c => c.trim());
                const match = homepageActivities.some(act => cats.includes(act));
                card.style.display = match ? '' : 'none';
            }

            grid.appendChild(card);
        });

        // Re-apply the active filter so counts and visibility stay consistent
        // If multi-activities were passed and no single chip was clicked, keep the multi-filter
        if (homepageActivities && homepageActivities.length > 1 && activeFilter === 'all') {
            applyMultiFilter(homepageActivities);
        } else {
            applyFilter(activeFilter);
        }

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
});