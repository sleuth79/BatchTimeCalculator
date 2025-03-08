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
          <label for="newRunTime">Run Time:</label>
        </td>
        <td class="input-cell">
          <input
            type="text"
            id="newRunTime"
            v-model="newRunTimeInput"
            placeholder="Run Time"
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
            <label for="newGCRunTime">Run Time:</label>
          </td>
          <td class="input-cell">
            <input
              type="text"
              id="newGCRunTime"
              v-model="newGCRunTimeInput"
              placeholder="Run Time"
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
        const currentRuntime = this.config[newVal].runTime;
        this.newRunTimeInput =
          currentRuntime !== undefined ? Number(currentRuntime).toFixed(2) : "";
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
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (!allowedChars.test(e.key)) {
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
        alert("GC deleting");
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
      alert("New GC adding");
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
  background-color: #f8f8f8;
  font-family: 'Aptos', sans-serif;
  font-size: 0.9rem;
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
}
.settings-modification h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.15);
}
.update-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  margin-bottom: 10px;
}
.update-table td {
  padding: 5px;
  vertical-align: middle;
}
.label-cell {
  width: 20%;
  text-align: left;
  font-weight: bold;
}
.input-cell {
  width: 40%;
}
.button-cell {
  width: 40%;
  text-align: center;
}
input,
select {
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 6px 12px;
  background-color: var(--highlight-color, #007bff);
  color: var(--text-highlight, #fff);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s ease;
}
button:hover {
  background-color: var(--highlight-hover, #0056b3);
}
.delete-button {
  background-color: #ee930a;
  color: #fff;
}
.delete-button:hover {
  background-color: #c08c2b;
}
.add-gc {
  margin-top: 16px;
  padding-top: 8px;
  border-top: 1px solid #ccc;
}
</style>
