"""Isolated route-contract tests: no network, no database, no Flask import."""
import ast
import pathlib
import unittest
from types import SimpleNamespace
from unittest.mock import Mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = (ROOT / "church_backend" / "server.py").read_text(encoding="utf-8")


def isolated_endpoint():
    tree = ast.parse(SOURCE)
    function = next(node for node in tree.body
                    if isinstance(node, ast.FunctionDef)
                    and node.name == "api_user_available_cemetery_slots")
    function.decorator_list = []
    code = compile(ast.Module(body=[function], type_ignores=[]), "server.py", "exec")
    slots = [SimpleNamespace(id=3, slot_code="B-7", section="A", block="2",
                             lot_number="7", lot_type="LAWN_LOT", map_label="Grid A2",
                             rights_holder_name="PRIVATE NAME", rights_holder_contact="PRIVATE PHONE")]
    query = Mock()
    query.filter_by.return_value = query
    query.order_by.return_value = query
    query.all.return_value = slots
    slot_cls = SimpleNamespace(query=query, section=object(), block=object(), lot_number=object())
    scope = {"require_roles": lambda *roles: None, "CemeterySlot": slot_cls}
    exec(code, scope)
    return scope, query


class AvailableLotsTests(unittest.TestCase):
    def test_only_available_active_lots_are_queried(self):
        scope, query = isolated_endpoint()
        payload, status = scope["api_user_available_cemetery_slots"]()
        self.assertEqual(status, 200)
        query.filter_by.assert_called_once_with(active=True, status="AVAILABLE")
        self.assertEqual(payload["slots"][0]["slotCode"], "B-7")

    def test_private_burial_details_are_not_exposed(self):
        scope, _ = isolated_endpoint()
        payload, _ = scope["api_user_available_cemetery_slots"]()
        serialized = payload["slots"][0]
        for private in ("rightsHolderName", "rightsHolderContact", "rights_holder_name", "rights_holder_contact", "notes", "burials"):
            self.assertNotIn(private, serialized)

    def test_authentication_guard_rejects_other_roles(self):
        scope, query = isolated_endpoint()
        scope["require_roles"] = lambda *roles: ({"error": "Forbidden"}, 403)
        self.assertEqual(scope["api_user_available_cemetery_slots"]()[1], 403)
        query.filter_by.assert_not_called()

    def test_land_request_rechecks_selected_slot_on_server(self):
        self.assertIn('if sacrament_type == "land_agreement":', SOURCE)
        self.assertIn('data.get("cemeterySlotId")', SOURCE)
        self.assertIn('selected_slot.status != "AVAILABLE"', SOURCE)
        self.assertIn('selected_slot.slot_code', SOURCE)

    def test_frontend_sends_selected_slot_not_user_supplied_status(self):
        tsx = (ROOT / "src/app/dashboard/components/RequestsPage.tsx").read_text(encoding="utf-8")
        self.assertIn('/api/backend/api/user/cemetery/available-slots', tsx)
        self.assertIn("cemeterySlotId: activeType === 'Land Agreement' ? selectedSlotId : undefined", tsx)

if __name__ == "__main__":
    unittest.main()
