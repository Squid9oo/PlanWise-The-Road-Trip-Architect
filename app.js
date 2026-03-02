// PlanWise App Logic — Revamped Landing Page
// Session A: Form interactions + redirect to results

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

            // Trigger departure card search
            const cityName = place.name || document.getElementById('city-from').value;
            searchNearbyPlaces(
                place.geometry.location,
                cityName,
                'from-grid',
                'from-loading',
                null,
                'from-section-header',
                'from-section-title',
                '🚩 Gems near your starting point'
            );
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

            // Trigger destination card search
            const cityName = place.name || document.getElementById('city-to').value;
            searchNearbyPlaces(
                place.geometry.location,
                cityName,
                'feed-grid',
                'feed-loading',
                'feed-empty',
                'feed-section-header',
                'feed-section-title',
                '🏁 Gems near your destination'
            );
            updateFeedDivider(cityName);
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

};

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. ACTIVITY CHIPS — Toggle selected state
    // ==========================================
    const chips = document.querySelectorAll('.chip');

    chips.forEach(chip => {
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
        if (!fromCity || !toCity) {
            showError('Please enter your departure and destination cities 📍');
            return;
        }
        if (new Date(toDate) < new Date(fromDate)) {
            showError('Your end date can\'t be before your start date 🤔');
            return;
        }

        // --- Loading state ---
        btnText.style.display    = 'none';
        btnLoading.style.display = 'inline';
        btnPlan.disabled         = true;

        // --- Build query string to pass data to results page ---
        const params = new URLSearchParams({
            from:       fromCity,
            to:         toCity,
            dateFrom:   fromDate,
            dateTo:     toDate,
            transport:  transport,
            activities: activities.join(','),
        });

        // Small delay so user sees "Finding your gems..." then redirect
        setTimeout(() => {
            window.location.href = `results.html?${params.toString()}`;
        }, 1200);
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

    // --- Category chips — single select, shows dining type if Food & Drink ---
    document.querySelectorAll('#gem-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#gem-chips .chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');

            const diningGroup = document.getElementById('dining-type-group');
            if (chip.dataset.value === 'food') {
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
        chip.addEventListener('click', () => {
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
        const category     = document.querySelector('#gem-chips .chip.selected')?.dataset.value || '';
        const diningType   = document.querySelector('#dining-chips .chip.selected')?.dataset.value || '';
        const socialLink   = document.getElementById('gem-social').value.trim();
        const photoUrl     = document.getElementById('gem-photo')?.value.trim() || '';
        const hours        = document.getElementById('gem-hours').value.trim();
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
            return showGemError('Please pick a category ✨');
        if (category === 'food' && !diningType)
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
        'mosque',
        'hindu_temple',
        'church',
        'beach',
        'shopping_mall',
        'campground',
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
    card.className = `feed-card${index === 1 || index === 4 ? ' tall' : ''}`;
    card.style.cursor = 'pointer';
    card.dataset.placeId = place.place_id;

    // Photo
    const photoUrl = place.photos && place.photos.length > 0
        ? place.photos[0].getUrl({ maxWidth: 500, maxHeight: 400 })
        : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80';

    // Category tag
    const types    = place.types || [];
    const tagInfo  = getTagInfo(types);

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

    // Wire save button
    card.querySelector('.btn-save').addEventListener('click', function () {
        this.textContent      = '✓ Saved';
        this.style.background = 'var(--green)';
        this.style.borderColor = 'var(--green)';
        this.style.color      = '#fff';
        this.disabled         = true;
    });

    return card;
}

// ==========================================
// TAG HELPER — Maps Google place types to card styles
// ==========================================
function getTagInfo(types) {
    if (types.includes('park') || types.includes('natural_feature') || types.includes('campground')) {
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
    if (types.includes('mosque') || types.includes('hindu_temple') || types.includes('church')) {
        return { tag: 'heritage', tagLabel: 'Religious Site', platform: 'youtube', platformLabel: '📍 Google Places' };
    }
    if (types.includes('shopping_mall')) {
        return { tag: 'shopping', tagLabel: 'Shopping', platform: 'instagram', platformLabel: '📸 Google Places' };
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
            'url', 'photos', 'types'
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
        saveBtn.className   = 'btn-panel-save';
        saveBtn.textContent = '+ Save';
        saveBtn.addEventListener('click', function () {
            this.textContent        = '✓ Saved';
            this.style.background   = 'var(--green)';
            this.style.borderColor  = 'var(--green)';
            this.style.color        = '#fff';
            this.disabled           = true;
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