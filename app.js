// Fake backend data (hardcoded GC configurations)
const gcConfig = {
    "2024": { name: "2024", runTime: 25.50, type: "Energy" },
    "1708": { name: "1708", runTime: 20.00, type: "Energy" },
    "2181": { name: "2181", runTime: 30.00, type: "Energy" },
    "1772": { name: "1772", runTime: 15.50, type: "Sulphur" },
    "1709": { name: "1709", runTime: 15.00, type: "Sulphur" },
    "2180": { name: "2180", runTime: 15.00, type: "Sulphur" }
};

// Helper function to format time in 12-hour clock with seconds
function formatTime(date) {
    const hours = date.getHours() % 12 || 12; // Convert to 12-hour format
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
    return `${hours}:${minutes}:${seconds} ${ampm}`;
}

// Helper function to parse time input from the browser or user
function parseStartTime(input) {
    input = input.trim();

    // Handle 24-hour time format (e.g., "16:00")
    if (/^\d{2}:\d{2}$/.test(input)) {
        const [hours, minutes] = input.split(':').map(Number);
        const date = new Date("1970-01-01T00:00:00");
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    // Handle 12-hour time format (e.g., "4 PM" or "04:00 PM")
    const regex = /^(\d{1,2}):?(\d{2})?\s?(AM|PM)$/i;
    const match = input.match(regex);

    if (!match) {
        throw new Error("Invalid time format. Please use a valid format like 4 PM, 04:00 PM, or 16:00.");
    }

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2] || "0", 10);
    const ampm = match[3]?.toUpperCase();

    const date = new Date("1970-01-01T00:00:00");
    date.setHours(
        ampm === "PM" && hours !== 12 ? hours + 12 : ampm === "AM" && hours === 12 ? 0 : hours,
        minutes,
        0,
        0
    );
    return date;
}

// Populate the GC dropdown using fake backend data
function populateGCOptions() {
    const gcDropdown = document.getElementById('gc-type');
    Object.keys(gcConfig).forEach(gcKey => {
        const option = document.createElement('option');
        option.value = gcKey;
        option.textContent = `${gcConfig[gcKey].name} (Run Time: ${gcConfig[gcKey].runTime} minutes)`;
        gcDropdown.appendChild(option);
    });

    // Set the default wait time when the page loads
    updateWaitTime(gcDropdown.value);
}

// Update the wait time dropdown based on GC type
function updateWaitTime(gcKey) {
    const waitTimeDropdown = document.getElementById('wait-time');
    const gcType = gcConfig[gcKey]?.type;

    // Set default wait time based on GC type
    if (gcType === "Energy") {
        waitTimeDropdown.value = "yes"; // Default to "Yes" for Energy GCs
    } else if (gcType === "Sulphur") {
        waitTimeDropdown.value = "no"; // Default to "No" for Sulphur GCs
    }
}

