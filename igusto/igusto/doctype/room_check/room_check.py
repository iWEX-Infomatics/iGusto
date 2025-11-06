import frappe
from frappe.model.document import Document

class RoomCheck(Document):
    pass


@frappe.whitelist()
def create_sales_order_from_room_check(room_check_name):
    """Create a Sales Order automatically when Room Check is submitted"""
    room_check = frappe.get_doc("Room Check", room_check_name)

    # --- Step 1: Ensure Customer Exists ---
    guest_name = room_check.guest
    guest_doc = frappe.get_doc("Guest", guest_name)
    customer_name = guest_doc.full_name or guest_name

    customer = frappe.db.exists("Customer", {"customer_name": customer_name})
    if not customer:
        customer_doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": "Individual",
            "mobile_no": getattr(guest_doc, "mobile_no", ""),
            "email_id": getattr(guest_doc, "email", "")
        }).insert(ignore_permissions=True)
        frappe.msgprint(f"Customer '{customer_name}' created successfully.")
        customer = customer_doc.name

        # Optional: link back if Guest has a Customer field
        if "customer" in guest_doc.as_dict():
            guest_doc.db_set("customer", customer)

    # --- Step 2: Create Sales Order ---
    so = frappe.new_doc("Sales Order")
    so.customer = customer
    so.delivery_date = frappe.utils.nowdate()
    so.ig_room = getattr(room_check, "room", "")
    so.ig_booking_reference = getattr(room_check, "booking_reference", "")

    # Add child items
    for item in room_check.room_check_items:
        so.append("items", {
            "item_code": item.item,
            "item_name": item.item,
            "qty": item.qty,
            "rate": item.rate,
            "amount": item.amount,
            "description": item.category or "Room Check Item"
        })

    # Add room rent if exists
    if getattr(room_check, "room_rent", 0):
        so.append("items", {
            "item_code": "ROOM-RENT",
            "item_name": "Room Rent",
            "qty": 1,
            "rate": room_check.room_rent,
            "amount": room_check.room_rent
        })

    so.insert(ignore_permissions=True)
    frappe.db.commit()

    return so.name
