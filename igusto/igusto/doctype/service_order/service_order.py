# Copyright (c) 2025, madhu and contributors
# For license information, please see license.txt

from frappe.model.document import Document
import frappe
from frappe.utils import now_datetime

class ServiceOrder(Document):
    pass

@frappe.whitelist()
def create_sales_invoice(service_order_name):
    doc = frappe.get_doc("Service Order", service_order_name)

    guest = frappe.get_doc("Guest", doc.guest)
    customer_name = guest.full_name

    # Check if Customer exists
    customer = frappe.db.exists("Customer", {"customer_name": customer_name})
    if not customer:
        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_group": "Individual",
            "customer_type": "Individual"
        }).insert(ignore_permissions=True)

    # Prepare invoice items
    invoice_items = []
    for row in doc.service_items:
        item_name = row.item.strip()

        # Create item if not exists
        existing_item = frappe.db.exists("Item", {"item_name": item_name})
        if not existing_item:
            item_doc = frappe.get_doc({
                "doctype": "Item",
                "item_code": item_name,
                "item_name": item_name,
                "item_group": row.category or "Other",
                "is_sales_item": 1,
                "is_service_item": 1,
                "stock_uom": "Nos"
            })
            item_doc.insert(ignore_permissions=True)
            item_code = item_doc.name
        else:
            item_code = existing_item

        invoice_items.append({
            "item_code": item_code,
            "qty": row.quantity,
            "rate": 0,
            "description": row.remarks or ""
        })

    # Create Sales Invoice (Draft)
    sales_invoice = frappe.get_doc({
        "doctype": "Sales Invoice",
        "customer": customer_name,
        "posting_date": now_datetime(),
        "items": invoice_items
    })
    sales_invoice.insert(ignore_permissions=True)

    # Update payment status
    doc.db_set("payment_status", "Posted to Room")

    # Just return name
    return sales_invoice.name
