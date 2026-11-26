"""Additional ARPA field measurements. Preserve source units and regional campaigns.

Public endpoints only. Report transcriptions are versioned and checksum-locked;
new PDF editions require review, never automatic guessing of table layouts.
"""
import csv
import hashlib
import io
import json
import math
import re
import sqlite3
import struct
from collections import Counter
from contextlib import contextmanager
from datetime import date, datetime, timezone
from urllib.request import Request, urlopen
from zipfile import ZipFile, BadZipFile

from ispra_observatory import ROOT
from pyproj import Transformer

CACHE = ROOT / 'output/observatory/regional'
TUR = 'turbidity-samples'
SPM = 'suspended-matter-samples'
CAMPANIA = 'https://dati.arpacampania.it/dataset/monitoraggio-acque-marino-costiere'
CAMPANIA_API = 'https://dati.arpacampania.it/api/3/action/package_show?id=monitoraggio-acque-marino-costiere'
LAZIO = 'https://sira.arpalazio.it/web/guest/banche-dati/visualizzazione/acqua'
LAZIO_API = 'https://sira.arpalazio.it/o/sira/ricerca/get_risultati_ricerca'
LAZIO_GPKG = 'https://sira.arpalazio.it/documents/20124/71228/rete-di-monitoraggio-acque-marino-costiere-d-lgs-152-06-all-1-punto-prelievo-delle-acque.gpkg/34aea18c-b926-afa3-f7ce-098d0ff5b5ca?download=true'
TOSCANA = 'https://www.arpat.toscana.it/pubblicazione/qualita-delle-acque-destinate-alla-vita-dei-molluschi-2024/'
TOSCANA_CATALOG = 'https://www.arpat.toscana.it/acque-marine-e-costiere/rapporti-annuali-sulle-acque-marino-costiere-destinate-alla-vita-dei-molluschi/'
TOSCANA_ZIP = 'https://www.arpat.toscana.it/app/uploads/documentazione/catalogo-pubblicazioni-arpat/qualita-delle-acque-destinate-alla-vita-dei-molluschi-2024.zip'
TOSCANA_SHA = '6d2884c6cc26eba33e5aabb62974ada01df160a15107bbaa49e0ad7f7140bb09'
ABRUZZO = 'https://www.artaabruzzo.it/download/pubblicazioni/Relazione_Vita_Molluschi_2024_r1.pdf'
ABRUZZO_CATALOG = 'https://www.artaabruzzo.it/pubblicazioni.php?id_page=1'
ABRUZZO_SHA = '8a338b1b0afe34eed14fa13f7e7e82718f6a29d519bcbbce1a1d2b4b2470de53'


def fetch(url, body=None, identify=False):
    headers = {'Content-Type': 'text/plain'} if body is not None else {}
    if identify: headers['User-Agent'] = 'MareSalvo/1.0 (public environmental data importer)'
    request = Request(url, data=json.dumps(body).encode() if body is not None else None,
                      headers=headers)
    with urlopen(request, timeout=45) as response:
        return response.read()


PUBLISHED = ROOT / 'public/data/observatory'


def retained_features(source):
    data = json.loads((PUBLISHED / (source['id'] + '.json')).read_text('utf-8'))
    features = [f for f in data['features'] if f['properties'].get('region') == source['region']
                and f['properties'].get('provider') == source['provider']]
    if not features or len({f['id'] for f in features}) != len(features):
        raise ValueError('Snapshot precedente assente o non valido: ' + source['region'])
    return features


