"""Public SIC-MSFD exports. Read only measured values, never infer unsampled areas.

Download discovery follows the public ISPRA portal's summaryReport API. Original
workbooks remain in ignored output/observatory/ispra; only allowlisted fields leave it.
"""
import hashlib
import io
import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.request import urlopen
from zipfile import ZipFile
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "output/observatory/ispra"
# Also support the workspace-local install used while preparing this import.
sys.path.insert(0, str(ROOT / "output/observatory/python"))
import xlrd

API = "http://www.db-strategiamarina.isprambiente.it/api/v1.0.0/summaryReport"
REMOTE_PATH = "app/files/datiMonitoraggio20242026"
SOURCE = "https://strategiamarina.isprambiente.it/sic-sistema-informativo-centralizzato/"
MODULES = ("Modulo_2_", "Modulo_4_", "Modulo_D8_")
REGIONS = {s.casefold(): s for s in ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
    "Friuli-Venezia Giulia", "Lazio", "Liguria", "Marche", "Molise", "Puglia", "Sardegna", "Sicilia", "Toscana", "Veneto"]}
CAS = {"7439-97-6": "Mercurio totale", "7440-43-9": "Cadmio", "7439-92-1": "Piombo",
       "7440-02-0": "Nichel", "7440-50-8": "Rame", "7440-47-3": "Cromo", "7440-66-6": "Zinco",
       "7440-38-2": "Arsenico", "58-89-9": "Lindano", "50-29-3": "DDT (p,p′)",
       "72-55-9": "DDE (p,p′)", "72-54-8": "DDD (p,p′)", "309-00-2": "Aldrin",
       "60-57-1": "Dieldrin", "72-20-8": "Endrin", "118-74-1": "Esaclorobenzene",
       "76-44-8": "Eptacloro", "319-84-6": "Alfa-HCH", "319-85-7": "Beta-HCH"}
AGENCIES = {"Toscana": "ARPAT", "Veneto": "ARPAV", "Emilia-Romagna": "Arpae", "Liguria": "ARPAL",
            "Sardegna": "ARPAS", "Calabria": "ARPACAL", "Basilicata": "ARPAB", "Campania": "ARPAC",
            "Marche": "ARPAM", "Molise": "ARPA Molise", "Abruzzo": "ARTA Abruzzo"}


def text(v):
    return "" if v is None else str(v).strip()


def numeric(v):
    try:
        n = float(text(v).replace(",", "."))
        return n if math.isfinite(n) and n >= 0 and n not in {9999, 99999, 999999} else None
    except (ValueError, TypeError):
        return None


def region(v):
    # ISTAT regional code used in some Campania station sheets.
    if text(v) in {"15", "15.0"}: return "Campania"
    key = re.sub(r"[\s-]+", "", text(v)).casefold()
    return next((name for name in REGIONS.values() if re.sub(r"[\s-]+", "", name).casefold() == key), "")


def observed(r, italian=False):
    keys = ("Anno", "Mese", "Giorno") if italian else ("Year", "Month", "Day")
    try:
        d = date(*(int(float(r[k])) for k in keys))
        return d.isoformat() if date(2024, 1, 1) <= d <= datetime.now(timezone.utc).date() else None
    except (ValueError, TypeError, KeyError, OverflowError):
        return None


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(urlopen(API + "?" + urlencode({"path": REMOTE_PATH}), timeout=40).read())
    selected = sorted({f["name"] for f in catalog if f["name"].startswith(MODULES)
                       and re.fullmatch(r"[A-Za-z0-9_-]+_2024-2026\.zip", f["name"])})
    if not selected:
        raise ValueError("ISPRA catalog contains no supported archives")
    archives = []
    for name in selected:
        url = API + "/" + quote(name) + "?" + urlencode({"path": REMOTE_PATH})
        raw = urlopen(url, timeout=90).read()
        with ZipFile(io.BytesIO(raw)) as z:
            if not any(n.lower().endswith((".xls", ".xlsx")) for n in z.namelist()):
                raise ValueError(f"No workbook in {name}")
        target = CACHE / name
        tmp = target.with_suffix(".tmp")
        tmp.write_bytes(raw)
        tmp.replace(target)
        archives.append({"file": name, "downloadUrl": url, "sha256": hashlib.sha256(raw).hexdigest(),
                         "verifiedAt": datetime.now(timezone.utc).isoformat()})
        print("ISPRA downloaded", name, flush=True)
    (CACHE / "sources.json").write_text(json.dumps(archives, indent=2), "utf-8")


