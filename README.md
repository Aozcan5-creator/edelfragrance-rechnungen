# Edelfragrance Rechnungs-System

Eine vollständige Rechnungs-Datenbank mit Web-Oberfläche und Excel-Export.
Datenbank in der Cloud (Supabase) — von überall erreichbar.

---

## Was ist drin?

- **Web-App** (HTML/CSS/JS) — auf GitHub Pages hostbar
- **Datenbank** in Supabase (PostgreSQL, kostenlos bis ~500 MB / 50.000 Nutzer/Monat)
- **PDF-Export** über Browser-Druck (Strg+P → "Als PDF speichern")
- **Excel-Backup** auf Knopfdruck (kompletter Export aller Daten)
- **Kleinunternehmer §19 UStG** — Hinweis automatisch auf jeder Rechnung

---

## Erste Einrichtung (einmalig, ~10 Minuten)

### 1. Supabase-Projekt anlegen

1. Auf https://supabase.com gehen → "Start your project" → Account anlegen (GitHub-Login geht)
2. "New Project" anklicken
3. Name: `edelfragrance` · Database Password: starkes Passwort wählen und **gut merken**
4. Region: `Frankfurt (eu-central-1)` (für DSGVO-Konformität)
5. "Create new project" → kurz warten (~2 Min)

### 2. Datenbank-Schema erstellen

1. Im Supabase-Dashboard links auf **SQL Editor** klicken
2. "New query" → den Inhalt von `schema.sql` reinkopieren
3. **Run** drücken → "Success. No rows returned" sollte erscheinen

### 3. Email-Bestätigung deaktivieren (einfacher Login)

1. Links auf **Authentication** → **Providers** → **Email**
2. "Confirm email" auf **OFF** stellen → "Save"

### 4. API-Zugangsdaten kopieren

1. Links auf **Settings** (⚙️) → **API**
2. Kopiere dir folgende Werte (du brauchst sie gleich):
   - **Project URL** (z.B. `https://xyz.supabase.co`)
   - **anon public key** (langer String unter "Project API keys")

### 5. Web-App auf GitHub Pages hosten

```bash
# Falls nicht vorhanden, Repo erstellen:
git init edelfragrance-rechnungen
cd edelfragrance-rechnungen
# Alle Dateien aus diesem Ordner reinkopieren
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:DEIN-USER/edelfragrance-rechnungen.git
git push -u origin main
```

In GitHub: **Settings → Pages → Source: main / root → Save**.
Nach ~1 Min ist die App unter `https://DEIN-USER.github.io/edelfragrance-rechnungen/` erreichbar.

### 6. App zum ersten Mal öffnen

1. Web-App öffnen
2. **Setup-Bildschirm**: Project URL + anon key einfügen → Speichern
3. **Konto erstellen**: E-Mail + Passwort → Registrieren
4. Direkt eingeloggt → in **Einstellungen** Firmenstammdaten eintragen
5. Erste Rechnung schreiben 🎉

---

## Ablauf im Alltag

### Rechnung schreiben (30 Sekunden)
1. **Neue Rechnung** klicken
2. Kunden auswählen (oder neu anlegen)
3. Position(en) eintragen — mit Autocomplete aus dem Produktkatalog
4. **Speichern**
5. **PDF**-Button → Strg+P → "Als PDF speichern" → Mailen

### Datenbank exportieren (Backup)
**Einstellungen → Excel-Export** → komplette Datenbank als .xlsx mit allen Sheets
(Kunden, Produkte, Rechnungen, Positionen). Empfehlung: monatlich machen.

### Auf einem zweiten Gerät (Handy/Tablet)
1. Web-App-URL öffnen
2. Project URL + anon key einmalig eingeben
3. Mit demselben Account einloggen
4. Alle Daten sind sofort da (Cloud-sync)

---

## Datei-Struktur

```
edelfragrance-rechnungen/
├── index.html          # App-Shell + Views
├── styles.css          # Edelfragrance-Branding + Print-Layout
├── db.js               # Supabase-Client + alle CRUD-Funktionen
├── invoice.js          # Rechnungs-Rendering, PDF, Excel-Export
├── app.js              # Routing, State, Event-Handling
├── schema.sql          # Datenbank-Schema (einmalig in Supabase ausführen)
└── README.md           # Diese Datei
```

---

## Pflichtangaben einer Rechnung (§14 UStG)

Die App füllt automatisch aus:
- ✓ Vollständiger Name & Anschrift (Aussteller + Empfänger)
- ✓ Steuernummer (aus Einstellungen)
- ✓ Fortlaufende Rechnungsnummer (auto-increment, in Einstellungen änderbar)
- ✓ Rechnungsdatum
- ✓ Menge + Bezeichnung der Leistung
- ✓ Entgelt (für §19-Kleinunternehmer ohne MwSt-Aufschlüsselung)
- ✓ Hinweis: *„Gemäß § 19 UStG wird keine Umsatzsteuer berechnet."*

---

## Troubleshooting

**„Connection failed"** → URL & anon key prüfen (nicht service_role key!)

**Daten weg nach Browser-Wechsel** → Login erneut, Daten liegen in Supabase

**Login funktioniert nicht** → Email-Bestätigung in Supabase-Auth deaktiviert?

**Rechnungs-PDF sieht komisch aus** → Druck-Vorschau: A4, Ränder „Standard", Skalierung 100%
