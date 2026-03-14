const createMockCongestionState = () => ({
  initialized: false,
  initPromise: null,
  generatedAt: null,
  stepMinutes: 15,
  referenceTimeslot: null,
  pastPeriods: 8,
  futurePeriods: 8,
  timeframes: [],
  regions: [],
  recordsByTimeslot: new Map(),
  sourceTimeframes: [],
  sourceReferenceTimeslot: null,
  timeslotSourceMap: new Map(),
  mviByCode: new Map(),
  areaByMviCode: new Map(),
  responseCache: new Map(),
});

const mockCongestionState = createMockCongestionState();

module.exports = {
  mockCongestionState,
  createMockCongestionState,
};
