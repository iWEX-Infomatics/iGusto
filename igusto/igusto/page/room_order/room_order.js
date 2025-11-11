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
    this.load_room_numbers();
  }

  make() {
    $(frappe.render_template("room_order", {})).appendTo(this.page.body);

    // listeners
    $("#service_type").on("change", (e) => {
      this.render_dynamic_fields(e.target.value);
    });

    $("#room_number").on("change", (e) => {
      const room = e.target.value;
      if (room) {
        this.fetch_guest_for_room(room);
      } else {
        $("#guest_name").val("");
      }
    });

    $("#submit_order").on("click", () => {
      this.submit_order();
    });
  }

  load_room_numbers() {
    // fetch room numbers from Guest Onboarding doctype
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_room_numbers",
      callback: (r) => {
        if (r.message) {
          const sel = $("#room_number");
          sel.empty();
          sel.append(`<option value="">Select Room Number</option>`);
          r.message.forEach(rn => {
            sel.append(`<option value="${frappe.utils.escape_html(rn)}">${frappe.utils.escape_html(rn)}</option>`);
          });
        }
      }
    });
  }

  fetch_guest_for_room(room_number) {
    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.get_guest_by_room",
      args: { room_number },
      callback: (r) => {
        if (r.message) {
          $("#guest_name").val(r.message);
        } else {
          $("#guest_name").val("");
          frappe.msgprint("No guest found for selected room.");
        }
      }
    });
  }

  render_dynamic_fields(service_type) {
    const container = $("#dynamic_input");
    container.empty();

    if (!service_type) return;

    if (service_type === "Restaurant") {
      // restaurant: dropdown of menu items + qty + remarks
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_menu_items",
        callback: (r) => {
          if (r.message) {
            let html = `<div class="form-group"><label>Menu Item</label>
              <select id="service_item" class="form-control"><option value="">Select Item</option>
              ${r.message.map(i => `<option value="${i.item_name}">${i.item_name}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" id="quantity" class="form-control" min="1" value="1">
            </div>
            <div class="form-group">
              <label>Custom Remarks</label>
              <input type="text" id="custom_remarks" class="form-control" placeholder="Any custom instructions">
            </div>
            <div class="form-group">
              <label>Preview Rate</label>
              <div id="preview_rate">Select item to see rate</div>
            </div>`;
            container.html(html);

            $("#service_item").on("change", (e) => {
              const item_name = e.target.value;
              if (item_name) {
                frappe.call({
                  method: "igusto.igusto.page.room_order.room_order.get_item_rate",
                  args: { item_name },
                  callback: (res) => {
                    $("#preview_rate").text(res.message != null ? res.message : "0");
                  }
                });
              } else {
                $("#preview_rate").text("Select item to see rate");
              }
            });
          }
        }
      });

    } else if (service_type === "Room Service") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_service_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Room Service Items</label>`;
            r.message.forEach((item, idx) => {
              html += `<div class="item-row" data-item-index="${idx}">
                  <div>
                    <input type="checkbox" id="rs_chk_${idx}" name="service_item" value="${item}"> <label for="rs_chk_${idx}">${item}</label>
                  </div>
                  <div class="item-controls">
                    <input type="number" id="rs_qty_${idx}" class="form-control" min="1" value="1" style="width:80px;" disabled>
                  </div>
                  <div>
                    <input type="text" id="rs_remark_${idx}" class="form-control" placeholder="Remarks (optional)" disabled>
                  </div>
                </div>`;
            });
            container.html(html);
            // enable qty/remark when checked
            r.message.forEach((item, idx) => {
              $(`#rs_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#rs_qty_${idx}`).prop("disabled", !checked);
                $(`#rs_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

    } else if (service_type === "Spa") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_spa_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Spa Services</label>`;
            r.message.forEach((item, idx) => {
              html += `<div class="item-row" data-item-index="${idx}">
                <div><input type="checkbox" id="spa_chk_${idx}" name="service_item" value="${item}"> <label for="spa_chk_${idx}">${item}</label></div>
                <div class="item-controls"><input type="number" id="spa_qty_${idx}" class="form-control" min="1" value="1" style="width:80px;" disabled></div>
                <div><input type="text" id="spa_remark_${idx}" class="form-control" placeholder="Remarks (optional)" disabled></div>
              </div>`;
            });
            container.html(html);
            r.message.forEach((item, idx) => {
              $(`#spa_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#spa_qty_${idx}`).prop("disabled", !checked);
                $(`#spa_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

    } else if (service_type === "Laundry") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_laundry_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Laundry Services</label>`;
            r.message.forEach((item, idx) => {
              html += `<div class="item-row" data-item-index="${idx}">
                <div><input type="checkbox" id="laundry_chk_${idx}" name="service_item" value="${item}"> <label for="laundry_chk_${idx}">${item}</label></div>
                <div class="item-controls"><input type="number" id="laundry_qty_${idx}" class="form-control" min="1" value="1" style="width:80px;" disabled></div>
                <div><input type="text" id="laundry_remark_${idx}" class="form-control" placeholder="Remarks (optional)" disabled></div>
              </div>`;
            });
            container.html(html);
            r.message.forEach((item, idx) => {
              $(`#laundry_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#laundry_qty_${idx}`).prop("disabled", !checked);
                $(`#laundry_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

    } else if (service_type === "Transport") {
      frappe.call({
        method: "igusto.igusto.page.room_order.room_order.get_transport_items",
        callback: (r) => {
          if (r.message) {
            let html = `<label>Transport Options</label>`;
            r.message.forEach((item, idx) => {
              html += `<div class="item-row" data-item-index="${idx}">
                <div><input type="checkbox" id="trans_chk_${idx}" name="service_item" value="${item}"> <label for="trans_chk_${idx}">${item}</label></div>
                <div class="item-controls"><input type="number" id="trans_qty_${idx}" class="form-control" min="1" value="1" style="width:80px;" disabled></div>
                <div><input type="text" id="trans_remark_${idx}" class="form-control" placeholder="Remarks (optional)" disabled></div>
              </div>`;
            });
            container.html(html);
            r.message.forEach((item, idx) => {
              $(`#trans_chk_${idx}`).on("change", function () {
                const checked = $(this).is(":checked");
                $(`#trans_qty_${idx}`).prop("disabled", !checked);
                $(`#trans_remark_${idx}`).prop("disabled", !checked);
              });
            });
          }
        }
      });

    } else if (service_type === "Other") {
      let html = `
        <div class="form-group">
          <label>Describe Service</label>
          <input type="text" id="service_item_other" class="form-control" placeholder="Enter service details">
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input type="number" id="quantity_other" class="form-control" min="1" value="1">
        </div>
        <div class="form-group">
          <label>Custom Remarks</label>
          <input type="text" id="custom_remarks_other" class="form-control" placeholder="Any custom instructions">
        </div>
      `;
      container.html(html);
    }
  }

  collect_items(service_type) {
    const items = [];

    if (service_type === "Restaurant") {
      const item_name = $("#service_item").val();
      if (item_name) {
        items.push({
          item_name,
          quantity: parseInt($("#quantity").val() || 1),
          custom_remarks: $("#custom_remarks").val() || ""
        });
      }
    } else if (["Room Service", "Spa", "Laundry", "Transport"].includes(service_type)) {
      $(`input[name='service_item']`).each(function (idx, el) {
        const $el = $(el);
        if ($el.is(":checked")) {
          const idxAttr = $el.attr("id").split("_").pop();
          // create consistent ids as used above
          const qty = $(`#${$el.attr("id").replace('_chk_', '_qty_')}`).val() || 1;
          const remark = $(`#${$el.attr("id").replace('_chk_', '_remark_')}`).val() || "";
          items.push({
            item_name: $el.val(),
            quantity: parseInt(qty),
            custom_remarks: remark
          });
        }
      });
    } else if (service_type === "Other") {
      const desc = $("#service_item_other").val();
      if (desc) {
        items.push({
          item_name: desc,
          quantity: parseInt($("#quantity_other").val() || 1),
          custom_remarks: $("#custom_remarks_other").val() || ""
        });
      }
    }

    return items;
  }

  submit_order() {
    const data = {
      room_number: $("#room_number").val(),
      guest: $("#guest_name").val(),
      service_type: $("#service_type").val(),
      delivery_to: $("#delivery_to").val(),
    };

    if (!data.room_number) return frappe.msgprint("Please select Room Number.");
    if (!data.guest) return frappe.msgprint("Guest not found for selected room.");
    if (!data.service_type) return frappe.msgprint("Please select Service Type.");

    const collected = this.collect_items(data.service_type);
    if (!collected.length) return frappe.msgprint("Please select at least one service item.");

    data.items = collected;

    frappe.call({
      method: "igusto.igusto.page.room_order.room_order.create_room_order",
      args: { data: JSON.stringify(data) },
      freeze: true,
      freeze_message: __("Creating Room Order..."),
      callback: (r) => {
        if (r.message) {
          frappe.msgprint({
            title: __("Success"),
            message: `<b>Room Order Created</b>`,
            indicator: "green"
          });
          // reset form
          $("#service_type").val("");
          $("#dynamic_input").empty();
        } else {
          frappe.msgprint("Could not create Room Order. Check server logs.");
        }
      }
    });
  }
}
