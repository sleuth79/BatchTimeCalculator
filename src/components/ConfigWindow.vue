<template>
  <div class="config-window">
    <h2>Configuration</h2>

    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error" class="error-message">Error: {{ error }}</div>

    <div v-else-if="config">
      <table class="config-table">
        <thead>
          <tr>
            <th>GC Name</th>
            <th>Run Time (Minutes)</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="([key, value]) in sortedEntries" :key="key">
            <td>{{ value.name }}</td>
            <td>{{ formatRuntime(value.runTime) }}</td>
            <td>{{ value.type }}</td>
          </tr>
        </tbody>
      </table>

      <SettingsModification
        :config="config"
        :sortedEntries="sortedEntries"
        @update-config="handleUpdateConfig"
      />

      <div class="revert-section">
        <p class="warning-text">
          Beware! This button will erase the current config table and revert all setting to defaults
        </p>
        <button class="revert-button" @click="revertToDefaults">
          Revert to Defaults
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import SettingsModification from "./SettingsModification.vue";

export default {
  name: "ConfigWindow",
  components: { SettingsModification },
  setup() {
    const config = ref(null);
    const isLoading = ref(true);
    const error = ref(null);

    // Default Configuration (if file is missing)
    const defaultConfig = {
      "2024": { "name": "2024", "runTime": 25.50, "type": "Energy" },
      "1708": { "name": "1708", "runTime": 18.91, "type": "Energy" },
      "2181": { "name": "2181", "runTime": 30.93, "type": "Energy" },
      "1772": { "name": "1772", "runTime": 15.47, "type": "Sulphur" },
      "1709": { "name": "1709", "runTime": 15.88, "type": "Sulphur" },
      "2180": { "name": "2180", "runTime": 15.00, "type": "Sulphur" }
    };

    // Determine API endpoint (local vs Netlify function)
    const API_URL = "/.netlify/functions/update-config";

    // Fetch Configuration with cache busting
    const fetchConfig = async () => {
      try {
        const response = await fetch(API_URL + `?v=${Date.now()}`);
        if (!response.ok)
          throw new Error(`Failed to fetch config: HTTP ${response.status}`);
        const data = await response.json();
        config.value = data;
      } catch (err) {
        error.value = "Could not load configuration. Using default settings.";
        config.value = JSON.parse(JSON.stringify(defaultConfig));
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(fetchConfig);

    // Sort GC Entries by Type and Numerically (descending order)
    const sortedEntries = computed(() => {
      if (!config.value) return [];
      return Object.entries(config.value)
        .sort(([aKey, aVal], [bKey, bVal]) => {
          if (aVal.type === bVal.type)
            return Number(aKey) - Number(bKey);
          return aVal.type === "Energy" ? -1 : 1;
        });
    });

    // Update Configuration and force a full page reload upon success.
    const handleUpdateConfig = async (updatedConfig) => {
      try {
        const plainConfig = JSON.parse(JSON.stringify(updatedConfig));
        const updateUrl = window.location.hostname === "localhost"
          ? "http://localhost:8888/.netlify/functions/update-config"
          : "/.netlify/functions/update-config";
        const response = await fetch(updateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plainConfig),
        });
        if (!response.ok) {
          const errorText = await response.text();
          const message = `Failed to update configuration. HTTP status: ${response.status}. ${errorText}`;
          alert(message);
          throw new Error(message);
        }
        const data = await response.json();
        if (data.success) {
          window.location.reload();
        } else {
          const message = data.message || "Unknown error from server.";
          alert(`Error persisting configuration: ${message}`);
        }
      } catch (err) {
        alert("Failed to update configuration. Please check the console for details.");
      }
    };

    // Revert Configuration to Default Values
    const revertToDefaults = () => {
      if (confirm("Revert all settings to defaults? This action cannot be undone.")) {
        config.value = JSON.parse(JSON.stringify(defaultConfig));
        handleUpdateConfig(config.value);
      }
    };

    return {
      config,
      sortedEntries,
      isLoading,
      error,
      handleUpdateConfig,
      revertToDefaults,
      // Optionally, remove fetchConfig from return if not needed for debugging.
    };
  },
  methods: {
    formatRuntime(runtime) {
      return runtime !== undefined ? runtime.toFixed(2) : "0.00";
    },
    async updateConfig(payload) {
      try {
        const response = await fetch('/.netlify/functions/update-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`Failed to update configuration. HTTP status: ${response.status}`);
        }
        const data = await response.json();
      } catch (error) {
        // Error handling can be refined as needed.
      }
    },
  },
};
</script>

<style scoped>
.config-window {
  background-color: #fff;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  height: 100%;
  font-family: 'Aptos', sans-serif;
}

.config-window h2 {
  margin: 0 0 5px 0;
  font-size: 2.1rem;
  color: #131313;
  text-align: left;
}

.config-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 0.85rem;
}

.config-table th,
.config-table td {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid #ddd;
  width: 33.33%;
}

.config-table th {
  background-color: #f2f2f2;
  font-weight: bold;
}

.revert-section {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.warning-text {
  font-size: 0.75rem;
  color: #b00;
  margin: 0;
}

.revert-button {
  background-color: #d32f2f; /* red color */
  color: #fff;
  padding: 7px 7px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  width: auto;
}

.revert-button:hover {
  background-color: #b71c1c;
}

.error-message {
  color: rgb(187, 51, 51);
  font-weight: bold;
}
</style>
