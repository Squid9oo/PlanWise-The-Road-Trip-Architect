// PlanWise App Logic — Revamped Landing Page
// Session A: Form interactions + redirect to results

// ==========================================
// TRIP PLANNER — LocalStorage Helper
// ==========================================
const STORAGE_KEY = 'planwise_saved_gems';
function getSavedGems() { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
function isGemSaved(id) { return getSavedGems().some(g => g.id === id); }
function toggleSaveGem(gemObj, btnEl) {
    let saved = getSavedGems();
    const idx = saved.findIndex(g => g.id === gemObj.id);
    if (idx >= 0) {
        saved.splice(idx, 1); // Remove it (Unsave)
        btnEl.textContent = '+ Save';
        btnEl.classList.remove('btn-saved');
    } else {
        saved.push(gemObj); // Add it (Save)
        btnEl.textContent = '✓ Saved';
        btnEl.classList.add('btn-saved');
        showSaveToast(saved.length); // 🎒 Show toast only on save, not unsave
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

// ==========================================
// SAVE TOAST — Floating badge after saving
// ==========================================
let toastTimer = null;

function showSaveToast(count) {
    // Remove any existing toast first
    const existing = document.getElementById('save-toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    const toast = document.createElement('a');
    toast.id        = 'save-toast';
    toast.className = 'save-toast';
    toast.href      = 'planner.html';
    toast.innerHTML = `
        🎒 <span>${count} gem${count !== 1 ? 's' : ''} saved — View Planner</span>
        <span class="save-toast-arrow">→</span>
        <span class="save-toast-close" id="save-toast-close" aria-label="Close">✕</span>
    `;

    document.body.appendChild(toast);

    // Wire close button — stops link navigation when ✕ is tapped
    const closeBtn = document.getElementById('save-toast-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 420);
        });
    }
    // No auto-dismiss — stays until user taps ✕ or navigates to planner
}

// ==========================================
// GOOGLE MAPS PLACES AUTOCOMPLETE
// Called automatically when Maps API loads
// ==========================================
window.initMap = function () {

    // ==========================================
    // SEARCH FORM — Autocomplete for city inputs
    // ==========================================
    const cityFromInput = document.getElementById('city-from');
    const cityToInput   = document.getElementById('city-to');

    if (cityFromInput) {
        const acFrom = new google.maps.places.Autocomplete(cityFromInput, {
            componentRestrictions: { country: 'my' },
            fields: ['name', 'geometry', 'formatted_address'],
        });
        acFrom.addListener('place_changed', () => {
            const place = acFrom.getPlace();
            if (!place.geometry) return;
            document.getElementById('city-from-lat').value = place.geometry.location.lat();
            document.getElementById('city-from-lng').value = place.geometry.location.lng();
        });
    }

    if (cityToInput) {
        const acTo = new google.maps.places.Autocomplete(cityToInput, {
            componentRestrictions: { country: 'my' },
            fields: ['name', 'geometry', 'formatted_address'],
        });
        acTo.addListener('place_changed', () => {
            const place = acTo.getPlace();
            if (!place.geometry) return;
            document.getElementById('city-to-lat').value = place.geometry.location.lat();
            document.getElementById('city-to-lng').value = place.geometry.location.lng();
        });
    }

    // ==========================================
    // GEM MODAL — Autocomplete for location field
    // ==========================================
    const locationInput = document.getElementById('gem-location');
    if (locationInput) {
        const acGem = new google.maps.places.Autocomplete(locationInput, {
            componentRestrictions: { country: 'my' },
            fields: ['name', 'geometry', 'formatted_address'],
        });
        acGem.addListener('place_changed', () => {
            const place = acGem.getPlace();
            if (!place.geometry) {
                document.getElementById('gem-lat').value = '';
                document.getElementById('gem-lng').value = '';
                return;
            }
            document.getElementById('gem-lat').value = place.geometry.location.lat();
            document.getElementById('gem-lng').value = place.geometry.location.lng();
        });
    }

    if (typeof window.initResultsSearch === 'function') {
        window.initResultsSearch();
    }

};

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ACTIVITY CHIPS — Toggle selected state
    // ==========================================
    const activityChips = document.querySelectorAll('#activity-chips .chip');

    activityChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
    });


    // ==========================================
    // 2. TRIP DURATION — Auto-calculate from dates
    // ==========================================
    const dateFrom      = document.getElementById('date-from');
    const dateTo        = document.getElementById('date-to');
    const durationBadge = document.getElementById('trip-duration');

    if (dateFrom && dateTo && durationBadge) {

    function updateDuration() {
        const from  = new Date(dateFrom.value);
        const to    = new Date(dateTo.value);

        if (!dateFrom.value || !dateTo.value) {
            durationBadge.style.display = 'none';
            return;
        }

        const diffMs   = to - from;
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            durationBadge.textContent = '⚠️ Check dates';
            durationBadge.style.background = '#ff477e';
            durationBadge.style.color = '#fff';
            durationBadge.style.display = 'block';
        } else if (diffDays === 0) {
            durationBadge.textContent = '1-day trip 🌟';
            durationBadge.style.background = 'var(--secondary)';
            durationBadge.style.color = '#1a1a2e';
            durationBadge.style.display = 'block';
        } else {
            durationBadge.textContent = `${diffDays} night${diffDays > 1 ? 's' : ''} 🌙`;
            durationBadge.style.background = 'var(--secondary)';
            durationBadge.style.color = '#1a1a2e';
            durationBadge.style.display = 'block';
        }
    }

    dateFrom.addEventListener('change', updateDuration);
    dateTo.addEventListener('change', updateDuration);
    } // end trip duration guard


    // ==========================================
    // 3. FORM SUBMISSION — Validate + redirect
    // ==========================================
    const btnPlan    = document.getElementById('btn-plan');
    if (btnPlan) {
    const btnText    = btnPlan.querySelector('.btn-text');
    const btnLoading = btnPlan.querySelector('.btn-loading');

    btnPlan.addEventListener('click', () => {

        // --- Gather values ---
        const fromDate  = document.getElementById('date-from').value;
        const toDate    = document.getElementById('date-to').value;
        const fromCity  = document.getElementById('city-from').value.trim();
        const toCity    = document.getElementById('city-to').value.trim();
        const transport = document.querySelector('input[name="transport"]:checked')?.value || 'car';
        const activities = [...document.querySelectorAll('.chip.selected')]
                           .map(c => c.dataset.value);

        // --- Basic validation ---
        if (!fromDate || !toDate) {
            showError('Please select your travel dates 📅');
            return;
        }
        if (!fromCity) {
            showError('Please enter your departure city 📍');
            return;
        }
        if (new Date(toDate) < new Date(fromDate)) {
            showError('Your end date can\'t be before your start date 🤔');
            return;
        }

        function executeSearch() {
            // --- Loading state ---
            btnText.style.display    = 'none';
            btnLoading.style.display = 'inline';
            btnPlan.disabled         = true;

            // --- Build query string to pass data to results page ---
            const fromLat = document.getElementById('city-from-lat').value;
            const fromLng = document.getElementById('city-from-lng').value;
            
            // Radius Search Fallback: If no destination, use start point
            const toLat   = document.getElementById('city-to-lat').value || fromLat;
            const toLng   = document.getElementById('city-to-lng').value || fromLng;
            const finalToCity = toCity || fromCity;

            const params = new URLSearchParams({
                from:       fromCity,
                to:         finalToCity,
                fromLat:    fromLat,
                fromLng:    fromLng,
                toLat:      toLat,
                toLng:      toLng,
                dateFrom:   fromDate,
                dateTo:     toDate,
                transport:  transport,
                activities: activities.join(','),
            });

            setTimeout(() => {
                window.location.href = `results.html?${params.toString()}`;
            }, 1200);
        }

        // --- Check for gems from a previous trip ---
        const existingGems = getSavedGems();
        if (existingGems.length > 0) {
            const modal = document.getElementById('basket-modal-overlay');
            const desc  = document.getElementById('basket-modal-desc');
            const btnFresh = document.getElementById('btn-basket-fresh');
            const btnKeep  = document.getElementById('btn-basket-keep');
            
            desc.textContent = `You have ${existingGems.length} gem${existingGems.length !== 1 ? 's' : ''} saved from a previous trip. Do you want to start fresh or keep them?`;
            modal.classList.add('active');
            
            // Wire buttons (cloning to prevent duplicate event listeners)
            const newBtnFresh = btnFresh.cloneNode(true);
            const newBtnKeep  = btnKeep.cloneNode(true);
            btnFresh.parentNode.replaceChild(newBtnFresh, btnFresh);
            btnKeep.parentNode.replaceChild(newBtnKeep, btnKeep);

            newBtnFresh.addEventListener('click', () => {
                localStorage.removeItem(STORAGE_KEY);
                ['planwise_stop_order','planwise_stop_notes','planwise_stop_duration',
                 'planwise_day_times','planwise_day_count'].forEach(k => localStorage.removeItem(k));
                modal.classList.remove('active');
                executeSearch();
            });

            newBtnKeep.addEventListener('click', () => {
                modal.classList.remove('active');
                executeSearch();
            });
        } else {
            executeSearch();
        }
    });

    } // end btnPlan guard

    // ==========================================
    // 4. HELPER — Show inline error message
    // ==========================================
    function showError(message) {
        // Remove any existing error
        const existing = document.querySelector('.form-error');
        if (existing) existing.remove();

        const error = document.createElement('p');
        error.className = 'form-error';
        error.textContent = message;
        error.style.cssText = `
            color: var(--accent);
            font-size: 0.85rem;
            font-weight: 600;
            text-align: center;
            margin-top: -0.5rem;
            animation: fadeIn 0.2s ease;
        `;

        const submitRow = document.querySelector('.submit-row');
        submitRow.parentNode.insertBefore(error, submitRow);

        // Auto-dismiss after 3 seconds
        setTimeout(() => error.remove(), 3000);
    }


    // ==========================================
    // 5. SAVE BUTTONS — Visual feedback
    // ==========================================
    const saveButtons = document.querySelectorAll('.btn-save');
    if (saveButtons.length > 0) {

    saveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.textContent = '✓ Saved';
            btn.style.background     = 'var(--green)';
            btn.style.borderColor    = 'var(--green)';
            btn.style.color          = '#fff';
            btn.disabled             = true;
        });
    });
    } // end save buttons guard

    // ==========================================
    // 6. ADD A GEM MODAL
    // ==========================================
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwOdnv2WxUJmY3E-E1_ZElJBhrE07M6wDVwldyiOrIZ_lwzzEtWrU4hwnzTjijCE_6Ng/exec';

    const modalOverlay    = document.getElementById('gem-modal-overlay');
    const modalClose      = document.getElementById('modal-close');
    const gemSubmit       = document.getElementById('gem-submit');
    const gemError        = document.getElementById('gem-error');
    const gemForm         = document.getElementById('gem-form');
    const gemSuccess      = document.getElementById('gem-success');
    const gemSuccessClose = document.getElementById('gem-success-close');

    // --- Open modal ---
    document.querySelectorAll('[data-open-gem-modal]').forEach(trigger => {
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            openGemModal();
        });
    });

    function openGemModal() {
        modalOverlay.classList.add('active');
        modalOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeGemModal() {
        modalOverlay.classList.remove('active');
        modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    modalClose.addEventListener('click', closeGemModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeGemModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGemModal();
    });

    // --- Reset on success close ---
    gemSuccessClose.addEventListener('click', () => {
        closeGemModal();
        setTimeout(() => {
            gemForm.style.display    = '';
            gemSuccess.style.display = 'none';
            gemForm.reset();
            // Reset submit button so user can submit another gem
            gemSubmit.disabled = false;
            gemSubmit.querySelector('.btn-text').style.display    = 'inline';
            gemSubmit.querySelector('.btn-loading').style.display = 'none';
            document.querySelectorAll('#gem-chips .chip, #dining-chips .chip')
                    .forEach(c => c.classList.remove('selected'));
            document.getElementById('gem-lat').value = '';
            document.getElementById('gem-lng').value = '';
            document.getElementById('dining-type-group').style.display  = 'none';
            document.getElementById('location-url-group').style.display = 'none';
            document.getElementById('photo-url-group').style.display    = 'none';
            document.getElementById('toggle-location-url').textContent  = 'Can\'t find it? Share a Waze or Google Maps link instead →';
            document.getElementById('toggle-photo-url').textContent     = 'No social post? Share a photo URL instead →';
        }, 300);
    });

    // Helper: fires on both click (desktop) and touchend (iOS inside modal)
    // touchend + preventDefault() bypasses the 300ms iOS delay for fixed/overflow containers
    function bindTap(el, handler) {
        let touchFired = false;
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            touchFired = true;
            handler.call(el, e);
            setTimeout(() => { touchFired = false; }, 500);
        });
        el.addEventListener('click', (e) => {
            if (touchFired) return; // prevent double-fire on touch devices
            handler.call(el, e);
        });
    }

    // --- Category chips — multi-select up to 3, shows dining type if Food selected ---
    document.querySelectorAll('#gem-chips .chip').forEach(chip => {
        bindTap(chip, function() {
            const selected   = [...document.querySelectorAll('#gem-chips .chip.selected')];
            const isSelected = chip.classList.contains('selected');

            if (isSelected) {
                chip.classList.remove('selected');
            } else {
                if (selected.length >= 3) {
                    showGemError('You can pick up to 3 categories ✨');
                    return;
                }
                chip.classList.add('selected');
            }

            // Show dining type if Food is among selected
            const anyFood = [...document.querySelectorAll('#gem-chips .chip.selected')]
                .some(c => c.dataset.value === 'food');
            const diningGroup = document.getElementById('dining-type-group');
            if (anyFood) {
                diningGroup.style.display       = 'flex';
                diningGroup.style.flexDirection = 'column';
                diningGroup.style.gap           = '0.4rem';
            } else {
                diningGroup.style.display = 'none';
                document.querySelectorAll('#dining-chips .chip')
                        .forEach(c => c.classList.remove('selected'));
            }
        });
    });

    // --- Dining type chips — single select ---
    document.querySelectorAll('#dining-chips .chip').forEach(chip => {
        bindTap(chip, function() {
            document.querySelectorAll('#dining-chips .chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        });
    });

    // --- "Can't find it?" toggle ---
    document.getElementById('toggle-location-url').addEventListener('click', (e) => {
        e.preventDefault();
        const group    = document.getElementById('location-url-group');
        const isHidden = group.style.display === 'none';
        group.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            group.style.flexDirection = 'column';
            group.style.gap           = '0.4rem';
        }
        e.target.textContent = isHidden
            ? 'Hide Waze / Google Maps link ↑'
            : 'Can\'t find it? Share a Waze or Google Maps link instead →';
    });

    // --- "No social post?" toggle ---
    document.getElementById('toggle-photo-url').addEventListener('click', (e) => {
        e.preventDefault();
        const group    = document.getElementById('photo-url-group');
        const isHidden = group.style.display === 'none';
        group.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) {
            group.style.flexDirection = 'column';
            group.style.gap           = '0.4rem';
        }
        e.target.textContent = isHidden
            ? 'Hide photo URL ↑'
            : 'No social post? Share a photo URL instead →';
    });

    // --- Submit ---
    gemSubmit.addEventListener('click', async () => {

        const handle       = document.getElementById('gem-handle').value.trim();
        const name         = document.getElementById('gem-name').value.trim();
        const locationName = document.getElementById('gem-location').value.trim();
        const lat          = document.getElementById('gem-lat').value;
        const lng          = document.getElementById('gem-lng').value;
        const locationUrl  = document.getElementById('gem-location-url')?.value.trim() || '';
        const categoryChips = [...document.querySelectorAll('#gem-chips .chip.selected')];
        const category      = categoryChips.map(c => c.dataset.value).join(',');
        const diningType    = document.querySelector('#dining-chips .chip.selected')?.dataset.value || '';
        const socialLink   = document.getElementById('gem-social').value.trim();
        const photoUrl     = document.getElementById('gem-photo')?.value.trim() || '';
        const hours        = document.getElementById('gem-hours').value.trim();
        const description  = document.getElementById('gem-description')?.value.trim() || '';
        const fullName     = document.getElementById('gem-fullname').value.trim();
        const email        = document.getElementById('gem-email').value.trim();
        const consent      = document.getElementById('gem-consent').checked;

        const photoGroupVisible    = document.getElementById('photo-url-group').style.display !== 'none';
        const locationGroupVisible = document.getElementById('location-url-group').style.display !== 'none';

        // --- Validation ---
        if (!handle)
            return showGemError('Please enter your name or handle 👤');
        if (!name)
            return showGemError('Please enter the destination name 📍');
        if (!locationName && !locationUrl)
            return showGemError('Please search for a location or paste a Waze / Maps link 🗺️');
        if (locationName && !lat)
            return showGemError('Please select a location from the dropdown — don\'t just type it 🗺️');
        if (!category)
            return showGemError('Please pick at least one category ✨');
        if (category.includes('food') && !diningType)
            return showGemError('Please select a dining type for food spots 🍽️');
        if (!socialLink && !photoUrl)
            return showGemError('Please share a social media link or a photo URL 🔗');

        // --- Loading state ---
        const btnText    = gemSubmit.querySelector('.btn-text');
        const btnLoading = gemSubmit.querySelector('.btn-loading');
        btnText.style.display    = 'none';
        btnLoading.style.display = 'inline';
        gemSubmit.disabled       = true;
        hideGemError();

        try {
            await fetch(APPS_SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors',
                headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                handle,
                destinationName:  name,
                locationName,
                lat,
                lng,
                locationUrl,
                category,
                diningType,
                socialLink,
                photoUrl,
                operatingHours:   hours,
                fullName,
                email,
                luckyDrawConsent: consent,
                description,
            }),
            });

            gemForm.style.display    = 'none';
            gemSuccess.style.display = 'flex';

        } catch (err) {
            showGemError('Something went wrong. Please try again 🙏');
            btnText.style.display    = 'inline';
            btnLoading.style.display = 'none';
            gemSubmit.disabled       = false;
        }
    });

    function showGemError(msg) {
        gemError.textContent   = msg;
        gemError.style.display = 'block';
        gemError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideGemError() {
        gemError.style.display = 'none';
    }

});

