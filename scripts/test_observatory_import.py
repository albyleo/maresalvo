"""Scientific import regressions: python -m unittest discover -s scripts -p test_observatory_import.py"""
import io
import importlib.util
import json
import tempfile
import csv
import hashlib
import unittest
from collections import Counter
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError

import openpyxl
from ispra_observatory import Workbook, beaches, chemicals, micro, numeric, position, region
import regional_observatory as regional

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
        regional_download = self.enterContext(patch.object(sync.regional_observatory, 'download'))
        self.enterContext(patch.object(sync.ispra_observatory, "build", return_value=({}, {})))
        self.enterContext(patch.object(sync.arpav_observatory, "build", return_value=({}, {})))
        self.enterContext(patch.object(sync.regional_observatory, 'build', return_value=({}, {})))
        for name in sync.SOURCES:
            self.enterContext(patch.object(sync, name, return_value=[sync.feature(name, 17, 40, "Test", "2024-01-01", [])]))
        sync.main()
        ispra_download.assert_called_once()
        arpav_download.assert_called_once()
        regional_download.assert_called_once()
        self.assertEqual(json.loads((sync.DEST / "discharges.json").read_text("utf-8")), self.previous)
        manifest = json.loads((sync.DEST / "manifest.json").read_text("utf-8"))
        self.assertEqual(manifest["discharges"], self.previous["metadata"])
        self.assertEqual(manifest["beach"]["count"], 1)


