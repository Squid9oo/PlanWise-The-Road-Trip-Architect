// ==========================================
// PLANWISE — Road Trip Architect (Session 11)
// Full rebuild: day-by-day planner, Distance Matrix API,
// HTML5 drag-drop reordering, notes, export to Google Maps
// ==========================================

// --- Storage Keys ---
const SK_GEMS       = 'planwise_saved_gems';
const SK_ORDER      = 'planwise_stop_order';     // {dayNum: [gemId, ...]}
const SK_NOTES      = 'planwise_stop_notes';     // {gemId: "note text"}
const SK_DURATION   = 'planwise_stop_duration';  // {gemId: minutes}
const SK_DAYTIMES   = 'planwise_day_times';      // {dayNum: "09:00"}
const SK_DAYCOUNT   = 'planwise_day_count';      // number (string in storage)
const SK_DRIVECACHE = 'planwise_drive_cache';    // {"lat1,lng1|lat2,lng2": {mins,km,text,distText}}

// --- Global State ---
let distanceService = null;
let dragState = { gemId: null, fromDay: null };

// --- Map State ---
let plannerMap      = null;
let mapMarkers      = [];
let mapPolylines    = [];
let collapsedDays   = new Set();   // Track which days are collapsed

// ==========================================
// MAPS API CALLBACK — fires when script loads
// ==========================================
window.initMap = function () {
    distanceService = new google.maps.DistanceMatrixService();

    // Create planner map (centered on Malaysia)
    const mapEl = document.getElementById('planner-map');
    if (mapEl) {
        plannerMap = new google.maps.Map(mapEl, {
            center: { lat: 4.2, lng: 108.0 },
            zoom: 7,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
        });
    }

    // Wire map collapse toggle
    const toggleBtn = document.getElementById('planner-map-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const container = document.getElementById('planner-map');
            container.classList.toggle('map-collapsed');
            toggleBtn.classList.toggle('collapsed');
            toggleBtn.textContent = container.classList.contains('map-collapsed') ? '▶' : '▼';
        });
    }

    // Initialize Manual Search Autocomplete
    const addInput = document.getElementById('planner-add-search');
    if (addInput) {
        const autocomplete = new google.maps.places.Autocomplete(addInput, {
            componentRestrictions: { country: 'my' },
            fields: ['place_id', 'name', 'geometry', 'formatted_address', 'photos', 'types', 'rating', 'user_ratings_total']
        });
        autocomplete.addListener('place_changed', () => handleManualAdd(autocomplete));
    }

    loadPlanner();
};

// ==========================================
// STORAGE HELPERS — Read
// ==========================================
function getGems()      { return JSON.parse(localStorage.getItem(SK_GEMS))       || []; }
function getOrder()     { return JSON.parse(localStorage.getItem(SK_ORDER))      || {}; }
function getNotes()     { return JSON.parse(localStorage.getItem(SK_NOTES))      || {}; }
function getDurations() { return JSON.parse(localStorage.getItem(SK_DURATION))   || {}; }
function getDayTimes()  { return JSON.parse(localStorage.getItem(SK_DAYTIMES))   || { 1: '09:00' }; }
function getDayCount()  { return parseInt(localStorage.getItem(SK_DAYCOUNT), 10) || 1; }
function getDriveCache(){ return JSON.parse(localStorage.getItem(SK_DRIVECACHE)) || {}; }

// --- Write ---
function saveOrder(o)     { localStorage.setItem(SK_ORDER,      JSON.stringify(o)); }
function saveNotes(n)     { localStorage.setItem(SK_NOTES,      JSON.stringify(n)); }
function saveDurations(d) { localStorage.setItem(SK_DURATION,   JSON.stringify(d)); }
function saveDayTimes(t)  { localStorage.setItem(SK_DAYTIMES,   JSON.stringify(t)); }
function saveDayCount(c)  { localStorage.setItem(SK_DAYCOUNT,   String(c)); }
function saveDriveCache(c){ localStorage.setItem(SK_DRIVECACHE, JSON.stringify(c)); }

// --- Departure Card Detection ---
// Origin anchor + hotel wake-up cards are departure points, not destinations
function isDepartureCard(gemId) {
    return gemId === 'gem_origin_anchor' || gemId.endsWith('_out');
}

// ==========================================
// AUTO-CREATE DAYS FROM TRIP DURATION
// ==========================================
function ensureTripDays() {
    const nights = parseInt(localStorage.getItem('planwise_trip_nights'), 10);
    if (!nights || nights <= 0) return;

    const requiredDays = nights + 1;  // 3 nights = 4 days
    const currentDays  = getDayCount();

    if (currentDays >= requiredDays) return; // Already enough days

    const order = getOrder();
    const times = getDayTimes();

    for (let d = currentDays + 1; d <= requiredDays; d++) {
        if (!order[d]) order[d] = [];
        if (!times[d]) times[d] = '09:00';
    }

    saveDayCount(requiredDays);
    saveOrder(order);
    saveDayTimes(times);
}

// ==========================================
// HOME ANCHOR INJECTION (Phase B)
// ==========================================
function ensureOriginAnchor() {
    const originRaw = localStorage.getItem('planwise_origin');
    if (!originRaw) return;

    // Check if the anchor card actually exists in saved gems
    const gems = getGems();
    const anchorExists = gems.some(g => g.id === 'gem_origin_anchor');

    // If anchor already exists, nothing to do
    if (anchorExists) return;

    const origin = JSON.parse(originRaw);
    
    // Create the special starting point card
    const anchorGem = {
        id: 'gem_origin_anchor',
        name: origin.name, // e.g. "🏡 Departing from: Puchong"
        location: 'Start Line',
        lat: origin.lat,
        lng: origin.lng,
        photo: 'https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=400&q=80', // Aesthetic road photo
        category: 'heritage'
    };
    
    gems.push(anchorGem);
    localStorage.setItem(SK_GEMS, JSON.stringify(gems));
    
    // Force it to the absolute TOP of Day 1
    let order = getOrder();
    if (!order[1]) order[1] = [];
    order[1].unshift('gem_origin_anchor');
    saveOrder(order);
    
    // Mark as injected so it doesn't duplicate if user refreshes
    localStorage.setItem('planwise_origin_injected', 'true');
}