// ==========================================
// PLACES SEARCH — Fetch nearby attractions
// ==========================================
function searchNearbyPlaces(location, cityName, gridId, loadingId, emptyId, headerId, titleId, sectionLabel) {

    const grid    = document.getElementById(gridId);
    const loading = document.getElementById(loadingId);
    const empty   = emptyId ? document.getElementById(emptyId) : null;
    const header  = document.getElementById(headerId);
    const title   = document.getElementById(titleId);

    // Show loading, hide previous results
    grid.innerHTML        = '';
    loading.style.display = 'flex';
    if (empty) empty.style.display = 'none';
    header.style.display  = 'none';

    const mapEl  = document.getElementById('hidden-map');
    const map    = new google.maps.Map(mapEl, { center: location, zoom: 12 });
    const service = new google.maps.places.PlacesService(map);

    const types = [
        'tourist_attraction',
        'park',
        'museum',
        'zoo',
        'amusement_park',
        'beach',
        'shopping_mall',
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
            if (completed === types.length) {
                // Deduplicate by place_id, sort by rating, take top 6
                const seen = new Set();
                const unique = allResults
                    .filter(p => {
                        if (seen.has(p.place_id)) return false;
                        seen.add(p.place_id);
                        return true;
                    })
                    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
                    .slice(0, 6);

                loading.style.display = 'none';

                if (unique.length === 0) {
                    if (empty) empty.style.display = 'block';
                    return;
                }

                // Show section header
                title.textContent    = `${sectionLabel} — ${cityName}`;
                header.style.display = 'block';

                // Render cards
                unique.forEach((place, i) => {
                    const card = buildPlaceCard(place, i);
                    grid.appendChild(card);
                });
            }
        });
    });
}

