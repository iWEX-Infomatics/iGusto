import frappe

@frappe.whitelist()
def create_guest(first_name, middle_name=None, last_name=None, full_name=None, mobile_no=None, email=None, gender=None, nationality=None):
	try:
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
		frappe.db.commit()
		return doc
	except Exception as e:
		frappe.log_error(frappe.get_traceback(), "Guest Signup Error")
		frappe.throw(f"Error creating Guest: {str(e)}")
