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

// ==========================================
// MAPS API CALLBACK — fires when script loads
// ==========================================
window.initMap = function () {
    distanceService = new google.maps.DistanceMatrixService();
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

// ==========================================
// MAIN ENTRY — called from initMap
// ==========================================
function loadPlanner() {
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
    fetchAllDriveTimes(); // async — updates connectors + times after render
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
            <span class="day-badge">Day ${dayNum}</span>
            <span class="day-stop-count">${gems.length} stop${gems.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="day-header-right">
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
                <div class="spend-group">
                    <label class="spend-label">Time spent</label>
                    <select class="time-spent-select" data-gem-id="${gem.id}">
                        <option value="30"  ${durationMins === 30  ? 'selected' : ''}>30 mins</option>
                        <option value="60"  ${durationMins === 60  ? 'selected' : ''}>1 hour</option>
                        <option value="90"  ${durationMins === 90  ? 'selected' : ''}>1.5 hours</option>
                        <option value="120" ${durationMins === 120 ? 'selected' : ''}>2 hours</option>
                        <option value="180" ${durationMins === 180 ? 'selected' : ''}>3 hours</option>
                    </select>
                </div>
                <a class="btn-maps-link" href="${mapsUrl}" target="_blank" rel="noopener">🗺️ Open in Maps</a>
            </div>
            <textarea
                class="stop-notes-field"
                data-gem-id="${gem.id}"
                placeholder="📝 Add a note... (e.g. book table in advance, bring cash only)"
                rows="2">${noteText}</textarea>
        </div>
    `;

    // Wire remove button
    card.querySelector('.btn-remove-stop').addEventListener('click', () => removeStop(gem.id));

    // Wire Up/Down reorder buttons (mobile)
    const upBtn   = card.querySelector('.btn-reorder-up');
    const downBtn = card.querySelector('.btn-reorder-down');
    if (upBtn)   upBtn.addEventListener('click',   (e) => { e.stopPropagation(); moveStop(gem.id, 'up');   });
    if (downBtn) downBtn.addEventListener('click', (e) => { e.stopPropagation(); moveStop(gem.id, 'down'); });

    // Wire time-spent → recalculate times (no full re-render needed)
    card.querySelector('.time-spent-select').addEventListener('change', (e) => {
        const durations           = getDurations();
        durations[gem.id]         = parseInt(e.target.value, 10);
        saveDurations(durations);
        calculateCascadingTimes();
    });

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
            const spent = durations[gemId] || 60;
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
// DOMContentLoaded — Wire static buttons
// (Dynamic content is wired inside buildStopCard)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('btn-export-maps');
    if (exportBtn) exportBtn.addEventListener('click', exportToMaps);
});