def retained_source(region, error):
    for kind in (TUR, SPM):
        path = PUBLISHED / (kind + '.json')
        if not path.exists(): continue
        data = json.loads(path.read_text('utf-8'))
        for source in data['metadata'].get('additionalSources', []):
            if source.get('region') != region: continue
            source = {**source, 'retained': True, 'lastAttemptAt': datetime.now(timezone.utc).isoformat(),
                      'syncWarning': str(error)}
            fs = retained_features(source)
            print(f"ATTENZIONE: {region} NON aggiornato ({error}); conservate {len(fs)} osservazioni e verifica {source['verifiedAt']}.", flush=True)
            # GitHub Actions annotates this warning without hiding it in the log.
            import os
            if os.environ.get('GITHUB_ACTIONS') == 'true':
                print(f"::warning title=Fonte ARPA non aggiornata::{region}: conservata la versione precedente. Consultare il log.", flush=True)
            return source
    raise RuntimeError('Fonte non aggiornata e nessuno snapshot pubblicato disponibile: ' + region) from error


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    pending = {}; sources = []

    def record(key, provider, region, filename, raw, url, source_url, license, **extra):
        pending[filename] = raw
        sources.append({'id': key, 'provider': provider, 'region': region, 'file': filename,
                        'downloadUrl': url, 'sourceUrl': source_url, 'license': license,
                        'sha256': hashlib.sha256(raw).hexdigest(),
                        'verifiedAt': datetime.now(timezone.utc).isoformat(), **extra})

    @contextmanager
    def attempt(region):
        count = len(sources)
        try:
            yield
        except (OSError, ValueError, KeyError, BadZipFile) as error:
            del sources[count:]
            sources.append(retained_source(region, error))

    with attempt('Campania'):
        print('ARPAC / Campania: catalogo CKAN e CSV chimico-fisici...', flush=True)
        package = json.loads(fetch(CAMPANIA_API))['result']
        if package.get('license_id') != 'cc-by': raise ValueError('ARPAC: licenza cambiata')
        resources = [r for r in package['resources'] if 'chimic' in r['name'].lower()
                     and r.get('format', '').lower() == 'csv' and re.search(r'20\d{2}', r['name'])]
        source = max(resources, key=lambda r: int(re.search(r'20\d{2}', r['name'])[0]))
        url = source['url']
        if not url.startswith('https://dati.arpacampania.it/'): raise ValueError('ARPAC: host inatteso')
        record(TUR, 'ARPAC', 'Campania', 'campania.csv', fetch(url), url, CAMPANIA, 'CC BY 4.0',
               catalogUrl=CAMPANIA_API, edition=source['name'])

    with attempt('Lazio'):
        print('ARPA Lazio: misure via API SIRA e coordinate GeoPackage...', flush=True)
        body = {'page': 1, 'data_inizio': '2024-1-1', 'data_fine': date.today().isoformat(),
                'prm_lista_id_ost': '', 'prm_lista_id_ulia': '', 'prm_lista_id_att': 11,
                'prm_lista_id_tipo_ems': '', 'prm_lista_id_ems': '', 'prm_limit_row': -1}
        record(TUR, 'ARPA Lazio', 'Lazio', 'lazio.json', fetch(LAZIO_API, body), LAZIO_API, LAZIO,
               'CC BY 3.0 IT', requestMethod='POST', requestBody=body, edition='SIRA · dal 2024',
               licenseUrl='https://www.arpalazio.it/note-legali')
        coordinates = fetch(LAZIO_GPKG)
        pending['lazio.gpkg'] = coordinates
        sources[-1]['coordinates'] = {'file': 'lazio.gpkg', 'downloadUrl': LAZIO_GPKG,
                                      'sha256': hashlib.sha256(coordinates).hexdigest()}

    with attempt('Toscana'):
        print('ARPAT / Toscana: verifica rapporto molluschi 2024, tabelle 1 e 4...', flush=True)
        catalog = fetch(TOSCANA_CATALOG).decode('utf-8')
        editions = re.findall(r'qualita-delle-acque-destinate-alla-vita-dei-molluschi-(20\d{2})', catalog)
        if not editions or max(editions) != '2024':
            raise ValueError('ARPAT: catalogo cambiato o nuova edizione. Rivedere la trascrizione prima di pubblicare.')
        with ZipFile(io.BytesIO(fetch(TOSCANA_ZIP))) as archive:
            pdfs = [n for n in archive.namelist() if n.lower().endswith('.pdf')]
            if len(pdfs) != 1: raise ValueError('ARPAT: archivio inatteso')
            pdf = archive.read(pdfs[0])
        if hashlib.sha256(pdf).hexdigest() != TOSCANA_SHA:
            raise ValueError('ARPAT: rapporto modificato, verificare nuovamente le tabelle 1 e 4')
        record(SPM, 'ARPAT', 'Toscana', 'toscana.pdf', pdf, TOSCANA_ZIP, TOSCANA,
               'CC BY-NC-SA 4.0', licenseUrl='https://www.arpat.toscana.it/note-legali/',
               edition='Rapporto molluschi 2024 · tabelle 1 e 4', catalogUrl=TOSCANA_CATALOG,
               extraction='Trascrizione verificata il 2026-11-26; coordinate pagina 7, misure pagina 11')

    with attempt('Abruzzo'):
        print('ARPA Abruzzo: verifica rapporto molluschi 2024, tabelle 1 e 6...', flush=True)
        catalog = fetch(ABRUZZO_CATALOG, identify=True).decode('utf-8')
        editions = re.findall(r'Relazione_Vita_Molluschi_(20\d{2})', catalog, flags=re.I)
        if not editions or max(editions) != '2024':
            raise ValueError('ARPA Abruzzo: catalogo cambiato o nuova edizione, rivedere le tabelle')
        pdf = fetch(ABRUZZO, identify=True)
        sources.append(abruzzo_source(pdf, datetime.now(timezone.utc).isoformat()))
        pending['abruzzo.pdf'] = pdf

    for filename, raw in pending.items():
        target = CACHE / filename
        tmp = target.with_suffix('.tmp'); tmp.write_bytes(raw); tmp.replace(target)
    (CACHE / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), 'utf-8')


