import frappe
from frappe import _
from datetime import datetime
import json

@frappe.whitelist()
def create_booking(guest, mobile, email, nationality, check_in, check_out, 
                   no_of_guests, total_adults, total_children, total_rooms, 
                   total_days, room_items=None, service_items=None):
    """Create Sales Order for room booking with room items and service items"""
    
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
        # Validate rooms and days
        # ------------------------------- 
        validate_rooms_and_days(total_rooms, total_days)
        
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
        # Determine currency
        # ------------------------------- 
        final_currency = "INR" if guest_nationality and guest_nationality.lower() == "india" else "USD"
        
        # ------------------------------- 
        # Prepare items list
        # ------------------------------- 
        items_list = []
        
        # ------------------------------- 
        # Add Room Items
        # ------------------------------- 
        if room_items:
            try:
                room_items_list = json.loads(room_items) if isinstance(room_items, str) else room_items
                
                for room_item in room_items_list:
                    item_code = room_item.get("item_code")
                    qty = float(room_item.get("qty", 0))
                    rate = float(room_item.get("rate", 0))
                    uom = room_item.get("uom", "")
                    
                    if item_code and qty > 0:
                        # Verify item exists
                        if frappe.db.exists("Item", item_code):
                            items_list.append({
                                "item_code": item_code,
                                "qty": qty,
                                "rate": rate,
                                "uom": uom,
                                "description": f"Room Item for {full_name}\n"
                                               f"Check-in: {check_in} | Check-out: {check_out}\n"
                                               f"Total Rooms: {total_rooms} | Total Days: {total_days}\n"
                                               f"Adults: {total_adults} | Children: {total_children}"
                            })
                        else:
                            frappe.log_error(f"Room Item {item_code} not found", "Room Item Missing")
                            
            except Exception as e:
                frappe.log_error(f"Error parsing room items: {str(e)}", "Room Items Parse Error")
        
        # Validation: At least one room item is required
        if not items_list:
            frappe.throw(_("At least one room item is required"))
        
        # ------------------------------- 
        # Add Service Items
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
                                "description": f"Service Item for {full_name}\n"
                                               f"Total Rooms: {total_rooms} | Total Days: {total_days}"
                            })
                        else:
                            frappe.log_error(f"Service Item {item_code} not found", "Service Item Missing")
                            
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
            "items_count": len(items_list),
            "total_rooms": total_rooms,
            "total_days": total_days
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


def validate_rooms_and_days(total_rooms, total_days):
    """Validate total rooms and total days"""
    
    try:
        rooms = int(total_rooms)
        days = int(total_days)
        
        if rooms < 1:
            frappe.throw(_("Total rooms must be at least 1"))
        
        if days < 1:
            frappe.throw(_("Total days must be at least 1"))
            
    except ValueError:
        frappe.throw(_("Invalid rooms or days values"))


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


@frappe.whitelist()
def get_room_items():
    """Get list of room items (Item Group = Room or parent = Room)"""
    
    room_items = frappe.get_all(
        "Item",
        filters={
            "is_sales_item": 1,
            "item_group": ["in", ["Room", "Rooms"]]
        },
        fields=["name", "item_name", "stock_uom", "standard_rate", "item_group"],
        order_by="item_name"
    )
    
    return room_items


@frappe.whitelist()
def get_service_items():
    """Get list of service items (excluding Room items)"""
    
    service_items = frappe.get_all(
        "Item",
        filters={
            "is_sales_item": 1,
            "item_group": ["not in", ["Room", "Rooms"]]
        },
        fields=["name", "item_name", "stock_uom", "standard_rate", "item_group"],
        order_by="item_name"
    )
    
    return service_items