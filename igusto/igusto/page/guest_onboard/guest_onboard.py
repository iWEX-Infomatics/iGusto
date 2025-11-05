import frappe
import json

@frappe.whitelist()
def create_guest_onboarding(data):
    """Create Guest Onboarding record"""
    if isinstance(data, str):
        data = json.loads(data)
    data = frappe._dict(data)

    def normalize_time(value, default):
        if not value:
            return default
        if len(value.split(":")) == 2:
            return value + ":00"
        return value

    check_in_time = normalize_time(data.get("check_in_time"), "14:00:00")
    check_out_time = normalize_time(data.get("check_out_time"), "11:00:00")

    doc = frappe.new_doc("Guest Onboarding")
    doc.guest = data.guest
    doc.from_date = data.from_date
    doc.to_date = data.to_date
    doc.no_of_guests = data.no_of_guests
    doc.nationality = data.nationality
    doc.passport_number = data.passport_number
    doc.visa_number = data.visa_number
    doc.id_proof_type = data.id_proof_type
    doc.id_proof_number = data.id_proof_number
    doc.guest_photo = data.get("guest_photo")
    doc.room_type = data.room_type
    doc.room_number = data.room_number
    doc.rfid_card_no = data.rfid_card_no
    doc.check_in_time = check_in_time
    doc.check_out_time = check_out_time

    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name
