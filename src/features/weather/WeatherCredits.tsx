export function WeatherCredits() {
  return <div className="text-xs leading-relaxed text-white/50 space-y-2">
    <p>Mappa interattiva fornita da <a href="https://www.windy.com/" target="_blank" rel="noreferrer" className="underline">Windy.com</a>, con propri modelli, legenda e timeline. Il bollettino MareSalvo sottostante è indipendente.</p>
    <p>Previsioni da <a href="https://open-meteo.com/" className="underline" target="_blank" rel="noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" className="underline" target="_blank" rel="noreferrer">CC BY 4.0</a>. Onde Météo-France MFWAM; correnti e temperatura marina Copernicus via Météo-France; atmosfera ECMWF IFS. Dati selezionati e riformattati da MareSalvo.</p>
    <p>Generated using E.U. Copernicus Marine Service Information · <a href="https://doi.org/10.48670/moi-00017" className="underline" target="_blank" rel="noreferrer">Onde</a> · <a href="https://doi.org/10.48670/moi-00016" className="underline" target="_blank" rel="noreferrer">Oceano</a>.</p>
    <p>Stime da modelli, non misure sul posto. Vicino alla costa le correnti possono essere poco rappresentative; questi dati non sostituiscono bollettini ufficiali, avvisi e valutazioni per la navigazione o l’immersione.</p>
  </div>;
}
