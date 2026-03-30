import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";

export const nutritionRouter = Router();

const VALID_GOALS = ["bulk", "cut", "recomp", "strength", "endurance"] as const;
type Goal = typeof VALID_GOALS[number];

function normalizeGoal(goal: string | null | undefined): Goal {
  if (!goal) return "recomp";
  if (VALID_GOALS.includes(goal as Goal)) return goal as Goal;
  return "recomp"; // fallback seguro
}

// Factores de actividad según días de entrenamiento por semana
const activityFactor = (daysPerWeek: number) => {
  if (daysPerWeek <= 2) return 1.375; // ligeramente activo
  if (daysPerWeek <= 4) return 1.55;  // moderadamente activo
  return 1.725;                        // muy activo
};

// Ajuste calórico según objetivo
const goalAdjustment = (goal: string) => {
  switch (goal) {
    case "bulk": return 300;   // superávit
    case "cut": return -400;  // déficit
    case "recomp": return 0;     // mantenimiento
    case "strength": return 200;   // leve superávit
    default: return 0;
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
      : 10 * profile.weight_kg + 6.25 * profile.height_cm - 5 * profile.age - 161;

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

    if (!profile.age || !profile.gender || !profile.weight_kg || !profile.height_cm) {
      return res.status(400).json({
        error: "Completa tu perfil con edad, género, peso y altura para calcular tus macros",
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

    if (!goals) return res.status(404).json({ error: "Sin datos de nutrición" });
    res.json(goals);
  } catch (error) {
    console.error("Error fetching nutrition:", error);
    res.status(500).json({ error: "Error al obtener los datos" });
  }
});