// ==========================================
// MAIN ENTRY — called from initMap
// ==========================================
function loadPlanner() {
    ensureOriginAnchor(); // Inject Home Anchor before loading gems
    ensureTripDays();     // Auto-create days based on trip duration
    const gems = getGems();

    if (gems.length === 0) {
        document.getElementById('planner-empty').style.display  = 'flex';
        document.getElementById('planner-main').style.display   = 'none';
        return;
    }

    document.getElementById('planner-empty').style.display = 'none';
    document.getElementById('planner-main').style.display  = 'block';

    normaliseOrder(gems);
    renderPlanner();
    
    // Delay map render to ensure DOM has updated container dimensions
    setTimeout(() => {
        renderPlannerMap();
    }, 100);

    fetchAllDriveTimes();
}

// ==========================================
// NORMALISE ORDER
// Ensures every saved gem appears in order data exactly once.
// New gems default to Day 1. Orphaned IDs are removed.
// ==========================================
function normaliseOrder(gems) {
    const order    = getOrder();
    const dayCount = getDayCount();
    const gemIds   = new Set(gems.map(g => g.id));

    // Remove IDs that no longer exist in saved gems
    for (let d = 1; d <= dayCount; d++) {
        order[d] = (order[d] || []).filter(id => gemIds.has(id));
    }

    // Find all IDs already assigned
    const assigned = new Set();
    for (let d = 1; d <= dayCount; d++) {
        (order[d] || []).forEach(id => assigned.add(id));
    }

    // Assign brand-new gems to Day 1
    gems.forEach(gem => {
        if (!assigned.has(gem.id)) {
            if (!order[1]) order[1] = [];
            order[1].push(gem.id);
        }
    });

    saveOrder(order);
}

// ==========================================
// RENDER PLANNER — Full re-render
// ==========================================
function renderPlanner() {
    const gems      = getGems();
    const order     = getOrder();
    const notes     = getNotes();
    const durations = getDurations();
    const dayTimes  = getDayTimes();
    const dayCount  = getDayCount();

    // Build a lookup map for quick gem access by ID
    const gemMap = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    const content = document.getElementById('planner-content');
    content.innerHTML = '';

    // Render each day section
    for (let d = 1; d <= dayCount; d++) {
        const dayStopIds = (order[d] || []).filter(id => gemMap[id]);
        const dayGems    = dayStopIds.map(id => gemMap[id]);
        const dayEl      = buildDaySection(d, dayGems, dayTimes[d] || '09:00', notes, durations);
        content.appendChild(dayEl);
    }

    // Add Day button
    const addDayBtn = document.createElement('button');
    addDayBtn.className     = 'btn-add-day';
    addDayBtn.textContent   = '+ Add Day';
    addDayBtn.addEventListener('click', addDay);
    content.appendChild(addDayBtn);

    updateSummaryBar();
    wireDragDrop();
    
    // HIDE TIME SPENT ON FINAL STOP: 
    // The very last card of the trip represents arrival at the final destination
    const allStops = document.querySelectorAll('.stop-card');
    if (allStops.length > 0) {
        const lastStop = allStops[allStops.length - 1];
        const spendGroup = lastStop.querySelector('.spend-group');
        // Don't hide if the last card happens to be a hotel check-in/out
        if (spendGroup && !lastStop.dataset.gemId.endsWith('_in') && !lastStop.dataset.gemId.endsWith('_out')) {
            spendGroup.style.display = 'none';
        }
    }
    
    // Redraw map pins and lines whenever planner re-renders
    if (plannerMap) {
        setTimeout(renderPlannerMap, 100);
    }
}

// ==========================================
// BUILD DAY SECTION
// ==========================================
function buildDaySection(dayNum, gems, startTime, notes, durations) {
    const section       = document.createElement('div');
    section.className   = 'day-section';
    section.dataset.day = dayNum;

    // --- Day header ---
    const header = document.createElement('div');
    header.className = 'day-header';
    header.innerHTML = `
        <div class="day-header-left">
            <button class="btn-collapse-day" data-day="${dayNum}" aria-label="Toggle day section">▼</button>
            <span class="day-badge">Day ${dayNum}</span>
            <span class="day-stop-count">${gems.length} stop${gems.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="day-header-right">
            <button class="btn-optimize-day" data-day="${dayNum}" title="Sort stops by shortest distance">🪄 Optimize</button>
            <label class="day-start-label">⏰ Start</label>
            <input type="time" class="day-start-time" value="${startTime}" data-day="${dayNum}">
            ${dayNum > 1
                ? `<button class="btn-remove-day" data-day="${dayNum}">Remove Day</button>`
                : ''}
        </div>
    `;

    // Wire start-time change → recalculate without full re-render
    header.querySelector('.day-start-time').addEventListener('change', (e) => {
        const times     = getDayTimes();
        times[dayNum]   = e.target.value;
        saveDayTimes(times);
        calculateCascadingTimes();
    });

    // Wire remove-day button
    const removeDayBtn = header.querySelector('.btn-remove-day');
    if (removeDayBtn) {
        removeDayBtn.addEventListener('click', () => removeDay(dayNum));
    }

    // Wire optimize button
    const optimizeBtn = header.querySelector('.btn-optimize-day');
    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', () => optimizeDayRoute(dayNum));
    }

    section.appendChild(header);

    // --- Day body (droppable zone) ---
    const body       = document.createElement('div');
    body.className   = 'day-body';
    body.dataset.day = dayNum;

    if (gems.length === 0) {
        const emptyHint       = document.createElement('div');
        emptyHint.className   = 'day-empty';
        emptyHint.textContent = 'Drag stops here to add them to this day';
        body.appendChild(emptyHint);
    } else {
        gems.forEach((gem, idx) => {
            // Stop card
            const card = buildStopCard(gem, idx + 1, dayNum, notes[gem.id] || '', durations[gem.id] || 60);
            body.appendChild(card);

            // Connector between consecutive stops (not after the last one)
            if (idx < gems.length - 1) {
                const connector = buildConnector(gem.id, gems[idx + 1].id);
                body.appendChild(connector);
            }
        });
    }

    section.appendChild(body);

    // Wire collapse toggle + persist state in memory
    const collapseBtn = header.querySelector('.btn-collapse-day');
    if (collapseBtn) {
        // Restore collapse state from memory
        if (collapsedDays.has(dayNum)) {
            body.classList.add('day-collapsed');
            collapseBtn.textContent = '▶';
        }

        collapseBtn.addEventListener('click', () => {
            body.classList.toggle('day-collapsed');
            if (body.classList.contains('day-collapsed')) {
                collapsedDays.add(dayNum);
                collapseBtn.textContent = '▶';
            } else {
                collapsedDays.delete(dayNum);
                collapseBtn.textContent = '▼';
            }
        });
    }

    return section;
}

