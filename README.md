# 🛒 Spesa - Lista della Spesa & Offerte Volantini

Applicazione web moderna, leggera e autonoma per gestire la lista della spesa e consultare le migliori offerte dei supermercati vicino a te, confrontate per prezzo.

## ✨ Funzionalità

- **Lista della spesa intuitiva**: Gestione alimenti per reparto (ortofrutta, latticini, carne, surgelati, ecc.), quantità, note, modalità spesa e spunta con barra di completamento.
- **Offerte Supermercati Georeferenziate**:
  - Selezione del raggio rapido: **500 m**, **1 km**, **2 km**, **3 km**, **5 km**.
  - Rilevamento in tempo reale dei punti vendita della zona tramite OpenStreetMap (Nominatim).
  - Volantini delle principali insegne (Conad, Penny, Lidl, Coop, Carrefour, Eurospin, MD, Todis, ecc.).
  - **Offerte ordinate rigorosamente per prezzo crescente** (le più economiche e convenienti per prime).
  - Tasto **+ Lista** su ogni offerta per aggiungere direttamente il prodotto scontato alla lista della spesa con note sul prezzo.
  - Ricerca istantanea di prodotti tra tutte le offerte dei supermercati trovati.
- **Zero dipendenze runtime**: Realizzata in Vanilla HTML5, CSS moderno e JavaScript puro.

---

## ⚙️ Aggiornamento Automatico Offerte (GitHub Actions)

La repository include una GitHub Action configurata in `.github/workflows/update-offers.yml`:

- **Schedulazione settimanale**: Si avvia in automatico **ogni giovedì mattina alle 04:00 UTC (06:00 italiane)**, quando escono i nuovi volantini promozionali.
- **Avvio manuale**: Puoi avviare l'aggiornamento quando vuoi dalla scheda **Actions** di GitHub cliccando su **Run workflow**.
- Lo script (`tools/update-offers.mjs`) estrae i volantini attivi, classifica i prodotti per categoria, ordina le offerte e aggiorna automaticamente il file `app.js`.

---

## 📱 Come pubblicarla online con GitHub Pages

1. Vai nella scheda **Settings** della repository su GitHub.
2. Nel menu a sinistra seleziona **Pages**.
3. Sotto **Build and deployment** > **Branch**, seleziona:
   - Branch: `main`
   - Cartella: `/ (root)`
4. Clicca su **Save**.
5. Dopo circa 1 minuto, la tua app sarà accessibile da qualsiasi browser o smartphone all'indirizzo:
   `https://<tuo-username>.github.io/<nome-repo>/`
