import frappe
from frappe.model.document import Document

@frappe.whitelist()
def get_services_by_type(service_type):
    """Return list of services from Extra Service DocType filtered by type."""
    return frappe.get_all(
        "Extra Service",
        filters={"service_type": service_type},
        fields=["service_name", "rate"]
    )

@frappe.whitelist()
def create_service_order(data):
    data = frappe.parse_json(data)
    doc = frappe.new_doc("Service Order")

    doc.guest = data.get("guest")
    doc.room_assignment = data.get("room_assignment")
    doc.room = data.get("room")
    doc.service_type = data.get("service_type")
    doc.order_datetime = frappe.utils.now_datetime()

    total = 0
    for item in data.get("items", []):
        doc.append("service_items", {
            "item": item.get("item"),
            "category": item.get("category"),
            "quantity": item.get("quantity"),
            "rate": item.get("rate"),
            "amount": item.get("amount")
        })
        total += item.get("amount")

    doc.total_amount = total
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name}
