// Load existing GCs from the config file
let gcConfig = {};

// Fetch the GC configuration from gcConfig.json
fetch('gcConfig.json')
    .then(response => response.json())
    .then(data => {
        gcConfig = data;
        displayGCs(); // Display the existing GCs
    })
    .catch(error => console.error('Error loading GC configurations:', error));

// Display the existing GCs
function displayGCs() {
    const gcList = document.getElementById('gc-list');
    gcList.innerHTML = ''; // Clear the list

    Object.keys(gcConfig).forEach(gcKey => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${gcConfig[gcKey].name}</strong> (Run Time: ${gcConfig[gcKey].runTime} minutes)
            <button onclick="editGC('${gcKey}')">Edit</button>
            <button onclick="deleteGC('${gcKey}')">Delete</button>
        `;
        gcList.appendChild(li);
    });
}

// Handle form submission for adding/updating GCs
document.getElementById('gc-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const gcName = document.getElementById('gc-name').value;
    const gcRuntime = parseInt(document.getElementById('gc-runtime').value, 10);

    // Generate a unique key for the GC
    const gcKey = gcName.toLowerCase().replace(/\s+/g, '');

    // Add or update the GC in the config
    gcConfig[gcKey] = { name: gcName, runTime: gcRuntime };
    displayGCs(); // Refresh the GC list

    // Clear the form
    document.getElementById('gc-form').reset();
});

// Edit an existing GC
function editGC(gcKey) {
    const gc = gcConfig[gcKey];
    document.getElementById('gc-name').value = gc.name;
    document.getElementById('gc-runtime').value = gc.runTime;
}

// Delete a GC
function deleteGC(gcKey) {
    delete gcConfig[gcKey];
    displayGCs(); // Refresh the GC list
}

// Save updated config (requires a backend for persistence)
function saveConfig() {
    fetch('/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gcConfig)
    })
    .then(response => response.json())
    .then(data => {
        alert('Configuration saved successfully!');
    })
    .catch(error => console.error('Error saving configuration:', error));
}
