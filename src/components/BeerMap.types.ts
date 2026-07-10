export type BeerMapPin = {
  id: string;
  title: string;
  subtitle: string;
  latitude?: number;
  longitude?: number;
  beerCount: number;
};

export type BeerMapProps = {
  pins: BeerMapPin[];
  selectedId?: string;
  onSelect: (id: string) => void;
  focusKey?: number;
};
