// utils.js

// ----------------------
// Formatting Functions
// ----------------------

// Function to format a Date object into HH:MM AM/PM format
export function formatTimeWithAmPm(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const adjustedHours = hours % 12 || 12; // Convert 0 (midnight) to 12
  return `${adjustedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Function to format a Date object into HH:MM:SS AM/PM format
export function formatTimeWithAmPmAndSeconds(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const period = hours >= 12 ? 'PM' : 'AM';
  const adjustedHours = hours % 12 || 12; // Convert to 12-hour format
  // Remove padStart on the hour so that a single digit is not padded with a zero.
  return `${adjustedHours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${period}`;
}

// Function to format a duration (in milliseconds) into a human-readable string.
export function formatDuration(durationMS) {
  const totalSeconds = Math.floor(durationMS / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

// ----------------------
// Time Arithmetic Helpers (Using Seconds)
// ----------------------

// Converts minutes (as a decimal number) to whole seconds (integer).
export function minutesToSeconds(minutes) {
  return Math.round(minutes * 60);
}

// Adds a given number of seconds to a Date object and returns a new Date.
export function addSecondsToDate(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

// Converts a duration in seconds to an object with hours, minutes, and seconds.
export function secondsToHMS(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds };
}

// ----------------------
// Data Fetching Function
// ----------------------

// Function to fetch GC data from an actual API endpoint.
export async function fetchGcData() {
  try {
    const response = await fetch('/data/gc_config.json');
    if (!response.ok) {
      // Handle HTTP errors (e.g., 404, 500)
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // Add data validation here, e.g., check if data is an object and has the expected properties.
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      // Handle network errors specifically (e.g., retry)
      console.error('Network error fetching GC data:', error);
    } else if (error instanceof SyntaxError) {
      // Handle JSON parsing errors
      console.error('Error parsing GC data JSON:', error);
    } else {
      // Handle other errors (e.g., data validation errors)
      console.error('Error fetching GC data:', error);
    }
    throw error;
  }
}