// ==========================================
// BUILD STOP CARD
// ==========================================
function buildStopCard(gem, stopNum, dayNum, noteText, durationMins) {
    const card          = document.createElement('div');
    card.className      = 'stop-card';
    card.dataset.gemId  = gem.id;
    card.dataset.day    = dayNum;
    card.draggable      = true;

    const photoUrl = gem.photo
        || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80';

    const categoryLabels = {
        food:      '🍜 Food & Drink',
        nature:    '🌳 Nature',
        beach:     '🏖️ Beach',
        heritage:  '🏛️ Heritage',
        family:    '🎠 Family',
        nightlife: '🌆 Nightlife',
        wellness:  '🧘 Wellness',
        shopping:  '🛍️ Shopping',
    };

    // Google Maps URL for "Open in Maps" link
    const mapsUrl = (gem.lat && gem.lng)
        ? `https://www.google.com/maps/search/?api=1&query=${gem.lat},${gem.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((gem.name || '') + ' ' + (gem.location || ''))}`;

    card.innerHTML = `
        <div class="drag-handle" aria-hidden="true" title="Drag to reorder">⠿</div>
        <div class="stop-num">${stopNum}</div>
        <div class="stop-photo" style="background-image: url('${photoUrl}')"></div>
        <div class="stop-info">
            <div class="stop-top-row">
                <span class="card-tag card-tag--small ${gem.category || 'heritage'}">${categoryLabels[gem.category] || gem.category || 'Attraction'}</span>
                <div class="stop-actions">
                    <div class="btn-reorder-group" aria-label="Reorder stop">
                        <button class="btn-reorder btn-reorder-up" data-gem-id="${gem.id}" aria-label="Move up">↑</button>
                        <button class="btn-reorder btn-reorder-down" data-gem-id="${gem.id}" aria-label="Move down">↓</button>
                    </div>
                    <button class="btn-remove-stop" data-gem-id="${gem.id}" aria-label="Remove stop">✕</button>
                </div>
            </div>
            <h3 class="stop-name">${gem.name || 'Unnamed Stop'}</h3>
            <p class="stop-location">📍 ${gem.location || 'Location unavailable'}</p>
            <div class="stop-timing-row">
                <div class="arrival-badge">
                    🕐 <span class="arrival-time" data-gem-id="${gem.id}">--:--</span>
                </div>
                <div class="drive-from-badge" data-gem-id="${gem.id}" ${stopNum === 1 ? 'style="display:none"' : ''}>
                    ⏱ <span class="drive-from-text">Calculating...</span>
                </div>
            </div>
            <div class="stop-bottom-row">
                ${isDepartureCard(gem.id) ? `
                <div class="spend-group">
                    <span class="spend-label" style="text-transform:none; font-weight:700; color:var(--primary-dark);">🚗 Departure Point</span>
                </div>
                ` : `
                <div class="spend-group">
                    <label class="spend-label">Time spent</label>
                    <select class="time-spent-select" data-gem-id="${gem.id}">
                        <option value="30"  ${durationMins === 30  ? 'selected' : ''}>30 mins</option>
                        <option value="60"  ${durationMins === 60  ? 'selected' : ''}>1 hour</option>
                        <option value="90"  ${durationMins === 90  ? 'selected' : ''}>1.5 hours</option>
                        <option value="120" ${durationMins === 120 ? 'selected' : ''}>2 hours</option>
                        <option value="180" ${durationMins === 180 ? 'selected' : ''}>3 hours</option>
                        <option value="240" ${durationMins === 240 ? 'selected' : ''}>4 hours</option>
                        <option value="300" ${durationMins === 300 ? 'selected' : ''}>5 hours</option>
                        <option value="360" ${durationMins === 360 ? 'selected' : ''}>6 hours</option>
                        <option value="420" ${durationMins === 420 ? 'selected' : ''}>7 hours</option>
                        <option value="480" ${durationMins === 480 ? 'selected' : ''}>8 hours</option>
                        <option value="540" ${durationMins === 540 ? 'selected' : ''}>9 hours</option>
                    </select>
                </div>
                `}
                ${getDayCount() > 1 ? `
                <div class="spend-group">
                    <label class="spend-label">Move to</label>
                    <select class="move-day-select" data-gem-id="${gem.id}" data-from-day="${dayNum}">
                        <option value="${dayNum}">Day ${dayNum} ▾</option>
                        ${Array.from({ length: getDayCount() }, (_, i) => i + 1)
                            .filter(d => d !== dayNum)
                            .map(d => `<option value="${d}">Day ${d}</option>`)
                            .join('')}
                    </select>
                </div>` : ''}
                <a class="btn-maps-link" href="${mapsUrl}" target="_blank" rel="noopener">🗺️ Open in Maps</a>
            </div>
            <textarea
                class="stop-notes-field"
                data-gem-id="${gem.id}"
                placeholder="📝 Add a note... (e.g. book table in advance, bring cash only)"
                rows="2">${noteText}</textarea>
        </div>
    `;

    // Wire card click → pan map to this gem's pin
    card.addEventListener('click', (e) => {
        // Don't pan if user clicked a button, select, textarea, or link
        if (e.target.closest('button, select, textarea, a')) return;
        panMapToGem(gem.id);
    });

    // Wire remove button
    card.querySelector('.btn-remove-stop').addEventListener('click', () => removeStop(gem.id));

    // Wire Up/Down reorder buttons (mobile)
    const upBtn   = card.querySelector('.btn-reorder-up');
    const downBtn = card.querySelector('.btn-reorder-down');
    if (upBtn)   upBtn.addEventListener('click',   (e) => { e.stopPropagation(); moveStop(gem.id, 'up');   });
    if (downBtn) downBtn.addEventListener('click', (e) => { e.stopPropagation(); moveStop(gem.id, 'down'); });

    // Wire time-spent → recalculate times (no full re-render needed)
    const timeSpentEl = card.querySelector('.time-spent-select');
    if (timeSpentEl) {
        timeSpentEl.addEventListener('change', (e) => {
            const durations           = getDurations();
            durations[gem.id]         = parseInt(e.target.value, 10);
            saveDurations(durations);
            calculateCascadingTimes();
        });
    }

    // Wire move-to-day select
    const moveDayEl = card.querySelector('.move-day-select');
    if (moveDayEl) {
        moveDayEl.addEventListener('change', (e) => {
            const toDay = parseInt(e.target.value, 10);
            if (toDay !== dayNum) moveStopToDay(gem.id, dayNum, toDay);
        });
    }

    // Wire notes textarea — debounced save (no re-render)
    let noteTimer;
    card.querySelector('.stop-notes-field').addEventListener('input', (e) => {
        clearTimeout(noteTimer);
        noteTimer = setTimeout(() => {
            const notes     = getNotes();
            notes[gem.id]   = e.target.value;
            saveNotes(notes);
        }, 400);
    });

    return card;
}