// ==========================================
// CARD BUILDER — Turns a Places result into a card
// ==========================================
function buildPlaceCard(place, index) {

    const card = document.createElement('div');

    // Category tag — must be defined BEFORE card.dataset.category is set
    const types   = place.types || [];
    const tagInfo = getTagInfo(types);

    card.className = `feed-card${index === 1 || index === 4 ? ' tall' : ''}`;
    card.dataset.category = tagInfo.tag; // used by results page filter chips
    card.style.cursor = 'pointer';
    card.dataset.placeId = place.place_id;

    // Photo
    const photoUrl = place.photos && place.photos.length > 0
        ? place.photos[0].getUrl({ maxWidth: 500, maxHeight: 400 })
        : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80';

    // Rating
    const rating   = place.rating ? `⭐ ${place.rating} (${place.user_ratings_total || 0})` : '⭐ Not rated yet';

    // Open now
    const openNow  = place.opening_hours
        ? (place.opening_hours.isOpen() ? '✅ Open now' : '⚠️ Closed now')
        : '';

    card.innerHTML = `
        <div class="card-media" style="background-image: url('${photoUrl}')">
            <div class="card-platform ${tagInfo.platform}">${tagInfo.platformLabel}</div>
            <div class="card-views">${rating}</div>
        </div>
        <div class="card-body">
            <div class="card-tag ${tagInfo.tag}">${tagInfo.tagLabel}</div>
            <h3>${place.name}</h3>
            <p class="card-meta">📍 ${place.vicinity || ''}</p>
            ${openNow ? `<p class="card-warning">${openNow}</p>` : ''}
            <div class="card-footer">
                <span class="card-author">📍 Google Places</span>
                <button class="btn-save">+ Save</button>
            </div>
        </div>
    `;

    // Wire card click → open detail panel
    card.addEventListener('click', function (e) {
        if (e.target.closest('.btn-save')) return; // don't open panel if Save clicked
        openPlaceDetail(place.place_id, place);
    });

    // Wire save button (Toggles LocalStorage)
    const saveBtn = card.querySelector('.btn-save');
    const placeObj = {
        id: place.place_id,
        name: place.name,
        location: place.vicinity,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        photo: photoUrl,
        category: tagInfo.tag,
        source: 'google'
    };
    
    // Check initial state on load
    if (isGemSaved(placeObj.id)) {
        saveBtn.textContent = '✓ Saved';
        saveBtn.classList.add('btn-saved');
    }
    
    saveBtn.addEventListener('click', function () {
        toggleSaveGem(placeObj, this);
    });

    return card;
}

