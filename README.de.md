<div align="center">

<img src="src-tauri/icons/icon.png" alt="RepoShelf" width="80" />

# RepoShelf

**Ein Dashboard für lokale Repositories: Git-Status, letzte Commits und Projektbefehle mit Logs in einem Fenster**

![Tauri](https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-2021-DEA584?style=flat-square&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)

[English](README.md) · [Українська](README.uk.md) · [Русский](README.ru.md) · [Slovenčina](README.sk.md) · [Deutsch](README.de.md)

</div>

---

## Überblick

RepoShelf durchsucht einen ausgewählten Ordner und zeigt deine lokalen Git-Repositories in einem Dashboard

Du siehst sofort, welche Projekte nicht committete Änderungen haben, welcher Branch ausgecheckt ist und was der letzte Commit war. Für jedes Projekt kannst du einen Startbefehl speichern, deinen Editor öffnen und die Prozessausgabe ansehen

Die App läuft lokal, benötigt kein Konto und sendet keine Repository-Inhalte an einen Server

---

## Funktionen

| Funktion | Details |
|---|---|
| Projektliste | Repositories im ausgewählten Ordner und in Unterordnern bis zu 5 Ebenen tief finden |
| Git-Status | Aktueller Branch, geänderte und unversionierte Dateien, Commits vor und hinter dem Upstream-Branch |
| Diff-Ansicht | Hervorgehobene hinzugefügte und entfernte Zeilen, Zeilennummern, getrennte Ansichten für Index und Arbeitsverzeichnis |
| Letzter Commit | Nachricht, Autor, kurzer Hash und Zeitpunkt |
| Schnellsuche | Nach Name, Pfad oder Branch mit `⌘ K` / `Ctrl K` suchen |
| Filter | Alle Projekte, mit Änderungen, zuletzt geöffnet und laufend |
| Editoren | VS Code, Cursor, Zed und IntelliJ IDEA über Befehle im PATH |
| Eigene Befehle | Ein gespeicherter Startbefehl pro Repository |
| Projektbefehle | Skripte aus package.json für npm, pnpm, Yarn und Bun sowie Cargo-Befehle und ausführbare Ziele erkennen |
| Prozesslogs | stdout und stderr, die letzten 2000 Einträge pro Projekt, Ausgabe leeren |
| Hintergrundaktualisierung | Überwachung des Dateisystems mit 900 ms Verzögerung zur Bündelung von Änderungen |
| Lokale Einstellungen | Arbeitsordner, Editor, Befehle und Öffnungsverlauf bleiben zwischen Sitzungen erhalten |

---

## Technologien

| Ebene | Werkzeug | Zweck |
|---|---|---|
| Desktop | Tauri 2 | Natives Fenster und Kommunikation zwischen Oberfläche und Rust |
| Backend | Rust | Scannen, Git, Einstellungen und Prozessverwaltung |
| Frontend | React 18 + TypeScript | Projektübersicht und Logansicht |
| Build | Vite | Entwicklung der Oberfläche und Erstellen statischer Ressourcen |
| Git | Systembefehl `git` | Status, Branches und Verlauf lesen, Worktrees unterstützen |
| Dateisystem | notify + walkdir | Dateien überwachen und Verzeichnisse durchsuchen |
| Icons | Lucide | Symbole der Benutzeroberfläche |

---

## Erste Schritte