class Workbook:
    def __init__(self, raw, name):
        self.xls = not raw.startswith(b"PK")
        if self.xls:
            self.book = xlrd.open_workbook(file_contents=raw)
            self.names = self.book.sheet_names()
        else:
            self.book = ZipFile(io.BytesIO(raw))
            self.ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
            rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(self.book.read('xl/_rels/workbook.xml.rels'))}
            self.sheets = {}
            for s in ET.fromstring(self.book.read('xl/workbook.xml')).find(self.ns + 'sheets'):
                target = rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
                self.sheets[s.attrib['name']] = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            self.names = list(self.sheets)
            self.strings = []
            if 'xl/sharedStrings.xml' in self.book.namelist():
                self.strings = [''.join(s.itertext()) for s in ET.fromstring(self.book.read('xl/sharedStrings.xml'))]

    def xml_rows(self, name):
        # Some official sheets format a million empty rows (300+ MB of XML).
        # Stream all rows but materialize only actual values, never a full grid.
        with self.book.open(self.sheets[name]) as stream:
            for _, row in ET.iterparse(stream, events=('end',)):
                if row.tag != self.ns + 'row': continue
                cells = {}
                for c in row:
                    value = c.find(self.ns + 'v')
                    if value is None:
                        inline = c.find(self.ns + 'is')
                        if inline is None: continue
                        v = ''.join(inline.itertext())
                    else:
                        v = value.text or ''
                        if c.attrib.get('t') == 's': v = self.strings[int(v)]
                    col = 0
                    for char in re.match(r'[A-Z]+', c.attrib['r'])[0]: col = col * 26 + ord(char) - 64
                    cells[col - 1] = v
                row.clear()
                if cells: yield [cells.get(i) for i in range(max(cells) + 1)]

    def rows(self, name):
        actual = next((s for s in self.names if s.strip().casefold() == name.casefold()), None)
        if actual is None:
            return
        if self.xls:
            sheet = self.book.sheet_by_name(actual)
            values = (sheet.row_values(i) for i in range(sheet.nrows))
        else:
            values = self.xml_rows(actual)
        headers = [text(v) for v in next(values, [])]
        for row in values:
            record = {k: v for k, v in zip(headers, row) if k}
            if any(v is not None and text(v) for v in record.values()):
                yield record

    def close(self):
        if not self.xls: self.book.close()


def position(station, italian=False):
    lon, lat = (numeric(station.get(k)) for k in (("Longitudine", "Latitudine") if italian else ("Longitude", "Latitude")))
    # Italy only; invalid/missing coordinates never become a regional centroid.
    return (lon, lat) if lon is not None and lat is not None and 6 <= lon <= 20 and 35 <= lat <= 46.7 else None


def make(station, when, measurements, module, archive, workbook, identity, **props):
    italian = module == "beach"
    xy = position(station, italian)
    reg = region(station.get("Regione" if italian else "Region"))
    if not xy or not reg or not when or not measurements:
        return None
    station_id = text(station.get("CodiceSpiaggia" if italian else "NationalStationID"))
    key = "ispra-" + hashlib.sha256(json.dumps([module, reg, station_id, when, identity], ensure_ascii=False, sort_keys=True, default=str).encode()).hexdigest()[:24]
    return {"type": "Feature", "id": key, "geometry": {"type": "Point", "coordinates": list(xy)},
            "properties": {"id": key, "title": text(station.get("NomeSpiaggia" if italian else "NationalStationName")) or station_id,
                "station": station_id, "region": reg, "country": "Italia", "observedAt": when,
                "provider": "ISPRA / ARPA", "originator": AGENCIES.get(reg, "ARPA " + reg) + " · SIC ISPRA",
                "sourceUrl": SOURCE, "sourceArchive": archive, "sourceFile": Path(workbook).name,
                "measurements": measurements, **props}}


