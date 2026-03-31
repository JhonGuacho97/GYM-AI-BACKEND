import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
export const foodRouter = Router();

// POST /api/food/estimate — IA estima calorías y macros de un plato
foodRouter.post("/estimate", async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    if (!description)
      return res.status(400).json({ error: "Descripción requerida" });

    const openai = new OpenAI({
      apiKey: process.env.OPEN_ROUTER_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
        "X-Title": "GymAI Food Estimator",
      },
    });

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        {
          role: "system",
          content: `
          Eres un nutricionista experto en estimación de calorías.

          REGLAS ESTRICTAS:
          - Responde SOLO con JSON válido
          - NO agregues texto, explicaciones ni markdown
          - NO uses comillas en números
          - TODOS los números deben ser tipo number
          - Si no sabes algo, estima valores razonables
          - Usa porciones estándar (200-300g) si no se especifica

          El JSON debe ser válido para JSON.parse sin errores.
          `,
        },
        {
          role: "user",
          content: `
Estima los valores nutricionales para: "${description}"

Responde EXACTAMENTE con este formato:

{
  "name": string,
  "calories": number,
  "protein_g": number,
  "carbs_g": number,
  "fat_g": number,
  "notes": string
}

REGLAS:
- calories debe ser entero
- protein_g, carbs_g, fat_g deben ser decimales
- name debe ser claro y normalizado
- notes debe ser breve (máx 15 palabras)
`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content)
      return res.status(500).json({ error: "Sin respuesta de la IA" });

    let data;

    try {
      data = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: "JSON inválido generado por IA" });
    }

    // validación manual básica
    if (
      typeof data.calories !== "number" ||
      typeof data.protein_g !== "number"
    ) {
      return res.status(500).json({ error: "Formato incorrecto de IA" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error estimating food:", error);
    res
      .status(500)
      .json({ error: "Error al estimar los valores nutricionales" });
  }
});

// POST /api/food — guardar una comida
foodRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, name, calories, protein_g, carbs_g, fat_g, meal_type } =
      req.body;
    if (!userId || !name || calories == null) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const log = await prisma.food_logs.create({
      data: {
        user_id: userId,
        name,
        calories: Math.round(calories),
        protein_g: protein_g ?? 0,
        carbs_g: carbs_g ?? 0,
        fat_g: fat_g ?? 0,
        meal_type: meal_type || "other",
      },
    });

    res.json({ id: log.id, loggedAt: log.logged_at });
  } catch (error) {
    console.error("Error saving food log:", error);
    res.status(500).json({ error: "Error al guardar la comida" });
  }
});

// GET /api/food/today?userId=... — comidas del día actual
foodRouter.get("/today", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await prisma.food_logs.findMany({
      where: {
        user_id: userId,
        logged_at: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { logged_at: "asc" },
    });

    res.json(logs);
  } catch (error) {
    console.error("Error fetching food logs:", error);
    res.status(500).json({ error: "Error al obtener las comidas" });
  }
});

// DELETE /api/food/:id — eliminar una comida
foodRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.food_logs.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting food log:", error);
    res.status(500).json({ error: "Error al eliminar la comida" });
  }
});
