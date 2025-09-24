import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const historyQuerySchema = z.object({
  device_id: z.string().min(1),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  violation_type: z.enum(['speeding', 'normal', 'all']).default('all'),
});

export default publicProcedure
  .input(historyQuerySchema)
  .query(async ({ input }) => {
    try {
      // Here you would query your database
      // For now, we'll return mock data
      console.log('Getting violation history:', input);
      
      const mockViolations = [
        {
          id: 'violation_1',
          device_id: input.device_id,
          sector_id: 'sector_1',
          sector_name: 'Околовръстен път - участък 1',
          speed_limit: 90,
          current_speed: 105,
          violation_type: 'speeding' as const,
          location: { latitude: 42.6977, longitude: 23.3219 },
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'violation_2',
          device_id: input.device_id,
          sector_id: 'sector_2',
          sector_name: 'Цариградско шосе - участък 2',
          speed_limit: 50,
          current_speed: 45,
          violation_type: 'normal' as const,
          location: { latitude: 42.6877, longitude: 23.3319 },
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
      
      return {
        violations: mockViolations,
        total: mockViolations.length,
        hasMore: false,
      };
    } catch (error) {
      console.error('Error getting violation history:', error);
      throw new Error('Failed to get violation history');
    }
  });