// ==========================================
// BUILD CONNECTOR (visual line between stops)
// ==========================================
function buildConnector(fromId, toId) {
    const connector          = document.createElement('div');
    connector.className      = 'stop-connector';
    connector.dataset.fromId = fromId;
    connector.dataset.toId   = toId;
    connector.innerHTML = `
        <div class="connector-line"></div>
        <div class="connector-dot"></div>
        <div class="connector-info">
            <span class="connector-text">⏱ Calculating drive time...</span>
        </div>
    `;
    return connector;
}

// ==========================================
// DISTANCE MATRIX — Fetch all drive times
// Uses Google's diagonal trick: origins[i]→destinations[i]
// gives consecutive-stop drive times in one API call per day.
// ==========================================
async function fetchAllDriveTimes() {
    if (!distanceService) return;

    const gems     = getGems();
    const order    = getOrder();
    const dayCount = getDayCount();
    const cache    = getDriveCache();

    const gemMap = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    for (let d = 1; d <= dayCount; d++) {
        const stopIds = (order[d] || []).filter(id => gemMap[id]);
        if (stopIds.length < 2) continue;

        // Build arrays for uncached pairs only
        const origins      = [];
        const destinations = [];
        const pairKeys     = [];

        for (let i = 0; i < stopIds.length - 1; i++) {
            const from = gemMap[stopIds[i]];
            const to   = gemMap[stopIds[i + 1]];
            if (!from?.lat || !to?.lat) continue;

            const key = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
            if (!cache[key]) {
                origins.push({ lat: parseFloat(from.lat), lng: parseFloat(from.lng) });
                destinations.push({ lat: parseFloat(to.lat), lng: parseFloat(to.lng) });
                pairKeys.push(key);
            }
        }

        // Fetch uncached pairs in one call
        if (origins.length > 0) {
            await new Promise((resolve) => {
                distanceService.getDistanceMatrix({
                    origins,
                    destinations,
                    travelMode:  google.maps.TravelMode.DRIVING,
                    unitSystem:  google.maps.UnitSystem.METRIC,
                }, (response, status) => {
                    if (status === 'OK' && response?.rows) {
                        // Diagonal of the matrix = consecutive pairs
                        // rows[i].elements[i] = origins[i] → destinations[i]
                        response.rows.forEach((row, i) => {
                            const el = row.elements[i];
                            if (el?.status === 'OK') {
                                cache[pairKeys[i]] = {
                                    mins:     Math.round(el.duration.value / 60),
                                    km:       Math.round(el.distance.value / 1000),
                                    text:     el.duration.text,
                                    distText: el.distance.text,
                                };
                            }
                        });
                        saveDriveCache(cache);
                    }
                    resolve();
                });
            });
        }

        // Update connector UI for this day with cached values
        const dayIds = (order[d] || []).filter(id => gemMap[id]);
        for (let i = 0; i < dayIds.length - 1; i++) {
            const from = gemMap[dayIds[i]];
            const to   = gemMap[dayIds[i + 1]];
            if (!from?.lat || !to?.lat) continue;

            const key       = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
            const data      = cache[key];
            const connector = document.querySelector(
                `.stop-connector[data-from-id="${dayIds[i]}"][data-to-id="${dayIds[i + 1]}"]`
            );
            if (connector && data) {
                connector.querySelector('.connector-text').textContent =
                    `⏱ ${data.text} · ${data.distText}`;
                connector.dataset.driveMins = data.mins;
            }
        }
    }

    calculateCascadingTimes();
}

