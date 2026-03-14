import { CongestionPredictionSegment } from "../../lib/prediction/congestion-predictions-service";

export interface PredictionFeatureProps {
  opcDropdownVel: string;
  predictionWidgetVisible: boolean;
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
