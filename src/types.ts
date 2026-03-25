export interface CandidateMarket {
  conditionId: string;
  question: string;
  endDate: Date;
  daysToExpiry: number;
  yesTokenId: string;
  noTokenId: string;
  totalDailyRewards: number;
  minSize: number;
  maxSpread: number;
}

export interface ScoredMarket extends CandidateMarket {
  midpoint: number;
  yesTotalSize: number;
  noTotalSize: number;
  existingTotalSize: number;
  rewardPerDollar: number;
}

export interface AllocatedMarket extends ScoredMarket {
  allocatedSize: number;
  estimatedDailyRewards: number;
}
