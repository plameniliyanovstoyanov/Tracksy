import { publicProcedure } from "../../../create-context";

// Import sectors type from the data file (for fallback)
type Sector = {
  id: string;
  name: string;
  route: string;
  speedLimit: number;
  distance: number;
  description: string;
  startPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
  endPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
  active: boolean;
};

export default publicProcedure
  .query(async ({ ctx }) => {
    try {
      // Try to load sectors from database first
      const { data: dbSectors, error: dbError } = await ctx.supabase
        .from('sectors')
        .select('*')
        .eq('active', true)
        .order('id');

      if (!dbError && dbSectors && dbSectors.length > 0) {
        console.log(`✅ Loaded ${dbSectors.length} sectors from database`);
        
        // Transform database rows to Sector format
        const sectors = dbSectors.map((row: any) => ({
          id: row.id,
          name: row.name,
          route: row.route,
          speedLimit: row.speed_limit,
          distance: row.distance,
          description: row.description || '',
          startPoint: {
            lat: row.start_point_lat,
            lng: row.start_point_lng,
            name: row.start_point_name,
            km: row.start_point_km ?? undefined,
          },
          endPoint: {
            lat: row.end_point_lat,
            lng: row.end_point_lng,
            name: row.end_point_name,
            km: row.end_point_km ?? undefined,
          },
          active: row.active,
        } as Sector));

        return { sectors };
      }

      // Fallback to local data file if database is empty or error occurs
      console.warn('⚠️ Database query failed or returned no results, falling back to local data:', dbError?.message);
      
      let sectors;
      try {
        const sectorsModule = await import("@/data/sectors");
        sectors = sectorsModule.sectors;
      } catch (error) {
        // Fallback to relative path if alias doesn't work in backend context
        const sectorsModule = await import("../../../../../data/sectors");
        sectors = sectorsModule.sectors;
      }
      
      console.log(`📦 Loaded ${sectors.length} sectors from local data file (fallback)`);
      
      return {
        sectors: sectors.map(sector => ({
          id: sector.id,
          name: sector.name,
          route: sector.route,
          speedLimit: sector.speedLimit,
          distance: sector.distance,
          description: sector.description,
          startPoint: {
            lat: sector.startPoint.lat,
            lng: sector.startPoint.lng,
            name: sector.startPoint.name,
            km: sector.startPoint.km,
          },
          endPoint: {
            lat: sector.endPoint.lat,
            lng: sector.endPoint.lng,
            name: sector.endPoint.name,
            km: sector.endPoint.km,
          },
          active: sector.active,
        } as Sector)),
      };
    } catch (error) {
      console.error('❌ Error loading sectors from backend:', error);
      throw new Error('Failed to load sectors');
    }
  });

