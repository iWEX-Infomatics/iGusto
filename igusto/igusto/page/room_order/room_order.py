import frappe
import json
from frappe.utils import now_datetime, nowdate

@frappe.whitelist()
def get_menu_items():
    """Fetch active items from Item doctype."""
    items = frappe.get_all(
        "Item",
        fields=["name", "item_name"],
        filters={"disabled": 0},
        order_by="item_name asc"
    )
    return items


@frappe.whitelist()
def get_service_items():
    """Return static room service options."""
    return ["Towel Change", "Cleaning", "Extra Pillow"]


@frappe.whitelist()
def get_spa_items():
    """Static spa service options (checkbox style)."""
    return ["Body Massage", "Head Massage", "Foot Spa", "Sauna", "Facial Therapy"]


@frappe.whitelist()
def get_laundry_items():
    return ["Clothes Wash", "Ironing", "Dry Clean", "Fold & Pack"]


@frappe.whitelist()
def get_transport_items():
    return ["Airport Pickup", "Airport Drop", "City Tour", "Cab on Call"]


@frappe.whitelist()
def get_room_numbers():
    """
    Return a list of room_number values from Guest Onboarding doctype.
    Assumes Guest Onboarding doctype has field `room_number`.
    """
    try:
        rows = frappe.get_all("Guest Onboarding", fields=["room_number"], filters={"room_number": ["!=", ""]}, order_by="room_number asc")
        return [r.room_number for r in rows]
    except Exception:
        # fallback: return empty list if doctype not present
        return []


@frappe.whitelist()
def get_guest_by_room(room_number):
    """
    Return guest (name) for given room_number from Guest Onboarding.
    Assumes Guest Onboarding has `guest` field which may be Guest ID or guest name.
    """
    if not room_number:
        return None
    guest = frappe.db.get_value("Guest Onboarding", {"room_number": room_number}, "guest")
    # if stored guest is a Link to Guest doctype, try to fetch full_name
    if guest and frappe.db.exists("Guest", guest):
        full_name = frappe.db.get_value("Guest", guest, "full_name")
        return full_name or guest
    return guest


@frappe.whitelist()
def get_item_rate(item_name):
    """
    Return a preview rate for an item_name (by Item.item_name lookup).
    Falls back to 0 if not found.
    """
    if not item_name:
        return 0
    item_code = frappe.db.get_value("Item", {"item_name": item_name}, "name")
    if item_code:
        # common field in custom setups: standard_rate
        rate = frappe.db.get_value("Item", item_code, "standard_rate")
        if rate is None:
            # try other common fields
            rate = frappe.db.get_value("Item", item_code, "last_purchase_rate")
        return rate or 0
    return 0

@frappe.whitelist(allow_guest=True)
def get_company_details():
    company = frappe.get_all(
        "Company",
        fields=["name", "company_description"],
        limit=1
    )
    if not company:
        return {}

    company = company[0]

    # Always use company_description as address
    address_text = (company.get("company_description") or "").strip()

    return {
        "company_name": company.name,  
        "address": address_text, 
        "logo": _get_company_logo(company.name)
    }

def _get_company_logo(company_name):
    file = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": "Company",
            "attached_to_name": company_name,
            "is_private": 0
        },
        fields=["file_url"],
        limit=1
    )
    return file[0].file_url if file else ""

