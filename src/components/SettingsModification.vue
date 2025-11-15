<template>
  <div class="settings-modification">
    <h3>Config Modification</h3>

    <!-- Update GC Section -->
    <table class="update-table">
      
      <!-- Select GC + Update GC button -->
      <tr>
        <td class="label-cell">
          <label for="selectedGC">Select GC:</label>
        </td>
        <td class="input-cell">
          <select id="selectedGC" v-model="selectedGC">
            <option disabled value="">-- Select GC --</option>
            <option
              v-for="([key, value]) in sortedEntries"
              :key="key"
              :value="key"
            >
              {{ value.name !== key ? value.name : key }}
            </option>
          </select>
        </td>
        <td class="button-cell">
          <button @click="updateSettings">Update GC</button>
        </td>
      </tr>

      <!-- Run Time + Delete GC -->
      <tr>
        <td class="label-cell">
          <label for="newRunTime">Run Time (mm:ss):</label>
        </td>
        <td class="input-cell">
          <input
            type="text"
            id="newRunTime"
            v-model="newRunTimeInput"
            placeholder="mm:ss"
            @keypress="handleNumericInput"
            @input="validateUpdateRunTime"
          />
        </td>
        <td class="button-cell">
          <button class="delete-button" @click="deleteGC">Delete GC</button>
        </td>
      </tr>

    </table>

    <!-- Add New GC Section -->
    <div class="add-gc">
      <h3>Add New GC</h3>
      <table class="update-table">

        <!-- New GC ID -->
        <tr>
          <td class="label-cell">
            <label for="newGCId">GC name:</label>
          </td>
          <td class="input-cell">
            <input
              type="text"
              id="newGCId"
              v-model="newGCId"
              placeholder="GC name"
            />
          </td>
          <td class="button-cell"></td>
        </tr>

        <!-- New GC Run Time -->
        <tr>
          <td class="label-cell">
            <label for="newGCRunTime">Run Time (mm:ss):</label>
          </td>
          <td class="input-cell">
            <input
              type="text"
              id="newGCRunTime"
              v-model="newGCRunTimeInput"
              placeholder="mm:ss"
              @keypress="handleNumericInput"
              @input="validateAddRunTime"
            />
          </td>
          <td class="button-cell">
            <button @click="addGC">Add New GC</button>
          </td>
        </tr>

        <!-- New GC Type -->
        <tr>
          <td class="label-cell">
            <label for="newGCType">Type:</label>
          </td>
          <td class="input-cell">
            <select id="newGCType" v-model="newGCType">
              <option disabled value="">--Select--</option>
              <option value="Energy">Energy</option>
              <option value="Sulphur">Sulphur</option>
            </select>
          </td>
          <td class="button-cell"></td>
        </tr>

      </table>
    </div>
  </div>
</template>

<script>
export default {
  name: "SettingsModification",
  props: {
    config: { type: Object, required: true },
    sortedEntries: { type: Array, required: true },
  },
  data() {
    return {
      selectedGC: "",
      newRunTimeInput: "",
      newRunTime: null,
      newGCId: "",
      newGCRunTimeInput: "",
      newGCRunTime: null,
      newGCType: "",
    };
  },
  watch: {
    selectedGC(newVal) {
      if (newVal && this.config[newVal]) {
        let currentRuntime = this.config[newVal].runTime;
        if (typeof currentRuntime === "number") {
          currentRuntime = this.convertDecimalToMmSs(currentRuntime);
        }
        this.newRunTimeInput = currentRuntime || "";
        this.newRunTime = currentRuntime || null;
      } else {
        this.newRunTimeInput = "";
        this.newRunTime = null;
      }
    },
  },
  methods: {
    convertDecimalToMmSs(decimalMinutes) {
      const totalSeconds = Math.round(decimalMinutes * 60);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    },
    handleNumericInput(e) {
      const allowedChars = /[0-9:]/;
      if (!allowedChars.test(e.key)) e.preventDefault();
    },
    validateUpdateRunTime(e) {
      const val = e.target.value;
      this.newRunTime = /^\d{1,2}:\d{2}$/.test(val) ? val : null;
      this.newRunTimeInput = val;
    },
    validateAddRunTime(e) {
      const val = e.target.value;
      this.newGCRunTime = /^\d{1,2}:\d{2}$/.test(val) ? val : null;
      this.newGCRunTimeInput = val;
    },
    updateSettings() {
      if (!this.selectedGC) return alert("Please select a GC to update.");
      if (!this.newRunTime) return alert("Please enter a valid mm:ss run time.");

      const updatedConfig = { ...this.config };
      updatedConfig[this.selectedGC].runTime = this.newRunTime;

      this.$emit("update-config", updatedConfig);
      alert("Config Updating");
    },
    deleteGC() {
      if (!this.selectedGC) return alert("Select a GC to delete.");
      if (!confirm("Are you sure?")) return;

      const updatedConfig = { ...this.config };
      delete updatedConfig[this.selectedGC];

      this.$emit("update-config", updatedConfig);
      alert("Deleting GC");
      this.selectedGC = "";
    },
    addGC() {
      if (!this.newGCId || !this.newGCRunTime || !this.newGCType) {
        alert("Fill in all fields to add.");
        return;
      }
      const updatedConfig = { ...this.config };
      if (updatedConfig[this.newGCId]) return alert("GC already exists.");

      updatedConfig[this.newGCId] = {
        name: this.newGCId,
        runTime: this.newGCRunTime,
        type: this.newGCType,
      };

      this.$emit("update-config", updatedConfig);
      alert("Adding New GC");

      this.newGCId = "";
      this.newGCRunTimeInput = "";
      this.newGCRunTime = null;
      this.newGCType = "";
    },
  },
};
</script>

<style scoped>
/* unchanged styling */
.settings-modification {
  margin: 5px 0;
  padding: 8px 12px;
  border: 1px solid #ccc;
  background-color: #fff;
  font-family: 'Aptos', sans-serif;
  font-size: 0.9rem;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.settings-modification h3 {
  margin: 4px 0 8px 0;
  font-size: 1rem;
}

.input-cell input,
.input-cell select,
.button-cell button {
  height: 28px;
  line-height: 28px;
  font-size: 0.85rem;
  padding: 0 8px;
  box-sizing: border-box;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
}

input, select {
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  border: 1px solid #ccc;
  background-color: var(--highlight-color, #007bff);
  color: #fff;
  border-radius: 4px;
  width: 100%;
  cursor: pointer;
  transition: 0.2s;
}

button:hover {
  background-color: var(--highlight-hover, #0056b3);
}

.delete-button:hover {
  background-color: #c0392b;
}

.update-table {
  width: 100%;
  border-spacing: 0 4px;
}

.label-cell {
  width: 22%;
  font-weight: bold;
}

.input-cell {
  width: 33%;
  padding-right: 6px;
}

.button-cell {
  width: 33%;
  padding-left: 6px;
  text-align: center;
}

.add-gc {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #ccc;
}
</style>
