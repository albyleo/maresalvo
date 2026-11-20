"use client";

import { MarineMap } from './MarineMap';
import type { MarineProtectedArea, GhostNetReport, AisVesselPoint } from '@/types';

interface Props {
  areas: MarineProtectedArea[];
  ghostNets?: GhostNetReport[];
  aisVessels?: AisVesselPoint[];
  activationRequired?: boolean;
}

export function MapExplorer({ activationRequired = false, ...props }: Props) {
  return <MarineMap {...props} fullScreen activationRequired={activationRequired}/>;
}
