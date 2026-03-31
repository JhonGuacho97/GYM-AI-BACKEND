"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
exports.sessionsRouter = (0, express_1.Router)();
// POST /api/sessions — guardar una sesión completada
exports.sessionsRouter.post("/", async (req, res) => {
    try {
        const { userId, planId, dayName, notes, exercises } = req.body;
        if (!userId || !planId || !dayName || !exercises?.length) {
            return res.status(400).json({ error: "Faltan campos requeridos" });
        }
        const session = await prisma_1.prisma.workout_sessions.create({
            data: {
                user_id: userId,
                plan_id: planId,
                day_name: dayName,
                notes: notes || null,
                exercises: {
                    create: exercises.map((ex) => ({
                        exercise_name: ex.exerciseName,
                        sets_completed: ex.setsCompleted,
                        reps_completed: ex.repsCompleted,
                        weight_kg: ex.weightKg ?? null,
                        rpe_actual: ex.rpeActual ?? null,
                    })),
                },
            },
            include: { exercises: true },
        });
        res.json({ id: session.id, completedAt: session.completed_at });
    }
    catch (error) {
        console.error("Error saving session:", error);
        res.status(500).json({ error: "Error al guardar la sesión" });
    }
});
// GET /api/sessions?userId=... — historial de sesiones
exports.sessionsRouter.get("/", async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId)
            return res.status(400).json({ error: "userId requerido" });
        const sessions = await prisma_1.prisma.workout_sessions.findMany({
            where: { user_id: userId },
            orderBy: { completed_at: "desc" },
            include: { exercises: true },
        });
        res.json(sessions);
    }
    catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: "Error al obtener el historial" });
    }
});
// GET /api/sessions/progress?userId=...&exercise=... — historial de un ejercicio específico
exports.sessionsRouter.get("/progress", async (req, res) => {
    try {
        const { userId, exercise } = req.query;
        if (!userId || !exercise) {
            return res.status(400).json({ error: "userId y exercise son requeridos" });
        }
        const records = await prisma_1.prisma.session_exercises.findMany({
            where: {
                exercise_name: { equals: exercise, mode: "insensitive" },
                session: { user_id: userId },
            },
            orderBy: { session: { completed_at: "asc" } },
            include: { session: { select: { completed_at: true } } },
        });
        const data = records.map((r) => ({
            date: r.session.completed_at,
            weightKg: r.weight_kg,
            sets: r.sets_completed,
            reps: r.reps_completed,
            rpeActual: r.rpe_actual,
        }));
        res.json(data);
    }
    catch (error) {
        console.error("Error fetching progress:", error);
        res.status(500).json({ error: "Error al obtener el progreso" });
    }
});
