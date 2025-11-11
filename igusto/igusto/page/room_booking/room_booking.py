import frappe

@frappe.whitelist()
def create_booking(guest, mobile, email, check_in, check_out,
                   no_of_guests, room_type, nationality, rate_plan, currency=None):
    """Create Sales Order only (no Booking document)"""

    # -------------------------------
    #  Fetch Guest
    # -------------------------------
    guest_doc = frappe.get_doc("Guest", guest)
    full_name = guest_doc.full_name
    guest_mobile = guest_doc.primary_contact or mobile
    guest_email = guest_doc.email or email
    guest_nationality = guest_doc.nationality or nationality

    # -------------------------------
    #  Create Customer if not exists
    # -------------------------------
    if not frappe.db.exists("Customer", {"customer_name": full_name}):
        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": full_name,
            "customer_type": "Individual",
            "customer_group": "Individual",
            "territory": "India",
            "mobile_no": guest_mobile,
            "email_id": guest_email
        })
        customer.insert(ignore_permissions=True)
        frappe.db.commit()
    else:
        customer = frappe.get_doc("Customer", {"customer_name": full_name})

    # -------------------------------
    #  Ensure Item (Room Type) exists
    # -------------------------------
    if not frappe.db.exists("Item", {"item_name": room_type}):
        item = frappe.get_doc({
            "doctype": "Item",
            "item_code": room_type,
            "item_name": room_type,
            "item_group": "Services",
            "stock_uom": "Nos",
            "is_sales_item": 1
        })
        item.insert(ignore_permissions=True)
        frappe.db.commit()

    # -------------------------------
    #  Create Sales Order Only
    # -------------------------------
    so = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer.name,
        "transaction_date": check_in,   # ✅ check-in → transaction_date
        "delivery_date": check_out,     # ✅ check-out → delivery_date
        "currency": currency if guest_nationality != "Indian" else "INR",
        "items": [
            {
                "item_code": room_type,
                "item_name": room_type,
                "qty": 1,
                "rate": rate_plan,
                "description": f"Room Booking for {full_name} ({check_in} to {check_out})"
            }
        ]
    })
    so.insert(ignore_permissions=True)
    frappe.db.commit()

    frappe.logger().info(f" Sales Order created for Guest: {full_name}")

    # -------------------------------
    #  Return only Sales Order name
    # -------------------------------
    return {
        "sales_order": so.name
    }
