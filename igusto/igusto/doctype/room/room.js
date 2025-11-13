frappe.ui.form.on('Room', {
  refresh(frm) {
    if (!frm.is_new()) {
      // Call backend method to generate QR dynamically
      frappe.call({
        method: 'igusto.igusto.doctype.room.room.generate_room_qr',
        args: { room_name: frm.doc.name },
        callback: function(r) {
          if (r.message) {
            // Remove old QR if any
            if (frm.fields_dict.room_qr_preview) {
              $(frm.fields_dict.room_qr_preview.wrapper).empty();
            }

            const img_html = `
              <div style="text-align:center; margin-top:10px;">
                <img src="data:image/png;base64,${r.message}" 
                     width="150" height="150"
                     style="border:1px solid #ccc; border-radius:10px; padding:6px; background:#fafafa;">
                <div style="margin-top:6px;">
                  <a href="/app/room-order?room_id=${frm.doc.name}" target="_blank"
                     style="color:#007bff; text-decoration:none; font-weight:500;">
                     Open Room Link
                  </a>
                </div>
              </div>`;

            const roomTypeField = frm.fields_dict["room_type"].$wrapper;
            let qrDiv = roomTypeField.find(".room-qr-container");

            if (qrDiv.length === 0) {
              qrDiv = $(`<div class="room-qr-container" style="margin-left:20px; display:inline-block; vertical-align:middle;"></div>`);
              roomTypeField.append(qrDiv);
            }

            qrDiv.html(img_html);
          }
        }
      });
    } else {
      $(".room-qr-container").remove();
    }
  }
});
