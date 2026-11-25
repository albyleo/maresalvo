"""Latest public ARPAV coastal measurements; never merge FTU with satellite FNU."""
import csv
import hashlib
import io
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from ispra_observatory import ROOT, text, numeric
from pyproj import Transformer

CACHE = ROOT / "output/observatory/arpav"
PACKAGES = {"turbidity-samples": "acque-marino-costiere-profili-sonda",
            "suspended-matter-samples": "acque-marino-costiere-nutrienti-e-solidi-sospesi"}
CATALOG = "https://opendata.arpa.veneto.it/api/3/action/package_show?id="
TRANSFORM = Transformer.from_crs("EPSG:3003", "EPSG:4326", always_xy=True)


def download():
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = []
    for kind, slug in PACKAGES.items():
        package = json.loads(urlopen(CATALOG + slug, timeout=40).read())["result"]
        if package.get("license_id") != "cc-by": raise ValueError("ARPAV license changed")
        resources = [r for r in package["resources"] if r.get("format", "").lower() == "csv" and re.search(r"20\d{2}", r["name"])]
        latest = max(resources, key=lambda r: (int(re.search(r"20\d{2}", r["name"])[0]), r.get("last_modified") or r.get("created", "")))
        # The public catalog has stale opendata-test links. The identical resource
        # UUID/path is served by the production CKAN host; record both for audit.
        url = latest["url"].replace("https://opendata-test.arpa.veneto.it/", "https://opendata.arpa.veneto.it/")
        if not url.startswith("https://opendata.arpa.veneto.it/"): raise ValueError("Unexpected ARPAV resource host")
        raw = urlopen(url, timeout=60).read()
        if b'<html' in raw[:500].lower(): raise ValueError("ARPAV returned HTML instead of CSV")
        (CACHE / (kind + ".csv")).write_bytes(raw)
        sources.append({"id": kind, "file": kind + ".csv", "sourceUrl": "https://opendata.arpa.veneto.it/dataset/" + slug,
            "catalogUrl": CATALOG + slug, "catalogDownloadUrl": latest["url"], "downloadUrl": url,
            "edition": latest["name"].strip(), "license": "CC BY", "sha256": hashlib.sha256(raw).hexdigest(),
            "verifiedAt": datetime.now(timezone.utc).isoformat()})
    (CACHE / "sources.json").write_text(json.dumps(sources, indent=2), "utf-8")


def build():
    sources = json.loads((CACHE / "sources.json").read_text("utf-8"))
    out = {}; audit = Counter()
    for source in sources:
        kind = source["id"]; turbidity = kind == "turbidity-samples"
        raw = (CACHE / source["file"]).read_bytes()
        if hashlib.sha256(raw).hexdigest() != source["sha256"]: raise ValueError("ARPAV checksum mismatch")
        try: content = raw.decode("utf-8-sig")
        except UnicodeDecodeError: content = raw.decode("cp1252")
        rows = csv.DictReader(io.StringIO(content))
        features = {}
        for r in rows:
            v = text(r.get("Torbidita' (FTU)" if turbidity else "Solidi sospesi (mg/l)"))
            n = numeric(v.lstrip("< "))
            if n is None: continue
            try:
                when = datetime.strptime(r["Data" if turbidity else "DATA PRELIEVO"], "%d/%m/%Y").date()
                if when > datetime.now(timezone.utc).date(): continue
                depth = float(r.get("Quota misura", r.get("Quota misura (m)", "")) if turbidity else r["PROFONDITA' PRELIEVO (m dalla superficie)"])
                if turbidity and abs(depth) > 1: continue
                east = r.get("LongGBO", r.get("Longitudine_GBO")) if turbidity else r["GAUSS BOAGA OVEST X"]
                north = r.get("Lat GBO", r.get("Latitudine_GBO")) if turbidity else r["GAUSS BOAGA OVEST Y"]
                lon, lat = TRANSFORM.transform(float(east.replace(" ", "")), float(north.replace(" ", "")))
                if not 11 < lon < 14 or not 44 < lat < 46: raise ValueError("coordinate outside Veneto coast")
            except (ValueError, KeyError, TypeError):
                audit["invalid_date_coordinate_or_depth"] += 1; continue
            station = text(r["Cod_Naz" if turbidity else "COD STAZ"])
            identity = f"arpav-{kind}-{station}-{when.isoformat()}"
            if not turbidity: identity += f"-{depth:g}"
            # Select an actual observation nearest the surface, never an invented mean.
            if identity in features and features[identity]["properties"]["depth"] <= abs(depth): continue
            features[identity] = {"type": "Feature", "id": identity, "geometry": {"type": "Point", "coordinates": [round(lon, 7), round(lat, 7)]},
                "properties": {"id": identity, "title": "Stazione ARPAV " + station if turbidity else text(r["STAZIONE"]),
                    "station": station, "observedAt": when.isoformat(), "country": "Italia", "region": "Veneto", "provider": "ARPAV",
                    "originator": "ARPAV · monitoraggio acque marino-costiere", "sourceUrl": source["sourceUrl"],
                    "method": "Sonda multiparametrica" if turbidity else "Analisi di campione d’acqua",
                    "details": f"Profondità: {abs(depth):g} m. " + ("Misura più vicina alla superficie entro 1 m per stazione e giorno. FTU mantenute come dichiarate, senza conversione in FNU satellitari. " if turbidity else "Solidi sospesi misurati in laboratorio, distinti dalla stima satellitare. ") + "Coordinate convertite da Gauss-Boaga Ovest (EPSG:3003) a WGS84.",
                    "depth": abs(depth), "measurements": [{"name": "Torbidità misurata" if turbidity else "Solidi sospesi misurati",
                        "value": n, "unit": "FTU" if turbidity else "mg/L", "qualifier": "<" if v.startswith("<") else ""}]}}
        if not features: raise ValueError("No valid ARPAV measurements for " + kind)
        newest = max(f["properties"]["observedAt"][:4] for f in features.values())
        out[kind] = sorted([f for f in features.values() if f["properties"]["observedAt"].startswith(newest)], key=lambda f: f["id"])
    return out, {"archives": sources, "excluded": dict(audit), "coverage": {k: {"Veneto": len(v)} for k, v in out.items()}}