// ==========================================
// CASCADING TIME CALCULATION
// Runs entirely from the DOM + localStorage cache.
// Called whenever: start time changes, time-spent changes,
// or after drive times are fetched.
// ==========================================
function calculateCascadingTimes() {
    const order     = getOrder();
    const dayTimes  = getDayTimes();
    const durations = getDurations();
    const dayCount  = getDayCount();
    const gems      = getGems();
    const cache     = getDriveCache();

    const gemMap = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    let totalKm   = 0;
    let totalMins = 0;

    for (let d = 1; d <= dayCount; d++) {
        const stopIds = (order[d] || []).filter(id => gemMap[id]);
        if (stopIds.length === 0) continue;

        // Parse day start time
        const [h, m] = (dayTimes[d] || '09:00').split(':').map(Number);
        const current = new Date();
        current.setHours(h, m, 0, 0);

        for (let i = 0; i < stopIds.length; i++) {
            const gemId = stopIds[i];

            // 1. Update arrival time badge on this card
            const arrivalEl = document.querySelector(`.arrival-time[data-gem-id="${gemId}"]`);
            if (arrivalEl) arrivalEl.textContent = formatTime(current);

            // 2. Update "X min drive" badge (drive time FROM previous stop)
            if (i > 0) {
                const prevId = stopIds[i - 1];
                const from   = gemMap[prevId];
                const to     = gemMap[gemId];
                const key    = (from?.lat && to?.lat)
                    ? `${from.lat},${from.lng}|${to.lat},${to.lng}`
                    : null;
                const data   = key ? cache[key] : null;

                const driveTextEl = document.querySelector(
                    `.drive-from-badge[data-gem-id="${gemId}"] .drive-from-text`
                );
                if (driveTextEl) {
                    driveTextEl.textContent = data ? `${data.text} drive` : 'Calculating...';
                }
            }

            // 3. Add time spent at this stop → move clock forward
            // Departure cards (origin anchor + hotel wake-ups) use 0 minutes
            const spent = isDepartureCard(gemId) ? 0 : (durations[gemId] || 60);
            current.setMinutes(current.getMinutes() + spent);

            // 4. Add drive time to NEXT stop → move clock forward
            if (i < stopIds.length - 1) {
                const from = gemMap[gemId];
                const to   = gemMap[stopIds[i + 1]];
                const key  = (from?.lat && to?.lat)
                    ? `${from.lat},${from.lng}|${to.lat},${to.lng}`
                    : null;
                const data = key ? cache[key] : null;

                const driveMins = data ? data.mins : 45; // 45 min fallback if API not loaded yet
                current.setMinutes(current.getMinutes() + driveMins);

                totalKm   += data ? data.km   : 0;
                totalMins += driveMins;
            }
        }
    }

    updateSummaryBar(totalKm, totalMins);
}

// ==========================================
// SUMMARY BAR UPDATE
// ==========================================
function updateSummaryBar(totalKm, totalMins) {
    const gems     = getGems();
    const dayCount = getDayCount();

    const countEl = document.getElementById('summary-stops');
    const daysEl  = document.getElementById('summary-days');
    const kmEl    = document.getElementById('summary-km');
    const timeEl  = document.getElementById('summary-time');

    if (countEl) countEl.textContent = `${gems.length} stop${gems.length !== 1 ? 's' : ''}`;
    if (daysEl)  daysEl.textContent  = `${dayCount} day${dayCount !== 1 ? 's' : ''}`;

    if (kmEl && totalKm !== undefined) {
        kmEl.textContent  = totalKm > 0 ? `~${totalKm} km` : '-- km';
    }
    if (timeEl && totalMins !== undefined) {
        timeEl.textContent = totalMins > 0 ? `~${formatDuration(totalMins)} drive` : '-- drive';
    }
}

// ==========================================
// EXPORT TO GOOGLE MAPS
// Builds a multi-stop Google Maps URL from all stops in day order.
// ==========================================
function exportToMaps() {
    const gems     = getGems();
    const order    = getOrder();
    const dayCount = getDayCount();
    const gemMap   = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    // Flatten all stops in day order
    const allStops = [];
    for (let d = 1; d <= dayCount; d++) {
        (order[d] || []).forEach(id => {
            if (gemMap[id]) allStops.push(gemMap[id]);
        });
    }

    const located = allStops.filter(g => g.lat && g.lng);
    if (located.length === 0) return;

    if (located.length === 1) {
        window.open(
            `https://www.google.com/maps/search/?api=1&query=${located[0].lat},${located[0].lng}`,
            '_blank'
        );
        return;
    }

    // Google Maps multi-stop URL: /dir/lat,lng/lat,lng/lat,lng/...
    const coords = located.map(g => `${g.lat},${g.lng}`).join('/');
    window.open(`https://www.google.com/maps/dir/${coords}`, '_blank');
}

// ==========================================
// ADD / REMOVE DAY
// ==========================================
function addDay() {
    const count = getDayCount() + 1;
    saveDayCount(count);

    const times  = getDayTimes();
    times[count] = '09:00';
    saveDayTimes(times);

    const order  = getOrder();
    order[count] = [];
    saveOrder(order);

    renderPlanner();
    // No drive time fetch needed — new day is empty
}

function removeDay(dayNum) {
    const dayCount = getDayCount();
    if (dayCount <= 1) return; // can't remove the last day

    // Move stops from removed day to Day 1
    const order         = getOrder();
    const orphaned      = order[dayNum] || [];
    if (!order[1]) order[1] = [];
    order[1] = [...order[1], ...orphaned];

    // Shift subsequent days down by one
    for (let d = dayNum; d < dayCount; d++) {
        order[d] = order[d + 1] || [];
    }
    delete order[dayCount];
    saveOrder(order);

    // Shift day start times down
    const times = getDayTimes();
    for (let d = dayNum; d < dayCount; d++) {
        times[d] = times[d + 1] || '09:00';
    }
    delete times[dayCount];
    saveDayTimes(times);

    saveDayCount(dayCount - 1);
    renderPlanner();
    fetchAllDriveTimes();
}

// ==========================================
// REMOVE STOP
// ==========================================
function removeStop(gemId) {
    // Remove from saved gems
    let gems = getGems();
    gems     = gems.filter(g => g.id !== gemId);
    localStorage.setItem(SK_GEMS, JSON.stringify(gems));

    // Remove from order in all days
    const order = getOrder();
    for (const d in order) {
        order[d] = (order[d] || []).filter(id => id !== gemId);
    }
    saveOrder(order);

    // Reload — checks for empty state, re-renders
    loadPlanner();
}

// ==========================================
// MOVE STOP — Up/Down reorder for mobile
// Swaps a gem with its neighbour in the same day.
// ==========================================
function moveStop(gemId, direction) {
    const order    = getOrder();
    const dayCount = getDayCount();

    for (let d = 1; d <= dayCount; d++) {
        const dayStops = order[d] || [];
        const idx      = dayStops.indexOf(gemId);
        if (idx === -1) continue; // not in this day

        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= dayStops.length) return; // already at top/bottom

        // Swap the two entries
        [dayStops[idx], dayStops[newIdx]] = [dayStops[newIdx], dayStops[idx]];
        order[d] = dayStops;
        saveOrder(order);
        renderPlanner();
        fetchAllDriveTimes();
        return;
    }
}

