import React from 'react';
import { GalleryLiquidRibbonBackground } from './GalleryLiquidRibbonBackground';

/**
 * Re-exporting GalleryLiquidRibbonBackground as GalleryParticleBackground
 * to completely replace the previous scattered particle effect with the
 * living 3D liquid-ribbon background.
 */
export const GalleryParticleBackground: React.FC = () => {
  return <GalleryLiquidRibbonBackground />;
};

export { GalleryLiquidRibbonBackground };
