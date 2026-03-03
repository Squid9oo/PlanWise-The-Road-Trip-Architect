// PlanWise — Trip Planner Logic (Session 10)
// Reads saved gems from localStorage and renders the itinerary timeline

document.addEventListener('DOMContentLoaded', () => {
    loadPlanner();
});

function getSavedGems() {
    return JSON.parse(localStorage.getItem('planwise_saved_gems')) || [];
}

function loadPlanner() {
    const listContainer = document.getElementById('itinerary-list');
    const emptyState = document.getElementById('planner-empty');
    const savedGems = getSavedGems();

    // Clear the current list
    listContainer.innerHTML = '';

    if (savedGems.length === 0) {
        listContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    listContainer.style.display = 'flex';
    emptyState.style.display = 'none';

    // Loop through saved items and build the stops
    savedGems.forEach((gem, index) => {
        const stopEl = document.createElement('div');
        stopEl.className = 'itinerary-stop';
        
        // Fallback for missing photos
        const photoUrl = gem.photo || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80';

        stopEl.innerHTML = `
            <div class="stop-number">${index + 1}</div>
            <div class="stop-card">
                <div class="stop-photo" style="background-image: url('${photoUrl}')"></div>
                <div class="stop-details">
                    <span class="card-tag card-tag--small ${gem.category}" style="width:fit-content; background:var(--dark); color:#fff;">${gem.category.toUpperCase()}</span>
                    <h3>${gem.name}</h3>
                    <p class="stop-location">📍 ${gem.location || 'Location details unavailable'}</p>
                    <button class="btn-remove-stop" onclick="removeStop('${gem.id}')">Remove stop</button>
                </div>
            </div>
        `;

        listContainer.appendChild(stopEl);
    });
}

// Global function to remove a stop and refresh the UI
window.removeStop = function(id) {
    let saved = getSavedGems();
    // Filter out the item with the matching ID
    saved = saved.filter(g => g.id !== id);
    // Save back to local storage
    localStorage.setItem('planwise_saved_gems', JSON.stringify(saved));
    // Reload the UI
    loadPlanner();
};