import frappe
import json
import datetime


@frappe.whitelist()
def get_guest_booking_details(full_name):
    if not full_name:
        return {"error": "Guest name is required"}

    try:
        guest_id = full_name
        if " : " in full_name:
            guest_id = full_name.split(" : ")[0].strip()

        so = frappe.get_all(
            "Sales Order",
            filters={"custom_guest_id": guest_id},
            fields=[
                "name",
                "transaction_date",
                "delivery_date",
                "custom_number_of_guests",
                "customer_name",
            ],
            order_by="creation desc",
            limit=1,
        )

        if not so:
            return {"error": "No booking found", "guest_id": guest_id}

        so_data = so[0]

        # Fetch first item from Sales Order where item group is "Room"
        room_type = None
        items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": so_data.name},
            fields=["item_code", "item_group"],
            order_by="idx asc",
            limit_page_length=10
        )
        
        # Find first item with item group "Room"
        for item in items:
            if item.get("item_group") == "Room":
                room_type = item.get("item_code")
                break

        nationality = None
        guest_full_name = guest_id
        try:
            guest_doc = frappe.get_doc("Guest", guest_id)
            nationality = guest_doc.nationality
            guest_full_name = guest_doc.full_name or guest_id
        except Exception:
            pass

        return {
            "booking_name": so_data.name,
            "from_date": so_data.transaction_date,
            "to_date": so_data.delivery_date,
            "no_of_guests": so_data.custom_number_of_guests,
            "room_type": room_type,
            "nationality": nationality,
            "guest_id": guest_id,
            "guest_display": f"{guest_id} : {guest_full_name}",
        }

    except Exception as e:
        frappe.log_error(str(e), "Guest Booking Fetch Error")
        return {"error": str(e)}


@frappe.whitelist()
def create_guest_onboarding(data):


    if isinstance(data, str):
        data = json.loads(data)
    data = frappe._dict(data)

    if not data.get("sales_order"):
        frappe.throw("Sales Order is required for Guest Onboarding")
    def normalize_time(val, default):
        if not val:
            return default
        return val if len(val.split(":")) == 3 else val + ":00"

    guest_id = data.guest
    if " : " in guest_id:
        guest_id = guest_id.split(" : ")[0].strip()

    doc = frappe.new_doc("Guest Onboarding")

    # ---------------- MAIN DATA ----------------
    doc.guest = guest_id
    doc.from_date = data.from_date
    doc.to_date = data.to_date
    doc.no_of_guests = data.no_of_guests
    doc.nationality = data.nationality
    doc.id_proof_type = data.id_proof_type
    doc.id_proof_number = data.id_proof_number
    doc.passport_number = data.passport_number
    doc.visa_number = data.visa_number
    doc.room_type = data.room_type
    doc.room_number = data.room_number
    doc.rfid_card_no = data.rfid_card_no
    doc.check_in_time = normalize_time(data.get("check_in_time"), "14:00:00")
    doc.check_out_time = normalize_time(data.get("check_out_time"), "11:00:00")
    doc.guest_photo = data.get("guest_photo")

    # 🔗 SALES ORDER LINK (NORMAL FIELD)
    doc.sales_order = data.get("sales_order")

    # 🔗 DYNAMIC LINK (FOR CONNECTIONS TAB)
    if data.get("sales_order"):
        doc.reference_doctype = "Sales Order"
        doc.reference_name = data.get("sales_order")

    # ---------------- ROOMMATES ----------------
    for r in data.get("roommates", []):
        roommate_id = r.get("full_name", "")
        if " : " in roommate_id:
            roommate_id = roommate_id.split(" : ")[0].strip()

        doc.append(
            "roommates",
            {
                "guest": roommate_id,
                "date_of_birth": r.get("date_of_birth"),
                "from_date": r.get("from_date"),
                "to_date": r.get("to_date"),
                "no_of_guests": 1,
                "nationality": r.get("nationality"),
                "id_proof_type": r.get("id_proof_type"),
                "id_proof_number": r.get("id_proof_number"),
                "passport_number": r.get("passport_number"),
                "visa_number": r.get("visa_number"),
                "user_photo": r.get("user_photo"),
                "room_type": r.get("room_type"),
                "room_number": r.get("room_number"),
                "rfid_card_no": r.get("rfid_card_no"),
                "check_in_time": normalize_time(r.get("check_in_time"), "14:00:00"),
                "check_out_time": normalize_time(r.get("check_out_time"), "11:00:00"),
            },
        )

    doc.insert(ignore_permissions=True)

    # ---------------- UPDATE SALES ORDER ----------------
    if data.get("sales_order"):
        so_doc = frappe.get_doc("Sales Order", data.get("sales_order"))
        so_doc.custom_guest_onboarding_id = doc.name
        so_doc.save(ignore_permissions=True)

    frappe.db.commit()
    return doc.name