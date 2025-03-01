import { createApp } from 'vue';
import App from './App.vue';
import { pinia } from './store'; // Import the Pinia instance

const app = createApp(App);

// Force enable Vue Devtools (for debugging only)
app.config.devtools = true;

app.use(pinia);
app.mount('#app');
