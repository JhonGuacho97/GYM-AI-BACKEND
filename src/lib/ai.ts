import OpenAI from "openai";
import dotenv from "dotenv";
import { TrainingPlan, UserProfile } from "../types/index";

dotenv.config();

export async function generateTrainingPlan(
  profile: UserProfile | Record<string, any>,
): Promise<Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt">> {
  // Normalizar los datos del perfil del usuario
  const normalizedProfile: UserProfile = {
    goal: profile.goal || "bulk",
    experience: profile.experience || "intermediate",
    days_per_week: profile.days_per_week || 4,
    session_length: profile.session_length || 60,
    equipment: profile.equipment || "full_gym",
    injuries: profile.injuries || null,
    preferred_split: profile.preferred_split || "upper_lower",
  };

  const apiKey = process.env.OPEN_ROUTER_KEY;

  if (!apiKey) {
    throw new Error(
      "OPEN_ROUTER_KEY no está configurada en las variables de entorno",
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.BASE_URL || "http://localhost:3001",
      "X-Title": "GymAI Plan Generator",
    },
  });

  // Construir el prompt para la IA
  const prompt = buildPrompt(normalizedProfile);

  try {
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        {
          role: "system",
          content: `
Eres un entrenador personal experto en diseño de rutinas.

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido
- NO uses markdown
- NO agregues texto fuera del JSON
- TODOS los números deben ser tipo number
- NO cambies los nombres de las propiedades
- SI el JSON es inválido, corrígelo antes de responder

ESTRUCTURA:
- weeklySchedule debe tener EXACTAMENTE ${normalizedProfile.days_per_week} días
- Cada día debe tener ENTRE 4 y 6 ejercicios (NO MÁS, NO MENOS)
- Cada ejercicio debe tener TODOS los campos requeridos

CONSISTENCIA:
- El split debe coincidir con la distribución de días
- El contenido debe respetar el nivel del usuario

IMPORTANTE:
- Usa nombres de ejercicios simples y comerciales de gimnasio
- Evita terminología técnica o anatómica

El JSON debe poder parsearse con JSON.parse sin errores.
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;

    if (!content) {
      console.error(
        "[AI] No hay contenido en la respuesta:",
        JSON.stringify(completion, null, 2),
      );
      throw new Error("No hay contenido en la respuesta de la IA");
    }

    let planData;

    try {
      planData = JSON.parse(content);
    } catch (err) {
      console.error("JSON inválido:", content);
      throw new Error("Respuesta inválida de IA");
    }

    // validaciones fuertes
    if (!planData.weeklySchedule || !Array.isArray(planData.weeklySchedule)) {
      throw new Error("weeklySchedule inválido");
    }

    if (planData.weeklySchedule.length !== normalizedProfile.days_per_week) {
      throw new Error("Número incorrecto de días");
    }

    for (const day of planData.weeklySchedule) {
      if (
        !day.exercises ||
        day.exercises.length < 4 ||
        day.exercises.length > 6
      ) {
        throw new Error("Número inválido de ejercicios");
      }
    }

    return formatPlanResponse(planData, normalizedProfile);
  } catch (error) {
    console.error("[AI] Error al generar el plan de entrenamiento:", error);
    throw error;
  }
}

function formatPlanResponse(
  aiResponse: any,
  profile: UserProfile,
): Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt"> {
  const plan: Omit<TrainingPlan, "id" | "userId" | "version" | "createdAt"> = {
    overview: {
      goal:
        aiResponse.overview?.goal ||
        `Programa personalizado de ${profile.goal}`,
      frequency:
        aiResponse.overview?.frequency ||
        `${profile.days_per_week} días por semana`,
      split: aiResponse.overview?.split || profile.preferred_split,
      notes:
        aiResponse.overview?.notes ||
        "Sigue el programa con constancia para obtener los mejores resultados.",
    },
    weeklySchedule: (aiResponse.weeklySchedule || []).map((day: any) => ({
      day: day.day || "Día",
      focus: day.focus || "Cuerpo Completo",
      exercises: (day.exercises || []).map((ex: any) => ({
        name: ex.name || "Ejercicio",
        sets: ex.sets || 3,
        reps: ex.reps || "8-12",
        rest: ex.rest || "60-90 seg",
        rpe: ex.rpe || 7,
        notes: ex.notes,
        alternatives: ex.alternatives,
      })),
    })),
    progression:
      aiResponse.progression ||
      "Aumenta el peso entre 1 y 2 kg cuando puedas completar todas las series con buena técnica. Registra tu progreso semanalmente.",
  };
  return plan;
}
function buildPrompt(profile: UserProfile): string {
  const goalMap: Record<string, string> = {
    bulk: "ganar masa muscular y volumen",
    cut: "perder grasa y mantener músculo",
    recomp: "perder grasa y ganar músculo simultáneamente (recomposición)",
    strength: "ganar fuerza máxima",
    endurance: "mejorar resistencia cardiovascular y estamina",
  };

  const experienceMap: Record<string, string> = {
    beginner: "principiante (0-1 años de experiencia)",
    intermediate: "intermedio (1-3 años de experiencia)",
    advanced: "avanzado (más de 3 años de experiencia)",
  };

  const equipmentMap: Record<string, string> = {
    full_gym: "gimnasio completo con todo el equipamiento",
    home: "gimnasio en casa con equipo limitado",
    dumbbells: "solo disponibilidad de mancuernas",
  };

  const splitMap: Record<string, string> = {
    full_body: "rutina de cuerpo completo (full body)",
    upper_lower: "división de torso/pierna",
    ppl: "división de empuje/tirón/pierna (PPL)",
    custom: "la mejor división para sus objetivos",
  };

  return `
Genera un plan de entrenamiento.

DATOS:
- Días por semana: ${profile.days_per_week}
- Objetivo: ${goalMap[profile.goal] || profile.goal}
- Nivel: ${experienceMap[profile.experience] || profile.experience}
- Duración máxima por sesión: ${profile.session_length} minutos
- Equipamiento: ${equipmentMap[profile.equipment] || profile.equipment}
- Split: ${splitMap[profile.preferred_split] || profile.preferred_split}
${profile.injuries ? `- Lesiones: ${profile.injuries}` : ""}

FORMATO JSON EXACTO:
{
  "overview": {
    "goal": string,
    "frequency": string,
    "split": string,
    "notes": string
  },
  "weeklySchedule": [
    {
      "day": string,
      "focus": string,
      "exercises": [
        {
          "name": string,
          "sets": number,
          "reps": string,
          "rest": string,
          "rpe": number,
          "notes": string,
          "alternatives": [string]
        }
      ]
    }
  ],
  "progression": string
}

REGLAS:
- EXACTAMENTE ${profile.days_per_week} días en weeklySchedule
- EXACTAMENTE entre 4 y 6 ejercicios por día
- RPE entre 6 y 9
- NO repetir ejercicios dentro del mismo día
- Priorizar ejercicios compuestos
- Mantener coherencia con el split
${profile.injuries ? `- NO incluir ejercicios que afecten: ${profile.injuries}` : ""}

REGLAS DE NOMBRES:
- Usar nombres simples de gimnasio
- Siempre especificar implemento (barra, mancuerna, máquina)
- NO usar términos técnicos

Si el resultado no cumple TODAS las reglas, corrígelo antes de responder.
`;
}
