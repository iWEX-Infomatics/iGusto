import frappe, json

@frappe.whitelist()
def get_latest_guest_room():
    """Get latest Guest Onboarding for auto-fill."""
    latest = frappe.db.get_all(
        "Guest Onboarding",
        fields=["guest", "room_number"],
        order_by="creation desc",
        limit=1
    )
    if latest:
        return {"guest_name": latest[0].guest, "room_number": latest[0].room_number}
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
    """Static room services (can be from Doctype if you want)."""
    return ["Towel Change", "Cleaning", "Water Bottle", "Extra Pillow"]

@frappe.whitelist()
def create_room_order(data):
    """Create Room Order entry."""
    if isinstance(data, str):
        data = json.loads(data)
    data = frappe._dict(data)

    doc = frappe.new_doc("Room Order")
    doc.guest = data.guest
    doc.room_number = data.room_number
    doc.order_type = data.order_type
    doc.service_item = json.dumps(data.service_item)
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return doc.name
