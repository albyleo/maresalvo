"""Import official releases, keeping the latest campaign per source/region.

Run: python scripts/sync-observatory.py [--offline]
Requires openpyxl. Raw archives stay in ignored output/observatory.
No contact details, credentials or personally identifying survey fields are exported.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import time
from http.client import IncompleteRead
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.error import URLError
from urllib.request import urlopen
from zipfile import ZipFile

import openpyxl
import ispra_observatory
import arpav_observatory

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "output/observatory"
DEST = ROOT / "public/data/observatory"
OGS = "https://nodc.ogs.it/repository/aggregated-datasets/"
SOURCES = {
    "beach": OGS + "litter/EMODnet_beachLitter_Mediterranean_2026_unrestricted.zip",
    "micro": OGS + "litter/EMODnet_floating_microlitter_2026_unrestricted.zip",
    "seafloor": OGS + "litter/EMODnet_SeafloorLitter_Mediterranean_2026_unrestricted.zip",
    "chemicals": OGS + "contaminants/EMD_Contaminants_Med_2026_unrestricted.zip",
}
EEA = "https://water.discomap.eea.europa.eu/arcgis/rest/services/WISE_UWWTD/DischargePoints_2022/MapServer/0/query"
SUBSTANCES = {
    "total mercury": "Mercurio totale", "cadmium": "Cadmio", "lead": "Piombo",
    "nickel": "Nichel", "copper": "Rame", "chromium": "Cromo", "zinc": "Zinco",
    "arsenic": "Arsenico", "gamma-hexachlorocyclohexane": "Lindano",
    "4,4'-dichlorodiphenyltrichloroethane": "DDT (p,p′)",
    "4,4'-dichlorodiphenyldichloroethylene": "DDE (p,p′)",
    "4,4'-dichlorodiphenyldichloroethane": "DDD (p,p′)",
}
# Exact object categories: never treat caps, jars or mixed containers as bottles.
BOTTLES = {"drink bottles <=0.5l", "drink bottles >0.5l", "plastic drink bottles >0.5 l",
           "plastic drink bottles ≤0.5 l", "glass bottles", "bottles", "bottles < 2 l"}


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def in_region(lon, lat):
    """Coarse coastal study envelope; exclude Atlantic coasts and Black/Marmara seas.

    Source beach/floor/chemical collections are already Mediterranean collections.
    This additional mask scopes the global micro collection and EEA coastal points.
    It is not a legal or ecological marine boundary.
    """
    if lon is None or lat is None or not (-5.7 <= lon <= 36.6 and 30 <= lat <= 46):
        return False
    if lon < 3 and lat > 43.5 or lon < -4.5 and lat > 37 or lon > 26 and lat > 40.8:
        return False
    return True


def feature(key, lon, lat, title, date, measurements, **extra):
    return {"type": "Feature", "id": str(key), "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {"id": str(key), "title": str(title), "observedAt": date,
                           "measurements": measurements, **extra}}


def latest(features):
    if not features:
        raise ValueError("No eligible observations: refusing to overwrite the published dataset")
    year = max(f["properties"]["observedAt"][:4] for f in features)
    return [f for f in features if f["properties"]["observedAt"].startswith(year)]


def sheet_rows(sheet):
    rows = sheet.iter_rows(values_only=True)
    header = next(rows)
    yield from (dict(zip(header, row)) for row in rows)


def beach():
    with ZipFile(CACHE / "beach.zip") as z:
        name = next(n for n in z.namelist() if n.endswith(".xlsx") and not n.startswith("__MACOSX"))
        w = openpyxl.load_workbook(z.open(name), read_only=True, data_only=True)
        beaches = {r["BeachCode"]: r for r in sheet_rows(w["Beaches"])}
        surveys = [r for r in sheet_rows(w["Surveys"]) if isinstance(r["SurveyDate"], datetime)]
        year = max(r["SurveyDate"].year for r in surveys)
        # Use standard monitoring; don't mix volunteer clean-ups into survey totals.
        surveys = {r["SurveyCode"]: r for r in surveys if r["SurveyDate"].year == year
                   and r["SurveyType"] == "MSFD_monitoring" and r["CoordinateSystem"] == 4326}
        items = defaultdict(list)
        for r in sheet_rows(w["Litter"]):
            if r["SurveyCode"] in surveys:
                items[r["SurveyCode"]].append(r)
        features = []
        for key, r in surveys.items():
            lon, lat = number(r["SurveyStartLongitude"]), number(r["SurveyStartLatitude"])
            if not in_region(lon, lat):
                continue
            rows = items[key]
            values = [number(i["NoItems"]) for i in rows]
            valid = rows and all(n is not None and n >= 0 for n in values)
            total = sum(values) if valid else None
            bottle_rows = [i for i in rows if str(i["ItemName"]).strip().lower() in BOTTLES]
            bottle_values = [number(i["NoItems"]) for i in bottle_rows]
            bottles = sum(bottle_values) if bottle_rows and all(n is not None and n >= 0 for n in bottle_values) else None
            length = number(r["SurveyLength"])
            measurements = []
            if total is not None:
                measurements.append({"name": "Oggetti censiti", "value": total, "unit": "oggetti / rilievo"})
            if total is not None and length and length > 0:
                measurements.append({"name": "Abbondanza normalizzata", "value": round(total * 100 / length, 2), "unit": "oggetti / 100 m"})
            if bottles is not None:
                measurements.append({"name": "Bottiglie nelle categorie specifiche", "value": bottles, "unit": "oggetti / rilievo"})
            b = beaches.get(r["BeachCode"], {})
            features.append(feature(key, lon, lat, b.get("BeachName", r["BeachCode"]), r["SurveyDate"].date().isoformat(),
                measurements, country=b.get("Country", ""), station=r["BeachCode"], bottles=bottles,
                method="Monitoraggio MSFD", details=f"Tratto: {length:g} m" if length else "Lunghezza non disponibile",
                originator=f"Organizzazione EDMO {r['Originator']}", sourceUrl=SOURCES["beach"]))
        # One point per beach, newest survey in the latest campaign year.
        by_beach = {}
        for f in sorted(features, key=lambda f: (f["properties"]["observedAt"], f["id"])):
            by_beach[f["properties"]["station"]] = f
        return latest(list(by_beach.values()))


def tsv_rows(content):
    return csv.reader((l for l in content.decode("utf-8-sig").splitlines() if not l.startswith("//")), delimiter="\t")


def clean_code(value):
    return value.split(" (", 1)[-1].rstrip(")") if " (" in value else value


def micro():
    with ZipFile(CACHE / "micro.zip") as z:
        rows = tsv_rows(z.read("EMODnet_floating_microlitter_2026_unrestricted.txt"))
        header = next(rows)
        ix = {k: i for i, k in enumerate(header) if not k.startswith("QV:")}
        meta, groups = {}, {}
        for row in rows:
            # ODV may omit repeated station metadata on continuation rows.
            if row[0]:
                meta = {k: row[i] for k, i in ix.items() if i < ix["MinDepBelowSeaSurf [m]"]}
            lon, lat = number(meta.get("Longitude [degrees_east]")), number(meta.get("Latitude [degrees_north]"))
            if not in_region(lon, lat):
                continue
            date = meta["yyyy-mm-ddThh:mm:ss.sss"][:10]
            key = f"{meta['LOCAL_CDI_ID']}:{meta['Station']}:{date}"
            count_index = ix["Microlitter_count_water"]
            count = number(row[count_index])
            if count is None or count < 0 or row[count_index + 1] not in {"1", "2"}:
                continue
            if key not in groups:
                groups[key] = feature(key, lon, lat, f"Stazione {meta['Station']}", date, [],
                    method="Campionamento superficiale", originator=meta.get("Originator", "EMODnet Chemistry"),
                    details=f"Maglia: {row[ix['Mesh_size [micrometres]']]} µm", sourceUrl=SOURCES["micro"])
            name = " · ".join(clean_code(row[ix[k]]) for k in ["Microlitter_type_water", "Microlitter_size_class_water", "Microlitter_polymer_type_water"] if row[ix[k]])
            groups[key]["properties"]["measurements"].append({"name": name or "Microlitter", "value": count, "unit": "particelle nella frazione campionata"})
        return latest(list(groups.values()))


def seafloor():
    with ZipFile(CACHE / "seafloor.zip") as z:
        rows = list(csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode("utf-8-sig")), delimiter="\t"))
    groups = {}
    for r in rows:
        lon, lat = number(r["ShootLong"]), number(r["ShootLat"])
        n = number(r["LT_Items"])
        if not in_region(lon, lat) or r["CoordRefSys"] != "4326" or n is None or n < 0 or r["DataPolicy"] not in {"CB", "UN"}:
            continue
        key = r["SurveyCode"]
        if key not in groups:
            groups[key] = feature(key, lon, lat, f"Trainata {r['StNo']} / {r['HaulNo']}", r["Date"], [],
                method=f"Campionamento {r['Gear']}", country=r["Country"], originator=f"Organizzazione EDMO {r['Originator']}",
                details=f"Profondità: {r['Depth']} m. Posizione iniziale della trainata.", sourceUrl=SOURCES["seafloor"])
        groups[key]["properties"]["measurements"].append({"name": f"{r['LTREF']} · {r['PARAM']}", "value": n,
            "unit": "oggetti / trainata" if r["UnitItem"].lower() == "items/haul" else r["UnitItem"]})
    return latest(list(groups.values()))


def chemicals():
    features = []
    with ZipFile(CACHE / "chemicals.zip") as z:
        for name in z.namelist():
            if not name.endswith("_transposed.txt"):
                continue
            rows = tsv_rows(z.read(name))
            header = next(rows)
            value_index = header.index("Value")
            for row in rows:
                r = dict(zip(header, row))
                substance = r.get("S27_preflabel", "").strip()
                if substance not in SUBSTANCES:
                    continue
                lon, lat = number(r["Longitude [degrees_east]"]), number(r["Latitude [degrees_north]"])
                value = number(r["Value"])
                qc = row[value_index + 1]
                if not in_region(lon, lat) or value is None or value < 0 or qc not in {"1", "2", "6"}:
                    continue
                matrix = "sedimento" if "sediment_" in name else "organismi" if "biota_" in name else "acqua"
                date = r["yyyy-mm-ddThh:mm:ss.sss"][:10]
                label = SUBSTANCES[substance]
                key = hashlib.sha256((name + "\t" + "\t".join(row)).encode()).hexdigest()[:20]
                features.append(feature(key, lon, lat, r.get("Station name") or r["Station"], date,
                    [{"name": label, "value": value, "unit": r["Units"], "qualifier": "<" if qc == "6" else "", "definition": r["P01_preflabel"]}],
                    substance=label, matrix=matrix, method="Analisi di laboratorio", quality=qc,
                    details=f"Matrice: {r['S26_preflabel']}. Profondità: {r.get('CmpDep [m]', 'n.d.')} m.",
                    originator=r.get("Originator", "EMODnet Chemistry"), sourceUrl=SOURCES["chemicals"]))
    return latest(features)


def discharge_features(data):
    if data.get("error") or data.get("type") != "FeatureCollection":
        raise ValueError("EEA returned an invalid GeoJSON response")
    if data.get("exceededTransferLimit") or data.get("properties", {}).get("exceededTransferLimit"):
        raise ValueError("EEA response truncated")
    features = []
    for f in data["features"]:
        if not f.get("geometry"):
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        p = f["properties"]
        if not in_region(lon, lat) or p["dcpWaterBodyType"] != "CW" or p["dcpState"] != 1:
            continue
        features.append(feature(p["dcpCode"], lon, lat, p["dcpName"] or p["dcpCode"], "2022–2023", [],
            method="Infrastruttura censita", details=f"Corpo recettore: acque costiere. Codice: {p['dcpCode']}",
            originator="EEA · Waterbase UWWTD", sourceUrl="https://www.eea.europa.eu/en/datahub/datahubitem-view/21874828-fa7a-4e7e-8a0a-52ec7d92f99f"))
    if not features:
        raise ValueError("Empty discharge dataset")
    return features


def discharges():
    return discharge_features(json.loads((CACHE / "discharges-data.json").read_text("utf-8")))


def download_discharges():
    """Retry EEA; on transport failure retain the published snapshot unchanged.

    Never replace the cache with an incomplete/error response, or assign a new
    verification date to a dataset we could not retrieve. Invalid data still fail.
    """
    params = {"where": "dcpWaterBodyType='CW'", "geometry": "-5.7,30,36.6,46", "geometryType": "esriGeometryEnvelope",
              "inSR": 4326, "spatialRel": "esriSpatialRelIntersects", "outFields": "dcpCode,dcpName,dcpState,dcpWaterBodyType,repCode,uwwCode",
              "outSR": 4326, "returnGeometry": "true", "f": "geojson", "resultRecordCount": 10000}
    for attempt in range(1, 4):
        print(f"EEA: download scarichi costieri, tentativo {attempt}/3...", flush=True)
        try:
            with urlopen(EEA + "?" + urlencode(params), timeout=20) as response:
                raw = response.read()
        except (URLError, TimeoutError, ConnectionError, IncompleteRead) as exc:
            print(f"EEA: richiesta non riuscita ({exc}).", flush=True)
            if attempt < 3:
                time.sleep(attempt)
                continue
            target = DEST / "discharges.json"
            if not target.exists():
                raise RuntimeError("EEA non raggiungibile e nessun dataset pubblicato da conservare.") from exc
            previous = json.loads(target.read_text("utf-8"))
            meta = previous.get("metadata", {})
            if (previous.get("type") != "FeatureCollection" or not previous.get("features")
                    or meta.get("count") != len(previous["features"]) or not meta.get("verifiedAt")):
                raise ValueError("Il dataset EEA precedente non e valido: aggiornamento interrotto.") from exc
            print(f"ATTENZIONE: scarichi EEA NON aggiornati; conservati {meta['count']} punti "
                  f"e la verifica precedente del {meta['verifiedAt']}. Le altre fonti proseguono.", flush=True)
            return previous
        discharge_features(json.loads(raw))
        target = CACHE / "discharges-data.json"
        tmp = target.with_suffix(".tmp")
        tmp.write_bytes(raw)
        tmp.replace(target)
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Rebuild from already downloaded archives; retains their verification time")
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    retained_discharges = None
    if not args.offline:
        for key, url in SOURCES.items():
            print(f"EMODnet: download {key}...", flush=True)
            with urlopen(url, timeout=90) as response:
                (CACHE / f"{key}.zip").write_bytes(response.read())
        retained_discharges = download_discharges()
        print("ISPRA: aggiornamento archivi...", flush=True)
        ispra_observatory.download()
        print("ARPAV: aggiornamento misure in mare...", flush=True)
        arpav_observatory.download()
    print("Elaborazione e validazione dei campionamenti...", flush=True)
    italian, ispra_report = ispra_observatory.build()
    field, arpav_report = arpav_observatory.build()
    manifest = {}
    pending = {}
    for key, build in [("beach", beach), ("micro", micro), ("seafloor", seafloor), ("chemicals", chemicals), ("discharges", discharges)]:
        if key == "discharges" and retained_discharges is not None:
            pending[key] = retained_discharges
            manifest[key] = retained_discharges["metadata"]
            continue
        features = build()
        provider = "EEA" if key == "discharges" else "EMODnet"
        for f in features:
            f["properties"]["provider"] = provider
        sources = [{"provider": provider, "sourceUrl": SOURCES.get(key, EEA), "count": len(features)}]
        if key in italian:
            features.extend(italian[key])
            sources.append({"provider": "ISPRA / ARPA", "sourceUrl": ispra_observatory.SOURCE, "count": len(italian[key])})
        raw = CACHE / ("discharges-data.json" if key == "discharges" else f"{key}.zip")
        verified = datetime.fromtimestamp(raw.stat().st_mtime, timezone.utc).isoformat()
        dates = sorted(f["properties"]["observedAt"] for f in features)
        years = sorted(set(d[:4] for d in dates), reverse=True)
        meta = {"edition": "EEA 2026 · dati 2022–2023" if key == "discharges" else "EMODnet 2026",
                "verifiedAt": verified, "observedFrom": dates[0], "observedTo": dates[-1], "count": len(features),
                "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(), "sourceUrl": SOURCES.get(key, EEA),
                "year": "2022–2023" if key == "discharges" else years[0] if len(years) == 1 else f"{years[-1]}–{years[0]}",
                "years": years, "sources": sources}
        if key in italian:
            meta["edition"] += " · ISPRA / ARPA · ultime campagne regionali"
            meta["verifiedAt"] = max(verified, *(s["verifiedAt"] for s in ispra_report["archives"]))
            # The original archive digest remains associated with EMODnet. The
            # collection also carries a digest of every newly imported raw source.
            meta["additionalSources"] = ispra_report["archives"]
        pending[key] = {"type": "FeatureCollection", "metadata": meta, "features": features}
        manifest[key] = meta
        print(key, meta["year"], len(features), flush=True)
    for key, features in field.items():
        source = next(s for s in arpav_report["archives"] if s["id"] == key)
        dates = sorted(f["properties"]["observedAt"] for f in features)
        meta = {"edition": "ARPAV · " + source["edition"], "verifiedAt": source["verifiedAt"],
                "observedFrom": dates[0], "observedTo": dates[-1], "count": len(features), "sha256": source["sha256"],
                "sourceUrl": source["sourceUrl"], "year": dates[-1][:4], "years": [dates[-1][:4]],
                "sources": [{"provider": "ARPAV", "sourceUrl": source["sourceUrl"], "count": len(features)}], "additionalSources": [source]}
        pending[key] = {"type": "FeatureCollection", "metadata": meta, "features": features}
        manifest[key] = meta
        print(key, meta["year"], len(features), flush=True)
    # Only publish after every importer has succeeded; fail instead of silently reverting.
    for key, data in {**pending, "manifest": manifest, "italian-sources": {"ispra": ispra_report, "arpav": arpav_report}}.items():
        target = DEST / f"{key}.json"
        tmp = target.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")), "utf-8")
        tmp.replace(target)
    print("Sincronizzazione completata CON AVVISO: EEA non aggiornato, mantenuta la versione precedente."
          if retained_discharges is not None else "Sincronizzazione completata.", flush=True)


if __name__ == "__main__":
    main()
