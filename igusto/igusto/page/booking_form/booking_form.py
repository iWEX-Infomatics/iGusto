import frappe, json
from frappe.utils import nowdate

@frappe.whitelist(allow_guest=True)
def create_booking(data):
    if isinstance(data, str):
        data = json.loads(data)
    data = frappe._dict(data)

    try:
        # Create Booking with booking_date field added
        doc = frappe.get_doc({
            "doctype": "Booking",
            "booking_date": nowdate(),  # ✅ auto fill today's date
            "guest": data.get("guest_name"),
            "check_in": data.get("check_in"),
            "check_out": data.get("check_out"),
            "room_type": data.get("room_type"),
            "booking_source": data.get("booking_source"),
            "advance_payment": data.get("advance_amount") or 0,
            "status": "Pending Confirmation"
        })
        doc.insert(ignore_permissions=True)
        frappe.db.commit()

        return doc.name  # Return Booking ID

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Booking Form Error")
        return f"error: {str(e)}"
