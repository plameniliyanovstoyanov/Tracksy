import { z } from "zod";
import { publicProcedure } from "../../../create-context";

// Get user profile
export default publicProcedure
  .input(z.object({
    user_id: z.string().uuid().optional(), // If not provided, get from auth context
  }))
  .query(async ({ input, ctx }) => {
    try {
      // Get user ID from auth context or input
      const userId = input.user_id;
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Get user profile from database
      const { data: profile, error } = await ctx.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw new Error('Failed to fetch user profile');
      }

      if (!profile) {
        return null;
      }

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        avatarUrl: profile.avatar_url,
        provider: profile.provider,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        lastSeen: profile.last_seen,
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile');
    }
  });

