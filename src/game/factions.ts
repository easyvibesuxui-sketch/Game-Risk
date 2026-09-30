export type FactionId = "humans" | "elves" | "dwarves" | "orcs" | "northmen";

export interface Faction {
  id: FactionId;
  name: string;
  realm: string;
  leader: string;
  color: string;
  motto: string;
}

export const FACTIONS: Faction[] = [
  {
    id: "humans",
    name: "Humans",
    realm: "Crown of Aldmere",
    leader: "King Aldric",
    color: "#9a2f2f",
    motto: "Walled towns, long roads, stubborn knights.",
  },
  {
    id: "elves",
    name: "Elves",
    realm: "Sylvan Court",
    leader: "Queen Aelwyn",
    color: "#3f7f4a",
    motto: "Silver woods and arrows that never miss twice.",
  },
  {
    id: "dwarves",
    name: "Dwarves",
    realm: "Hold of Karak Dun",
    leader: "Thane Borin",
    color: "#a8741f",
    motto: "Stone gates, deep mines, a grudge for every stair.",
  },
  {
    id: "orcs",
    name: "Orcs",
    realm: "Ashen Horde",
    leader: "Warchief Urzog",
    color: "#3b3833",
    motto: "Burnt plains, iron cleavers, no retreat.",
  },
  {
    id: "northmen",
    name: "Northmen",
    realm: "Jarldom of the Fjords",
    leader: "Jarl Ragnhild",
    color: "#3f7aa0",
    motto: "Longships, cold steel, raids at first frost.",
  },
];

export const FACTION_BY_ID: Record<FactionId, Faction> = Object.fromEntries(
  FACTIONS.map((f) => [f.id, f]),
) as Record<FactionId, Faction>;

const FILE: Record<FactionId, string> = {
  humans: "human",
  elves: "elf",
  dwarves: "dwarf",
  orcs: "orc",
  northmen: "north",
};

export const atlasUrl = (file: string) => `${import.meta.env.BASE_URL}atlas/mythic/${file}`;
export const portraitUrl = (id: FactionId) => atlasUrl(`portrait-${FILE[id]}.jpg`);
export const emblemUrl = (id: FactionId) => atlasUrl(`emblem-${FILE[id]}.jpg`);
