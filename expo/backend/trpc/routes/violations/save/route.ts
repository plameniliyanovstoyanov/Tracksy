import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const violationSchema = z.object({
  user_id: z.string().uuid().optional(), // Optional - can be null for anonymous users
  device_id: z.string().optional(), // For backward compatibility with anonymous users
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
  duration: z.number().optional(), // Duration in seconds
});

export default publicProcedure
  .input(violationSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      // At least one identifier must be provided
      if (!input.user_id && !input.device_id) {
        throw new Error('Either user_id or device_id must be provided');
      }

      console.log('Saving violation:', input);

      // Save to database
      const { data, error } = await ctx.supabase
        .from('violations')
        .insert({
          user_id: input.user_id || null,
          device_id: input.device_id || null,
          sector_id: input.sector_id,
          sector_name: input.sector_name,
          speed_limit: input.speed_limit,
          current_speed: input.current_speed,
          violation_type: input.violation_type,
          location: input.location,
          timestamp: input.timestamp,
          duration: input.duration || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving violation to database:', error);
        throw new Error('Failed to save violation');
      }
      
      return {
        success: true,
        id: data.id,
        message: 'Violation saved successfully'
      };
    } catch (error) {
      console.error('Error saving violation:', error);
      throw new Error('Failed to save violation');
    }
  });