import frappe
import json
from frappe.utils import now_datetime


@frappe.whitelist()
def get_menu_items():
    """Fetch active items from Item doctype."""
    return frappe.get_all(
        "Item",
        fields=["name", "item_name"],
        filters={"disabled": 0},
        order_by="item_name asc"
    )


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
    """Static laundry options."""
    return ["Clothes Wash", "Ironing", "Dry Clean", "Fold & Pack"]


@frappe.whitelist()
def get_transport_items():
    """Static transport service options."""
    return ["Airport Pickup", "Airport Drop", "City Tour", "Cab on Call"]


@frappe.whitelist()
def create_room_order(data):
    """Creates a Service Order and linked Sales Order."""
    if isinstance(data, str):
        data = json.loads(data)

    # ---- Create Service Order ----
    service_doc = frappe.new_doc("Service Order")
    service_doc.guest = data.get("guest")
    service_doc.room = data.get("room_number")
    service_doc.service_type = data.get("service_type")
    service_doc.payment_status = "Unpaid"
    service_doc.order_datetime = now_datetime()

    # ---- Add service items ----
    service_items = data.get("service_item")
    if isinstance(service_items, list):
        for i in service_items:
            service_doc.append("service_items", {
                "item": i,
                "category": data.get("service_type"),
                "quantity": data.get("quantity", 1)
            })
    else:
        service_doc.append("service_items", {
            "item": service_items,
            "category": data.get("service_type"),
            "quantity": data.get("quantity", 1)
        })

    service_doc.insert(ignore_permissions=True)

    # ---- Guest Full Name ----
    guest_id = data.get("guest")
    full_name = frappe.db.get_value("Guest", guest_id, "full_name")
    if not full_name:
        frappe.throw(f"Guest full name not found for Guest ID: {guest_id}")

    # ---- Create Customer if not exist ----
    customer = frappe.db.exists("Customer", {"customer_name": full_name})
    if not customer:
        cust = frappe.new_doc("Customer")
        cust.customer_name = full_name
        cust.customer_type = "Individual"
        cust.customer_group = "All Customer Groups"
        cust.territory = "All Territories"
        cust.insert(ignore_permissions=True)
        customer = cust.name

    # ---- Create Item Group if not exist ----
    service_type = data.get("service_type")
    if service_type and not frappe.db.exists("Item Group", service_type):
        ig = frappe.new_doc("Item Group")
        ig.item_group_name = service_type
        ig.parent_item_group = "All Item Groups"
        ig.is_group = 0
        ig.insert(ignore_permissions=True)

    # ✅ ---- Get Company dynamically from Company doctype ----
    company = frappe.db.get_all("Company", filters={"disabled": 0}, fields=["name"], limit=1)
    if not company:
        frappe.throw("No active Company found in the system.")
    company_name = company[0].name

    # ---- Create Sales Order ----
    so = frappe.new_doc("Sales Order")
    so.customer = customer
    so.transaction_date = now_datetime()
    so.delivery_date = now_datetime()
    so.order_type = "Sales"
    so.company = company_name
    so.remarks = f"Auto created from Service Order: {service_doc.name}"

    # ---- Normalize items ----
    if isinstance(service_items, str):
        service_items = [service_items]

    # ---- Handle Room Service ----
    if service_type.lower() == "room service":
        for item_name in service_items:
            item_code = frappe.db.get_value("Item", {"item_name": item_name}, "name")
            if not item_code:
                new_item = frappe.new_doc("Item")
                new_item.item_code = item_name
                new_item.item_name = item_name
                new_item.item_group = service_type
                new_item.is_stock_item = 0
                new_item.insert(ignore_permissions=True)
                item_code = new_item.name
            so.append("items", {"item_code": item_code, "qty": data.get("quantity", 1)})

    # ---- Handle Restaurant ----
    elif service_type.lower() == "restaurant":
        for item_name in service_items:
            item_code = frappe.db.get_value("Item", {"item_name": item_name}, "name")
            if not item_code:
                frappe.throw(f"Item not found for {item_name}")
            so.append("items", {"item_code": item_code, "qty": data.get("quantity", 1)})

    # ---- Handle Spa ----
    elif service_type.lower() == "spa":
        for item_name in service_items:
            item_code = frappe.db.get_value("Item", {"item_name": item_name}, "name")
            if not item_code:
                new_item = frappe.new_doc("Item")
                new_item.item_code = item_name
                new_item.item_name = item_name
                new_item.item_group = "Spa"
                new_item.is_stock_item = 0
                new_item.insert(ignore_permissions=True)
                item_code = new_item.name
            so.append("items", {"item_code": item_code, "qty": 1})

    # ---- Handle Laundry / Transport ----
    elif service_type.lower() in ["laundry", "transport"]:
        for item_name in service_items:
            item_code = frappe.db.get_value("Item", {"item_name": item_name}, "name")
            if not item_code:
                new_item = frappe.new_doc("Item")
                new_item.item_code = item_name
                new_item.item_name = item_name
                new_item.item_group = service_type
                new_item.is_stock_item = 0
                new_item.insert(ignore_permissions=True)
                item_code = new_item.name
            so.append("items", {"item_code": item_code, "qty": 1})

    # ---- Handle Other ----
    elif service_type.lower() == "other":
        desc = data.get("describe_service") or "Other Service"
        new_item = frappe.new_doc("Item")
        new_item.item_code = desc
        new_item.item_name = desc
        new_item.item_group = "Other"
        new_item.is_stock_item = 0
        new_item.insert(ignore_permissions=True)
        so.append("items", {"item_code": new_item.name, "qty": 1})

    # ---- Insert Sales Order ----
    so.insert(ignore_permissions=True)

    return {
        "service_order": service_doc.name,
        "sales_order": so.name,
        "company_used": company_name
    }
