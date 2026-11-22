import { getPublicActiveCatalog } from "@/catalog/server";
import { Configurator } from "@/ui/Configurator";

// Veřejná projekce katalogu (bez cen) se předává klientovi jako data; ceny zůstávají na serveru.
export default function Page() {
  return <Configurator catalog={getPublicActiveCatalog()} />;
}
