"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const ai_1 = require("../lib/ai");
exports.planRouter = (0, express_1.Router)();
exports.planRouter.post("/generate", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const profile = await prisma_1.prisma.user_profiles.findUnique({
            where: { user_id: userId },
        });
        if (!profile) {
            return res
                .status(400)
                .json({ error: "User profile not found. Complete onboarding first." });
        }
        // NEED THE PLAN TABLE
        const latestPlan = await prisma_1.prisma.training_plans.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            select: { version: true },
        });
        const nextVersion = latestPlan ? latestPlan.version + 1 : 1;
        let planJson;
        try {
            planJson = await (0, ai_1.generateTrainingPlan)(profile);
        }
        catch (error) {
            console.error("AI generation failed:", error);
            return res.status(500).json({
                error: "Failed to generate training plan. Please try again.",
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
        const planText = JSON.stringify(planJson, null, 2);
        const newPlan = await prisma_1.prisma.training_plans.create({
            data: {
                user_id: userId,
                plan_json: planJson,
                plan_text: planText,
                version: nextVersion,
            },
        });
        res.json({
            id: newPlan.id,
            version: newPlan.version,
            createdAt: newPlan.created_at,
        });
    }
    catch (error) {
        console.error("Error generating plan:", error);
        res.status(500).json({ error: "Failed to generate plan" });
    }
});
exports.planRouter.get("/current", async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const plan = await prisma_1.prisma.training_plans.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
        });
        if (!plan) {
            return res.status(404).json({ error: "No plan found" });
        }
        res.json({
            id: plan.id,
            userId: plan.user_id,
            planJson: plan.plan_json,
            planText: plan.plan_text,
            version: plan.version,
            createdAt: plan.created_at,
        });
    }
    catch (error) {
        console.error("Error fetching plan:", error);
        res.status(500).json({ error: "Failed to fetch plan" });
    }
});