@frappe.whitelist()
def create_room_order(data):
    """
    Create a new Room Order or Task (for Room Service) document with child table entries.
    Auto-sets current date and guest name as room_order_customer.
    """
    try:
        data = json.loads(data)
        service_type = data.get("service_type")

        # Helper: get item_code
        def get_item_code(item_name):
            if not item_name:
                return None
            return frappe.db.get_value("Item", {"item_name": item_name}, "name")

        # Helper: ensure Task Type exists
        def ensure_task_type(task_type_name):
            """Safely create Task Type if it doesn't exist."""
            if not task_type_name:
                return

            # If already exists, no need to create
            if frappe.db.exists("Task Type", task_type_name):
                return

            # Create a new Task Type doc
            tt = frappe.new_doc("Task Type")

            # Try all naming possibilities (covers all ERPNext setups)
            try:
                tt.task_type = task_type_name
            except Exception:
                pass

            try:
                tt.name = task_type_name
            except Exception:
                pass

            try:
                tt.__newname = task_type_name
            except Exception:
                pass

            # Fallback if none of the above fields work
            if not tt.name:
                tt.set("name", task_type_name)

            tt.insert(ignore_permissions=True)

        # ------------------ ROOM SERVICE FLOW ------------------
        if service_type == "Room Service":
            items = data.get("items", [])
            guest = data.get("guest")
            room_no = data.get("room_number")
            delivery_to = data.get("delivery_to")

            created_tasks = []

            # --- Create separate Task for each item ---
            for i in items:
                item_name = i.get("item_name")
                if not item_name:
                    continue

                # Ensure Task Type exists
                ensure_task_type(item_name)

                # Create Task
                task = frappe.new_doc("Task")
                task.subject = f"{item_name} - Room {room_no}"
                task.status = "Open"
                task.task_type = item_name  # ✅ show as Task Type in UI
                task.room_number = room_no
                task.delivery_to = delivery_to

                # Description with details
                task.description = (
                    f"<b>Guest:</b> {guest}<br>"
                    f"<b>Room:</b> {room_no}<br>"
                    f"<b>Requested Service:</b> {service_type}<br>"
                    f"<b>Item:</b> {item_name}<br>"
                )

                task.insert(ignore_permissions=True)
                created_tasks.append(task.name)

            frappe.db.commit()

            # --- Create ONE Sales Order for all items ---
            so = frappe.new_doc("Sales Order")
            so.customer = guest
            so.delivery_date = nowdate()

            for i in items:
                item_code = get_item_code(i.get("item_name"))
                if not item_code:
                    continue
                so.append("items", {
                    "item_code": item_code,
                    "item_name": i.get("item_name"),
                    "qty": i.get("quantity") or i.get("qty") or 1,
                    "rate": i.get("rate") or 0,
                    "description": f"{service_type} - {i.get('custom_remarks') or ''}"
                })

            so.insert(ignore_permissions=True)
            frappe.db.commit()

            return {
                "status": "success",
                "message": f"{len(created_tasks)} Tasks and Sales Order {so.name} created successfully.",
                "tasks": created_tasks,
                "sales_order": so.name
            }

        # ------------------ OTHER SERVICE TYPES ------------------
        room_order = frappe.new_doc("Room Orders")
        room_order.room_number = data.get("room_number")
        room_order.room_order_date = nowdate()
        room_order.room_order_customer = data.get("guest")
        room_order.guest = data.get("guest")
        room_order.delivery_to = data.get("delivery_to")
        room_order.service_type = service_type

        items = data.get("items", [])
        for i in items:
            qty_value = i.get("passengers") or i.get("qty") or 1
            room_order.append("room_order_booking_items", {
                "item": i.get("item_name"),
                "qty": qty_value,
                "rate": i.get("rate") or 0,
                "custom_remarks": i.get("custom_remarks") or "",
                "category": service_type or "General"
            })

        room_order.insert(ignore_permissions=True)
        frappe.db.commit()

        # --- Create Sales Order linked to this Room Order ---
        so = frappe.new_doc("Sales Order")
        so.customer = data.get("guest")
        so.delivery_date = nowdate()

        for i in items:
            item_code = get_item_code(i.get("item_name"))
            if not item_code:
                continue

            so.append("items", {
                "item_code": item_code,
                "item_name": i.get("item_name"),
                "qty": i.get("quantity") or i.get("qty") or 1,
                "rate": i.get("rate") or 0,
                "description": f"{service_type} - {i.get('custom_remarks') or ''}"
            })

        so.insert(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "success",
            "message": f"Room Order {room_order.name} and Sales Order {so.name} created successfully.",
            "name": room_order.name,
            "sales_order": so.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Create Room Order Error")
        frappe.throw(f"Error creating Room Order: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }
