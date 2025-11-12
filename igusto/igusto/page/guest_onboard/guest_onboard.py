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

    #  Save onboarding
    doc.insert(ignore_permissions=True)

    # Update Room status, guest, and RFID
    if data.room_number:
        frappe.db.set_value("Room", data.room_number, {
            "status": "Occupied",
            "current_guest": data.guest,
            "rfid_key": data.rfid_card_no
        })

        # --- Find matching Sales Order for this guest ---
        guest_doc = frappe.get_doc("Guest", data.guest)
        guest_name = " ".join(filter(None, [guest_doc.first_name, guest_doc.middle_name, guest_doc.last_name]))

        # Search Sales Order linked with this guest
        so_name = frappe.db.get_value("Sales Order", {"customer_name": guest_name}, "name")

        # If found, set it as current_booking in Room
        if so_name:
            frappe.db.set_value("Room", data.room_number, "current_booking", so_name)
            frappe.logger().info(f"Room {data.room_number} linked with Sales Order {so_name} for guest {guest_name}")



    frappe.db.commit()
    return doc.name
