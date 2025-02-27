export function fetchGcData() {
  const cacheBuster = Date.now();
  return fetch(`/data/gc_config.json?v=${cacheBuster}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      console.error('Error fetching GC data:', error);
      throw error;
    });
}
