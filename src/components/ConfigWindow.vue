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
            <th>Run Time (mm:ss)</th>
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

      <div class="settings-modification-box">
        <SettingsModification
          :config="config"
          :sortedEntries="sortedEntries"
          @update-config="handleUpdateConfig"
        />
      </div>

      <div class="revert-section">
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

    // Default Configuration with runTime values in mm:ss format.
    const defaultConfig = {
      "2024": { "name": "2024", "runTime": "24:53", "type": "Energy" },
      "1708": { "name": "1708", "runTime": "19:02", "type": "Energy" },
      "2181": { "name": "2181", "runTime": "30:26", "type": "Energy" },
      "1772": { "name": "1772", "runTime": "15:40", "type": "Sulphur" },
      "1709": { "name": "1709", "runTime": "14:18", "type": "Sulphur" },
      "2180": { "name": "2180", "runTime": "18:22", "type": "Sulphur" }
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
        // Clone the default configuration.
        config.value = JSON.parse(JSON.stringify(defaultConfig));
      } finally {
        isLoading.value = false;
      }
    };

    onMounted(fetchConfig);

    // Sort GC Entries by Type and Numerically (ascending order by GC name)
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
      if (confirm("Revert all settings to defaults? This will completely erase the current config table and reset it to what it was at the time of creation. Suggest you record the current GC run times down before doing this. This action cannot be undone.")) {
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
    };
  },
  methods: {
    // Converts a runtime value to mm:ss format.
    // If the runtime is a number, it converts the decimal minutes to mm:ss.
    // If it's already a string with a colon, it returns it as-is.
    formatRuntime(runtime) {
      if (typeof runtime === "number") {
        const totalSeconds = Math.round(runtime * 60);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
      } else if (typeof runtime === "string" && runtime.includes(":")) {
        return runtime;
      }
      return runtime;
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
  /* Drop shadow around the config box */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  max-height: 100vh; /* Ensures the window doesn't exceed the viewport height */
  overflow-y: auto; /* Adds vertical scrolling when content overflows */
  font-family: 'Aptos', sans-serif;
}

.config-window h2 {
  margin: 0 0 5px 0;
  font-size: 2.1rem;
  color: #131313;
  text-align: left;
  /* Subtle drop shadow to make the title pop */
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

/* Add drop shadow and slight elevation to the table */
.config-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 0.85rem;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
}

/* Style table cells */
.config-table th,
.config-table td {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid #ddd;
  width: 33.33%;
}

/* Header styling */
.config-table th {
  background-color: #f2f2f2;
  font-weight: bold;
  /* Adding text shadow for extra pop */
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

/* Settings Modification Box */
.settings-modification-box {
  margin: 12px 0; /* Uniform top and bottom margin */
  padding: 12px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  /* Drop shadow around the settings modification box */
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

/* Revert section styling */
.revert-section {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
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