// ==========================================
// TAG HELPER — Maps Google place types to card styles
// ==========================================
function getTagInfo(types) {
    if (types.includes('park') || types.includes('natural_feature')) {
        return { tag: 'nature', tagLabel: 'Nature & Parks', platform: 'instagram', platformLabel: '📸 Google Places' };
    }
    if (types.includes('beach')) {
        return { tag: 'beach', tagLabel: 'Beach', platform: 'instagram', platformLabel: '📸 Google Places' };
    }
    if (types.includes('museum') || types.includes('art_gallery')) {
        return { tag: 'heritage', tagLabel: 'Museum & Culture', platform: 'youtube', platformLabel: '📍 Google Places' };
    }
    if (types.includes('zoo') || types.includes('aquarium')) {
        return { tag: 'family', tagLabel: 'Zoo & Wildlife', platform: 'youtube', platformLabel: '📍 Google Places' };
    }
    if (types.includes('amusement_park')) {
        return { tag: 'family', tagLabel: 'Theme Park', platform: 'tiktok', platformLabel: '▶ Google Places' };
    }
    if (types.includes('shopping_mall')) {
        return { tag: 'shopping', tagLabel: 'Shopping', platform: 'instagram', platformLabel: '📸 Google Places' };
    }
    if (types.includes('restaurant') || types.includes('cafe') || types.includes('bakery')) {
        return { tag: 'food', tagLabel: 'Food & Drink', platform: 'tiktok', platformLabel: '▶ Google Places' };
    }
    if (types.includes('spa')) {
        return { tag: 'wellness', tagLabel: 'Wellness & Spa', platform: 'instagram', platformLabel: '📸 Google Places' };
    }
    if (types.includes('night_club') || types.includes('bar')) {
        return { tag: 'nightlife', tagLabel: 'Nightlife', platform: 'tiktok', platformLabel: '▶ Google Places' };
    }
    if (types.includes('tourist_attraction') || types.includes('point_of_interest')) {
        return { tag: 'heritage', tagLabel: 'Tourist Attraction', platform: 'youtube', platformLabel: '📍 Google Places' };
    }
    return { tag: 'heritage', tagLabel: 'Attraction', platform: 'youtube', platformLabel: '📍 Google Places' };
}