def number(raw):
    try: n = float(str(raw).strip().replace(',', '.'))
    except (ValueError, TypeError): return None
    return n if math.isfinite(n) and n >= 0 else None


def observation(source, station, title, when, lon, lat, value, unit, *, depth=None, qualifier='', details=''):
    bounds = {'Campania': (13, 39, 16, 42), 'Lazio': (11, 40, 14.5, 43), 'Toscana': (9, 42, 12, 45), 'Abruzzo': (13.5, 41.5, 15.2, 43.2)}
    west, south, east, north = bounds[source['region']]
    if not west < lon < east or not south < lat < north: raise ValueError('Coordinate fuori regione')
    if date.fromisoformat(when) > date.today(): raise ValueError('Data futura')
    if value is None or not math.isfinite(value) or value < 0: raise ValueError('Misura non valida')
    identity = f"{source['region'].lower()}-{source['id']}-{station}-{when}"
    turbidity = source['id'] == TUR
    props = {'id': identity, 'title': title, 'station': station, 'observedAt': when,
             'country': 'Italia', 'region': source['region'], 'provider': source['provider'],
             'originator': source['provider'] + ' · ' + source['edition'], 'sourceUrl': source['sourceUrl'],
             'license': source['license'], 'method': 'Monitoraggio acque costiere' if turbidity else 'Analisi di campione d’acqua',
             'details': details, 'measurements': [{'name': 'Torbidità misurata' if turbidity else 'Solidi sospesi misurati',
                                                  'value': value, 'unit': unit, 'qualifier': qualifier}]}
    if depth is not None: props['depth'] = depth
    return {'type': 'Feature', 'id': identity, 'geometry': {'type': 'Point', 'coordinates': [round(lon, 7), round(lat, 7)]}, 'properties': props}


def latest(features):
    if not features: raise ValueError('Nessuna misura regionale valida: dati pubblicati non sostituiti')
    year = max(f['properties']['observedAt'][:4] for f in features)
    return sorted([f for f in features if f['properties']['observedAt'].startswith(year)], key=lambda f: f['id'])


def campania(raw, source, audit):
    rows = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    required = {'Cod. Stazione', 'Lat.N', 'Long.E', 'Profondita', 'Torbidita FTU', 'Data Campionamento'}
    if not required.issubset(rows.fieldnames or []): raise ValueError('ARPAC: colonne CSV cambiate')
    found = {}
    for r in rows:
        value = number(r['Torbidita FTU'])
        if value is None: audit['campania_missing_measurement'] += 1; continue
        try:
            depth = abs(float(r['Profondita'].replace(',', '.')))
            if not math.isfinite(depth) or depth > 1: continue
            when = datetime.strptime(r['Data Campionamento'], '%d-%m-%Y').date().isoformat()
            f = observation(source, r['Cod. Stazione'], r['Nome stazione'], when,
                            float(r['Long.E'].replace(',', '.')), float(r['Lat.N'].replace(',', '.')),
                            value, 'FTU', depth=depth,
                            details=f'Profondità: {depth:g} m. Misura più vicina alla superficie entro 1 m per stazione e giorno. FTU originali, senza conversione in FNU satellitari.')
            previous = found.get(f['id'])
            if previous is None or depth < previous['properties']['depth']: found[f['id']] = f
        except (ValueError, TypeError, KeyError): audit['campania_invalid_date_coordinate_or_depth'] += 1
    return latest(list(found.values()))


