// PlanWise App Logic — Revamped Landing Page
// Session A: Form interactions + redirect to results

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
            durationBadge.style.color = 'var(--dark)';
            durationBadge.style.display = 'block';
        } else {
            durationBadge.textContent = `${diffDays + 1} days / ${diffDays} nights`;
            durationBadge.style.background = 'var(--secondary)';
            durationBadge.style.color = 'var(--dark)';
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

});