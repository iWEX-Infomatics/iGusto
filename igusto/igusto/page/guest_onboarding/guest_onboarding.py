import frappe, json

@frappe.whitelist()
def create_guest(data):
    """Create Guest + Guest Registration entries"""
    if isinstance(data, str):
        data = json.loads(data)

    # Step 1: Create Guest entry
    guest_doc = frappe.get_doc({
        "doctype": "Guest",
        "full_name": data.get("full_name"),
        "email": data.get("email"),
        "primary_contact": data.get("primary_contact"),
        "nationality": data.get("nationality"),
        "id_proof_type": data.get("id_proof_type"),
        "id_proof_number": data.get("id_proof_number"),
        "address": data.get("address")
    })
    guest_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # Step 2: Create Guest Registration entry
    registration_doc = frappe.get_doc({
        "doctype": "Guest Registration",
        "registration_date": frappe.utils.nowdate(),
        "guest": guest_doc.name,
        "check_in": frappe.utils.now(),  # current datetime for check-in
        "check_out": None,
        "room_type": "",
        "status": "Checked In"
    })
    registration_doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "guest_id": guest_doc.name,
        "registration_id": registration_doc.name,
        "message": f"Guest '{guest_doc.full_name}' and registration created successfully."
    }