// Populate the Position dropdown (exclude 1, 2, and 16)
function populatePositionOptions() {
    const positionDropdown = document.getElementById('position');
    const fullBatchOption = document.createElement('option');
    fullBatchOption.value = "full-batch";
    fullBatchOption.textContent = "Full Batch";
    positionDropdown.appendChild(fullBatchOption);

    for (let i = 3; i <= 32; i++) {
        if (i === 16) continue; // Skip position 16
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Position ${i}`;
        positionDropdown.appendChild(option);
    }
}

// Run this on page load
populateGCOptions();
populatePositionOptions();

// Listen for changes to the GC dropdown to dynamically update the wait time
document.getElementById('gc-type').addEventListener('change', (event) => {
    const selectedGC = event.target.value;
    updateWaitTime(selectedGC);
});

// Handle form submission for calculations
document.getElementById('batch-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const selectedGC = document.getElementById('gc-type').value;
    let position = document.getElementById('position').value;
    const waitTime = document.getElementById('wait-time').value;
    const startTimeInput = document.getElementById('start-time').value;

    if (!selectedGC || !position || !startTimeInput) {
        alert("Please fill out all fields.");
        return;
    }

    // Convert "Full Batch" to 32 positions
    if (position === "full-batch") {
        position = 32;
    } else {
        position = parseInt(position, 10);
    }

    // Parse the start time
    let startTime;
    try {
        startTime = parseStartTime(startTimeInput);
    } catch (error) {
        alert(error.message);
        return;
    }

    // Get GC run time
    const runTime = gcConfig[selectedGC].runTime;

    // Start building the results
    const resultsTableBody = document.querySelector('#results-table tbody');
    resultsTableBody.innerHTML = '';

    let currentTime = new Date(startTime);
    const allRuns = [];

    // Add the 15-minute wait if "Yes" is selected
    if (waitTime === "yes") {
        const waitEndTime = new Date(currentTime);
        waitEndTime.setMinutes(currentTime.getMinutes() + 15);
        allRuns.push({
            label: "15-Minute Wait",
            startTime: formatTime(currentTime),
            endTime: formatTime(waitEndTime)
        });
        currentTime = waitEndTime;
    }

    // Add the two blank runs
    for (let i = 1; i <= 2; i++) {
        const blankEndTime = new Date(currentTime);
        blankEndTime.setMinutes(currentTime.getMinutes() + runTime);
        allRuns.push({
            label: `Blank ${i}`,
            startTime: formatTime(currentTime),
            endTime: formatTime(blankEndTime)
        });
        currentTime = blankEndTime;
    }

    // Add batch runs
    for (let i = 3; i <= position; i++) {
        if (i === 16) continue; // Skip position 16
        const batchEndTime = new Date(currentTime);
        batchEndTime.setMinutes(currentTime.getMinutes() + runTime);
        allRuns.push({
            label: `Position ${i}`,
            startTime: formatTime(currentTime),
            endTime: formatTime(batchEndTime)
        });
        currentTime = batchEndTime;
    }

    // Add the second control run
    const control2EndTime = new Date(currentTime);
    control2EndTime.setMinutes(currentTime.getMinutes() + runTime);
    allRuns.push({
        label: "Control 2",
        startTime: formatTime(currentTime),
        endTime: formatTime(control2EndTime)
    });
    currentTime = control2EndTime;

    // Find the closest valid row to 4:00 PM (16:00)
    const endOfWork = new Date("1970-01-01T16:00:00"); // 4:00 PM
    let closestRow = null;
    let closestTimeDifference = Infinity;

    allRuns.forEach((run) => {
        // Skip invalid rows like "Wait" and "Blanks"
        if (run.label.toLowerCase().includes("wait") || run.label.toLowerCase().includes("blank")) return;

        // Parse the run's end time into a Date object
        const [time, period] = run.endTime.split(" ");
        const [hours, minutes, seconds] = time.split(":").map(Number);
        const adjustedHours = period === "PM" && hours !== 12 ? hours + 12 : hours === 12 && period === "AM" ? 0 : hours;
        const runEndTime = new Date("1970-01-01T00:00:00");
        runEndTime.setHours(adjustedHours, minutes, seconds || 0);

        // Calculate the time difference
        const timeDifference = endOfWork - runEndTime;

        // If the run ends before 4:00 PM and is closer than the previous closest, update
        if (timeDifference >= 0 && timeDifference < closestTimeDifference) {
            closestRow = run;
            closestTimeDifference = timeDifference;
        }
    });

    // Add summary rows
    const summaryPositionRow = document.createElement('tr');
    summaryPositionRow.innerHTML = `
        <td colspan="2"><strong>Closest Position Before 4:00 PM</strong></td>
        <td><strong>${closestRow?.label || "N/A"} (${closestRow?.endTime || "N/A"})</strong></td>
    `;
    resultsTableBody.appendChild(summaryPositionRow);

    const summaryEndTimeRow = document.createElement('tr');
    summaryEndTimeRow.innerHTML = `
        <td colspan="2"><strong>Batch Finish Time</strong></td>
        <td><strong>${formatTime(currentTime)}</strong></td>
    `;
    resultsTableBody.appendChild(summaryEndTimeRow);

// Calculate time gap to 7:30 AM (next day if needed)
let startOfWork = new Date("1970-01-01T07:30:00"); // 7:30 AM

// Adjust startOfWork to the next day if the batch ends after 7:30 AM
if (currentTime >= startOfWork) {
    startOfWork.setDate(startOfWork.getDate() + 1); // Move to the next day
}

const timeGapInMinutes = (startOfWork - currentTime) / (1000 * 60); // Difference in minutes

// Convert to hours and minutes
const gapHours = Math.floor(timeGapInMinutes / 60);
const gapMinutes = Math.abs(timeGapInMinutes % 60); // Use absolute value for positive minutes

const gapString = `${gapHours} hour(s) and ${gapMinutes} minute(s) until 7:30 AM`;

const timeGapRow = document.createElement('tr');
timeGapRow.innerHTML = `
    <td colspan="2"><strong>Time Gap to 7:30 AM</strong></td>
    <td><strong>${gapString}</strong></td>
`;
resultsTableBody.appendChild(timeGapRow);


    // Add all run details
    allRuns.forEach(run => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${run.label}</td>
            <td>${run.startTime}</td>
            <td>${run.endTime}</td>
        `;
        resultsTableBody.appendChild(row);

        // Highlight the closest row
        if (closestRow && run.label === closestRow.label) {
            row.classList.add('highlight');
        }
    });
});