def lazio_coordinates(path):
    transform = Transformer.from_crs(32633, 4326, always_xy=True)
    with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
        table, column, geometry, crs, z, m = db.execute('select * from gpkg_geometry_columns').fetchone()
        if crs != 32633 or z != 0 or m != 0: raise ValueError('ARPA Lazio: sistema di coordinate cambiato')
        # Table names are quoted, including the empty name in the official file.
        rows = db.execute('select cod_pnt, "' + column.replace('"', '""') + '" from "' + table.replace('"', '""') + '"')
        result = {}
        for code, blob in rows:
            if blob[:3] != b'GP\x00' or blob[3] & 0x10: raise ValueError('GeoPackage non valido/vuoto')
            envelope = (blob[3] >> 1) & 7
            if envelope not in (0, 1, 2, 3, 4): raise ValueError('GeoPackage envelope non valido')
            offset = 8 + (0, 32, 48, 48, 64)[envelope]
            endian = '<' if blob[offset] == 1 else '>'
            if struct.unpack_from(endian + 'I', blob, offset + 1)[0] != 1: raise ValueError('Atteso Point WKB')
            result[code] = transform.transform(*struct.unpack_from(endian + 'dd', blob, offset + 5))
        return result


def lazio(raw, coordinates, source, audit):
    rows = json.loads(raw)['aRisultati']
    if not rows or any(int(r['tot_row']) != len(rows) for r in rows): raise ValueError('ARPA Lazio: risposta vuota o troncata')
    depths = {r['rif_campione']: number(r['valore_an']) for r in rows if r['parametro'] == "PROFONDITA' CAMPIONAMENTO"}
    found = {}
    for r in rows:
        if r['parametro'].lower() != 'torbidità' or not r['cod_ulia_figlia'].endswith('/0'): continue
        if r['unita_misura_descrizione'] != 'NTU': raise ValueError('ARPA Lazio: unità cambiata')
        depth = depths.get(r['rif_campione'])
        if depth is not None and depth > 1: audit['lazio_surface_depth_exceeds_1m'] += 1; continue
        value = number(r['valore_an'])
        if value is None or r['segno_valore'] not in ('=', '<'): audit['lazio_invalid_value_or_qualifier'] += 1; continue
        code = r['cod_ulia_figlia']
        # Unmatched stations stop publication rather than silently reducing coverage.
        if code not in coordinates: raise ValueError('ARPA Lazio: coordinate mancanti per ' + code)
        try:
            f = observation(source, code, r['stazione'], r['rt_data_ora_prelievo'][:10], *coordinates[code],
                            value, 'NTU', depth=depth, qualifier='<' if r['segno_valore'] == '<' else '',
                            details=('Punto di prelievo in superficie (/0). ' + (f'Profondità: {depth:g} m. ' if depth is not None else 'Profondità numerica non disponibile. ')
                                     + 'NTU come pubblicate da SIRA, senza conversione in FTU o FNU. Coordinate ufficiali EPSG:32633 convertite in WGS84. Valori originali senza correzioni presunte.'))
        except ValueError: audit['lazio_invalid_date_or_coordinate'] += 1; continue
        # Distinct samples on the same day must not collapse into one observation.
        f['id'] += '-' + str(r['rif_campione'])
        f['properties']['id'] = f['id']
        # The API can expose revisions; retain the latest revision of a sample.
        revision = int(r['revisione'])
        if f['id'] not in found or revision > found[f['id']][0]: found[f['id']] = (revision, f)
    return latest([item[1] for item in found.values()])


def toscana(source):
    # Verified against table 1 (p7) and table 4 (p11). WGS84 degrees + decimal minutes.
    stations = [
        ('Viareggio Ovest', 43 + 53.072/60, 10 + 13.743/60, [('2024-02-15', 4, ''), ('2024-05-21', 14, ''), ('2024-09-17', 17, '')]),
        ('Tirrenia', 43 + 37.610/60, 10 + 17.233/60, [('2024-02-15', 17, ''), ('2024-06-05', 9.1, ''), ('2024-09-11', 31, '')]),
        ('Carbonifera', 42 + 53.817/60, 10 + 40.050/60, [('2024-01-30', 3.2, ''), ('2024-05-15', 2.5, ''), ('2024-07-16', 2.5, '<')]),
    ]
    return [observation(source, name.lower().replace(' ', '-'), name, when, lon, lat, value, 'mg/L', qualifier=qualifier,
                        details='Monitoraggio acque destinate alla vita dei molluschi. Trascrizione MareSalvo: tabella 4, pagina 11; coordinate tabella 1, pagina 7. Profondità del campione non specificata nella tabella. Nessun valore aggiunto per la campagna non effettuata. Dati derivati CC BY-NC-SA 4.0, fonte ARPAT.')
            for name, lat, lon, samples in stations for when, value, qualifier in samples]


