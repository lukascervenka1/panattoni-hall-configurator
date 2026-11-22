import { describe, expect, it } from "vitest";
import { lowestCarbonOptionIds } from "./carbon";
import { DEMO_CATALOG } from "./demo/build";

const cladding = DEMO_CATALOG.options.filter((option) => option.category_id === "cladding");
const sample = (id: string, gwp: number | null, active = true) => ({ ...cladding[0]!, option_id: id, active, details: { ...cladding[0]!.details, gwp_kg_co2e: gwp } });

describe("nejnižší uhlíková stopa v kategorii", () => {
  it("najde minimum z katalogu bez porovnávání rozdílných kategorií", () => {
    expect([...lowestCarbonOptionIds(DEMO_CATALOG.options, "cladding")]).toEqual(["cladding.eco"]);
    expect([...lowestCarbonOptionIds(DEMO_CATALOG.options, "structure")]).toEqual(["structure.p3"]);
    expect([...lowestCarbonOptionIds(DEMO_CATALOG.options, "roof")]).toEqual(["roof.v4"]);
  });
  it("při shodném minimu označí obě nejnižší varianty", () => {
    expect([...lowestCarbonOptionIds(DEMO_CATALOG.options, "floor")]).toEqual(["floor.v2", "floor.v3"]);
  });
  it("nejnižší nedostupnou nebo neaktivní variantu nedoporučuje", () => {
    expect([...lowestCarbonOptionIds(cladding, "cladding", new Set(["cladding.eco"]))]).toEqual(["cladding.paroc"]);
    expect([...lowestCarbonOptionIds([sample("inactive", 1, false), sample("a", 20), sample("b", 30)], "cladding")]).toEqual(["a"]);
  });
  it("chybějící a neplatné hodnoty nevyhodnocuje jako nulu", () => {
    expect([...lowestCarbonOptionIds([sample("missing", null), sample("invalid", NaN), sample("negative", -5), sample("a", 20), sample("b", 30)], "cladding")]).toEqual(["a"]);
    expect([...lowestCarbonOptionIds([sample("zero", 0), sample("a", 20)], "cladding")]).toEqual(["zero"]);
  });
  it("bez porovnání, při všech shodných hodnotách a u technologií bez údajů štítek nevytváří", () => {
    expect(lowestCarbonOptionIds([sample("a", 20), sample("b", null)], "cladding").size).toBe(0);
    expect(lowestCarbonOptionIds([sample("a", 20), sample("b", 20)], "cladding").size).toBe(0);
    expect(lowestCarbonOptionIds(DEMO_CATALOG.options, "lighting").size).toBe(0);
  });
});
