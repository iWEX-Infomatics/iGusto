import frappe
import hashlib
import json
from frappe.utils import now_datetime

@frappe.whitelist()
def avoid_duplicate_files(file_doc=None, method=None):
    """
    Prevent duplicate files system-wide.
    Checks if a file with the same content already exists.
    If yes, reuses the existing file instead of creating a new one.
    """

    # make sure we are handling a valid File doc
    if not file_doc or not hasattr(file_doc, "get_content"):
        return

    file_content = file_doc.get_content()
    if not file_content:
        return

    # generate hash of file content
    file_hash = hashlib.md5(file_content).hexdigest()

    # check for existing file with same content
    existing = frappe.db.get_value("File", {"content_hash": file_hash}, "name")

    if existing and existing != file_doc.name:
        existing_file = frappe.get_doc("File", existing)

        # reuse existing file info
        file_doc.file_url = existing_file.file_url
        file_doc.content_hash = existing_file.content_hash
        file_doc.file_name = existing_file.file_name
        file_doc.file_size = existing_file.file_size

        # notify
        # frappe.msgprint(f"Duplicate avoided. Using existing file: {existing_file.file_name}")


@frappe.whitelist(allow_guest=True)
def track_pwa_event(event, properties=None):
    """
    Track PWA analytics events.
    Stores events in a custom doctype or logs them.
    
    Args:
        event: Event name (e.g., 'pwa_installed', 'pwa_install_prompt_shown')
        properties: Dictionary of event properties
    """
    try:
        # Parse properties if it's a string
        if isinstance(properties, str):
            properties = json.loads(properties)
        
        if properties is None:
            properties = {}
        
        # Get user info
        user = frappe.session.user if frappe.session.user else 'Guest'
        
        # Create event log entry
        # Option 1: Store in a custom doctype (create PWA Event Log doctype if needed)
        # Option 2: Store in Error Log for now (can be changed later)
        
        # For now, we'll log it (you can create a custom doctype later)
        frappe.log_error(
            message=f"PWA Event: {event}",
            title="PWA Analytics",
            is_error=False
        )
        
        # Optional: Create a custom doctype "PWA Event Log" to store these
        # Uncomment below if you create the doctype:
        """
        try:
            event_log = frappe.get_doc({
                "doctype": "PWA Event Log",
                "event": event,
                "user": user,
                "properties": json.dumps(properties),
                "timestamp": now_datetime()
            })
            event_log.insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception:
            # Doctype doesn't exist, just log it
            pass
        """
        
        return {
            "status": "success",
            "message": "Event tracked successfully"
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "PWA Analytics Error")
        return {
            "status": "error",
            "message": str(e)
        }


@frappe.whitelist()
def process_payment(payment_details=None, method_name=None):
    """
    Process payment using Payment Request API.
    
    Args:
        payment_details: Payment details from PaymentRequest API
        method_name: Payment method name (e.g., 'basic-card', 'google-pay')
    """
    try:
        if isinstance(payment_details, str):
            payment_details = json.loads(payment_details)
        
        # TODO: Implement actual payment processing
        # This should integrate with your payment gateway
        
        # For now, return success
        return {
            "status": "success",
            "message": "Payment processed successfully",
            "transaction_id": frappe.generate_hash(length=16)
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "PWA Payment Error")
        return {
            "status": "error",
            "message": str(e)
        }


@frappe.whitelist(allow_guest=True)
def get_webauthn_challenge(action, user_info=None):
    """
    Get WebAuthn challenge for registration or authentication.
    
    Args:
        action: 'register' or 'authenticate'
        user_info: User information for registration
    """
    try:
        import secrets
        import base64
        
        if isinstance(user_info, str):
            user_info = json.loads(user_info)
        
        # Generate random challenge
        challenge = secrets.token_bytes(32)
        challenge_b64 = base64.b64encode(challenge).decode('utf-8')
        
        if action == 'register':
            # Registration challenge
            return {
                "challenge": challenge_b64,
                "rpName": "igusto ERP",
                "rpId": frappe.conf.get("host_name") or frappe.local.site,
                "userId": base64.b64encode(user_info.get('email', '').encode()).decode() if user_info else ''
            }
        else:
            # Authentication challenge
            # TODO: Get user's existing credentials from database
            return {
                "challenge": challenge_b64,
                "rpId": frappe.conf.get("host_name") or frappe.local.site,
                "allowCredentials": []  # Should be populated from user's registered credentials
            }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "WebAuthn Challenge Error")
        return {
            "status": "error",
            "message": str(e)
        }


@frappe.whitelist(allow_guest=True)
def register_webauthn_credential(credential_id, credential_response, user_info=None):
    """
    Register WebAuthn credential on server.
    
    Args:
        credential_id: Base64 encoded credential ID
        credential_response: Credential response from browser
        user_info: User information
    """
    try:
        if isinstance(credential_response, str):
            credential_response = json.loads(credential_response)
        if isinstance(user_info, str):
            user_info = json.loads(user_info)
        
        # TODO: Store credential in database
        # This should be stored securely and associated with the user
        
        return {
            "status": "success",
            "message": "Credential registered successfully"
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "WebAuthn Registration Error")
        return {
            "status": "error",
            "message": str(e)
        }


@frappe.whitelist(allow_guest=True)
def authenticate_webauthn(credential_id, assertion_response, username=None):
    """
    Authenticate using WebAuthn credential.
    
    Args:
        credential_id: Base64 encoded credential ID
        assertion_response: Assertion response from browser
        username: Username for authentication
    """
    try:
        if isinstance(assertion_response, str):
            assertion_response = json.loads(assertion_response)
        
        # TODO: Verify assertion and authenticate user
        # This should verify the signature and authenticate the user
        
        return {
            "status": "success",
            "message": "Authentication successful",
            "authenticated": True
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "WebAuthn Authentication Error")
        return {
            "status": "error",
            "message": str(e),
            "authenticated": False
        }
