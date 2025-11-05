frappe.pages['room-order'].on_page_load = function (wrapper) {
  new RoomOrder(wrapper);
};

class RoomOrder {
  constructor(wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: 'Room Order',
      single_column: true
    });
    this.make();
  }

  make() {
    // Render HTML
    $(frappe.render_template("room_order", {})).appendTo(this.page.body);

    // Load room
    // this.load_room();

    // On service type change
    $("#service_type").on("change", (e) => {
      this.render_dynamic_fields(e.target.value);
    });

    // Submit order
    $("#submit_order").on("click", () => {
      this.submit_order();
    });
  }

  load_room() {
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_latest_guest_room",
      callback: function (r) {
        if (r.message) {
          $("#room_number").val(r.message.room_number);
          $("#room_number").data("assign", r.message.assign);
        }
      }
    });
  }

  render_dynamic_fields(service_type) {
    const container = $("#dynamic_input");
    container.empty();

    if (service_type === "Restaurant") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_menu_items",
        callback: function (r) {
          if (r.message) {
            let html = `
              <div class="form-group">
                <label>Menu Item</label>
                <select id="service_item" class="form-control">
                  <option value="">Select Item</option>
                  ${r.message.map(item => `<option value="${item.item_name}">${item.item_name}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label>Quantity</label>
                <input type="number" id="quantity" class="form-control" min="1" value="1">
              </div>`;
            container.html(html);
          }
        }
      });

    } else if (service_type === "Room Service") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_service_items",
        callback: function (r) {
          if (r.message) {
            let html = `<label>Service Items</label>`;
            r.message.forEach(item => {
              html += `
                <div>
                  <input type="checkbox" name="service_item" value="${item}">
                  ${item}
                </div>`;
            });
            container.html(html);
          }
        }
      });

    } else if (["Spa", "Transport", "Laundry", "Other"].includes(service_type)) {
      container.html(`
        <div class="form-group">
          <label>Describe Service</label>
          <input type="text" id="service_item" class="form-control" placeholder="Enter service details">
        </div>
      `);
    }
  }

submit_order() {
  let data = {
    guest: $("#guest_name").val(),
    room_number: $("#room_number").val(),
    service_type: $("#service_type").val(),
    assign: $("#room_number").data("assign")
  };

  if (!data.guest) return frappe.msgprint("Please enter Guest Name.");
  if (!data.room_number) return frappe.msgprint("Room Number is missing.");
  if (!data.service_type) return frappe.msgprint("Please select Service Type.");

  if (data.service_type === "Restaurant") {
    data.service_item = $("#service_item").val();
    data.quantity = parseInt($("#quantity").val()) || 1;

  } else if (data.service_type === "Room Service") {
    data.service_item = [];
    $("input[name='service_item']:checked").each(function () {
      data.service_item.push($(this).val());
    });
    data.quantity = 1;

  } else if (["Spa", "Transport", "Laundry", "Other"].includes(data.service_type)) {
    data.service_item = $("#service_item").val();
    data.quantity = 1;
    data.describe_service = $("#service_item").val(); // will go into remarks
  }

  frappe.call({
    method: "igusto.igusto.page.room_order.room_order.create_room_order",
    args: { data: JSON.stringify(data) },
    freeze: true,
    freeze_message: __("Creating Service Order..."),
    callback: function (r) {
      if (r.message) {
        frappe.msgprint({
          title: __("Success"),
          message: `Service Order Created: <b>${r.message}</b>`,
          indicator: "green"
        });
      }
    }
  });
}

}
