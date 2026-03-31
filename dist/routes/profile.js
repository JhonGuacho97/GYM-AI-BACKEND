"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
exports.profileRouter = (0, express_1.Router)();
// GET /api/profile?userId=... — obtener perfil del usuario
exports.profileRouter.get("/", async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId)
            return res.status(400).json({ error: "userId requerido" });
        const profile = await prisma_1.prisma.user_profiles.findUnique({
            where: { user_id: userId },
        });
        if (!profile)
            return res.status(404).json({ error: "Perfil no encontrado" });
        res.json(profile);
    }
    catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({ error: "Error al obtener el perfil" });
    }
});
// PATCH /api/profile/body — actualizar solo datos corporales
exports.profileRouter.patch("/body", async (req, res) => {
    try {
        const { userId, age, gender, heightCm, weightKg } = req.body;
        if (!userId)
            return res.status(400).json({ error: "userId requerido" });
        await prisma_1.prisma.user_profiles.update({
            where: { user_id: userId },
            data: {
                age: age ?? null,
                gender: gender ?? null,
                height_cm: heightCm ?? null,
                weight_kg: weightKg ?? null,
                updated_at: new Date(),
            },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error updating body data:", error);
        res.status(500).json({ error: "Error al actualizar datos corporales" });
    }
});
exports.profileRouter.post("/", async (req, res) => {
    try {
        const { userId, ...profileData } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const { goal, experience, daysPerWeek, sessionLength, equipment, injuries, preferredSplit, age, gender, heightCm, weightKg, } = profileData;
        if (!goal ||
            !experience ||
            !daysPerWeek ||
            !sessionLength ||
            !equipment ||
            !preferredSplit) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        await prisma_1.prisma.user_profiles.upsert({
            where: { user_id: userId },
            update: {
                goal,
                experience,
                days_per_week: daysPerWeek,
                session_length: sessionLength,
                equipment,
                injuries: injuries || null,
                preferred_split: preferredSplit,
                age: age ?? null,
                gender: gender ?? null,
                height_cm: heightCm ?? null,
                weight_kg: weightKg ?? null,
                updated_at: new Date(),
            },
            create: {
                user_id: userId,
                goal,
                experience,
                days_per_week: daysPerWeek,
                session_length: sessionLength,
                equipment,
                injuries: injuries || null,
                preferred_split: preferredSplit,
                age: age ?? null,
                gender: gender ?? null,
                height_cm: heightCm ?? null,
                weight_kg: weightKg ?? null,
            },
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error saving profile:", error);
        res.status(500).json({ error: "Failed to save profile" });
    }
});
