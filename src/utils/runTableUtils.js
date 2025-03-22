// utils/runTableUtils.js

/**
 * Generates the run table order based on the final position, GC type, and control values.
 * This mimics the logic from your Vue run table component.
 *
 * @param {number} finalPos - The final position (numeric) selected by the user.
 * @param {string} gcType - The type of GC (e.g., "energy" or "sulphur").
 * @param {number} control1 - The first control value.
 * @param {number} control2 - The second control value.
 * @returns {Array<string>} - An array representing the run order.
 */
export function generateRunTable(finalPos, gcType, control1, control2) {
    // Determine bigger and smaller control values.
    const biggerControl = Math.max(control1, control2);
    const smallerControl = Math.min(control1, control2);
  
    // Build allowed sample positions (3 to 32), excluding the controls and the number 16.
    const sampleAllowed = [];
    for (let num = 3; num <= 32; num++) {
      if (num === biggerControl || num === smallerControl || num === 16) continue;
      sampleAllowed.push(num);
    }
  
    // Start building the run order.
    const order = [];
    order.push("Blank");
    order.push(gcType.toLowerCase().includes("energy") ? "Argon Blank" : "Methane Blank");
    order.push(`1st Control - ${biggerControl}`);
  
    // Filter sample positions to only include those that are ≤ finalPos.
    const samples = sampleAllowed.filter(n => n <= finalPos);
  
    // Choose a scenario based on finalPos.
    if (finalPos < 13) {
      // Scenario A: Only one control row (2nd Control) after the sample positions.
      samples.forEach(s => order.push(`Position ${s}`));
      order.push(`2nd Control - ${smallerControl}`);
    } else if (finalPos < 23) {
      // Scenario B: Insert a 2nd control after position 12, then add the remaining positions,
      // followed by the 3rd control at the end.
      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n > 12);
  
      group1.forEach(s => order.push(`Position ${s}`));
      order.push(`2nd Control - ${smallerControl}`);
      group2.forEach(s => order.push(`Position ${s}`));
      order.push(`3rd Control - ${biggerControl}`);
    } else {
      // Scenario C: Full approach with groups and two control insertions.
      const group1 = samples.filter(n => n <= 12);
      const group2 = samples.filter(n => n >= 13 && n <= 22);
      const group3 = samples.filter(n => n > 22);
  
      group1.forEach(s => order.push(`Position ${s}`));
      order.push(`2nd Control - ${smallerControl}`);
      group2.forEach(s => order.push(`Position ${s}`));
  
      // Insert 3rd control after Position 22 if available.
      const thirdLabel = `3rd Control - ${biggerControl}`;
      const indexOf22 = order.indexOf("Position 22");
      if (indexOf22 !== -1) {
        order.splice(indexOf22 + 1, 0, thirdLabel);
      } else if (biggerControl === 22) {
        // If 22 is the bigger control, "Position 22" may not exist.
        const indexOf21 = order.indexOf("Position 21");
        if (indexOf21 !== -1) {
          order.splice(indexOf21 + 1, 0, thirdLabel);
        } else {
          order.push(thirdLabel);
        }
      } else {
        order.push(thirdLabel);
      }
  
      group3.forEach(s => order.push(`Position ${s}`));
      order.push(`4th Control - ${smallerControl}`);
    }
  
    return order;
  }
  
  /**
   * Helper function to parse a time string in the format "hh:mm:ss AM/PM" into a Date object.
   * The returned Date object uses today's date.
   *
   * @param {string} timeStr - A time string such as "10:00:30 AM" or "4:00:00 PM".
   * @returns {Date} - A Date object representing the time today.
   */
  function parseTimeWithAmPm(timeStr) {
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes, seconds] = time.split(":");
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    seconds = parseInt(seconds, 10);
    if (modifier.toUpperCase() === "PM" && hours !== 12) {
      hours += 12;
    }
    if (modifier.toUpperCase() === "AM" && hours === 12) {
      hours = 0;
    }
    const now = new Date();
    now.setHours(hours, minutes, seconds, 0);
    return now;
  }
  
  /**
   * Finds the sample run from the given runs array that has the run's end time
   * closest to 4:00 PM without going past 4:00 PM.
   * Only considers runs with a numeric position (i.e. sample runs).
   *
   * @param {Array<Object>} runs - The array of run objects. Each object should have:
   *        - position: number or string
   *        - startTime: string (e.g., "10:00:30 AM")
   *        - endTime: string (e.g., "10:05:30 AM")
   *
   * @returns {Object|string} - The run object that is closest to 4:00 PM, or a message if none.
   */
  export function findClosestPositionBefore4PM(runs) {
    // Define the target 4:00 PM time for today.
    const target = new Date();
    target.setHours(16, 0, 0, 0);
  
    let candidate = null;
    // Loop through each run and update the candidate if its end time is before or equal to 4:00 PM.
    for (const run of runs) {
      // Only consider sample runs (assumed to have numeric positions).
      if (typeof run.position !== "number") continue;
      
      const runEndTime = parseTimeWithAmPm(run.endTime);
      if (runEndTime <= target) {
        // Choose the run with the latest end time that does not exceed 4:00 PM.
        if (!candidate) {
          candidate = run;
        } else {
          const candidateEndTime = parseTimeWithAmPm(candidate.endTime);
          if (runEndTime > candidateEndTime) {
            candidate = run;
          }
        }
      }
    }
  
    return candidate || "No Sample Position Ends Before 4:00 PM";
  }
  