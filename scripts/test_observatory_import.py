"""Scientific import regressions: python -m unittest discover -s scripts -p test_observatory_import.py"""
import io
import unittest
from collections import Counter

import openpyxl
from ispra_observatory import Workbook, beaches, chemicals, micro, numeric, position, region


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


if __name__ == '__main__': unittest.main()
