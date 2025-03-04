<template>
  <div class="settings-modification">
    <h3>Settings Modification</h3>
    <!-- Update Existing GC Section using a 3-column table -->
    <table class="update-table">
      <tr>
        <td>
          <label for="selectedGC">Select GC:</label>
        </td>
        <td>
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
        <td><!-- Empty cell for equal columns --></td>
      </tr>
      <tr>
        <td>
          <label for="newRunTime">Run Time:</label>
        </td>
        <td>
          <input
            type="text"
            id="newRunTime"
            v-model="newRunTimeInput"
            inputmode="decimal"
            placeholder="Run Time"
            @keypress="handleNumericInput"
            @input="validateUpdateRunTime"
          />
        </td>
        <td><!-- Empty cell for equal columns --></td>
      </tr>
      <tr>
        <td>
          <label for="newType">Type:</label>
        </td>
        <td>
          <select id="newType" v-model="newType">
            <option disabled value="">--Select--</option>
            <option value="Energy">Energy</option>
            <option value="Sulphur">Sulphur</option>
          </select>
        </td>
        <td><!-- Empty cell for equal columns --></td>
      </tr>
      <tr>
        <td>
          <label for="newName">Change Name:</label>
        </td>
        <td>
          <input
            type="text"
            id="newName"
            v-model="newName"
            placeholder="New Name"
          />
        </td>
        <td><!-- Empty cell for equal columns --></td>
      </tr>
      <!-- Row for buttons in 3rd column only -->
      <tr>
        <td></td>
        <td></td>
        <td>
          <div class="button-group">
            <button @click="updateSettings">Update GC</button>
            <button class="delete-button" @click="deleteGC">Delete GC</button>
          </div>
        </td>
      </tr>
    </table>

    <!-- Add New GC Section remains a two-column table -->
    <div class="add-gc">
      <h3>Add New GC</h3>
      <table class="settings-table">
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
        </tr>
        <tr>
          <td class="label-cell">
            <label for="newGCRunTime">Run Time:</label>
          </td>
          <td class="input-cell">
            <input
              type="text"
              id="newGCRunTime"
              v-model="newGCRunTimeInput"
              inputmode="decimal"
              placeholder="Run Time"
              @keypress="handleNumericInput"
              @input="validateAddRunTime"
            />
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
        </tr>
      </table>
      <button @click="addGC">Add New GC</button>
    </div>
  </div>
</template>

<script>
export default {
  name: "SettingsModification",
  props: {
    config: {
      type: Object,
      required: true,
    },
    sortedEntries: {
      type: Array,
      required: true,
    },
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
        const currentRuntime = this.config[newVal].runTime;
        this.newRunTimeInput =
          currentRuntime !== undefined
            ? Number(currentRuntime).toFixed(2)
            : "";
        this.newRunTime =
          currentRuntime !== undefined ? currentRuntime : null;
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
    handleNumericInput(e) {
      const allowedChars = /[0-9\.]/;
      const key = e.key;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!allowedChars.test(key)) {
        e.preventDefault();
      }
    },
    validateUpdateRunTime(e) {
      const inputVal = e.target.value;
      if (!inputVal) {
        this.newRunTime = null;
        this.newRunTimeInput = "";
        return;
      }
      const num = parseFloat(inputVal);
      if (isNaN(num)) return;
      const intPart = Math.floor(num);
      if (intPart > 99) {
        this.newRunTime = 99;
        this.newRunTimeInput = "99";
      } else {
        this.newRunTime = num;
        this.newRunTimeInput = inputVal;
      }
    },
    validateAddRunTime(e) {
      const inputVal = e.target.value;
      if (!inputVal) {
        this.newGCRunTime = null;
        this.newGCRunTimeInput = "";
        return;
      }
      const num = parseFloat(inputVal);
      if (isNaN(num)) return;
      const intPart = Math.floor(num);
      if (intPart > 99) {
        this.newGCRunTime = 99;
        this.newGCRunTimeInput = "99";
      } else {
        this.newGCRunTime = num;
        this.newGCRunTimeInput = inputVal;
      }
    },
    updateSettings() {
      if (!this.selectedGC) {
        alert("Please select a GC to update.");
        return;
      }
      const updatedConfig = { ...this.config };
      if (updatedConfig[this.selectedGC]) {
        updatedConfig[this.selectedGC] = {
          ...updatedConfig[this.selectedGC],
          runTime: this.newRunTime,
          type: this.newType,
          name: this.newName
            ? this.newName
            : updatedConfig[this.selectedGC].name,
        };
        this.$emit("update-config", updatedConfig);
        alert("GC updated locally. (Persist via backend API)");
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
        alert("GC deleted locally. (Persist via backend API)");
        this.selectedGC = "";
      } else {
        alert("Selected GC not found in configuration.");
      }
    },
    addGC() {
      if (!this.newGCId || this.newGCRunTime === null || !this.newGCType) {
        alert("Please fill in all fields to add a new GC.");
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
      alert("New GC added locally. (Persist via backend API)");
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
  margin: 8px 0;
  padding: 8px 12px;
  border: 1px solid #ccc;
  background-color: #f9f9f9;
  font-family: 'Aptos', sans-serif;
  font-size: 0.9rem;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.1);
}

.settings-modification h3 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
}

/* Update section: 3-column table with equal widths */
.update-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.update-table td {
  padding: 8px;
  vertical-align: middle;
  width: 33.33%;
}

/* For the add section table (2 columns) */
.settings-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 16px;
}

.settings-table td {
  padding: 8px;
  vertical-align: middle;
}

.label-cell {
  width: 40%;
  text-align: left;
  font-weight: bold;
}

.input-cell {
  width: 60%;
}

/* Uniform control styles */
input,
select {
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* Button group styles */
.button-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.button-group button {
  padding: 6px 12px;
  background-color: var(--highlight-color);
  color: var(--text-highlight);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
}

.button-group button:hover {
  background-color: var(--highlight-hover);
}

.button-group .delete-button {
  background-color: #ee930a;
  color: #ffffff;
}

.button-group .delete-button:hover {
  background-color: #c08c2b;
}

/* Add section button styling */
.add-gc button {
  display: block;
  width: 48%;
  margin: 0 auto;
  padding: 6px 12px;
  background-color: var(--highlight-color);
  color: var(--text-highlight);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  text-align: center;
}

.add-gc button:hover {
  background-color: var(--highlight-hover);
}
</style>
