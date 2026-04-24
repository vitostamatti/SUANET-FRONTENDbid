import {
  CongestionPredictionSegment,
  CongestionPredictionRegion,
} from "../../lib/prediction/congestion-predictions-service";

export interface PredictionLoadingCorridor {
  id: string | number;
  fid: number;
  name: string;
  paths: [number, number][][];
}

export interface PredictionFeatureProps {
  opcDropdownVel: string;
  predictionWidgetVisible: boolean;
  predictionAnalysisLoading: boolean;
  predictionInteractionDisabled: boolean;
  predictionLoadingCorridors: PredictionLoadingCorridor[];
  predictionLoading: boolean;
  predictionNoDataMessage: string;
  predictionCongestionData: CongestionPredictionSegment[];
  predictionRegions: CongestionPredictionRegion[];
  selectedPredictionAreaType: string;
  onPredictionAreaTypeChange: (areaType: string) => void;
  selectedPredictionRegion: string;
  onPredictionRegionChange: (areaId: string) => void;
  predictionTimeframes: string[];
  predictionReferenceTimeslot: string;
  selectedPredictionTimeslot: string;
  onPredictionTimeslotChange: (timeslot: string) => void;
  predictionStepMinutes: number;
  predictionCitywideFullHorizonMode: boolean;
  onPredictionCitywideFullHorizonModeChange: (enabled: boolean) => void;
}
