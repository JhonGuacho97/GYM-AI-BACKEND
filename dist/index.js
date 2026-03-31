"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const profile_1 = require("./routes/profile");
const plan_1 = require("./routes/plan");
const sessions_1 = require("./routes/sessions");
const nutrition_1 = require("./routes/nutrition");
const food_1 = require("./routes/food");
const measurements_1 = require("./routes/measurements");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
//API Routes
app.use("/api/profile", profile_1.profileRouter);
app.use("/api/plan", plan_1.planRouter);
app.use("/api/sessions", sessions_1.sessionsRouter);
app.use("/api/nutrition", nutrition_1.nutritionRouter);
app.use("/api/food", food_1.foodRouter);
app.use("/api/measurements", measurements_1.measurementsRouter);
app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`);
});
