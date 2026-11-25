export const loyaltyTierNames = ['Đồng', 'Bạc', 'Vàng', 'Kim cương'];

export const normalizeLoyaltyTiers = (tiers) => {
  const configuredTiers = Array.isArray(tiers) && tiers.length
    ? [...tiers].sort((a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0))
    : [{ minPoints: 0 }];

  return configuredTiers.slice(0, loyaltyTierNames.length).map((tier, index) => ({
    name: loyaltyTierNames[index],
    minPoints: Math.max(0, Math.floor(Number(tier.minPoints) || 0))
  }));
};
