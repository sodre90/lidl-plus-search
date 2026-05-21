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

## Követelmények

- **Go** 1.22+ (a fordításhoz) — a `go build` automatikusan letölt egy újabb
  eszközláncot, ha egy függőség azt kéri.
- Telepített **Google Chrome** (csak az egyszeri `login`-hoz kell).

## Fordítás

```sh
go build -o lidlsearch .
```

Opcionálisan telepítheted a `PATH`-odra:

```sh
go install .   # a `lidlsearch` ide kerül: $(go env GOPATH)/bin
```

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
```

A keresés **ékezet- és kisbetű-érzéketlen** (pl. `kenyer` megtalálja a `Kenyér`-t).

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
cmd_*.go           parancsok (login, sync, search/list/show/raw)
internal/config    config könyvtár, token + adatbázis útvonalak, ország/nyelv
internal/auth      OAuth2 PKCE folyamat + chromedp böngészős login
internal/lidl      hitelesített blokk-API kliens
internal/store     SQLite tárolás, elemzés, ékezet-érzéketlen keresés
```
