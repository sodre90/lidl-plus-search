# lidlsearch

*[English](README.md) · Magyar*

Kis parancssori eszköz, ami letölti a **Lidl Plus** blokkjaidat, és keresni tudsz
a rajtuk lévő tételek között — például „milyen gyakran és mennyiért vettem
kenyeret?".

Különösen hasznos **garanciális ügyintézésnél**: amikor egy termék hónapokkal
később elromlik, nehéz megtalálni a hozzá tartozó blokkot — itt elég a termék
nevére keresni, hogy megtudd, melyik blokkon van, majd a `show` paranccsal
előhívod azt vásárlási bizonylatként.

Mindent **helyben** tárol (egy SQLite adatbázisban a konfigurációs könyvtáradban),
és közvetlenül a Lidl Plus háttérrendszerével kommunikál; semmit nem küld máshová.

> ⚠️ **Nem hivatalos.** A Lidl Plusnak nincs nyilvános API-ja. Ez az eszköz a
> hivatalos mobilalkalmazás bejelentkezését és végpontjait utánozza, a közösség
> által visszafejtve. Bármikor elromolhat, ha a Lidl változtat valamin, és kizárólag
> a **saját** fiókod adataihoz való hozzáférésre szolgál.

## Hogyan működik

1. **`login`** megnyit egy valódi Chrome ablakot, ahol bejelentkezel (jelszó +
   2FA). Az alkalmazás OAuth2 *authorization code + PKCE* folyamatot használ,
   elkapja a `com.lidlplus.app://callback?code=...` átirányítást, és lecseréli egy
   lemezre mentett **refresh tokenre**. Ezt csak egyszer kell megtenned.
2. **`sync`** a refresh token segítségével letölti a blokkjaidat, és SQLite-ba
   menti. A listát a `tickets.lidlplus.com/api/v2/{ország}/tickets` végponton kéri
   le, az egyes blokkok részleteit pedig a `.../api/v3/{ország}/tickets/{id}`
   végponton. HU esetén a tételsorok a blokk nyomtatott HTML-jébe vannak ágyazva,
   ezt elemzi kereshető sorokká. Minden blokk teljes nyers JSON-ja is megőrződik.
   Terminálban élő folyamatjelző látszik (csőbe irányítva sima naplósorok).
3. **`search` / `list` / `show`** a helyi adatbázisban keres — gyorsan és offline.
4. **`web`** elindít egy kis helyi szervert, és böngészőben megnyit egy kattintható
   felületet (élő keresés, szűrők, ár-idő grafikon, kattintható blokkok).

## Mobilalkalmazás

A [`mobile/`](mobile/) mappában van egy önálló alkalmazás is (Expo / React
Native), amely mindent a készüléken végez — belépés, szinkron, böngészés,
keresés és költséggrafikonok —, szerver nélkül. Ugyanazt a belépési, elemző és
kereső logikát portolja, mint ez az eszköz.

**A gyakorlatban csak Android.** A kód platformfüggetlen, de eddig kizárólag
Androidon készült és lett tesztelve; **iOS-en még egyetlen alkalommal sem
futott**, így nem tudni, hogy működik-e ott.

