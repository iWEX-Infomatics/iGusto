import frappe
import qrcode
import base64
from io import BytesIO
from frappe.model.document import Document

class Room(Document):
    def after_insert(self):
        # Generate QR right after the document is created
        generate_room_qr(self.name)

    def on_update(self):
        # Also regenerate if updated
        generate_room_qr(self.name)


@frappe.whitelist()
def generate_room_qr(room_name):
    """Generate QR Code and save HTML to room_id field"""
    base_url = frappe.utils.get_url()
    qr_target_url = f"{base_url}/app/room-order?room_id={room_name}"

    # Generate QR image
    qr = qrcode.make(qr_target_url)
    buffer = BytesIO()
    qr.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    qr_img_tag = f'''
        <img src="data:image/png;base64,{qr_base64}"
             width="200" height="200"
             style="border:1px solid #ccc; border-radius:10px; padding:6px; background:#fafafa;">
    '''

    html = f"""
        <div style="text-align:center; margin-top:10px;">
            {qr_img_tag}
            <div style="margin-top:8px;">
                <a href="{qr_target_url}" target="_blank"
                   style="color:#007bff; text-decoration:none; font-weight:500;">
               </a>
            </div>
        </div>
    """

    #  Save HTML in a custom field (like room_qr_html)
    frappe.db.set_value("Room", room_name, "room_id", html)
    return html
