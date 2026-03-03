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
// ==========================================
function wireFilterChips() {

    const chips = document.querySelectorAll('.results-filter-row .chip');
    const grid  = document.getElementById('results-grid');

    chips.forEach(chip => {
        chip.addEventListener('click', () => {

            // Update selected state
            chips.forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');

            const filter = chip.dataset.filter;
            const allCards = grid.querySelectorAll('.feed-card, .gem-card');
            let visibleCount = 0;

            allCards.forEach(card => {
                const categories = (card.dataset.category || '').split(',').map(c => c.trim());
                const match = filter === 'all' || categories.includes(filter);
                card.style.display = match ? '' : 'none';
                if (match) visibleCount++;
            });

            // Update count
            const countEl = document.getElementById('results-count');
            countEl.innerHTML = `Showing <strong>${visibleCount} gem${visibleCount !== 1 ? 's' : ''}</strong> near ${to}`;

            // Show/hide empty state
            const emptyState = document.getElementById('empty-state');
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        });
    });
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
            grid.appendChild(card);
        });

        // Recount visible cards after gems added
        const allCards  = grid.querySelectorAll('.feed-card, .gem-card');
        if (countEl) {
            countEl.innerHTML = `Showing <strong>${allCards.length} results</strong> near ${to}`;
        }

        // Auto-apply filter chip if exactly 1 activity was selected on home page
        if (activities.length === 1) {
            const chip = document.querySelector(`.results-filter-row .chip[data-filter="${activities[0]}"]`);
            if (chip) chip.click();
        }

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