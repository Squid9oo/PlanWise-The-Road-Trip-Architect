// PlanWise App Logic - Session A: Add to Trip
document.addEventListener('DOMContentLoaded', () => {
    const addButtons = document.querySelectorAll('.btn-add');
    const itineraryList = document.querySelector('.cart-drop-zone');
    const placeholder = document.querySelector('.placeholder');

    addButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // 1. Get the data from the card we clicked
            const card = e.target.closest('.card');
            const title = card.querySelector('h4').innerText;
            const info = card.querySelector('.dist').innerText;

            // 2. Hide the "Drag stops here" text if it's there
            if (placeholder) {
                placeholder.style.display = 'none';
            }

            // 3. Create a new "stop" for our timeline
            const newStop = document.createElement('div');
            newStop.className = 'timeline-item added-stop';
            
            // We'll give it a random time for now to simulate a schedule
            const randomTime = Math.floor(Math.random() * 12) + 1 + ":00 PM";

            newStop.innerHTML = `
                <span class="time">${randomTime}</span>
                <div class="stop-details">
                    <strong>${title}</strong>
                    <p style="font-size: 0.8rem; margin: 0;">${info}</p>
                    <button class="btn-remove" style="color:red; border:none; background:none; cursor:pointer; padding:0; font-size:0.7rem;">Remove</button>
                </div>
            `;

            // 4. Add it to the sidebar
            itineraryList.appendChild(newStop);

            // 5. Bonus: Make the "Remove" button work too
            newStop.querySelector('.btn-remove').addEventListener('click', () => {
                newStop.remove();
                if (itineraryList.children.length === 1) { // Only placeholder left (conceptually)
                    placeholder.style.display = 'block';
                }
            });

            // 6. Visual feedback
            button.innerText = "✓ Added";
            button.style.backgroundColor = "#27ae60";
            button.style.color = "white";
            setTimeout(() => {
                button.innerText = "+ Add to Trip";
                button.style.backgroundColor = "transparent";
                button.style.color = "var(--primary)";
            }, 2000);
        });
    });
});