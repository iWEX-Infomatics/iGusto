import frappe
from frappe import _
from datetime import datetime
import json

@frappe.whitelist()
def create_booking(guest, mobile, email, nationality, check_in, check_out, 
                   no_of_guests, total_adults, total_children, room_type, rate_plan, service_items=None):
    """Create Sales Order for room booking with service items"""
    
    try:
        # ------------------------------- 
        # Validation: Check dates
        # ------------------------------- 
        validate_dates(check_in, check_out)
        
        # ------------------------------- 
        # Validate guest counts
        # ------------------------------- 
        validate_guest_counts(total_adults, total_children, no_of_guests)
        
        # ------------------------------- 
        # Fetch Guest
        # ------------------------------- 
        if not frappe.db.exists("Guest", guest):
            frappe.throw(_("Guest {0} does not exist").format(guest))
        
        guest_doc = frappe.get_doc("Guest", guest)
        full_name = guest_doc.full_name
        guest_mobile = guest_doc.primary_contact or mobile
        guest_email = guest_doc.email or email
        guest_nationality = guest_doc.nationality or nationality
        
        # ------------------------------- 
        # Create Customer if not exists
        # ------------------------------- 
        customer = get_or_create_customer(full_name, guest_mobile, guest_email)
        
        # ------------------------------- 
        # Ensure Item (Room Type) exists
        # ------------------------------- 
        ensure_room_type_item(room_type)
        
        # ------------------------------- 
        # Validate and get rate plan
        # ------------------------------- 
        validated_rate = validate_rate_plan(room_type, rate_plan)
        
        # ------------------------------- 
        # Determine currency
        # ------------------------------- 
        final_currency = "INR" if guest_nationality and guest_nationality.lower() == "india" else "USD"
        
        # ------------------------------- 
        # Prepare items list
        # ------------------------------- 
        items_list = [
            {
                "item_code": room_type,
                "item_name": room_type,
                "qty": 1,
                "rate": validated_rate,
                "description": f"Room Booking for {full_name}\n"
                               f"Check-in: {check_in} | Check-out: {check_out}\n"
                               f"Adults: {total_adults} | Children: {total_children}\n"
                               f"Total Guests: {no_of_guests}"
            }
        ]
        
        # ------------------------------- 
        # Add service items if provided
        # ------------------------------- 
        if service_items:
            try:
                service_items_list = json.loads(service_items) if isinstance(service_items, str) else service_items
                
                for service_item in service_items_list:
                    item_code = service_item.get("item_code")
                    qty = float(service_item.get("qty", 0))
                    rate = float(service_item.get("rate", 0))
                    uom = service_item.get("uom", "")
                    
                    if item_code and qty > 0:
                        # Verify item exists
                        if frappe.db.exists("Item", item_code):
                            items_list.append({
                                "item_code": item_code,
                                "qty": qty,
                                "rate": rate,
                                "uom": uom,
                                "description": f"Service Item for {full_name}"
                            })
                        else:
                            frappe.log_error(f"Item {item_code} not found", "Service Item Missing")
                            
            except Exception as e:
                frappe.log_error(f"Error parsing service items: {str(e)}", "Service Items Parse Error")
        
        # ------------------------------- 
        # Create Sales Order
        # ------------------------------- 
        so = frappe.get_doc({
            "doctype": "Sales Order",
            "customer": customer.name,
            "custom_number_of_guests": no_of_guests,
            "custom_guest_id": guest,
            "order_type": "Service",
            "transaction_date": check_in,
            "delivery_date": check_out,
            "currency": final_currency,
            "items": items_list
        })
        
        so.insert(ignore_permissions=True)
        frappe.db.commit()
        
        frappe.logger().info(f"✅ Sales Order {so.name} created for Guest: {full_name}")
        
        # ------------------------------- 
        # Return Sales Order details
        # ------------------------------- 
        return {
            "sales_order": so.name,
            "message": "Booking reserved successfully",
            "customer": customer.name,
            "total_amount": so.grand_total,
            "items_count": len(items_list)
        }
        
    except Exception as e:
        frappe.log_error(f"Booking Error: {str(e)}", "Room Booking")
        frappe.throw(_("Failed to create booking: {0}").format(str(e)))


