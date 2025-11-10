import frappe

@frappe.whitelist()
def create_booking(guest, mobile, email, check_in, check_out,
                   no_of_guests, room_type, nationality, rate_plan, currency=None):
    """Create Booking, Customer, Item (Room Type) and Sales Order automatically"""

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
    #  Create Booking Document
    # -------------------------------
    booking = frappe.get_doc({
        "doctype": "Booking",
        "guest": guest,
        "customer": customer.name,
        "mobile": guest_mobile,
        "email": guest_email,
        "check_in": check_in,
        "check_out": check_out,
        "no_of_guests": no_of_guests,
        "room_type": room_type,
        "rate_plan": rate_plan,
        "nationality": guest_nationality,
        "currency": currency if guest_nationality != "Indian" else "INR",
        "booking_date": frappe.utils.nowdate()
    })
    booking.insert(ignore_permissions=True)
    frappe.db.commit()

    # -------------------------------
    #  Create Sales Order
    # -------------------------------
    so = frappe.get_doc({
        "doctype": "Sales Order",
        "customer": customer.name,
        "transaction_date": frappe.utils.nowdate(),
        "delivery_date": check_in,
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

    frappe.logger().info(f" Booking + Sales Order created for Guest: {full_name}")

    # -------------------------------
    #  Return Booking Name & SO Name
    # -------------------------------
    return {
        "booking": booking.name,
        "sales_order": so.name
    }