// ==========================================
// MOVE STOP TO DIFFERENT DAY
// Called by the "Move to Day X" select on mobile
// ==========================================
function moveStopToDay(gemId, fromDay, toDay) {
    if (fromDay === toDay) return;
    const order = getOrder();

    // Remove from source day
    order[fromDay] = (order[fromDay] || []).filter(id => id !== gemId);

    // Append to end of target day
    if (!order[toDay]) order[toDay] = [];
    order[toDay].push(gemId);

    saveOrder(order);
    renderPlanner();
    fetchAllDriveTimes();
}

// ==========================================
// DRAG AND DROP
// Wired after every full render.
// ==========================================
function wireDragDrop() {
    document.querySelectorAll('.stop-card').forEach(card => {
        card.addEventListener('dragstart',  onDragStart);
        card.addEventListener('dragend',    onDragEnd);
        card.addEventListener('dragover',   onDragOverCard);
        card.addEventListener('drop',       onDropOnCard);
    });

    document.querySelectorAll('.day-body').forEach(body => {
        body.addEventListener('dragover',   onDragOverDay);
        body.addEventListener('dragleave',  onDragLeaveDay);
        body.addEventListener('drop',       onDropOnDay);
    });
}

function onDragStart(e) {
    dragState.gemId  = this.dataset.gemId;
    dragState.fromDay = parseInt(this.dataset.day, 10);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.gemId);
}

function onDragEnd() {
    this.classList.remove('dragging');
    // Clean up all visual indicators
    document.querySelectorAll('.stop-card.drop-indicator, .day-body.drag-over')
        .forEach(el => el.classList.remove('drop-indicator', 'drag-over'));
    dragState = { gemId: null, fromDay: null };
}

function onDragOverCard(e) {
    e.preventDefault();
    e.stopPropagation(); // prevent day-body handler firing as well
    e.dataTransfer.dropEffect = 'move';
    if (this.dataset.gemId === dragState.gemId) return;
    // Highlight this card as the insertion target
    document.querySelectorAll('.stop-card.drop-indicator')
        .forEach(c => c.classList.remove('drop-indicator'));
    this.classList.add('drop-indicator');
}

function onDropOnCard(e) {
    e.preventDefault();
    e.stopPropagation();

    const targetId  = this.dataset.gemId;
    const targetDay = parseInt(this.dataset.day, 10);
    if (!dragState.gemId || dragState.gemId === targetId) return;

    const order = getOrder();

    // Remove dragged gem from its current day
    for (const d in order) {
        order[d] = (order[d] || []).filter(id => id !== dragState.gemId);
    }

    // Insert before the target card in the target day
    if (!order[targetDay]) order[targetDay] = [];
    const targetIdx = order[targetDay].indexOf(targetId);
    if (targetIdx >= 0) {
        order[targetDay].splice(targetIdx, 0, dragState.gemId);
    } else {
        order[targetDay].push(dragState.gemId);
    }

    saveOrder(order);
    renderPlanner();
    fetchAllDriveTimes();
}

function onDragOverDay(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
}

function onDragLeaveDay() {
    this.classList.remove('drag-over');
}

function onDropOnDay(e) {
    // Only fires if NOT dropping on a child card
    // (card's drop handler calls stopPropagation)
    e.preventDefault();
    const toDay = parseInt(this.dataset.day, 10);
    if (!dragState.gemId) return;

    const order = getOrder();

    // Remove from source day
    for (const d in order) {
        order[d] = (order[d] || []).filter(id => id !== dragState.gemId);
    }

    // Append to end of target day
    if (!order[toDay]) order[toDay] = [];
    order[toDay].push(dragState.gemId);

    saveOrder(order);
    this.classList.remove('drag-over');
    renderPlanner();
    fetchAllDriveTimes();
}

// ==========================================
// PLANNER MAP — Render pins + route lines
// ==========================================
const DAY_COLORS = ['#00d2ff', '#27ae60', '#e67e22', '#8e44ad', '#ff477e', '#d35400'];

function renderPlannerMap() {
    if (!plannerMap) return;

    // Clear old markers + polylines
    mapMarkers.forEach(m => m.setMap(null));
    mapPolylines.forEach(p => p.setMap(null));
    mapMarkers   = [];
    mapPolylines = [];

    const gems     = getGems();
    const order    = getOrder();
    const dayCount = getDayCount();
    const gemMap   = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    const bounds   = new google.maps.LatLngBounds();
    let stopNum    = 0;
    let hasPoints  = false;
    const seenCoords = {}; // Tracks coordinates to fan out overlapping pins

    for (let d = 1; d <= dayCount; d++) {
        const stopIds  = (order[d] || []).filter(id => gemMap[id]);
        const dayColor = DAY_COLORS[(d - 1) % DAY_COLORS.length];
        const pathCoords = [];

        stopIds.forEach((id, idx) => {
            const gem = gemMap[id];
            let lat = parseFloat(gem.lat);
            let lng = parseFloat(gem.lng);
            if (isNaN(lat) || isNaN(lng)) return;

            // SMART PIN OFFSET: If exact location is used multiple times (e.g. Home), offset slightly in a circle
            const coordKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            if (seenCoords[coordKey]) {
                const angle = seenCoords[coordKey] * (Math.PI / 3); // 60-degree increments
                const offset = 0.0004; // ~40 meters offset so numbers remain readable
                lat += offset * Math.cos(angle);
                lng += offset * Math.sin(angle);
                seenCoords[coordKey]++;
            } else {
                seenCoords[coordKey] = 1;
            }

            stopNum++;
            hasPoints = true;
            const pos = { lat, lng };
            bounds.extend(pos);
            pathCoords.push(pos);

            // Numbered marker
            const marker = new google.maps.Marker({
                position: pos,
                map: plannerMap,
                label: {
                    text: String(stopNum),
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '12px',
                },
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: dayColor,
                    fillOpacity: 1,
                    strokeColor: '#fff',
                    strokeWeight: 2,
                    scale: 16,
                },
                title: gem.name || 'Stop ' + stopNum,
            });

            // Info window on click
            marker.addListener('click', () => {
                scrollToStopCard(id);
            });

            mapMarkers.push(marker);
        });

        // Draw polyline for this day's route
        if (pathCoords.length >= 2) {
            const polyline = new google.maps.Polyline({
                path: pathCoords,
                geodesic: true,
                strokeColor: dayColor,
                strokeOpacity: 0.85,
                strokeWeight: 4,
            });
            polyline.setMap(plannerMap);
            mapPolylines.push(polyline);
        }
    }

    // Fit map to show all pins
    if (hasPoints) {
        google.maps.event.trigger(plannerMap, 'resize');
        plannerMap.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
        
        // Prevent over-zoom when stops are close together
        const listener = google.maps.event.addListener(plannerMap, 'idle', () => {
            if (plannerMap.getZoom() > 15) plannerMap.setZoom(15);
            google.maps.event.removeListener(listener);
        });
    }
}