def validate_dates(check_in, check_out):
    """Validate check-in and check-out dates"""
    
    if not check_in or not check_out:
        frappe.throw(_("Check-in and Check-out dates are required"))
    
    try:
        check_in_date = datetime.strptime(check_in, "%Y-%m-%d").date()
        check_out_date = datetime.strptime(check_out, "%Y-%m-%d").date()
        today = datetime.now().date()
        
        # Check if check-in is in the past
        if check_in_date < today:
            frappe.throw(_("Check-in date cannot be in the past"))
        
        # Check if check-out is in the past
        if check_out_date < today:
            frappe.throw(_("Check-out date cannot be in the past"))
        
        # Check if check-out is before check-in (equal is allowed)
        if check_out_date < check_in_date:
            frappe.throw(_("Check-out date must be same or after check-in date"))
            
    except ValueError:
        frappe.throw(_("Invalid date format. Use YYYY-MM-DD"))


def validate_guest_counts(total_adults, total_children, no_of_guests):
    """Validate guest count logic"""
    
    try:
        adults = int(total_adults)
        children = int(total_children)
        total = int(no_of_guests)
        
        if adults < 1:
            frappe.throw(_("At least 1 adult is required"))
        
        if children < 0:
            frappe.throw(_("Total children cannot be negative"))
        
        if (adults + children) != total:
            frappe.throw(_("Total guests mismatch. Adults + Children should equal Total Guests"))
            
    except ValueError:
        frappe.throw(_("Invalid guest count values"))


def get_or_create_customer(full_name, mobile, email):
    """Get existing customer or create new one"""
    
    customer_name = full_name
    
    if frappe.db.exists("Customer", {"customer_name": customer_name}):
        customer = frappe.get_doc("Customer", {"customer_name": customer_name})
    else:
        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": "Individual",
            "customer_group": "Individual",
            "territory": "India",
            "mobile_no": mobile,
            "email_id": email
        })
        customer.insert(ignore_permissions=True)
        frappe.db.commit()
        frappe.logger().info(f"✅ Customer created: {customer_name}")
    
    return customer


def ensure_room_type_item(room_type):
    """Ensure Room Type exists as an Item"""
    
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
        frappe.logger().info(f"✅ Item created for Room Type: {room_type}")


def validate_rate_plan(room_type, rate_plan):
    """Validate rate plan against Room Type base_rate"""
    
    if not frappe.db.exists("Room Type", room_type):
        frappe.throw(_("Room Type {0} does not exist").format(room_type))
    
    room_type_doc = frappe.get_doc("Room Type", room_type)
    base_rate = room_type_doc.get("base_rate", 0)
    
    if not base_rate:
        frappe.throw(_("No base rate defined for Room Type {0}").format(room_type))
    
    try:
        rate_plan_float = float(rate_plan)
        return rate_plan_float
        
    except ValueError:
        frappe.throw(_("Invalid rate plan value"))


@frappe.whitelist()
def get_room_type_rate(room_type):
    """Get base rate for a specific room type"""
    
    if not frappe.db.exists("Room Type", room_type):
        return {"base_rate": 0, "error": "Room Type not found"}
    
    room_type_doc = frappe.get_doc("Room Type", room_type)
    base_rate = room_type_doc.get("base_rate", 0)
    
    return {
        "base_rate": base_rate,
        "room_type": room_type
    }


@frappe.whitelist()
def get_available_room_types(check_in=None, check_out=None):
    """Get list of available room types"""
    
    room_types = frappe.get_all(
        "Room Type",
        fields=["name", "base_rate", "description"],
        order_by="name"
    )
    
    return room_types