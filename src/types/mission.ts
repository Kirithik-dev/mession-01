/**
 * Types for MISSION Navigation & State Architecture
 */

export type TabId = 'home' | 'clock' | 'images' | 'phonk' | 'settings';

export interface NavTabConfig {
  id: TabId;
  label: string;
}
