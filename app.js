// PlanWise App Logic — Revamped Landing Page
// Session A: Form interactions + redirect to results

// ==========================================
// GOOGLE MAPS PLACES AUTOCOMPLETE
// Called automatically when Maps API loads
// ==========================================
window.initMap = function () {
    const locationInput = document.getElementById('gem-location');
    if (!locationInput) return; // only runs on pages with the modal

    const autocomplete = new google.maps.places.Autocomplete(locationInput, {
        componentRestrictions: { country: 'my' }, // Malaysia only
        fields: ['name', 'geometry', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            document.getElementById('gem-lat').value = '';
            document.getElementById('gem-lng').value = '';
            return;
        }
        document.getElementById('gem-lat').value = place.geometry.location.lat();
        document.getElementById('gem-lng').value = place.geometry.location.lng();
    });
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
    const dateFrom  = document.getElementById('date-from');
    const dateTo    = document.getElementById('date-to');
    const durationBadge = document.getElementById('trip-duration');

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


    // ==========================================
    // 3. FORM SUBMISSION — Validate + redirect
    // ==========================================
    const btnPlan    = document.getElementById('btn-plan');
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

    saveButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.textContent = '✓ Saved';
            btn.style.background     = 'var(--green)';
            btn.style.borderColor    = 'var(--green)';
            btn.style.color          = '#fff';
            btn.disabled             = true;
        });
    });

    // ==========================================
    // 6. ADD A GEM MODAL
    // ==========================================
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwwOdnv2WxUJmY3E-E1_ZElJBhrE07M6wDVwldyiOrIZ_lwzzEtWrU4hwnzTjijCE_6Ng/exec'; // ← paste your URL here

    const modalOverlay    = document.getElementById('gem-modal-overlay');
    const modalClose      = document.getElementById('modal-close');
    const gemSubmit       = document.getElementById('gem-submit');
    const gemError        = document.getElementById('gem-error');
    const gemForm         = document.getElementById('gem-form');
    const gemSuccess      = document.getElementById('gem-success');
    const gemSuccessClose = document.getElementById('gem-success-close');

    // --- Open modal from any "Add a Gem" trigger ---
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

    // Close via ✕ button
    modalClose.addEventListener('click', closeGemModal);

    // Close by clicking the dark overlay behind the modal
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeGemModal();
    });

    // Close with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeGemModal();
    });

    // Success screen close — resets form too
    gemSuccessClose.addEventListener('click', () => {
        closeGemModal();
        setTimeout(() => {
            gemForm.style.display    = '';
            gemSuccess.style.display = 'none';
            gemForm.reset();
            document.querySelectorAll('#gem-chips .chip').forEach(c => c.classList.remove('selected'));
            document.getElementById('gem-lat').value = '';
            document.getElementById('gem-lng').value = '';
        }, 300);
    });

    // --- Gem category chips — SINGLE select (not multi) ---
    document.querySelectorAll('#gem-chips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#gem-chips .chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        });
    });

    // --- Submit gem form ---
    gemSubmit.addEventListener('click', async () => {

        const handle       = document.getElementById('gem-handle').value.trim();
        const name         = document.getElementById('gem-name').value.trim();
        const locationName = document.getElementById('gem-location').value.trim();
        const lat          = document.getElementById('gem-lat').value;
        const lng          = document.getElementById('gem-lng').value;
        const category     = document.querySelector('#gem-chips .chip.selected')?.dataset.value || '';
        const socialLink   = document.getElementById('gem-social').value.trim();
        const hours        = document.getElementById('gem-hours').value.trim();

        // Validation
        if (!handle)                  return showGemError('Please enter your name or handle 👤');
        if (!name)                    return showGemError('Please enter the destination name 📍');
        if (!locationName || !lat)    return showGemError('Please select a location from the dropdown 🗺️');
        if (!category)                return showGemError('Please pick a category ✨');
        if (!socialLink)              return showGemError('Please paste a social media post link 🔗');

        // Loading state
        const btnText    = gemSubmit.querySelector('.btn-text');
        const btnLoading = gemSubmit.querySelector('.btn-loading');
        btnText.style.display    = 'none';
        btnLoading.style.display = 'inline';
        gemSubmit.disabled       = true;
        hideGemError();

        try {
            await fetch(APPS_SCRIPT_URL, {
                method:  'POST',
                mode:    'no-cors', // required for Apps Script
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    handle,
                    destinationName: name,
                    locationName,
                    lat,
                    lng,
                    category,
                    socialLink,
                    operatingHours: hours,
                }),
            });

            // no-cors means we can't read the response — assume success
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
    }

    function hideGemError() {
        gemError.style.display = 'none';
    }

});