def beaches(w, archive, name, audit):
    stations = {text(r.get("CodiceSpiaggia")): r for r in w.rows("Spiaggia")}
    groups = defaultdict(list)
    for r in w.rows("RifiutiCamp"):
        groups[text(r.get("CodiceCampionamento"))].append(r)
    out = []
    for r in w.rows("SpiaggiaCamp"):
        sid = text(r.get("CodiceSpiaggia")); key = text(r.get("CodiceCampionamento"))
        rows = groups.get(key, [])
        counts = [numeric(i.get("NumeroOggetti")) for i in rows]
        if not rows or any(n is None for n in counts):
            audit["beach_missing_counts"] += 1
            continue
        length = numeric(r.get("LunghezzaTransetto"))
        total = sum(counts)
        measurements = [{"name": "Oggetti censiti", "value": total, "unit": "oggetti / rilievo"}]
        if length:
            measurements.append({"name": "Abbondanza normalizzata", "value": round(total * 100 / length, 6), "unit": "oggetti / 100 m"})
        # Exact Joint List bottle categories only; absence of a category is unknown.
        bottle_rows = [i for i in rows if text(i.get("JointListCategory")) in {"J7", "J8", "J200"}]
        bottles = sum(numeric(i["NumeroOggetti"]) for i in bottle_rows) if bottle_rows else None
        if bottles is not None:
            measurements.append({"name": "Bottiglie nelle categorie specifiche", "value": bottles, "unit": "oggetti / rilievo"})
        f = make(stations.get(sid, {}), observed(r, True), measurements, "beach", archive, name, key,
                 bottles=bottles, method="Monitoraggio MSFD · rifiuti spiaggiati",
                 details=f"Tratto campionato: {length:g} m. Conteggi delle categorie trasmesse." if length else "Lunghezza del tratto non disponibile.")
        if f: out.append(f)
        else: audit["beach_invalid_station_or_date"] += 1
    return out


def micro(w, archive, name, audit):
    stations = {text(r.get("NationalStationID")): r for r in w.rows("Stazioni")}
    survey_dates = defaultdict(set)
    for r in w.rows("MicroplasticheRet"):
        if observed(r): survey_dates[text(r.get("NationalStationID"))].add(observed(r))
    groups = defaultdict(list)
    for r in w.rows("MicroplasticheCamp"):
        n = numeric(r.get("Num_oggetti")); when = observed(r)
        if n is None or not when:
            audit["micro_missing_value_or_date"] += 1
            continue
        if survey_dates[text(r.get("NationalStationID"))] and when not in survey_dates[text(r.get("NationalStationID"))]:
            audit["micro_date_disagrees_with_sampling_sheet"] += 1
            continue
        # Densities are already normalized by the provider: do not divide by area again.
        groups[(text(r.get("NationalStationID")), when)].append({"name": " · ".join(filter(None,
            [text(r.get("Forma")), text(r.get("Colore")), "trasparenza " + text(r.get("Trasparenza")) if text(r.get("Trasparenza")) else ""])),
            "value": n, "unit": "oggetti / m²", "definition": "Densità della categoria dichiarata nel campo Num_oggetti; nessuna conversione da conteggi grezzi."})
    out = []
    for (sid, when), measurements in groups.items():
        f = make(stations.get(sid, {}), when, measurements, "micro", archive, name, measurements,
                 method="Campionamento con retino manta", details="Posizione della stazione di monitoraggio. Densità per forma e colore, riportate separatamente; non è una mappa satellitare.")
        if f: out.append(f)
        else: audit["micro_invalid_station"] += 1
    return out


