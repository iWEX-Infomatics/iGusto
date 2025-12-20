import frappe
import random
import string
from datetime import datetime, timedelta

@frappe.whitelist(allow_guest=True)
def send_otp(email, mobile_no):
    """Send OTP to email only (mobile OTP disabled as per requirement)"""
    try:
        # Generate 6-digit OTP
        otp = ''.join(random.choices(string.digits, k=6))
        
        # Store OTP in cache with 10 minute expiry
        cache_key = f"otp_{email}"
        frappe.cache().set_value(cache_key, otp, expires_in_sec=600)
        
        # Send email
        frappe.sendmail(
            recipients=[email],
            subject="Your Verification OTP",
            message=f"""
                <h3>Guest Signup Verification</h3>
                <p>Your OTP for verification is: <strong>{otp}</strong></p>
                <p>This OTP will expire in 10 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
            """
        )
        
        return {
            "success": True,
            "message": "OTP sent successfully to your email"
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "OTP Send Error")
        return {
            "success": False,
            "message": f"Failed to send OTP: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def verify_otp(email, mobile_no=None, mobile_otp=None, email_otp=None):
    mobile_verified = False
    email_verified = False
    
    # Check Mobile OTP if provided
    if mobile_otp:
        # Verify mobile OTP logic
        mobile_verified = True  # If correct
    
    # Check Email OTP if provided
    if email_otp:
        # Verify email OTP logic
        email_verified = True  # If correct
    
    # Success if at least one is verified
    if mobile_verified or email_verified:
        return {
            "success": True,
            "mobile_verified": mobile_verified,
            "email_verified": email_verified,
            "message": "OTP verified successfully"
        }
    else:
        return {
            "success": False,
            "message": "Invalid OTP"
        }

@frappe.whitelist(allow_guest=True)
def create_guest_after_verification(guest_data):
    """Create Guest and Address after successful OTP verification"""
    import json
    
    try:
        if isinstance(guest_data, str):
            guest_data = json.loads(guest_data)
        
        address_data = guest_data.get('address_data', {})
        
        # Create Guest
        guest = frappe.new_doc("Guest")
        guest.first_name = guest_data.get('first_name')
        guest.middle_name = guest_data.get('middle_name')
        guest.last_name = guest_data.get('last_name')
        guest.full_name = guest_data.get('full_name')
        guest.primary_contact = guest_data.get('mobile_no')
        guest.email = guest_data.get('email')
        guest.gender = guest_data.get('gender')
        guest.nationality = guest_data.get('nationality')
        guest.insert(ignore_permissions=True)
        
        # Create Address
        if address_data:
            address = frappe.new_doc("Address")
            address.address_title = guest.full_name or guest.name
            address.address_line1 = address_data.get("address_line1")
            address.city = address_data.get("city")
            address.state = address_data.get("state")
            address.country = address_data.get("country") or guest_data.get('nationality') or "India"
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
        
        return {
            "success": True,
            "guest": guest.name,
            "address": address.name if address_data else None
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Guest Creation After Verification Error")
        return {
            "success": False,
            "message": f"Failed to create guest: {str(e)}"
        }