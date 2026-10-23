<div align="center">

<img src="src-tauri/icons/icon.png" alt="RepoShelf" width="80" />

# RepoShelf

**Panel lokálnych repozitárov: stav Gitu, posledné commity a spúšťanie projektov s logmi v jednom okne**

![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)

[English](README.md) · [Українська](README.uk.md) · [Русский](README.ru.md) · [Slovenčina](README.sk.md) · [Deutsch](README.de.md)

</div>

---

## Prehľad

RepoShelf prehľadá vybraný priečinok a zobrazí lokálne Git repozitáre na jednom paneli

Hneď vidíte, ktoré projekty majú zmeny, ktoré ešte nie sú súčasťou commitu, ktorá vetva je otvorená a aký bol posledný commit. Pre každý projekt môžete uložiť príkaz na spustenie, otvoriť editor a zobraziť výstup procesu

Aplikácia funguje lokálne, nevyžaduje účet a neposiela obsah repozitárov na server

---

## Funkcie

| Funkcia | Podrobnosti |
|---|---|
| Zoznam projektov | Vyhľadávanie repozitárov vo vybranom priečinku a vnorených adresároch do hĺbky 5 úrovní |
| Stav Gitu | Aktuálna vetva, zmenené a nesledované súbory, počet commitov pred a za upstream vetvou |
| Prehliadač diffov | Zvýraznené pridané a odstránené riadky, čísla riadkov, samostatný pohľad na index a pracovný adresár |
| Posledný commit | Správa, autor, krátky hash a čas |
| Rýchle vyhľadávanie | Podľa názvu, cesty alebo vetvy pomocou `⌘ K` / `Ctrl K` |
| Filtre | Všetky projekty, so zmenami, nedávno otvorené a spustené |
| Editory | VS Code, Cursor, Zed a IntelliJ IDEA cez príkazy v PATH |
| Vlastné príkazy | Samostatný uložený príkaz na spustenie pre každý repozitár |
| Príkazy projektu | Rozpoznanie skriptov package.json pre npm, pnpm, Yarn a Bun, príkazov Cargo a binárnych cieľov |
| Logy procesov | stdout a stderr, posledných 2000 záznamov pre každý projekt, vymazanie výstupu |
| Aktualizácie na pozadí | Sledovanie súborového systému s oneskorením aktualizácie 900 ms |
| Lokálne nastavenia | Pracovný priečinok, editor, príkazy a história otvorenia sa uchovávajú medzi spusteniami |

---

## Technológie

| Vrstva | Nástroj | Účel |
|---|---|---|
| Desktop | Tauri 2 | Natívne okno a komunikácia rozhrania s Rustom |
| Backend | Rust | Skenovanie, Git, nastavenia a správa procesov |
| Frontend | React 18 + TypeScript | Panel projektov a prehliadač logov |
| Zostavenie | Vite | Vývoj rozhrania a zostavenie statických zdrojov |
| Git | Systémový príkaz `git` | Čítanie stavu, vetiev a histórie, podpora worktree |
| Súborový systém | notify + walkdir | Sledovanie súborov a prechádzanie adresárov |
| Ikony | Lucide | Ikony rozhrania |

---

## Začíname

