# Taxi Ledger 2.2

PWA statica per gestire incassi, spese, ferie, proiezioni e accantonamenti fiscali di un'attività taxi.

## Novità della versione 2

- accesso e registrazione multi-profilo sul dispositivo;
- impostazioni separate per ciascun profilo;
- sezione Ferie, usata per escludere le assenze dalle proiezioni;
- dashboard Giorno, Mese e Anno con selettori storici;
- quote percentuali carta/contanti e margine;
- proiezioni nette di weekend e ferie;
- modifica dalla prima colonna di Incassi e Spese;
- Consuntivo con ricavi carta/contanti separati, base imponibile configurabile, INPS e imposta sostitutiva;
- backup/ripristino JSON, stampa PDF, modalità offline e installazione PWA.

## Aggiornamenti 2.1

- proiezioni presentate come **totali di fine periodo**, con evidenza di incassato attuale e quota prevista residua;
- azioni rapide `− Spesa` e `＋ Incasso` riunite nell'header;
- rimossi i pulsanti duplicati dalle pagine Incassi e Spese;
- interfaccia resa più compatta e vicina all'impostazione visiva della prima versione.

## Correzione proiezione 2.2

La **Proiezione totale incassi** usa esclusivamente i giorni distinti nei quali è stato registrato almeno un incasso:

`incassi già effettuati ÷ giorni di incasso = incasso medio giornaliero`

`incasso medio giornaliero × giorni lavorativi restanti + incassi già effettuati = proiezione totale incassi`

I giorni lavorativi restanti escludono fine settimana e periodi di ferie registrati.

## Pubblicazione su GitHub Pages

Caricare **tutti i file di questa cartella nella root** del branch `main`. In **Settings → Pages** selezionare `Deploy from a branch`, branch `main`, cartella `/(root)`.

## Uso su iPhone

Aprire l'indirizzo Pages in Safari, quindi **Condividi → Aggiungi alla schermata Home**.

## Nota sul multiutente

Questa versione è un'app statica: account, password e dati sono conservati localmente nel browser e separati per profilo. Non vengono sincronizzati fra dispositivi. Per autenticazione cloud e sincronizzazione condivisa è necessario collegare un backend (es. Supabase/Firebase).

## Avvertenza fiscale

I calcoli del Consuntivo sono stime gestionali basate su aliquote personalizzabili. Verificare regime, contributi e imposte con il proprio consulente fiscale.
