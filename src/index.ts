import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { profileRouter } from "./routes/profile";
import { planRouter } from "./routes/plan";
import { sessionsRouter } from "./routes/sessions";
import { nutritionRouter } from "./routes/nutrition";
import { foodRouter } from "./routes/food";
import { measurementsRouter } from "./routes/measurements";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(cookieParser());
app.use(express.json());

//API Routes
app.use("/api/profile", profileRouter);
app.use("/api/plan", planRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/nutrition", nutritionRouter);
app.use("/api/food", foodRouter);
app.use("/api/measurements", measurementsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port: ${PORT}`);
});
