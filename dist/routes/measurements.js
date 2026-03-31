"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.measurementsRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
exports.measurementsRouter = (0, express_1.Router)();
// POST /api/measurements — registrar medición mensual
exports.measurementsRouter.post("/", async (req, res) => {
    try {
        const { userId, weightKg, bodyFatPct, waistCm, notes } = req.body;
        if (!userId || !weightKg) {
            return res.status(400).json({ error: "userId y weightKg son requeridos" });
        }
        const measurement = await prisma_1.prisma.body_measurements.create({
            data: {
                user_id: userId,
                weight_kg: weightKg,
                body_fat_pct: bodyFatPct ?? null,
                waist_cm: waistCm ?? null,
                notes: notes ?? null,
            },
        });
        res.json({ id: measurement.id, measuredAt: measurement.measured_at });
    }
    catch (error) {
        console.error("Error saving measurement:", error);
        res.status(500).json({ error: "Error al guardar la medición" });
    }
});
// GET /api/measurements?userId=... — historial de mediciones
exports.measurementsRouter.get("/", async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId)
            return res.status(400).json({ error: "userId requerido" });
        const measurements = await prisma_1.prisma.body_measurements.findMany({
            where: { user_id: userId },
            orderBy: { measured_at: "desc" },
        });
        res.json(measurements);
    }
    catch (error) {
        console.error("Error fetching measurements:", error);
        res.status(500).json({ error: "Error al obtener las mediciones" });
    }
});
// DELETE /api/measurements/:id — eliminar una medición
exports.measurementsRouter.delete("/:id", async (req, res) => {
    try {
        let id = req.params.id;
        await prisma_1.prisma.body_measurements.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error("Error deleting measurement:", error);
        res.status(500).json({ error: "Error al eliminar la medición" });
    }
});
// POST /api/measurements/analyze — análisis de progreso con IA
exports.measurementsRouter.post("/analyze", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId)
            return res.status(400).json({ error: "userId requerido" });
        const [measurements, profile] = await Promise.all([
            prisma_1.prisma.body_measurements.findMany({
                where: { user_id: userId },
                orderBy: { measured_at: "asc" },
            }),
            prisma_1.prisma.user_profiles.findUnique({ where: { user_id: userId } }),
        ]);
        if (!profile)
            return res.status(404).json({ error: "Perfil no encontrado" });
        if (measurements.length < 1) {
            return res.status(400).json({ error: "Necesitas al menos una medición para el análisis" });
        }
        const goalLabels = {
            bulk: "ganar masa muscular",
            cut: "perder grasa",
            recomp: "recomposición corporal",
            strength: "ganar fuerza",
            endurance: "mejorar resistencia",
        };
        const first = measurements[0];
        const latest = measurements[measurements.length - 1];
        const initialWeight = profile.weight_kg ?? first.weight_kg;
        const historyText = measurements.map((m, i) => {
            const date = new Date(m.measured_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
            return `Medición ${i + 1} (${date}): Peso ${m.weight_kg}kg${m.body_fat_pct ? `, Grasa ${m.body_fat_pct}%` : ""}${m.waist_cm ? `, Cintura ${m.waist_cm}cm` : ""}${m.notes ? `, Nota: "${m.notes}"` : ""}`;
        }).join("\n");
        const OpenAI = (await Promise.resolve().then(() => __importStar(require("openai")))).default;
        const openai = new OpenAI({
            apiKey: process.env.OPEN_ROUTER_KEY,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: {
                "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
                "X-Title": "GymAI Body Analysis",
            },
        });
        const completion = await openai.chat.completions.create({
            model: "openrouter/free",
            messages: [
                {
                    role: "system",
                    content: "Eres un coach fitness y nutricionista experto. Responde ÚNICAMENTE con JSON válido, sin markdown.",
                },
                {
                    role: "user",
                    content: `Analiza el progreso físico de este usuario y genera un informe personalizado.

PERFIL:
- Objetivo: ${goalLabels[profile.goal] || profile.goal}
- Peso inicial (perfil): ${initialWeight}kg
- Experiencia: ${profile.experience}
- Días de entrenamiento: ${profile.days_per_week} días/semana
${profile.injuries ? `- Limitaciones: ${profile.injuries}` : ""}

HISTORIAL DE MEDICIONES:
${historyText}

DATOS ACTUALES:
- Peso actual: ${latest.weight_kg}kg
- Cambio total: ${(latest.weight_kg - initialWeight).toFixed(1)}kg desde el inicio
${latest.body_fat_pct ? `- % Grasa actual: ${latest.body_fat_pct}%` : ""}
${latest.waist_cm ? `- Cintura actual: ${latest.waist_cm}cm` : ""}

Devuelve SOLO este JSON:
{
  "summary": "resumen ejecutivo de 2-3 frases sobre el progreso general",
  "status": "on_track" | "needs_attention" | "great_progress",
  "highlights": ["logro positivo 1", "logro positivo 2"],
  "concerns": ["área de mejora 1 (si aplica)"],
  "recommendations": [
    { "title": "título corto", "description": "recomendación específica y accionable" },
    { "title": "título corto", "description": "recomendación específica y accionable" },
    { "title": "título corto", "description": "recomendación específica y accionable" }
  ],
  "next_goal": "objetivo concreto para la próxima medición"
}`
                },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
        });
        const content = completion.choices[0].message.content;
        if (!content)
            return res.status(500).json({ error: "Sin respuesta de la IA" });
        res.json(JSON.parse(content));
    }
    catch (error) {
        console.error("Error analyzing measurements:", error);
        res.status(500).json({ error: "Error al generar el análisis" });
    }
});
