import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const statsQuerySchema = z.object({
  device_id: z.string().min(1),
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export default publicProcedure
  .input(statsQuerySchema)
  .query(async ({ input }) => {
    try {
      // Here you would query your database for statistics
      // For now, we'll return mock data
      console.log('Getting violation stats:', input);
      
      const mockStats = {
        total_violations: 15,
        speeding_violations: 8,
        normal_passages: 7,
        average_speed: 67.5,
        max_speed: 105,
        most_violated_sector: {
          id: 'sector_1',
          name: 'Околовръстен път - участък 1',
          violations: 5,
        },
        daily_breakdown: [
          { date: '2024-01-20', violations: 3, normal: 2 },
          { date: '2024-01-21', violations: 2, normal: 1 },
          { date: '2024-01-22', violations: 3, normal: 4 },
        ],
        period_summary: {
          period: input.period,
          violations_trend: 'increasing', // 'increasing', 'decreasing', 'stable'
          improvement_percentage: -15, // negative means more violations
        }
      };
      
      return mockStats;
    } catch (error) {
      console.error('Error getting violation stats:', error);
      throw new Error('Failed to get violation stats');
    }
  });