// Scroll to a stop card + highlight it briefly
function scrollToStopCard(gemId) {
    const card = document.querySelector(`.stop-card[data-gem-id="${gemId}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('map-highlight');
    setTimeout(() => card.classList.remove('map-highlight'), 2000);
}

// Pan map to a gem's pin (called when user clicks a stop card)
function panMapToGem(gemId) {
    if (!plannerMap) return;
    const gems   = getGems();
    const gem    = gems.find(g => g.id === gemId);
    if (!gem) return;
    const lat = parseFloat(gem.lat);
    const lng = parseFloat(gem.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    plannerMap.panTo({ lat, lng });
    plannerMap.setZoom(14);

    // Bounce the matching marker
    const idx = mapMarkers.findIndex(m => {
        const p = m.getPosition();
        return Math.abs(p.lat() - lat) < 0.0001 && Math.abs(p.lng() - lng) < 0.0001;
    });
    if (idx >= 0) {
        mapMarkers[idx].setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => mapMarkers[idx].setAnimation(null), 1400);
    }
}

// ==========================================
// HELPERS
// ==========================================
function formatTime(dateObj) {
    return dateObj.toLocaleTimeString('en-MY', {
        hour:   'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function formatDuration(totalMins) {
    if (totalMins <= 0) return '--';
    if (totalMins < 60) return `${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ==========================================
// NEW: MANUAL SEARCH & ROUTE OPTIMIZATION
// ==========================================
// --- Pending place for preview flow ---
let pendingPlace = null;

function handleManualAdd(autocomplete) {
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    pendingPlace = place;
    showPlacePreview(place);
    document.getElementById('planner-add-search').value = '';
}

function showPlacePreview(place) {
    const preview   = document.getElementById('planner-preview');
    const photoEl   = document.getElementById('preview-photo');
    const nameEl    = document.getElementById('preview-name');
    const addressEl = document.getElementById('preview-address');
    const ratingEl  = document.getElementById('preview-rating');
    const actionsEl = document.getElementById('preview-actions');

    // Photo
    const photoUrl = (place.photos && place.photos.length > 0)
        ? place.photos[0].getUrl({ maxWidth: 400 })
        : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80';
    photoEl.style.backgroundImage = `url('${photoUrl}')`;

    // Name + address
    nameEl.textContent    = place.name || 'Unknown Place';
    addressEl.textContent = place.formatted_address || '';

    // Rating + reviews
    if (place.rating) {
        const fullStars = Math.floor(place.rating);
        const halfStar  = (place.rating % 1 >= 0.3) ? '½' : '';
        const stars     = '★'.repeat(fullStars) + halfStar;
        const reviews   = place.user_ratings_total
            ? `(${place.user_ratings_total.toLocaleString()} reviews)` : '';
        ratingEl.innerHTML = `<span class="stars">${stars}</span> ${place.rating} ${reviews}`;
    } else {
        ratingEl.innerHTML = '<span style="color:var(--muted);">No reviews yet</span>';
    }

    // Action buttons — one "Add to Day X" per day + Hotel button
    const dayCount = getDayCount();
    let html = '';
    for (let d = 1; d <= dayCount; d++) {
        html += `<button class="btn-preview-day" data-day="${d}">+ Day ${d}</button>`;
    }
    html += `<button class="btn-preview-hotel">🏨 Add as Hotel</button>`;
    actionsEl.innerHTML = html;

    // Wire day buttons
    actionsEl.querySelectorAll('.btn-preview-day').forEach(btn => {
        btn.addEventListener('click', () => {
            confirmAddToDay(pendingPlace, parseInt(btn.dataset.day, 10));
        });
    });

    // Wire hotel button — Ask for Check-in/out days
    const hotelBtn = actionsEl.querySelector('.btn-preview-hotel');
    if (hotelBtn) {
        hotelBtn.addEventListener('click', () => {
            let dayOpts = '';
            for(let d=1; d<=dayCount+1; d++) dayOpts += `<option value="${d}">Day ${d}</option>`;
            
            actionsEl.innerHTML = `
                <div style="display:flex; gap:0.5rem; align-items:center; width:100%; margin-top:0.5rem; flex-wrap:wrap; background:var(--surface); padding:0.5rem; border-radius:var(--radius-sm); border:1px solid var(--border);">
                    <label style="font-size:0.75rem; font-weight:700;">Check-in:</label>
                    <select id="hotel-in-day" style="padding:0.2rem; font-size:0.8rem;">${dayOpts}</select>
                    <label style="font-size:0.75rem; font-weight:700;">Check-out:</label>
                    <select id="hotel-out-day" style="padding:0.2rem; font-size:0.8rem;">
                        ${dayOpts.replace('value="2"', 'value="2" selected')}
                    </select>
                    <button class="btn-preview-day" id="btn-confirm-hotel" style="background:var(--primary-dark);">Save Hotel</button>
                </div>
            `;
            
            document.getElementById('btn-confirm-hotel').addEventListener('click', () => {
                const inDay = parseInt(document.getElementById('hotel-in-day').value, 10);
                const outDay = parseInt(document.getElementById('hotel-out-day').value, 10);
                if(outDay <= inDay) return alert("Check-out day must be after Check-in day.");
                confirmAddAsHotel(pendingPlace, inDay, outDay);
            });
        });
    }

    preview.style.display = 'flex';
}

function hidePreview() {
    const preview = document.getElementById('planner-preview');
    if (preview) preview.style.display = 'none';
    pendingPlace = null;
}

function confirmAddToDay(place, dayNum) {
    const baseId = place.place_id || 'manual_' + Date.now();
    const photo  = (place.photos && place.photos.length > 0)
        ? place.photos[0].getUrl({ maxWidth: 400 }) : '';

    let gems  = getGems();
    let order = getOrder();

    const newGem = {
        id:       baseId,
        name:     place.name,
        location: place.formatted_address || '',
        lat:      place.geometry.location.lat(),
        lng:      place.geometry.location.lng(),
        photo:    photo,
        category: 'heritage'
    };

    if (!gems.find(g => g.id === newGem.id)) {
        gems.push(newGem);
        localStorage.setItem(SK_GEMS, JSON.stringify(gems));
    }

    // Add to the user's chosen day
    if (!order[dayNum]) order[dayNum] = [];
    order[dayNum].push(baseId);
    saveOrder(order);

    hidePreview();
    loadPlanner();
}

function confirmAddAsHotel(place, inDay, outDay) {
    const baseId = place.place_id || 'manual_' + Date.now();
    const photo  = (place.photos && place.photos.length > 0)
        ? place.photos[0].getUrl({ maxWidth: 400 }) : '';

    let gems  = getGems();
    let order = getOrder();

    const checkIn = {
        id:       baseId + '_in',
        name:     '🏨 Check-in: ' + place.name,
        location: place.formatted_address || '',
        lat:      place.geometry.location.lat(),
        lng:      place.geometry.location.lng(),
        photo:    photo,
        category: 'wellness'
    };
    const wakeUp = {
        id:       baseId + '_out',
        name:     '🌅 Wake up: ' + place.name,
        location: place.formatted_address || '',
        lat:      place.geometry.location.lat(),
        lng:      place.geometry.location.lng(),
        photo:    photo,
        category: 'wellness'
    };

    if (!gems.find(g => g.id === checkIn.id)) gems.push(checkIn);
    if (!gems.find(g => g.id === wakeUp.id))  gems.push(wakeUp);
    localStorage.setItem(SK_GEMS, JSON.stringify(gems));

    // Use the exact days chosen by the user in the UI
    let dayCount = getDayCount();
    const lastDay = inDay;
    const nextDay = outDay;

    // Ensure we have enough days generated in the planner
    const maxDayNeeded = Math.max(dayCount, nextDay);
    if (dayCount < maxDayNeeded) {
        saveDayCount(maxDayNeeded);
        const times = getDayTimes();
        for (let d = dayCount + 1; d <= maxDayNeeded; d++) {
            if (!times[d]) times[d] = '09:00';
            if (!order[d]) order[d] = [];
        }
        saveDayTimes(times);
    }
    if (dayCount < nextDay) {
        saveDayCount(nextDay);
        const times = getDayTimes();
        times[nextDay] = '09:00';
        saveDayTimes(times);
        order[nextDay] = [];
    }

    if (!order[lastDay]) order[lastDay] = [];
    if (!order[nextDay]) order[nextDay] = [];
    order[lastDay].push(checkIn.id);
    order[nextDay].unshift(wakeUp.id);
    saveOrder(order);

    hidePreview();
    loadPlanner();
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function optimizeDayRoute(dayNum) {
    const order = getOrder();
    let stopIds = order[dayNum] || [];
    if (stopIds.length < 3) return; // 1 or 2 stops don't need sorting

    const gems = getGems();
    const gemMap = {};
    gems.forEach(g => { gemMap[g.id] = g; });

    // Keep stop 1 as the anchor, sort the rest by nearest neighbor
    const optimized = [stopIds[0]];
    let unvisited = stopIds.slice(1);
    let currentId = stopIds[0];

    while (unvisited.length > 0) {
        let nearestId = unvisited[0];
        let minDistance = Infinity;

        unvisited.forEach(id => {
            const dist = getDistanceKm(gemMap[currentId].lat, gemMap[currentId].lng, gemMap[id].lat, gemMap[id].lng);
            if (dist < minDistance) { minDistance = dist; nearestId = id; }
        });

        optimized.push(nearestId);
        unvisited = unvisited.filter(id => id !== nearestId);
        currentId = nearestId;
    }

    order[dayNum] = optimized;
    saveOrder(order);
    renderPlanner();
    fetchAllDriveTimes();
}

// ==========================================
// DOMContentLoaded — Wire static buttons
// (Dynamic content is wired inside buildStopCard)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Inject Travel Dates from search
    const savedDates = localStorage.getItem('planwise_trip_dates');
    const datesInput = document.querySelector('.meta-field input[placeholder*="12-14 Nov"]');
    if (savedDates && datesInput) datesInput.value = savedDates;

    const exportBtn = document.getElementById('btn-export-maps');
    if (exportBtn) exportBtn.addEventListener('click', exportToMaps);

    // Wire print / save as PDF
    const printBtn = document.getElementById('btn-print-trip');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // Wire preview close button
    const previewCloseBtn = document.getElementById('preview-close');
    if (previewCloseBtn) previewCloseBtn.addEventListener('click', hidePreview);

    const clearBtn = document.getElementById('btn-clear-trip');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const count = getGems().length;
            if (count === 0) return;
            const confirmed = window.confirm(
                `This will remove all ${count} saved stop${count !== 1 ? 's' : ''} from your trip. Are you sure?`
            );
            if (!confirmed) return;

            // Wipe all planner localStorage keys
            localStorage.removeItem(SK_GEMS);
            localStorage.removeItem(SK_ORDER);
            localStorage.removeItem(SK_NOTES);
            localStorage.removeItem(SK_DURATION);
            localStorage.removeItem(SK_DAYTIMES);
            localStorage.removeItem(SK_DAYCOUNT);
            localStorage.removeItem('planwise_origin_injected'); // Reset the anchor so it respawns next trip
            localStorage.removeItem('planwise_trip_nights');     // Reset so next trip gets fresh day count
            // Keep drive cache — no point re-fetching if user rebuilds same route

            loadPlanner(); // re-renders empty state
        });
    }
});