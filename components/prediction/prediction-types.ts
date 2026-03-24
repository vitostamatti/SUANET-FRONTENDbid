import {
  CongestionPredictionCorridor,
  CongestionPredictionSegment,
} from "../../lib/prediction/congestion-predictions-service";

export interface PredictionFeatureProps {
  opcDropdownVel: string;
  predictionWidgetVisible: boolean;
  predictionLoading: boolean;
  predictionAnalysisLoading: boolean;
  predictionInteractionDisabled: boolean;
  predictionLoadingCorridors: CongestionPredictionCorridor[];
  predictionCongestionData: CongestionPredictionSegment[];
  predictionRegions: Array<{ areaId: string; name: string }>;
  selectedPredictionRegion: string;
  onPredictionRegionChange: (areaId: string) => void;
  predictionTimeframes: string[];
  predictionReferenceTimeslot: string;
  selectedPredictionTimeslot: string;
  onPredictionTimeslotChange: (timeslot: string) => void;
  predictionStepMinutes: number;
}
