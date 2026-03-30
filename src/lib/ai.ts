import OpenAI from "openai";
import dotenv from "dotenv";
import { TrainingPlan, UserProfile } from "../../types";

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
    throw new Error("OPEN_ROUTER_KEY no está configurada en las variables de entorno");
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
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      messages: [
        {
          role: "system",
          content:
            "Eres un experto entrenador personal y diseñador de programas de entrenamiento. Debes responder ÚNICAMENTE con un JSON válido. No incluyas markdown, razonamientos ni texto adicional.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
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

    const planData = JSON.parse(content);

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
      goal: aiResponse.overview?.goal || `Programa personalizado de ${profile.goal}`,
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

  return `Crea un plan de entrenamiento personalizado de ${profile.days_per_week} días por semana para alguien con el siguiente perfil:

Objetivo: ${goalMap[profile.goal] || profile.goal}
Nivel de Experiencia: ${experienceMap[profile.experience] || profile.experience}
Duración de la Sesión: ${profile.session_length} minutos por sesión
Equipamiento: ${equipmentMap[profile.equipment] || profile.equipment}
División Preferida: ${splitMap[profile.preferred_split] || profile.preferred_split}
${profile.injuries ? `Lesiones/Limitaciones: ${profile.injuries}` : ""}

Genera un plan de entrenamiento completo en formato JSON con esta estructura exacta:
{
  "overview": {
    "goal": "breve descripción del objetivo del entrenamiento",
    "frequency": "X días por semana",
    "split": "nombre de la división de entrenamiento",
    "notes": "notas importantes sobre el programa (2-3 frases)"
  },
  "weeklySchedule": [
    {
      "day": "Lunes",
      "focus": "grupo muscular o área de enfoque",
      "exercises": [
        {
          "name": "Nombre del Ejercicio",
          "sets": 4,
          "reps": "6-8",
          "rest": "2-3 min",
          "rpe": 8,
          "notes": "consejos técnicos o tips (opcional)",
          "alternatives": ["Alternativa 1", "Alternativa 2"]
        }
      ]
    }
  ],
  "progression": "estrategia detallada de progresión (2-3 frases explicando cómo progresar)"
}

REGLAS CRÍTICAS SOBRE LOS EJERCICIOS (MUY IMPORTANTE):
- Usa nombres SIMPLES, comunes y fáciles de entender por cualquier persona.
- NO uses terminología anatómica o técnica compleja.
- NO uses palabras como “flexión de”, “extensión de codo”, “aducción”, etc.
- Usa nombres populares de gimnasio.

Ejemplos correctos:
- "Press de banca plano"
- "Press de banca inclinado"
- "Press inclinado con mancuernas"
- "Press Plano con mancuernas"
- "Cruces en polea alta"
- "Cruces en polea baja"
- "Sentadilla"
- "Sentadilla Smith"
- "Sentadilla búlgara"
- "Peso muerto"
- "Fondos de tríceps en máquina"
- "Dominadas"
- "Curl de bíceps con mancuernas"
- "Curl de bíceps en polea"
- "Curl de bíceps martillo"
- "Curl de bíceps predicador"
- "Extensiones de tríceps en polea"
- "Elevaciones laterales"
- "Elevaciones frontales"
- "Elevaciones posteriores"

Ejemplos incorrectos (PROHIBIDOS):
- "Extensión de codo en polea alta"
- "Flexión horizontal de hombro"
- "Aducción escapular en máquina"

REGLAS ADICIONALES:
- Evita nombres ambiguos como "Remo" → usa "Remo con barra" o "Remo con mancuerna"
- Siempre especifica el implemento si aplica (barra, mancuerna, máquina)
- Prioriza ejercicios conocidos en gimnasio comercial
- Si el ejercicio es poco común, reemplázalo por uno más estándar
- Las alternativas también deben seguir estas reglas

REQUISITOS:
- Crea exactamente ${profile.days_per_week} días de entrenamiento
- Cada entrenamiento debe durar máximo ${profile.session_length} minutos
- Incluye entre 4 y 6 ejercicios por sesión
- El RPE debe estar entre 6 y 9
- Usa movimientos compuestos principalmente
- Respeta el tipo de división: ${profile.preferred_split}
${profile.injuries ? `- EVITA ejercicios que puedan agravar: ${profile.injuries}` : ""}
- Hazlo progresivo y adecuado para el nivel ${experienceMap[profile.experience] || profile.experience}

Devuelve ÚNICAMENTE el objeto JSON (sin markdown, sin texto extra).`;
}