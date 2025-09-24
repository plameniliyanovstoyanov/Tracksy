import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
import { trpcClient } from '@/lib/trpc';

export interface ViolationRecord {
  id: string;
  device_id: string;
  sector_id: string;
  sector_name: string;
  speed_limit: number;
  current_speed: number;
  violation_type: 'speeding' | 'normal';
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: string;
}

export interface ViolationStats {
  total_violations: number;
  speeding_violations: number;
  normal_passages: number;
  average_speed: number;
  max_speed: number;
  most_violated_sector: {
    id: string;
    name: string;
    violations: number;
  };
  daily_breakdown: {
    date: string;
    violations: number;
    normal: number;
  }[];
  period_summary: {
    period: 'daily' | 'weekly' | 'monthly';
    violations_trend: 'increasing' | 'decreasing' | 'stable';
    improvement_percentage: number;
  };
}

export const [ViolationHistoryProvider, useViolationHistory] = createContextHook(() => {
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save a new violation
  const saveViolation = useCallback(async (
    deviceId: string,
    sectorId: string,
    sectorName: string,
    speedLimit: number,
    currentSpeed: number,
    location: { latitude: number; longitude: number }
  ) => {
    try {
      setError(null);
      
      const violationType: 'speeding' | 'normal' = currentSpeed > speedLimit ? 'speeding' : 'normal';
      
      const result = await trpcClient.violations.save.mutate({
        device_id: deviceId,
        sector_id: sectorId,
        sector_name: sectorName,
        speed_limit: speedLimit,
        current_speed: currentSpeed,
        violation_type: violationType,
        location,
        timestamp: new Date().toISOString(),
      });

      console.log('Violation saved:', result);
      
      // Add to local state for immediate UI update
      const newViolation: ViolationRecord = {
        id: result.id,
        device_id: deviceId,
        sector_id: sectorId,
        sector_name: sectorName,
        speed_limit: speedLimit,
        current_speed: currentSpeed,
        violation_type: violationType,
        location,
        timestamp: new Date().toISOString(),
      };
      
      setViolations(prev => [newViolation, ...prev]);
      
      return result;
    } catch (error) {
      console.error('Error saving violation:', error);
      setError('Failed to save violation');
      throw error;
    }
  }, []);

  // Load violation history
  const loadHistory = useCallback(async (
    deviceId: string,
    options?: {
      limit?: number;
      offset?: number;
      dateFrom?: string;
      dateTo?: string;
      violationType?: 'speeding' | 'normal' | 'all';
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await trpcClient.violations.history.query({
        device_id: deviceId,
        limit: options?.limit || 50,
        offset: options?.offset || 0,
        date_from: options?.dateFrom,
        date_to: options?.dateTo,
        violation_type: options?.violationType || 'all',
      });

      setViolations(result.violations);
      
      return result;
    } catch (error) {
      console.error('Error loading violation history:', error);
      setError('Failed to load violation history');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load violation statistics
  const loadStats = useCallback(async (
    deviceId: string,
    options?: {
      period?: 'daily' | 'weekly' | 'monthly';
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await trpcClient.violations.stats.query({
        device_id: deviceId,
        period: options?.period || 'daily',
        date_from: options?.dateFrom,
        date_to: options?.dateTo,
      });

      setStats(result as ViolationStats);
      
      return result;
    } catch (error) {
      console.error('Error loading violation stats:', error);
      setError('Failed to load violation statistics');
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setViolations([]);
    setStats(null);
    setError(null);
  }, []);

  // Get filtered violations
  const getFilteredViolations = useCallback((
    violationType?: 'speeding' | 'normal' | 'all',
    sectorId?: string
  ) => {
    let filtered = violations;
    
    if (violationType && violationType !== 'all') {
      filtered = filtered.filter(v => v.violation_type === violationType);
    }
    
    if (sectorId) {
      filtered = filtered.filter(v => v.sector_id === sectorId);
    }
    
    return filtered;
  }, [violations]);

  return useMemo(() => ({
    violations,
    stats,
    loading,
    error,
    saveViolation,
    loadHistory,
    loadStats,
    clearHistory,
    getFilteredViolations,
  }), [
    violations,
    stats,
    loading,
    error,
    saveViolation,
    loadHistory,
    loadStats,
    clearHistory,
    getFilteredViolations,
  ]);
});