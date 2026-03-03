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
window.initResultsSearch = function () {

    const loadingEl   = document.getElementById('results-loading');
    const errorEl     = document.getElementById('results-error');
    const filterRow   = document.getElementById('results-filter-row');
    const countEl     = document.getElementById('results-count');
    const grid        = document.getElementById('results-grid');
    const emptyState  = document.getElementById('empty-state');

    // --- Guard: no lat/lng means user typed without using autocomplete ---
    if (isNaN(toLat) || isNaN(toLng)) {
        loadingEl.style.display = 'none';
        errorEl.style.display   = 'block';
        return;
    }

    // --- Clear hardcoded cards, show loading ---
    grid.innerHTML      = '';
    grid.style.display  = 'none';
    loadingEl.style.display = 'flex';
    emptyState.style.display = 'none';

    const location = { lat: toLat, lng: toLng };

    const mapEl  = document.getElementById('hidden-map');
    const map    = new google.maps.Map(mapEl, { center: location, zoom: 12 });
    const service = new google.maps.places.PlacesService(map);

    // Place types to search — mirrors the activity categories
    const types = [
        'tourist_attraction',
        'park',
        'museum',
        'zoo',
        'amusement_park',
        'shopping_mall',
        'restaurant',
        'spa',
        'night_club',
    ];

    let allResults = [];
    let completed  = 0;

    types.forEach(type => {
        service.nearbySearch({
            location: location,
            radius:   25000, // 25km radius
            type:     type,
        }, (results, status) => {
            completed++;

            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                allResults = allResults.concat(results);
            }

            // Once all type searches are done
            if (completed === types.length) {
                loadingEl.style.display = 'none';

                // Deduplicate by place_id, sort by rating, take top 18
                const seen   = new Set();
                const unique = allResults
                    .filter(p => {
                        if (seen.has(p.place_id)) return false;
                        seen.add(p.place_id);
                        return true;
                    })
                    .filter(p => p.rating && p.rating >= 4.0 && p.user_ratings_total >= 100) // quality filter
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 18);

                if (unique.length === 0) {
                    emptyState.style.display = 'block';
                    return;
                }

                // Build cards
                unique.forEach((place, i) => {
                    const card = buildPlaceCard(place, i);
                    grid.appendChild(card);
                });

                // Show grid + filter row + count
                grid.style.display  = '';
                filterRow.style.display = 'flex';
                countEl.style.display   = 'block';
                countEl.innerHTML = `Showing <strong>${unique.length} gems</strong> near ${to}`;

                // Wire filter chips now that cards exist
                wireFilterChips();
            }
        });
    });

};

// ==========================================
// 4. FILTER CHIPS
// activeFilter persists so gem cards (added later) are filtered correctly too.
// When user selected activities on home page, cards are pre-filtered by those
// activities even when no single chip matches (multi-activity case).
// ==========================================
let activeFilter = 'all';

// homepageActivities drives the initial card-level filter separate from chip UI
const homepageActivities = activities.length > 0 ? activities : null;

function applyFilter(filterValue) {
    const chips      = document.querySelectorAll('.results-filter-row .chip');
    const grid       = document.getElementById('results-grid');
    const countEl    = document.getElementById('results-count');
    const emptyState = document.getElementById('empty-state');

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

function wireFilterChips() {
    const chips = document.querySelectorAll('.results-filter-row .chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => applyFilter(chip.dataset.filter));
    });

    // Auto-select chip only when EXACTLY 1 activity was chosen (chip UI supports 1-at-a-time)
    // For 2+ activities, keep "All" chip selected but cards are already pre-filtered below
    if (activities.length === 1) {
        // Use setTimeout(0) so the filter row is definitely visible before we apply
        setTimeout(() => applyFilter(activities[0]), 0);
    }
}

// ==========================================
// 5. COMMUNITY GEMS — Fetch + render on results page
// ==========================================
async function loadResultsGems() {

    const grid      = document.getElementById('results-grid');
    const countEl   = document.getElementById('results-count');

    if (!grid) return;

    try {
        const gems = await fetchApprovedGems(); // defined in app.js
        if (!gems.length) return;

        // Filter gems to match selected activities from URL params
        // If no activities selected, show all gems
        const filteredGems = activities.length > 0
            ? gems.filter(gem => {
                const gemCats = (gem.category || '').split(',').map(c => c.trim());
                return activities.some(act => gemCats.includes(act));
              })
            : gems;

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

        // Re-apply the active chip filter so counts and visibility stay consistent
        applyFilter(activeFilter);

    } catch (err) {
        // Gems failed silently — Places results still show fine
        console.warn('Could not load community gems:', err);
    }
}

// Auto-run on results page
document.addEventListener('DOMContentLoaded', () => {
    // Small delay so Places cards render first, gems appear after
    setTimeout(loadResultsGems, 800);
});