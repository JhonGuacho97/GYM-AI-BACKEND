import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

export const measurementsRouter = Router();

// POST /api/measurements — registrar medición mensual
measurementsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, weightKg, bodyFatPct, waistCm, notes } = req.body;
    if (!userId || !weightKg) {
      return res.status(400).json({ error: "userId y weightKg son requeridos" });
    }

    const measurement = await prisma.body_measurements.create({
      data: {
        user_id:      userId,
        weight_kg:    weightKg,
        body_fat_pct: bodyFatPct ?? null,
        waist_cm:     waistCm ?? null,
        notes:        notes ?? null,
      },
    });

    res.json({ id: measurement.id, measuredAt: measurement.measured_at });
  } catch (error) {
    console.error("Error saving measurement:", error);
    res.status(500).json({ error: "Error al guardar la medición" });
  }
});

// GET /api/measurements?userId=... — historial de mediciones
measurementsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const measurements = await prisma.body_measurements.findMany({
      where:   { user_id: userId },
      orderBy: { measured_at: "desc" },
    });

    res.json(measurements);
  } catch (error) {
    console.error("Error fetching measurements:", error);
    res.status(500).json({ error: "Error al obtener las mediciones" });
  }
});

// DELETE /api/measurements/:id — eliminar una medición
measurementsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    let id = req.params.id as string;
    await prisma.body_measurements.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting measurement:", error);
    res.status(500).json({ error: "Error al eliminar la medición" });
  }
});

// POST /api/measurements/analyze — análisis de progreso con IA
measurementsRouter.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const [measurements, profile] = await Promise.all([
      prisma.body_measurements.findMany({
        where: { user_id: userId },
        orderBy: { measured_at: "asc" },
      }),
      prisma.user_profiles.findUnique({ where: { user_id: userId } }),
    ]);

    if (!profile) return res.status(404).json({ error: "Perfil no encontrado" });
    if (measurements.length < 1) {
      return res.status(400).json({ error: "Necesitas al menos una medición para el análisis" });
    }

    const goalLabels: Record<string, string> = {
      bulk:     "ganar masa muscular",
      cut:      "perder grasa",
      recomp:   "recomposición corporal",
      strength: "ganar fuerza",
      endurance:"mejorar resistencia",
    };

    const first  = measurements[0];
    const latest = measurements[measurements.length - 1];
    const initialWeight = profile.weight_kg ?? first.weight_kg;

    const historyText = measurements.map((m, i) => {
      const date = new Date(m.measured_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
      return `Medición ${i + 1} (${date}): Peso ${m.weight_kg}kg${m.body_fat_pct ? `, Grasa ${m.body_fat_pct}%` : ""}${m.waist_cm ? `, Cintura ${m.waist_cm}cm` : ""}${m.notes ? `, Nota: "${m.notes}"` : ""}`;
    }).join("\n");

    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.OPEN_ROUTER_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
        "X-Title": "GymAI Body Analysis",
      },
    });

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct:free",
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
    if (!content) return res.status(500).json({ error: "Sin respuesta de la IA" });

    res.json(JSON.parse(content));
  } catch (error) {
    console.error("Error analyzing measurements:", error);
    res.status(500).json({ error: "Error al generar el análisis" });
  }
});
