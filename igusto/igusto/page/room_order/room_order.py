import frappe
import json
from frappe.utils import now_datetime

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
    return ["Towel Change", "Cleaning", "Water Bottle", "Extra Pillow"]


@frappe.whitelist()
def get_spa_items():
    """Static spa service options (checkbox style)."""
    return ["Full Body Massage", "Head Massage", "Foot Spa", "Sauna", "Facial Therapy"]


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


import frappe
import json
from frappe.utils import nowdate

@frappe.whitelist()
def create_room_order(data):
    """
    Create a new Room Order document with child table entries.
    Auto-sets current date and guest name as room_order_customer.
    """
    try:
        data = json.loads(data)

        # --- Parent Document ---
        room_order = frappe.new_doc("Room Orders")
        room_order.room_number = data.get("room_number")
        room_order.room_order_date = nowdate()  # ✅ current date
        room_order.room_order_customer = data.get("guest")  # ✅ guest as customer
        room_order.guest = data.get("guest")
        room_order.delivery_to = data.get("delivery_to")
        room_order.service_type = data.get("service_type")

        # --- Child Table (room_order_booking_items) ---
        items = data.get("items", [])
        for i in items:
            room_order.append("room_order_booking_items", {
                "item": i.get("item_name"),
                "quantity": i.get("quantity") or 1,
                "rate": i.get("rate") or 0,
                "custom_remarks": i.get("custom_remarks") or "",
                "category": data.get("service_type") or "General"  # ✅ map service_type → category
            })

        room_order.insert(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "success",
            "message": f"Room Order {room_order.name} created successfully.",
            "name": room_order.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Create Room Order Error")
        frappe.throw(f"Error creating Room Order: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }