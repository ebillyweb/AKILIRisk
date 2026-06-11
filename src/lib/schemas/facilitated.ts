import { z } from "zod";

export const startFacilitatedSessionSchema = z.object({
  clientId: z.string().min(1),
  resumeExisting: z.boolean().optional(),
});

export const createFacilitatedClientSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required"),
  clientEmail: z.string().trim().email("Valid email is required"),
});
