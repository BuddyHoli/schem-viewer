```markdown
# Schem Viewer (Web → Android APK via Capacitor)

Kurz: Vite + Three.js App zum Laden von Minecraft .schem / voxel .obj Dateien, Anzeige in 3D und Layer-by-layer Export.

Wichtig:
- Diese Version enthält einen Buffer‑Polyfill, damit prismarine-nbt im Browser / Android WebView läuft.
- Parser ist "best-effort" für gängige Schematic-Formate (klassisch & Palette-basiert).

Schnellstart (lokal)
1. Node & npm installieren.
2. Projektabhängigkeiten:
   npm install
3. Dev-Server:
   npm run dev
   -> Öffne http://localhost:5173

Build (Web)
- npm run build
- Dist-Ausgabe: dist/

Capacitor → Android (Debug)
1. Capacitor initialisieren (wenn noch nicht):
   npx cap init "SchemViewer" com.example.schemviewer
2. Android hinzufügen:
   npx cap add android
3. Web-Assets kopieren:
   npm run build
   npx cap copy android
4. Android Studio öffnen:
   npx cap open android
   -> Build & Run (Debug auf Gerät/Emulator)

APK via GitHub Actions
- Es gibt eine Beispiel-Workflow-Datei unter .github/workflows/android-build.yml, die ein Release-APK als Artefakt hochlädt.
- Für signierte Release-APK: Erzeuge einen Keystore (.jks), base64-encode ihn und hinterlege als GitHub Secret ANDROID_KEYSTORE_BASE64 sowie ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD. Ich kann das Workflow-Signing bei Bedarf ergänzen.

Fehlerbehebung
- Wenn Console: "ReferenceError: Buffer is not defined" → stelle sicher, dass src/polyfills.js importiert wird (wird bereits in src/main.js importiert).
- Wenn .schem nicht geparst wird, poste bitte die DevTools-Console-Logs (oder Beispiel-Datei), dann verbessere ich den Parser gezielt.

Wenn du willst
- Ich kann das GitHub Actions-Workflow erweitern, um signierte APKs zu erzeugen (brauchst dafür Secrets).
- Ich kann Beispiel-PR/Commits für dein Repo erstellen, wenn du mir Repo‑Zugriff erlaubst (oder ich kann dir die exakten git-Befehle geben).
```