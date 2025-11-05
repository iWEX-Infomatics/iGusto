import frappe, json
from frappe.utils import now_datetime

@frappe.whitelist()
def get_latest_guest_room():
    """Get latest Guest Onboarding entry (only room info)."""
    latest = frappe.db.get_all(
        "Guest Onboarding",
        fields=["room_number", "name"],
        order_by="creation desc",
        limit=1
    )
    if latest:
        return {
            "room_number": latest[0].room_number,
            "assign": latest[0].name
        }
    return {}

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
def create_room_order(data):
    """Create Service Order entry from Room Order page."""
    if isinstance(data, str):
        data = json.loads(data)
    data = frappe._dict(data)

    # Create new Service Order
    doc = frappe.new_doc("Service Order")
    doc.guest = data.get("guest")  # User will fill this manually
    doc.room = data.get("room_number")
    doc.service_type = data.get("service_type")
    doc.order_datetime = now_datetime()
    doc.payment_status = "Unpaid"

    #  Handle Describe Service → remarks field
    if data.get("service_item") == "" and frappe.form_dict.get("describe_service"):
        describe_text = frappe.form_dict.get("describe_service")
    else:
        describe_text = data.get("service_item") if isinstance(data.get("service_item"), str) else ""

    # Add child table items (no rate/amount)
    if isinstance(data.service_item, list):
        for item_name in data.service_item:
            doc.append("service_items", {
                "item": item_name,
                "category": data.get("service_type"),
                "quantity": data.get("quantity", 1),
                "remarks": ""
            })
    else:
        # If Describe Service entered, map it to remarks instead of item
        doc.append("service_items", {
            "item": data.get("service_item") if data.get("service_item") else "",
            "category": data.get("service_type"),
            "quantity": data.get("quantity", 1),
            "remarks": data.get("describe_service") or ""
        })

    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name

