import frappe

@frappe.whitelist()
def create_guest(first_name, middle_name=None, last_name=None, full_name=None, mobile_no=None, email=None,
                 gender=None, nationality=None, address_line1=None, city=None, state=None, country=None, pincode=None):
    try:
        # --- Create Guest ---
        doc = frappe.new_doc("Guest")
        doc.first_name = first_name
        doc.middle_name = middle_name
        doc.last_name = last_name
        doc.full_name = full_name
        doc.primary_contact = mobile_no
        doc.email = email
        doc.gender = gender
        doc.nationality = nationality
        doc.insert(ignore_permissions=True)

        # --- Create Customer Automatically ---
        customer_name = full_name or f"{first_name} {last_name}"
        customer = frappe.new_doc("Customer")
        customer.customer_name = customer_name
        customer.customer_type = "Individual"
        customer.customer_group = "All Customer Groups"
        customer.territory = "All Territories"
        customer.mobile_no = mobile_no
        customer.email_id = email
        customer.gender = gender
        customer.nationality = nationality

        # Link Guest → Customer
        customer_meta = frappe.get_meta("Customer")
        if "guest" in [f.fieldname for f in customer_meta.fields]:
            customer.guest = doc.name
        customer.insert(ignore_permissions=True)

        # Link Customer → Guest
        guest_meta = frappe.get_meta("Guest")
        if "customer" in [f.fieldname for f in guest_meta.fields]:
            doc.db_set("customer", customer.name)

        # --- Create Address ---
        if address_line1 and city and country:
            address_title = f"{full_name or first_name} Address"
            address_doc = frappe.new_doc("Address")
            address_doc.address_title = address_title
            address_doc.address_line1 = address_line1
            address_doc.city = city
            address_doc.state = state
            address_doc.country = country
            address_doc.pincode = pincode
            address_doc.address_type = "Billing"
            address_doc.append("links", {"link_doctype": "Guest", "link_name": doc.name})
            address_doc.append("links", {"link_doctype": "Customer", "link_name": customer.name})
            address_doc.insert(ignore_permissions=True)

            # Update Guest and Customer address fields if they exist
            if "address" in [f.fieldname for f in guest_meta.fields]:
                doc.db_set("address", address_doc.name)
            if "customer_primary_address" in [f.fieldname for f in customer_meta.fields]:
                customer.db_set("customer_primary_address", address_doc.name)

        frappe.db.commit()

        return {
            "name": doc.name,
            "customer": customer.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Guest Signup Error")
        frappe.throw(f"Error creating Guest: {str(e)}")
