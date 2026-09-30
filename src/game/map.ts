// The 42-node rules graph. Geometry lives in map-shapes.ts and is presentation only:
// sea-separated neighbours do not share a land edge, they still attack.

export type ContinentId = "na" | "sa" | "eu" | "af" | "as" | "au";

export interface Continent {
  id: ContinentId;
  name: string;
  bonus: number;
}

export interface Territory {
  id: string;
  name: string;
  continent: ContinentId;
  neighbors: string[];
}

export const CONTINENTS: Continent[] = [
  { id: "na", name: "North America", bonus: 5 },
  { id: "sa", name: "South America", bonus: 2 },
  { id: "eu", name: "Europe", bonus: 5 },
  { id: "af", name: "Africa", bonus: 3 },
  { id: "as", name: "Asia", bonus: 7 },
  { id: "au", name: "Australia", bonus: 2 },
];

const RAW: [string, string, ContinentId, string[]][] = [
  ["alaska", "Alaska", "na", ["northwest_territory", "alberta", "kamchatka"]],
  ["northwest_territory", "Northwest Territory", "na", ["alaska", "alberta", "ontario", "greenland"]],
  ["greenland", "Greenland", "na", ["northwest_territory", "ontario", "quebec", "iceland"]],
  ["alberta", "Alberta", "na", ["alaska", "northwest_territory", "ontario", "western_us"]],
  ["ontario", "Ontario", "na", ["northwest_territory", "alberta", "western_us", "eastern_us", "quebec", "greenland"]],
  ["quebec", "Quebec", "na", ["ontario", "eastern_us", "greenland"]],
  ["western_us", "Western United States", "na", ["alberta", "ontario", "eastern_us", "central_america"]],
  ["eastern_us", "Eastern United States", "na", ["western_us", "ontario", "quebec", "central_america"]],
  ["central_america", "Central America", "na", ["western_us", "eastern_us", "venezuela"]],

  ["venezuela", "Venezuela", "sa", ["central_america", "peru", "brazil"]],
  ["peru", "Peru", "sa", ["venezuela", "brazil", "argentina"]],
  ["brazil", "Brazil", "sa", ["venezuela", "peru", "argentina", "north_africa"]],
  ["argentina", "Argentina", "sa", ["peru", "brazil"]],

  ["iceland", "Iceland", "eu", ["greenland", "great_britain", "scandinavia"]],
  ["great_britain", "Great Britain", "eu", ["iceland", "scandinavia", "northern_europe", "western_europe"]],
  ["scandinavia", "Scandinavia", "eu", ["iceland", "great_britain", "northern_europe", "ukraine"]],
  ["northern_europe", "Northern Europe", "eu", ["great_britain", "scandinavia", "ukraine", "southern_europe", "western_europe"]],
  ["western_europe", "Western Europe", "eu", ["great_britain", "northern_europe", "southern_europe", "north_africa"]],
  ["southern_europe", "Southern Europe", "eu", ["western_europe", "northern_europe", "ukraine", "middle_east", "egypt", "north_africa"]],
  ["ukraine", "Ukraine", "eu", ["scandinavia", "northern_europe", "southern_europe", "middle_east", "afghanistan", "ural"]],

  ["north_africa", "North Africa", "af", ["brazil", "western_europe", "southern_europe", "egypt", "east_africa", "congo"]],
  ["egypt", "Egypt", "af", ["north_africa", "southern_europe", "middle_east", "east_africa"]],
  ["east_africa", "East Africa", "af", ["egypt", "north_africa", "congo", "south_africa", "madagascar", "middle_east"]],
  ["congo", "Congo", "af", ["north_africa", "east_africa", "south_africa"]],
  ["south_africa", "South Africa", "af", ["congo", "east_africa", "madagascar"]],
  ["madagascar", "Madagascar", "af", ["south_africa", "east_africa"]],

  ["ural", "Ural", "as", ["ukraine", "siberia", "china", "afghanistan"]],
  ["siberia", "Siberia", "as", ["ural", "yakutsk", "irkutsk", "mongolia", "china"]],
  ["yakutsk", "Yakutsk", "as", ["siberia", "irkutsk", "kamchatka"]],
  ["kamchatka", "Kamchatka", "as", ["yakutsk", "irkutsk", "mongolia", "japan", "alaska"]],
  ["irkutsk", "Irkutsk", "as", ["siberia", "yakutsk", "kamchatka", "mongolia"]],
  ["mongolia", "Mongolia", "as", ["siberia", "irkutsk", "kamchatka", "japan", "china"]],
  ["japan", "Japan", "as", ["kamchatka", "mongolia"]],
  ["afghanistan", "Afghanistan", "as", ["ukraine", "ural", "china", "india", "middle_east"]],
  ["china", "China", "as", ["ural", "siberia", "mongolia", "afghanistan", "india", "siam"]],
  ["middle_east", "Middle East", "as", ["ukraine", "southern_europe", "egypt", "east_africa", "afghanistan", "india"]],
  ["india", "India", "as", ["middle_east", "afghanistan", "china", "siam"]],
  ["siam", "Siam", "as", ["india", "china", "indonesia"]],

  ["indonesia", "Indonesia", "au", ["siam", "new_guinea", "western_australia"]],
  ["new_guinea", "New Guinea", "au", ["indonesia", "western_australia", "eastern_australia"]],
  ["western_australia", "Western Australia", "au", ["indonesia", "new_guinea", "eastern_australia"]],
  ["eastern_australia", "Eastern Australia", "au", ["new_guinea", "western_australia"]],
];

export const TERRITORIES: Territory[] = RAW.map(([id, name, continent, neighbors]) => ({
  id,
  name,
  continent,
  neighbors,
}));

export const TERRITORY_BY_ID: Record<string, Territory> = Object.fromEntries(
  TERRITORIES.map((t) => [t.id, t]),
);

export function areNeighbors(a: string, b: string): boolean {
  return TERRITORY_BY_ID[a]?.neighbors.includes(b) ?? false;
}

export function continentTerritories(id: ContinentId): string[] {
  return TERRITORIES.filter((t) => t.continent === id).map((t) => t.id);
}
