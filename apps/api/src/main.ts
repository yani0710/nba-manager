import { config, validateConfig } from "./config/env";
import { createApp } from "./app";

validateConfig();

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`API server running on http://localhost:${config.PORT}`);
});
