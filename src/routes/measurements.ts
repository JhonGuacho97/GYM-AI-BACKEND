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
        user_id: userId,
        weight_kg: weightKg,
        body_fat_pct: bodyFatPct ?? null,
        waist_cm: waistCm ?? null,
        notes: notes ?? null,
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
      where: { user_id: userId },
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
    const id = req.params.id as string;
    await prisma.body_measurements.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting measurement:", error);
    res.status(500).json({ error: "Error al eliminar la medición" });
  }
});
