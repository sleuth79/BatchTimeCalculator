document.addEventListener("DOMContentLoaded", () => {
    // Tab management: Mapping tab IDs to their corresponding content sections
    const tabs = {
        "standard-batch": document.getElementById("standard-batch-content"),
        "time-delay": document.getElementById("time-delay-content"),
        "misc-batch": document.getElementById("misc-batch-content"),
        "config": document.getElementById("config-content"),
    };

    // Function to show the selected tab and hide others
    function showTab(selectedTabId) {
        Object.keys(tabs).forEach(tabId => {
            tabs[tabId].style.display = tabId === selectedTabId ? "block" : "none";
        });

        // Update navigation bar active class
        document.querySelectorAll("#nav-bar a").forEach(link => {
            link.classList.toggle("active", link.id === selectedTabId);
        });
    }

    // Attach click event listeners to navigation bar links
    document.querySelectorAll("#nav-bar a").forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default anchor behavior
            const selectedTabId = event.target.id;
            showTab(selectedTabId); // Show the corresponding tab
        });
    });

    // Show the "Standard Batch Mode" tab by default on page load
    showTab("standard-batch");

    // Dropdown and form elements
    const gcTypeDropdown = document.getElementById("gc-type");
    const batchPositionDropdown = document.getElementById("batch-position");
    const waitTimeSection = document.getElementById("wait-time-section");
    const batchForm = document.getElementById("batch-form");
    const nonStandardBatchForm = document.getElementById("non-standard-batch-form");

    const startTimeElement = document.getElementById("start-time");
    if (!startTimeElement) {
        console.error("Start time element not found.");
    }

    const gcTypeNonStandardDropdown = document.getElementById("gc-type-non-standard");
    const numberOfRunsInput = document.getElementById("number-of-runs");
    const startTimeNonStandard = document.getElementById("start-time-non-standard");
    const nonStandardResults = document.getElementById("non-standard-results");

    // Fetch GC configurations from the backend
    fetch(`${process.env.RENDER_URL || 'http://localhost:10000'}/api/gc-config`)
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to fetch GC configurations");
            }
            return response.json();
        })
        .then(data => {
            console.log("Fetched GC Configurations:", data);

            // Populate the GC Type dropdowns with options
            Object.keys(data).forEach(gcKey => {
                const gc = data[gcKey];
                const optionStandard = document.createElement("option");
                optionStandard.value = gcKey;
                optionStandard.textContent = `${gc.name} (${gc.runTime} mins)`;
                gcTypeDropdown.appendChild(optionStandard);

                const optionNonStandard = document.createElement("option");
                optionNonStandard.value = gcKey;
                optionNonStandard.textContent = `${gc.name} (${gc.runTime} mins)`;
                gcTypeNonStandardDropdown.appendChild(optionNonStandard);
            });

            //Add GC options for Time Delay Calculator
            const gcTypeTimeDelayDropdown = document.getElementById("gc-type-time-delay");
            if (gcTypeTimeDelayDropdown) {
                Object.keys(data).forEach(gcKey => {
                    const gc = data[gcKey];
                    const optionTimeDelay = document.createElement("option");
                    optionTimeDelay.value = gcKey;
                    optionTimeDelay.textContent = `${gc.name} (${gc.runTime} mins)`; // Corrected string interpolation
                    gcTypeTimeDelayDropdown.appendChild(optionTimeDelay);
                });
            } else {
                console.error("Time Delay Calculator GC dropdown element not found.");
            }

            // Populate the Position dropdown for Standard Batch
            const fullBatchOption = document.createElement("option");
            fullBatchOption.value = "full-batch";
            fullBatchOption.textContent = "Full Batch (32 Positions)";
            fullBatchOption.selected = true;
            batchPositionDropdown.appendChild(fullBatchOption);

            const positions = Array.from({ length: 32 }, (_, i) => i + 1);
            positions.forEach(pos => {
                if (pos > 2 && pos !== 16) {
                    const option = document.createElement("option");
                    option.value = pos;
                    option.textContent = `Position ${pos}`;
                    batchPositionDropdown.appendChild(option);
                }
            });

            // Add event listener to GC Type dropdown to toggle Wait Time section
            gcTypeDropdown.addEventListener("change", () => {
                console.log("GC Type Selected:", gcTypeDropdown.value);
                const selectedGC = data[gcTypeDropdown.value];
                if (selectedGC && selectedGC.type === "Energy") {
                    waitTimeSection.classList.remove("hidden");
                } else {
                    waitTimeSection.classList.add("hidden");
                }
            });
        })
        .catch(error => {
            console.error("Error fetching GC configurations:", error);
            alert("Failed to load GC configurations. Please check the server.");
        });

    // Handle form submission for Standard Batch
    batchForm.addEventListener("submit", (e) => {
        e.preventDefault(); // Prevent default page reload

        const gcType = gcTypeDropdown.value;
        const startTime = document.getElementById("start-time").value;
        const batchPosition = batchPositionDropdown.value;
        const waitTime = document.querySelector('input[name="wait-time"]:checked')?.value || "no";

        // Validate required fields
        if (!gcType || !startTime || !batchPosition) {
            alert("Please select all inputs: GC Type, Start Time, and Position.");
            return;
        }

        performCalculations(gcType, startTime, batchPosition, waitTime);
    });

    // Handle form submission for Non-Standard Batch
    nonStandardBatchForm.addEventListener("submit", (e) => {
        e.preventDefault(); // Prevent default page reload

        const gcType = gcTypeNonStandardDropdown.value;
        const numberOfRuns = parseInt(numberOfRunsInput.value, 10);
        const startTime = startTimeNonStandard.value;

        // Validate required fields
        if (!gcType || isNaN(numberOfRuns) || numberOfRuns <= 0 || !startTime) {
            alert("Please fill in all fields.");
            return;
        }

        performNonStandardCalculations(gcType, numberOfRuns, startTime);
    });

    // Perform Non-Standard Batch Calculations
    function performNonStandardCalculations(gcType, numberOfRuns, startTime) {
        fetch("http://localhost:3000/api/gc-config")
            .then(response => response.json())
            .then(data => {
                const gcDetails = data[gcType];
                if (!gcDetails) {
                    alert("GC Type not found in configurations.");
                    return;
                }

                const runTime = parseFloat(gcDetails.runTime);
                if (isNaN(runTime) || runTime <= 0) {
                    alert("Invalid run time. Please ensure it is a positive number.");
                    return;
                }

                const startDateTime = new Date(`1970-01-01T${startTime}:00`);
                if (isNaN(startDateTime.getTime())) {
                    alert("Invalid Start Time. Please enter a valid time.");
                    return;
                }

                let totalRuntime = 0;
                let runList = "<table><thead><tr><th>Run</th><th>End Time</th></tr></thead><tbody>";

                for (let i = 1; i <= numberOfRuns; i++) {
                    const currentRunTime = totalRuntime + runTime;
                    const runDateTime = new Date(startDateTime.getTime() + currentRunTime * 60000);
                    const runTimeString = runDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

                    runList += `<tr><td>Run ${i}</td><td>${runTimeString}</td></tr>`;
                    totalRuntime += runTime;
                }

                runList += "</tbody></table>";

                const endDateTime = new Date(startDateTime.getTime() + totalRuntime * 60000);
                const endTime = endDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

                // Display results
                nonStandardResults.innerHTML = `
                    <p><strong>GC Type:</strong> ${gcDetails.name}</p>
                    <p><strong>Start Time:</strong> ${startTime}</p>
                    <p><strong>Number of Runs:</strong> ${numberOfRuns}</p>
                    <p><strong>End Time:</strong> ${endTime}</p>
                    <h3>Run Details:</h3>
                    ${runList}
                `;
            })
            .catch(error => {
                console.error("Error performing calculations:", error);
                alert("Failed to load GC configurations. Please check the server.");
            });
    }
});

