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
    $(frappe.render_template("room_order", {})).appendTo(this.page.body);

    this.load_guest_and_room();

    $("#order_type").on("change", (e) => {
      this.render_dynamic_fields(e.target.value);
    });

    $("#submit_order").on("click", () => {
      this.submit_order();
    });
  }

  load_guest_and_room() {
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_latest_guest_room",
      callback: function (r) {
        if (r.message) {
          $("#guest_name").val(r.message.guest_name);
          $("#room_number").val(r.message.room_number);
        }
      }
    });
  }

  render_dynamic_fields(order_type) {
    const container = $("#dynamic_input");
    container.empty();

    if (order_type === "Restaurant") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_menu_items",
        callback: function (r) {
          if (r.message) {
            let html = `
              <div class="form-group">
                <label>Menu Item</label>
                <select id="service_item" class="form-control">
                  <option value="">Select Item</option>
                  ${r.message.map(item => `<option value="${item.name}">${item.item_name}</option>`).join("")}
                </select>
              </div>`;
            container.html(html);
          }
        }
      });
    } else if (order_type === "Room Service") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_service_items",
        callback: function (r) {
          if (r.message) {
            let html = `<label>Service Items</label>`;
            r.message.forEach(item => {
              html += `<div><input type="checkbox" name="service_item" value="${item}"> ${item}</div>`;
            });
            container.html(html);
          }
        }
      });
    } else if (order_type === "Other") {
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
      order_type: $("#order_type").val(),
    };

    if (data.order_type === "Restaurant") {
      data.service_item = $("#service_item").val();
    } else if (data.order_type === "Room Service") {
      data.service_item = [];
      $("input[name='service_item']:checked").each(function () {
        data.service_item.push($(this).val());
      });
    } else if (data.order_type === "Other") {
      data.service_item = $("#service_item").val();
    }

    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.create_room_order",
      args: { data: JSON.stringify(data) },
      callback: function (r) {
        if (r.message) {
          frappe.msgprint({
            title: __("Success"),
            message: ` Room Order Created: ${r.message}`,
            indicator: "green"
          });
        }
      }
    });
  }
}
