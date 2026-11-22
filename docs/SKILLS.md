# Použité skills

Staženy do izolované složky mimo projekt, **prohlédnuty před kopírováním** (jen markdown, bez skriptů, MIT licence; vyhledání podezřelých vzorců `curl`, `eval`, `child_process`, klíče, `sudo` nenašlo nic v použitých skills) a zkopírovány do `.claude/skills/` v projektu. Nic nebylo instalováno globálně ani přes `npx skills add`, žádné tajemství nebylo předáno.

| Skill | Zdroj a revize | Použití |
| --- | --- | --- |
| `threejs-react-three-fiber`, `-geometry`, `-materials`, `-lighting`, `-interaction`, `-performance`, `-asset-pipeline`, `-animation`, `-fundamentals`, `-postprocessing`, `-textures` | CloudAI-X/threejs-skills `0e181866f095b5f06d005133876e926515390d95` | 3D scéna (R3F 9.8, drei 10.7); příklady cílí na r186, projekt je na r187. `-animation`: `AnimationClip`/`AnimationMixer` pro stavbu, `MathUtils.damp` pro přechody voleb (viz [SCENE.md](SCENE.md)) |
| `vercel-react-best-practices` | vercel-labs/agent-skills `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` (složka `react-best-practices`) | dynamický import 3D, deferred value |
| `web-design-guidelines` | tamtéž | audit přístupnosti plánován na M4 |
| `frontend-design` | anthropics/skills `e4bb5d960d87126ff3b3a8af1a104b7db67560ba` | směr rozhraní |
| `supabase-postgres-best-practices` | supabase/agent-skills `c9be0e931b7930f7d02126d04774d904c381e7d7` | M3 (schéma, pooling) |

**Nenainstalováno záměrně:** `webapp-testing` (Python skripty; projekt má TypeScript Playwright, spec zakazuje duplicitní infrastrukturu), `vercel-optimize` (až po nasazení), `xlsx` (volitelná pomůcka pro M3; produkční import musí být deterministický).

Při rozporu má přednost zadání (spec kap. 15). Skills nejsou souhlas k nasazení ani k přístupu k tajemstvím.

## Doplnění při úpravě showroomu

Impeccable 4.10.0 (pbakaus/impeccable, revize b49177d32788f2dc585c42831d845dacf1ebed2c) je projektově dostupný v `.claude/skills/impeccable` přes relativní odkaz do `.claude/vendor/impeccable`. Zdroje včetně referencí a launcheru jsou zachované v upstream git checkoutu; nebyly upraveny ani zapnuty hooky nebo live režim. Pro doladění byly přečteny reference polish a craft-floor. Spuštění launcheru nebylo ověřeno.
