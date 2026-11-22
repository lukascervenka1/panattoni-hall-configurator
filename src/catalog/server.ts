import "server-only";
/**
 * Serverový přístup ke katalogu. Jediné místo, které smí importovat neveřejná cenová data (demo/build.ts).
 * "server-only" způsobí chybu buildu, pokud by tento modul skončil v klientském bundle.
 *
 * V M3 nahradí demo zdroj čtení neměnných snapshotů verzí z PostgreSQL (catalog_versions, catalog_state);
 * rozhraní tohoto modulu (aktivní verze + verze podle ID) zůstane stejné.
 */
import { DEMO_CATALOG } from "./demo/build";
import { toPublicCatalog, type PublicCatalog } from "./public";
import type { Catalog } from "./schema";

const VERSIONS = new Map<string, Catalog>([[DEMO_CATALOG.version_id, DEMO_CATALOG]]);
const ACTIVE_VERSION_ID = DEMO_CATALOG.version_id;

export function getActiveCatalog(): Catalog {
  return VERSIONS.get(ACTIVE_VERSION_ID)!;
}

/** Konfigurace zůstává připnutá k verzi, ve které vznikla. Neznámá verze vrací undefined. */
export function getCatalogVersion(versionId: string): Catalog | undefined {
  return VERSIONS.get(versionId);
}

export function getPublicActiveCatalog(): PublicCatalog {
  return toPublicCatalog(getActiveCatalog());
}