class RegionalTests(unittest.TestCase):
    def source(self, region, key=regional.TUR):
        return {'region': region, 'provider': 'Test ' + region, 'id': key, 'edition': 'Test',
                'sourceUrl': 'https://example.org/data', 'license': 'Test', 'verifiedAt': '2026-11-26'}

    def test_campania_surface_selection_zero_missing_and_latest_year(self):
        rows = [{'Cod. Stazione': 'S1', 'Nome stazione': 'Test', 'Lat.N': '41,1', 'Long.E': '13,8',
                 'Profondita': depth, 'Torbidita FTU': value, 'Data Campionamento': when}
                for depth, value, when in [('-1', '5', '01-01-2025'), ('-0,5', '0', '01-01-2025'),
                                          ('-2', '8', '01-01-2025'), ('-0,5', '2', '01-01-2024'),
                                          ('-0,5', 'n.r.', '02-01-2025'), ('-0,5', '2', '01-01-2099')]]
        raw = io.StringIO(); writer = csv.DictWriter(raw, fieldnames=list(rows[0])); writer.writeheader(); writer.writerows(rows)
        result = regional.campania(raw.getvalue().encode(), self.source('Campania'), Counter())
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['properties']['measurements'][0]['value'], 0)
        self.assertEqual(result[0]['properties']['depth'], .5)
        self.assertEqual(result[0]['properties']['observedAt'], '2025-01-01')

    def test_lazio_preserves_unit_qualifier_samples_and_requires_coordinates(self):
        row = {'rif_campione': 'a', 'rt_data_ora_prelievo': '2025-02-03 10:00:00+01',
               'parametro': 'Torbidità', 'unita_misura_descrizione': 'NTU', 'segno_valore': '<',
               'valore_an': '0.1', 'revisione': 0, 'cod_ulia_figlia': 'M4/0', 'stazione': 'Test', 'tot_row': 3}
        rows = [row, {**row, 'revisione': 1, 'valore_an': '0.2'}, {**row, 'rif_campione': 'b'}]
        raw = json.dumps({'aRisultati': rows})
        fs = regional.lazio(raw, {'M4/0': (12, 42)}, self.source('Lazio'), Counter())
        self.assertEqual(len(fs), 2)
        self.assertEqual(fs[0]['properties']['measurements'][0], {'name': 'Torbidità misurata', 'value': .2, 'unit': 'NTU', 'qualifier': '<'})
        self.assertNotIn('depth', fs[0]['properties'])
        with self.assertRaises(ValueError): regional.lazio(raw, {}, self.source('Lazio'), Counter())
        with self.assertRaises(ValueError): regional.lazio(json.dumps({'aRisultati': [row]}), {'M4/0': (12, 42)}, self.source('Lazio'), Counter())

    def test_report_transcription_preserves_limit_and_exact_coordinates(self):
        fs = regional.toscana(self.source('Toscana', regional.SPM))
        self.assertEqual(len(fs), 9)
        self.assertEqual(fs[-1]['properties']['measurements'][0]['qualifier'], '<')
        self.assertEqual(fs[-1]['properties']['measurements'][0]['value'], 2.5)
        self.assertAlmostEqual(fs[0]['geometry']['coordinates'][1], 43 + 53.072/60, places=6)
        self.assertNotIn('depth', fs[0]['properties'])

    def test_abruzzo_does_not_map_unknown_offshore_coordinates_or_treat_distance_as_depth(self):
        audit = Counter()
        fs = regional.abruzzo(self.source('Abruzzo', regional.SPM), audit)
        self.assertEqual(len(fs), 108)
        self.assertEqual(len(set(f['properties']['station'] for f in fs)), 27)
        self.assertEqual(audit['abruzzo_measurements_without_official_coordinates'], 6)
        self.assertTrue(all('depth' not in f['properties'] for f in fs))
        self.assertTrue(any(f['properties']['measurements'][0]['qualifier'] == '<' for f in fs))

    def test_mixed_campaign_metadata_does_not_hide_older_region(self):
        s1 = self.source('Toscana', regional.SPM); s2 = self.source('Veneto', regional.SPM)
        fs = regional.toscana(s1)
        veneto = json.loads(json.dumps(fs[0])); veneto['id'] = 'veneto'; veneto['properties'].update(
            id='veneto', region='Veneto', provider=s2['provider'], observedAt='2025-01-01')
        data = sync.field_collections({regional.SPM: fs + [veneto]}, [s1, s2])[regional.SPM]
        self.assertEqual(data['metadata']['years'], ['2025', '2024'])
        self.assertEqual(data['metadata']['count'], 10)
        self.assertEqual(len(data['metadata']['regionalCoverage']), 15)
        self.assertEqual(sum(c['count'] for c in data['metadata']['regionalCoverage']), 10)

    def test_field_only_keeps_other_datasets_and_metadata_unchanged(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(sync, 'DEST', Path(folder)), patch.object(sync, 'CACHE', Path(folder)), patch('sys.argv', ['sync-observatory.py', '--field-only', '--offline']):
            source = self.source('Toscana', regional.SPM)
            (sync.DEST / 'manifest.json').write_text(json.dumps({'discharges': {'verifiedAt': 'old'}}))
            (sync.DEST / 'italian-sources.json').write_text(json.dumps({'ispra': {'untouched': True}}))
            target = sync.DEST / 'discharges.json'; target.write_bytes(b'unchanged')
            with patch.object(sync.arpav_observatory, 'build', return_value=({}, {'archives': []})), patch.object(sync.regional_observatory, 'build', return_value=({regional.SPM: regional.toscana(source)}, {'archives': [source]})), patch.object(sync.regional_observatory, 'download') as network:
                sync.main()
            network.assert_not_called()
            self.assertEqual(target.read_bytes(), b'unchanged')
            self.assertEqual(json.loads((sync.DEST / 'manifest.json').read_text())['discharges'], {'verifiedAt': 'old'})
            self.assertEqual(json.loads((sync.DEST / 'italian-sources.json').read_text())['ispra'], {'untouched': True})

    def test_changed_report_bytes_cannot_use_old_transcription(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(regional, 'CACHE', Path(folder)):
            source = {**self.source('Toscana', regional.SPM), 'file': 'report.pdf', 'sha256': hashlib.sha256(b'changed').hexdigest()}
            (regional.CACHE / 'sources.json').write_text(json.dumps([source, {'region': 'Campania'}, {'region': 'Lazio'}, {'region': 'Abruzzo'}]))
            (regional.CACHE / 'report.pdf').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'Rapporto ARPAT non revisionato'): regional.build()

    def test_failed_regional_refresh_preserves_values_and_verification_date(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(regional, 'PUBLISHED', Path(folder)):
            source = self.source('Toscana', regional.SPM)
            source['verifiedAt'] = '2026-11-20T12:00:00+00:00'
            fs = regional.toscana(source)
            path = Path(folder) / (regional.SPM + '.json')
            path.write_text(json.dumps({'metadata': {'additionalSources': [source]}, 'features': fs}), 'utf-8')
            retained = regional.retained_source('Toscana', TimeoutError('offline'))
            self.assertEqual(retained['verifiedAt'], source['verifiedAt'])
            self.assertEqual(regional.retained_features(retained), fs)
            meta = sync.field_collections({regional.SPM: fs}, [retained])[regional.SPM]['metadata']
            self.assertEqual(meta['sources'][0]['syncStatus'], 'retained')
            self.assertEqual(meta['sources'][0]['verifiedAt'], source['verifiedAt'])

    def test_arpav_outage_retains_both_previous_collections(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(sync, 'DEST', Path(folder)), patch.object(sync.arpav_observatory, 'download', side_effect=TimeoutError('offline')):
            for kind in sync.arpav_observatory.PACKAGES:
                source = {**self.source('Veneto', kind), 'provider': 'ARPAV', 'verifiedAt': '2026-11-20'}
                feature = {'id': kind, 'properties': {'provider': 'ARPAV', 'observedAt': '2025-01-01'}}
                (Path(folder) / (kind + '.json')).write_text(json.dumps({'metadata': {'additionalSources': [source]}, 'features': [feature]}))
            data, report = sync.arpav_collection()
            self.assertEqual(set(data), set(sync.arpav_observatory.PACKAGES))
            self.assertTrue(all(s['retained'] and s['verifiedAt'] == '2026-11-20' for s in report['archives']))
            self.assertTrue(all(fs[0]['properties']['observedAt'] == '2025-01-01' for fs in data.values()))


if __name__ == '__main__': unittest.main()
