# Pubblicazione con GitHub Pages

Il pacchetto include già il flusso automatico `.github/workflows/pages.yml`.

1. Accedi a GitHub e crea un repository **pubblico** chiamato `taxi-ledger`.
2. Carica nella radice del repository tutto il contenuto della cartella `TaxiLedgerWeb` (non la cartella contenitore).
3. Apri **Settings → Pages**.
4. In **Build and deployment → Source**, scegli **GitHub Actions**.
5. Apri la scheda **Actions**: il processo “Pubblica Taxi Ledger su GitHub Pages” partirà automaticamente.
6. Al termine, il sito sarà normalmente disponibile all’indirizzo `https://NOME-UTENTE.github.io/taxi-ledger/`.

Il sito usa HTTPS e può essere aggiunto alla schermata Home dell’iPhone da Safari. GitHub Pages espone un nome web, non un indirizzo IP fisso: è la modalità corretta perché una PWA richiede HTTPS e gli IP di GitHub possono cambiare.