def chemicals(w, archive, name, audit):
    stations = {text(r.get("NationalStationID")): r for r in w.rows("Stazioni")}
    matrix = "sedimento" if "sedimenti" in archive else "organismi"
    out = []
    for r in w.rows("Contaminanti"):
        substance = CAS.get(text(r.get("CASNumber")))
        if not substance: continue
        n = numeric(r.get("Concentration")); when = observed(r); unit = text(r.get("Unit_HazSubs"))
        flag = text(r.get("LOD_LOQ_Flag")); loq = numeric(text(r.get("LOQ")).lstrip("< "))
        if n is None or not when or not unit or flag not in {"", "<", "["}:
            audit["chemical_invalid_value_or_flag"] += 1
            continue
        definition = text(r.get("DeterminandHazSubsName")) + ". "
        qualifier = ""
        if flag:
            # SIC can encode LOQ/2 in Concentration; never display it as a measurement
            # or invent a detection threshold when only the quantification limit exists.
            if flag == "[" or loq is None or loq <= 0 or n > loq:
                audit["chemical_censored_without_reliable_limit"] += 1
                continue
            definition += f"Inferiore al limite di quantificazione {loq:g} {unit}; valore codificato nella fonte: {n:g}. "
            n = loq; qualifier = "<"
        definition += "Metodo: " + (text(r.get("AnalyticalMethod")) or "non indicato")
        basis = text(r.get("Basis"))
        details = f"Matrice: {matrix}. Profondità del campione: {text(r.get('SampleDepth')) or 'non indicata'} m."
        if matrix == "organismi":
            details += f" Specie: {text(r.get('SpeciesName')) or 'non indicata'}. Tessuto: {text(r.get('Tissue')) or 'non indicato'}. Base: { {'W': 'peso umido', 'D': 'peso secco'}.get(basis, basis or 'non indicata')} ."
        else:
            details += " Concentrazione nel sedimento secondo la definizione originale; non confrontabile con acqua o biota."
        identity = [text(r.get(k)) for k in ("SampleID", "Replica", "CASNumber", "SampleDepth", "SpeciesName", "Tissue", "Basis", "Concentration", "LOD_LOQ_Flag", "Unit_HazSubs")]
        f = make(stations.get(text(r.get("NationalStationID")), {}), when,
                 [{"name": substance, "value": n, "unit": unit, "qualifier": qualifier, "definition": definition}],
                 "chemicals", archive, name, identity, substance=substance, matrix=matrix,
                 method="Analisi di laboratorio · MSFD", details=details, quality="provider", basis=basis)
        if f: out.append(f)
        else: audit["chemical_invalid_station_or_date"] += 1
    return out


def build():
    sources = json.loads((CACHE / "sources.json").read_text("utf-8"))
    collections = {key: [] for key in ("beach", "micro", "chemicals")}
    audit = Counter()
    for source in sources:
        archive = source["file"]
        kind = "micro" if archive.startswith("Modulo_2_") else "beach" if archive.startswith("Modulo_4_") else "chemicals" if archive.startswith("Modulo_D8_") else None
        if not kind: continue
        raw = (CACHE / archive).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source["sha256"]:
            raise ValueError(f"ISPRA archive checksum mismatch: {archive}")
        with ZipFile(io.BytesIO(raw)) as z:
            for name in sorted(z.namelist()):
                if not name.lower().endswith((".xls", ".xlsx")) or Path(name).name.startswith("~$"): continue
                w = Workbook(z.read(name), name)
                try:
                    collections[kind].extend({"beach": beaches, "micro": micro, "chemicals": chemicals}[kind](w, archive, name, audit))
                finally: w.close()
        print("ISPRA parsed", archive, flush=True)
    for kind, features in collections.items():
        unique = {f["id"]: f for f in features}
        audit[kind + "_duplicates_removed"] = len(features) - len(unique)
        # Campaign year is selected separately per region and matrix, not nationally.
        newest = {}
        for f in unique.values():
            p = f["properties"]; k = (p["region"], p.get("matrix", ""))
            newest[k] = max(newest.get(k, ""), p["observedAt"][:4])
        chosen = [f for f in unique.values() if f["properties"]["observedAt"][:4] == newest[(f["properties"]["region"], f["properties"].get("matrix", ""))]]
        if kind == "beach":
            last = {}
            for f in sorted(chosen, key=lambda f: (f["properties"]["observedAt"], f["id"])):
                last[(f["properties"]["region"], f["properties"]["station"])] = f
            chosen = list(last.values())
        collections[kind] = sorted(chosen, key=lambda f: f["id"])
        if not chosen: raise ValueError(f"No valid ISPRA {kind} data; refusing publication")
    report = {"sourceUrl": SOURCE, "catalogUrl": API + "?" + urlencode({"path": REMOTE_PATH}),
              "archives": sources, "excluded": dict(audit), "coverage": {k: dict(Counter(f["properties"]["region"] for f in fs)) for k, fs in collections.items()}}
    return collections, report


if __name__ == "__main__":
    if "--download" in sys.argv: download()
    data, report = build()
    (CACHE / "normalized.json").write_text(json.dumps(data, ensure_ascii=False, allow_nan=False), "utf-8")
    (CACHE / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), "utf-8")
    print(json.dumps({"coverage": report["coverage"], "excluded": report["excluded"]}, ensure_ascii=False, indent=2))
