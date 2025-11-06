import frappe
from frappe.model.document import Document
from frappe.utils import nowdate

class RoomCheck(Document):
    pass


@frappe.whitelist()
def create_sales_invoice(doc):
    """Create Draft Sales Invoice from Room Check"""
    room_check = frappe._dict(frappe.parse_json(doc))

    #  Get Guest full name
    guest_name = frappe.db.get_value("Guest", room_check.guest, "full_name")
    if not guest_name:
        frappe.throw("Guest not found or missing full name.")

    #  Check or create Customer
    customer = frappe.db.exists("Customer", {"customer_name": guest_name})
    if not customer:
        customer_doc = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": guest_name,
            "customer_type": "Individual"
        })
        customer_doc.insert(ignore_permissions=True)
        customer = customer_doc.name

    #  Get Company and Income Account
    company = room_check.get("company") or frappe.defaults.get_user_default("company")
    if not company:
        frappe.throw("Company not found. Please set a default company for your user.")

    income_account = frappe.db.get_value("Company", company, "default_income_account")
    if not income_account:
        income_account = frappe.db.get_value("Account", {"account_type": "Income Account", "company": company})
    if not income_account:
        frappe.throw(f"No valid Income Account found for company {company}")

    #  Create Sales Invoice (DRAFT)
    si = frappe.new_doc("Sales Invoice")
    si.customer = customer
    si.company = company
    si.due_date = nowdate()

    #  Add Room Rent
    if room_check.get("room_rent") and float(room_check.room_rent) > 0:
        si.append("items", {
            "item_name": "Room Rent",
            "qty": 1,
            "rate": room_check.room_rent,
            "amount": room_check.room_rent,
            "income_account": income_account
        })

    #  Add Room Check Items
    for item in room_check.get("room_check_items", []):
        si.append("items", {
            "item_name": item.get("item"),
            "qty": item.get("qty"),
            "rate": item.get("rate"),
            "amount": item.get("amount"),
            "income_account": income_account
        })

    #  Save as Draft (NOT submitted)
    si.set_missing_values()
    si.save(ignore_permissions=True)

    #  Clickable Message Link
    link = f'<a href="/app/sales-invoice/{si.name}" style="color: var(--blue-600); font-weight:600; text-decoration: underline;">{si.name}</a>'
    frappe.msgprint(f" Sales Invoice {link} created successfully.", title="Success")

    return si.name
