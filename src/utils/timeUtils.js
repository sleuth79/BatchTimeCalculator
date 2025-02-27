// timeUtils.js
export function parseTimeString(timeStr) {
    const parts = timeStr.split(" ");
    if (parts.length < 2) return null;
    const [timeHMS, period] = parts;
    const [hourStr, minuteStr, secondStr] = timeHMS.split(":");
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const second = parseInt(secondStr, 10);
    if (period === "PM" && hour !== 12) {
      hour += 12;
    }
    if (period === "AM" && hour === 12) {
      hour = 0;
    }
    return { hour, minute, second };
  }
  
  export function formatTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${hours}:${minutes}:${seconds} ${period}`;
  }
  