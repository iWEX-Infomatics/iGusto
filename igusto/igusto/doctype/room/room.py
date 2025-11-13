import frappe
import qrcode
import base64
from io import BytesIO
from frappe.model.document import Document

class Room(Document):
    def after_insert(self):
        generate_room_qr(self.name)

@frappe.whitelist()
def generate_room_qr(room_name):
    """Generate and return a base64 QR Code (not stored in DB)."""
    base_url = frappe.utils.get_url()
    qr_target_url = f"{base_url}/app/room-order?room_id={room_name}"

    qr = qrcode.make(qr_target_url)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return qr_base64