// ==========================================
// DIVIDER TEXT — Updates when destination chosen
// ==========================================
function updateFeedDivider(cityName) {
    const el = document.getElementById('feed-divider-text');
    if (el) el.textContent = `🔥 Top Gems Discovered Near ${cityName}`;
}

// ==========================================
// PLACE DETAIL PANEL — Open + fetch details
// ==========================================
function openPlaceDetail(placeId, basicPlace) {

    const overlay  = document.getElementById('place-panel-overlay');
    const loading  = document.getElementById('panel-loading');
    const body     = document.querySelector('.place-panel-body');

    // Show panel in loading state
    loading.style.display = 'flex';
    body.style.display    = 'none';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Fetch full details
    const mapEl  = document.getElementById('hidden-map');
    const map    = new google.maps.Map(mapEl, { center: { lat: 3.14, lng: 101.68 }, zoom: 12 });
    const service = new google.maps.places.PlacesService(map);

    service.getDetails({
        placeId: placeId,
        fields: [
            'name', 'formatted_address', 'rating', 'user_ratings_total',
            'opening_hours', 'formatted_phone_number', 'website',
            'url', 'photos', 'types', 'editorial_summary'
        ],
    }, (place, status) => {

        loading.style.display = 'none';
        body.style.display    = 'flex';

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            document.getElementById('panel-name').textContent = basicPlace.name || 'Unknown Place';
            document.getElementById('panel-address').textContent = 'Could not load full details.';
            return;
        }

        // --- Photos ---
        const photoStrip = document.getElementById('panel-photos');
        photoStrip.innerHTML = '';
        const photos = place.photos ? place.photos.slice(0, 3) : [];
        if (photos.length > 0) {
            photos.forEach(photo => {
                const div = document.createElement('div');
                div.className = 'panel-photo';
                div.style.backgroundImage = `url('${photo.getUrl({ maxWidth: 600 })}')`;
                photoStrip.appendChild(div);
            });
        } else {
            photoStrip.style.background = 'var(--border)';
        }

        // --- Tag ---
        const tagRow  = document.getElementById('panel-tag-row');
        const tagInfo = getTagInfo(place.types || []);
        tagRow.innerHTML = `<div class="card-tag ${tagInfo.tag}">${tagInfo.tagLabel}</div>`;

        // --- Name + Address ---
        document.getElementById('panel-name').textContent    = place.name || '';
        document.getElementById('panel-address').textContent = place.formatted_address || '';

        // --- Description (editorial_summary — not always available) ---
        let descEl = document.getElementById('panel-description');
        if (!descEl) {
            descEl = document.createElement('p');
            descEl.id        = 'panel-description';
            descEl.className = 'gem-panel-desc'; // reuse existing desc style
            const addrEl = document.getElementById('panel-address');
            addrEl.parentNode.insertBefore(descEl, addrEl.nextSibling);
        }
        const summary = place.editorial_summary?.overview;
        descEl.textContent   = summary || '';
        descEl.style.display = summary ? 'block' : 'none';

        // --- Rating ---
        const ratingEl = document.getElementById('panel-rating');
        if (place.rating) {
            const stars = Math.round(place.rating);
            const starHtml = Array.from({ length: 5 }, (_, i) =>
                `<span class="rating-star">${i < stars ? '★' : '☆'}</span>`
            ).join('');
            ratingEl.innerHTML = `
                <div class="rating-stars">${starHtml}</div>
                <span>${place.rating}</span>
                <span class="rating-count">(${place.user_ratings_total || 0} reviews)</span>
            `;
        } else {
            ratingEl.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">No ratings yet</span>';
        }

        // --- Opening Hours ---
        const hoursSection = document.getElementById('panel-hours-section');
        const hoursList    = document.getElementById('panel-hours-list');
        if (place.opening_hours && place.opening_hours.weekday_text) {
            hoursSection.style.display = 'flex';
            hoursList.innerHTML = '';
            const today = new Date().getDay(); // 0 = Sunday
            place.opening_hours.weekday_text.forEach((line, i) => {
                const li = document.createElement('li');
                li.textContent = line;
                // weekday_text starts Monday (index 0), JS getDay() 0=Sun,1=Mon
                if ((i + 1) % 7 === today % 7) li.classList.add('today');
                hoursList.appendChild(li);
            });
        } else {
            hoursSection.style.display = 'none';
        }

        // --- Contact ---
        const contactSection = document.getElementById('panel-contact-section');
        const contactLinks   = document.getElementById('panel-contact-links');
        contactLinks.innerHTML = '';
        let hasContact = false;

        if (place.formatted_phone_number) {
            hasContact = true;
            contactLinks.innerHTML += `<a class="panel-contact-link" href="tel:${place.formatted_phone_number}">📞 ${place.formatted_phone_number}</a>`;
        }
        if (place.website) {
            hasContact = true;
            contactLinks.innerHTML += `<a class="panel-contact-link" href="${place.website}" target="_blank" rel="noopener">🌐 Visit Website</a>`;
        }
        contactSection.style.display = hasContact ? 'flex' : 'none';

        // --- Action Buttons ---
        const actions = document.getElementById('panel-actions');
        actions.innerHTML = '';
        if (place.url) {
            actions.innerHTML += `<a class="btn-panel-maps" href="${place.url}" target="_blank" rel="noopener">🗺️ Open in Google Maps</a>`;
        }
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn-panel-save';
        
        // Package the Google Place data
        const placeObj = {
            id: place.place_id,
            name: place.name || basicPlace.name,
            location: place.formatted_address || basicPlace.vicinity,
            lat: place.geometry?.location?.lat() || basicPlace.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng() || basicPlace.geometry?.location?.lng(),
            photo: place.photos && place.photos.length > 0 ? place.photos[0].getUrl({ maxWidth: 500 }) : '',
            category: getTagInfo(place.types || []).tag,
            source: 'google'
        };

        if (isGemSaved(placeObj.id)) {
            saveBtn.textContent = '✓ Saved';
            saveBtn.classList.add('btn-saved');
        } else {
            saveBtn.textContent = '+ Save';
        }

        saveBtn.addEventListener('click', function () {
            toggleSaveGem(placeObj, this);
        });
        
        actions.appendChild(saveBtn);
    });
}

