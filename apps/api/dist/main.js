"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("./config/env");
const app_1 = require("./app");
(0, env_1.validateConfig)();
const app = (0, app_1.createApp)();
app.listen(env_1.config.PORT, () => {
    console.log(`API server running on http://localhost:${env_1.config.PORT}`);
});
//# sourceMappingURL=main.js.map