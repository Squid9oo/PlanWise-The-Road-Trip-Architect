// PlanWise — Results Page Logic
// Reads URL params from index.html form and populates the results page

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. READ URL PARAMS
    // ==========================================
    const params     = new URLSearchParams(window.location.search);
    const from       = params.get('from')       || 'Your Start';
    const to         = params.get('to')         || 'Your Destination';
    const dateFrom   = params.get('dateFrom')   || '';
    const dateTo     = params.get('dateTo')     || '';
    const transport  = params.get('transport')  || 'car';
    const activities = params.get('activities')
                        ? params.get('activities').split(',').filter(Boolean)
                        : [];


    // ==========================================
    // 2. POPULATE TRIP SUMMARY BAR
    // ==========================================

    // Cities
    document.getElementById('result-from').textContent = from;
    document.getElementById('result-to').textContent   = to;

    // Update page title dynamically
    document.title = `${from} → ${to} · PlanWise Malaysia`;

    // Build meta badges
    const metaContainer = document.getElementById('trip-meta');

    // Date badge
    if (dateFrom && dateTo) {
        const dFrom = new Date(dateFrom);
        const dTo   = new Date(dateTo);

        const options = { day: 'numeric', month: 'short' };
        const fromStr = dFrom.toLocaleDateString('en-MY', options);
        const toStr   = dTo.toLocaleDateString('en-MY', options);

        const diffDays = Math.round((dTo - dFrom) / (1000 * 60 * 60 * 24));
        const nightLabel = diffDays === 0
            ? '1-day trip'
            : `${diffDays} night${diffDays > 1 ? 's' : ''}`;

        metaContainer.innerHTML += `
            <span class="trip-badge">📅 ${fromStr} – ${toStr}</span>
            <span class="trip-badge highlight">${nightLabel}</span>
        `;
    }

    // Transport badge
    const transportMap = {
        car:        '🚗 Car',
        motorcycle: '🏍️ Motorcycle',
        public:     '🚌 Public Transport',
    };
    const transportLabel = transportMap[transport] || '🚗 Car';
    metaContainer.innerHTML += `<span class="trip-badge">${transportLabel}</span>`;

    // Activity badges
    const activityMap = {
        foodie:   '🍜 Foodie',
        nature:   '🌳 Nature',
        beach:    '🏖️ Beach',
        family:   '🎠 Family',
        heritage: '🏛️ Heritage',
        budget:   '💸 Budget',
    };

    activities.forEach(act => {
        if (activityMap[act]) {
            metaContainer.innerHTML += `<span class="trip-badge">${activityMap[act]}</span>`;
        }
    });


    // ==========================================
    // 3. FILTER CARDS BY SELECTED ACTIVITIES
    // ==========================================
    const allCards    = document.querySelectorAll('#results-grid .feed-card');
    const emptyState  = document.getElementById('empty-state');
    const countEl     = document.getElementById('results-count');

    let visibleCount = 0;

    allCards.forEach(card => {
        const category = card.dataset.category;

        // If no activities selected — show ALL cards
        const shouldShow = activities.length === 0 || activities.includes(category);

        if (shouldShow) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    // Update count text
    if (visibleCount === 0) {
        emptyState.style.display  = 'block';
        countEl.style.display     = 'none';
    } else {
        countEl.innerHTML = `Showing <strong>${visibleCount} gem${visibleCount > 1 ? 's' : ''}</strong> along your route`;
    }


    // ==========================================
    // 4. SAVE BUTTONS — Visual feedback
    // (same as app.js, needed here too)
    // ==========================================
    const saveButtons = document.querySelectorAll('.btn-save');

    saveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.textContent          = '✓ Saved';
            btn.style.background     = 'var(--green)';
            btn.style.borderColor    = 'var(--green)';
            btn.style.color          = '#fff';
            btn.disabled             = true;
        });
    });

});