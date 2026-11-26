/** Plain footer outside the canvas: no expanding attribution control over the map. */
export function MapCredits({ imagery = false }: { imagery?: boolean }) {
  return <p className="map-credits">
    <a href="https://www.esri.com/" target="_blank" rel="noreferrer">© Esri</a>
    <span aria-hidden="true"> · </span>
    <a href={`https://server.arcgisonline.com/ArcGIS/rest/services/${imagery ? 'World_Imagery' : 'Ocean/World_Ocean_Base'}/MapServer`} target="_blank" rel="noreferrer">{imagery ? 'Fornitori delle immagini' : 'GEBCO, NOAA e altri fornitori'}</a>
  </p>;
}
