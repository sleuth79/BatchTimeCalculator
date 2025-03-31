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

      <!-- Settings Modification Section -->
      <SettingsModification
        :config="config"
        :sortedEntries="sortedEntries"
        @update-config="handleUpdateConfig"
      />

      <div class="revert-section">
        <button class="revert-button" @click="revertToDefaults">
          Revert to Defaults
        </button>
      </div>

      <!-- Dark Mode Toggle Button Hidden for now -->
      <div class="dark-mode-section" v-if="false">
        <button class="dark-mode-button" @click="toggleDarkMode">
          Toggle Dark Mode
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

    const defaultConfig = {
      "2024": { "name": "2024", "runTime": "24:53", "type": "Energy" },
      "1708": { "name": "1708", "runTime": "19:02", "type": "Energy" },
      "2181": { "name": "2181", "runTime": "30:26", "type": "Energy" },
      "1772": { "name": "1772", "runTime": "15:40", "type": "Sulphur" },
      "1709": { "name": "1709", "runTime": "14:18", "type": "Sulphur" },
      "2180": { "name": "2180", "runTime": "18:22", "type": "Sulphur" }
    };

    const API_URL = "/.netlify/functions/update-config";

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

    const sortedEntries = computed(() => {
      if (!config.value) return [];
      return Object.entries(config.value)
        .sort(([aKey, aVal], [bKey, bVal]) => {
          if (aVal.type === bVal.type)
            return Number(aKey) - Number(bKey);
          return aVal.type === "Energy" ? -1 : 1;
        });
    });

    const handleUpdateConfig = async (updatedConfig) => {
      try {
        const plainConfig = JSON.parse(JSON.stringify(updatedConfig));
        const updateUrl =
          window.location.hostname === "localhost"
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

    const revertToDefaults = () => {
      if (
        confirm(
          "Revert all settings to defaults? This will completely erase the current config table and reset it to what it was at the time of creation. Suggest you record the current GC run times down before doing this. This action cannot be undone."
        )
      ) {
        config.value = JSON.parse(JSON.stringify(defaultConfig));
        handleUpdateConfig(config.value);
      }
    };

    // New dark mode toggle function
    const toggleDarkMode = () => {
      document.body.classList.toggle("dark-mode");
    };

    return {
      config,
      sortedEntries,
      isLoading,
      error,
      handleUpdateConfig,
      revertToDefaults,
      toggleDarkMode,
    };
  },
  methods: {
    // Converts a runtime value to mm:ss format.
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
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  max-height: 100vh;
  overflow-y: auto;
  font-family: 'Aptos', sans-serif;
}

.config-window h2 {
  margin: 0 0 5px 0;
  font-size: 2.1rem;
  color: #131313;
  text-align: left;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

.config-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-top: 8px;
  font-size: 0.85rem;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  overflow: hidden;
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
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
}

.revert-section {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.revert-button {
  background-color: #d32f2f;
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

.dark-mode-section {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.dark-mode-button {
  background-color: #333;
  color: #fff;
  padding: 7px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  width: auto;
}

.dark-mode-button:hover {
  background-color: #555;
}

.error-message {
  color: rgb(187, 51, 51);
  font-weight: bold;
}

/* Optional: Global dark mode styles. You may place these in a global CSS file if preferred. */
.dark-mode {
  background-color: #121212;
  color: #e0e0e0;
}
</style>
