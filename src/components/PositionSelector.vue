<template>
  <div class="position-selector">
    <div class="grid-container">
      <div
        v-for="position in allowedPositions"
        :key="position"
        :class="['grid-item', { selected: isSelected(position), 'full-tile': position === 32 }]"
        @click="selectPosition(position)"
      >
        {{ position === 32 ? '32 - Full Batch' : position }}
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useGcStore } from '../store';

export default {
  name: 'PositionSelector',
  props: {
    allowedPositions: {
      type: Array,
      required: true,
    },
    mode: {
      type: String,
      required: true,
    },
    field: {
      type: String,
      required: true,
      validator: (value) =>
        ['current-run', 'final-position', 'start-time', 'sequential'].includes(value),
    },
    modelValue: {
      type: Number,
      default: null,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const gcStore = useGcStore();

    const selectedPosition = computed(() => {
      if (props.mode === 'start-time') {
        return gcStore.startTime.finalPosition;
      } else if (props.mode === 'sequential') {
        return gcStore.sequentialFinalPosition;
      }
      return null;
    });

    const isSelected = (position) => {
      return position === selectedPosition.value;
    };

    const selectPosition = (position) => {
      if (props.mode === 'start-time') {
        gcStore.setStartTimeFinalPosition(position);
        gcStore.calculateStartTimeBatch();
      } else if (props.mode === 'sequential') {
        gcStore.setSequentialFinalPosition(position);
        emit('update:modelValue', gcStore.sequentialFinalPosition);
      }
    };

    return {
      isSelected,
      selectPosition,
    };
  },
};
</script>

<style scoped>
.position-selector {
  display: flex;
  justify-content: flex-start !important;
  margin-bottom: 0px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(30px, 1fr));
  gap: 5px;
  width: 100%;
}

.grid-item {
  border: 1px solid #ccc;
  padding: 5px;
  text-align: center;
  cursor: pointer;
  height: 18px;
  font-size: 14px;
  border-radius: 5px;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.grid-item:hover {
  background-color: #f0f0f0;
}

.grid-item.selected {
  background-color: var(--highlight-color);
  color: var(--text-highlight);
}

/* "Full" tile spans four columns */
.grid-item.full-tile {
  grid-column: span 4;
}
</style>
