frappe.ui.form.on("Guest Onboarding", {
    room_number: async function(frm) {
        if (!frm.doc.room_number) return;

        console.log("Updating Room for Guest:", frm.doc.guest);

        try {
            // Update Room fields in backend
            await frappe.db.set_value("Room", frm.doc.room_number, {
                status: "Occupied",
                current_guest: frm.doc.guest || "",
                rfid_key: frm.doc.rfid_card_no || ""
            });

            frappe.show_alert({
                message: __("✅ Room updated successfully: Occupied, Guest & RFID set"),
                indicator: "green"
            });
        } catch (e) {
            console.error("Room update failed:", e);
            frappe.msgprint(__("❌ Failed to update Room: ") + e.message);
        }
    }
});
