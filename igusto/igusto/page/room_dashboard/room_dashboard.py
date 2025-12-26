import frappe
from frappe.utils import getdate, now_datetime, date_diff

@frappe.whitelist()
def get_rooms():
    """Fetch all rooms with their current status and booking progress details"""
    
    rooms = frappe.get_all(
        "Room",
        fields=[
            "name",
            "room_number",
            "room_type",
            "status",
            "current_guest",
            "current_booking",
            "housekeeping_status"
        ]
    )
    
    # Sort rooms numerically by room_number
    rooms.sort(key=lambda x: int(x.get('room_number', 0)) if str(x.get('room_number', '')).isdigit() else float('inf'))
    
    # Add booking progress info for occupied rooms
    current_date = getdate()
    
    for room in rooms:
        room['booking_progress'] = None
        room['from_date'] = None
        room['to_date'] = None
        room['days_completed'] = 0
        room['total_days'] = 0
        
        # Check if room is occupied/booked
        if room.get('status') in ['Occupied', 'Booked']:
            # Find active Guest Onboarding for this room
            guest_onboarding = frappe.db.sql("""
                SELECT 
                    from_date,
                    to_date,
                    name
                FROM `tabGuest Onboarding`
                WHERE room_number = %s
                    AND from_date <= %s
                    AND to_date >= %s
                    AND docstatus != 2
                ORDER BY from_date DESC
                LIMIT 1
            """, (room.get('room_number'), current_date, current_date), as_dict=1)
            
            if guest_onboarding:
                onboarding = guest_onboarding[0]
                from_date = getdate(onboarding.from_date)
                to_date = getdate(onboarding.to_date)
                
                # Calculate total days and days completed
                total_days = date_diff(to_date, from_date) + 1  # +1 to include both dates
                days_completed = date_diff(current_date, from_date) + 1
                
                # Ensure values are within bounds
                days_completed = max(0, min(days_completed, total_days))
                
                # Calculate progress percentage
                progress_percent = (days_completed / total_days * 100) if total_days > 0 else 0
                
                room['booking_progress'] = round(progress_percent, 1)
                room['from_date'] = str(from_date)
                room['to_date'] = str(to_date)
                room['days_completed'] = days_completed
                room['total_days'] = total_days
    
    return rooms