// ==========================================
// PLACE DETAIL PANEL — Close
// ==========================================
function closePlaceDetail() {
    const overlay = document.getElementById('place-panel-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Wire close button + overlay click + Escape key
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('place-panel-close').addEventListener('click', closePlaceDetail);
    document.getElementById('place-panel-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('place-panel-overlay')) closePlaceDetail();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlaceDetail();
    });
});

// ==========================================
// GEM SYSTEM — Phase 1
// Thumbnail extraction, embed, card builder,
// detail panel, home page loader
// ==========================================

const GEMS_API_URL = 'https://script.google.com/macros/s/AKfycbwwOdnv2WxUJmY3E-E1_ZElJBhrE07M6wDVwldyiOrIZ_lwzzEtWrU4hwnzTjijCE_6Ng/exec';

// --- Detect platform from URL ---
function detectPlatform(url) {
    if (!url) return null;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    return null;
}

// --- Extract YouTube video ID ---
// Handles: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
function getYouTubeVideoId(url) {
    const patterns = [
        /[?&]v=([^&#]+)/,
        /youtu\.be\/([^?&#/]+)/,
        /youtube\.com\/shorts\/([^?&#/]+)/,
        /youtube\.com\/embed\/([^?&#/]+)/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

// --- Extract TikTok video ID ---
// Handles: tiktok.com/@user/video/12345
// Returns null for short URLs like vt.tiktok.com (no ID to extract)
function getTikTokVideoId(url) {
    const m = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    return m ? m[1] : null;
}

// --- Get thumbnail URL (async, cached in localStorage indefinitely) ---
async function getGemThumbnail(socialLink) {
    if (!socialLink) return null;

    // Check thumbnail cache — avoids repeated TikTok oEmbed calls on every page load
    try {
        const cache = JSON.parse(localStorage.getItem(THUMB_CACHE_KEY)) || {};
        if (cache[socialLink]) return cache[socialLink];
    } catch (_) {}

    const platform = detectPlatform(socialLink);
    let url = null;

    if (platform === 'youtube') {
        const id = getYouTubeVideoId(socialLink);
        if (id) url = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }

    if (platform === 'tiktok') {
        try {
            const res  = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(socialLink)}`);
            const data = await res.json();
            if (data.thumbnail_url) url = data.thumbnail_url;
        } catch (_) {
            // CORS blocked or TikTok rate-limited — fall through to null (branded placeholder)
        }
    }

    // Save to cache so next page load is instant
    if (url) {
        try {
            const cache = JSON.parse(localStorage.getItem(THUMB_CACHE_KEY)) || {};
            cache[socialLink] = url;
            localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(cache));
        } catch (_) {}
    }

    return url;
}

// --- Cache keys for performance ---
const GEM_CACHE_KEY  = 'planwise_gems_cache';
const THUMB_CACHE_KEY = 'planwise_thumb_cache';
const GEM_CACHE_TTL  = 5 * 60 * 1000; // 5 minutes — after this, re-fetch fresh data

// --- Fetch all approved gems (cached in localStorage for 5 min) ---
async function fetchApprovedGems() {
    try {
        const raw    = localStorage.getItem(GEM_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        const isFresh = cached && Array.isArray(cached.gems) && (Date.now() - cached.ts) < GEM_CACHE_TTL;
        if (isFresh) return cached.gems;
    } catch (_) {}

    try {
        const res  = await fetch(GEMS_API_URL);
        const data = await res.json();
        if (data.success && Array.isArray(data.gems)) {
            localStorage.setItem(GEM_CACHE_KEY, JSON.stringify({ ts: Date.now(), gems: data.gems }));
            return data.gems;
        }
    } catch (_) {}
    return [];
}

// --- Build a gem card DOM element (async) ---
async function buildGemCard(gem) {
    const platform  = detectPlatform(gem.socialLink);
    const thumbnail = await getGemThumbnail(gem.socialLink);

    // Handle comma-separated categories e.g. "food,beach,family"
    const categories = gem.category
        ? gem.category.split(',').map(c => c.trim()).filter(Boolean)
        : ['heritage'];

    const tagLabels = {
        food:'🍜 Food',     nature:'🌳 Nature',    beach:'🏖️ Beach',
        heritage:'🏛️ Heritage', family:'🎠 Family', nightlife:'🌆 Nightlife',
        wellness:'🧘 Wellness', shopping:'🛍️ Shopping',
    };
    const tagColors = {
        food:'#e67e22', nature:'#27ae60', beach:'#0099cc',
        heritage:'#c0392b', family:'#8e44ad', nightlife:'#6c3483',
        wellness:'#1a9e8f', shopping:'#d35400',
    };
    const platformMeta = {
        youtube: { label: '▶ YouTube', bg: '#FF0000' },
        tiktok:  { label: '♪ TikTok',  bg: '#010101' },
    };

    const platMeta = platformMeta[platform] || { label: '🔗 Social', bg: '#555' };
    const mediaBg  = thumbnail
        ? `background-image:url('${thumbnail}')`
        : `background:linear-gradient(135deg,#1a1a2e 0%,#2a2a4a 100%)`;

    // Up to 3 category tags — smaller size
    const tagsHtml = categories.slice(0, 3).map(cat =>
        `<span class="card-tag card-tag--small" style="background:${tagColors[cat]||'#555'};color:#fff;">${tagLabels[cat]||cat}</span>`
    ).join('');

    const card = document.createElement('div');
    card.className        = 'gem-card';
    card.dataset.category = gem.category; // full comma-separated string for filter chips
    card.style.cursor     = 'pointer';

    card.innerHTML = `
        <div class="gem-card-media" style="${mediaBg}">
            <div class="gem-card-platform" style="background:${platMeta.bg}">${platMeta.label}</div>
            <div class="gem-card-play" aria-hidden="true">▶</div>
            <div class="gem-card-badge">💎 Community Gem</div>
        </div>
        <div class="gem-card-body">
            <div class="gem-card-tags">${tagsHtml}</div>
            <h3>${gem.name}</h3>
            ${gem.description ? `<p class="gem-card-desc">${gem.description}</p>` : ''}
            <p class="gem-card-location">📍 ${gem.locationName || ''}</p>
            <div class="gem-card-footer">
                <span class="gem-card-author">by ${gem.handle}</span>
                <button class="btn-save gem-save-btn">+ Save</button>
            </div>
        </div>
    `;

    card.addEventListener('click', (e) => {
        if (e.target.closest('.gem-save-btn')) return;
        openGemPanel(gem, thumbnail);
    });

    const saveBtn = card.querySelector('.gem-save-btn');
    const gemObj = {
        id: 'gem_' + gem.name.replace(/\s+/g, '') + '_' + gem.lat,
        name: gem.name,
        location: gem.locationName,
        lat: gem.lat,
        lng: gem.lng,
        photo: thumbnail || '',
        category: categories[0] || 'heritage',
        source: 'community'
    };
    
    // Check initial state on load
    if (isGemSaved(gemObj.id)) {
        saveBtn.textContent = '✓ Saved';
        saveBtn.classList.add('btn-saved');
    }
    
    saveBtn.addEventListener('click', function () {
        toggleSaveGem(gemObj, this);
    });

    return card;
}

// --- Open gem detail panel ---
async function openGemPanel(gem, thumbnail) {
    const overlay      = document.getElementById('gem-panel-overlay');
    const embedSection = document.getElementById('gem-panel-embed');
    if (!overlay || !embedSection) return;

    const platform = detectPlatform(gem.socialLink);

    // --- Build embed ---
    embedSection.innerHTML = '';

    if (platform === 'youtube') {
        const videoId = getYouTubeVideoId(gem.socialLink);
        if (videoId) {
            embedSection.innerHTML = `
                <iframe
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                    frameborder="0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowfullscreen
                    class="gem-panel-iframe"
                ></iframe>`;
        }
    } else if (platform === 'tiktok') {
        try {
            // oEmbed handles both full URLs and short URLs (vt.tiktok.com)
            const res     = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(gem.socialLink)}`);
            const data    = await res.json();
            const videoId = data.embed_product_id;
            if (!videoId) throw new Error('No video ID');
            embedSection.innerHTML = `
                <iframe
                    src="https://www.tiktok.com/embed/v2/${videoId}"
                    frameborder="0"
                    allow="autoplay"
                    allowfullscreen
                    class="gem-panel-iframe gem-panel-iframe--tiktok"
                ></iframe>`;
        } catch (_) {
            // Fallback — Watch on TikTok button
            const thumb = thumbnail
                ? `<div class="gem-panel-thumb" style="background-image:url('${thumbnail}')"></div>`
                : `<div class="gem-panel-thumb gem-panel-thumb--empty">♪</div>`;
            embedSection.innerHTML = `
                <div class="gem-panel-tiktok-cta">
                    ${thumb}
                    <a href="${gem.socialLink}" target="_blank" rel="noopener" class="btn-watch-tiktok">
                        ♪ Watch on TikTok
                    </a>
                </div>`;
        }
    }

    // --- Tags ---
    const tagLabels = {
        food:'🍜 Food & Drink', nature:'🌳 Nature',    beach:'🏖️ Beach',
        heritage:'🏛️ Heritage', family:'🎠 Family',    nightlife:'🌆 Nightlife',
        wellness:'🧘 Wellness', shopping:'🛍️ Shopping',
    };
    const tagColors = {
        food:'#e67e22', nature:'#27ae60', beach:'#0099cc',
        heritage:'#c0392b', family:'#8e44ad', nightlife:'#6c3483',
        wellness:'#1a9e8f', shopping:'#d35400',
    };

    const categories = gem.category
        ? gem.category.split(',').map(c => c.trim()).filter(Boolean)
        : [];
    const tagRow = document.getElementById('gem-panel-tag-row');
    if (tagRow) {
        tagRow.innerHTML = categories.map(cat =>
            `<span class="card-tag" style="background:${tagColors[cat]||'#555'};color:#fff;">${tagLabels[cat]||cat}</span>`
        ).join('');
    }

    // --- Text fields ---
    document.getElementById('gem-panel-name').textContent     = gem.name;
    document.getElementById('gem-panel-location').textContent = `📍 ${gem.locationName || ''}`;
    document.getElementById('gem-panel-handle').textContent   = `💎 Shared by ${gem.handle}`;

    const descEl = document.getElementById('gem-panel-desc');
    if (descEl) {
        descEl.textContent   = gem.description || '';
        descEl.style.display = gem.description ? 'block' : 'none';
    }

    const hoursEl = document.getElementById('gem-panel-hours');
    hoursEl.textContent   = gem.hours ? `🕐 ${gem.hours}` : '';
    hoursEl.style.display = gem.hours ? 'block' : 'none';

    // --- Maps link — use location name so Google Maps shows readable result ---
    const mapsLink = document.getElementById('gem-panel-maps');
    if (gem.lat && gem.lng) {
        const query = gem.locationName
            ? encodeURIComponent(gem.locationName)
            : `${gem.lat},${gem.lng}`;
        mapsLink.href         = `https://www.google.com/maps/search/?api=1&query=${query}`;
        mapsLink.style.display= 'inline-block';
    } else if (gem.locationUrl) {
        mapsLink.href         = gem.locationUrl;
        mapsLink.style.display= 'inline-block';
    } else {
        mapsLink.style.display= 'none';
    }

    // --- Save button — reset + wire on every open ---
    const saveBtn = document.getElementById('gem-panel-save');
    if (saveBtn) {
        const newBtn = saveBtn.cloneNode(true); // cloning removes old listeners
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        // Package the Community Gem data exactly like the card does
        const gemObj = {
            id: 'gem_' + gem.name.replace(/\s+/g, '') + '_' + gem.lat,
            name: gem.name,
            location: gem.locationName,
            lat: gem.lat,
            lng: gem.lng,
            photo: thumbnail || '',
            category: categories[0] || 'heritage',
            source: 'community'
        };

        if (isGemSaved(gemObj.id)) {
            newBtn.textContent = '✓ Saved';
            newBtn.classList.add('btn-saved');
        } else {
            newBtn.textContent = '+ Save';
            newBtn.classList.remove('btn-saved');
        }

        newBtn.addEventListener('click', function () {
            toggleSaveGem(gemObj, this);
        });
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// --- Close gem detail panel ---
function closeGemPanel() {
    const overlay = document.getElementById('gem-panel-overlay');
    if (!overlay) return;
    // Clear embed so video stops playing
    const embedSection = document.getElementById('gem-panel-embed');
    if (embedSection) embedSection.innerHTML = '';
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Wire gem panel close buttons
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('gem-panel-close');
    const overlay  = document.getElementById('gem-panel-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeGemPanel);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeGemPanel();
        });
    }
});

// --- Load gems on the home page ---
// Fetches approved gems, picks up to 5 random ones, renders into #gems-row
async function loadHomeGems() {
    const section = document.getElementById('gems-section');
    const row     = document.getElementById('gems-row');
    if (!section || !row) return;

    const gems = await fetchApprovedGems();
    if (!gems.length) return;

    // Shuffle and pick 5
    const picks = gems
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

    // Build all cards concurrently (parallel thumbnail fetches)
    const cards = await Promise.all(picks.map(gem => buildGemCard(gem)));
    cards.forEach(card => row.appendChild(card));

    section.style.display = 'block';
}

// Auto-run on home page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('gems-section')) {
        loadHomeGems();
    }
});