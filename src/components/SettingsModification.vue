<template>
  <div class="settings-modification">
    <h3>Settings Modification</h3>
    <!-- Update GC Section as a 3-column table -->
    <table class="update-table">
      <tr>
        <td class="label-cell">
          <label for="selectedGC">Select GC:</label>
        </td>
        <td class="input-cell">
          <select id="selectedGC" v-model="selectedGC">
            <option disabled value="">-- Select GC --</option>
            <option v-for="([key, value]) in sortedEntries" :key="key" :value="key">
              {{ value.name !== key ? value.name : key }}
            </option>
          </select>
        </td>
        <td class="button-cell"></td>
      </tr>
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
          <button @click="updateSettings">Update GC</button>
        </td>
      </tr>
      <tr>
        <td class="label-cell">
          <label for="newType">Type:</label>
        </td>
        <td class="input-cell">
          <select id="newType" v-model="newType">
            <option disabled value="">--Select--</option>
            <option value="Energy">Energy</option>
            <option value="Sulphur">Sulphur</option>
          </select>
        </td>
        <td class="button-cell">
          <button class="delete-button" @click="deleteGC">Delete GC</button>
        </td>
      </tr>
      <tr>
        <td class="label-cell">
          <label for="newName">Change Name:</label>
        </td>
        <td class="input-cell">
          <input
            type="text"
            id="newName"
            v-model="newName"
            placeholder="New Name"
          />
        </td>
        <td class="button-cell"></td>
      </tr>
    </table>

    <!-- Add New GC Section as a 3-column table -->
    <div class="add-gc">
      <h3>Add New GC</h3>
      <table class="update-table">
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
      newType: "",
      newName: "",
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
        this.newRunTimeInput = currentRuntime !== undefined ? currentRuntime : "";
        this.newRunTime = currentRuntime !== undefined ? currentRuntime : null;
        this.newType = this.config[newVal].type || "";
        this.newName = this.config[newVal].name || "";
      } else {
        this.newRunTimeInput = "";
        this.newRunTime = null;
        this.newType = "";
        this.newName = "";
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
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!allowedChars.test(e.key)) {
        e.preventDefault();
      }
    },
    validateUpdateRunTime(e) {
      const inputVal = e.target.value;
      const pattern = /^\d{1,2}:\d{2}$/;
      if (!inputVal || !pattern.test(inputVal)) {
        this.newRunTime = null;
      } else {
        this.newRunTime = inputVal;
      }
      this.newRunTimeInput = inputVal;
    },
    validateAddRunTime(e) {
      const inputVal = e.target.value;
      const pattern = /^\d{1,2}:\d{2}$/;
      if (!inputVal || !pattern.test(inputVal)) {
        this.newGCRunTime = null;
      } else {
        this.newGCRunTime = inputVal;
      }
      this.newGCRunTimeInput = inputVal;
    },
    updateSettings() {
      if (!this.selectedGC) {
        alert("Please select a GC to update.");
        return;
      }
      if (!this.newRunTime) {
        alert("Please enter a valid run time in mm:ss format. Include a colon");
        return;
      }
      const updatedConfig = { ...this.config };
      if (updatedConfig[this.selectedGC]) {
        updatedConfig[this.selectedGC] = {
          ...updatedConfig[this.selectedGC],
          runTime: this.newRunTime,
          type: this.newType,
          name: this.newName ? this.newName : updatedConfig[this.selectedGC].name,
        };
        this.$emit("update-config", updatedConfig);
        alert("Config Updating");
      } else {
        alert("Selected GC not found in configuration.");
      }
    },
    deleteGC() {
      if (!this.selectedGC) {
        alert("Please select a GC to delete.");
        return;
      }
      if (!confirm("Are you sure you want to delete this GC?")) {
        return;
      }
      const updatedConfig = { ...this.config };
      if (updatedConfig[this.selectedGC]) {
        delete updatedConfig[this.selectedGC];
        this.$emit("update-config", updatedConfig);
        alert("Deleting GC");
        this.selectedGC = "";
      } else {
        alert("Selected GC not found in configuration.");
      }
    },
    addGC() {
      if (!this.newGCId || this.newGCRunTime === null || !this.newGCType) {
        alert("Please fill in all fields to add a new GC. Include a colon in the run time.");
        return;
      }
      const updatedConfig = { ...this.config };
      if (updatedConfig[this.newGCId]) {
        alert("A GC with that name already exists.");
        return;
      }
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

/* Reduce top margin on headings */
.settings-modification h3 {
  margin: 4px 0 8px 0;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

/* Uniform element styling with drop shadow matching provided code */
.input-cell input,
.input-cell select,
.button-cell button {
  height: 28px;
  line-height: 28px;
  font-size: 0.85rem;
  padding: 0 8px;
  box-sizing: border-box;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* Shared styling for inputs and selects */
input,
select {
  width: 100%;
  margin: 2px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* Button styling to match the reset button style */
button {
  border: 1px solid #ccc;
  background-color: var(--highlight-color, #007bff);
  color: var(--text-highlight, #fff);
  cursor: pointer;
  border-radius: 4px;
  width: 100%;
  padding: 0 8px;
  transition: background-color 0.2s ease;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

button:hover {
  background-color: var(--highlight-hover, #0056b3);
}

/* Specific styling for delete buttons */
.delete-button {
  background-color: var(--highlight-color, #007bff);
  color: var(--text-highlight, #fff);
}

.delete-button:hover {
  background-color: var(--highlight-hover, #0056b3);
}

/* Table layout with adjusted column width and reduced gap */
.update-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 4px;
  margin-bottom: 10px;
}

.label-cell {
  width: 21.5%; /* Updated column width */
  text-align: left;
  font-weight: bold;
}

.input-cell {
  width: 33.3%;
  padding-right: 6px; /* Reduced gap */
}

.button-cell {
  width: 33.3%;
  text-align: center;
  padding-left: 6px; /* Reduced gap */
}

.add-gc {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #ccc;
}
</style>
