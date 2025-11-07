# igusto/igusto/api/hotel_lock_integration.py
import frappe
import requests
from frappe.utils import now_datetime, get_datetime

# -----------------------------
# Config helpers
# -----------------------------
def get_lock_settings():
    settings = frappe.get_single("Hotel Lock Settings")
    if not settings.base_url and not settings.use_mock:
        frappe.throw("Please configure Hotel Lock Settings first (base_url).")
    return {
        "base_url": (settings.base_url or "").rstrip("/"),
        "hotel_id": settings.hotel_id,
        "encoder": settings.encoder_id,
        "api_key": settings.api_key or "",
        "use_mock": bool(settings.use_mock)
    }

# -----------------------------
# Real API caller (unchanged)
# -----------------------------
def call_lock_api_real(endpoint, method="GET", data=None, params=None):
    settings = get_lock_settings()
    url = f"{settings['base_url']}{endpoint}"
    headers = {"Content-Type": "application/json"}

    auth = None
    if settings["api_key"]:
        # If you store bearer token as lock_api_key in site_config or settings
        headers["Authorization"] = f"Bearer {settings['api_key']}"
    elif frappe.conf.get("lock_api_user") and frappe.conf.get("lock_api_pass"):
        auth = (frappe.conf.get("lock_api_user"), frappe.conf.get("lock_api_pass"))

    try:
        response = requests.request(method, url, json=data, params=params, headers=headers, auth=auth, timeout=20)
        response.raise_for_status()
        result = response.json()
    except requests.exceptions.RequestException as e:
        frappe.throw(f"Error calling Lock API: {e}")
    except Exception:
        frappe.throw("Invalid response from Lock API (not JSON).")

    if result.get("responseCode") != 200:
        frappe.throw(result.get("userMessage") or result.get("message") or "Lock API returned an error")

    return result.get("result")

# -----------------------------
# Mock responses (for testing)
# -----------------------------
def _mock_get_encoder_id(hotel_id):
    # return shape as in doc
    return {"encoderID": "01"}

def _mock_keys_new(payload):
    # return sample result
    txn = 1000 + int(payload.get("roomNumber")[-2:] if payload.get("roomNumber") and payload.get("roomNumber")[-2:].isdigit() else 1)
    return {
        "transactionID": txn,
        "requestType": payload.get("requestType", "new"),
        "encoder": payload.get("encoder", "01"),
        "hotelID": payload.get("hotelID"),
        "roomNumber": payload.get("roomNumber"),
        "oldRoomNumber": payload.get("oldRoomNumber", ""),
        "guestName": payload.get("guestName"),
        "arrivalDate": payload.get("arrivalDate"),
        "departureDate": payload.get("departureDate"),
        "noOfCards": payload.get("noOfCards", 1),
        "isCommonAreaAccess": payload.get("isCommonAreaAccess", True)
    }

def _mock_checkout_room(room_no, hotel_id):
    # simple boolean success
    return True

def _mock_health_check(hotel_id):
    return {
        "transactionID": 123,
        "lockServerEncodersStatus": [{"encoderId": 1, "encoderStatus": "Active"}],
        "serviceUptime": "01:23:45"
    }

# -----------------------------
# Unified API function (switch)
# -----------------------------
def call_lock_api(endpoint, method="GET", data=None, params=None):
    """
    Use this single function across your app.
    It decides to use mock or real API based on settings.use_mock.
    """
    settings = get_lock_settings()
    if settings["use_mock"]:
        # route to mock handlers by endpoint pattern or requestType in payload
        # Normalize endpoint and payload checks
        # Examples of endpoints:
        # "/GetEncoderID?HotelID=2"
        # "/Keys?requestType=new&HotelID=2"
        # "/CheckoutRoom?RoomNo=104&HotelID=2"
        # "/HealthCheck?HotelID=2"
        ep = (endpoint or "").lower()
        if "getencoderid" in ep:
            return _mock_get_encoder_id(settings["hotel_id"])
        if "keys" in ep:
            # data may contain requestType
            reqt = (data or {}).get("requestType", "").lower() if data else ""
            if reqt in ("new", "copy", "roommove", "stayextension", "stayextension".lower()):
                return _mock_keys_new(data or {})
            # fallback
            return _mock_keys_new(data or {})
        if "checkoutroom" in ep:
            # try parse RoomNo from endpoint params if not passed in data
            room_no = None
            # if params dict passed
            if params and params.get("RoomNo"):
                room_no = params.get("RoomNo")
            else:
                # try from endpoint string ?RoomNo=...
                import re
                m = re.search(r"roomno=([^&]+)", endpoint, re.IGNORECASE)
                if m:
                    room_no = m.group(1)
            return _mock_checkout_room(room_no, settings["hotel_id"])
        if "healthcheck" in ep or "health" in ep:
            return _mock_health_check(settings["hotel_id"])

        # default mock fallback
        return {"message": "mock response"}
    else:
        # call real API
        return call_lock_api_real(endpoint, method=method, data=data, params=params)

# -----------------------------
# Convenience whitelisted methods for console / tests
# -----------------------------
@frappe.whitelist()
def get_encoder_id():
    settings = get_lock_settings()
    endpoint = f"/GetEncoderID?HotelID={settings['hotel_id']}"
    res = call_lock_api(endpoint, method="GET")
    # if mock -> res is dict possibly with encoderID
    if isinstance(res, dict) and res.get("encoderID"):
        frappe.db.set_value("Hotel Lock Settings", None, "encoder_id", res.get("encoderID"))
        frappe.msgprint(f"Encoder ID saved: {res.get('encoderID')}")
    return res

@frappe.whitelist()
def generate_key(payload):
    """
    payload: dict-like with required fields (requestType, encoder, hotelID, roomNumber, guestName, arrivalDate, departureDate, noOfCards, isCommonAreaAccess)
    Call via frappe.call("igusto.igusto.api.hotel_lock_integration.generate_key", { "payload": {...} })
    """
    settings = get_lock_settings()
    endpoint = f"/Keys?requestType={payload.get('requestType')}&HotelID={settings['hotel_id']}"
    return call_lock_api(endpoint, method="POST", data=payload)

@frappe.whitelist()
def checkout_room(room_no):
    settings = get_lock_settings()
    endpoint = f"/CheckoutRoom?RoomNo={room_no}&HotelID={settings['hotel_id']}"
    return call_lock_api(endpoint, method="POST")