**Android:** töltsd le az `.apk` fájlt a
[legfrissebb kiadásból](https://github.com/sodre90/lidl-plus-search/releases/latest),
és nyisd meg a telefonodon (az Android engedélyt fog kérni a böngészőből való
telepítéshez). Alá van írva, de nem a Play áruházból jön, ezért a szokásos
„ismeretlen alkalmazás" figyelmeztetés megjelenik.

A fordítási tudnivalók és az iOS rész a [mobile/README.md](mobile/README.md)
fájlban vannak.

## Követelmények

- **Go** 1.22+ (a fordításhoz) — a `go build` automatikusan letölt egy újabb
  eszközláncot, ha egy függőség azt kéri.
- Telepített **Google Chrome** (csak az egyszeri `login`-hoz kell).

## Fordítás

```sh
go build -o lidlsearch .
```

Vagy telepítsd a legfrissebbet egyenesen a GitHubról:

```sh
go install github.com/sodre90/lidl-plus-search@latest
```

> A `go install` a binárist `lidl-plus-search` néven hozza létre (a repo neve
> alapján). A lenti példák a rövidebb `lidlsearch`-öt használják; vagy csinálj rá
> aliast, vagy fordítsd helyben: `go build -o lidlsearch .`.

## Használat

```sh
# 1. Bejelentkezés (böngészőt nyit; csak egyszer kell)
./lidlsearch login

# 2. Blokkok letöltése (inkrementális — az első futás után csak az újak)
./lidlsearch sync
./lidlsearch sync --since 2025-01-01   # ne menjen vissza ennél a dátumnál régebbre
./lidlsearch sync --full               # minden újraletöltése/újrafeldolgozása
./lidlsearch sync --pages 1            # csak a legfrissebb oldal (~25 blokk; főleg teszteléshez)

# 3. Keresés a tételek között
./lidlsearch search kenyér
./lidlsearch search tej --from 2026-01-01 --to 2026-03-31
./lidlsearch search kávé --min 1000 --limit 20

# Böngészés
./lidlsearch list                  # legutóbbi blokkok
./lidlsearch show <blokk-id>       # egy blokk tételei
./lidlsearch raw <blokk-id>        # nyers JSON (hibakereséshez)

# Vagy a webes felület
./lidlsearch web                   # megnyitja a http://127.0.0.1:8787 címet a böngészőben
./lidlsearch web --addr :9000      # másik porton figyel
./lidlsearch web --no-open         # ne nyisson böngészőt automatikusan
```

A keresés **ékezet- és kisbetű-érzéketlen** (pl. `kenyer` megtalálja a `Kenyér`-t).

## Webes felület

A `lidlsearch web` magából a binárisból szolgál ki egy kis egyoldalas alkalmazást
(semmit nem tölt le az internetről), és megnyitja a böngészőben. Betöltéskor egy
**havi költés** grafikont és a legutóbbi blokkjaidat mutatja; a keresőmezőbe
gépelve élő, ékezet-érzéketlen
találatokat kapsz dátum/ár szűrőkkel, interaktív grafikonokkal (egységár az idő
függvényében és havi költés, egérráhúzásra megjelenő értékekkel) és összegzéssel
arról, mennyit költöttél. Bármelyik sorra kattintva megnézheted a teljes blokkot. A
fejlécben lévő **Sync** gomb letölti az új blokkokat (ugyanaz az inkrementális
szinkron, mint a CLI-ben) élő folyamatjelzéssel, majd frissíti a nézetet. A
szerver leállításához nyomj Ctrl+C-t a terminálban.

A felület egy React + TypeScript alkalmazás (Vite-tal fordítva), aminek a fordított
kimenete az `internal/web/assets` alatt van verziókezelve és `go:embed`-del
beágyazva, így a sima `go build` / `go install` önálló binárist készít — **a
futtatáshoz nem kell Node, csak a felület módosításához**. A frontend szerkesztése
után így fordítható újra:

```sh
cd frontend
npm install      # csak először
npm run build    # a fordított felületet a ../internal/web/assets-be írja
```

Frontend-fejlesztéshez hot reloaddal futtasd a Go szervert (`./lidlsearch web`),
és egy másik terminálban a `frontend/`-ben az `npm run dev`-et — a Vite a `/api`
hívásokat a 8787-es porton futó Go szerverhez proxyzza.

## Beállítások

| Mi | Hol |
| --- | --- |
| Tokenek | `<config-dir>/lidl-plus-item-search/token.json` (jogosultság `0600`) |
| Adatbázis | `<config-dir>/lidl-plus-item-search/lidl.db` |

A `<config-dir>` az `os.UserConfigDir()` — macOS-en ez a
`~/Library/Application Support`.

A fiók országa/nyelve alapból **Magyarország** (`HU` / `hu-HU`). Szükség esetén
környezeti változókkal felülírható:

```sh
LIDL_COUNTRY=DE LIDL_LANGUAGE=de-DE ./lidlsearch sync
```

## Megjegyzések és hibaelhárítás

- **A login nem kapja el automatikusan a kódot.** Néhány konfigurációnál a
  custom-scheme átirányítás nem jut el az alkalmazáshoz. Ilyenkor másold ki a
  `com.lidlplus.app://callback?...` kezdetű URL-t a böngésző címsorából, illeszd be
  a terminálba, és nyomj Entert.
- **Az első `sync` lassú.** Blokkonként egy kérést indít, így egy hosszú előzmény
  eltarthat egy ideig. A `--since YYYY-MM-DD` kihagyja a régebbi blokkokat (pl. csak
  az utolsó év), a `--pages N` pedig korlátozza. A későbbi szinkronok
  inkrementálisak: a már meglévő blokkokat kihagyja és soha nem tölti le újra —
  csak a gyors lista-oldalakat kéri le újra, hogy megtalálja az új vagy még
  hiányzó blokkokat, így egy részleges előzmény (pl. `--pages` után) a következő
  teljes futáskor kiegészül.
- **Egy blokknál `0 tétel` jelenik meg.** A tételeket a blokk nyomtatott HTML-jéből
  elemzi (HU formátum). A nyers JSON mindig tárolódik, így a
  `./lidlsearch raw <blokk-id>` megmutatja a valós szerkezetet; az elemző az
  `internal/store/htmlreceipt.go`-ban van, és igazítható.
- **Lejárt refresh token / 401 hibák.** Futtasd újra: `./lidlsearch login`.
- **`App-Version` fejléc.** A tickets háttérrendszer lefagy (HTTP/2
  `INTERNAL_ERROR`) a `999.99.9` értékre; a kliens ezért normál verziót küld. A
  részletek végpont ráadásul 2 karakteres `Accept-Language`-et igényel (az
  országkódot).

## Projekt felépítése

```
main.go            CLI belépés + parancs-elágazás
cmd_*.go           parancsok (login, sync, search/list/show/raw, web)
cmd_web.go         helyi webszerver + JSON API (az internal/store-t használja)
internal/config    config könyvtár, token + adatbázis útvonalak, ország/nyelv
internal/auth      OAuth2 PKCE folyamat + chromedp böngészős login
internal/lidl      hitelesített blokk-API kliens
internal/store     SQLite tárolás, elemzés, ékezet-érzéketlen keresés
internal/web       beágyazott webes felület (a frontend/-ből fordítva)
frontend/          React + TypeScript felület forrása (Vite); az internal/web/assets-be fordít
```
