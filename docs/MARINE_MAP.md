# Marine map sources and coverage

The map opens with Esri satellite imagery, EMODnet bathymetry, OpenSeaMap seamarks
and the EMODnet WDPA WMS enabled. The map occupies 90% of the viewport height,
uses the available page width and offers a fullscreen control.

Both map modes start behind an explicit “Esplora la mappa” entry control. Inactive
canvas controls are inert and receive no pointer events, so wheel and vertical
touch gestures scroll the page. Once activated, the sticky exit button, Escape,
a click outside, or leaving the viewport returns to page navigation. Switching
map modes remounts the gate in its inactive state. Fullscreen includes the gate.

The previous `emodnet:mpa` layer did not exist in the service capabilities.
It is replaced by `cddaareas,wdpaareas` (European and worldwide inventories).
This international WMS shows protected boundaries;
it does not establish uniform A/B/C zoning or unrestricted fishing rights.

## Local interactive catalog

`npm run marine:sync` imports published geographic data and generates
`public/data/marine-areas.geojson`, the metadata catalog and a source manifest.
The import is explicit, not part of a deployment build. Source failures or
truncated responses stop the import instead of replacing the catalog silently.

- 29 Italian IT90 marine protected areas from EMODnet / EEA CDDA. The source
  contains version-2021 Italian records with 2025 metadata. It must not be
  described as a complete inventory of every current Mediterranean protected site.
- 35 zoned geometries for five Sardinian AMP from the Regione Sardegna WFS
  `dbu:areemarineprotette`. The provider labels this dataset *dati indicativi*.
- Five zoned geometries for Capo Milazzo, including the special Bs subzone,
  from the Regione Siciliana SITR. Its download policy is CC BY 4.0, with
  explicit direction to consult the decrees for authoritative boundaries.
- Five geometries for Porto Cesareo reconstructed from the decimal-minute
  coordinates in Article 4 of DM 12 December 1997. A and B are clipped against
  the CDDA coastal boundary; C is its geometric remainder. This combination of
  sources is an indicative reconstruction, not a survey or certified navigation
  boundary. The metadata and UI disclose that distinction.

Sources:
- https://emodnet.ec.europa.eu/en/human-activities
- https://ows.emodnet-humanactivities.eu/wms?service=WMS&request=GetCapabilities
- https://webgis.regione.sardegna.it/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities
- https://www.sitr.regione.sicilia.it/download/tematismi/parchi-riserve-e-aree-marine-protette/
- https://faolex.fao.org/docs/pdf/ita34349.pdf
- https://www.comune.portocesareo.le.it/Amministrazione/Enti-e-fondazioni/Area-Marina-Protetta

Porto Cesareo is 166.54 km², with about 32 km of coastline. Local zone descriptions
summarize protection categories and link sources; they do not replace the 2009
regulation or more recent ordinances/authorizations. Other zones without verified
specific rules show the category and refer to the local regulation.

Missing internal zoning is explicitly marked as unavailable. The blue outline
means an AMP boundary, never zone C. WMS boundaries outside the local catalog
can be clicked to query the published CDDA/WDPA name, designation and IUCN category
through a fixed-endpoint GetFeatureInfo proxy. These categories are not A/B/C.
CRM development seed rows no longer override the
published geographic catalog. Net/AIS sample data retain their separate status.

`npm run test:marine` checks geometry integrity, catalog joins and the nonoverlap
and complete partition of the Porto Cesareo reconstruction.
