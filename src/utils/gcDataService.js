export function fetchGcData() {
  const cacheBuster = Date.now();
  return fetch(`/update-config?v=${cacheBuster}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Fetched GC data:', data);
      return data;
    })
    .catch(error => {
      console.error('Error fetching GC data:', error);
      throw error;
    });
}
