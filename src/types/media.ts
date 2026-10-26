/**
 * Media Library Types for MISSION
 * Manages independent songs and images libraries
 */

export interface TrackItem {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  src: string; // audio object URL or data URL
  albumArt?: string;
  genre?: string;
  addedAt: number;
  isDemo?: boolean;
  fileName?: string;
  fileSize?: number;
}

export interface ImageItem {
  id: string;
  title: string;
  url: string;
  aspectRatio?: number;
  addedAt: number;
  isDemo?: boolean;
  fileName?: string;
  fileSize?: number;
}
