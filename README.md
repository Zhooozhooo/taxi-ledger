# Taxi Ledger 2.7

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

## Turni e seconda guida 2.3

- nuova sezione **Turni** basata sulla D.D. Roma Capitale QG/2926/2025;
- calcolo del gruppo 01-20 e del turno settimanale T1-T7 dal numero di licenza;
- proposta automatica `Turno mattina` / `Turno pomeriggio` nelle note dei nuovi incassi, sempre modificabile;
- bypass della turnazione ufficiale per chi lavora solo di mattina o solo di pomeriggio;
- aggiunta automatica dei periodi obbligatori di riduzione organico di agosto 2026 e dicembre 2026/gennaio 2027;
- totale dei giorni di ferie pianificati, con separazione dei riposi imposti;
- seconda guida con compenso mensile contrattualizzato incluso nel reddito e nel Consuntivo;
- menu laterale accessibile anche da iPhone tramite il pulsante in alto a sinistra.

La turnazione ufficiale incorporata copre il periodo **10 gennaio 2026 - 15 gennaio 2027**. Le eventuali modifiche amministrative successive devono essere recepite con un aggiornamento dell'app.

## Assegnazioni mensili seconda guida 2.4

- selezione dell'anno nelle Impostazioni della seconda guida;
- marcatura indipendente dei dodici mesi effettivamente assegnati;
- riepilogo immediato del numero di mesi e del reddito contrattualizzato previsto;
- Consuntivo mensile: il compenso entra nei totali e nella base fiscale/contributiva solo se il mese selezionato è assegnato;
- Consuntivo annuale: il compenso è moltiplicato esclusivamente per il numero di mesi assegnati nell'anno.
- campo **Turno** degli incassi trasformato in una lista modificabile dei turni disponibili, con proposta automatica dalla turnazione;
- campo **Note** separato per i dettagli liberi dell'incasso;
- calendario grafico mensile nella sezione Turni, navigabile mese per mese, con turni previsti, ferie personali e riposi imposti.

Le configurazioni sono archiviate separatamente per anno e incluse nei backup JSON.

## Calendario Ferie e dashboard 2.5

- calendario grafico mensile anche nella sezione **Ferie**, con navigazione tra i mesi;
- visualizzazione distinta di ferie personali e riposi imposti;
- selezione di un giorno vuoto per aggiungere un nuovo periodo e di una ferie personale per modificarla;
- nuovo indicatore **Introito seconda guida** nel Cruscotto mensile e annuale;
- l'indicatore usa esclusivamente i mesi effettivamente marcati come assegnati per l'anno consultato.
- esportazione PDF **sintetica mensile** con totali, accantonamento e calcolo fiscale;
- esportazione PDF **dettagliata mensile** con il riepilogo e l'elenco di incassi e spese del mese.

## Filtri giornalieri e composizione incassi 2.6

- le sezioni **Incassi** e **Spese** mostrano un solo giorno alla volta;
- il selettore è impostato automaticamente sulla data odierna a ogni accesso;
- ricerca testuale applicata esclusivamente ai movimenti del giorno scelto;
- la Composizione incassi del Cruscotto mantiene lo split carta/contanti e aggiunge lo split per tipologia di turno;
- per ogni turno sono mostrati importo, percentuale sul totale e barra comparativa.

## Piattaforme e analisi completa 2.7

- nuove tipologie di incasso **Uber** (fee 7%), **FreeNow** (fee 10%) e **ITTaxi** (senza fee);
- le tre piattaforme sono trattate come la carta nella base imponibile, mentre le fee sono detratte dal margine e dal disponibile;
- seconda guida con quota imponibile e quota mensile in contanti sempre esclusa dall'imponibile;
- Composizione del Cruscotto con split completo per tipologia di incasso e categoria di spesa;
- filtro `Tutti / Solo incassi / Solo spese` negli Ultimi movimenti;
- mantenuti i selettori giornalieri, con default sulla data odierna, nelle sezioni Incassi e Spese.

## Pubblicazione su GitHub Pages

Caricare **tutti i file di questa cartella nella root** del branch `main`. In **Settings → Pages** selezionare `Deploy from a branch`, branch `main`, cartella `/(root)`.

## Uso su iPhone

Aprire l'indirizzo Pages in Safari, quindi **Condividi → Aggiungi alla schermata Home**.

## Nota sul multiutente

Questa versione è un'app statica: account, password e dati sono conservati localmente nel browser e separati per profilo. Non vengono sincronizzati fra dispositivi. Per autenticazione cloud e sincronizzazione condivisa è necessario collegare un backend (es. Supabase/Firebase).

## Avvertenza fiscale

I calcoli del Consuntivo sono stime gestionali basate su aliquote personalizzabili. Verificare regime, contributi e imposte con il proprio consulente fiscale.