Du brauchst Node.js 20.19+ oder 22.12+, npm, eine aktuelle stabile Rust-Toolchain, Git im PATH und die [Systemvoraussetzungen von Tauri](https://v2.tauri.app/start/prerequisites/)

Installiere unter macOS bei Bedarf die Command Line Tools:

```bash
xcode-select --install
```

Im Projektordner:

```bash
npm install
npm run desktop
```

Beim ersten Start lädt Cargo die Rust-Abhängigkeiten herunter und kompiliert sie

1. Klicke auf **Выбрать папку** (Ordner auswählen) und wähle das Verzeichnis mit deinen Projekten
2. Wähle ein Repository aus, um Branch, letzten Commit und geänderte Dateien zu sehen
3. Wähle einen erkannten Projektbefehl oder gib einen eigenen ein, etwa `npm run dev`, `cargo run` oder `python3 app.py`
4. Klicke auf **Запустить проект** (Projekt starten) und öffne **Логи** (Logs)

Die Befehlserkennung liest nur Projektdateien und führt nichts aus. Die Auswahl eines Befehls füllt das Eingabefeld; zum Ausführen klickst du auf **Запустить проект**

Befehle werden beim Start gespeichert; alternativ kannst du die Schaltfläche mit dem Häkchen oder Enter verwenden

### Änderungen ansehen

Klicke unter **Изменения** (Änderungen) auf eine Datei, um den Diff zu öffnen

- **Рабочая папка** (Arbeitsverzeichnis) zeigt Änderungen gegenüber dem Index und den Inhalt unversionierter Dateien
- **В индексе** (Im Index) zeigt die für den nächsten Commit vorgemerkten Änderungen
- Bei umbenannten Dateien bleiben der ursprüngliche und der neue Pfad sichtbar
- Die Schaltfläche zum Aktualisieren lädt den Diff neu, Escape schließt das Fenster

Ein geöffneter Diff wird bei Dateiänderungen zusammen mit dem Repository aktualisiert. Die Ansicht verändert weder Dateien noch Index; die Vorschau ist auf 256 KiB oder 4000 Zeilen begrenzt

### Vorschau im Browser

```bash
npm run dev
```

Öffne `http://127.0.0.1:1420`, um die Oberfläche mit Beispieldaten anzusehen

Ordnerzugriff, das Öffnen von Editoren und das Ausführen von Befehlen stehen in der Desktop-App zur Verfügung

### Build erstellen

```bash
npm run build
npm run tauri -- build
```

Der erste Befehl erstellt das Frontend in `dist/`, der zweite die ausführbare Desktop-Datei in `src-tauri/target/release/`

Das Erstellen von Installationspaketen ist derzeit über `bundle.active` in der Tauri-Konfiguration deaktiviert

---

## Editor und Startbefehle

Öffne die Einstellungen über die Seitenleiste oder mit `⌘ ,` / `Ctrl ,`

| Editor | Befehl im PATH |
|---|---|
| Visual Studio Code | `code` |
| Cursor | `cursor` |
| Zed | `zed` |
| IntelliJ IDEA | `idea` |

Öffne für VS Code unter macOS die Befehlspalette und führe `Shell Command: Install 'code' command in PATH` aus

Projektbefehle werden im Repository-Verzeichnis mit `/bin/sh -c` unter macOS/Linux oder `cmd /C` unter Windows ausgeführt. Verfügbare Werkzeuge und Umgebungsvariablen werden vom RepoShelf-Prozess geerbt

Du kannst mehrere Projekte gleichzeitig ausführen, mit einem Prozess pro Repository. Beende laufende Projekte, bevor du den Arbeitsordner wechselst

Die Stoppschaltfläche beendet unter Windows den Prozessbaum und unter macOS/Linux die Prozessgruppe. Beim Beenden der App werden auch die verwalteten Prozesse beendet

---

## Architektur

```text
React / TypeScript
    |
    | Tauri invoke
    v
Rust
    |-- walkdir -> Repositories und Worktrees
    |-- git CLI -> Status, Branch, Commit, Upstream
    |-- notify -> Dateiänderungen -> Dashboard aktualisieren
    |-- Prozesse -> stdout / stderr -> Logereignisse
    '-- settings.json -> Arbeitsordner, Befehle, Editor, Verlauf
```

Scannen, das Öffnen von Editoren und das Starten von Befehlen erfolgen außerhalb des Hauptthreads des Fensters. Separate Threads lesen die Prozessausgabe

Das Frontend verwendet die integrierte Tauri-API über `withGlobalTauri`; die JavaScript-API wird mit dem Rust-Teil der App ausgeliefert

Git wird mit `--no-optional-locks` aufgerufen, damit das Lesen des Status keine unnötigen Indexsperren erzeugt

Die Einstellungen liegen im Systemkonfigurationsordner der Anwendung `dev.reposhelf.desktop`, dessen Pfad Tauri ermittelt. Beim Schreiben wird zunächst eine temporäre Datei angelegt und anschließend umbenannt

---

## Projektstruktur

```text
RepoShelf/
├── src/
│   ├── App.tsx                       - Zustand des Dashboards und Benutzeraktionen
│   ├── components/
│   │   ├── RepositoryCard.tsx         - Repository-Karte
│   │   ├── RepositoryDetails.tsx      - Details, Startbefehl und Logs
│   │   └── FileDiffDialog.tsx         - Diff-Ansicht für Dateien
│   ├── diff.ts                       - Parser für Unified-Diff-Zeilen
│   ├── desktop.ts                    - Zugriff auf die integrierte Tauri-API mit Typprüfung
│   ├── demo.ts                       - Beispieldaten für die Browservorschau
│   ├── format.ts                     - relative Zeitangaben
│   ├── types.ts                      - Datentypen
│   └── styles.css                    - Design und responsives Layout
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                    - Tauri-Befehle, Einstellungen und Dateiüberwachung
│   │   ├── commands.rs               - Befehlserkennung aus Projektdateien
│   │   ├── diff.rs                   - Diffs laden und neue Dateien anzeigen
│   │   ├── git.rs                    - Repositories durchsuchen und Git abfragen
│   │   └── runner.rs                 - Prozesse, Beenden und laufende Logausgabe
│   ├── capabilities/default.json     - Fensterberechtigungen
│   └── tauri.conf.json               - Konfiguration der Desktop-App
├── tests/ui.test.mjs                  - Oberflächentests
└── vite.config.ts
```

---

## Prüfungen

```bash
npm run check
npm run test:ui
npm run test:rust
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

Die Oberflächentests führen die gebaute App in jsdom aus und prüfen Suche, Filter, Projektauswahl, Einstellungen, Tastenkürzel, Befehlsauswahl, Wiederherstellung laufender Prozesse nach dem Neuladen der Oberfläche, Wechsel der Diff-Quelle, Zeilennummern, Fehlerbehandlung und Einschränkungen des Browsermodus

Die Rust-Tests erstellen temporäre Git-Repositories und prüfen einen leeren Verlauf, unversionierte und geänderte Dateien, Commits, Umbenennungen mit Leerzeichen, Worktrees, ausgeschlossene Abhängigkeitsordner, Befehlserkennung, stdout/stderr, Rückgabecodes, das Beenden von Kindprozessen sowie Diffs für neue, umbenannte, gelöschte und binäre Dateien

---

## Einschränkungen des MVP

- Ein Arbeitsordner zur selben Zeit; Befehle und Verlauf bleiben beim Wechsel erhalten
- Die Suche ist auf 5 Ebenen begrenzt und folgt keinen symbolischen Links
- Verschachtelte Repositories und Submodule innerhalb eines anderen Repositorys werden nicht separat aufgeführt
- Die Ordner `.git`, `node_modules`, `target`, `.venv`, `dist` und `vendor` werden beim Scannen ausgeschlossen
- Keine Funktionen für Commit, Push, Pull oder Branch-Wechsel
- Diffs sind auf 256 KiB oder 4000 Zeilen begrenzt; bei binären Dateien erscheint ein Hinweis ohne Textinhalt
- Diffs zeigen Text in UTF-8; ungültige Bytefolgen werden durch das Ersatzzeichen ersetzt
- Installationspakete, Codesignierung und automatische Updates sind nicht eingerichtet
- Die Logansicht zeigt Text ohne TTY-Emulation; interaktive Befehle werden nicht unterstützt
- Logs werden im Arbeitsspeicher gehalten, Terminal-Steuersequenzen werden nicht interpretiert
- Ahead/behind-Werte basieren auf der lokalen Upstream-Referenz ohne automatischen Fetch
- Befehle, die eine eigene Sitzung erstellen und sich vom Elternprozess lösen, können nach dem Stoppen des Projekts weiterlaufen
- Die Benutzeroberfläche ist derzeit auf Russisch; README-Übersetzungen ändern die Sprache der App nicht

---

## Weitere Pläne

- [ ] Mehrere Arbeitsordner
- [x] Verfügbare Befehle aus `package.json` und `Cargo.toml` automatisch erkennen
- [x] Detaillierte Diffs für geänderte Dateien
- [ ] Links zu lokalen Servern laufender Projekte
- [ ] Logs auf der Festplatte speichern
- [ ] Builds und Installationspakete für macOS, Windows und Linux
