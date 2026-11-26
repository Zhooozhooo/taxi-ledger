# Taxi Ledger Web

Sito/PWA responsive per gestire incassi, spese, storico e consuntivi di un taxi. Funziona su iPhone X con Safari e sui browser desktop moderni.

## Avvio immediato e accesso da iPhone tramite IP

1. Decomprimi la cartella su un computer con Python 3.
2. Su Mac fai doppio clic su `Avvia-Taxi-Ledger.command`; su Windows usa `Avvia-Taxi-Ledger-Windows.bat`.
3. Il terminale mostrerà sia `http://localhost:8080` sia l’indirizzo IP da aprire sull’iPhone, ad esempio `http://192.168.1.20:8080`.
4. Computer e iPhone devono essere collegati alla stessa rete Wi-Fi; lascia aperta la finestra del server durante il test.

In alternativa esegui manualmente:

```bash
python3 start-server.py
```

Puoi anche aprire direttamente `TaxiLedger-Standalone.html` senza server; funzionano inserimento, storico, calcoli ed esportazioni, ma non l’installazione PWA/offline tramite service worker.

## Installazione su iPhone

1. Apri l’indirizzo del sito con Safari.
2. Tocca **Condividi**.
3. Seleziona **Aggiungi alla schermata Home**.
4. Avvia Taxi Ledger dall’icona: si comporterà come un’app a schermo intero.

## Funzioni

- Incassi in contanti e carta, con totali per giorno, mese e anno.
- Storico con ricerca, filtro, modifica ed eliminazione.
- Spese sostenute e pianificate per benzina, canone 3570, tagliando, gomme, assicurazione, manutenzione, POS, lavaggio e altro.
- Consuntivo annuale, modalità forfettaria o IRPEF, accantonamento e fondo prudenziale configurabili.
- Esportazione PDF e CSV.
- Backup e ripristino JSON.
- Utilizzo offline dopo il primo caricamento grazie al service worker.
- Nessun account e nessun invio dei dati a server esterni.

## Pubblicazione

Il progetto è predisposto per GitHub Pages con il flusso automatico `.github/workflows/pages.yml`; consulta `GITHUB-PAGES.md`. È anche un sito statico copiabile su Netlify, Cloudflare Pages o server Apache/Nginx. Per l’installazione PWA e il service worker è richiesto HTTPS, salvo `localhost`.

## Dati e privacy

I dati sono memorizzati nel `localStorage` del browser e quindi sono specifici del dispositivo, del browser e dell’indirizzo del sito. Cancellare i dati di Safari/browser o cambiare dominio può renderli non accessibili. Esporta regolarmente un backup JSON.

## Nota fiscale

I valori iniziali del regime forfettario sono 5% per i primi cinque anni e 15% successivamente; aliquote, coefficiente di redditività, contributi e fondo prudenziale sono modificabili. La modalità ordinaria usa gli scaglioni IRPEF nazionali 2026 23%, 33% e 43%. Le stime non sostituiscono il commercialista.

Sito Taxi Ledger pubblicato con GitHub Pages 
