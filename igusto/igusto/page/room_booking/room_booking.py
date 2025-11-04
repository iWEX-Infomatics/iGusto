import frappe

@frappe.whitelist()
def get_guest_name():
    """Fallback API if user opens booking directly without URL param"""
    user = frappe.session.user
    if user == "Guest":
        return None

    guest = frappe.db.get_value("Guest", {"email": user}, "full_name")
    if not guest:
        first = frappe.db.get_value("User", user, "first_name") or ""
        last = frappe.db.get_value("User", user, "last_name") or ""
        guest = f"{first} {last}".strip()
    return guest


import frappe

@frappe.whitelist()
def create_booking(guest, mobile, email, check_in, check_out,
                   no_of_guests, room_type, nationality, currency=None):
    """Create new Booking linked to Guest"""
    booking = frappe.get_doc({
        "doctype": "Booking",
        "guest": guest,
        # "address": address,
        "mobile": mobile,
        "email": email,
        "check_in": check_in,
        "check_out": check_out,
        "no_of_guests": no_of_guests,
        "room_type": room_type,
        "nationality": nationality,
        "currency": currency if nationality != "Indian" else "INR",
        "booking_date": frappe.utils.nowdate()
    })
    booking.insert(ignore_permissions=True)
    frappe.db.commit()
    return booking.name
