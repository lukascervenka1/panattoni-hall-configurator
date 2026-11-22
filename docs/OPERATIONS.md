# Provoz a bezpečnost (stav po M1)

Zatím **nic není nasazeno** a žádný skutečný provoz neexistuje. Tento dokument říká, co je hotové a co je třeba před produkcí.

## Hotovo

- Cena, množství a validace jen na serveru; klientský bundle neobsahuje cenové hodnoty (ověřeno grepem buildu, viz [PRICING.md](PRICING.md)). Neveřejná data importuje jen `src/catalog/server.ts` (`server-only`).
- Validace vstupu Zodem; limit těla 8 kB; `Cache-Control: no-store` na `/api/*`; `X-Powered-By` vypnut.
- Žádná tajemství v repozitáři; `.env.example` bez hodnot.
- Stránka má `noindex` (demo s ukázkovými cenami).

## Před produkcí

1. **Rate limit** je v paměti jedné instance. Na Vercelu (serverless) je jen první vrstva; potřeba sdílený limit (WAF nebo sdílené úložiště).
2. **Administrace** (M3): serverově ověřená autentizace a autorizace u každé operace, CSRF, chráněný a necachovaný náhled, audit.
3. **PostgreSQL**: spravovaný, pooling vhodný pro serverless, migrace, zálohy a postup obnovy, RLS nebo ekvivalentní serverová autorizace. Žádné lokální úložiště na Vercelu.
4. **Oddělení prostředí**: preview a produkce nesmějí sdílet zápis do produkčních dat.
5. **Logování**: neukládat konfigurace, osobní ani cenová data; nyní se loguje jen typ chyby 3D scény.
6. **Poptávky** (`/api/inquiry`): rate limit a idempotence jsou v paměti jedné instance, stejně jako u ceny; skutečné odesílání do CRM je vypnuto, dokud není `INQUIRY_REAL_SEND_APPROVED=yes` a nastavené CRM (viz [INQUIRY.md](INQUIRY.md)).
7. **Schválení firmou**: hosting, region dat, zpracovatelé, přístupy, retence poptávek (kap. 19).
8. **Licence** fotek výrobců a finální brand (logo ve variantě pro tmavé pozadí je bílé, pro světlé navy; proporce se nesmějí měnit).
9. **ESLint**, měření výkonu na akceptačních zařízeních, audit přístupnosti.
