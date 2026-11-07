import unittest
from ocr_fields import parse_official_form_fields, parse_date

class OcrParserTests(unittest.TestCase):
    def test_baptism_form(self):
        source = '''IGLESIA FILIPINA INDEPENDIENTE
Name of Child: Joshua Garcia Santos
Date of Baptism: October 12, 2018
Date of Birth: 13/04/2018
Place of Birth: Maragondon, Cavite
Name of Father: Ramon Santos
Name of Mother: Teresa Garcia
Sponsors: Anna Cruz; Leo Ramos
Parish: IFI Maragondon'''
        result = parse_official_form_fields(source, 'baptismal')
        self.assertEqual(result['recordData']['child_name'], 'Joshua Garcia Santos')
        self.assertEqual(result['recordData']['date_of_baptism'], '2018-10-12')
        self.assertEqual(result['recordData']['date_of_birth'], '2018-04-13')
        self.assertEqual(result['recordData']['sponsors'], ['Anna Cruz', 'Leo Ramos'])
        self.assertEqual(result['archiveFields']['person_name'], 'Joshua Garcia Santos')

    def test_ambiguous_date_remains_unset(self):
        self.assertEqual(parse_date('03/04/2022'), '')
        result = parse_official_form_fields('Date of Confirmation: 03/04/2022\nName of Child: Ana Reyes', 'confirmation')
        self.assertNotIn('date_of_confirmation', result['recordData'])
        self.assertIn('child_name', result['recordData'])

    def test_marriage(self):
        result = parse_official_form_fields('Name of Husband: Jose Dela Cruz\nName of Wife: Maria Reyes\nDate of Marriage: 2022-11-06', 'marriage')
        self.assertEqual(result['recordData']['wife']['last_name'], 'Reyes')
        self.assertEqual(result['archiveFields']['date_of_record'], '2022-11-06')

if __name__ == '__main__':
    unittest.main()
