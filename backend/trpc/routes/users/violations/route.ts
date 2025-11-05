import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const violationsQuerySchema = z.object({
  user_id: z.string().uuid(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  violation_type: z.enum(['speeding', 'normal', 'all']).default('all'),
  sector_id: z.string().optional(),
});

export default publicProcedure
  .input(violationsQuerySchema)
  .query(async ({ input, ctx }) => {
    try {
      const { user_id, limit, offset, date_from, date_to, violation_type, sector_id } = input;
      
      // Build query
      let query = ctx.supabase
        .from('violations')
        .select('*', { count: 'exact' })
        .eq('user_id', user_id)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply filters
      if (date_from) {
        query = query.gte('timestamp', date_from);
      }
      
      if (date_to) {
        query = query.lte('timestamp', date_to);
      }
      
      if (violation_type !== 'all') {
        query = query.eq('violation_type', violation_type);
      }
      
      if (sector_id) {
        query = query.eq('sector_id', sector_id);
      }

      const { data: violations, error, count } = await query;

      if (error) {
        console.error('Error fetching violations:', error);
        throw new Error('Failed to fetch violations');
      }

      return {
        violations: violations?.map(v => ({
          id: v.id,
          userId: v.user_id,
          deviceId: v.device_id,
          sectorId: v.sector_id,
          sectorName: v.sector_name,
          speedLimit: v.speed_limit,
          currentSpeed: v.current_speed,
          violationType: v.violation_type,
          location: v.location,
          timestamp: v.timestamp,
          duration: v.duration,
          createdAt: v.created_at,
        })) || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      };
    } catch (error) {
      console.error('Error getting violation history:', error);
      throw new Error('Failed to get violation history');
    }
  });