function performCalculations(gcType, startTime, batchPosition, waitTime = "no") {
    fetch("http://localhost:10000/api/gc-config")
        .then(response => response.json())
        .then(data => {
            const gcDetails = data[gcType];
            if (!gcDetails) {
                alert("GC Type not found in configurations.");
                return;
            }

            const runTime = parseFloat(gcDetails.runTime);
            if (isNaN(runTime) || runTime <= 0) {
                alert("Invalid run time. Please ensure it is a positive number.");
                return;
            }

            const startDateTime = new Date(`1970-01-01T${startTime}:00`);
            if (isNaN(startDateTime.getTime())) {
                alert("Invalid Start Time. Please enter a valid time.");
                return;
            }

            const formatTimeWithAmPm = (time24) => {
                const [hours, minutes] = time24.split(":").map(Number);
                const period = hours >= 12 ? "PM" : "AM";
                const adjustedHours = hours % 12 || 12; // Convert 0 or 24 to 12
                return `${adjustedHours}:${minutes.toString().padStart(2, "0")} ${period}`;
            };

            const formattedStartTime = formatTimeWithAmPm(startTime);

            const endOfWork = new Date("1970-01-01T16:00:00"); // 4:00 PM
            let runs = [];
            let totalRuntime = 0;
            let closestBefore4PM = { position: null, time: null };
            let runList = "<table><thead><tr><th>Run</th><th>Position</th><th>End Time</th></tr></thead><tbody>";

            if (waitTime === "yes" && gcDetails.type === "Energy") {
                const waitEndDateTime = new Date(startDateTime.getTime() + 15 * 60000);
                const waitEndTimeString = waitEndDateTime.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    second: "2-digit", 
                    hour12: true 
                });
                runList += `<tr><td>Wait Time</td><td>N/A</td><td>${formattedStartTime} to ${waitEndTimeString}</td></tr>`;
                totalRuntime += 15;
            }

            runs.push({ type: "Blank", position: 1 });
            runs.push({ type: "Blank", position: 2 });
            runs.push({ type: "Initial Control", position: "Initial Control" });

            if (batchPosition === "full-batch") {
                for (let i = 3; i <= 32; i++) {
                    if (i !== 16) {
                        runs.push({ type: "Position", position: i });
                    }
                }
            } else {
                const numPositions = parseInt(batchPosition, 10);
                for (let i = 3; i <= numPositions; i++) {
                    if (i !== 16) {
                        runs.push({ type: "Position", position: i });
                    }
                }
            }

            runs.push({ type: "Final Control", position: "Final Control" });

            runs.forEach((run, index) => {
                const currentRunTime = totalRuntime + runTime;
                const runDateTime = new Date(startDateTime.getTime() + currentRunTime * 60000);
                const runTimeString = runDateTime.toLocaleTimeString([], { 
                    hour: "2-digit", 
                    minute: "2-digit", 
                    second: "2-digit", 
                    hour12: true 
                });

                run.time = runTimeString;
                totalRuntime += runTime;

                if (runDateTime < endOfWork) {
                    closestBefore4PM = {
                        position: run.position,
                        time: runTimeString,
                    };
                }

                runList += `<tr><td>Run ${index + 1}</td><td>${run.position}</td><td>${run.time}</td></tr>`;
            });

            runList += "</tbody></table>";

            const endDateTime = new Date(startDateTime.getTime() + totalRuntime * 60000);
            const endTime = endDateTime.toLocaleTimeString([], { 
                hour: "2-digit", 
                minute: "2-digit", 
                second: "2-digit", 
                hour12: true 
            });

            const nextWorkDay = new Date(endDateTime);
            nextWorkDay.setDate(nextWorkDay.getDate() + (endDateTime.getHours() < 7 || (endDateTime.getHours() === 7 && endDateTime.getMinutes() < 30) ? 0 : 1));
            nextWorkDay.setHours(7, 30, 0, 0);

            const timeDelayMs = nextWorkDay - endDateTime;
            const timeDelayHours = Math.floor(timeDelayMs / (1000 * 60 * 60));
            let timeDelayMinutes = (timeDelayMs % (1000 * 60 * 60)) / (1000 * 60);
            timeDelayMinutes = Math.round(timeDelayMinutes);

            document.getElementById("results").innerHTML = `
                <p><strong>Selected GC:</strong> ${gcDetails.name}</p>
                <p><strong>Start Time:</strong> ${formattedStartTime}</p>
                <p><strong>Final Batch Position:</strong> ${
                    batchPosition === "full-batch"
                        ? "Full Batch (3–32)"
                        : `Position ${batchPosition}`
                }</p>
                <p><strong>Total Runs:</strong> ${runs.length}</p>
                <p><strong>End Time:</strong> ${endTime}</p>
                <p><strong>Closest Position Before 4:00 PM:</strong> ${
                    closestBefore4PM.position
                        ? `Position ${closestBefore4PM.position} at ${closestBefore4PM.time}`
                        : "No runs before 4:00 PM"
                }</p>
                <p><strong>Time Delay to 7:30 AM:</strong> ${timeDelayHours} hours, ${timeDelayMinutes} minutes</p>
                <h3>Run Details:</h3>
                ${runList}
            `;
        })
        .catch(error => {
            console.error("Error performing calculations:", error);
            alert("Failed to load GC configurations. Please check the server.");
        });
}
