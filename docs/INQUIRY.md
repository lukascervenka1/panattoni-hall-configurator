# Poptávka a předání do CRM

Stav: **demo, nic se skutečně neodesílá**. Kód je připravený tak, aby se po schválení dalo připojit CRM (Dynamics 365, případně BlueHub), ale spec výslovně zakazuje vydávat neschválenou integraci za skutečnou (kap. 13) a posílat skutečné poptávky bez schválení (kap. 1).

## Tok

1. V režimu **Náhled** zákazník otevře "Poptávka", vybere zájem (poptávka haly, development manager, akvizice), vyplní firmu, kontaktní osobu, e-mail, volitelně telefon a poznámku a zaškrtne souhlas.
2. Klient pošle na `POST /api/inquiry` jen kontakt, souhlas a **konfiguraci**. Cenu ani množství neposílá.
3. Server ([handler.ts](../src/inquiry/handler.ts)): omezení počtu požadavků (5 za minutu na IP) → limit 20 kB → validace (Zod, [schema.ts](../src/inquiry/schema.ts)) → past na boty (skryté pole) → ověření verze katalogu → **přepočet ceny na serveru** → záznam pro CRM ([record.ts](../src/inquiry/record.ts)) → idempotence podle `submissionId` → adaptér.
4. Odpověď: `{ status: "accepted", reference, mock }`. Pokud je `mock: true`, rozhraní řekne, že poptávka nebyla nikam odeslána.

Záznam obsahuje: kontakt, zájem, poznámku, souhlas (znění, čas), verzi a označení katalogu (včetně příznaku demo), konfiguraci, serverově přepočtenou cenu (dílčí součet nebo celek, výhrady, řádky) a lidsky čitelný souhrn.

## Adaptéry ([adapters](../src/inquiry/adapters))

| Adaptér | Výběr | Co dělá |
| --- | --- | --- |
| `mock` | výchozí | Nic neodešle ani neuloží, do logu nepíše. Vrací označenou referenci `DEMO-…`. |
| `dynamics365` | `INQUIRY_ADAPTER=dynamics365` | Vytvoří lead v Dataverse (`POST {org}/api/data/v9.2/leads`), přihlášení přes Entra ID (client credentials). **Neověřeno proti skutečnému prostředí.** |
| neznámý (např. `bluehub`) | jiná hodnota | Odmítne s kódem `unknown_adapter`. BlueHub zatím není implementován, protože neznáme kontrakt. |

Ostrý adaptér se nikdy nespustí "tiše": bez `INQUIRY_REAL_SEND_APPROVED=yes` a bez všech `DYNAMICS_*` hodnot server odpoví `503` a nic neodešle ani nenahradí mockem.

### Mapování na lead (Dynamics 365)

Používají se jen standardní pole entity `lead` ([crm-mapping.ts](../src/inquiry/adapters/crm-mapping.ts)): `subject`, `firstname`, `lastname`, `companyname`, `emailaddress1`, `telephone1`, `description` (nejvýše 2000 znaků: zájem, poznámka, souhrn konfigurace, cena s výhradami, upozornění na demo katalog, identifikátor, znění souhlasu). Vlastní pole se přidají jen tehdy, když zadáte jejich logické názvy: `DYNAMICS_FIELD_CONFIG_JSON` (celá konfigurace), `DYNAMICS_FIELD_SUBMISSION_ID` (vhodné pro deduplikaci) a `DYNAMICS_FIELD_INTENT`.

## Ochrana osobních údajů a zneužití

- Sbírají se jen potřebné údaje. Chyby a logy nesou jen kód (např. `crm_http_401`), nikdy jméno, e-mail, konfiguraci ani cenu.
- Odpověď 400 vrací jen názvy chybných polí, ne zadané hodnoty.
- Rate limit a idempotence jsou v paměti jedné instance: na Vercelu jsou jen první vrstvou. Před produkcí je nutný sdílený limit a sdílené úložiště idempotence (stejně jako u `/api/price`, viz [OPERATIONS.md](OPERATIONS.md)). Zvažte také CAPTCHA nebo jiný nástroj proti botům.
- Znění souhlasu je demo (`CONSENT_TEXT_VERSION = demo-0`): závazné znění a odkaz na zásady schválí Panattoni.

## Otevřené otázky (potřebuji od vás)

1. **BlueHub:** co přesně to je (CRM, jiný systém, API)? Bez kontraktu (autentizace, endpointy, pole) ho neimplementuji.
2. **Dynamics 365:** adresa prostředí, jak se vytváří přístup (aplikační uživatel), jestli se mají zakládat **leady**, nebo jiná entita (např. příležitost, vlastní entita), a názvy vlastních polí.
3. **Směrování:** komu poptávky chodí (development manager vs. akvizice, podle regionu nebo koncepce?) a jak se v CRM přiřadí vlastník záznamu.
4. **Druhy zájmu:** je správný seznam (poptávka haly, development manager, akvizice)? Má akvizice jiná pole (např. nabídka pozemku: lokalita, rozloha)?
5. **Osobní údaje:** kam se mají poptávky skutečně odesílat, jaká je retence a kdo je správce/zpracovatel; znění souhlasu a odkaz na zásady.
6. **Po odeslání:** potvrzovací e-mail zákazníkovi a interní upozornění týmu? (vyžaduje e-mailový systém a schválené šablony)
7. **Ochrana proti botům:** stačí skryté pole a limit, nebo požadujete CAPTCHA?
