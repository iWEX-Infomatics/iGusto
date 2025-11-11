import frappe
import hashlib

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
        frappe.msgprint(f"Duplicate avoided. Using existing file: {existing_file.file_name}")