Potrebujete Node.js 20.19+ alebo 22.12+, npm, aktuálny stabilný Rust a Git v PATH, ako aj [systémové závislosti Tauri](https://v2.tauri.app/start/prerequisites/)

Na macOS podľa potreby nainštalujte Command Line Tools:

```bash
xcode-select --install
```

V priečinku projektu:

```bash
npm install
npm run desktop
```

Pri prvom spustení Cargo stiahne a zostaví závislosti Rustu

1. Kliknite na **Выбрать папку** (Vybrať priečinok) a zvoľte adresár s projektmi
2. Vyberte repozitár a zobrazte jeho vetvu, posledný commit a zmenené súbory
3. Vyberte rozpoznaný príkaz alebo zadajte vlastný, napríklad `npm run dev`, `cargo run` alebo `python3 app.py`
4. Kliknite na **Запустить проект** (Spustiť projekt) a otvorte kartu **Логи** (Logy)

Rozpoznávanie príkazov iba číta súbory projektu a nič nespúšťa. Výber príkazu vyplní vstupné pole; na jeho vykonanie kliknite na **Запустить проект**

Príkaz sa uloží pri spustení; môžete ho uložiť aj samostatne tlačidlom so začiarknutím alebo klávesom Enter

### Prezeranie zmien

Na karte **Изменения** (Zmeny) kliknite na súbor a otvorte diff

- **Рабочая папка** (Pracovný adresár) zobrazuje zmeny oproti indexu a obsah nesledovaných súborov
- **В индексе** (V indexe) zobrazuje zmeny pripravené na commit
- Premenované súbory si zachovávajú pôvodnú aj novú cestu
- Tlačidlo obnovenia načíta diff znova, Escape zatvorí okno

Otvorený diff sa pri zmene súborov aktualizuje spolu s repozitárom. Prezeranie nemení súbory ani index; náhľad je obmedzený na 256 KiB alebo 4000 riadkov

### Náhľad v prehliadači

```bash
npm run dev
```

Otvorte `http://127.0.0.1:1420` a prezrite si rozhranie s ukážkovými údajmi

Prístup k priečinkom, otváranie editorov a spúšťanie príkazov sú dostupné v desktopovej aplikácii

### Zostavenie

```bash
npm run build
npm run tauri -- build
```

Prvý príkaz zostaví rozhranie do `dist/`, druhý vytvorí spustiteľný súbor aplikácie v `src-tauri/target/release/`

Vytváranie inštalátorov je zatiaľ vypnuté cez `bundle.active` v konfigurácii Tauri

---

## Editor a príkazy na spustenie

Otvorte nastavenia tlačidlom na bočnom paneli alebo skratkou `⌘ ,` / `Ctrl ,`

| Editor | Príkaz v PATH |
|---|---|
| Visual Studio Code | `code` |
| Cursor | `cursor` |
| Zed | `zed` |
| IntelliJ IDEA | `idea` |

Vo VS Code na macOS otvorte paletu príkazov a spustite `Shell Command: Install 'code' command in PATH`

Príkazy projektu sa vykonávajú v adresári repozitára cez `/bin/sh -c` na macOS/Linux alebo `cmd /C` na Windows. Dostupné nástroje a premenné prostredia sa dedia z procesu RepoShelf

Naraz môžete spustiť viacero projektov, po jednom procese na repozitár. Pred zmenou pracovného priečinka zastavte spustené projekty

Tlačidlo zastavenia ukončí strom procesov na Windows a skupinu procesov na macOS/Linux. Pri ukončení aplikácie sa zastavia aj spravované procesy

---

## Architektúra

```text
React / TypeScript
    |
    | Tauri invoke
    v
Rust
    |-- walkdir -> repozitáre a worktree
    |-- git CLI -> stav, vetva, commit, upstream
    |-- notify -> zmeny súborov -> obnovenie panela
    |-- procesy -> stdout / stderr -> udalosti logov
    '-- settings.json -> pracovný priečinok, príkazy, editor, história
```

Skenovanie, otváranie editorov a spúšťanie príkazov prebiehajú mimo hlavného vlákna okna. Výstup procesov čítajú samostatné vlákna

Rozhranie používa vstavané API Tauri cez `withGlobalTauri`; JavaScript API sa dodáva spolu s časťou aplikácie napísanou v Ruste

Git sa volá s `--no-optional-locks`, aby čítanie stavu nevytváralo zbytočné zámky indexu

Nastavenia sa nachádzajú v systémovom konfiguračnom priečinku aplikácie `dev.reposhelf.desktop`, ktorého cestu určuje Tauri. Zápis používa dočasný súbor a následné premenovanie

---

## Štruktúra projektu

```text
RepoShelf/
├── src/
│   ├── App.tsx                       - stav panela a akcie používateľa
│   ├── components/
│   │   ├── RepositoryCard.tsx         - karta repozitára
│   │   ├── RepositoryDetails.tsx      - podrobnosti, príkaz a logy
│   │   └── FileDiffDialog.tsx         - prehliadač zmien súboru
│   ├── diff.ts                       - spracovanie riadkov unified diffu
│   ├── desktop.ts                    - prístup k vstavanému API Tauri s typovou kontrolou
│   ├── demo.ts                       - údaje náhľadu v prehliadači
│   ├── format.ts                     - relatívny čas
│   ├── types.ts                      - dátové typy
│   └── styles.css                    - motív a responzívne rozloženie
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                    - príkazy Tauri, nastavenia a sledovanie súborov
│   │   ├── commands.rs               - rozpoznávanie príkazov zo súborov projektu
│   │   ├── diff.rs                   - načítanie diffu a náhľady nových súborov
│   │   ├── git.rs                    - skenovanie repozitárov a čítanie Gitu
│   │   └── runner.rs                 - procesy, zastavenie a priebežné logy
│   ├── capabilities/default.json     - oprávnenia okna
│   └── tauri.conf.json               - konfigurácia desktopovej aplikácie
├── tests/ui.test.mjs                  - testy rozhrania
└── vite.config.ts
```

---

## Kontroly

```bash
npm run check
npm run test:ui
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

Testy rozhrania spúšťajú zostavenú aplikáciu v jsdom a overujú vyhľadávanie, filtrovanie, výber projektu, nastavenia, klávesové skratky, výber príkazov, obnovenie spustených procesov po opätovnom načítaní rozhrania, prepínanie zdrojov diffu, čísla riadkov, spracovanie chýb a obmedzenia režimu prehliadača

Rust testy vytvárajú dočasné Git repozitáre a overujú prázdnu históriu, nesledované a zmenené súbory, commity, premenovania s medzerami, worktree, vynechanie adresárov závislostí, rozpoznávanie príkazov, stdout/stderr, návratové kódy, ukončovanie dcérskych procesov a diffy nových, premenovaných, odstránených a binárnych súborov

---

## Obmedzenia MVP

- Jeden pracovný priečinok naraz; príkazy a história sa pri jeho zmene zachovajú
- Prehľadávanie je obmedzené na 5 úrovní a nenasleduje symbolické odkazy
- Vnorené repozitáre a submoduly v inom repozitári sa nezobrazujú samostatne
- Adresáre `.git`, `node_modules`, `target`, `.venv`, `dist` a `vendor` sú z prehľadávania vynechané
- Nie sú dostupné operácie commit, push, pull ani prepínanie vetiev
- Diff je obmedzený na 256 KiB alebo 4000 riadkov; pri binárnych súboroch sa zobrazuje správa bez textového obsahu
- Diff zobrazuje text v UTF-8; neplatné sekvencie bajtov sa nahrádzajú náhradným znakom
- Inštalátory, podpisovanie aplikácie a automatické aktualizácie nie sú nastavené
- Prehliadač logov zobrazuje text bez emulácie TTY; interaktívne príkazy nie sú podporované
- Logy sa uchovávajú v pamäti a riadiace sekvencie terminálu sa neinterpretujú
- Počty ahead/behind sa počítajú podľa lokálnej upstream referencie bez automatického fetch
- Príkazy, ktoré vytvoria samostatnú reláciu a odpoja sa od rodičovského procesu, môžu zostať spustené aj po zastavení projektu
- Rozhranie aplikácie je zatiaľ v ruštine; preklady README nemenia jazyk rozhrania

---

## Ďalšie plány

- [ ] Viacero pracovných priečinkov
- [x] Automatické rozpoznávanie dostupných príkazov z `package.json` a `Cargo.toml`
- [x] Podrobný diff zmenených súborov
- [ ] Odkazy na lokálne servery spustených projektov
- [ ] Ukladanie logov na disk
- [ ] Zostavenia a inštalátory pre macOS, Windows a Linux
