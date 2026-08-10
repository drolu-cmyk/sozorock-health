export type CountyInternalPoint = {
  geoid: string;
  stateFips: string;
  internalPoint: { latitude: number; longitude: number };
};

export function nearestSameStateCountyGeoids(
  counties: CountyInternalPoint[],
  selectedGeoid: string,
  count = 7,
) {
  const origin = counties.find((county) => county.geoid === selectedGeoid);
  if (!origin || !Number.isInteger(count) || count < 2) return [];
  const latitudeRadians = origin.internalPoint.latitude * (Math.PI / 180);
  return counties
    .filter((county) => county.stateFips === origin.stateFips)
    .map((county) => {
      const latitudeDelta = county.internalPoint.latitude - origin.internalPoint.latitude;
      const longitudeDelta = (county.internalPoint.longitude - origin.internalPoint.longitude) * Math.cos(latitudeRadians);
      return { geoid: county.geoid, distance: Math.hypot(latitudeDelta, longitudeDelta) };
    })
    .sort((left, right) => left.distance - right.distance || left.geoid.localeCompare(right.geoid))
    .slice(0, count)
    .map((county) => county.geoid);
}