def abruzzo_source(raw, verified_at):
    if hashlib.sha256(raw).hexdigest() != ABRUZZO_SHA:
        raise ValueError('ARPA Abruzzo: rapporto modificato, verificare tabelle 1 e 6')
    return {'id': SPM, 'provider': 'ARPA Abruzzo', 'region': 'Abruzzo', 'file': 'abruzzo.pdf',
            'downloadUrl': ABRUZZO, 'sourceUrl': ABRUZZO, 'catalogUrl': ABRUZZO_CATALOG,
            'sha256': ABRUZZO_SHA, 'verifiedAt': verified_at,
            'license': 'Non specificata nel rapporto pubblico',
            'edition': 'Rapporto vita molluschi 2024 · tabelle 1 e 6',
            'extraction': 'Dati numerici e coordinate estratti e verificati il 2026-11-26; pagine 7, 14–16. Sei misure offshore escluse per coordinate non presenti nella tabella.'}


def abruzzo(source, audit):
    data = json.loads((ROOT / 'scripts/data/abruzzo-molluschi-2024.json').read_text('utf-8'))
    if data['sha256'] != ABRUZZO_SHA: raise ValueError('Trascrizione Abruzzo non revisionata')
    out = []
    for row in data['measurements']:
        station = row['station']
        if station not in data['coordinates']:
            audit['abruzzo_measurements_without_official_coordinates'] += 1
            continue
        when = datetime.strptime(row['date'], '%d/%m/%Y').date().isoformat()
        value = row['value']
        out.append(observation(source, station, station.replace('_', ' '), when, *data['coordinates'][station],
                               number(value.lstrip('< ')), 'mg/L', qualifier='<' if value.startswith('<') else '',
                               details=f"Solidi sospesi totali: tabella 6, pagina {row['page']}. Coordinate WGS84 della stazione: tabella 1, pagina 7 del rapporto ARPA Abruzzo 2024. Il numero nel codice indica la distanza dalla costa, non la profondità. Profondità del campione non specificata nella tabella. Estrazione MareSalvo dei dati numerici, senza interpolazioni."))
    return latest(out)


def build():
    sources = json.loads((CACHE / 'sources.json').read_text('utf-8'))
    regions = [s['region'] for s in sources]
    if len(regions) != len(set(regions)) or not {'Campania', 'Lazio', 'Toscana', 'Abruzzo'}.issubset(regions) or not set(regions).issubset({'Campania', 'Lazio', 'Toscana', 'Abruzzo'}):
        raise ValueError('Cache regionale incompleta: eseguire prima il download di tutte le fonti integrate')
    out = {TUR: [], SPM: []}; audit = Counter()
    for source in sources:
        if source.get('retained'):
            fs = retained_features(source)
            out[source['id']].extend(fs)
            continue
        raw = (CACHE / source['file']).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source['sha256']: raise ValueError('Checksum regionale non corrispondente')
        if source['region'] == 'Campania': fs = campania(raw, source, audit)
        elif source['region'] == 'Lazio':
            coords = source['coordinates']; path = CACHE / coords['file']
            if hashlib.sha256(path.read_bytes()).hexdigest() != coords['sha256']: raise ValueError('Checksum coordinate Lazio non corrispondente')
            fs = lazio(raw, lazio_coordinates(path), source, audit)
        elif source['region'] == 'Toscana':
            if hashlib.sha256(raw).hexdigest() != TOSCANA_SHA: raise ValueError('Rapporto ARPAT non revisionato')
            fs = toscana(source)
        elif source['region'] == 'Abruzzo':
            if hashlib.sha256(raw).hexdigest() != ABRUZZO_SHA: raise ValueError('Rapporto Abruzzo non revisionato')
            fs = abruzzo(source, audit)
        else: raise ValueError('Fonte regionale inattesa')
        out[source['id']].extend(fs)
        print(f"{source['provider']} / {source['region']}: {source['id']}, {fs[0]['properties']['observedAt'][:4]}, {len(fs)} osservazioni, {len(set(f['properties']['station'] for f in fs))} stazioni", flush=True)
    return out, {'archives': sources, 'excluded': dict(audit),
                 'coverage': {k: dict(Counter(f['properties']['region'] for f in fs)) for k, fs in out.items()}}


if __name__ == '__main__':
    download()
    build()
