import { z } from "zod";
import { publicProcedure } from "../../../create-context";

const settingsSchema = z.object({
  user_id: z.string().uuid(),
  notifications_enabled: z.boolean().optional(),
  vibration_enabled: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
  background_tracking_enabled: z.boolean().optional(),
  early_warning_enabled: z.boolean().optional(),
});

// Get user settings
export const getSettings = publicProcedure
  .input(z.object({
    user_id: z.string().uuid(),
  }))
  .query(async ({ input, ctx }) => {
    try {
      const { data, error } = await ctx.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', input.user_id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user settings:', error);
        throw new Error('Failed to fetch user settings');
      }

      // Return default settings if no record exists
      if (!data) {
        return {
          notifications_enabled: true,
          vibration_enabled: true,
          sound_enabled: true,
          background_tracking_enabled: false,
          early_warning_enabled: true,
        };
      }

      return {
        notifications_enabled: data.notifications_enabled ?? true,
        vibration_enabled: data.vibration_enabled ?? true,
        sound_enabled: data.sound_enabled ?? true,
        background_tracking_enabled: data.background_tracking_enabled ?? false,
        early_warning_enabled: data.early_warning_enabled ?? true,
      };
    } catch (error) {
      console.error('Error in getSettings:', error);
      throw error;
    }
  });

// Save user settings
export const saveSettings = publicProcedure
  .input(settingsSchema)
  .mutation(async ({ input, ctx }) => {
    try {
      const { user_id, ...settings } = input;

      // Use upsert to insert or update
      const { data, error } = await ctx.supabase
        .from('user_settings')
        .upsert({
          user_id,
          ...settings,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving user settings:', error);
        throw new Error('Failed to save user settings');
      }

      return {
        success: true,
        settings: data,
        message: 'Settings saved successfully',
      };
    } catch (error) {
      console.error('Error in saveSettings:', error);
      throw error;
    }
  });


