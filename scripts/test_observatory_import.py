"""Scientific import regressions: python -m unittest discover -s scripts -p test_observatory_import.py"""
import io
import importlib.util
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError

import openpyxl
from ispra_observatory import Workbook, beaches, chemicals, micro, numeric, position, region

spec = importlib.util.spec_from_file_location("sync_observatory", Path(__file__).with_name("sync-observatory.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class Tables:
    def __init__(self, **sheets): self.sheets = sheets; self.names = list(sheets)
    def rows(self, name): return iter(self.sheets.get(name, []))


STATION = {"NationalStationID": "S1", "NationalStationName": "Test", "Region": "Puglia", "Latitude": 40.3, "Longitude": 17.2}


class ImportTests(unittest.TestCase):
    def test_coordinates_and_missing_values_are_not_invented(self):
        self.assertEqual(region(15), "Campania")
        self.assertEqual(numeric("0"), 0)
        self.assertIsNone(numeric("9999"))
        self.assertIsNone(numeric("nan"))
        self.assertIsNone(position({**STATION, "Longitude": 40.3, "Latitude": 17.2}))

    def test_micro_density_and_sampling_dates(self):
        common = {"NationalStationID": "S1", "Year": 2024, "Month": 4, "Day": 2}
        w = Tables(Stazioni=[STATION], MicroplasticheRet=[common], MicroplasticheCamp=[
            {**common, "Forma": "frammento", "Colore": "blu", "Num_oggetti": 0},
            {**common, "Forma": "fibra", "Num_oggetti": 0.25},
            {**common, "Year": 2025, "Num_oggetti": 1}])
        audit = Counter(); fs = micro(w, "a.zip", "b.xls", audit)
        self.assertEqual(len(fs), 1)
        self.assertEqual([m['value'] for m in fs[0]['properties']['measurements']], [0, 0.25])
        self.assertEqual(fs[0]['properties']['measurements'][1]['unit'], "oggetti / m²")
        self.assertEqual(audit['micro_date_disagrees_with_sampling_sheet'], 1)

    def test_quantification_limit_is_not_half_limit(self):
        row = {"NationalStationID": "S1", "Year": 2024, "Month": 4, "Day": 2, "CASNumber": "7440-43-9",
               "Concentration": 0.025, "LOQ": 0.05, "LOD_LOQ_Flag": "<", "Unit_HazSubs": "mg/kg"}
        fs = chemicals(Tables(Stazioni=[STATION], Contaminanti=[row]), 'Modulo_D8_sedimenti.zip', 'a.xlsx', Counter())
        self.assertEqual(fs[0]['properties']['measurements'][0]['value'], 0.05)
        self.assertEqual(fs[0]['properties']['measurements'][0]['qualifier'], '<')
        self.assertEqual(chemicals(Tables(Stazioni=[STATION], Contaminanti=[{**row, 'LOQ': None}]), 'sedimenti.zip', 'a.xlsx', Counter()), [])
        self.assertEqual(chemicals(Tables(Stazioni=[STATION], Contaminanti=[{**row, 'LOD_LOQ_Flag': '['}]), 'sedimenti.zip', 'a.xlsx', Counter()), [])

    def test_bottle_absence_is_unknown_and_caps_are_not_bottles(self):
        station = {"CodiceSpiaggia": "B1", "NomeSpiaggia": "Test", "Regione": "Puglia", "Latitudine": 40.3, "Longitudine": 17.2}
        sample = {"CodiceCampionamento": "C1", "CodiceSpiaggia": "B1", "Anno": 2024, "Mese": 4, "Giorno": 2, "LunghezzaTransetto": 50}
        records = [{"CodiceCampionamento": "C1", "JointListCategory": "J21", "NumeroOggetti": 10}]
        w = Tables(Spiaggia=[station], SpiaggiaCamp=[sample], RifiutiCamp=records)
        p = beaches(w, 'a.zip', 'a.xls', Counter())[0]['properties']
        self.assertIsNone(p['bottles']); self.assertEqual(p['measurements'][1]['value'], 20)
        records.append({"CodiceCampionamento": "C1", "JointListCategory": "J7", "NumeroOggetti": 0})
        self.assertEqual(beaches(w, 'a.zip', 'a.xls', Counter())[0]['properties']['bottles'], 0)

    def test_xlsx_reader_preserves_sparse_columns_and_skips_formatted_empty_rows(self):
        w = openpyxl.Workbook(); s = w.active; s.title = 'Stazioni'
        s.append(['NationalStationID', 'unused', 'Region', 'Latitude', 'Longitude'])
        s.append(['S1', None, 'Puglia', 40.3, 17.2]); s.cell(5000, 5).number_format = '0.000'
        raw = io.BytesIO(); w.save(raw); w.close()
        parsed = Workbook(raw.getvalue(), 'fixture.xlsx')
        try:
            rows = list(parsed.rows('Stazioni'))
            self.assertEqual(len(rows), 1); self.assertEqual(rows[0]['Region'], 'Puglia')
            self.assertEqual(float(rows[0]['Longitude']), 17.2)
        finally: parsed.close()


class DischargeDownloadTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        for name in ("CACHE", "DEST"):
            folder = root / name
            folder.mkdir()
            self.enterContext(patch.object(sync, name, folder))
        self.enterContext(patch.object(sync.time, "sleep"))
        self.enterContext(patch("builtins.print"))
        self.raw = {"type": "FeatureCollection", "features": [{"type": "Feature",
            "geometry": {"type": "Point", "coordinates": [17, 40]},
            "properties": {"dcpCode": "test", "dcpName": "Test", "dcpWaterBodyType": "CW", "dcpState": 1}}]}
        self.previous = {"type": "FeatureCollection", "metadata": {"count": 1,
            "verifiedAt": "2026-11-20T00:00:00+00:00", "year": "2022–2023"}, "features": self.raw["features"]}
        (sync.DEST / "discharges.json").write_text(json.dumps(self.previous), "utf-8")
        self.cache = sync.CACHE / "discharges-data.json"
        self.cache.write_text(json.dumps(self.raw), "utf-8")

    def test_timeout_retains_published_data_dates_and_raw_cache(self):
        before = self.cache.read_bytes(), self.cache.stat().st_mtime_ns
        with patch.object(sync, "urlopen", side_effect=URLError(TimeoutError())) as request:
            self.assertEqual(sync.download_discharges(), self.previous)
        self.assertEqual(request.call_count, 3)
        self.assertEqual((self.cache.read_bytes(), self.cache.stat().st_mtime_ns), before)

    def test_transient_timeout_recovers_with_validated_download(self):
        with patch.object(sync, "urlopen", side_effect=[TimeoutError(), io.BytesIO(json.dumps(self.raw).encode())]) as request:
            self.assertIsNone(sync.download_discharges())
        self.assertEqual(request.call_count, 2)
        self.assertEqual(json.loads(self.cache.read_bytes()), self.raw)

    def test_invalid_or_truncated_response_cannot_replace_cache(self):
        before = self.cache.read_bytes(), self.cache.stat().st_mtime_ns
        for response in [{"error": {"code": 500}}, {**self.raw, "exceededTransferLimit": True},
                         {"type": "FeatureCollection", "features": []}]:
            with self.subTest(response=response), patch.object(sync, "urlopen", return_value=io.BytesIO(json.dumps(response).encode())):
                with self.assertRaises(ValueError):
                    sync.download_discharges()
            self.assertEqual((self.cache.read_bytes(), self.cache.stat().st_mtime_ns), before)

    def test_outage_without_published_snapshot_fails(self):
        (sync.DEST / "discharges.json").unlink()
        with patch.object(sync, "urlopen", side_effect=TimeoutError()):
            with self.assertRaises(RuntimeError):
                sync.download_discharges()

    def test_partial_sync_continues_other_sources_and_preserves_eea_metadata(self):
        self.enterContext(patch("sys.argv", ["sync-observatory.py"]))
        self.enterContext(patch.object(sync, "urlopen", side_effect=lambda *a, **kw: io.BytesIO(b"fixture")))
        self.enterContext(patch.object(sync, "download_discharges", return_value=self.previous))
        ispra_download = self.enterContext(patch.object(sync.ispra_observatory, "download"))
        arpav_download = self.enterContext(patch.object(sync.arpav_observatory, "download"))
        self.enterContext(patch.object(sync.ispra_observatory, "build", return_value=({}, {})))
        self.enterContext(patch.object(sync.arpav_observatory, "build", return_value=({}, {})))
        for name in sync.SOURCES:
            self.enterContext(patch.object(sync, name, return_value=[sync.feature(name, 17, 40, "Test", "2024-01-01", [])]))
        sync.main()
        ispra_download.assert_called_once()
        arpav_download.assert_called_once()
        self.assertEqual(json.loads((sync.DEST / "discharges.json").read_text("utf-8")), self.previous)
        manifest = json.loads((sync.DEST / "manifest.json").read_text("utf-8"))
        self.assertEqual(manifest["discharges"], self.previous["metadata"])
        self.assertEqual(manifest["beach"]["count"], 1)


if __name__ == '__main__': unittest.main()
