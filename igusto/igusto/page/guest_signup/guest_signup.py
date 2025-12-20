import frappe
import requests
import json

@frappe.whitelist()
def get_post_offices_api(pincode):
    """Fetch post offices for Indian Pincode"""
    if not pincode:
        return []

    url = f"https://api.postalpincode.in/pincode/{pincode}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64;x64)"}
    try:
        resp = requests.get(url, timeout=5, headers=headers)
        data = resp.json()
    except Exception:
        frappe.log_error(frappe.get_traceback(), "Pincode API Error")
        return []

    if not data or data[0].get("Status") != "Success":
        return []

    result = []
    for po in data[0].get("PostOffice", []):
        result.append({
            "post_office": po.get("Name"),
            "taluk": po.get("Block") or po.get("Name"),
            "state": po.get("State"),
            "district": po.get("District"),
            "country": po.get("Country") or "India"
        })
    return result


@frappe.whitelist()
def create_guest_with_address(first_name, middle_name=None, last_name=None, full_name=None,
                              mobile_no=None, email=None, gender=None, nationality=None,
                              address_data=None):
    """Create Guest + Linked Address"""
    try:
        if isinstance(address_data, str):
            address_data = json.loads(address_data)

        #  Create Guest
        guest = frappe.new_doc("Guest")
        guest.first_name = first_name
        guest.middle_name = middle_name
        guest.last_name = last_name
        guest.full_name = full_name
        guest.primary_contact = mobile_no
        guest.email = email
        guest.gender = gender
        guest.nationality = nationality
        guest.insert(ignore_permissions=True)

        #  Create Address linked to Guest
        if address_data:
            address = frappe.new_doc("Address")
            address.address_title = guest.full_name or guest.name
            address.address_line1 = address_data.get("address_line1")
            address.city = address_data.get("city")
            address.state = address_data.get("state")
            # Use nationality (Country link) as the address country
            address.country = (
                address_data.get("country")
                or nationality
                or detect_country_from_district(address_data.get("district"))
                or "India"
            )
            address.county = address_data.get("district")

            address.pincode = address_data.get("pincode")
            address.custom_post_office = address_data.get("post_office")
            address.custom_district = address_data.get("district")

            address.append("links", {
                "link_doctype": "Guest",
                "link_name": guest.name
            })

            address.is_primary_address = 1
            address.is_shipping_address = 1
            address.insert(ignore_permissions=True)

        frappe.db.commit()

        return {"guest": guest.name, "address": address.name if address_data else None}

    except Exception:
        frappe.log_error(frappe.get_traceback(), "Guest Signup with Address Error")
        frappe.throw("Error creating Guest or Address. Please contact Administrator.")


def detect_country_from_district(district):
    """Optional helper to set country based on district (can expand logic later)"""
    if not district:
        return None

    # For India (default), else future logic can be added
    indian_districts = [
        "Mumbai", "Pune", "Delhi", "Kolkata", "Chennai", "Bengaluru", "Hyderabad"
    ]
    if district in indian_districts:
        return "India"

    return "India"  # Default fallback


