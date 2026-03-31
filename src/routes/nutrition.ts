import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
export const nutritionRouter = Router();

// Factores de actividad según días de entrenamiento por semana
const activityFactor = (daysPerWeek: number) => {
  if (daysPerWeek <= 2) return 1.375; // ligeramente activo
  if (daysPerWeek <= 4) return 1.55; // moderadamente activo
  return 1.725; // muy activo
};

// Ajuste calórico según objetivo
const goalAdjustment = (goal: string) => {
  switch (goal) {
    case "bulk":
      return 300; // superávit
    case "cut":
      return -400; // déficit
    case "recomp":
      return 0; // mantenimiento
    case "strength":
      return 200; // leve superávit
    default:
      return 0;
  }
};

function calculateMacros(profile: {
  age: number;
  gender: string;
  weight_kg: number;
  height_cm: number;
  days_per_week: number;
  goal: string;
}) {
  // Fórmula Mifflin-St Jeor
  const bmr =
    profile.gender === "male"
      ? 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age + 5
      : 10 * profile.weight_kg +
        6.25 * profile.height_cm -
        5 * profile.age -
        161;

  const tdee = Math.round(bmr * activityFactor(profile.days_per_week));
  const calories = tdee + goalAdjustment(profile.goal);

  // Distribución de macros
  // Proteína: 2g por kg de peso corporal
  const protein_g = Math.round(profile.weight_kg * 2);
  // Grasa: 25% de las calorías totales
  const fat_g = Math.round((calories * 0.25) / 9);
  // Carbohidratos: el resto
  const carbs_g = Math.round((calories - protein_g * 4 - fat_g * 9) / 4);

  return { calories_target: calories, protein_g, carbs_g, fat_g };
}

// POST /api/nutrition/calculate — calcular y guardar macros
nutritionRouter.post("/calculate", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const profile = await prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });

    if (!profile) {
      return res.status(404).json({ error: "Perfil no encontrado" });
    }

    if (
      !profile.age ||
      !profile.gender ||
      !profile.weight_kg ||
      !profile.height_cm
    ) {
      return res.status(400).json({
        error:
          "Completa tu perfil con edad, género, peso y altura para calcular tus macros",
        missing: true,
      });
    }

    const macros = calculateMacros({
      age: profile.age,
      gender: profile.gender,
      weight_kg: profile.weight_kg,
      height_cm: profile.height_cm,
      days_per_week: profile.days_per_week,
      goal: profile.goal,
    });

    const result = await prisma.nutrition_goals.upsert({
      where: { user_id: userId },
      update: { ...macros, calculated_at: new Date() },
      create: { user_id: userId, ...macros },
    });

    res.json(result);
  } catch (error) {
    console.error("Error calculating nutrition:", error);
    res.status(500).json({ error: "Error al calcular los macros" });
  }
});

// GET /api/nutrition?userId=... — obtener metas guardadas
nutritionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const goals = await prisma.nutrition_goals.findUnique({
      where: { user_id: userId },
    });

    if (!goals)
      return res.status(404).json({ error: "Sin datos de nutrición" });

    res.json(goals);
  } catch (error) {
    console.error("Error fetching nutrition:", error);
    res.status(500).json({ error: "Error al obtener los datos" });
  }
});

// POST /api/nutrition/meal-plan — generar plan de comidas con IA
nutritionRouter.post("/meal-plan", async (req: Request, res: Response) => {
  try {
    const { userId, days = 1 } = req.body;
    if (!userId) return res.status(400).json({ error: "userId requerido" });

    const [profile, goals] = await Promise.all([
      prisma.user_profiles.findUnique({ where: { user_id: userId } }),
      prisma.nutrition_goals.findUnique({ where: { user_id: userId } }),
    ]);

    if (!profile)
      return res.status(404).json({ error: "Perfil no encontrado" });
    if (!goals)
      return res.status(400).json({
        error: "Calcula tus macros primero en la sección de Nutrición",
      });

    const goalLabels: Record<string, string> = {
      bulk: "ganar masa muscular (superávit)",
      cut: "perder grasa (déficit calórico)",
      recomp: "recomposición corporal",
      strength: "ganar fuerza",
      endurance: "mejorar resistencia",
    };

    const openai = new OpenAI({
      apiKey: process.env.OPEN_ROUTER_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
        "X-Title": "GymAI Meal Planner",
      },
    });

    const numDays = Math.min(Math.max(Number(days), 1), 7);

    const prompt = `
Genera un plan de alimentación de ${numDays} día(s).

DATOS DEL USUARIO:
- Objetivo: ${goalLabels[profile.goal] || profile.goal}
- Calorías objetivo: ${goals.calories_target}
- Proteína: ${goals.protein_g}g
- Carbohidratos: ${goals.carbs_g}g
- Grasas: ${goals.fat_g}g
- Peso: ${profile.weight_kg || 75}kg

FORMATO EXACTO (NO CAMBIAR):
{
  "days": [
    {
      "day": "Día 1",
      "meals": [
        {
          "type": "breakfast",
          "name": string,
          "description": string,
          "calories": number,
          "protein_g": number,
          "carbs_g": number,
          "fat_g": number
        }
      ],
      "totals": {
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number
      }
    }
  ]
}

REGLAS:
- EXACTAMENTE 4 comidas por día: breakfast, lunch, dinner, snack
- NO repetir comidas dentro del mismo día
- Usar alimentos comunes en Latinoamérica
- description máximo 12 palabras
- Ajustar porciones para acercarse a los objetivos
- totals debe ser la suma real de meals
`;

    const completion = await openai.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content: `
Eres un nutricionista experto en planificación de comidas.

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido
- NO uses markdown
- NO agregues texto fuera del JSON
- TODOS los números deben ser tipo number (sin comillas)
- SIEMPRE incluye exactamente 4 comidas por día:
  breakfast, lunch, dinner, snack
- NO cambies los nombres de los campos
- SI el resultado no cumple el formato, corrígelo antes de responder

CONSISTENCIA:
- La suma de calories de meals debe coincidir con totals.calories (±5%)
- Igual para protein_g, carbs_g, fat_g

El JSON debe ser válido para JSON.parse sin errores.
`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    if (!completion || !completion.choices || completion.choices.length === 0) {
      console.error(
        "Error: La respuesta de la IA no tiene el formato esperado",
        completion,
      );
      return res
        .status(500)
        .json({ error: "La IA no devolvió opciones de respuesta" });
    }

    // 2. Ahora sí es seguro acceder al índice [0]
    const content = completion.choices[0].message?.content;
    if (!content)
      return res.status(500).json({ error: "Sin respuesta de la IA" });

    let plan;

    try {
      plan = JSON.parse(content);
    } catch (err) {
      console.error("JSON inválido:", content);
      return res.status(500).json({ error: "JSON inválido generado por IA" });
    }

    // validación mínima
    if (!plan.days || !Array.isArray(plan.days)) {
      return res.status(500).json({ error: "Formato inválido (days)" });
    }

    for (const day of plan.days) {
      if (!day.meals || day.meals.length !== 4) {
        return res.status(500).json({ error: "Debe haber 4 comidas por día" });
      }
    }
    res.json(plan);
  } catch (error) {
    console.error("Error generating meal plan:", error);
    res.status(500).json({ error: "Error al generar el plan de comidas" });
  }
});
