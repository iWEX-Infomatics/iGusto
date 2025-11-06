frappe.pages['room-order'].on_page_load = function (wrapper) {
  new RoomOrder(wrapper);
};

class RoomOrder {
  constructor(wrapper) {
    this.page = frappe.ui.make_app_page({
      parent: wrapper,
      title: '',
      single_column: true
    });
    this.make();
  }

  make() {
    $(frappe.render_template("room_order", {})).appendTo(this.page.body);

    $("#service_type").on("change", (e) => {
      this.render_dynamic_fields(e.target.value);
    });

    $("#submit_order").on("click", () => {
      this.submit_order();
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
                  ${r.message.map(i => `<option value="${i.item_name}">${i.item_name}</option>`).join("")}
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
            let html = `<label>Room Service Items</label>`;
            r.message.forEach(item => {
              html += `<div><input type="checkbox" name="service_item" value="${item}"> ${item}</div>`;
            });
            container.html(html);
          }
        }
      });

    } else if (service_type === "Spa") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_spa_items",
        callback: function (r) {
          if (r.message) {
            let html = `<label>Spa Services</label>`;
            r.message.forEach(item => {
              html += `<div><input type="checkbox" name="service_item" value="${item}"> ${item}</div>`;
            });
            container.html(html);
          }
        }
      });

    } else if (service_type === "Laundry") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_laundry_items",
        callback: function (r) {
          if (r.message) {
            let html = `<label>Laundry Services</label>`;
            r.message.forEach(item => {
              html += `<div><input type="checkbox" name="service_item" value="${item}"> ${item}</div>`;
            });
            container.html(html);
          }
        }
      });

    } else if (service_type === "Transport") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_transport_items",
        callback: function (r) {
          if (r.message) {
            let html = `<label>Transport Options</label>`;
            r.message.forEach(item => {
              html += `<div><input type="checkbox" name="service_item" value="${item}"> ${item}</div>`;
            });
            container.html(html);
          }
        }
      });

    } else if (service_type === "Other") {
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
      service_type: $("#service_type").val()
    };

    if (!data.guest) return frappe.msgprint("Please enter Guest Name.");
    if (!data.room_number) return frappe.msgprint("Please enter Room Number.");
    if (!data.service_type) return frappe.msgprint("Please select Service Type.");

    // Handle input values
    if (["Restaurant"].includes(data.service_type)) {
      data.service_item = $("#service_item").val();
      data.quantity = parseInt($("#quantity").val()) || 1;

    } else if (["Room Service", "Spa", "Laundry", "Transport"].includes(data.service_type)) {
      data.service_item = [];
      $("input[name='service_item']:checked").each(function () {
        data.service_item.push($(this).val());
      });
      data.quantity = 1;

    } else if (data.service_type === "Other") {
      data.service_item = $("#service_item").val();
      data.describe_service = $("#service_item").val();
      data.quantity = 1;
    }

    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.create_room_order",
      args: { data: JSON.stringify(data) },
      freeze: true,
      freeze_message: __("Creating Service & Sales Order..."),
      callback: function (r) {
        if (r.message) {
          frappe.msgprint({
            title: __("Success"),
            message: `
              <b>Service Order:</b> ${r.message.service_order} <br>
              <b>Sales Order:</b> ${r.message.sales_order}
            `,
            indicator: "green"
          });
        }
      }
    });
  }
}
