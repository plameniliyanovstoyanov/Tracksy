import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const violationSchema = z.object({
  device_id: z.string().min(1),
  sector_id: z.string().min(1),
  sector_name: z.string().min(1),
  speed_limit: z.number().positive(),
  current_speed: z.number().positive(),
  violation_type: z.enum(['speeding', 'normal']),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  timestamp: z.string().datetime(),
});

export default publicProcedure
  .input(violationSchema)
  .mutation(async ({ input }) => {
    try {
      // Here you would save to your database
      // For now, we'll just return success
      console.log('Saving violation:', input);
      
      return {
        success: true,
        id: `violation_${Date.now()}`,
        message: 'Violation saved successfully'
      };
    } catch (error) {
      console.error('Error saving violation:', error);
      throw new Error('Failed to save violation');
    }
  });