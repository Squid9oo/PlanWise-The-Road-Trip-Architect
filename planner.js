// PlanWise — Trip Planner Logic (Pro Math Engine)
// Reads saved gems and automatically calculates cascading arrival times

document.addEventListener('DOMContentLoaded', () => {
    loadPlanner();
    
    // Listen for changes on the Master Start Time
    const startTimeInput = document.getElementById('trip-start-time');
    if (startTimeInput) {
        startTimeInput.addEventListener('change', calculateItineraryTimes);
    }
});

function getSavedGems() {
    return JSON.parse(localStorage.getItem('planwise_saved_gems')) || [];
}

function loadPlanner() {
    const listContainer = document.getElementById('itinerary-list');
    const emptyState = document.getElementById('planner-empty');
    const dashboard = document.getElementById('trip-dashboard');
    const savedGems = getSavedGems();

    listContainer.innerHTML = '';

    if (savedGems.length === 0) {
        listContainer.style.display = 'none';
        dashboard.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    listContainer.style.display = 'flex';
    dashboard.style.display = 'block';
    emptyState.style.display = 'none';

    savedGems.forEach((gem, index) => {
        const stopEl = document.createElement('div');
        stopEl.className = 'itinerary-stop';
        const photoUrl = gem.photo || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80';

        stopEl.innerHTML = `
            <div class="stop-number">${index + 1}</div>
            <div class="stop-card">
                <div class="stop-photo" style="background-image: url('${photoUrl}')"></div>
                <div class="stop-details">
                    <span class="card-tag card-tag--small ${gem.category}" style="width:fit-content; background:var(--dark); color:#fff;">${gem.category.toUpperCase()}</span>
                    <h3>${gem.name}</h3>
                    <p class="stop-location">📍 ${gem.location || 'Location details unavailable'}</p>
                    
                    <div class="time-row">
                        <div class="arrival-badge">
                            <span>🕒</span> <span class="arrival-time">--:--</span>
                        </div>
                        <select class="time-spent-select dash-group" style="padding: 0.3rem; min-width: 140px;">
                            <option value="30">Spend 30 mins</option>
                            <option value="60" selected>Spend 1 hour</option>
                            <option value="90">Spend 1.5 hours</option>
                            <option value="120">Spend 2 hours</option>
                        </select>
                    </div>

                    <button class="btn-remove-stop" onclick="removeStop('${gem.id}')">Remove stop</button>
                </div>
            </div>
        `;

        // Listen for changes on individual stop durations
        stopEl.querySelector('.time-spent-select').addEventListener('change', calculateItineraryTimes);
        listContainer.appendChild(stopEl);
    });

    // Run the math engine initially
    calculateItineraryTimes();
}

function calculateItineraryTimes() {
    const startTimeInput = document.getElementById('trip-start-time').value; // e.g. "09:00"
    if (!startTimeInput) return;

    let [hours, minutes] = startTimeInput.split(':').map(Number);
    let currentTime = new Date();
    currentTime.setHours(hours, minutes, 0, 0);

    const stops = document.querySelectorAll('.itinerary-stop');
    
    stops.forEach((stop, index) => {
        // 1. Set Arrival Time on the badge
        const arrivalText = stop.querySelector('.arrival-time');
        if (arrivalText) {
            arrivalText.textContent = formatTime(currentTime);
        }

        // 2. Read "Time Spent" and add it to the clock
        const timeSpentSelect = stop.querySelector('.time-spent-select');
        const timeSpentMins = timeSpentSelect ? parseInt(timeSpentSelect.value) : 60;
        currentTime.setMinutes(currentTime.getMinutes() + timeSpentMins);

        // 3. Add Simulated Drive Time to the NEXT stop (e.g., 45 minutes)
        if (index < stops.length - 1) {
            currentTime.setMinutes(currentTime.getMinutes() + 45);
        }
    });
}

function formatTime(dateObj) {
    return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

window.removeStop = function(id) {
    let saved = getSavedGems();
    saved = saved.filter(g => g.id !== id);
    localStorage.setItem('planwise_saved_gems', JSON.stringify(saved));
    loadPlanner();
};